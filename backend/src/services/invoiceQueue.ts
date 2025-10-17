import logger from '../config/logger';
import { processInvoice, validateInvoiceData, generateCorrectionSuggestions, checkDuplicateInvoice } from './ocrService';
import prisma from '../config/database';
import { deleteFile } from '../config/upload';

export interface QueueJob {
  id: string;
  filePath: string;
  fileName: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

class InvoiceQueue {
  private queue: QueueJob[] = [];
  private processing = false;
  private maxConcurrent = 3; // Process 3 invoices at a time
  private activeJobs = 0;

  /**
   * Add invoice to processing queue
   */
  addJob(filePath: string, fileName: string, userId: string): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const job: QueueJob = {
      id: jobId,
      filePath,
      fileName,
      userId,
      status: 'PENDING',
      progress: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    logger.info('Invoice job added to queue', { jobId, fileName });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Add multiple jobs (batch)
   */
  addBatchJobs(files: Array<{ path: string; filename: string }>, userId: string): string[] {
    const jobIds = files.map(file => this.addJob(file.path, file.filename, userId));
    logger.info('Batch jobs added to queue', { count: jobIds.length, userId });
    return jobIds;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.queue.find(job => job.id === jobId);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): QueueJob[] {
    return this.queue.filter(job => job.userId === userId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(j => j.status === 'PENDING').length,
      processing: this.queue.filter(j => j.status === 'PROCESSING').length,
      completed: this.queue.filter(j => j.status === 'COMPLETED').length,
      failed: this.queue.filter(j => j.status === 'FAILED').length,
      activeJobs: this.activeJobs,
    };
  }

  /**
   * Process queue with concurrency control
   */
  private async processQueue() {
    this.processing = true;

    while (this.queue.some(job => job.status === 'PENDING') || this.activeJobs > 0) {
      // Find pending jobs up to max concurrent limit
      const pendingJobs = this.queue
        .filter(job => job.status === 'PENDING')
        .slice(0, this.maxConcurrent - this.activeJobs);

      if (pendingJobs.length === 0) {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Process jobs concurrently
      const promises = pendingJobs.map(job => this.processJob(job));
      await Promise.allSettled(promises);
    }

    this.processing = false;
    logger.info('Queue processing completed');
  }

  /**
   * Process a single invoice job
   */
  private async processJob(job: QueueJob): Promise<void> {
    this.activeJobs++;
    job.status = 'PROCESSING';
    job.progress = 10;

    logger.info('Processing invoice job', { jobId: job.id, fileName: job.fileName });

    try {
      // Step 1: OCR extraction
      job.progress = 20;
      const extractedData = await processInvoice(job.filePath, true);
      job.progress = 50;

      // Step 2: Validation
      const validation = await validateInvoiceData(extractedData);
      job.progress = 70;

      // Step 3: Duplicate check
      const duplicateCheck = await checkDuplicateInvoice(
        extractedData.invoiceNumber,
        extractedData.supplierName,
        prisma
      );
      job.progress = 85;

      // Step 4: Generate correction suggestions
      const corrections = await generateCorrectionSuggestions(extractedData, validation);
      job.progress = 95;

      // Complete job
      job.status = 'COMPLETED';
      job.progress = 100;
      job.completedAt = new Date();
      job.result = {
        extractedData,
        validation,
        duplicateCheck,
        corrections,
        filePath: job.fileName,
      };

      logger.info('Invoice job completed successfully', { jobId: job.id });
    } catch (error: any) {
      job.status = 'FAILED';
      job.error = error.message;
      job.completedAt = new Date();

      logger.error('Invoice job failed', { jobId: job.id, error: error.message });

      // Clean up file on error
      deleteFile(job.filePath);
    } finally {
      this.activeJobs--;

      // Clean up old completed/failed jobs (keep for 1 hour)
      this.cleanupOldJobs();
    }
  }

  /**
   * Remove old jobs from queue
   */
  private cleanupOldJobs() {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const beforeCount = this.queue.length;

    this.queue = this.queue.filter(job => {
      if ((job.status === 'COMPLETED' || job.status === 'FAILED') && job.completedAt) {
        return job.completedAt > oneHourAgo;
      }
      return true;
    });

    const removed = beforeCount - this.queue.length;
    if (removed > 0) {
      logger.info('Cleaned up old jobs from queue', { removed });
    }
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId);
    if (!job) return false;

    if (job.status === 'PENDING') {
      job.status = 'FAILED';
      job.error = 'Cancelled by user';
      job.completedAt = new Date();
      deleteFile(job.filePath);
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.queue.find(j => j.id === jobId);
    if (!job || job.status !== 'FAILED') return false;

    job.status = 'PENDING';
    job.progress = 0;
    job.error = undefined;
    job.completedAt = undefined;

    if (!this.processing) {
      this.processQueue();
    }

    return true;
  }
}

// Export singleton instance
export const invoiceQueue = new InvoiceQueue();

/**
 * Process batch of invoices with progress tracking
 */
export async function processBatchWithProgress(
  files: Array<{ path: string; filename: string }>,
  userId: string,
  onProgress?: (progress: { completed: number; total: number; current?: string }) => void
): Promise<any[]> {
  const results: any[] = [];
  let completed = 0;

  for (const file of files) {
    try {
      if (onProgress) {
        onProgress({ completed, total: files.length, current: file.filename });
      }

      const extractedData = await processInvoice(file.path, true);
      const validation = await validateInvoiceData(extractedData);
      const duplicateCheck = await checkDuplicateInvoice(
        extractedData.invoiceNumber,
        extractedData.supplierName,
        prisma
      );
      const corrections = await generateCorrectionSuggestions(extractedData, validation);

      results.push({
        filename: file.filename,
        success: true,
        extractedData,
        validation,
        duplicateCheck,
        corrections,
      });
    } catch (error: any) {
      results.push({
        filename: file.filename,
        success: false,
        error: error.message,
      });
      deleteFile(file.path);
    }

    completed++;
    if (onProgress) {
      onProgress({ completed, total: files.length });
    }
  }

  return results;
}

/**
 * Intelligent batching: Group invoices by supplier for efficient processing
 */
export async function intelligentBatchProcessing(
  files: Array<{ path: string; filename: string; metadata?: any }>,
  userId: string
): Promise<{
  bySupplier: Record<string, any[]>;
  duplicates: any[];
  recommendations: string[];
}> {
  const bySupplier: Record<string, any[]> = {};
  const duplicates: any[] = [];
  const recommendations: string[] = [];

  // Process all files
  const allResults = await processBatchWithProgress(files, userId);

  // Group by supplier
  for (const result of allResults) {
    if (!result.success) continue;

    const supplierName = result.extractedData.supplierName;
    if (!bySupplier[supplierName]) {
      bySupplier[supplierName] = [];
    }
    bySupplier[supplierName].push(result);

    // Track duplicates
    if (result.duplicateCheck.isDuplicate) {
      duplicates.push(result);
    }
  }

  // Generate recommendations
  const supplierCount = Object.keys(bySupplier).length;
  recommendations.push(`Processed invoices from ${supplierCount} different suppliers`);

  if (duplicates.length > 0) {
    recommendations.push(`Found ${duplicates.length} duplicate invoices - review before approval`);
  }

  const autoApprovable = allResults.filter(r => r.success && r.validation.canAutoApprove).length;
  if (autoApprovable > 0) {
    recommendations.push(`${autoApprovable} invoices qualify for auto-approval`);
  }

  return {
    bySupplier,
    duplicates,
    recommendations,
  };
}

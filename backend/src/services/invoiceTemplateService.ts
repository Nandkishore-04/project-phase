import logger from '../config/logger';
import prisma from '../config/database';
import { ExtractedInvoiceData } from './ocrService';
import redisClient from '../config/redis';

export interface InvoiceTemplate {
  supplierId: string;
  supplierName: string;
  patterns: {
    invoiceNumberFormat?: string;
    dateFormats: string[];
    commonHSNCodes: string[];
    commonItemNames: string[];
    avgItemCount: number;
    avgTotalAmount: number;
    gstType: 'CGST_SGST' | 'IGST' | 'BOTH';
  };
  statistics: {
    totalInvoicesProcessed: number;
    lastUpdated: Date;
    accuracyRate: number;
  };
}

class InvoiceTemplateService {
  private cachePrefix = 'invoice:template:';

  /**
   * Learn from processed invoice to improve future extractions
   */
  async learnFromInvoice(
    invoiceData: ExtractedInvoiceData,
    supplierId: string,
    wasAccurate: boolean = true
  ): Promise<void> {
    try {
      let template = await this.getTemplate(supplierId);

      if (!template) {
        // Create new template
        template = {
          supplierId,
          supplierName: invoiceData.supplierName,
          patterns: {
            invoiceNumberFormat: this.extractInvoiceNumberPattern(invoiceData.invoiceNumber),
            dateFormats: [],
            commonHSNCodes: [],
            commonItemNames: [],
            avgItemCount: invoiceData.items.length,
            avgTotalAmount: invoiceData.totalAmount,
            gstType: this.detectGSTType(invoiceData),
          },
          statistics: {
            totalInvoicesProcessed: 1,
            lastUpdated: new Date(),
            accuracyRate: wasAccurate ? 100 : 0,
          },
        };
      } else {
        // Update existing template
        template.patterns.commonHSNCodes = this.updateCommonValues(
          template.patterns.commonHSNCodes,
          invoiceData.items.map(i => i.hsnCode).filter(Boolean) as string[]
        );

        template.patterns.commonItemNames = this.updateCommonValues(
          template.patterns.commonItemNames,
          invoiceData.items.map(i => i.name)
        );

        // Update averages (moving average)
        const count = template.statistics.totalInvoicesProcessed;
        template.patterns.avgItemCount =
          (template.patterns.avgItemCount * count + invoiceData.items.length) / (count + 1);
        template.patterns.avgTotalAmount =
          (template.patterns.avgTotalAmount * count + invoiceData.totalAmount) / (count + 1);

        // Update accuracy rate
        template.statistics.accuracyRate =
          (template.statistics.accuracyRate * count + (wasAccurate ? 100 : 0)) / (count + 1);

        template.statistics.totalInvoicesProcessed++;
        template.statistics.lastUpdated = new Date();
      }

      await this.saveTemplate(supplierId, template);
      logger.info('Invoice template learned/updated', { supplierId, template: template.patterns });
    } catch (error) {
      logger.error('Failed to learn from invoice', { error });
    }
  }

  /**
   * Get template for supplier (from cache or DB)
   */
  async getTemplate(supplierId: string): Promise<InvoiceTemplate | null> {
    try {
      // Try cache first
      const cached = await redisClient.get(`${this.cachePrefix}${supplierId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from database - stored as JSON in Supplier model
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { metadata: true },
      });

      if (supplier?.metadata) {
        const template = (supplier.metadata as any).invoiceTemplate as InvoiceTemplate;
        if (template) {
          // Cache it
          await redisClient.setex(`${this.cachePrefix}${supplierId}`, 86400, JSON.stringify(template));
          return template;
        }
      }
    } catch (error) {
      logger.warn('Failed to get template', { supplierId, error });
    }

    return null;
  }

  /**
   * Save template to database and cache
   */
  async saveTemplate(supplierId: string, template: InvoiceTemplate): Promise<void> {
    try {
      // Save to database
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          metadata: {
            invoiceTemplate: template,
          } as any,
        },
      });

      // Update cache
      await redisClient.setex(`${this.cachePrefix}${supplierId}`, 86400, JSON.stringify(template));
    } catch (error) {
      logger.error('Failed to save template', { supplierId, error });
    }
  }

  /**
   * Predict and validate invoice data using learned templates
   */
  async validateAgainstTemplate(
    invoiceData: ExtractedInvoiceData,
    supplierId: string
  ): Promise<{
    matches: boolean;
    anomalies: string[];
    suggestions: string[];
    confidence: number;
  }> {
    const anomalies: string[] = [];
    const suggestions: string[] = [];
    let matchScore = 100;

    const template = await this.getTemplate(supplierId);
    if (!template) {
      return {
        matches: true,
        anomalies: [],
        suggestions: ['No template available for this supplier - this is the first invoice'],
        confidence: 50,
      };
    }

    // Check invoice number format
    if (template.patterns.invoiceNumberFormat) {
      const pattern = new RegExp(template.patterns.invoiceNumberFormat);
      if (!pattern.test(invoiceData.invoiceNumber)) {
        anomalies.push(`Invoice number format differs from usual pattern`);
        matchScore -= 10;
      }
    }

    // Check item count
    const itemCountDiff = Math.abs(invoiceData.items.length - template.patterns.avgItemCount);
    if (itemCountDiff > template.patterns.avgItemCount * 0.5) {
      anomalies.push(
        `Unusual item count: ${invoiceData.items.length} items (avg: ${Math.round(template.patterns.avgItemCount)})`
      );
      matchScore -= 5;
    }

    // Check total amount
    const amountDiff = Math.abs(invoiceData.totalAmount - template.patterns.avgTotalAmount);
    const amountPercent = (amountDiff / template.patterns.avgTotalAmount) * 100;
    if (amountPercent > 50) {
      anomalies.push(
        `Unusual total amount: ₹${invoiceData.totalAmount.toLocaleString('en-IN')} (avg: ₹${template.patterns.avgTotalAmount.toLocaleString('en-IN')})`
      );
      matchScore -= 15;
      suggestions.push('Verify the total amount - it differs significantly from past invoices');
    }

    // Check GST type consistency
    const currentGSTType = this.detectGSTType(invoiceData);
    if (template.patterns.gstType !== 'BOTH' && currentGSTType !== template.patterns.gstType) {
      anomalies.push(`GST type changed: Expected ${template.patterns.gstType}, found ${currentGSTType}`);
      matchScore -= 10;
      suggestions.push('Verify GST type - supplier location may have changed');
    }

    // Check for common HSN codes
    const invoiceHSNCodes = invoiceData.items.map(i => i.hsnCode).filter(Boolean);
    const knownHSNs = template.patterns.commonHSNCodes;
    const hasCommonHSN = invoiceHSNCodes.some(code => knownHSNs.includes(code!));

    if (knownHSNs.length > 0 && !hasCommonHSN) {
      anomalies.push('None of the HSN codes match previously seen codes from this supplier');
      matchScore -= 10;
      suggestions.push('This may be a new product category from this supplier');
    }

    // Check for common item names
    const invoiceItemNames = invoiceData.items.map(i => i.name.toLowerCase());
    const knownItems = template.patterns.commonItemNames.map(n => n.toLowerCase());
    const hasCommonItem = invoiceItemNames.some(name =>
      knownItems.some(known => name.includes(known) || known.includes(name))
    );

    if (knownItems.length > 0 && !hasCommonItem) {
      anomalies.push('Item names do not match typical products from this supplier');
      matchScore -= 15;
    }

    // Generate suggestions based on template
    if (template.statistics.accuracyRate < 70) {
      suggestions.push(
        `This supplier has ${Math.round(template.statistics.accuracyRate)}% OCR accuracy - review carefully`
      );
    }

    if (anomalies.length === 0) {
      suggestions.push('Invoice matches expected patterns from this supplier');
    }

    return {
      matches: anomalies.length === 0,
      anomalies,
      suggestions,
      confidence: Math.max(0, Math.min(100, matchScore)),
    };
  }

  /**
   * Extract invoice number pattern (e.g., "INV-2024-001" -> "INV-\d{4}-\d{3}")
   */
  private extractInvoiceNumberPattern(invoiceNumber: string): string {
    return invoiceNumber
      .replace(/\d+/g, (match) => `\\d{${match.length}}`)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Detect GST type from invoice data
   */
  private detectGSTType(data: ExtractedInvoiceData): 'CGST_SGST' | 'IGST' | 'BOTH' {
    const hasCGSTSGST = (data.cgst || 0) > 0 || (data.sgst || 0) > 0;
    const hasIGST = (data.igst || 0) > 0;

    if (hasCGSTSGST && hasIGST) return 'BOTH';
    if (hasCGSTSGST) return 'CGST_SGST';
    if (hasIGST) return 'IGST';
    return 'CGST_SGST'; // Default
  }

  /**
   * Update common values list (keep most frequent)
   */
  private updateCommonValues(existing: string[], newValues: string[], maxSize: number = 20): string[] {
    const frequency: Record<string, number> = {};

    // Count existing
    existing.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });

    // Count new
    newValues.forEach(val => {
      if (val) {
        frequency[val] = (frequency[val] || 0) + 1;
      }
    });

    // Sort by frequency and take top N
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxSize)
      .map(([val]) => val);
  }

  /**
   * Get templates for all suppliers (for analytics)
   */
  async getAllTemplates(): Promise<InvoiceTemplate[]> {
    try {
      const suppliers = await prisma.supplier.findMany({
        where: {
          metadata: { not: null },
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      return suppliers
        .map(s => (s.metadata as any)?.invoiceTemplate as InvoiceTemplate)
        .filter(Boolean);
    } catch (error) {
      logger.error('Failed to get all templates', { error });
      return [];
    }
  }

  /**
   * Get supplier insights based on learned templates
   */
  async getSupplierInsights(supplierId: string): Promise<{
    reliability: 'HIGH' | 'MEDIUM' | 'LOW';
    predictability: number;
    recommendations: string[];
  }> {
    const template = await this.getTemplate(supplierId);
    const recommendations: string[] = [];

    if (!template) {
      return {
        reliability: 'LOW',
        predictability: 0,
        recommendations: ['Insufficient data - process more invoices to build supplier profile'],
      };
    }

    // Determine reliability
    let reliability: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (template.statistics.accuracyRate >= 90) {
      reliability = 'HIGH';
      recommendations.push('High OCR accuracy - invoices from this supplier can be auto-approved');
    } else if (template.statistics.accuracyRate >= 70) {
      reliability = 'MEDIUM';
      recommendations.push('Moderate accuracy - quick review recommended');
    } else {
      reliability = 'LOW';
      recommendations.push('Low accuracy - thorough manual review required');
    }

    // Predictability score
    const predictability = Math.round(
      (template.statistics.accuracyRate * 0.6 + Math.min(100, template.statistics.totalInvoicesProcessed * 5) * 0.4)
    );

    if (template.statistics.totalInvoicesProcessed < 5) {
      recommendations.push('Limited history - insights will improve with more invoices');
    }

    return {
      reliability,
      predictability,
      recommendations,
    };
  }
}

// Export singleton
export const templateService = new InvoiceTemplateService();

/**
 * Middleware to apply template-based validation
 */
export async function applyTemplateValidation(
  invoiceData: ExtractedInvoiceData,
  supplierId: string
): Promise<{
  original: ExtractedInvoiceData;
  templateValidation: Awaited<ReturnType<typeof templateService.validateAgainstTemplate>>;
  enhanced: boolean;
}> {
  const templateValidation = await templateService.validateAgainstTemplate(invoiceData, supplierId);

  // Enhance invoice data with template predictions if confidence is low
  let enhanced = false;
  if (invoiceData.confidence < 80 && templateValidation.confidence > 70) {
    const template = await templateService.getTemplate(supplierId);
    if (template) {
      // Suggest HSN codes for items missing them
      invoiceData.items.forEach(item => {
        if (!item.hsnCode && template.patterns.commonHSNCodes.length > 0) {
          // Find most common HSN for similar item names
          const suggestedHSN = template.patterns.commonHSNCodes[0];
          logger.info('Suggesting HSN from template', { item: item.name, suggestedHSN });
          enhanced = true;
        }
      });
    }
  }

  return {
    original: invoiceData,
    templateValidation,
    enhanced,
  };
}

import prisma from '../config/database';
import logger from '../config/logger';
import { forecastDemand } from './analyticsService';
import { getAIResponse } from './openaiService';

export interface ReorderRule {
  id: string;
  productId: string;
  enabled: boolean;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  autoApprove: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoReorderResult {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  estimatedCost: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  poCreated: boolean;
  poNumber?: string;
}

/**
 * Create or update auto-reorder rule for a product
 */
export async function createReorderRule(
  productId: string,
  rule: Partial<ReorderRule>,
  userId: string
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        reorderLevel: true,
        currentStock: true,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Use product's reorder level as default
    const minStockLevel = rule.minStockLevel || product.reorderLevel;
    const maxStockLevel = rule.maxStockLevel || product.reorderLevel * 3;
    const reorderQuantity = rule.reorderQuantity || product.reorderLevel * 2;

    // Store in product metadata
    await prisma.product.update({
      where: { id: productId },
      data: {
        metadata: {
          autoReorderRule: {
            enabled: rule.enabled ?? true,
            minStockLevel,
            maxStockLevel,
            reorderQuantity,
            leadTimeDays: rule.leadTimeDays || 7,
            autoApprove: rule.autoApprove || false,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        } as any,
      },
    });

    logger.info('Auto-reorder rule created/updated', { productId, rule });

    return {
      success: true,
      productId,
      rule: {
        enabled: rule.enabled ?? true,
        minStockLevel,
        maxStockLevel,
        reorderQuantity,
        leadTimeDays: rule.leadTimeDays || 7,
        autoApprove: rule.autoApprove || false,
      },
    };
  } catch (error) {
    logger.error('Error creating reorder rule:', error);
    throw error;
  }
}

/**
 * Get reorder rule for a product
 */
export async function getReorderRule(productId: string): Promise<ReorderRule | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        metadata: true,
        updatedAt: true,
      },
    });

    if (!product || !product.metadata) {
      return null;
    }

    const rule = (product.metadata as any).autoReorderRule;
    if (!rule) return null;

    return {
      id: product.id,
      productId: product.id,
      enabled: rule.enabled,
      minStockLevel: rule.minStockLevel,
      maxStockLevel: rule.maxStockLevel,
      reorderQuantity: rule.reorderQuantity,
      leadTimeDays: rule.leadTimeDays,
      autoApprove: rule.autoApprove,
      createdAt: new Date(rule.updatedAt),
      updatedAt: product.updatedAt,
    };
  } catch (error) {
    logger.error('Error getting reorder rule:', error);
    return null;
  }
}

/**
 * Check all products and trigger auto-reorders
 */
export async function runAutoReorderCheck(userId: string = 'system'): Promise<AutoReorderResult[]> {
  try {
    logger.info('Running auto-reorder check...');

    const products = await prisma.product.findMany({
      where: {
        metadata: {
          path: ['autoReorderRule', 'enabled'],
          equals: true,
        },
      },
      include: {
        supplier: true,
      },
    });

    const results: AutoReorderResult[] = [];

    for (const product of products) {
      const rule = (product.metadata as any)?.autoReorderRule;
      if (!rule) continue;

      // Check if stock is below minimum level
      if (product.currentStock > rule.minStockLevel) {
        continue; // No reorder needed
      }

      // Get demand forecast
      const forecast = await forecastDemand(product.id, rule.leadTimeDays);

      // Calculate reorder quantity
      let reorderQty = rule.reorderQuantity;

      // Adjust based on forecast if available
      if (forecast.forecast && forecast.confidence > 60) {
        const forecastedDemand = forecast.forecast.forecastedDemand;
        const targetStock = Math.max(rule.maxStockLevel, forecastedDemand);
        reorderQty = Math.ceil(targetStock - product.currentStock);
      }

      // Determine priority
      const priority = determinePriority(product.currentStock, rule.minStockLevel);

      const result: AutoReorderResult = {
        productId: product.id,
        productName: product.name,
        currentStock: product.currentStock,
        reorderLevel: rule.minStockLevel,
        suggestedQuantity: reorderQty,
        estimatedCost: reorderQty * product.unitPrice,
        priority,
        reason: generateReorderReason(product, rule, forecast),
        poCreated: false,
      };

      // Auto-create PO if enabled
      if (rule.autoApprove && product.supplier) {
        try {
          const po = await createAutoPurchaseOrder(product, reorderQty, userId);
          result.poCreated = true;
          result.poNumber = po.poNumber;
          logger.info('Auto-created purchase order', { poNumber: po.poNumber, productId: product.id });
        } catch (error) {
          logger.error('Failed to auto-create PO:', error);
          result.reason += ' (Failed to create PO automatically)';
        }
      }

      results.push(result);
    }

    logger.info('Auto-reorder check complete', { totalChecked: products.length, reordersNeeded: results.length });

    return results;
  } catch (error) {
    logger.error('Error running auto-reorder check:', error);
    throw new Error('Failed to run auto-reorder check');
  }
}

/**
 * Determine reorder priority
 */
function determinePriority(currentStock: number, minLevel: number): 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (currentStock === 0) return 'URGENT';
  if (currentStock <= minLevel * 0.25) return 'URGENT';
  if (currentStock <= minLevel * 0.5) return 'HIGH';
  if (currentStock <= minLevel * 0.75) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate human-readable reorder reason
 */
function generateReorderReason(product: any, rule: any, forecast: any): string {
  const reasons: string[] = [];

  if (product.currentStock === 0) {
    reasons.push('OUT OF STOCK');
  } else {
    reasons.push(`Stock below minimum level (${product.currentStock}/${rule.minStockLevel})`);
  }

  if (forecast.forecast && forecast.confidence > 60) {
    const trend = forecast.forecast.trend;
    if (trend === 'increasing') {
      reasons.push(`Demand trending up (+${forecast.forecast.trendPercentage.toFixed(1)}%)`);
    }

    if (forecast.forecast.daysUntilStockout < rule.leadTimeDays) {
      reasons.push(`Will run out in ${forecast.forecast.daysUntilStockout} days (lead time: ${rule.leadTimeDays} days)`);
    }
  }

  return reasons.join('; ');
}

/**
 * Create auto-purchase order
 */
async function createAutoPurchaseOrder(product: any, quantity: number, userId: string) {
  const poNumber = `AUTO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: product.supplierId,
      totalAmount: quantity * product.unitPrice,
      status: 'DRAFT',
      createdBy: userId,
      notes: `Auto-generated based on reorder rules for ${product.name}`,
      lineItems: {
        create: [
          {
            productId: product.id,
            quantity,
            unitPrice: product.unitPrice,
            total: quantity * product.unitPrice,
          },
        ],
      },
    },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: true,
        },
      },
    },
  });

  return purchaseOrder;
}

/**
 * AI-powered smart reordering with optimization
 */
export async function getSmartReorderSuggestions(options?: {
  budgetLimit?: number;
  priorityOnly?: boolean;
}) {
  try {
    logger.info('Generating smart reorder suggestions...', options);

    // Get all products that need reordering
    const products = await prisma.product.findMany({
      where: {
        currentStock: {
          lte: prisma.product.fields.reorderLevel,
        },
      },
      include: {
        supplier: true,
      },
      orderBy: {
        currentStock: 'asc',
      },
    });

    // Get forecasts and calculate priorities
    const suggestions = await Promise.all(
      products.map(async (product) => {
        const forecast = await forecastDemand(product.id, 30);
        const rule = await getReorderRule(product.id);

        const suggestedQty = forecast.forecast?.suggestedOrderQuantity || product.reorderLevel * 2;
        const estimatedCost = suggestedQty * product.unitPrice;

        return {
          product,
          suggestedQty,
          estimatedCost,
          priority: determinePriority(product.currentStock, product.reorderLevel),
          forecast: forecast.forecast,
          confidence: forecast.confidence,
          rule,
        };
      })
    );

    // Filter by priority if requested
    let filteredSuggestions = suggestions;
    if (options?.priorityOnly) {
      filteredSuggestions = suggestions.filter((s) => s.priority === 'URGENT' || s.priority === 'HIGH');
    }

    // Optimize within budget if specified
    if (options?.budgetLimit) {
      filteredSuggestions = optimizeWithinBudget(filteredSuggestions, options.budgetLimit);
    }

    // Get AI optimization advice
    let aiOptimization = null;
    if (filteredSuggestions.length > 0) {
      aiOptimization = await getAIOptimizationAdvice(filteredSuggestions, options);
    }

    return {
      suggestions: filteredSuggestions.map((s) => ({
        productId: s.product.id,
        productName: s.product.name,
        supplierName: s.product.supplier?.name,
        currentStock: s.product.currentStock,
        reorderLevel: s.product.reorderLevel,
        suggestedQuantity: s.suggestedQty,
        estimatedCost: s.estimatedCost,
        priority: s.priority,
        forecast: s.forecast,
        confidence: s.confidence,
        hasAutoRule: !!s.rule,
      })),
      totalEstimatedCost: filteredSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
      totalItems: filteredSuggestions.length,
      aiOptimization,
    };
  } catch (error) {
    logger.error('Error generating smart reorder suggestions:', error);
    throw new Error('Failed to generate smart reorder suggestions');
  }
}

/**
 * Optimize product selection within budget using knapsack algorithm
 */
function optimizeWithinBudget(suggestions: any[], budget: number) {
  // Sort by priority and value (quantity/cost ratio)
  const priorityWeights = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  const sorted = suggestions
    .map((s) => ({
      ...s,
      value: (priorityWeights[s.priority as keyof typeof priorityWeights] * s.suggestedQty) / s.estimatedCost,
    }))
    .sort((a, b) => b.value - a.value);

  // Greedy selection within budget
  const selected = [];
  let remainingBudget = budget;

  for (const item of sorted) {
    if (item.estimatedCost <= remainingBudget) {
      selected.push(item);
      remainingBudget -= item.estimatedCost;
    }
  }

  return selected;
}

/**
 * Get AI optimization advice
 */
async function getAIOptimizationAdvice(suggestions: any[], options: any) {
  try {
    const summary = {
      totalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
      urgentCount: suggestions.filter((s) => s.priority === 'URGENT').length,
      highCount: suggestions.filter((s) => s.priority === 'HIGH').length,
      budget: options?.budgetLimit || 'No limit',
    };

    const topProducts = suggestions.slice(0, 5).map((s) => s.product.name);

    const prompt = `Inventory reorder optimization:
    - Total items to reorder: ${suggestions.length}
    - Urgent: ${summary.urgentCount}, High priority: ${summary.highCount}
    - Total cost: ₹${summary.totalCost.toLocaleString('en-IN')}
    - Budget: ${summary.budget}
    - Top products: ${topProducts.join(', ')}

    Provide 2-3 brief optimization recommendations.`;

    const response = await getAIResponse(prompt, [], 'system');

    return response.response;
  } catch (error) {
    logger.warn('Failed to get AI optimization advice:', error);
    return null;
  }
}

/**
 * Schedule auto-reorder checks (to be called by cron job)
 */
export function scheduleAutoReorderChecks(intervalHours: number = 24) {
  logger.info(`Scheduling auto-reorder checks every ${intervalHours} hours`);

  setInterval(async () => {
    try {
      const results = await runAutoReorderCheck('system');
      logger.info('Scheduled auto-reorder check completed', {
        reordersCreated: results.filter((r) => r.poCreated).length,
        totalSuggestions: results.length,
      });
    } catch (error) {
      logger.error('Scheduled auto-reorder check failed:', error);
    }
  }, intervalHours * 60 * 60 * 1000);
}

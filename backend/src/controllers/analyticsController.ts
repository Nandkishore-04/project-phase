import { Request, Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../config/logger';
import {
  getInventoryAnalytics,
  forecastDemand,
  getReorderSuggestions,
} from '../services/analyticsService';
import {
  createReorderRule,
  getReorderRule,
  runAutoReorderCheck,
  getSmartReorderSuggestions,
} from '../services/autoReorderService';
import prisma from '../config/database';

/**
 * Get comprehensive inventory analytics
 */
export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { days = '30' } = req.query;
    const analytics = await getInventoryAnalytics(parseInt(days as string));

    successResponse(res, analytics);
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    next(error);
  }
};

/**
 * Get demand forecast for a product
 */
export const getDemandForecast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { days = '30' } = req.query;

    const forecast = await forecastDemand(productId, parseInt(days as string));

    successResponse(res, forecast);
  } catch (error) {
    logger.error('Error generating forecast:', error);
    next(error);
  }
};

/**
 * Get reorder suggestions
 */
export const getReorderSuggestionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const suggestions = await getReorderSuggestions();

    successResponse(res, {
      suggestions,
      totalCount: suggestions.length,
      urgentCount: suggestions.filter((s) => s.priority === 'URGENT').length,
      totalEstimatedCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
    });
  } catch (error) {
    logger.error('Error fetching reorder suggestions:', error);
    next(error);
  }
};

/**
 * Get smart reorder suggestions with AI optimization
 */
export const getSmartReorderSuggestionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { budgetLimit, priorityOnly } = req.query;

    const options = {
      budgetLimit: budgetLimit ? parseFloat(budgetLimit as string) : undefined,
      priorityOnly: priorityOnly === 'true',
    };

    const suggestions = await getSmartReorderSuggestions(options);

    successResponse(res, suggestions);
  } catch (error) {
    logger.error('Error fetching smart reorder suggestions:', error);
    next(error);
  }
};

/**
 * Create or update auto-reorder rule
 */
export const createAutoReorderRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const { productId } = req.params;
    const rule = req.body;

    const result = await createReorderRule(productId, rule, userId);

    successResponse(res, result);
  } catch (error) {
    logger.error('Error creating auto-reorder rule:', error);
    next(error);
  }
};

/**
 * Get auto-reorder rule for a product
 */
export const getAutoReorderRule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    const rule = await getReorderRule(productId);

    if (!rule) {
      errorResponse(res, 'No auto-reorder rule found for this product', 404);
      return;
    }

    successResponse(res, rule);
  } catch (error) {
    logger.error('Error fetching auto-reorder rule:', error);
    next(error);
  }
};

/**
 * Run auto-reorder check manually
 */
export const runAutoReorder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId || 'admin';

    const results = await runAutoReorderCheck(userId);

    successResponse(res, {
      results,
      totalChecked: results.length,
      posCreated: results.filter((r) => r.poCreated).length,
      totalEstimatedCost: results.reduce((sum, r) => sum + r.estimatedCost, 0),
    });
  } catch (error) {
    logger.error('Error running auto-reorder:', error);
    next(error);
  }
};

/**
 * Get category-wise analytics
 */
export const getCategoryAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categoryStats = await prisma.product.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
      _sum: {
        currentStock: true,
      },
      _avg: {
        unitPrice: true,
      },
    });

    // Get value for each category
    const enrichedStats = await Promise.all(
      categoryStats.map(async (stat) => {
        const products = await prisma.product.findMany({
          where: { category: stat.category },
          select: {
            currentStock: true,
            unitPrice: true,
          },
        });

        const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0);

        return {
          category: stat.category,
          productCount: stat._count.id,
          totalStock: stat._sum.currentStock || 0,
          avgPrice: stat._avg.unitPrice || 0,
          totalValue,
        };
      })
    );

    successResponse(res, {
      categories: enrichedStats,
      totalCategories: enrichedStats.length,
    });
  } catch (error) {
    logger.error('Error fetching category analytics:', error);
    next(error);
  }
};

/**
 * Get supplier performance analytics
 */
export const getSupplierPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const suppliers = await prisma.supplier.findMany({
      where: {
        activeStatus: 1,
      },
      include: {
        _count: {
          select: {
            products: true,
            purchaseBills: true,
          },
        },
        purchaseBills: {
          where: {
            invoiceDate: {
              gte: startDate,
            },
            status: 'APPROVED',
          },
          select: {
            totalAmount: true,
            invoiceDate: true,
          },
        },
      },
    });

    const performance = suppliers.map((supplier) => {
      const totalSpent = supplier.purchaseBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const orderCount = supplier.purchaseBills.length;
      const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

      return {
        id: supplier.id,
        name: supplier.name,
        rating: supplier.rating,
        productCount: supplier._count.products,
        orderCount,
        totalSpent,
        avgOrderValue,
        performance: (supplier.rating || 0) >= 4.5 ? 'Excellent' : (supplier.rating || 0) >= 3.5 ? 'Good' : 'Average',
      };
    });

    // Sort by total spent (descending)
    performance.sort((a, b) => b.totalSpent - a.totalSpent);

    successResponse(res, {
      suppliers: performance,
      totalSuppliers: performance.length,
      totalSpent: performance.reduce((sum, s) => sum + s.totalSpent, 0),
    });
  } catch (error) {
    logger.error('Error fetching supplier performance:', error);
    next(error);
  }
};

/**
 * Export analytics data (CSV format)
 */
export const exportAnalyticsData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type = 'inventory' } = req.query;

    let csvData = '';

    if (type === 'inventory') {
      const products = await prisma.product.findMany({
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });

      // CSV headers
      csvData = 'Product ID,Name,Category,HSN Code,Current Stock,Reorder Level,Unit Price,Supplier\n';

      // CSV rows
      products.forEach((p) => {
        csvData += `${p.id},"${p.name}","${p.category || ''}","${p.hsnCode || ''}",${p.currentStock},${p.reorderLevel},${p.unitPrice},"${p.supplier?.name || ''}"\n`;
      });
    } else if (type === 'transactions') {
      const transactions = await prisma.inventoryTransaction.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 1000,
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      csvData = 'Transaction ID,Date,Product,Type,Quantity,Reference Type,Reference ID\n';

      transactions.forEach((t) => {
        csvData += `${t.id},"${t.createdAt.toISOString()}","${t.product.name}","${t.transactionType}",${t.quantity},"${t.referenceType || ''}","${t.referenceId || ''}"\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-${type}-${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    logger.error('Error exporting analytics data:', error);
    next(error);
  }
};

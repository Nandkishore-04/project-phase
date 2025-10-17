import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { CreateProductInput, UpdateProductInput, UpdateStockInput } from '../utils/validation';

export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, category, supplierId, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { hsnCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              gstin: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    successResponse(res, {
      products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: true,
        stockAlerts: {
          where: { isActive: 1 },
        },
      },
    });

    if (!product) {
      errorResponse(res, 'Product not found', 404);
      return;
    }

    successResponse(res, product);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data: CreateProductInput = req.body;

    const product = await prisma.product.create({
      data,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    successResponse(res, product, 'Product created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateProductInput = req.body;

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    successResponse(res, product, 'Product updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id },
    });

    successResponse(res, null, 'Product deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getLowStockProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: {
        currentStock: {
          lte: prisma.product.fields.reorderLevel,
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        currentStock: 'asc',
      },
    });

    successResponse(res, products);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantity, notes }: UpdateStockInput = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      errorResponse(res, 'Product not found', 404);
      return;
    }

    const newStock = product.currentStock + quantity;

    if (newStock < 0) {
      errorResponse(res, 'Insufficient stock', 400);
      return;
    }

    const [updatedProduct] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      }),
      prisma.inventoryTransaction.create({
        data: {
          productId,
          transactionType: quantity > 0 ? 'PURCHASE' : 'SALE',
          quantity: Math.abs(quantity),
          referenceType: 'MANUAL',
          notes,
        },
      }),
    ]);

    successResponse(res, updatedProduct, 'Stock updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getProductCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.product.findMany({
      where: {
        category: {
          not: null,
        },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    const categoryList = categories
      .map((p) => p.category)
      .filter((c): c is string => c !== null);

    successResponse(res, categoryList);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

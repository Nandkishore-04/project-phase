import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { CreateSupplierInput, UpdateSupplierInput } from '../utils/validation';

export const getAllSuppliers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, activeOnly = 'false' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { gstin: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (activeOnly === 'true') {
      where.activeStatus = true;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            purchaseBills: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    successResponse(res, suppliers);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getSupplierById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            currentStock: true,
            unitPrice: true,
          },
          orderBy: { name: 'asc' },
        },
        purchaseBills: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { invoiceDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      errorResponse(res, 'Supplier not found', 404);
      return;
    }

    successResponse(res, supplier);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data: CreateSupplierInput = req.body;

    const supplier = await prisma.supplier.create({
      data,
    });

    successResponse(res, supplier, 'Supplier created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateSupplierInput = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });

    successResponse(res, supplier, 'Supplier updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if supplier has products
    const productCount = await prisma.product.count({
      where: { supplierId: id },
    });

    if (productCount > 0) {
      errorResponse(res, 'Cannot delete supplier with associated products', 400);
      return;
    }

    await prisma.supplier.delete({
      where: { id },
    });

    successResponse(res, null, 'Supplier deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

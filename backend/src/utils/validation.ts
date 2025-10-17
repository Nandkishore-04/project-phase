import { z } from 'zod';

// User validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Product validation schemas
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  hsnCode: z.string().optional(),
  gstRate: z.number().min(0).max(100).default(18),
  currentStock: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(10),
  unitPrice: z.number().min(0),
  supplierId: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Supplier validation schemas
export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format').optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().length(2).optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional(),
  rating: z.number().min(0).max(5).optional(),
  activeStatus: z.number().int().min(0).max(1).default(1),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Purchase Order validation schemas
export const createPOSchema = z.object({
  supplierId: z.string(),
  expectedDelivery: z.string().datetime().optional(),
  notes: z.string().optional(),
  lineItems: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
    })
  ).min(1, 'At least one line item is required'),
});

// Stock update validation
export const updateStockSchema = z.object({
  productId: z.string(),
  quantity: z.number().int(),
  notes: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePOInput = z.infer<typeof createPOSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

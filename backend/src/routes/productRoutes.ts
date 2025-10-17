import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  updateStock,
  getProductCategories,
} from '../controllers/productController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema, updateStockSchema } from '../utils/validation';

const router = Router();

// Public routes (require authentication)
router.get('/', authenticate, getAllProducts);
router.get('/categories', authenticate, getProductCategories);
router.get('/low-stock', authenticate, getLowStockProducts);
router.get('/:id', authenticate, getProductById);

// Protected routes (require ADMIN or MANAGER role)
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), validate(createProductSchema), createProduct);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), validate(updateProductSchema), updateProduct);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteProduct);

// Stock management
router.post('/stock/update', authenticate, authorize('ADMIN', 'MANAGER'), validate(updateStockSchema), updateStock);

export default router;

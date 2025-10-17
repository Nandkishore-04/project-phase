import { Router } from 'express';
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSupplierSchema, updateSupplierSchema } from '../utils/validation';

const router = Router();

// Public routes (require authentication)
router.get('/', authenticate, getAllSuppliers);
router.get('/:id', authenticate, getSupplierById);

// Protected routes (require ADMIN or MANAGER role)
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), validate(createSupplierSchema), createSupplier);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), validate(updateSupplierSchema), updateSupplier);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteSupplier);

export default router;

import { Router } from 'express';
import {
  getAnalytics,
  getDemandForecast,
  getReorderSuggestionsHandler,
  getSmartReorderSuggestionsHandler,
  createAutoReorderRule,
  getAutoReorderRule,
  runAutoReorder,
  getCategoryAnalytics,
  getSupplierPerformance,
  exportAnalyticsData,
} from '../controllers/analyticsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Analytics endpoints
router.get('/dashboard', getAnalytics);
router.get('/categories', getCategoryAnalytics);
router.get('/suppliers/performance', getSupplierPerformance);

// Forecasting endpoints
router.get('/forecast/:productId', getDemandForecast);

// Reordering endpoints
router.get('/reorder/suggestions', getReorderSuggestionsHandler);
router.get('/reorder/smart', getSmartReorderSuggestionsHandler);
router.post('/reorder/run', authorize('ADMIN', 'MANAGER'), runAutoReorder);

// Auto-reorder rules (Admin/Manager only)
router.post('/reorder/rules/:productId', authorize('ADMIN', 'MANAGER'), createAutoReorderRule);
router.get('/reorder/rules/:productId', getAutoReorderRule);

// Export endpoints
router.get('/export', exportAnalyticsData);

export default router;

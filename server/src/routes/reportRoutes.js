import { Router } from 'express';
import * as reports from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/overview', authorize('admin', 'manager', 'receptionist'), reports.getOverview);
router.use(authorize('admin', 'manager'));

router.get('/occupancy', reports.getOccupancy);
router.get('/revenue', reports.getRevenue);
router.get('/forecast', reports.getForecast);
router.get('/guests', reports.getGuestAnalytics);
router.get('/export', reports.exportReport);

export default router;

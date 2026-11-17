import { Router } from 'express';
import * as maintenance from '../controllers/maintenanceController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', maintenance.listMaintenance);
router.post('/', maintenance.createMaintenance);
router.patch('/:id', authorize('admin', 'manager', 'receptionist', 'housekeeping'), maintenance.updateMaintenance);

export default router;

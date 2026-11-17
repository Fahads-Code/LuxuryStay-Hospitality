import { Router } from 'express';
import * as services from '../controllers/serviceController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', services.listServices);
router.post('/', authorize('admin', 'manager', 'receptionist'), services.createService);
router.patch('/:id', authorize('admin', 'manager', 'receptionist', 'housekeeping'), services.updateService);

export default router;

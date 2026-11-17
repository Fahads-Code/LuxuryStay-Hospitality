import { Router } from 'express';
import * as tasks from '../controllers/housekeepingController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', tasks.listTasks);
router.post('/', authorize('admin', 'manager', 'receptionist', 'housekeeping'), tasks.createTask);
router.patch('/:id', authorize('admin', 'manager', 'receptionist', 'housekeeping'), tasks.updateTask);
router.delete('/:id', authorize('admin', 'manager'), tasks.deleteTask);

export default router;

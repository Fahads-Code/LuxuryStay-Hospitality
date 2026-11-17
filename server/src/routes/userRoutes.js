import { Router } from 'express';
import * as users from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'manager'));

router.get('/', users.listUsers);
router.post('/', users.createUser);
router.get('/:id', users.getUser);
router.patch('/:id', users.updateUser);
router.delete('/:id', users.deactivateUser);

export default router;

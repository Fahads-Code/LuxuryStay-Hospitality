import { Router } from 'express';
import * as roomTypes from '../controllers/roomTypeController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', roomTypes.listRoomTypes);
router.get('/all', authorize('admin', 'manager'), roomTypes.listAllRoomTypes);
router.post('/', authorize('admin', 'manager'), roomTypes.createRoomType);
router.patch('/:id', authorize('admin', 'manager'), roomTypes.updateRoomType);
router.delete('/:id', authorize('admin', 'manager'), roomTypes.deleteRoomType);

export default router;

import { Router } from 'express';
import * as rooms from '../controllers/roomController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', rooms.listRooms);
router.post('/', authorize('admin', 'manager'), rooms.createRoom);
router.get('/:id', rooms.getRoom);
router.patch('/:id/status', authorize('admin', 'manager', 'receptionist', 'housekeeping'), rooms.updateRoomStatus);
router.patch('/:id', authorize('admin', 'manager'), rooms.updateRoom);
router.delete('/:id', authorize('admin', 'manager'), rooms.deleteRoom);

export default router;

import { Router } from 'express';
import * as guests from '../controllers/guestController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'manager', 'receptionist'));

router.get('/', guests.listGuests);
router.post('/', guests.createGuest);
router.get('/:id', guests.getGuest);
router.patch('/:id', guests.updateGuest);
router.delete('/:id', guests.deleteGuest);

export default router;

import { Router } from 'express';
import * as bookings from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'manager', 'receptionist'));

router.get('/availability', bookings.checkAvailability);
router.get('/calendar', bookings.getCalendar);
router.get('/', bookings.listBookings);
router.post('/', bookings.createBooking);
router.get('/:id', bookings.getBooking);
router.patch('/:id', bookings.updateBooking);
router.post('/:id/confirm', bookings.confirmBooking);
router.post('/:id/check-in', bookings.checkInBooking);
router.post('/:id/check-out', bookings.checkOutBooking);
router.post('/:id/cancel', bookings.cancelBooking);
router.post('/:id/no-show', bookings.markNoShow);

export default router;

import { Router } from 'express';
import * as portal from '../controllers/guestPortalController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('guest'));

router.get('/profile', portal.getMyProfile);
router.patch('/profile', portal.updateMyProfile);
router.get('/bookings', portal.getMyBookings);
router.get('/stay', portal.getMyStay);
router.post('/bookings/:id/cancel', portal.cancelMyBooking);
router.post('/services', portal.requestService);
router.get('/invoices', portal.getMyInvoices);
router.post('/invoices/:id/pay', portal.payMyInvoice);
router.post('/feedback', portal.submitMyFeedback);
router.post('/maintenance', portal.reportMyMaintenance);

export default router;

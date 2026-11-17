import { Router } from 'express';
import * as publicController from '../controllers/publicController.js';
import { protect } from '../middleware/auth.js';
import { publicWriteLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/info', publicController.getPublicInfo);
router.get('/availability', publicController.searchAvailability);
router.post('/bookings', protect, publicWriteLimiter, publicController.createPublicBooking);
router.post('/feedback', publicWriteLimiter, publicController.createPublicFeedback);

export default router;

import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', authLimiter, auth.login);
router.post('/register', authLimiter, auth.registerGuest);
router.get('/me', protect, auth.getMe);
router.post('/logout', protect, auth.logout);
router.patch('/password', protect, auth.changePassword);

export default router;

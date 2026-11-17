import { Router } from 'express';
import * as feedback from '../controllers/feedbackController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'manager', 'receptionist'));

router.get('/', feedback.listFeedback);
router.patch('/:id/respond', authorize('admin', 'manager'), feedback.respondToFeedback);
router.patch('/:id/publish', authorize('admin', 'manager'), feedback.publishFeedback);

export default router;

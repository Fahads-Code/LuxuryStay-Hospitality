import { Router } from 'express';
import * as notifications from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', notifications.listNotifications);
router.patch('/read-all', notifications.markAllNotificationsRead);
router.patch('/seen-all', notifications.markNotificationsSeen);
router.patch('/:id/read', notifications.markNotificationRead);

export default router;

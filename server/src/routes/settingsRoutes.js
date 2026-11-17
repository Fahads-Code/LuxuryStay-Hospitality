import { Router } from 'express';
import * as settings from '../controllers/settingsController.js';
import { protect, authorize, STAFF_ROLES } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));

router.get('/', settings.getSettingsHandler);
router.patch('/', authorize('admin'), settings.updateSettings);

export default router;

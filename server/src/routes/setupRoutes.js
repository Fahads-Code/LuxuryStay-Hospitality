import { Router } from 'express';
import * as setup from '../controllers/setupController.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/status', setup.getSetupStatus);
router.post('/', authLimiter, setup.createInitialAdmin);

export default router;

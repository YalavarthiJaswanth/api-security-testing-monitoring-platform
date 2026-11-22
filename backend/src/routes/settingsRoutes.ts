import { Router } from 'express';
import { getSettings } from '../controllers/settingsController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getSettings);

export default router;

import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getDashboardStats);
router.get('/stats', getDashboardStats);
router.get('/trends', getDashboardStats);

export default router;

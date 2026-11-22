import { Router } from 'express';
import { exportJsonReport, exportPdfReport } from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/json', exportJsonReport);
router.get('/pdf', exportPdfReport);

export default router;

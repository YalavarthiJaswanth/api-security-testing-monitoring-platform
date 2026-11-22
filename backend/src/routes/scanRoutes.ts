import { Router } from 'express';
import { triggerScan, listScans, getScanById } from '../controllers/scanController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.post('/trigger', triggerScan);
router.get('/', listScans);
router.get('/:id', getScanById);

export default router;

import { Router } from 'express';
import { listFindings, getFindingById, updateFindingStatus } from '../controllers/findingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', listFindings);
router.get('/:id', getFindingById);
router.patch('/:id/status', updateFindingStatus);

export default router;

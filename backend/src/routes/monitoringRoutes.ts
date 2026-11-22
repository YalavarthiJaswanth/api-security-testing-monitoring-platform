import { Router } from 'express';
import {
  listMonitoring,
  updateMonitoringConfig,
  triggerManualPing
} from '../controllers/monitoringController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', listMonitoring);
router.put('/:id', updateMonitoringConfig);
router.post('/:id/ping', triggerManualPing);

export default router;

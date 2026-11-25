import { Router } from 'express';
import {
  listMonitoring,
  getMonitoringById,
  updateMonitoringConfig,
  triggerManualPing,
  toggleMonitoring
} from '../controllers/monitoringController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', listMonitoring);
router.get('/:id', getMonitoringById);
router.put('/:id', updateMonitoringConfig);
router.post('/:id/ping', triggerManualPing);
router.post('/:id/trigger', triggerManualPing);
router.post('/:id/toggle', toggleMonitoring);

export default router;

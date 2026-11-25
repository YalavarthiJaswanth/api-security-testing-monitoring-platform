import { Router } from 'express';
import { listScenarios, executeScenario } from '../controllers/simulationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/scenarios', listScenarios);
router.post('/execute', executeScenario);
router.post('/trigger/:id', executeScenario);
router.post('/trigger', executeScenario);

export default router;

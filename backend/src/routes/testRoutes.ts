import { Router } from 'express';
import { testEndpoint } from '../controllers/testController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.post('/execute', testEndpoint);
router.post('/request', testEndpoint);

export default router;

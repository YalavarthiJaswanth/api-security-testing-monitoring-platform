import { Router } from 'express';
import {
  exportJsonReport,
  exportPdfReport,
  exportPostmanReport,
  exportPostmanEnvironment,
  exportOpenApiReport
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/json', exportJsonReport);
router.get('/pdf', exportPdfReport);
router.get('/postman', exportPostmanReport);
router.get('/postman-environment', exportPostmanEnvironment);
router.get('/openapi', exportOpenApiReport);

export default router;

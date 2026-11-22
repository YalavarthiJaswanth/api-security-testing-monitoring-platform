import { Router } from 'express';
import {
  listApis,
  getApiById,
  createApi,
  updateApi,
  deleteApi,
  importOpenApi
} from '../controllers/apiController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listApis);
router.post('/', createApi);
router.post('/import-openapi', importOpenApi);
router.get('/:id', getApiById);
router.put('/:id', updateApi);
router.delete('/:id', deleteApi);

export default router;

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { executeRealRequest } from '../services/apiTester';
import { Api } from '../models/Api';

export async function testEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { url, method = 'GET', headers = {}, params = {}, body, apiId } = req.body;

    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    let apiConfig = undefined;
    let allowLocalLab = false;

    if (apiId) {
      apiConfig = await Api.findOne({ _id: apiId, createdBy: req.user!._id });
      if (apiConfig?.isLabApi) {
        allowLocalLab = true;
      }
    }

    const result = await executeRealRequest({
      url,
      method,
      headers,
      params,
      data: body,
      allowLocalLab,
      apiConfig: apiConfig || undefined
    });

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Execution failed'
    });
  }
}

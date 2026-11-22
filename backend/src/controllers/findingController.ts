import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Finding } from '../models/Finding';

export async function listFindings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { severity, owaspCategory, apiId, status, isSimulation, search } = req.query;

    const query: any = { createdBy: req.user!._id };

    if (severity) query.severity = severity;
    if (owaspCategory) query.owaspCategory = owaspCategory;
    if (apiId) query.apiId = apiId;
    if (status) query.status = status;
    if (isSimulation !== undefined) query.isSimulation = isSimulation === 'true';

    if (search && typeof search === 'string') {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { endpoint: { $regex: search, $options: 'i' } },
        { explanation: { $regex: search, $options: 'i' } }
      ];
    }

    const findings = await Finding.find(query)
      .populate('apiId', 'name baseUrl environment')
      .populate('scanId', 'scanType status createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: findings.length, findings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list findings' });
  }
}

export async function getFindingById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const finding = await Finding.findOne({ _id: req.params.id, createdBy: req.user!._id })
      .populate('apiId', 'name baseUrl environment')
      .populate('scanId', 'scanType status createdAt');

    if (!finding) {
      res.status(404).json({ success: false, message: 'Finding not found' });
      return;
    }

    res.json({ success: true, finding });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to get finding' });
  }
}

export async function updateFindingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!['open', 'resolved', 'false_positive'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status value' });
      return;
    }

    const finding = await Finding.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!._id },
      { status },
      { new: true }
    );

    if (!finding) {
      res.status(404).json({ success: false, message: 'Finding not found' });
      return;
    }

    res.json({ success: true, message: 'Finding status updated', finding });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update finding status' });
  }
}

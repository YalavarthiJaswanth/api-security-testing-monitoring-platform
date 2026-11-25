import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { MonitoringConfig } from '../models/Monitoring';
import { monitoringWorker } from '../services/monitoringWorker';

export async function listMonitoring(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const configs = await MonitoringConfig.find({ createdBy: req.user!._id })
      .populate('apiId', 'name baseUrl environment isLabApi')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: configs.length, configs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list monitoring' });
  }
}

export async function getMonitoringById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    const config = await MonitoringConfig.findOne({
      $or: [{ _id: req.params.id }, { apiId: req.params.id }],
      createdBy: req.user!._id
    }).populate('apiId', 'name baseUrl environment isLabApi');

    if (!config) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve monitoring config' });
  }
}

export async function updateMonitoringConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    const { isEnabled, intervalMinutes, latencyThresholdMs } = req.body;
    const config = await MonitoringConfig.findOne({
      $or: [{ _id: req.params.id }, { apiId: req.params.id }],
      createdBy: req.user!._id
    });

    if (!config) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    if (isEnabled !== undefined) config.isEnabled = isEnabled;
    if (intervalMinutes) config.intervalMinutes = intervalMinutes;
    if (latencyThresholdMs) config.latencyThresholdMs = latencyThresholdMs;

    await config.save();
    res.json({ success: true, message: 'Monitoring configuration updated', config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update configuration' });
  }
}

export async function triggerManualPing(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    const config = await MonitoringConfig.findOne({
      $or: [{ _id: req.params.id }, { apiId: req.params.id }],
      createdBy: req.user!._id
    });

    if (!config) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    const updated = await monitoringWorker.checkSingleApi(config);
    res.json({
      success: true,
      message: 'Ping executed successfully',
      config: updated || config
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Ping failed' });
  }
}

export async function toggleMonitoring(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    const config = await MonitoringConfig.findOne({
      $or: [{ _id: req.params.id }, { apiId: req.params.id }],
      createdBy: req.user!._id
    });

    if (!config) {
      res.status(404).json({ success: false, message: 'Monitoring config not found' });
      return;
    }

    config.isEnabled = !config.isEnabled;
    await config.save();

    res.json({
      success: true,
      message: `Monitoring ${config.isEnabled ? 'enabled' : 'disabled'} successfully`,
      config
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to toggle monitoring' });
  }
}

import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Webhook } from '../models/Webhook';
import { webhookService } from '../services/webhookService';
import { validateTargetUrl } from '../utils/ssrf';

export async function listWebhooks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const webhooks = await Webhook.find({ createdBy: req.user!._id }).sort({ createdAt: -1 });

    const sanitized = webhooks.map((wh) => ({
      id: wh._id,
      name: wh.name,
      url: wh.url,
      events: wh.events,
      isActive: wh.isActive,
      customHeaders: wh.customHeaders,
      failureCount: wh.failureCount,
      lastTriggered: wh.lastTriggered,
      lastStatus: wh.lastStatus,
      deliveriesCount: wh.deliveryHistory?.length || 0,
      createdAt: wh.createdAt,
      updatedAt: wh.updatedAt
    }));

    res.json({ success: true, count: sanitized.length, webhooks: sanitized });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list webhooks' });
  }
}

export async function getWebhookById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }
    const webhook = await Webhook.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    res.json({
      success: true,
      webhook: {
        id: webhook._id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret,
        events: webhook.events,
        isActive: webhook.isActive,
        customHeaders: webhook.customHeaders,
        failureCount: webhook.failureCount,
        lastTriggered: webhook.lastTriggered,
        lastStatus: webhook.lastStatus,
        deliveryHistory: webhook.deliveryHistory,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve webhook' });
  }
}

export async function createWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, url, events, secret, isActive = true, customHeaders } = req.body;

    if (!name || !url) {
      res.status(400).json({ success: false, message: 'Name and URL are required' });
      return;
    }

    // SSRF Check
    const ssrf = validateTargetUrl(url, { allowLocalLab: true });
    if (!ssrf.isValid) {
      res.status(400).json({ success: false, message: `SSRF validation failed for webhook URL: ${ssrf.reason}` });
      return;
    }

    const assignedSecret = secret && secret.trim() ? secret.trim() : webhookService.generateSecret();

    const webhook = new Webhook({
      name: name.trim(),
      url: url.trim(),
      secret: assignedSecret,
      events: Array.isArray(events) && events.length ? events : ['scan.completed', 'finding.detected', 'monitoring.alert'],
      isActive: !!isActive,
      customHeaders: customHeaders || {},
      createdBy: req.user!._id
    });

    await webhook.save();

    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      webhook: {
        id: webhook._id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret,
        events: webhook.events,
        isActive: webhook.isActive,
        customHeaders: webhook.customHeaders,
        createdAt: webhook.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create webhook' });
  }
}

export async function updateWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }
    const webhook = await Webhook.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    const { name, url, events, secret, isActive, customHeaders } = req.body;

    if (name) webhook.name = name.trim();
    if (url) {
      const ssrf = validateTargetUrl(url, { allowLocalLab: true });
      if (!ssrf.isValid) {
        res.status(400).json({ success: false, message: `SSRF validation failed: ${ssrf.reason}` });
        return;
      }
      webhook.url = url.trim();
    }
    if (Array.isArray(events)) webhook.events = events;
    if (secret) webhook.secret = secret.trim();
    if (isActive !== undefined) webhook.isActive = !!isActive;
    if (customHeaders !== undefined) webhook.customHeaders = customHeaders;

    await webhook.save();

    res.json({
      success: true,
      message: 'Webhook updated successfully',
      webhook: {
        id: webhook._id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        customHeaders: webhook.customHeaders,
        updatedAt: webhook.updatedAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update webhook' });
  }
}

export async function deleteWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }
    const webhook = await Webhook.findOneAndDelete({ _id: req.params.id, createdBy: req.user!._id });
    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete webhook' });
  }
}

export async function testWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }
    const result = await webhookService.testWebhook(req.params.id, req.user!._id.toString());
    res.json({
      success: result.success,
      message: result.success ? 'Webhook test ping delivered successfully' : 'Webhook test ping failed',
      delivery: result
    });
  } catch (err: any) {
    res.status(err.message === 'Webhook not found' ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to test webhook'
    });
  }
}

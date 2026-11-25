import crypto from 'crypto';
import axios from 'axios';
import { Webhook, IWebhook, WebhookEvent } from '../models/Webhook';
import { validateTargetUrl } from '../utils/ssrf';

export interface WebhookPayload {
  event: WebhookEvent | string;
  timestamp: string;
  deliveryId: string;
  data: any;
}

export class WebhookService {
  /**
   * Generates HMAC-SHA256 signature for webhook payload verification
   */
  public generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Generates a random secure secret for a new webhook
   */
  public generateSecret(): string {
    return 'whsec_' + crypto.randomBytes(24).toString('hex');
  }

  /**
   * Sends a webhook notification to a single webhook endpoint
   */
  public async deliverToWebhook(
    webhook: IWebhook,
    event: string,
    data: any
  ): Promise<{ success: boolean; statusCode: number; durationMs: number; error?: string }> {
    const startTime = Date.now();
    const deliveryId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const payloadObj: WebhookPayload = {
      event,
      timestamp,
      deliveryId,
      data
    };

    const bodyString = JSON.stringify(payloadObj);
    const signature = this.generateSignature(bodyString, webhook.secret);

    // Validate SSRF
    const ssrf = validateTargetUrl(webhook.url, { allowLocalLab: true });
    if (!ssrf.isValid) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `SSRF block: ${ssrf.reason}`;
      await this.recordDelivery(webhook, event, 0, durationMs, false, errorMsg, bodyString);
      return { success: false, statusCode: 0, durationMs, error: errorMsg };
    }

    // Convert custom headers if Map or plain Object
    const customHeaders: Record<string, string> = {};
    if (webhook.customHeaders instanceof Map) {
      webhook.customHeaders.forEach((val, key) => {
        customHeaders[key] = String(val);
      });
    } else if (webhook.customHeaders && typeof webhook.customHeaders === 'object') {
      Object.assign(customHeaders, webhook.customHeaders);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'API-Sentinel-Webhook/1.0',
      'X-Sentinel-Event': event,
      'X-Sentinel-Delivery': deliveryId,
      'X-Sentinel-Timestamp': timestamp,
      'X-Sentinel-Signature': `sha256=${signature}`,
      ...customHeaders
    };

    try {
      const response = await axios.post(webhook.url, bodyString, {
        headers,
        timeout: 10000,
        validateStatus: () => true // Don't throw on non-2xx
      });

      const durationMs = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      await this.recordDelivery(
        webhook,
        event,
        response.status,
        durationMs,
        success,
        success ? undefined : `HTTP ${response.status} ${response.statusText}`,
        bodyString
      );

      return {
        success,
        statusCode: response.status,
        durationMs,
        error: success ? undefined : `HTTP ${response.status}`
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err.message || 'Connection failed';
      await this.recordDelivery(webhook, event, 0, durationMs, false, errorMsg, bodyString);
      return { success: false, statusCode: 0, durationMs, error: errorMsg };
    }
  }

  /**
   * Records delivery history and updates webhook statistics
   */
  private async recordDelivery(
    webhook: IWebhook,
    event: string,
    statusCode: number,
    responseTimeMs: number,
    success: boolean,
    errorMessage?: string,
    payloadString?: string
  ) {
    try {
      webhook.lastTriggered = new Date();
      webhook.lastStatus = statusCode;

      if (success) {
        webhook.failureCount = 0;
      } else {
        webhook.failureCount = (webhook.failureCount || 0) + 1;
      }

      let payloadSummary = '';
      if (payloadString) {
        payloadSummary = payloadString.length > 200 ? payloadString.slice(0, 197) + '...' : payloadString;
      }

      if (!webhook.deliveryHistory) {
        webhook.deliveryHistory = [];
      }

      webhook.deliveryHistory.push({
        event,
        statusCode,
        responseTimeMs,
        success,
        errorMessage,
        payloadSummary,
        timestamp: new Date()
      });

      // Keep last 50 deliveries
      if (webhook.deliveryHistory.length > 50) {
        webhook.deliveryHistory.shift();
      }

      await webhook.save();
    } catch (saveErr) {
      console.error('[WebhookService] Failed to record webhook delivery history:', saveErr);
    }
  }

  /**
   * Dispatches an event to all matching active webhooks asynchronously
   */
  public async dispatchWebhookEvent(
    event: WebhookEvent,
    data: any,
    userId?: string
  ): Promise<void> {
    try {
      const filter: any = {
        isActive: true,
        events: { $in: [event, '*'] }
      };

      if (userId) {
        filter.createdBy = userId;
      }

      const activeWebhooks = await Webhook.find(filter);
      if (!activeWebhooks.length) return;

      console.log(`[WebhookService] Dispatching event '${event}' to ${activeWebhooks.length} webhook(s).`);

      // Fire deliveries concurrently in background
      Promise.allSettled(
        activeWebhooks.map((wh) => this.deliverToWebhook(wh, event, data))
      ).then((results) => {
        const successful = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.success).length;
        console.log(`[WebhookService] Event '${event}' delivery complete: ${successful}/${results.length} successful.`);
      }).catch((err) => {
        console.error('[WebhookService] Unhandled error during event delivery:', err);
      });
    } catch (err: any) {
      console.error('[WebhookService] Error dispatching event:', err.message);
    }
  }

  /**
   * Tests a specific webhook with a ping event
   */
  public async testWebhook(webhookId: string, userId: string) {
    const webhook = await Webhook.findOne({ _id: webhookId, createdBy: userId });
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testData = {
      message: 'API Sentinel Webhook test ping',
      platform: 'API Sentinel Security Testing & Monitoring',
      timestamp: new Date().toISOString(),
      webhookId: webhook._id,
      webhookName: webhook.name,
      configuredEvents: webhook.events
    };

    return await this.deliverToWebhook(webhook, 'test.ping', testData);
  }
}

export const webhookService = new WebhookService();

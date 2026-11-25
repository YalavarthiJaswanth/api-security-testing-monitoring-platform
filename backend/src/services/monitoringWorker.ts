import { MonitoringConfig, IMonitoringConfig } from '../models/Monitoring';
import { Api } from '../models/Api';
import { executeRealRequest } from './apiTester';
import { webhookService } from './webhookService';

class MonitoringWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  public start(intervalMinutes: number = 2) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    console.log(`[Monitoring Worker] Initialized. Check loop running every ${intervalMinutes} min.`);
    // Run an initial check after 10 seconds
    setTimeout(() => this.runCheckCycle(), 10000);
    this.timer = setInterval(() => this.runCheckCycle(), intervalMinutes * 60 * 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runCheckCycle() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const activeConfigs = await MonitoringConfig.find({ isEnabled: true });
      for (const config of activeConfigs) {
        await this.checkSingleApi(config);
      }
    } catch (err) {
      console.error('[Monitoring Worker] Check cycle error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  public async checkSingleApi(config: IMonitoringConfig): Promise<any> {
    try {
      const api = await Api.findById(config.apiId);
      if (!api) return null;

      // Select target endpoint or fallback to base url
      const targetPath = api.endpoints && api.endpoints.length > 0 ? api.endpoints[0].path : '';
      const fullUrl = `${api.baseUrl.replace(/\/$/, '')}${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`;

      const res = await executeRealRequest({
        url: fullUrl,
        method: api.endpoints && api.endpoints.length > 0 ? api.endpoints[0].method : 'GET',
        timeout: config.timeoutMs || 5000,
        allowLocalLab: api.isLabApi,
        apiConfig: api
      });

      const isHealthy = res.status >= 200 && res.status < 400 && !res.isError;
      const responseTimeMs = res.durationMs;

      // Append check to history (max 50 entries)
      const newCheck = {
        timestamp: new Date(),
        statusCode: res.status,
        responseTimeMs,
        isHealthy,
        errorMessage: res.errorMessage || (res.status >= 400 ? `HTTP ${res.status} ${res.statusText}` : undefined)
      };

      config.history.push(newCheck);
      if (config.history.length > 50) {
        config.history.shift();
      }

      // Compute uptime and average response time
      const totalChecks = config.history.length;
      const successfulChecks = config.history.filter((c) => c.isHealthy).length;
      const uptimePercentage = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 1000) / 10 : 100;

      const sumLatency = config.history.reduce((acc, c) => acc + c.responseTimeMs, 0);
      const avgLatency = totalChecks > 0 ? Math.round(sumLatency / totalChecks) : 0;

      const previousStatus = config.currentStatus;
      let currentStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (!isHealthy || res.status >= 500) {
        currentStatus = 'down';
      } else if (responseTimeMs > (config.latencyThresholdMs || 1000)) {
        currentStatus = 'degraded';
      }

      config.lastChecked = new Date();
      config.currentStatus = currentStatus;
      config.uptimePercentage = uptimePercentage;
      config.averageResponseTimeMs = avgLatency;

      await config.save();

      // Dispatch Webhook Alerts on State Changes
      if ((currentStatus === 'down' || currentStatus === 'degraded') && previousStatus === 'healthy') {
        webhookService.dispatchWebhookEvent('monitoring.alert', {
          apiId: api._id,
          apiName: api.name,
          targetUrl: fullUrl,
          status: currentStatus,
          previousStatus,
          responseTimeMs,
          statusCode: res.status,
          errorMessage: newCheck.errorMessage,
          timestamp: new Date().toISOString()
        }, config.createdBy?.toString());
      } else if (currentStatus === 'healthy' && (previousStatus === 'down' || previousStatus === 'degraded')) {
        webhookService.dispatchWebhookEvent('monitoring.recovered', {
          apiId: api._id,
          apiName: api.name,
          targetUrl: fullUrl,
          status: currentStatus,
          previousStatus,
          responseTimeMs,
          uptimePercentage,
          timestamp: new Date().toISOString()
        }, config.createdBy?.toString());
      }
      return config;
    } catch (err: any) {
      console.error(`[Monitoring Worker] Error monitoring API ${config.apiId}:`, err.message);
      return null;
    }
  }
}

export const monitoringWorker = new MonitoringWorker();

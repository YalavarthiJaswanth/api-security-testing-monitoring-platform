/**
 * Unit tests for API Sentinel Continuous Monitoring & Health Classification
 * Contributed by: Anjan Krishna (@Anjankrishna260106)
 */

describe('Monitoring Health & Telemetry Metrics', () => {
  interface HealthCheck {
    statusCode: number;
    responseTimeMs: number;
    isHealthy: boolean;
  }

  function calculateHealthStatus(
    statusCode: number,
    responseTimeMs: number,
    latencyThresholdMs: number
  ): 'healthy' | 'degraded' | 'down' {
    if (statusCode < 200 || statusCode >= 400) {
      return 'down';
    }
    if (responseTimeMs > latencyThresholdMs) {
      return 'degraded';
    }
    return 'healthy';
  }

  function computeUptimePercentage(history: HealthCheck[]): number {
    if (!history.length) return 100;
    const healthyCount = history.filter((h) => h.isHealthy).length;
    return Number(((healthyCount / history.length) * 100).toFixed(2));
  }

  function computeAverageResponseTime(history: HealthCheck[]): number {
    if (!history.length) return 0;
    const total = history.reduce((sum, h) => sum + h.responseTimeMs, 0);
    return Math.round(total / history.length);
  }

  it('should classify response as healthy when 200 OK and within latency threshold', () => {
    const status = calculateHealthStatus(200, 145, 800);
    expect(status).toBe('healthy');
  });

  it('should classify response as degraded when latency exceeds configured threshold', () => {
    const status = calculateHealthStatus(200, 1250, 800);
    expect(status).toBe('degraded');
  });

  it('should classify response as down on server error status codes (5xx)', () => {
    const status500 = calculateHealthStatus(500, 80, 800);
    const status503 = calculateHealthStatus(503, 45, 800);
    expect(status500).toBe('down');
    expect(status503).toBe('down');
  });

  it('should accurately compute rolling uptime percentage across check history', () => {
    const history: HealthCheck[] = [
      { statusCode: 200, responseTimeMs: 120, isHealthy: true },
      { statusCode: 200, responseTimeMs: 140, isHealthy: true },
      { statusCode: 500, responseTimeMs: 50, isHealthy: false },
      { statusCode: 200, responseTimeMs: 110, isHealthy: true }
    ];
    // 3 healthy out of 4 = 75.00%
    const uptime = computeUptimePercentage(history);
    expect(uptime).toBe(75);
  });

  it('should correctly calculate average latency in milliseconds', () => {
    const history: HealthCheck[] = [
      { statusCode: 200, responseTimeMs: 100, isHealthy: true },
      { statusCode: 200, responseTimeMs: 200, isHealthy: true },
      { statusCode: 200, responseTimeMs: 300, isHealthy: true }
    ];
    const avg = computeAverageResponseTime(history);
    expect(avg).toBe(200);
  });
});

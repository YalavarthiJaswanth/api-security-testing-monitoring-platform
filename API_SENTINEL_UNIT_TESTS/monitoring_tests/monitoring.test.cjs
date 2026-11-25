const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes, startLocalTestServer } = require('../helpers/mock_http.cjs');

const { Api } = requireBackend('models/Api');
const { MonitoringConfig } = requireBackend('models/Monitoring');
const { monitoringWorker } = requireBackend('services/monitoringWorker');
const monitoringController = requireBackend('controllers/monitoringController');

describe('Continuous API Monitoring Unit Tests', () => {
  const originals = {
    apiFindById: Api.findById,
    configFind: MonitoringConfig.find,
    configFindOne: MonitoringConfig.findOne,
    checkSingleApi: monitoringWorker.checkSingleApi
  };

  let activeServer = null;

  afterEach(async () => {
    Api.findById = originals.apiFindById;
    MonitoringConfig.find = originals.configFind;
    MonitoringConfig.findOne = originals.configFindOne;
    monitoringWorker.checkSingleApi = originals.checkSingleApi;
    monitoringWorker.stop();
    if (activeServer) {
      await activeServer.close();
      activeServer = null;
    }
  });

  it('checkSingleApi: marks API healthy on fast HTTP 200 within latency threshold', async () => {
    activeServer = await startLocalTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    Api.findById = async () => ({
      _id: 'api-1',
      baseUrl: activeServer.baseUrl,
      isLabApi: true,
      authType: 'none',
      endpoints: [{ path: '/health', method: 'GET' }]
    });

    const mockConfig = {
      apiId: 'api-1',
      timeoutMs: 3000,
      latencyThresholdMs: 1000,
      history: [],
      save: async () => mockConfig
    };

    const updated = await monitoringWorker.checkSingleApi(mockConfig);

    assert.equal(updated.currentStatus, 'healthy');
    assert.equal(updated.uptimePercentage, 100);
    assert.equal(updated.history.length, 1);
    assert.equal(updated.history[0].statusCode, 200);
    assert.equal(updated.history[0].isHealthy, true);
  });

  it('checkSingleApi: marks API degraded when response latency exceeds latencyThresholdMs', async () => {
    activeServer = await startLocalTestServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ slow: true }));
      }, 60);
    });

    Api.findById = async () => ({
      _id: 'api-2',
      baseUrl: activeServer.baseUrl,
      isLabApi: true,
      authType: 'none',
      endpoints: [{ path: '/slow', method: 'GET' }]
    });

    const mockConfig = {
      apiId: 'api-2',
      timeoutMs: 3000,
      latencyThresholdMs: 10, // Intentionally tight 10ms threshold
      history: [],
      save: async () => mockConfig
    };

    const updated = await monitoringWorker.checkSingleApi(mockConfig);

    assert.equal(updated.currentStatus, 'degraded');
    assert.equal(updated.uptimePercentage, 100);
    assert.ok(updated.averageResponseTimeMs >= 10);
  });

  it('checkSingleApi: marks API down on HTTP 500 error and records errorMessage', async () => {
    activeServer = await startLocalTestServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database offline' }));
    });

    Api.findById = async () => ({
      _id: 'api-3',
      baseUrl: activeServer.baseUrl,
      isLabApi: true,
      authType: 'none',
      endpoints: [{ path: '/failing', method: 'GET' }]
    });

    const mockConfig = {
      apiId: 'api-3',
      timeoutMs: 3000,
      latencyThresholdMs: 1000,
      history: [
        { statusCode: 200, responseTimeMs: 40, isHealthy: true },
        { statusCode: 200, responseTimeMs: 60, isHealthy: true }
      ],
      save: async () => mockConfig
    };

    const updated = await monitoringWorker.checkSingleApi(mockConfig);

    assert.equal(updated.currentStatus, 'down');
    assert.equal(updated.history.length, 3);
    assert.equal(updated.history[2].isHealthy, false);
    assert.match(updated.history[2].errorMessage, /HTTP 500/);
    // 2 healthy out of 3 = 66.7%
    assert.equal(updated.uptimePercentage, 66.7);
  });

  it('checkSingleApi: handles connection failure gracefully and marks API down', async () => {
    // Ephemeral server started and immediately closed to guarantee connection refused
    const temp = await startLocalTestServer(() => {});
    const deadUrl = temp.baseUrl;
    await temp.close();

    Api.findById = async () => ({
      _id: 'api-dead',
      baseUrl: deadUrl,
      isLabApi: true,
      authType: 'none',
      endpoints: [{ path: '/ping', method: 'GET' }]
    });

    const mockConfig = {
      apiId: 'api-dead',
      timeoutMs: 1000,
      latencyThresholdMs: 1000,
      history: [],
      save: async () => mockConfig
    };

    const updated = await monitoringWorker.checkSingleApi(mockConfig);

    assert.equal(updated.currentStatus, 'down');
    assert.equal(updated.uptimePercentage, 0);
    assert.equal(updated.history[0].statusCode, 0);
    assert.ok(updated.history[0].errorMessage);
  });

  it('checkSingleApi: enforces 50-entry sliding window retention limit on monitoring history', async () => {
    activeServer = await startLocalTestServer((req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    Api.findById = async () => ({
      _id: 'api-hist',
      baseUrl: activeServer.baseUrl,
      isLabApi: true,
      authType: 'none',
      endpoints: []
    });

    const prefilledHistory = Array.from({ length: 50 }, (_, idx) => ({
      statusCode: 200,
      responseTimeMs: 50 + idx,
      isHealthy: true
    }));

    const mockConfig = {
      apiId: 'api-hist',
      timeoutMs: 2000,
      latencyThresholdMs: 1000,
      history: prefilledHistory,
      save: async () => mockConfig
    };

    const updated = await monitoringWorker.checkSingleApi(mockConfig);

    assert.equal(updated.history.length, 50, 'History must remain capped at 50 entries');
    // Oldest entry (50ms) shifted out, second entry (51ms) is now first
    assert.equal(updated.history[0].responseTimeMs, 51);
  });

  it('checkSingleApi: returns null cleanly when parent API record does not exist', async () => {
    Api.findById = async () => null;
    const mockConfig = { apiId: 'missing-api', history: [], save: async () => {} };

    const result = await monitoringWorker.checkSingleApi(mockConfig);
    assert.equal(result, null);
  });

  it('monitoringController.updateMonitoringConfig: updates interval, threshold, and enabled state', async () => {
    const configDoc = {
      _id: 'mon-1',
      isEnabled: true,
      intervalMinutes: 5,
      latencyThresholdMs: 1000,
      save: async () => configDoc
    };
    MonitoringConfig.findOne = async () => configDoc;

    const req = createMockReq({
      params: { id: 'mon-1' },
      user: { _id: 'user-1' },
      body: { isEnabled: false, intervalMinutes: 15, latencyThresholdMs: 500 }
    });
    const res = createMockRes();

    await monitoringController.updateMonitoringConfig(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(configDoc.isEnabled, false);
    assert.equal(configDoc.intervalMinutes, 15);
    assert.equal(configDoc.latencyThresholdMs, 500);
  });

  it('monitoringController.updateMonitoringConfig & triggerManualPing: return 404 for unknown config', async () => {
    MonitoringConfig.findOne = async () => null;

    const resUpdate = createMockRes();
    await monitoringController.updateMonitoringConfig(
      createMockReq({ params: { id: 'unknown' }, user: { _id: 'u1' }, body: {} }),
      resUpdate
    );
    assert.equal(resUpdate.statusCode, 404);

    const resPing = createMockRes();
    await monitoringController.triggerManualPing(
      createMockReq({ params: { id: 'unknown' }, user: { _id: 'u1' } }),
      resPing
    );
    assert.equal(resPing.statusCode, 404);
  });

  it('monitoringController.triggerManualPing: triggers checkSingleApi and returns updated config', async () => {
    const configDoc = { _id: 'mon-2', currentStatus: 'unmonitored' };
    MonitoringConfig.findOne = async () => configDoc;
    monitoringWorker.checkSingleApi = async (cfg) => ({ ...cfg, currentStatus: 'healthy', averageResponseTimeMs: 42 });

    const req = createMockReq({ params: { id: 'mon-2' }, user: { _id: 'u1' } });
    const res = createMockRes();

    await monitoringController.triggerManualPing(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.config.currentStatus, 'healthy');
    assert.equal(res.body.config.averageResponseTimeMs, 42);
  });
});

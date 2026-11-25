const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes, startLocalTestServer } = require('../helpers/mock_http.cjs');

const { config } = requireBackend('config/env');
const { Api } = requireBackend('models/Api');
const { Scan } = requireBackend('models/Scan');
const { Finding } = requireBackend('models/Finding');
const simulationController = requireBackend('controllers/simulationController');

describe('Simulation Lab & Attack Scenario Unit Tests', () => {
  let server = null;
  const originals = {
    labUrl: config.vulnerableLabUrl,
    apiFindOne: Api.findOne,
    apiSave: Api.prototype.save,
    scanSave: Scan.prototype.save,
    findingSave: Finding.prototype.save
  };

  afterEach(async () => {
    config.vulnerableLabUrl = originals.labUrl;
    Api.findOne = originals.apiFindOne;
    Api.prototype.save = originals.apiSave;
    Scan.prototype.save = originals.scanSave;
    Finding.prototype.save = originals.findingSave;
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('listScenarios: returns all 7 OWASP Simulation Lab scenarios', async () => {
    const req = createMockReq({ user: { _id: 'u1' } });
    const res = createMockRes();

    await simulationController.listScenarios(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const ids = res.body.scenarios.map((s) => s.id);
    assert.deepEqual(ids, [
      'bola',
      'broken_auth',
      'excessive_data',
      'permissive_cors',
      'missing_headers',
      'unrestricted_resource',
      'bfla'
    ]);
  });

  it('executeScenario: returns 404 when unknown scenarioId is requested', async () => {
    const req = createMockReq({ body: { scenarioId: 'non_existent_attack' }, user: { _id: 'u1' } });
    const res = createMockRes();

    await simulationController.executeScenario(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.message, /Scenario not found/i);
  });

  it('executeScenario (BOLA vulnerable): captures victim PII evidence and stores [SIMULATION] finding', async () => {
    server = await startLocalTestServer((req, res) => {
      if (req.url === '/api/v1/lab/users/user_9921') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'user_9921',
            fullName: 'Dr. Jane Vance (Victim)',
            ssn: '982-12-8812',
            medicalRecordNumber: 'MRN-902188'
          })
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    config.vulnerableLabUrl = server.baseUrl;
    Api.findOne = async () => ({ _id: 'lab-api-1', isLabApi: true });
    Scan.prototype.save = async function () {
      return this;
    };
    Finding.prototype.save = async function () {
      return this;
    };

    const req = createMockReq({ body: { scenarioId: 'bola' }, user: { _id: 'u1' } });
    const res = createMockRes();

    await simulationController.executeScenario(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.execution.response.status, 200);
    assert.equal(res.body.execution.response.data.id, 'user_9921');
    assert.equal(res.body.execution.response.data.ssn, '982-12-8812');

    const finding = res.body.execution.finding;
    assert.equal(finding.isSimulation, true);
    assert.match(finding.title, /^\[SIMULATION\]/);
    assert.equal(finding.severity, 'critical');
    assert.equal(finding.confidence, 'confirmed');
    assert.ok(finding.evidence.responseSnippet.includes('Dr. Jane Vance'));
  });

  it('BOLA secure baseline verification: confirms HTTP 403 authorization block prevents victim record leak', async () => {
    // Note: vulnerable-lab intentionally implements only vulnerable endpoints; this test verifies
    // the expected secure control behavior (403 Forbidden when session user != requested object ID).
    server = await startLocalTestServer((req, res) => {
      const callerId = req.headers['x-auth-user'];
      const requestedId = req.url.split('/').pop();
      if (callerId !== requestedId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Object ownership check failed' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: requestedId, fullName: 'Authorized Owner' }));
    });

    const { executeRealRequest } = requireBackend('services/apiTester');
    const blockedAttempt = await executeRealRequest({
      url: `${server.baseUrl}/api/v1/secure/users/user_9921`,
      method: 'GET',
      headers: { 'X-Auth-User': 'user_1001' },
      allowLocalLab: true
    });

    assert.equal(blockedAttempt.status, 403);
    assert.equal(blockedAttempt.isError, true);
    assert.equal(blockedAttempt.data.ssn, undefined);
    assert.match(blockedAttempt.data.error, /ownership check failed/i);
  });

  it('executeScenario (Excessive Data Exposure): detects leaked password_hash, ssn, and internal_api_secret', async () => {
    server = await startLocalTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'usr_7718',
          username: 'alice_developer',
          password_hash: '$2b$12$fakehashvalue',
          ssn: '987-65-4321',
          internal_api_secret: 'sec_live_test'
        })
      );
    });

    config.vulnerableLabUrl = server.baseUrl;
    Api.findOne = async () => ({ _id: 'lab-api-1', isLabApi: true });
    Scan.prototype.save = async function () {
      return this;
    };
    Finding.prototype.save = async function () {
      return this;
    };

    const req = createMockReq({ body: { scenarioId: 'excessive_data' }, user: { _id: 'u1' } });
    const res = createMockRes();

    await simulationController.executeScenario(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.execution.response.data.password_hash, '$2b$12$fakehashvalue');
    assert.equal(res.body.execution.response.data.internal_api_secret, 'sec_live_test');
    assert.equal(res.body.execution.finding.owaspCategory, 'API3:2023 - Broken Object Property Level Authorization');
    assert.equal(res.body.execution.finding.severity, 'high');
  });

  it('executeScenario: falls back cleanly when local vulnerable lab container is unreachable', async () => {
    const temp = await startLocalTestServer(() => {});
    const deadUrl = temp.baseUrl;
    await temp.close();

    config.vulnerableLabUrl = deadUrl;
    Api.findOne = async () => ({ _id: 'lab-api-1', isLabApi: true });
    Scan.prototype.save = async function () {
      return this;
    };
    Finding.prototype.save = async function () {
      return this;
    };

    const req = createMockReq({ body: { scenarioId: 'broken_auth' }, user: { _id: 'u1' } });
    const res = createMockRes();

    await simulationController.executeScenario(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.execution.response.data.status, 'success');
    assert.equal(res.body.execution.finding.isSimulation, true);
  });
});

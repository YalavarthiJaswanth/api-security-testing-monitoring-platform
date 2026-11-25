import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import { User } from '../src/models/User';
import { config } from '../src/config/env';

describe('Complete Swagger API Endpoints Verification Suite', () => {
  let authToken = '';
  let testApiId = '';
  let testScanId = '';
  let testFindingId = '';
  let testWebhookId = '';
  let testMonitoringId = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongoUri);
    }

    // Ensure test user exists and authenticate
    await User.deleteOne({ email: 'swagger_tester@apisentinel.local' });
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'swagger_tester',
        email: 'swagger_tester@apisentinel.local',
        password: 'Password123!',
        role: 'admin'
      });

    if (regRes.body.token) {
      authToken = regRes.body.token;
    } else {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'swagger_tester@apisentinel.local',
          password: 'Password123!'
        });
      authToken = loginRes.body.token;
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('1. Health Check GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('2. Auth GET /api/v1/auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('3. APIs POST /api/v1/apis (Create Target API)', async () => {
    const res = await request(app)
      .post('/api/v1/apis')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Swagger Verification API',
        baseUrl: 'http://localhost:5050',
        description: 'Target API for test suite',
        environment: 'development',
        authType: 'none',
        isLabApi: true,
        endpoints: [
          { path: '/api/v1/lab/users', method: 'GET', summary: 'Get Users' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.api.id).toBeDefined();
    testApiId = res.body.api.id;
  });

  it('4. APIs GET /api/v1/apis (List Target APIs)', async () => {
    const res = await request(app)
      .get('/api/v1/apis')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('5. APIs GET /api/v1/apis/:id', async () => {
    const res = await request(app)
      .get(`/api/v1/apis/${testApiId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.api.name).toBe('Swagger Verification API');
  });

  it('6. APIs GET /api/v1/apis/:id/postman (Target Postman Export)', async () => {
    const res = await request(app)
      .get(`/api/v1/apis/${testApiId}/postman`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.info.name).toContain('Swagger Verification API');
  });

  it('7. APIs POST /api/v1/apis/import-openapi', async () => {
    const res = await request(app)
      .post('/api/v1/apis/import-openapi')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        specContent: 'openapi: "3.0.0"\ninfo:\n  title: Test Spec\n  version: 1.0.0\npaths:\n  /test:\n    get:\n      summary: Test'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('8. Test POST /api/v1/test/execute', async () => {
    const res = await request(app)
      .post('/api/v1/test/execute')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'http://localhost:5050/health',
        method: 'GET',
        allowLocalLab: true
      });
    expect([200, 400]).toContain(res.status);
    expect(res.body.success).toBeDefined();
  });

  it('9. Scans POST /api/v1/scans/trigger', async () => {
    const res = await request(app)
      .post('/api/v1/scans/trigger')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        apiId: testApiId,
        scanType: 'quick_audit'
      });
    expect(res.status).toBe(201);
    expect(res.body.scan._id).toBeDefined();
    testScanId = res.body.scan._id;
  });

  it('10. Scans GET /api/v1/scans', async () => {
    const res = await request(app)
      .get('/api/v1/scans')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.scans.length).toBeGreaterThan(0);
  });

  it('11. Scans GET /api/v1/scans/:id', async () => {
    const res = await request(app)
      .get(`/api/v1/scans/${testScanId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.scan._id).toBe(testScanId);
  });

  it('12. Findings GET /api/v1/findings', async () => {
    const res = await request(app)
      .get('/api/v1/findings')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    if (res.body.findings.length > 0) {
      testFindingId = res.body.findings[0]._id;
    }
  });

  it('13. Findings PATCH /api/v1/findings/:id/status', async () => {
    if (testFindingId) {
      const res = await request(app)
        .patch(`/api/v1/findings/${testFindingId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'resolved' });
      expect(res.status).toBe(200);
      expect(res.body.finding.status).toBe('resolved');
    }
  });

  it('14. Monitoring GET /api/v1/monitoring', async () => {
    const res = await request(app)
      .get('/api/v1/monitoring')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    if (res.body.configs.length > 0) {
      testMonitoringId = res.body.configs[0]._id;
    }
  });

  it('15. Monitoring GET /api/v1/monitoring/:id', async () => {
    if (testMonitoringId) {
      const res = await request(app)
        .get(`/api/v1/monitoring/${testMonitoringId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
    }
  });

  it('16. Monitoring POST /api/v1/monitoring/:id/toggle', async () => {
    if (testMonitoringId) {
      const res = await request(app)
        .post(`/api/v1/monitoring/${testMonitoringId}/toggle`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('17. Dashboard GET /api/v1/dashboard/stats', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalApis).toBeGreaterThan(0);
  });

  it('18. Reports GET /api/v1/reports/json', async () => {
    const res = await request(app)
      .get('/api/v1/reports/json')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.exportDate).toBeDefined();
  });

  it('19. Reports GET /api/v1/reports/pdf', async () => {
    const res = await request(app)
      .get('/api/v1/reports/pdf')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
  });

  it('20. Reports GET /api/v1/reports/postman', async () => {
    const res = await request(app)
      .get('/api/v1/reports/postman')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.info.name).toContain('API Sentinel');
  });

  it('21. Reports GET /api/v1/reports/openapi', async () => {
    const res = await request(app)
      .get('/api/v1/reports/openapi')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('22. Simulation GET /api/v1/simulation/scenarios', async () => {
    const res = await request(app)
      .get('/api/v1/simulation/scenarios')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.scenarios.length).toBeGreaterThan(0);
  });

  it('23. Simulation POST /api/v1/simulation/execute', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/execute')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ scenarioId: 'bola' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('24. Settings GET /api/v1/settings', async () => {
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.encryption.algorithm).toBe('AES-256-GCM');
  });

  it('25. Webhooks POST /api/v1/webhooks (Create)', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Swagger Verification Webhook',
        url: 'http://localhost:5050/webhook',
        events: ['scan.completed', 'finding.detected']
      });
    expect(res.status).toBe(201);
    expect(res.body.webhook.id).toBeDefined();
    testWebhookId = res.body.webhook.id;
  });

  it('26. Webhooks GET /api/v1/webhooks (List)', async () => {
    const res = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('27. Webhooks GET /api/v1/webhooks/:id', async () => {
    const res = await request(app)
      .get(`/api/v1/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.webhook.name).toBe('Swagger Verification Webhook');
  });

  it('28. Webhooks DELETE /api/v1/webhooks/:id', async () => {
    const res = await request(app)
      .delete(`/api/v1/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('29. APIs DELETE /api/v1/apis/:id', async () => {
    const res = await request(app)
      .delete(`/api/v1/apis/${testApiId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

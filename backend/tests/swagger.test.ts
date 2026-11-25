import request from 'supertest';
import app from '../src/server';
import { swaggerSpec } from '../src/config/swagger';

describe('Swagger / OpenAPI Documentation Tests', () => {
  it('should serve raw OpenAPI 3.0 specification at /api-docs.json', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('API Sentinel');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/api/v1/auth/login');
    expect(res.body.paths).toHaveProperty('/api/v1/scans/trigger');
    expect(res.body.paths).toHaveProperty('/api/v1/webhooks');
  });

  it('should serve raw OpenAPI spec at /swagger.json', async () => {
    const res = await request(app).get('/swagger.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('should serve Swagger UI HTML redirect or document at /api-docs/', async () => {
    const res = await request(app).get('/api-docs/');
    expect([200, 301, 302]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain('swagger');
    }
  });

  it('should validate swaggerSpec components and security definitions', () => {
    expect(swaggerSpec.components.securitySchemes).toHaveProperty('bearerAuth');
    expect(swaggerSpec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(swaggerSpec.components.schemas).toHaveProperty('ApiTarget');
    expect(swaggerSpec.components.schemas).toHaveProperty('Scan');
    expect(swaggerSpec.components.schemas).toHaveProperty('Finding');
    expect(swaggerSpec.components.schemas).toHaveProperty('Webhook');
  });
});

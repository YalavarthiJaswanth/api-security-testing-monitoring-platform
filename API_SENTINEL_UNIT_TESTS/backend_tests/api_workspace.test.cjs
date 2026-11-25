const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes, startLocalTestServer } = require('../helpers/mock_http.cjs');

const { executeRealRequest } = requireBackend('services/apiTester');
const { encryptCredentials } = requireBackend('utils/crypto');
const { Api } = requireBackend('models/Api');
const testController = requireBackend('controllers/testController');

describe('Interactive API Testing Workspace Unit Tests', () => {
  let server = null;
  const origApiFindOne = Api.findOne;

  afterEach(async () => {
    Api.findOne = origApiFindOne;
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('executeRealRequest: supports GET, POST, PUT, PATCH, DELETE with params, headers, and JSON body', async () => {
    server = await startLocalTestServer((req, res) => {
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Test-Echo': 'verified' });
        res.end(
          JSON.stringify({
            method: req.method,
            url: req.url,
            customHeader: req.headers['x-custom-header'],
            body: rawBody ? JSON.parse(rawBody) : null
          })
        );
      });
    });

    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
      const result = await executeRealRequest({
        url: `${server.baseUrl}/items`,
        method,
        params: { filter: 'active' },
        headers: { 'X-Custom-Header': 'sentinel-test' },
        data: hasBody ? { action: method } : undefined,
        allowLocalLab: true
      });

      assert.equal(result.status, 200);
      assert.equal(result.isError, false);
      assert.equal(result.data.method, method);
      assert.equal(result.data.url, '/items?filter=active');
      assert.equal(result.data.customHeader, 'sentinel-test');
      assert.equal(result.headers['x-test-echo'], 'verified');
      assert.ok(result.sizeBytes > 0);
      assert.ok(result.durationMs >= 0);
      if (hasBody) {
        assert.deepEqual(result.data.body, { action: method });
      }
    }
  });

  it('executeRealRequest: decrypts and injects Bearer, API Key, and Basic Auth credentials automatically', async () => {
    server = await startLocalTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          authorization: req.headers.authorization || null,
          apiKey: req.headers['x-sentinel-key'] || null
        })
      );
    });

    // 1. Bearer
    const bearerRes = await executeRealRequest({
      url: `${server.baseUrl}/auth-check`,
      method: 'GET',
      allowLocalLab: true,
      apiConfig: {
        authType: 'bearer',
        authConfig: { tokenEncrypted: encryptCredentials('jwt-token-xyz') }
      }
    });
    assert.equal(bearerRes.data.authorization, 'Bearer jwt-token-xyz');

    // 2. API Key
    const apiKeyRes = await executeRealRequest({
      url: `${server.baseUrl}/auth-check`,
      method: 'GET',
      allowLocalLab: true,
      apiConfig: {
        authType: 'apiKey',
        authConfig: {
          apiKeyHeader: 'X-Sentinel-Key',
          apiKeyEncrypted: encryptCredentials('key-98765')
        }
      }
    });
    assert.equal(apiKeyRes.data.apiKey, 'key-98765');

    // 3. Basic Auth
    const basicRes = await executeRealRequest({
      url: `${server.baseUrl}/auth-check`,
      method: 'GET',
      allowLocalLab: true,
      apiConfig: {
        authType: 'basic',
        authConfig: {
          username: 'admin',
          passwordEncrypted: encryptCredentials('pass123')
        }
      }
    });
    const expectedBasic = 'Basic ' + Buffer.from('admin:pass123').toString('base64');
    assert.equal(basicRes.data.authorization, expectedBasic);
  });

  it('executeRealRequest: flags HTTP 4xx and 5xx responses as isError while returning parsed payload', async () => {
    server = await startLocalTestServer((req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found' }));
    });

    const result = await executeRealRequest({
      url: `${server.baseUrl}/missing-resource`,
      method: 'GET',
      allowLocalLab: true
    });

    assert.equal(result.status, 404);
    assert.equal(result.isError, true);
    assert.equal(result.data.error, 'Resource not found');
  });

  it('executeRealRequest: handles network errors gracefully and returns status 0 with errorMessage', async () => {
    const temp = await startLocalTestServer(() => {});
    const closedUrl = temp.baseUrl;
    await temp.close();

    const result = await executeRealRequest({
      url: `${closedUrl}/down`,
      method: 'GET',
      timeout: 500,
      allowLocalLab: true
    });

    assert.equal(result.status, 0);
    assert.equal(result.isError, true);
    assert.ok(result.errorMessage);
  });

  it('executeRealRequest & testEndpoint: block SSRF targets and reject missing URLs', async () => {
    await assert.rejects(
      () => executeRealRequest({ url: 'http://169.254.169.254/latest/meta-data/', method: 'GET', allowLocalLab: false }),
      /SSRF Blocked/i
    );

    const resMissingUrl = createMockRes();
    await testController.testEndpoint(createMockReq({ body: { method: 'GET' }, user: { _id: 'u1' } }), resMissingUrl);
    assert.equal(resMissingUrl.statusCode, 400);
    assert.match(resMissingUrl.body.message, /URL is required/i);

    // Controller rejects non-lab private IP URL with 400
    Api.findOne = async () => ({ _id: 'api-prod', isLabApi: false, authType: 'none' });
    const resSsrf = createMockRes();
    await testController.testEndpoint(
      createMockReq({
        body: { apiId: 'api-prod', url: 'http://10.0.0.5/admin', method: 'GET' },
        user: { _id: 'u1' }
      }),
      resSsrf
    );
    assert.equal(resSsrf.statusCode, 400);
    assert.match(resSsrf.body.message, /SSRF Blocked/i);
  });
});

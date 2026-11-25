const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes } = require('../helpers/mock_http.cjs');

const { Api } = requireBackend('models/Api');
const { MonitoringConfig } = requireBackend('models/Monitoring');
const { Scan } = requireBackend('models/Scan');
const { Finding } = requireBackend('models/Finding');
const { decryptCredentials } = requireBackend('utils/crypto');
const { parseOpenApiSpec } = requireBackend('services/openapiParser');
const apiController = requireBackend('controllers/apiController');

describe('API Management & OpenAPI Parser Unit Tests', () => {
  const originals = {
    apiFind: Api.find,
    apiFindOne: Api.findOne,
    apiFindOneAndDelete: Api.findOneAndDelete,
    apiSave: Api.prototype.save,
    monitoringSave: MonitoringConfig.prototype.save,
    scanDeleteMany: Scan.deleteMany,
    findingDeleteMany: Finding.deleteMany,
    monitoringDeleteMany: MonitoringConfig.deleteMany
  };

  afterEach(() => {
    Api.find = originals.apiFind;
    Api.findOne = originals.apiFindOne;
    Api.findOneAndDelete = originals.apiFindOneAndDelete;
    Api.prototype.save = originals.apiSave;
    MonitoringConfig.prototype.save = originals.monitoringSave;
    Scan.deleteMany = originals.scanDeleteMany;
    Finding.deleteMany = originals.findingDeleteMany;
    MonitoringConfig.deleteMany = originals.monitoringDeleteMany;
  });

  it('createApi: rejects missing name or baseUrl with HTTP 400', async () => {
    const reqMissingUrl = createMockReq({ body: { name: 'Billing API' }, user: { _id: 'u1' } });
    const res1 = createMockRes();
    await apiController.createApi(reqMissingUrl, res1);
    assert.equal(res1.statusCode, 400);
    assert.match(res1.body.message, /required/i);

    const reqMissingName = createMockReq({ body: { baseUrl: 'https://api.example.com' }, user: { _id: 'u1' } });
    const res2 = createMockRes();
    await apiController.createApi(reqMissingName, res2);
    assert.equal(res2.statusCode, 400);
  });

  it('createApi: rejects invalid or SSRF-prohibited baseUrl with HTTP 400', async () => {
    const reqInvalid = createMockReq({
      body: { name: 'Bad URL API', baseUrl: 'not-a-valid-url' },
      user: { _id: 'u1' }
    });
    const resInvalid = createMockRes();
    await apiController.createApi(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 400);
    assert.match(resInvalid.body.message, /SSRF validation failed/i);

    const reqMetadata = createMockReq({
      body: { name: 'AWS Metadata Probe', baseUrl: 'http://169.254.169.254/latest/meta-data/' },
      user: { _id: 'u1' }
    });
    const resMetadata = createMockRes();
    await apiController.createApi(reqMetadata, resMetadata);
    assert.equal(resMetadata.statusCode, 400);
    assert.match(resMetadata.body.message, /protected private\/metadata/i);
  });

  it('createApi: registers API, encrypts bearer token, parses OpenAPI spec, and initializes MonitoringConfig', async () => {
    let savedApiDoc = null;
    let monitoringInitialized = false;

    Api.prototype.save = async function () {
      savedApiDoc = this;
      return this;
    };
    MonitoringConfig.prototype.save = async function () {
      monitoringInitialized = true;
      return this;
    };

    const sampleOpenApi = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Orders API', version: '2.0.0' },
      paths: {
        '/orders': { get: { summary: 'List orders' } },
        '/orders/{id}': { get: { summary: 'Get order', security: [{ bearerAuth: [] }] } }
      }
    });

    const req = createMockReq({
      user: { _id: 'user-101' },
      body: {
        name: 'Orders Service',
        baseUrl: 'https://orders.example.com',
        environment: 'staging',
        authType: 'bearer',
        credentials: { token: 'super_secret_bearer_token_abc' },
        openapiSpec: sampleOpenApi
      }
    });
    const res = createMockRes();

    await apiController.createApi(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.api.name, 'Orders Service');
    assert.equal(res.body.api.endpointCount, 2);
    assert.equal(monitoringInitialized, true);

    // Ensure token was encrypted at rest and never stored in plaintext
    assert.ok(savedApiDoc.authConfig.tokenEncrypted);
    assert.notEqual(savedApiDoc.authConfig.tokenEncrypted, 'super_secret_bearer_token_abc');
    assert.equal(decryptCredentials(savedApiDoc.authConfig.tokenEncrypted), 'super_secret_bearer_token_abc');
  });

  it('createApi: reflects actual duplicate registration behavior (allows duplicate names unless DB enforces unique)', async () => {
    // Verified in Api.ts & apiController.ts: ApiSchema index on { createdBy, name } is non-unique
    // and createApi does not perform a duplicate check before saving.
    let saveCalls = 0;
    Api.prototype.save = async function () {
      saveCalls += 1;
      return this;
    };
    MonitoringConfig.prototype.save = async function () {
      return this;
    };

    const payload = { name: 'Duplicate API', baseUrl: 'https://dup.example.com' };
    const res1 = createMockRes();
    const res2 = createMockRes();

    await apiController.createApi(createMockReq({ user: { _id: 'u1' }, body: payload }), res1);
    await apiController.createApi(createMockReq({ user: { _id: 'u1' }, body: payload }), res2);

    assert.equal(res1.statusCode, 201);
    assert.equal(res2.statusCode, 201);
    assert.equal(saveCalls, 2);
  });

  it('listApis & getApiById: retrieve sanitized APIs without exposing encrypted secrets', async () => {
    const fakeDoc = {
      _id: 'api-1',
      name: 'Customer API',
      baseUrl: 'https://cust.example.com',
      description: 'Core CRM',
      environment: 'production',
      authType: 'apiKey',
      authConfig: { apiKeyEncrypted: 'iv:tag:cipher' },
      endpoints: [{ path: '/customers', method: 'GET' }],
      isLabApi: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02'
    };

    Api.find = () => ({ sort: async () => [fakeDoc] });
    const resList = createMockRes();
    await apiController.listApis(createMockReq({ user: { _id: 'u1' } }), resList);

    assert.equal(resList.statusCode, 200);
    assert.equal(resList.body.count, 1);
    assert.equal(resList.body.apis[0].authConfig, undefined);

    Api.findOne = async () => fakeDoc;
    const resOne = createMockRes();
    await apiController.getApiById(createMockReq({ params: { id: 'api-1' }, user: { _id: 'u1' } }), resOne);

    assert.equal(resOne.statusCode, 200);
    assert.equal(resOne.body.api.hasAuthCredentials, true);
    assert.equal(resOne.body.api.authConfig, undefined);

    Api.findOne = async () => null;
    const resMissing = createMockRes();
    await apiController.getApiById(createMockReq({ params: { id: 'missing' }, user: { _id: 'u1' } }), resMissing);
    assert.equal(resMissing.statusCode, 404);
  });

  it('updateApi: updates fields, validates new baseUrl against SSRF, and returns 404 when missing', async () => {
    Api.findOne = async () => null;
    const resMissing = createMockRes();
    await apiController.updateApi(createMockReq({ params: { id: 'none' }, user: { _id: 'u1' }, body: {} }), resMissing);
    assert.equal(resMissing.statusCode, 404);

    const apiDoc = {
      _id: 'api-1',
      name: 'Old Name',
      baseUrl: 'https://old.example.com',
      environment: 'development',
      authType: 'none',
      isLabApi: false,
      endpoints: [],
      save: async function () {
        return this;
      }
    };
    Api.findOne = async () => apiDoc;

    // SSRF rejection during update
    const resBlocked = createMockRes();
    await apiController.updateApi(
      createMockReq({ params: { id: 'api-1' }, user: { _id: 'u1' }, body: { baseUrl: 'http://127.0.0.1:8080' } }),
      resBlocked
    );
    assert.equal(resBlocked.statusCode, 400);

    // Valid update
    const resUpdated = createMockRes();
    await apiController.updateApi(
      createMockReq({
        params: { id: 'api-1' },
        user: { _id: 'u1' },
        body: { name: 'New Name', baseUrl: 'https://new.example.com', environment: 'production' }
      }),
      resUpdated
    );
    assert.equal(resUpdated.statusCode, 200);
    assert.equal(resUpdated.body.api.name, 'New Name');
    assert.equal(resUpdated.body.api.baseUrl, 'https://new.example.com');
  });

  it('deleteApi: removes API and cascades deletion to Scans, Findings, and MonitoringConfig', async () => {
    Api.findOneAndDelete = async () => null;
    const res404 = createMockRes();
    await apiController.deleteApi(createMockReq({ params: { id: 'missing' }, user: { _id: 'u1' } }), res404);
    assert.equal(res404.statusCode, 404);

    const deletedCalls = [];
    Api.findOneAndDelete = async () => ({ _id: 'api-del-1' });
    Scan.deleteMany = async (q) => deletedCalls.push(['scan', q.apiId]);
    Finding.deleteMany = async (q) => deletedCalls.push(['finding', q.apiId]);
    MonitoringConfig.deleteMany = async (q) => deletedCalls.push(['monitoring', q.apiId]);

    const resOk = createMockRes();
    await apiController.deleteApi(createMockReq({ params: { id: 'api-del-1' }, user: { _id: 'u1' } }), resOk);

    assert.equal(resOk.statusCode, 200);
    assert.equal(deletedCalls.length, 3);
    assert.deepEqual(deletedCalls.map((c) => c[0]), ['scan', 'finding', 'monitoring']);
  });

  it('parseOpenApiSpec: parses YAML OpenAPI specs and rejects invalid specs cleanly', () => {
    const yamlSpec = `
openapi: 3.0.1
info:
  title: Inventory YAML API
  version: "1.2"
servers:
  - url: https://yaml.example.com/v1
paths:
  /items:
    post:
      summary: Create item
      parameters:
        - name: region
          in: query
          required: true
`;
    const parsed = parseOpenApiSpec(yamlSpec);
    assert.equal(parsed.title, 'Inventory YAML API');
    assert.equal(parsed.baseUrl, 'https://yaml.example.com/v1');
    assert.equal(parsed.endpoints.length, 1);
    assert.equal(parsed.endpoints[0].method, 'POST');
    assert.equal(parsed.endpoints[0].parameters[0].name, 'region');

    assert.throws(() => parseOpenApiSpec(''), /empty or invalid/i);
  });
});

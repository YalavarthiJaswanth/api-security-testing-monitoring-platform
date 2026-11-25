const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes } = require('../helpers/mock_http.cjs');

const { Finding } = requireBackend('models/Finding');
const { Scan } = requireBackend('models/Scan');
const { Api } = requireBackend('models/Api');
const reportController = requireBackend('controllers/reportController');

describe('Security Reporting Unit Tests (PDF & JSON)', () => {
  const originals = {
    findingFind: Finding.find,
    scanFindById: Scan.findById,
    apiFindById: Api.findById
  };

  afterEach(() => {
    Finding.find = originals.findingFind;
    Scan.findById = originals.scanFindById;
    Api.findById = originals.apiFindById;
  });

  it('exportJsonReport: exports findings, metadata headers, and scan summary', async () => {
    const sampleFindings = [
      {
        title: 'Broken Object Level Authorization',
        severity: 'critical',
        owaspCategory: 'API1:2023 - Broken Object Level Authorization',
        method: 'GET',
        endpoint: '/api/v1/users/9921',
        remediation: 'Check ownership.'
      }
    ];
    const scanId = '507f1f77bcf86cd799439031';
    const sampleScan = { _id: scanId, scanType: 'full_owasp', status: 'completed' };

    Finding.find = () => ({ populate: async () => sampleFindings });
    Scan.findById = async () => sampleScan;

    const req = createMockReq({
      query: { scanId },
      user: { _id: 'u1', username: 'auditor_jane' }
    });
    const res = createMockRes();

    await reportController.exportJsonReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.match(res.headers['content-disposition'], /attachment; filename=api-sentinel-report-\d+\.json/);
    assert.equal(res.body.generatedBy, 'auditor_jane');
    assert.equal(res.body.totalFindings, 1);
    assert.deepEqual(res.body.scanSummary, sampleScan);
    assert.equal(res.body.findings[0].severity, 'critical');
  });

  it('exportJsonReport: handles empty scan / zero findings gracefully', async () => {
    Finding.find = () => ({ populate: async () => [] });
    Scan.findById = async () => null;

    const req = createMockReq({
      query: {},
      user: { _id: 'u1', username: 'auditor_jane' }
    });
    const res = createMockRes();

    await reportController.exportJsonReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.totalFindings, 0);
    assert.deepEqual(res.body.findings, []);
    assert.equal(res.body.scanSummary, undefined);
  });

  it('exportPdfReport: generates valid binary PDF document including severities and findings', async () => {
    const longRemediation = 'Enforce strict validation on server side. '.repeat(4); // > 100 chars to test truncation
    const sampleFindings = [
      {
        title: 'Missing HSTS Header',
        severity: 'medium',
        owaspCategory: 'API8:2023 - Security Misconfiguration',
        method: 'GET',
        endpoint: '/api/v1/public',
        remediation: longRemediation
      },
      {
        title: 'BOLA Flaw',
        severity: 'critical',
        owaspCategory: 'API1:2023 - Broken Object Level Authorization',
        method: 'GET',
        endpoint: '/api/v1/users/9921',
        remediation: 'Validate session ownership.'
      }
    ];

    Finding.find = () => ({ populate: async () => sampleFindings });
    Scan.findById = () => ({ populate: async () => null });
    Api.findById = async () => ({ name: 'NovaPay API', baseUrl: 'https://api.novapay.example' });

    const req = createMockReq({
      query: { apiId: 'api-1' },
      user: { _id: 'u1', username: 'auditor_jane' }
    });
    const res = createMockRes();

    await reportController.exportPdfReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /attachment; filename=api-sentinel-report-\d+\.pdf/);
    assert.ok(Buffer.isBuffer(res.sentBuffer), 'Expected PDF response to be a Buffer');
    assert.ok(res.sentBuffer.length > 1000, 'Expected non-trivial PDF size');
    assert.equal(res.sentBuffer.subarray(0, 5).toString('ascii'), '%PDF-', 'Expected valid PDF magic header');
  });

  it('exportPdfReport: handles empty findings array without crashing', async () => {
    Finding.find = () => ({ populate: async () => [] });
    Scan.findById = () => ({ populate: async () => null });
    Api.findById = async () => null;

    const req = createMockReq({
      query: {},
      user: { _id: 'u1', username: 'auditor_jane' }
    });
    const res = createMockRes();

    await reportController.exportPdfReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.equal(res.sentBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  });

  it('exportJsonReport: returns HTTP 500 error JSON when database query fails', async () => {
    Finding.find = () => ({
      populate: async () => {
        throw new Error('MongoDB read failure');
      }
    });

    const req = createMockReq({ query: {}, user: { _id: 'u1', username: 'auditor' } });
    const res = createMockRes();

    await reportController.exportJsonReport(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /MongoDB read failure/);
  });
});

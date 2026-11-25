import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Api } from '../models/Api';
import { Scan } from '../models/Scan';
import { Finding } from '../models/Finding';
import { config } from '../config/env';
import { decryptCredentials } from '../utils/crypto';
import { webhookService } from '../services/webhookService';
import axios from 'axios';

export async function triggerScan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { apiId, scanType = 'full_owasp' } = req.body;

    if (!apiId || !mongoose.Types.ObjectId.isValid(apiId)) {
      res.status(400).json({ success: false, message: 'A valid API ID is required' });
      return;
    }

    const api = await Api.findOne({ _id: apiId, createdBy: req.user!._id });
    if (!api) {
      res.status(404).json({ success: false, message: 'API not found' });
      return;
    }

    // Decrypt credentials to pass to the security testing engine
    let decryptedToken = undefined;
    let decryptedApiKey = undefined;
    let decryptedPassword = undefined;

    if (api.authType === 'bearer' && api.authConfig?.tokenEncrypted) {
      decryptedToken = decryptCredentials(api.authConfig.tokenEncrypted);
    } else if (api.authType === 'apiKey' && api.authConfig?.apiKeyEncrypted) {
      decryptedApiKey = decryptCredentials(api.authConfig.apiKeyEncrypted);
    } else if (api.authType === 'basic' && api.authConfig?.passwordEncrypted) {
      decryptedPassword = decryptCredentials(api.authConfig.passwordEncrypted);
    }

    // Create pending scan document
    const scan = new Scan({
      apiId: api._id,
      scanType,
      status: 'running',
      isSimulation: api.isLabApi,
      targetBaseUrl: api.baseUrl,
      endpointsTested: api.endpoints.length,
      createdBy: req.user!._id,
      logs: [`Scan started for ${api.name} (${api.baseUrl}) with profile: ${scanType}`]
    });
    await scan.save();

    const startTime = Date.now();
    let rawFindings: any[] = [];

    // Invoke Python Security Testing Engine
    try {
      const enginePayload = {
        scan_id: scan._id.toString(),
        scan_type: scanType,
        base_url: api.baseUrl,
        is_lab: api.isLabApi,
        endpoints: api.endpoints.map((ep) => ({
          path: ep.path,
          method: ep.method,
          parameters: ep.parameters || [],
          auth_required: ep.authRequired
        })),
        auth: {
          auth_type: api.authType,
          token: decryptedToken,
          api_key: decryptedApiKey,
          api_key_header: api.authConfig?.apiKeyHeader,
          username: api.authConfig?.username,
          password: decryptedPassword
        }
      };

      const engineResponse = await axios.post(`${config.securityEngineUrl}/scan`, enginePayload, {
        timeout: 45000
      });

      if (engineResponse.data && Array.isArray(engineResponse.data.findings)) {
        rawFindings = engineResponse.data.findings;
        scan.logs.push(`Python Security Engine completed scan with ${rawFindings.length} findings.`);
      }
    } catch (engineErr: any) {
      scan.logs.push(`Security Engine direct call error: ${engineErr.message}. Executing built-in Node security inspection.`);
      // Run direct Node security inspection fallback
      rawFindings = await runNodeSecurityAudit(api, decryptedToken, decryptedApiKey, scanType);
    }

    const durationMs = Date.now() - startTime;
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0
    };

    const createdFindings = [];
    for (const f of rawFindings) {
      const sev = (f.severity || 'low').toLowerCase() as keyof typeof severityCounts;
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      }

      const findingDoc = new Finding({
        scanId: scan._id,
        apiId: api._id,
        title: f.title || 'Security Weakness Detected',
        owaspCategory: f.owasp_category || f.owaspCategory || 'API8:2023 - Security Misconfiguration',
        severity: sev,
        endpoint: f.endpoint || api.baseUrl,
        method: f.method || 'GET',
        evidence: f.evidence || {},
        explanation: f.explanation || 'Security weakness detected during automated assessment.',
        potentialImpact: f.potential_impact || f.potentialImpact || 'Potential unauthorized access or compromise.',
        remediation: f.remediation || 'Apply security controls according to OWASP recommendations.',
        confidence: f.confidence || 'probable',
        status: 'open',
        isSimulation: api.isLabApi,
        createdBy: req.user!._id
      });
      await findingDoc.save();
      createdFindings.push(findingDoc);
    }

    scan.status = 'completed';
    scan.durationMs = durationMs;
    scan.severityCounts = severityCounts;
    scan.findingsCount = createdFindings.length;
    scan.logs.push(`Scan finished in ${durationMs}ms with ${createdFindings.length} findings recorded.`);
    await scan.save();

    // Dispatch webhook notifications (await under serverless so Vercel does not freeze early)
    const webhookDispatches: Promise<void>[] = [
      webhookService.dispatchWebhookEvent('scan.completed', {
        scanId: scan._id,
        apiId: api._id,
        apiName: api.name,
        targetBaseUrl: api.baseUrl,
        scanType: scan.scanType,
        status: scan.status,
        durationMs: scan.durationMs,
        findingsCount: createdFindings.length,
        severityCounts: scan.severityCounts,
        timestamp: new Date().toISOString()
      }, req.user!._id.toString())
    ];

    // If critical or high findings were detected, also dispatch finding.detected
    const criticalOrHigh = createdFindings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    );
    if (criticalOrHigh.length > 0) {
      webhookDispatches.push(
        webhookService.dispatchWebhookEvent('finding.detected', {
          scanId: scan._id,
          apiId: api._id,
          apiName: api.name,
          targetBaseUrl: api.baseUrl,
          criticalCount: severityCounts.critical,
          highCount: severityCounts.high,
          findings: criticalOrHigh.map((f) => ({
            id: f._id,
            title: f.title,
            severity: f.severity,
            owaspCategory: f.owaspCategory,
            endpoint: f.endpoint,
            method: f.method
          })),
          timestamp: new Date().toISOString()
        }, req.user!._id.toString())
      );
    }

    if (process.env.VERCEL) {
      await Promise.allSettled(webhookDispatches);
    }

    res.status(201).json({
      success: true,
      message: 'Scan completed successfully',
      scan,
      findings: createdFindings
    });
  } catch (err: any) {
    if (req.user?._id) {
      webhookService.dispatchWebhookEvent('scan.failed', {
        apiId: req.body?.apiId,
        error: err.message || 'Scan execution failed',
        timestamp: new Date().toISOString()
      }, req.user._id.toString());
    }
    res.status(500).json({ success: false, message: err.message || 'Scan execution failed' });
  }
}

export async function listScans(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const isSimulation = req.query.isSimulation === 'true';
    const filter: any = { createdBy: req.user!._id };
    if (req.query.isSimulation !== undefined) {
      filter.isSimulation = isSimulation;
    }

    const scans = await Scan.find(filter)
      .populate('apiId', 'name baseUrl environment isLabApi')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: scans.length, scans });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list scans' });
  }
}

export async function getScanById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ success: false, message: 'Scan not found' });
      return;
    }
    const scan = await Scan.findOne({ _id: req.params.id, createdBy: req.user!._id })
      .populate('apiId', 'name baseUrl environment');

    if (!scan) {
      res.status(404).json({ success: false, message: 'Scan not found' });
      return;
    }

    const findings = await Finding.find({ scanId: scan._id }).sort({ severity: 1 });

    res.json({ success: true, scan, findings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to get scan details' });
  }
}

/**
 * Built-in Node security audit fallback for resilience
 */
async function runNodeSecurityAudit(api: any, token?: string, apiKey?: string, scanType?: string): Promise<any[]> {
  const findings: any[] = [];
  const testUrl = api.baseUrl.replace(/\/$/, '');

  try {
    const probe = await axios.get(testUrl, {
      timeout: 5000,
      validateStatus: () => true,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    const headers = probe.headers;

    // 1. Missing Security Headers
    const secHeaders = [
      { name: 'strict-transport-security', title: 'Missing Strict-Transport-Security (HSTS)', sev: 'medium' },
      { name: 'x-content-type-options', title: 'Missing X-Content-Type-Options Header', sev: 'low' },
      { name: 'x-frame-options', title: 'Missing X-Frame-Options Header', sev: 'low' },
      { name: 'content-security-policy', title: 'Missing Content-Security-Policy Header', sev: 'medium' }
    ];

    for (const h of secHeaders) {
      if (!headers[h.name]) {
        findings.push({
          title: h.title,
          owasp_category: 'API8:2023 - Security Misconfiguration',
          severity: h.sev,
          endpoint: testUrl,
          method: 'GET',
          evidence: {
            requestUrl: testUrl,
            responseStatus: probe.status,
            responseHeaders: headers,
            details: `Response does not include security header '${h.name}'`
          },
          explanation: `The HTTP response lacks the ${h.name} header, leaving clients vulnerable to protocol downgrades, clickjacking, or MIME-type sniffing.`,
          potential_impact: 'Increased susceptibility to client-side attacks and traffic interception.',
          remediation: `Configure your reverse proxy or web application to send the header '${h.name}'.`,
          confidence: 'confirmed'
        });
      }
    }

    // 2. Weak CORS Configuration
    const corsAllowOrigin = headers['access-control-allow-origin'];
    const corsAllowCreds = headers['access-control-allow-credentials'];
    if (corsAllowOrigin === '*' || (corsAllowOrigin && corsAllowCreds === 'true')) {
      findings.push({
        title: 'Overly Permissive CORS Configuration',
        owasp_category: 'API8:2023 - Security Misconfiguration',
        severity: 'high',
        endpoint: testUrl,
        method: 'GET',
        evidence: {
          requestUrl: testUrl,
          responseStatus: probe.status,
          responseHeaders: {
            'access-control-allow-origin': corsAllowOrigin,
            'access-control-allow-credentials': corsAllowCreds
          }
        },
        explanation: 'The API specifies a wildcard or reflects arbitrary origins with credential sharing enabled.',
        potential_impact: 'Cross-origin attackers could read authenticated response data through malicious websites.',
        remediation: 'Restrict Access-Control-Allow-Origin to trusted domain origins and avoid wildcard credentials.',
        confidence: 'confirmed'
      });
    }

    // 3. Information Disclosure in Headers
    if (headers['server'] || headers['x-powered-by']) {
      findings.push({
        title: 'Server Information Exposure via Headers',
        owasp_category: 'API8:2023 - Security Misconfiguration',
        severity: 'low',
        endpoint: testUrl,
        method: 'GET',
        evidence: {
          requestUrl: testUrl,
          responseStatus: probe.status,
          responseHeaders: {
            server: headers['server'],
            'x-powered-by': headers['x-powered-by']
          }
        },
        explanation: `The server exposes its software or framework version (${headers['server'] || headers['x-powered-by']}).`,
        potential_impact: 'Adversaries can tailor specific exploits to the known software version.',
        remediation: 'Disable Server and X-Powered-By banners in web server or Express configuration.',
        confidence: 'confirmed'
      });
    }

    // 4. Broken Authentication Check: Test unauthenticated access to endpoints requiring auth
    if (api.endpoints && api.endpoints.length > 0) {
      for (const ep of api.endpoints) {
        if (ep.authRequired) {
          const epUrl = `${testUrl}${ep.path.startsWith('/') ? ep.path : '/' + ep.path}`;
          try {
            const unauthProbe = await axios({
              url: epUrl,
              method: ep.method,
              timeout: 4000,
              validateStatus: () => true
            });

            if (unauthProbe.status === 200) {
              findings.push({
                title: 'Broken Authentication - Protected Endpoint Accessible Without Credentials',
                owasp_category: 'API2:2023 - Broken Authentication',
                severity: 'critical',
                endpoint: ep.path,
                method: ep.method,
                evidence: {
                  requestUrl: epUrl,
                  requestHeadersSent: { Authorization: '(None)' },
                  responseStatus: unauthProbe.status,
                  responseSnippet: JSON.stringify(unauthProbe.data).slice(0, 300)
                },
                explanation: `Endpoint ${ep.path} is marked as requiring authentication but returned HTTP 200 OK when requested anonymously.`,
                potential_impact: 'Unauthorized access to protected user resources and sensitive data.',
                remediation: 'Implement mandatory authentication middleware (e.g., JWT verification) before endpoint handlers.',
                confidence: 'confirmed'
              });
            }
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.warn('Node audit probe failed:', err.message);
  }

  return findings;
}

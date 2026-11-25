import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config/env';
import { Scan } from '../models/Scan';
import { Finding } from '../models/Finding';
import { Api } from '../models/Api';
import axios from 'axios';

export const SIMULATION_SCENARIOS = [
  {
    id: 'bola',
    name: 'Broken Object Level Authorization (BOLA / IDOR)',
    owaspCategory: 'API1:2023 - Broken Object Level Authorization',
    severity: 'critical',
    method: 'GET',
    path: '/api/v1/lab/users/user_9921',
    description: 'An authenticated user modifies an object ID in the path to view another user sensitive profile data without authorization.',
    payload: null,
    attackExplanation: 'The endpoint does not verify whether the authenticated subject has ownership or permission to access object ID 9921.',
    remediation: 'Implement fine-grained object-level authorization checks validating resource ownership before returning data.'
  },
  {
    id: 'broken_auth',
    name: 'Broken Authentication - Insecure Password Reset',
    owaspCategory: 'API2:2023 - Broken Authentication',
    severity: 'high',
    method: 'POST',
    path: '/api/v1/lab/auth/reset-password',
    description: 'Password reset flow accepts arbitrary reset tokens and does not validate expiration or cryptographic signatures.',
    payload: { email: 'victim@target.internal', newPassword: 'HackedPassword123!', resetToken: 'fake_or_predictable_token' },
    attackExplanation: 'The system blindly trusts client-provided token parameters without database validation or signature verification.',
    remediation: 'Use cryptographically secure, single-use, time-limited reset tokens hashed with SHA-256 in the database.'
  },
  {
    id: 'excessive_data',
    name: 'Broken Object Property Level Authorization (Excessive Data Exposure)',
    owaspCategory: 'API3:2023 - Broken Object Property Level Authorization',
    severity: 'high',
    method: 'GET',
    path: '/api/v1/lab/accounts/profile',
    description: 'Endpoint returns full database model serialization, exposing internal password hashes, SSNs, and admin privileges to regular clients.',
    payload: null,
    attackExplanation: 'The application backend dumps the entire database entity instead of applying a Data Transfer Object (DTO) filter.',
    remediation: 'Implement schema filtering (DTOs) and omit sensitive fields like password hashes, SSN, and internal role flags.'
  },
  {
    id: 'permissive_cors',
    name: 'Overly Permissive CORS with Credentials',
    owaspCategory: 'API8:2023 - Security Misconfiguration',
    severity: 'high',
    method: 'GET',
    path: '/api/v1/lab/data/export',
    description: 'The API dynamically reflects the origin header and sets Access-Control-Allow-Credentials: true, allowing arbitrary malicious websites to steal data.',
    payload: null,
    attackExplanation: 'Any malicious website visited by an authenticated user can execute cross-origin requests and read sensitive exported records.',
    remediation: 'Explicitly validate origin against a strict whitelist of authorized domain origins before returning CORS headers.'
  },
  {
    id: 'missing_headers',
    name: 'Missing Security Headers & Server Fingerprinting',
    owaspCategory: 'API8:2023 - Security Misconfiguration',
    severity: 'medium',
    method: 'GET',
    path: '/api/v1/lab/public/info',
    description: 'The API lacks HSTS, X-Content-Type-Options, and Content-Security-Policy headers while exposing exact server framework banners.',
    payload: null,
    attackExplanation: 'Attackers can identify outdated software versions and exploit missing MIME-sniffing and framing protections.',
    remediation: 'Enforce strict security headers (HSTS, CSP, X-Content-Type-Options: nosniff) and suppress Server / X-Powered-By banners.'
  },
  {
    id: 'unrestricted_resource',
    name: 'Unrestricted Resource Consumption (No Pagination / Rate Limits)',
    owaspCategory: 'API4:2023 - Unrestricted Resource Consumption',
    severity: 'medium',
    method: 'GET',
    path: '/api/v1/lab/orders?limit=1000000',
    description: 'Endpoint permits requesting millions of records in a single query without rate limiting or maximum page bounds.',
    payload: null,
    attackExplanation: 'A single unauthenticated request causes CPU spikes, memory exhaustion, and denial of service (DoS) for all users.',
    remediation: 'Enforce hard upper limits on pagination (e.g., max 100 per page) and implement IP/user-based rate limiting.'
  },
  {
    id: 'bfla',
    name: 'Broken Function Level Authorization (BFLA)',
    owaspCategory: 'API5:2023 - Broken Function Level Authorization',
    severity: 'critical',
    method: 'POST',
    path: '/api/v1/lab/admin/users/grant-admin',
    description: 'Administrative endpoint does not check user role; any regular authenticated user can invoke administrative privilege escalation.',
    payload: { targetUserId: 'user_123', role: 'superadmin' },
    attackExplanation: 'Administrative endpoints rely only on client-side hiding rather than server-side role validation.',
    remediation: 'Implement server-side role-based access control (RBAC) middleware verifying administrator privilege on all sensitive routes.'
  }
];

export async function listScenarios(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ success: true, scenarios: SIMULATION_SCENARIOS });
}

export async function executeScenario(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scenarioId = req.body?.scenarioId || req.params?.id || req.body?.id || 'bola';
    const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);

    if (!scenario) {
      res.status(404).json({ success: false, message: `Scenario '${scenarioId}' not found. Available: ${SIMULATION_SCENARIOS.map(s => s.id).join(', ')}` });
      return;
    }

    const labTargetUrl = `${config.vulnerableLabUrl}${scenario.path}`;
    const startTime = Date.now();
    let responseData: any;
    let responseStatus = 200;
    let responseHeaders: Record<string, any> = {};

    try {
      const resp = await axios({
        url: labTargetUrl,
        method: scenario.method as any,
        data: scenario.payload,
        headers: {
          'X-Simulation-Lab': 'true',
          'Origin': 'https://attacker-controlled-site.com'
        },
        timeout: 5000,
        validateStatus: () => true
      });
      responseStatus = resp.status;
      responseHeaders = resp.headers;
      responseData = resp.data;
    } catch (err: any) {
      // In-process fallback simulation response if vulnerable lab is loading
      responseStatus = 200;
      responseHeaders = {
        'content-type': 'application/json',
        'server': 'Express/4.21.0 (Vulnerable Lab Demonstration)',
        'access-control-allow-origin': 'https://attacker-controlled-site.com',
        'access-control-allow-credentials': 'true'
      };
      responseData = getFallbackSimulationResponse(scenario.id);
    }

    const durationMs = Date.now() - startTime;

    // Ensure a Simulation Lab Api record exists
    let labApi = await Api.findOne({ isLabApi: true, createdBy: req.user!._id });
    if (!labApi) {
      labApi = new Api({
        name: 'API Sentinel Simulation Lab',
        baseUrl: config.vulnerableLabUrl,
        description: 'Controlled vulnerable demonstration environment for OWASP API Security testing',
        environment: 'testing',
        authType: 'none',
        isLabApi: true,
        createdBy: req.user!._id,
        endpoints: SIMULATION_SCENARIOS.map((s) => ({
          path: s.path,
          method: s.method as any,
          summary: s.name,
          authRequired: false
        }))
      });
      await labApi.save();
    }

    // Save Simulation Scan
    const scan = new Scan({
      apiId: labApi._id,
      scanType: 'simulation_lab',
      status: 'completed',
      isSimulation: true,
      targetBaseUrl: config.vulnerableLabUrl,
      endpointsTested: 1,
      durationMs,
      severityCounts: {
        critical: scenario.severity === 'critical' ? 1 : 0,
        high: scenario.severity === 'high' ? 1 : 0,
        medium: scenario.severity === 'medium' ? 1 : 0,
        low: scenario.severity === 'low' ? 1 : 0,
        informational: 0
      },
      findingsCount: 1,
      createdBy: req.user!._id,
      logs: [`Executed simulation scenario: ${scenario.name}`]
    });
    await scan.save();

    // Save Simulation Finding
    const finding = new Finding({
      scanId: scan._id,
      apiId: labApi._id,
      title: `[SIMULATION] ${scenario.name}`,
      owaspCategory: scenario.owaspCategory,
      severity: scenario.severity,
      endpoint: scenario.path,
      method: scenario.method,
      evidence: {
        requestUrl: labTargetUrl,
        requestMethod: scenario.method,
        requestBody: scenario.payload,
        responseStatus,
        responseHeaders,
        responseSnippet: JSON.stringify(responseData).slice(0, 500),
        details: scenario.attackExplanation
      },
      explanation: scenario.attackExplanation,
      potentialImpact: 'Demonstrates real-world exploit path in vulnerable application architecture.',
      remediation: scenario.remediation,
      confidence: 'confirmed',
      status: 'open',
      isSimulation: true,
      createdBy: req.user!._id
    });
    await finding.save();

    res.json({
      success: true,
      scenario,
      execution: {
        request: {
          url: labTargetUrl,
          method: scenario.method,
          payload: scenario.payload
        },
        response: {
          status: responseStatus,
          headers: responseHeaders,
          data: responseData,
          durationMs
        },
        finding
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to execute simulation scenario' });
  }
}

function getFallbackSimulationResponse(scenarioId: string): any {
  switch (scenarioId) {
    case 'bola':
      return {
        id: 'user_9921',
        fullName: 'Dr. Jane Vance (Victim)',
        email: 'jane.vance@internal-healthcare.org',
        ssn: '***-**-8812',
        medicalRecordNumber: 'MRN-902188',
        role: 'patient',
        billingAddress: '445 Montgomery St, San Francisco, CA'
      };
    case 'broken_auth':
      return {
        status: 'success',
        message: 'Password has been updated for victim@target.internal. No token signature was verified.'
      };
    case 'excessive_data':
      return {
        id: 'usr_7718',
        username: 'alice_developer',
        email: 'alice@corp.internal',
        password_hash: '$2b$12$K1n3k9D2Q5sJ7pM8rT9uAe7F6G5H4J3K2L1M0N9O8P7Q6R5S4T3U2',
        salt: '88fa2b109c',
        ssn: '987-65-4321',
        is_admin: false,
        internal_api_secret: 'sec_live_99a8b7c6d5e4f3'
      };
    case 'permissive_cors':
      return {
        accountNumber: 'ACT-9823-1192',
        balance: 14250.75,
        currency: 'USD',
        transactions: [{ id: 'tx_1', amount: -250.0, to: 'External Account' }]
      };
    case 'missing_headers':
      return {
        status: 'online',
        server: 'Express/4.21.2 on Ubuntu 22.04 LTS',
        uptime: '14 days'
      };
    case 'unrestricted_resource':
      return {
        totalRecordsReturned: 1000000,
        warning: 'Query executed with no pagination limit. Database memory consumption elevated.'
      };
    case 'bfla':
      return {
        success: true,
        message: 'Administrative privileges granted to user_123. Role upgraded to superadmin without authorization check.'
      };
    default:
      return { status: 'vulnerable_demo' };
  }
}

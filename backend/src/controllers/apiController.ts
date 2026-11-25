import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Api } from '../models/Api';
import { MonitoringConfig } from '../models/Monitoring';
import { Scan } from '../models/Scan';
import { Finding } from '../models/Finding';
import { encryptCredentials } from '../utils/crypto';
import { validateTargetUrl } from '../utils/ssrf';
import { parseOpenApiSpec } from '../services/openapiParser';
import { postmanService } from '../services/postmanService';
import axios from 'axios';

export async function listApis(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const apis = await Api.find({ createdBy: req.user!._id }).sort({ createdAt: -1 });

    const sanitized = apis.map((api) => ({
      id: api._id,
      name: api.name,
      baseUrl: api.baseUrl,
      description: api.description,
      environment: api.environment,
      authType: api.authType,
      endpointCount: api.endpoints.length,
      isLabApi: api.isLabApi,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt
    }));

    res.json({ success: true, count: sanitized.length, apis: sanitized });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list APIs' });
  }
}

export async function getApiById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const api = await Api.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!api) {
      res.status(404).json({ success: false, message: 'API not found' });
      return;
    }

    res.json({
      success: true,
      api: {
        id: api._id,
        name: api.name,
        baseUrl: api.baseUrl,
        description: api.description,
        environment: api.environment,
        authType: api.authType,
        endpoints: api.endpoints,
        isLabApi: api.isLabApi,
        hasAuthCredentials: !!(
          api.authConfig?.tokenEncrypted ||
          api.authConfig?.apiKeyEncrypted ||
          api.authConfig?.passwordEncrypted
        ),
        createdAt: api.createdAt,
        updatedAt: api.updatedAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to get API' });
  }
}

export async function createApi(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      name,
      baseUrl,
      description,
      environment = 'development',
      authType = 'none',
      credentials = {},
      endpoints = [],
      openapiSpec,
      isLabApi = false
    } = req.body;

    if (!name || !baseUrl) {
      res.status(400).json({ success: false, message: 'Name and Base URL are required.' });
      return;
    }

    // SSRF Check
    const ssrf = validateTargetUrl(baseUrl, { allowLocalLab: isLabApi });
    if (!ssrf.isValid) {
      res.status(400).json({ success: false, message: `SSRF validation failed: ${ssrf.reason}` });
      return;
    }

    // Encrypt sensitive auth config
    const authConfig: any = {};
    if (authType === 'bearer' && credentials.token) {
      authConfig.tokenEncrypted = encryptCredentials(credentials.token);
    } else if (authType === 'apiKey' && credentials.apiKey) {
      authConfig.apiKeyHeader = credentials.apiKeyHeader || 'X-API-Key';
      authConfig.apiKeyEncrypted = encryptCredentials(credentials.apiKey);
    } else if (authType === 'basic' && credentials.username && credentials.password) {
      authConfig.username = credentials.username;
      authConfig.passwordEncrypted = encryptCredentials(credentials.password);
    }

    let parsedEndpoints = endpoints;
    if (openapiSpec) {
      try {
        const parsed = parseOpenApiSpec(openapiSpec);
        parsedEndpoints = parsed.endpoints;
      } catch (e: any) {
        console.warn('OpenAPI parse error during API creation:', e.message);
      }
    }

    const newApi = new Api({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      description: description || '',
      environment,
      authType,
      authConfig,
      endpoints: parsedEndpoints,
      openapiSpecRaw: openapiSpec,
      isLabApi: !!isLabApi,
      createdBy: req.user!._id
    });

    await newApi.save();

    // Auto-create initial MonitoringConfig
    const monitoring = new MonitoringConfig({
      apiId: newApi._id,
      createdBy: req.user!._id,
      isEnabled: true,
      intervalMinutes: 5,
      currentStatus: 'unmonitored'
    });
    await monitoring.save();

    res.status(201).json({
      success: true,
      message: 'API registered successfully',
      api: {
        id: newApi._id,
        name: newApi.name,
        baseUrl: newApi.baseUrl,
        environment: newApi.environment,
        authType: newApi.authType,
        endpointCount: newApi.endpoints.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create API' });
  }
}

export async function updateApi(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const api = await Api.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!api) {
      res.status(404).json({ success: false, message: 'API not found' });
      return;
    }

    const { name, baseUrl, description, environment, authType, credentials, endpoints } = req.body;

    if (name) api.name = name.trim();
    if (baseUrl) {
      const ssrf = validateTargetUrl(baseUrl, { allowLocalLab: api.isLabApi });
      if (!ssrf.isValid) {
        res.status(400).json({ success: false, message: `SSRF validation failed: ${ssrf.reason}` });
        return;
      }
      api.baseUrl = baseUrl.trim();
    }
    if (description !== undefined) api.description = description;
    if (environment) api.environment = environment;
    if (authType) api.authType = authType;

    if (credentials) {
      if (api.authType === 'bearer' && credentials.token) {
        api.authConfig = { ...api.authConfig, tokenEncrypted: encryptCredentials(credentials.token) };
      } else if (api.authType === 'apiKey' && credentials.apiKey) {
        api.authConfig = {
          ...api.authConfig,
          apiKeyHeader: credentials.apiKeyHeader || 'X-API-Key',
          apiKeyEncrypted: encryptCredentials(credentials.apiKey)
        };
      } else if (api.authType === 'basic' && credentials.username && credentials.password) {
        api.authConfig = {
          ...api.authConfig,
          username: credentials.username,
          passwordEncrypted: encryptCredentials(credentials.password)
        };
      }
    }

    if (Array.isArray(endpoints)) {
      api.endpoints = endpoints;
    }

    await api.save();

    res.json({
      success: true,
      message: 'API updated successfully',
      api: {
        id: api._id,
        name: api.name,
        baseUrl: api.baseUrl,
        environment: api.environment,
        authType: api.authType,
        endpointCount: api.endpoints.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update API' });
  }
}

export async function deleteApi(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const api = await Api.findOneAndDelete({ _id: req.params.id, createdBy: req.user!._id });
    if (!api) {
      res.status(404).json({ success: false, message: 'API not found' });
      return;
    }

    // Cascade delete scans, findings, and monitoring
    await Promise.all([
      Scan.deleteMany({ apiId: api._id }),
      Finding.deleteMany({ apiId: api._id }),
      MonitoringConfig.deleteMany({ apiId: api._id })
    ]);

    res.json({ success: true, message: 'API and associated data deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete API' });
  }
}

export async function importOpenApi(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let rawSpec = req.body.specContent;
    const specUrl = req.body.specUrl;

    if (!rawSpec && specUrl) {
      const ssrf = validateTargetUrl(specUrl, { allowLocalLab: false });
      if (!ssrf.isValid) {
        res.status(400).json({ success: false, message: `Cannot fetch spec from URL: ${ssrf.reason}` });
        return;
      }
      const response = await axios.get(specUrl, { timeout: 10000 });
      rawSpec = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    }

    if (!rawSpec) {
      res.status(400).json({ success: false, message: 'Either specContent or specUrl is required.' });
      return;
    }

    const parsed = parseOpenApiSpec(rawSpec);
    res.json({
      success: true,
      message: `Parsed ${parsed.endpoints.length} endpoints successfully`,
      data: parsed
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to parse OpenAPI specification' });
  }
}

export async function exportApiAsPostman(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const api = await Api.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!api) {
      res.status(404).json({ success: false, message: 'API not found' });
      return;
    }

    const collection = postmanService.generateApiCollection(api);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${api.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_postman_collection.json"`);
    res.json(collection);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to export API as Postman collection' });
  }
}

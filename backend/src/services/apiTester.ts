import axios, { AxiosRequestConfig, Method } from 'axios';
import { validateTargetUrl } from '../utils/ssrf';
import { decryptCredentials } from '../utils/crypto';
import { IApi } from '../models/Api';

export interface ExecuteRequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
  allowLocalLab?: boolean;
  apiConfig?: IApi;
}

export interface ExecuteResponseResult {
  status: number;
  statusText: string;
  headers: Record<string, any>;
  data: any;
  durationMs: number;
  sizeBytes: number;
  isError: boolean;
  errorMessage?: string;
  requestHeadersSent: Record<string, any>;
}

export async function executeRealRequest(options: ExecuteRequestOptions): Promise<ExecuteResponseResult> {
  const {
    url,
    method = 'GET',
    headers = {},
    params = {},
    data,
    timeout = 10000,
    allowLocalLab = false,
    apiConfig
  } = options;

  // SSRF Protection check
  const ssrfCheck = validateTargetUrl(url, { allowLocalLab });
  if (!ssrfCheck.isValid) {
    throw new Error(`SSRF Blocked: ${ssrfCheck.reason}`);
  }

  const finalHeaders: Record<string, string> = { ...headers };

  // Inject authentication credentials if API configuration is provided
  if (apiConfig && apiConfig.authType !== 'none') {
    if (apiConfig.authType === 'bearer' && apiConfig.authConfig?.tokenEncrypted) {
      const token = decryptCredentials(apiConfig.authConfig.tokenEncrypted);
      if (token && !finalHeaders['Authorization'] && !finalHeaders['authorization']) {
        finalHeaders['Authorization'] = `Bearer ${token}`;
      }
    } else if (apiConfig.authType === 'apiKey' && apiConfig.authConfig?.apiKeyEncrypted) {
      const apiKey = decryptCredentials(apiConfig.authConfig.apiKeyEncrypted);
      const headerName = apiConfig.authConfig.apiKeyHeader || 'X-API-Key';
      if (apiKey && !finalHeaders[headerName]) {
        finalHeaders[headerName] = apiKey;
      }
    } else if (apiConfig.authType === 'basic' && apiConfig.authConfig?.username && apiConfig.authConfig?.passwordEncrypted) {
      const password = decryptCredentials(apiConfig.authConfig.passwordEncrypted);
      const credentials = Buffer.from(`${apiConfig.authConfig.username}:${password}`).toString('base64');
      if (!finalHeaders['Authorization'] && !finalHeaders['authorization']) {
        finalHeaders['Authorization'] = `Basic ${credentials}`;
      }
    }
  }

  const startTime = Date.now();
  const axiosConfig: AxiosRequestConfig = {
    url,
    method: method.toUpperCase() as Method,
    headers: finalHeaders,
    params,
    data,
    timeout,
    maxContentLength: 5 * 1024 * 1024, // 5MB limit
    maxBodyLength: 5 * 1024 * 1024,
    validateStatus: () => true // Allow all status codes (2xx, 4xx, 5xx) to be inspected
  };

  try {
    const response = await axios(axiosConfig);
    const durationMs = Date.now() - startTime;
    
    // Estimate size
    let sizeBytes = 0;
    if (response.data) {
      if (typeof response.data === 'string') {
        sizeBytes = Buffer.byteLength(response.data);
      } else {
        sizeBytes = Buffer.byteLength(JSON.stringify(response.data));
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, any>,
      data: response.data,
      durationMs,
      sizeBytes,
      isError: response.status >= 400,
      requestHeadersSent: finalHeaders
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      status: err.response?.status || 0,
      statusText: err.response?.statusText || 'Connection Error',
      headers: err.response?.headers || {},
      data: err.response?.data || { error: err.message },
      durationMs,
      sizeBytes: 0,
      isError: true,
      errorMessage: err.message || 'Request failed',
      requestHeadersSent: finalHeaders
    };
  }
}

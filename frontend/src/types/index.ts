export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required: boolean;
    type?: string;
    description?: string;
  }>;
  requestBodySchema?: any;
  responseSchema?: any;
  authRequired?: boolean;
}

export interface ApiItem {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  environment: 'development' | 'staging' | 'production' | 'testing';
  authType: 'none' | 'bearer' | 'apiKey' | 'basic';
  endpointCount: number;
  endpoints?: Endpoint[];
  hasAuthCredentials?: boolean;
  isLabApi: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Finding {
  _id: string;
  scanId: any;
  apiId: any;
  title: string;
  owaspCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  endpoint: string;
  method: string;
  evidence: {
    requestUrl?: string;
    requestMethod?: string;
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseSnippet?: string;
    details?: string;
  };
  explanation: string;
  potentialImpact: string;
  remediation: string;
  confidence: 'confirmed' | 'probable' | 'potential';
  status: 'open' | 'resolved' | 'false_positive';
  isSimulation: boolean;
  createdAt: string;
}

export interface ScanItem {
  _id: string;
  apiId: any;
  scanType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  isSimulation: boolean;
  targetBaseUrl: string;
  endpointsTested: number;
  durationMs: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  findingsCount: number;
  logs: string[];
  createdAt: string;
}

export interface MonitoringCheck {
  timestamp: string;
  statusCode: number;
  responseTimeMs: number;
  isHealthy: boolean;
  errorMessage?: string;
}

export interface MonitoringItem {
  _id: string;
  apiId: any;
  isEnabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  latencyThresholdMs: number;
  lastChecked?: string;
  currentStatus: 'healthy' | 'degraded' | 'down' | 'unmonitored';
  uptimePercentage: number;
  averageResponseTimeMs: number;
  history: MonitoringCheck[];
  createdAt: string;
}

export interface DashboardStats {
  totalApis: number;
  totalScans: number;
  totalFindings: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  owaspBreakdown: Record<string, number>;
  healthDistribution: {
    healthy: number;
    degraded: number;
    down: number;
    unmonitored: number;
  };
  averageUptime: number;
  averageResponseTimeMs: number;
  recentScans: ScanItem[];
  recentFindings: Finding[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  owaspCategory: string;
  severity: string;
  method: string;
  path: string;
  description: string;
  payload: any;
  attackExplanation: string;
  remediation: string;
}

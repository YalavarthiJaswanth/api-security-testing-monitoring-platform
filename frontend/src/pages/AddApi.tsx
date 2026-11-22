import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Header } from '../components/Header';
import { Endpoint } from '../types';
import {
  Server,
  FileCode2,
  Key,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  Globe
} from 'lucide-react';

export const AddApi: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production' | 'testing'>('development');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'apiKey' | 'basic'>('none');
  
  // Credentials
  const [bearerToken, setBearerToken] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

  // OpenAPI Spec
  const [specUrl, setSpecUrl] = useState('');
  const [specContent, setSpecContent] = useState('');
  const [parsedEndpoints, setParsedEndpoints] = useState<Endpoint[]>([]);
  const [parsingSpec, setParsingSpec] = useState(false);
  const [specFeedback, setSpecFeedback] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preset quick fill
  const fillPreset = (type: 'jsonplaceholder' | 'vulnerable_lab') => {
    if (type === 'jsonplaceholder') {
      setName('JSONPlaceholder Public API');
      setBaseUrl('https://jsonplaceholder.typicode.com');
      setDescription('Free fake and real REST API for testing and prototyping.');
      setEnvironment('testing');
      setAuthType('none');
      setParsedEndpoints([
        { path: '/posts', method: 'GET', summary: 'Get all posts' },
        { path: '/posts/1', method: 'GET', summary: 'Get single post by ID' },
        { path: '/posts', method: 'POST', summary: 'Create new post' },
        { path: '/users', method: 'GET', summary: 'Get all users' },
        { path: '/comments', method: 'GET', summary: 'Get all comments' }
      ]);
    } else {
      setName('API Sentinel Vulnerable Lab');
      setBaseUrl('http://localhost:5050');
      setDescription('Local vulnerable demonstration container for OWASP API Security testing.');
      setEnvironment('testing');
      setAuthType('none');
      setParsedEndpoints([
        { path: '/api/v1/lab/users/:id', method: 'GET', summary: 'BOLA endpoint' },
        { path: '/api/v1/lab/auth/reset-password', method: 'POST', summary: 'Broken password reset' },
        { path: '/api/v1/lab/accounts/profile', method: 'GET', summary: 'Excessive data exposure' },
        { path: '/api/v1/lab/data/export', method: 'GET', summary: 'Weak CORS test' },
        { path: '/api/v1/lab/public/info', method: 'GET', summary: 'Missing headers' },
        { path: '/api/v1/lab/orders', method: 'GET', summary: 'Resource consumption' },
        { path: '/api/v1/lab/admin/users/grant-admin', method: 'POST', summary: 'BFLA escalation' }
      ]);
    }
  };

  const handleParseSpec = async () => {
    if (!specContent && !specUrl) {
      setSpecFeedback('Please provide either an OpenAPI specification URL or raw JSON/YAML content.');
      return;
    }
    setParsingSpec(true);
    setSpecFeedback(null);
    try {
      const resp = await api.post('/apis/import-openapi', {
        specUrl: specUrl || undefined,
        specContent: specContent || undefined
      });
      const data = resp.data.data;
      if (data.endpoints && data.endpoints.length > 0) {
        setParsedEndpoints(data.endpoints);
        if (data.baseUrl && !baseUrl) {
          setBaseUrl(data.baseUrl);
        }
        if (data.title && !name) {
          setName(data.title);
        }
        setSpecFeedback(`Successfully parsed ${data.endpoints.length} documented endpoints!`);
      } else {
        setSpecFeedback('Specification parsed but 0 endpoints were identified in paths.');
      }
    } catch (err: any) {
      setSpecFeedback(err.response?.data?.message || 'Failed to parse specification.');
    } finally {
      setParsingSpec(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setSpecContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const credentials: any = {};
      if (authType === 'bearer') {
        credentials.token = bearerToken;
      } else if (authType === 'apiKey') {
        credentials.apiKeyHeader = apiKeyHeader;
        credentials.apiKey = apiKeyValue;
      } else if (authType === 'basic') {
        credentials.username = basicUsername;
        credentials.password = basicPassword;
      }

      await api.post('/apis', {
        name,
        baseUrl,
        description,
        environment,
        authType,
        credentials,
        endpoints: parsedEndpoints,
        openapiSpec: specContent || undefined,
        isLabApi: baseUrl.includes(':5050') || baseUrl.includes('vulnerable-lab')
      });

      navigate('/inventory');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register API target.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Register New API Target"
        subtitle="Configure target API base, authentication credentials, and import OpenAPI schemas"
      />

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Preset quick buttons */}
        <div className="p-4 rounded-xl bg-[#0c1222] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">Quick-Start Test Presets:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fillPreset('jsonplaceholder')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-200 hover:text-cyan-400 transition-colors font-mono"
            >
              JSONPlaceholder (Public Real API)
            </button>
            <button
              type="button"
              onClick={() => fillPreset('vulnerable_lab')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-500 text-slate-200 hover:text-purple-400 transition-colors font-mono"
            >
              Vulnerable Lab (Local Port 5050)
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Primary Details */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 tracking-wide uppercase border-b border-slate-800 pb-3">
              <Server className="w-4 h-4 text-cyan-400" />
              General API Configuration
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  API Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Core Payment Gateway"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Base URL *
                </label>
                <input
                  type="url"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Protected by SSRF guard: RFC1918 private ranges & cloud metadata are automatically blocked.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                  <option value="testing">Testing / Lab</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of API scope"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Authentication Credentials */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100 tracking-wide uppercase">
                <Key className="w-4 h-4 text-cyan-400" />
                Authentication & Credentials
              </div>
              <span className="text-[11px] text-cyan-400 font-mono flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> AES-256-GCM Encrypted
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Authentication Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'none', label: 'No Authentication' },
                  { id: 'bearer', label: 'Bearer Token' },
                  { id: 'apiKey', label: 'API Key' },
                  { id: 'basic', label: 'Basic Auth' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAuthType(t.id as any)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      authType === t.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {authType === 'bearer' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bearer Token</label>
                <input
                  type="password"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {authType === 'apiKey' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Header Name</label>
                  <input
                    type="text"
                    value={apiKeyHeader}
                    onChange={(e) => setApiKeyHeader(e.target.value)}
                    placeholder="X-API-Key"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">API Key Value</label>
                  <input
                    type="password"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="sec_live_..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    placeholder="admin_user"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 3: OpenAPI / Swagger Specification Importer */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100 tracking-wide uppercase">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                OpenAPI / Swagger Endpoint Discovery
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Swagger 2.0 / OpenAPI 3.0</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Specification URL (Optional)
                </label>
                <input
                  type="url"
                  value={specUrl}
                  onChange={(e) => setSpecUrl(e.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Upload Specification File
                </label>
                <label className="flex items-center justify-center gap-2 w-full bg-slate-900 border border-slate-800 border-dashed rounded-lg px-3.5 py-2 text-xs text-slate-300 hover:border-cyan-500 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Choose JSON or YAML file</span>
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Paste Specification JSON or YAML Content
              </label>
              <textarea
                rows={4}
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                placeholder='{"openapi": "3.0.0", "paths": { "/api/v1/users": { "get": {} } } }'
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleParseSpec}
                disabled={parsingSpec}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                {parsingSpec ? 'Parsing Spec...' : 'Parse & Extract Endpoints'}
              </button>

              {specFeedback && (
                <span className="text-xs text-cyan-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {specFeedback}
                </span>
              )}
            </div>

            {/* Discovered Endpoints Table Preview */}
            {parsedEndpoints.length > 0 && (
              <div className="mt-4 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
                <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Discovered Endpoints ({parsedEndpoints.length})</span>
                  <span className="text-[11px] text-cyan-400 font-mono">Will be registered</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60">
                  {parsedEndpoints.map((ep, idx) => (
                    <div key={idx} className="p-2.5 text-xs font-mono flex items-center justify-between hover:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ep.method === 'GET' ? 'bg-sky-500/20 text-sky-400' :
                          ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' :
                          ep.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                          ep.method === 'DELETE' ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {ep.method}
                        </span>
                        <span className="text-slate-200">{ep.path}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans truncate max-w-xs">{ep.summary || 'Documented route'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Registering API...' : 'Register API Target'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

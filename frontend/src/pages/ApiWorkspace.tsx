import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ApiItem, Endpoint } from '../types';
import { Header } from '../components/Header';
import {
  Terminal,
  Send,
  Clock,
  HardDrive,
  Copy,
  Check,
  ChevronDown,
  AlertCircle,
  FileJson,
  Layers,
  ShieldAlert
} from 'lucide-react';

export const ApiWorkspace: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialApiId = searchParams.get('apiId') || '';

  const [apis, setApis] = useState<ApiItem[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>(initialApiId);
  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);

  // Request state
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [url, setUrl] = useState<string>('https://jsonplaceholder.typicode.com/posts/1');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');

  // Key-Value editors
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' }
  ]);
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Accept', value: 'application/json' },
    { key: '', value: '' }
  ]);
  const [requestBody, setRequestBody] = useState<string>('{\n  "title": "API Sentinel Security Test",\n  "body": "Verifying real HTTP proxy engine",\n  "userId": 1\n}');

  // Auth override in workspace
  const [authOverrideType, setAuthOverrideType] = useState<'inherit' | 'bearer' | 'apiKey' | 'none'>('inherit');
  const [authCustomToken, setAuthCustomToken] = useState<string>('');

  // Execution state & response
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [responseResult, setResponseResult] = useState<any>(null);
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch available APIs
  useEffect(() => {
    const loadApis = async () => {
      try {
        const resp = await api.get('/apis');
        setApis(resp.data.apis || []);
      } catch (err) {
        console.error('Failed to load APIs:', err);
      }
    };
    loadApis();
  }, []);

  // When API selection changes, update baseUrl and endpoints
  useEffect(() => {
    if (selectedApiId) {
      const loadApiDetails = async () => {
        try {
          const resp = await api.get(`/apis/${selectedApiId}`);
          const detailed = resp.data.api;
          setSelectedApi(detailed);
          if (detailed.baseUrl) {
            const firstEp = detailed.endpoints && detailed.endpoints.length > 0 ? detailed.endpoints[0].path : '';
            setUrl(`${detailed.baseUrl.replace(/\/$/, '')}${firstEp.startsWith('/') ? firstEp : '/' + firstEp}`);
            if (detailed.endpoints && detailed.endpoints.length > 0) {
              setMethod(detailed.endpoints[0].method as any);
            }
          }
        } catch (err) {
          console.error('Failed to load single API details:', err);
        }
      };
      loadApiDetails();
    } else {
      setSelectedApi(null);
    }
  }, [selectedApiId]);

  const handleSelectEndpoint = (ep: Endpoint) => {
    if (!selectedApi) return;
    setMethod(ep.method as any);
    setUrl(`${selectedApi.baseUrl.replace(/\/$/, '')}${ep.path.startsWith('/') ? ep.path : '/' + ep.path}`);
  };

  const handleSend = async () => {
    if (!url) return;
    setIsExecuting(true);
    setErrorMessage(null);
    setResponseResult(null);

    try {
      // Build query params map
      const paramsObj: Record<string, string> = {};
      queryParams.forEach((p) => {
        if (p.key.trim()) paramsObj[p.key.trim()] = p.value;
      });

      // Build headers map
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value;
      });

      if (authOverrideType === 'bearer' && authCustomToken) {
        headersObj['Authorization'] = `Bearer ${authCustomToken}`;
      }

      // Parse JSON body if present
      let parsedBody = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody.trim()) {
        try {
          parsedBody = JSON.parse(requestBody);
          headersObj['Content-Type'] = 'application/json';
        } catch {
          parsedBody = requestBody;
        }
      }

      const resp = await api.post('/test/execute', {
        url,
        method,
        headers: headersObj,
        params: paramsObj,
        body: parsedBody,
        apiId: selectedApiId || undefined
      });

      setResponseResult(resp.data.result);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Request execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResponse = () => {
    if (responseResult?.data) {
      navigator.clipboard.writeText(
        typeof responseResult.data === 'string'
          ? responseResult.data
          : JSON.stringify(responseResult.data, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '' }]);
  const updateQueryParam = (index: number, field: 'key' | 'value', val: string) => {
    const copy = [...queryParams];
    copy[index][field] = val;
    setQueryParams(copy);
  };
  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const copy = [...headers];
    copy[index][field] = val;
    setHeaders(copy);
  };
  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="API Testing Workspace"
        subtitle="Interactive HTTP console with live proxy execution, SSRF defenses, and response introspection"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={selectedApiId}
              onChange={(e) => setSelectedApiId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="">-- Direct URL / Ad-Hoc Target --</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.environment})
                </option>
              ))}
            </select>
          </div>
        }
      />

      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Discovered Endpoints sidebar if an API is selected (3 cols) */}
        {selectedApi && selectedApi.endpoints && selectedApi.endpoints.length > 0 && (
          <div className="xl:col-span-3 bg-[#0c1222] border border-slate-800 rounded-xl p-4 flex flex-col h-[calc(100vh-140px)]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Endpoints ({selectedApi.endpoints.length})
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">OpenAPI</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {selectedApi.endpoints.map((ep, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectEndpoint(ep)}
                  className="w-full text-left p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/30 transition-all group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                        ep.method === 'GET' ? 'bg-sky-500/20 text-sky-400' :
                        ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' :
                        ep.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                        ep.method === 'DELETE' ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs font-mono text-slate-300 truncate">{ep.path}</span>
                  </div>
                  {ep.summary && <p className="text-[11px] text-slate-400 truncate">{ep.summary}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Column: Request & Response Workspace */}
        <div className={`${selectedApi && selectedApi.endpoints && selectedApi.endpoints.length > 0 ? 'xl:col-span-9' : 'xl:col-span-12'} space-y-5`}>
          {/* URL & Method Bar */}
          <div className="p-3 bg-[#0c1222] border border-slate-800 rounded-xl flex items-center gap-2 shadow-lg">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs font-bold text-cyan-400 rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>

            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/v1/endpoint"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={isExecuting || !url}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Request</span>
                </>
              )}
            </button>
          </div>

          {/* Request Sub-tabs (Params, Headers, Body, Auth) */}
          <div className="bg-[#0c1222] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-3 mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('params')}
                className={`transition-colors ${activeTab === 'params' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-3 -mb-3' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Query Params ({queryParams.filter((p) => p.key).length})
              </button>
              <button
                onClick={() => setActiveTab('headers')}
                className={`transition-colors ${activeTab === 'headers' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-3 -mb-3' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Headers ({headers.filter((h) => h.key).length})
              </button>
              <button
                onClick={() => setActiveTab('body')}
                className={`transition-colors ${activeTab === 'body' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-3 -mb-3' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Request Body {['POST', 'PUT', 'PATCH'].includes(method) ? '(Active)' : ''}
              </button>
              <button
                onClick={() => setActiveTab('auth')}
                className={`transition-colors ${activeTab === 'auth' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-3 -mb-3' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Authentication
              </button>
            </div>

            {/* Tab 1: Params Editor */}
            {activeTab === 'params' && (
              <div className="space-y-2">
                {queryParams.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Key (e.g. limit)"
                      value={p.key}
                      onChange={(e) => updateQueryParam(i, 'key', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. 10)"
                      value={p.value}
                      onChange={(e) => updateQueryParam(i, 'value', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => removeQueryParam(i)}
                      className="text-slate-500 hover:text-rose-400 px-2 py-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addQueryParam}
                  className="text-xs text-cyan-400 hover:underline font-mono mt-1"
                >
                  + Add Parameter
                </button>
              </div>
            )}

            {/* Tab 2: Headers Editor */}
            {activeTab === 'headers' && (
              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Header Name"
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="Header Value"
                      value={h.value}
                      onChange={(e) => updateHeader(i, 'value', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => removeHeader(i)}
                      className="text-slate-500 hover:text-rose-400 px-2 py-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addHeader}
                  className="text-xs text-cyan-400 hover:underline font-mono mt-1"
                >
                  + Add Header
                </button>
              </div>
            )}

            {/* Tab 3: Body Editor */}
            {activeTab === 'body' && (
              <div>
                <textarea
                  rows={6}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{\n  "key": "value"\n}'
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Tab 4: Auth */}
            {activeTab === 'auth' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-4">
                  <label className="text-slate-400">Mode:</label>
                  <label className="flex items-center gap-1.5 text-slate-200">
                    <input
                      type="radio"
                      name="authMode"
                      checked={authOverrideType === 'inherit'}
                      onChange={() => setAuthOverrideType('inherit')}
                    />
                    Inherit from registered API
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-200">
                    <input
                      type="radio"
                      name="authMode"
                      checked={authOverrideType === 'bearer'}
                      onChange={() => setAuthOverrideType('bearer')}
                    />
                    Bearer Token
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-200">
                    <input
                      type="radio"
                      name="authMode"
                      checked={authOverrideType === 'none'}
                      onChange={() => setAuthOverrideType('none')}
                    />
                    No Auth
                  </label>
                </div>

                {authOverrideType === 'bearer' && (
                  <input
                    type="password"
                    placeholder="Enter Bearer Token for this request"
                    value={authCustomToken}
                    onChange={(e) => setAuthCustomToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>
            )}
          </div>

          {/* Response Inspection Card */}
          <div className="bg-[#0c1222] border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Response Inspector
                </span>

                {responseResult && (
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        responseResult.status >= 200 && responseResult.status < 300
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : responseResult.status >= 400
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {responseResult.status} {responseResult.statusText}
                    </span>

                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {responseResult.durationMs} ms
                    </span>

                    <span className="text-slate-400 flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      {(responseResult.sizeBytes / 1024).toFixed(2)} KB
                    </span>
                  </div>
                )}
              </div>

              {responseResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setResponseTab('body')}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      responseTab === 'body' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Body
                  </button>
                  <button
                    onClick={() => setResponseTab('headers')}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      responseTab === 'headers' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Headers ({Object.keys(responseResult.headers || {}).length})
                  </button>
                  <button
                    onClick={copyResponse}
                    title="Copy response body"
                    className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!responseResult && !errorMessage && (
              <div className="py-16 text-center text-slate-600 text-xs font-mono">
                Click "Send Request" to execute real HTTP request through API Sentinel proxy engine.
              </div>
            )}

            {responseResult && responseTab === 'body' && (
              <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto max-h-96 border border-slate-900 font-mono text-xs text-slate-200">
                <pre>
                  {typeof responseResult.data === 'string'
                    ? responseResult.data
                    : JSON.stringify(responseResult.data, null, 2)}
                </pre>
              </div>
            )}

            {responseResult && responseTab === 'headers' && (
              <div className="bg-slate-950 rounded-lg overflow-x-auto max-h-96 border border-slate-900 font-mono text-xs">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-900">
                    {Object.keys(responseResult.headers || {}).map((headerKey) => (
                      <tr key={headerKey}>
                        <td className="px-4 py-2 font-semibold text-cyan-400 w-1/3">{headerKey}</td>
                        <td className="px-4 py-2 text-slate-300 break-all">{responseResult.headers[headerKey]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ApiItem } from '../types';
import { Header } from '../components/Header';
import {
  Server,
  PlusCircle,
  Terminal,
  SearchCode,
  Activity,
  Trash2,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';

export const ApiInventory: React.FC = () => {
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchApis = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/apis');
      setApis(resp.data.apis || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch API inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApis();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? All associated scans, findings, and monitoring will be removed.`)) {
      return;
    }
    try {
      await api.delete(`/apis/${id}`);
      setApis(apis.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete API');
    }
  };

  const getEnvBadge = (env: string) => {
    const config: Record<string, { bg: string; text: string; border: string }> = {
      production: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
      staging: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
      development: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
      testing: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }
    };
    const c = config[env.toLowerCase()] || config.development;
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${c.bg} ${c.text} ${c.border}`}>
        {env}
      </span>
    );
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="API Inventory & Assets"
        subtitle="Manage registered API services, schemas, authentication configs, and target scopes"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchApis}
              title="Refresh Inventory"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              to="/apis/new"
              className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              Add New API
            </Link>
          </div>
        }
      />

      <main className="flex-1 p-8 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm font-mono animate-pulse">
            Loading API inventory from database...
          </div>
        ) : apis.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#0c1222] border border-slate-800 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center mb-4">
              <Server className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">No APIs Registered Yet</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">
              Register your first API endpoint manually or import an OpenAPI/Swagger JSON/YAML specification to begin security testing and continuous monitoring.
            </p>
            <Link
              to="/apis/new"
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              Register New API Target
            </Link>
          </div>
        ) : (
          <div className="bg-[#0c1222] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090e1a] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">API Name & Target Base</th>
                    <th className="px-4 py-4">Environment</th>
                    <th className="px-4 py-4">Authentication</th>
                    <th className="px-4 py-4">Endpoints</th>
                    <th className="px-4 py-4">Registered Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {apis.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              {item.name}
                              {item.isLabApi && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 text-[10px] border border-purple-500/30">
                                  SIMULATION LAB
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                              {item.baseUrl}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {getEnvBadge(item.environment)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                          <Shield className="w-3 h-3 text-cyan-400" />
                          {item.authType.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-slate-300 font-mono">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          {item.endpointCount} routes
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-400 font-mono">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right space-x-1">
                        <button
                          onClick={() => navigate(`/workspace?apiId=${item.id}`)}
                          title="Interactive Postman-style Workspace"
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          Test
                        </button>

                        <button
                          onClick={() => navigate(`/scanner?apiId=${item.id}`)}
                          title="Run OWASP Security Scan"
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded font-medium text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <SearchCode className="w-3.5 h-3.5" />
                          Scan
                        </button>

                        <button
                          onClick={() => navigate(`/monitoring`)}
                          title="Monitor Health"
                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-medium text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          title="Delete API"
                          className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs inline-flex items-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

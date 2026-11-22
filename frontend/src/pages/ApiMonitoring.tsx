import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { MonitoringItem } from '../types';
import { Header } from '../components/Header';
import {
  Activity,
  Server,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Settings,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export const ApiMonitoring: React.FC = () => {
  const [configs, setConfigs] = useState<MonitoringItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConfig, setSelectedConfig] = useState<MonitoringItem | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);

  // Edit config modal
  const [editingConfig, setEditingConfig] = useState<MonitoringItem | null>(null);
  const [editInterval, setEditInterval] = useState<number>(5);
  const [editThreshold, setEditThreshold] = useState<number>(1000);
  const [editEnabled, setEditEnabled] = useState<boolean>(true);

  const fetchMonitoring = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/monitoring');
      const items: MonitoringItem[] = resp.data.configs || [];
      setConfigs(items);
      if (items.length > 0 && !selectedConfig) {
        setSelectedConfig(items[0]);
      } else if (selectedConfig) {
        const updated = items.find((i) => i._id === selectedConfig._id);
        if (updated) setSelectedConfig(updated);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring();
  }, []);

  const handleManualPing = async (id: string) => {
    setPingingId(id);
    try {
      const resp = await api.post(`/monitoring/${id}/ping`);
      const updatedItem: MonitoringItem = resp.data.config;
      setConfigs(configs.map((c) => (c._id === id ? updatedItem : c)));
      if (selectedConfig && selectedConfig._id === id) {
        setSelectedConfig(updatedItem);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Manual ping probe failed');
    } finally {
      setPingingId(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    try {
      const resp = await api.put(`/monitoring/${editingConfig._id}`, {
        isEnabled: editEnabled,
        intervalMinutes: editInterval,
        latencyThresholdMs: editThreshold
      });

      const updated = resp.data.config;
      setConfigs(configs.map((c) => (c._id === updated._id ? updated : c)));
      if (selectedConfig && selectedConfig._id === updated._id) {
        setSelectedConfig(updated);
      }
      setEditingConfig(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update monitoring config');
    }
  };

  const openEditModal = (item: MonitoringItem) => {
    setEditingConfig(item);
    setEditInterval(item.intervalMinutes);
    setEditThreshold(item.latencyThresholdMs);
    setEditEnabled(item.isEnabled);
  };

  // Format latency chart data from history
  const chartData = (selectedConfig?.history || []).map((h, idx) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    latency: h.responseTimeMs,
    status: h.statusCode,
    healthy: h.isHealthy
  }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            HEALTHY
          </span>
        );
      case 'degraded':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            DEGRADED
          </span>
        );
      case 'down':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            DOWN
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
            UNMONITORED
          </span>
        );
    }
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Real-Time API Monitoring"
        subtitle="Continuous synthetic availability probes, latency telemetry, and threshold tracking"
        actions={
          <button
            onClick={fetchMonitoring}
            title="Refresh Monitoring"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        }
      />

      <main className="flex-1 p-8 space-y-6">
        {configs.length === 0 && !loading ? (
          <div className="p-16 rounded-xl bg-[#0c1222] border border-slate-800 text-center max-w-md mx-auto">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-200">No Monitored APIs Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Register an API target to enable automated background availability and response time health checks.
            </p>
          </div>
        ) : (
          <>
            {/* Real-time Status Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Target Uptime</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-400 font-mono">
                  {selectedConfig ? `${selectedConfig.uptimePercentage}%` : '100%'}
                </div>
                <p className="text-xs text-slate-500 mt-2">Calculated over sliding window probe history</p>
              </div>

              <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Average Latency</span>
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-purple-400 font-mono">
                  {selectedConfig ? `${selectedConfig.averageResponseTimeMs} ms` : '0 ms'}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Threshold alert at &gt; {selectedConfig?.latencyThresholdMs || 1000} ms
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Health Classification</span>
                  <Server className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-1">
                  {selectedConfig ? getStatusBadge(selectedConfig.currentStatus) : '---'}
                </div>
                <p className="text-xs text-slate-500 mt-3 font-mono">
                  Last checked: {selectedConfig?.lastChecked ? new Date(selectedConfig.lastChecked).toLocaleTimeString() : 'Pending'}
                </p>
              </div>
            </div>

            {/* Latency History Chart for Selected API */}
            {selectedConfig && (
              <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Response Time Telemetry (ms) - {(selectedConfig.apiId as any)?.name || 'API Probe'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Target: {(selectedConfig.apiId as any)?.baseUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => handleManualPing(selectedConfig._id)}
                    disabled={pingingId === selectedConfig._id}
                    className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {pingingId === selectedConfig._id ? 'Pinging...' : 'Ping Now'}
                  </button>
                </div>

                {chartData.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
                    <p>No historical probe data collected yet.</p>
                    <button
                      onClick={() => handleManualPing(selectedConfig._id)}
                      className="text-cyan-400 underline mt-2"
                    >
                      Trigger first probe now
                    </button>
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                          formatter={(val: any) => [`${val} ms`, 'Response Time']}
                        />
                        <Area
                          type="monotone"
                          dataKey="latency"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#latencyGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Monitored APIs Table */}
            <div className="bg-[#0c1222] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 bg-[#090e1a] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  Active Monitoring Targets ({configs.length})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Continuous Ping Engine</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#090e1a]/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">API Target</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Uptime %</th>
                      <th className="px-4 py-3.5">Avg Response</th>
                      <th className="px-4 py-3.5">Interval</th>
                      <th className="px-4 py-3.5">Threshold</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {configs.map((item) => (
                      <tr
                        key={item._id}
                        onClick={() => setSelectedConfig(item)}
                        className={`hover:bg-slate-900/60 cursor-pointer transition-colors ${
                          selectedConfig?._id === item._id ? 'bg-slate-900/40 border-l-2 border-cyan-400' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-200">
                            {(item.apiId as any)?.name || 'Unnamed API'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                            {(item.apiId as any)?.baseUrl}
                          </p>
                        </td>

                        <td className="px-4 py-4">{getStatusBadge(item.currentStatus)}</td>

                        <td className="px-4 py-4 font-mono font-bold text-emerald-400">
                          {item.uptimePercentage}%
                        </td>

                        <td className="px-4 py-4 font-mono text-purple-400">
                          {item.averageResponseTimeMs} ms
                        </td>

                        <td className="px-4 py-4 font-mono text-slate-300">
                          Every {item.intervalMinutes} min
                        </td>

                        <td className="px-4 py-4 font-mono text-slate-400">
                          {item.latencyThresholdMs} ms
                        </td>

                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualPing(item._id);
                            }}
                            disabled={pingingId === item._id}
                            title="Ping now"
                            className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {pingingId === item._id ? 'Pinging...' : 'Ping'}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(item);
                            }}
                            title="Configure Settings"
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Configure Thresholds & Interval Modal */}
            {editingConfig && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                <div className="bg-[#0c1222] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Configure Monitoring Parameters
                    </h3>
                    <button
                      onClick={() => setEditingConfig(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Monitoring Interval (Minutes)
                      </label>
                      <select
                        value={editInterval}
                        onChange={(e) => setEditInterval(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value={1}>Every 1 Minute (High frequency)</option>
                        <option value={5}>Every 5 Minutes (Standard)</option>
                        <option value={15}>Every 15 Minutes</option>
                        <option value={60}>Every 1 Hour</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Latency Threshold (ms)
                      </label>
                      <input
                        type="number"
                        min={100}
                        max={10000}
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Probes taking longer than this will mark API status as "Degraded".
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="enableMon"
                        checked={editEnabled}
                        onChange={(e) => setEditEnabled(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <label htmlFor="enableMon" className="text-slate-200 font-medium">
                        Enable Automated Background Ping
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingConfig(null)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg shadow-md shadow-cyan-500/20"
                      >
                        Save Configuration
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

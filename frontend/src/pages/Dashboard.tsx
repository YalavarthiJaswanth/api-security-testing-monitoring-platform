import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats } from '../types';
import { Header } from '../components/Header';
import { SeverityBadge } from '../components/SeverityBadge';
import {
  Server,
  SearchCode,
  AlertTriangle,
  Flame,
  Activity,
  Clock,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/dashboard/stats');
      setStats(resp.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Format data for severity pie chart
  const severityChartData = stats
    ? [
        { name: 'Critical', value: stats.severityBreakdown.critical, color: '#ef4444' },
        { name: 'High', value: stats.severityBreakdown.high, color: '#f59e0b' },
        { name: 'Medium', value: stats.severityBreakdown.medium, color: '#eab308' },
        { name: 'Low', value: stats.severityBreakdown.low, color: '#0ea5e9' },
        { name: 'Info', value: stats.severityBreakdown.informational, color: '#8b5cf6' }
      ].filter((d) => d.value > 0)
    : [];

  // Format data for OWASP category bar chart
  const owaspChartData = stats
    ? Object.keys(stats.owaspBreakdown).map((cat) => ({
        category: cat.split(' - ')[0] || cat,
        fullName: cat,
        count: stats.owaspBreakdown[cat]
      }))
    : [];

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Security Operations Center"
        subtitle="Real-time API posture, vulnerability telemetry, and health monitoring"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              title="Refresh Telemetry"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              to="/apis/new"
              className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              Register API
            </Link>
          </div>
        }
      />

      <main className="flex-1 p-8 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchStats} className="underline text-xs">Retry</button>
          </div>
        )}

        {/* 8 Primary Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total APIs */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered APIs</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {loading ? '...' : stats?.totalApis || 0}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Inventory status</span>
              <Link to="/inventory" className="text-cyan-400 hover:underline flex items-center gap-0.5">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Total Scans */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Scans</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <SearchCode className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {loading ? '...' : stats?.totalScans || 0}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>OWASP Top 10 Audits</span>
              <Link to="/history" className="text-cyan-400 hover:underline flex items-center gap-0.5">
                History <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Vulnerabilities Detected */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Findings</span>
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-yellow-400 font-mono">
              {loading ? '...' : stats?.totalFindings || 0}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Confirmed weaknesses</span>
              <Link to="/findings" className="text-yellow-400 hover:underline flex items-center gap-0.5">
                Inspect <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Critical & High Findings */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-rose-900/40 relative overflow-hidden group hover:border-rose-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Critical & High</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono">
              {loading ? '...' : (stats?.severityBreakdown.critical || 0) + (stats?.severityBreakdown.high || 0)}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Crit: {stats?.severityBreakdown.critical || 0} | High: {stats?.severityBreakdown.high || 0}</span>
              <Link to="/findings?severity=critical" className="text-rose-400 hover:underline flex items-center gap-0.5">
                Remediate <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Average Uptime */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">API Availability</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {loading ? '...' : `${stats?.averageUptime || 100}%`}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Healthy APIs: {stats?.healthDistribution.healthy || 0}</span>
              <Link to="/monitoring" className="text-emerald-400 hover:underline flex items-center gap-0.5">
                Monitor <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Average Response Time */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Latency</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-400 font-mono">
              {loading ? '...' : `${stats?.averageResponseTimeMs || 0} ms`}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Probe response time</span>
              <span className="text-purple-400/80 font-mono text-[11px]">Real HTTP</span>
            </div>
          </div>

          {/* Healthy vs Degraded */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Health Status</span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono flex items-center gap-2">
              <span className="text-emerald-400">{stats?.healthDistribution.healthy || 0} OK</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400">{stats?.healthDistribution.degraded || 0} Slow</span>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Down: {stats?.healthDistribution.down || 0}</span>
              <Link to="/monitoring" className="text-cyan-400 hover:underline">Details</Link>
            </div>
          </div>

          {/* Severity Breakdown Bar */}
          <div className="p-5 rounded-xl bg-[#0c1222] border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity Tiers</span>
              <span className="text-[10px] text-cyan-400 font-mono">OWASP</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                C:{stats?.severityBreakdown.critical || 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                H:{stats?.severityBreakdown.high || 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                M:{stats?.severityBreakdown.medium || 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                L:{stats?.severityBreakdown.low || 0}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Active vulnerabilities</span>
              <Link to="/findings" className="text-cyan-400 hover:underline">View</Link>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Severity Distribution */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
                Findings by Severity Level
              </h2>
              <span className="text-xs text-slate-400 font-mono">Live Database Aggregation</span>
            </div>

            {severityChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                <AlertTriangle className="w-8 h-8 mb-2 text-slate-600" />
                <p>No vulnerabilities detected yet.</p>
                <Link to="/scanner" className="text-cyan-400 hover:underline text-xs mt-1">Run a scan now</Link>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {severityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f1f5f9', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 2: OWASP API Security Top 10 Breakdown */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
                OWASP API Security Top 10 Distribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">Categorized Threats</span>
            </div>

            {owaspChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                <SearchCode className="w-8 h-8 mb-2 text-slate-600" />
                <p>No OWASP categories detected in current scans.</p>
                <Link to="/simulation" className="text-cyan-400 hover:underline text-xs mt-1">Test Simulation Lab</Link>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={owaspChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any, name: any, item: any) => [val, item.payload.fullName]}
                    />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Recent Scans & Findings Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Scans */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">Recent Security Scans</h2>
              <Link to="/history" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {(!stats?.recentScans || stats.recentScans.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recent scans recorded.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentScans.map((scan: any) => (
                  <div
                    key={scan._id}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{scan.apiId?.name || scan.targetBaseUrl}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{scan.scanType} • {scan.durationMs}ms</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                        {scan.findingsCount} findings
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(scan.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Critical / High Findings */}
          <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">Live Vulnerabilities Feed</h2>
              <Link to="/findings" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {(!stats?.recentFindings || stats.recentFindings.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recent security findings detected.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentFindings.map((finding: any) => (
                  <div
                    key={finding._id}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="overflow-hidden pr-3">
                      <p className="font-semibold text-slate-200 truncate">{finding.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {finding.method} {finding.endpoint}
                      </p>
                    </div>
                    <SeverityBadge severity={finding.severity} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

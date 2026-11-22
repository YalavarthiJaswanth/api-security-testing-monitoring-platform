import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Finding, ApiItem } from '../types';
import { Header } from '../components/Header';
import { SeverityBadge } from '../components/SeverityBadge';
import {
  AlertTriangle,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Layers,
  Code
} from 'lucide-react';

export const SecurityFindings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSeverity = searchParams.get('severity') || '';
  const initialApiId = searchParams.get('apiId') || '';

  const [findings, setFindings] = useState<Finding[]>([]);
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity);
  const [apiFilter, setApiFilter] = useState<string>(initialApiId);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected finding for modal inspection
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const params: any = { isSimulation: false };
      if (severityFilter) params.severity = severityFilter;
      if (apiFilter) params.apiId = apiFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const resp = await api.get('/findings', { params });
      setFindings(resp.data.findings || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch security findings');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchFindings();
  }, [severityFilter, apiFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFindings();
  };

  const updateFindingStatus = async (id: string, newStatus: 'open' | 'resolved' | 'false_positive') => {
    try {
      await api.patch(`/findings/${id}/status`, { status: newStatus });
      setFindings(findings.map((f) => (f._id === id ? { ...f, status: newStatus } : f)));
      if (selectedFinding && selectedFinding._id === id) {
        setSelectedFinding({ ...selectedFinding, status: newStatus });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update finding status');
    }
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Security Vulnerabilities & Findings"
        subtitle="Catalog of verified OWASP API Security Top 10 vulnerabilities with reproducible evidence"
        actions={
          <button
            onClick={fetchFindings}
            title="Refresh Findings"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        }
      />

      <main className="flex-1 p-8 space-y-6">
        {/* Filter Bar */}
        <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Filters:</span>
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="informational">Informational</option>
            </select>

            {/* API Filter */}
            <select
              value={apiFilter}
              onChange={(e) => setApiFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Registered APIs</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search findings, endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg text-xs font-semibold transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Findings Table */}
        <div className="bg-[#0c1222] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs font-mono animate-pulse">
              Querying security findings database...
            </div>
          ) : findings.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No Security Findings Match Criteria</p>
              <p className="text-xs text-slate-500 mt-1">
                Run a vulnerability scan from the scanner module or adjust your filter selections.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090e1a] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Severity</th>
                    <th className="px-6 py-4">Vulnerability Title</th>
                    <th className="px-4 py-4">OWASP Category</th>
                    <th className="px-4 py-4">Endpoint</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {findings.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => setSelectedFinding(item)}
                      className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <SeverityBadge severity={item.severity} />
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-200 max-w-xs truncate">
                        {item.title}
                      </td>

                      <td className="px-4 py-4 font-mono text-cyan-400/90 text-[11px] max-w-xs truncate">
                        {item.owaspCategory}
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 mr-1.5 font-bold">
                          {item.method}
                        </span>
                        <span className="truncate">{item.endpoint}</span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                            item.status === 'open'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : item.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFinding(item);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-xs transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Finding Details Modal / Inspection Panel */}
        {selectedFinding && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-[#0c1222] border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={selectedFinding.severity} />
                    <span className="text-xs font-mono text-slate-400">
                      {selectedFinding.owaspCategory}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100">{selectedFinding.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Endpoint & Method */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-500 mr-2">Target Endpoint:</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 mr-2">
                    {selectedFinding.method}
                  </span>
                  <span className="text-slate-200">{selectedFinding.endpoint}</span>
                </div>
                <span className="text-slate-400 text-[11px]">Confidence: {selectedFinding.confidence.toUpperCase()}</span>
              </div>

              {/* Explanation & Potential Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    Vulnerability Explanation
                  </span>
                  <p className="text-slate-400 leading-relaxed">{selectedFinding.explanation}</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1.5">
                  <span className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                    Potential Security Impact
                  </span>
                  <p className="text-slate-400 leading-relaxed">{selectedFinding.potentialImpact}</p>
                </div>
              </div>

              {/* Technical Evidence */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  Technical Evidence & HTTP Artifacts
                </span>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-900 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto">
                  <pre>{JSON.stringify(selectedFinding.evidence, null, 2)}</pre>
                </div>
              </div>

              {/* Remediation Guidance */}
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5 text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  Recommended Remediation
                </span>
                <p className="text-slate-300 leading-relaxed">{selectedFinding.remediation}</p>
              </div>

              {/* Footer: Status Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Change Status:</span>
                  <button
                    onClick={() => updateFindingStatus(selectedFinding._id, 'open')}
                    className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors ${
                      selectedFinding.status === 'open'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => updateFindingStatus(selectedFinding._id, 'resolved')}
                    className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors ${
                      selectedFinding.status === 'resolved'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Resolved
                  </button>
                  <button
                    onClick={() => updateFindingStatus(selectedFinding._id, 'false_positive')}
                    className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors ${
                      selectedFinding.status === 'false_positive'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    False Positive
                  </button>
                </div>

                <button
                  onClick={() => setSelectedFinding(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

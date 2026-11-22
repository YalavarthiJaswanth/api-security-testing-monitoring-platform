import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { ScanItem } from '../types';
import { Header } from '../components/Header';
import {
  History,
  Clock,
  SearchCode,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const ScanHistory: React.FC = () => {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedScanLogs, setSelectedScanLogs] = useState<string[] | null>(null);
  const navigate = useNavigate();

  const fetchScans = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/scans');
      setScans(resp.data.scans || []);
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, []);

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Security Scan Audit History"
        subtitle="Chronological log of automated vulnerability assessments, test parameters, and duration metrics"
        actions={
          <button
            onClick={fetchScans}
            title="Refresh Scan History"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        }
      />

      <main className="flex-1 p-8 space-y-6">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs font-mono animate-pulse">
            Loading historical scan audit logs...
          </div>
        ) : scans.length === 0 ? (
          <div className="p-16 rounded-xl bg-[#0c1222] border border-slate-800 text-center max-w-md mx-auto">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-200">No Assessment Records Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Launch a vulnerability scan from the scanner console to begin recording audit trails.
            </p>
            <Link
              to="/scanner"
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <SearchCode className="w-4 h-4" />
              Launch Scan
            </Link>
          </div>
        ) : (
          <div className="bg-[#0c1222] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090e1a] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Target API</th>
                    <th className="px-4 py-4">Assessment Profile</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Duration</th>
                    <th className="px-4 py-4">Findings Breakdown</th>
                    <th className="px-4 py-4">Timestamp</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {scans.map((scan) => (
                    <tr key={scan._id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200 flex items-center gap-2">
                          {(scan.apiId as any)?.name || 'Direct Scan'}
                          {scan.isSimulation && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 text-[10px] border border-purple-500/30">
                              SIMULATION
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                          {scan.targetBaseUrl}
                        </div>
                      </td>

                      <td className="px-4 py-4 font-mono text-cyan-400 uppercase text-[11px]">
                        {scan.scanType.replace('_', ' ')}
                      </td>

                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3" />
                          {scan.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {scan.durationMs} ms
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span
                            title="Critical findings"
                            className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          >
                            C:{scan.severityCounts?.critical || 0}
                          </span>
                          <span
                            title="High findings"
                            className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          >
                            H:{scan.severityCounts?.high || 0}
                          </span>
                          <span
                            title="Medium findings"
                            className="px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          >
                            M:{scan.severityCounts?.medium || 0}
                          </span>
                          <span
                            title="Low findings"
                            className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          >
                            L:{scan.severityCounts?.low || 0}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-400">
                        {new Date(scan.createdAt).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-right space-x-2">
                        {scan.logs && scan.logs.length > 0 && (
                          <button
                            onClick={() => setSelectedScanLogs(scan.logs)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                          >
                            Logs
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/findings?apiId=${(scan.apiId as any)?._id || (scan.apiId as any)}`)}
                          className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold text-xs transition-colors"
                        >
                          Findings
                        </button>

                        <button
                          onClick={() => navigate(`/reports?scanId=${scan._id}`)}
                          className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold text-xs transition-colors"
                        >
                          Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scan Logs Modal */}
        {selectedScanLogs && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-[#0c1222] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <SearchCode className="w-4 h-4 text-cyan-400" />
                  Scan Execution Logs & Diagnostics
                </h3>
                <button
                  onClick={() => setSelectedScanLogs(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 max-h-64 overflow-y-auto space-y-1.5 border border-slate-900">
                {selectedScanLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-cyan-400">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedScanLogs(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
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

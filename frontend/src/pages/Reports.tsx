import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ApiItem, ScanItem } from '../types';
import { Header } from '../components/Header';
import {
  FileText,
  Download,
  FileCode2,
  ShieldCheck,
  AlertTriangle,
  Server,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

export const Reports: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialScanId = searchParams.get('scanId') || '';

  const [apis, setApis] = useState<ApiItem[]>([]);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedScanId, setSelectedScanId] = useState<string>(initialScanId);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [apisResp, scansResp] = await Promise.all([
          api.get('/apis'),
          api.get('/scans')
        ]);
        setApis(apisResp.data.apis || []);
        setScans(scansResp.data.scans || []);
      } catch (err) {
        console.error('Failed to load reports metadata:', err);
      }
    };
    loadInitialData();
  }, []);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedScanId) params.scanId = selectedScanId;
      if (selectedApiId) params.apiId = selectedApiId;

      const resp = await api.get('/reports/pdf', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `API-Sentinel-Security-Report-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to download PDF security report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedScanId) params.scanId = selectedScanId;
      if (selectedApiId) params.apiId = selectedApiId;

      const resp = await api.get('/reports/json', { params });
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resp.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `api-sentinel-assessment-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to export JSON report');
    } finally {
      setDownloadingJson(false);
    }
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Security Reports & Deliverables"
        subtitle="Export formal PDF executive summaries and machine-readable JSON security findings"
      />

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Report Export Selector */}
        <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wide">
              <FileText className="w-4 h-4 text-cyan-400" />
              Generate Formal Audit Report
            </h3>
            <span className="text-xs text-slate-400 font-mono">OWASP Compliance Format</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Filter by Specific API (Optional)
              </label>
              <select
                value={selectedApiId}
                onChange={(e) => {
                  setSelectedApiId(e.target.value);
                  setSelectedScanId('');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="">All APIs Consolidated</option>
                {apis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.environment})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Or Select Specific Assessment Scan
              </label>
              <select
                value={selectedScanId}
                onChange={(e) => {
                  setSelectedScanId(e.target.value);
                  setSelectedApiId('');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="">-- Choose specific scan --</option>
                {scans.map((s) => (
                  <option key={s._id} value={s._id}>
                    {(s.apiId as any)?.name || s.targetBaseUrl} - {new Date(s.createdAt).toLocaleDateString()} ({s.findingsCount} findings)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Download Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={handleDownloadJson}
              disabled={downloadingJson}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <span>{downloadingJson ? 'Exporting...' : 'Export JSON Dataset'}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download Executive PDF Report'}</span>
            </button>
          </div>
        </div>

        {/* Report Preview Document Card */}
        <div className="p-8 rounded-xl bg-[#090e1a] border border-slate-800/80 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                AS
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-100 tracking-wide">
                  API SENTINEL SECURITY ASSESSMENT REPORT
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  Standard: OWASP API Security Top 10 (2023) • Verification Engine: v1.0
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs border border-emerald-500/30">
              AUDIT CERTIFIED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Target Scope:</span>
              <span className="text-slate-200 font-bold">
                {selectedApiId ? apis.find((a) => a.id === selectedApiId)?.name : 'Consolidated Enterprise APIs'}
              </span>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Format:</span>
              <span className="text-cyan-400 font-bold">PDF / JSON Exportable</span>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Audit Protocol:</span>
              <span className="text-purple-400 font-bold">Automated DAST Probing</span>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-4">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Executive Summary & Scope Overview
            </h5>
            <p>
              This security assessment report summarizes the automated dynamic vulnerability analysis performed by API Sentinel. All testing utilized safe, non-destructive evidence gathering conforming to the OWASP API Security Top 10 framework.
            </p>
            <p>
              Findings documented within the PDF include technical reproduction artifacts, affected HTTP request methods, response header inspection, and concrete remediation advice tailored for DevSecOps engineers.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

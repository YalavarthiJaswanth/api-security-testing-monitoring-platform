import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { SimulationScenario } from '../types';
import { Header } from '../components/Header';
import { SeverityBadge } from '../components/SeverityBadge';
import {
  FlaskConical,
  Play,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Code,
  ArrowRight,
  Terminal,
  Info,
  Server
} from 'lucide-react';

export const SimulationLab: React.FC = () => {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('bola');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const resp = await api.get('/simulation/scenarios');
        const list: SimulationScenario[] = resp.data.scenarios || [];
        setScenarios(list);
        if (list.length > 0) {
          setSelectedScenarioId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load simulation scenarios:', err);
      }
    };
    loadScenarios();
  }, []);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  const handleExecuteAttack = async () => {
    if (!selectedScenarioId) return;
    setIsExecuting(true);
    setError(null);
    setExecutionResult(null);

    try {
      const resp = await api.post('/simulation/execute', {
        scenarioId: selectedScenarioId
      });
      setExecutionResult(resp.data.execution);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Simulation execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Simulation Lab - Vulnerable Playground"
        subtitle="Controlled local demonstration lab for replicating real OWASP API Top 10 vulnerabilities"
      />

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Educational Sandbox Notice */}
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider block">Controlled Simulation Sandbox Active</span>
              <span className="text-slate-300">
                All test requests execute against local isolated vulnerable containers. Simulation findings are safely isolated from production API audit reports.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-400 font-mono text-[11px] font-bold border border-purple-500/30">
            SIMULATION MODE
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scenario Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Scenarios List (4 cols) */}
          <div className="md:col-span-5 space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Select Attack Scenario ({scenarios.length})
            </span>
            <div className="space-y-2">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setExecutionResult(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selectedScenarioId === sc.id
                      ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/10 border-purple-500/60 shadow-lg shadow-purple-500/10'
                      : 'bg-[#0c1222] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200">{sc.name}</span>
                    <SeverityBadge severity={sc.severity} size="sm" />
                  </div>
                  <p className="text-[11px] text-cyan-400 font-mono truncate">{sc.owaspCategory}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                    <span className="px-1 rounded bg-slate-800 font-bold">{sc.method}</span>
                    <span className="truncate">{sc.path}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Scenario Details & Execution Console (7 cols) */}
          <div className="md:col-span-7 space-y-5">
            {selectedScenario && (
              <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{selectedScenario.name}</h3>
                    <p className="text-xs text-purple-400 font-mono mt-0.5">{selectedScenario.owaspCategory}</p>
                  </div>
                  <SeverityBadge severity={selectedScenario.severity} />
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">Vulnerability Description:</span>
                    <p className="text-slate-200 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      {selectedScenario.description}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">Target Endpoint & Method:</span>
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                        {selectedScenario.method}
                      </span>
                      <span className="text-slate-200">{selectedScenario.path}</span>
                    </div>
                  </div>

                  {selectedScenario.payload && (
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Simulated Attack Payload:</span>
                      <pre className="p-3 bg-slate-950 rounded-lg border border-slate-900 font-mono text-slate-300 overflow-x-auto text-[11px]">
                        {JSON.stringify(selectedScenario.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={handleExecuteAttack}
                    disabled={isExecuting}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Firing Attack Request...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Execute Test Attack</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Execution Result Panel */}
            {executionResult && (
              <div className="p-6 rounded-xl bg-[#0c1222] border border-cyan-500/40 shadow-xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                      Real Vulnerable Lab Response
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    HTTP {executionResult.response.status} • {executionResult.response.durationMs}ms
                  </span>
                </div>

                {/* Raw Response Payload from vulnerable lab */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 mb-1 block">
                    Actual Response Payload:
                  </span>
                  <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-rose-300 border border-slate-900 max-h-48 overflow-y-auto">
                    <pre>
                      {typeof executionResult.response.data === 'string'
                        ? executionResult.response.data
                        : JSON.stringify(executionResult.response.data, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Evidence & Explanation */}
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-rose-400 uppercase tracking-wide text-[11px] block">
                    Exploit Verification & Evidence
                  </span>
                  <p className="text-slate-300">{selectedScenario?.attackExplanation}</p>
                </div>

                {/* Recommended Remediation */}
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-emerald-400 uppercase tracking-wide text-[11px] block">
                    Remediation Fix
                  </span>
                  <p className="text-slate-300">{selectedScenario?.remediation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

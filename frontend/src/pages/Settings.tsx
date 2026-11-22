import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Header } from '../components/Header';
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  Globe,
  Server,
  User as UserIcon,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settingsData, setSettingsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const resp = await api.get('/settings');
        setSettingsData(resp.data.settings);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  return (
    <div className="flex-1 bg-[#070a13] min-h-screen flex flex-col">
      <Header
        title="Platform Settings & Security Policies"
        subtitle="Cryptographic configurations, SSRF allowlisting policies, and cluster runtime info"
      />

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6">
        {/* User Account Details */}
        <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-sm font-bold text-slate-100 uppercase tracking-wide">
            <UserIcon className="w-4 h-4 text-cyan-400" />
            Authenticated Operator Profile
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Username:</span>
              <span className="text-slate-200 font-bold">{user?.username}</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Email:</span>
              <span className="text-slate-200">{user?.email}</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Security Role:</span>
              <span className="text-cyan-400 font-bold uppercase">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Key & Encryption Policy */}
        <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 uppercase tracking-wide">
              <Key className="w-4 h-4 text-cyan-400" />
              API Credential Encryption Vault
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/30">
              HARDENED
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            All registered API authentication secrets (Bearer tokens, API keys, basic auth passwords) are symmetrically encrypted at rest using authenticated AES-256-GCM. Unencrypted secrets are never exposed in responses or logs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Cipher Algorithm:</span>
              <span className="text-slate-200 font-bold">AES-256-GCM (Galois/Counter Mode)</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Key Status:</span>
              <span className="text-emerald-400 font-bold">
                {settingsData?.encryption?.keyStatus || 'Active & Validated'}
              </span>
            </div>
          </div>
        </div>

        {/* SSRF & Target Isolation Policy */}
        <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 uppercase tracking-wide">
              <Shield className="w-4 h-4 text-cyan-400" />
              Target Allowlisting & SSRF Guard
            </div>
            <span className="text-xs text-cyan-400 font-mono">Anti-Loopback Filter</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            API Sentinel implements strict destination filtering on all interactive workspace tests and automated security scans. Private RFC1918 subnets, loopbacks, and cloud provider metadata endpoints are blocked to prevent Server-Side Request Forgery.
          </p>

          <div className="space-y-2 text-xs font-mono">
            <span className="text-slate-400 font-semibold block">Blocked IP & Host Ranges:</span>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex flex-wrap gap-2 text-rose-400">
              <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">127.0.0.0/8 (Loopback)</span>
              <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">10.0.0.0/8 (Private A)</span>
              <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">172.16.0.0/12 (Private B)</span>
              <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">192.168.0.0/16 (Private C)</span>
              <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">169.254.169.254 (Cloud Metadata)</span>
            </div>
          </div>
        </div>

        {/* Local Kubernetes & Kind Cluster Info */}
        <div className="p-6 rounded-xl bg-[#0c1222] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 uppercase tracking-wide">
              <Server className="w-4 h-4 text-cyan-400" />
              Local Kubernetes Deployment Topology
            </div>
            <span className="text-xs text-purple-400 font-mono">Kind Cluster</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">Target Namespace:</span>
              <span className="text-slate-200 font-bold">api-sentinel</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-1">StatefulSet Persistence:</span>
              <span className="text-cyan-400 font-bold">MongoDB PVC PersistentVolume</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

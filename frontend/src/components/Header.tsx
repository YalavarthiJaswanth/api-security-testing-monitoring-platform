import React from 'react';
import { ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="h-16 bg-[#0a0f1d]/70 backdrop-blur-md border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* System telemetry pills */}
        <div className="hidden lg:flex items-center gap-3 text-xs bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Engine Active</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-cyan-400">
            <Cpu className="w-3.5 h-3.5" />
            <span>FastAPI: Online</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-purple-400">
            <HardDrive className="w-3.5 h-3.5" />
            <span>MongoDB: Connected</span>
          </div>
        </div>

        {actions}
      </div>
    </header>
  );
};

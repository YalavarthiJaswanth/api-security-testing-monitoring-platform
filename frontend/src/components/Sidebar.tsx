import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Server,
  PlusCircle,
  Terminal,
  SearchCode,
  AlertTriangle,
  Activity,
  History,
  FileText,
  FlaskConical,
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Main Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'API Inventory', icon: Server },
  { to: '/apis/new', label: 'Add New API', icon: PlusCircle },
  { to: '/workspace', label: 'API Workspace', icon: Terminal },
  { to: '/scanner', label: 'Vulnerability Scanner', icon: SearchCode },
  { to: '/findings', label: 'Security Findings', icon: AlertTriangle },
  { to: '/monitoring', label: 'API Monitoring', icon: Activity },
  { to: '/history', label: 'Scan History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/simulation', label: 'Simulation Lab', icon: FlaskConical },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <ShieldAlert className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <span className="font-extrabold text-base tracking-wider text-slate-100 flex items-center gap-1.5">
            API SENTINEL
            <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-400 font-mono rounded border border-cyan-500/30">v1.0</span>
          </span>
          <p className="text-[10px] text-slate-400 truncate tracking-tight">Secure Every API. Detect Every Threat.</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Platform Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-400 border-l-2 border-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-[#080d1a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400 uppercase shrink-0">
              {user?.username ? user.username.slice(0, 2) : 'AS'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.username || 'Security Engineer'}</p>
              <p className="text-[10px] text-cyan-400/80 font-mono truncate">{user?.role || 'Engineer'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

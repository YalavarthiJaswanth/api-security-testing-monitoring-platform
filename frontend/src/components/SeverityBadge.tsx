import React from 'react';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const sev = (severity || 'low').toLowerCase();

  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    critical: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      label: 'CRITICAL'
    },
    high: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'HIGH'
    },
    medium: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30',
      label: 'MEDIUM'
    },
    low: {
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
      label: 'LOW'
    },
    informational: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      label: 'INFO'
    }
  };

  const current = config[sev] || config.low;
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs font-bold';

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-wide uppercase ${sizeClasses} ${current.bg} ${current.text} ${current.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current animate-pulse" />
      {current.label}
    </span>
  );
};

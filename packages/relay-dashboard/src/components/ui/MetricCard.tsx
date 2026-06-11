import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  warn?: boolean;
  children?: ReactNode;
}

export function MetricCard({ label, value, sub, accent, danger, warn, children }: MetricCardProps) {
  const valueColor = danger
    ? 'text-danger'
    : warn
    ? 'text-warning'
    : accent
    ? 'text-cyan-accent'
    : 'text-ink-primary';

  const borderColor = danger
    ? 'border-danger/30'
    : warn
    ? 'border-warning/30'
    : accent
    ? 'border-cyan-accent/30'
    : 'border-border-base';

  return (
    <div className={`bg-bg-surface border rounded-lg p-5 flex flex-col gap-2 ${borderColor}`}>
      <span className="text-2xs font-mono text-ink-secondary uppercase tracking-widest">{label}</span>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-mono font-medium tabular-nums leading-none ${valueColor}`}>
          {value}
        </span>
        {sub && <span className="text-xs text-ink-secondary mb-0.5 font-mono">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

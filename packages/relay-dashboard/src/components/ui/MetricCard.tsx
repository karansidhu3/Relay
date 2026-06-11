import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  children?: ReactNode;
}

export function MetricCard({ label, value, sub, accent, children }: MetricCardProps) {
  return (
    <div
      className={`
        bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2
        ${accent ? 'border-cyan-accent/30' : ''}
      `}
    >
      <span className="text-xs font-mono text-ink-secondary uppercase tracking-widest">{label}</span>
      <div className="flex items-end gap-2">
        <span
          className={`text-3xl font-mono font-medium tabular-nums leading-none ${
            accent ? 'text-cyan-accent' : 'text-ink-primary'
          }`}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-ink-secondary mb-0.5 font-mono">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

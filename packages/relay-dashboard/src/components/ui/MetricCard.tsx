import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  warn?: boolean;
  gauge?: number;
  children?: ReactNode;
}

export function MetricCard({ label, value, sub, accent, danger, warn, gauge, children }: MetricCardProps) {
  const valueColor = danger
    ? 'text-danger'
    : warn
    ? 'text-warning'
    : accent
    ? 'text-amber-accent'
    : 'text-ink-primary';

  const needleColor = danger ? '#d45848' : warn ? '#e6a020' : '#c9924a';

  return (
    <div className="bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2">
      <span className="text-2xs font-mono text-ink-muted uppercase tracking-widest">{label}</span>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-sans font-bold tabular-nums leading-none ${valueColor}`}>
          {value}
        </span>
        {sub && <span className="text-xs font-mono text-ink-muted mb-0.5">{sub}</span>}
      </div>
      {gauge !== undefined && (
        <div className="mt-2 relative h-px bg-ink-faint">
          <div className="absolute left-0    -top-[2px]   w-px h-[5px] bg-ink-faint" />
          <div className="absolute left-1/2  -top-[1.5px] w-px h-[4px] bg-ink-faint" />
          <div className="absolute right-0   -top-[2px]   w-px h-[5px] bg-ink-faint" />
          <div
            className="gauge-needle absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-[8px] rounded-sm"
            style={{
              background: needleColor,
              '--gauge-target': `${Math.min(Math.max(gauge, 0), 1) * 100}%`,
            } as React.CSSProperties}
          />
        </div>
      )}
      {children}
    </div>
  );
}

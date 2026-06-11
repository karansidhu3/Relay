import type { RelayExecution } from '../../types/relay';
import { StatusPill } from '../ui/StatusPill';
import { formatDuration, formatTimestamp } from '../../lib/utils/format';

interface ExecutionTimelineProps {
  executions: RelayExecution[];
}

export function ExecutionTimeline({ executions }: ExecutionTimelineProps) {
  if (executions.length === 0) {
    return (
      <p className="text-xs font-mono text-ink-secondary py-4">No executions recorded.</p>
    );
  }

  const sorted = [...executions].sort((a, b) => a.attempt - b.attempt);

  return (
    <div className="space-y-0">
      {sorted.map((exec, idx) => {
        const isLast = idx === sorted.length - 1;
        return (
          <div key={`${exec.event_id}-${exec.attempt}`} className="flex gap-4">
            {/* Rail */}
            <div className="flex flex-col items-center flex-shrink-0 w-8">
              <div
                className={`w-2 h-2 rounded-full mt-3.5 flex-shrink-0 ${
                  exec.status === 'COMPLETED'
                    ? 'bg-success'
                    : exec.status === 'FAILED' || exec.status === 'TIMED_OUT'
                    ? 'bg-danger'
                    : 'bg-cyan-accent'
                }`}
                style={{
                  boxShadow:
                    exec.status === 'COMPLETED'
                      ? '0 0 6px rgba(16,185,129,0.6)'
                      : exec.status === 'FAILED' || exec.status === 'TIMED_OUT'
                      ? '0 0 6px rgba(244,63,94,0.6)'
                      : '0 0 6px rgba(6,182,212,0.6)',
                }}
              />
              {!isLast && <div className="w-px flex-1 bg-border-base mt-1" />}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-secondary">
                    Attempt {exec.attempt}
                  </span>
                  <StatusPill status={exec.status} />
                </div>
                {exec.duration_ms !== undefined && (
                  <span className="text-xs font-mono text-ink-muted tabular-nums flex-shrink-0">
                    {formatDuration(exec.duration_ms)}
                  </span>
                )}
              </div>

              <div className="text-2xs font-mono text-ink-muted space-y-0.5">
                <div>
                  <span className="text-ink-secondary">id </span>
                  {exec.execution_id}
                </div>
                <div>
                  <span className="text-ink-secondary">started </span>
                  {formatTimestamp(exec.started_at)}
                </div>
                {exec.retry_delay_ms > 0 && (
                  <div>
                    <span className="text-ink-secondary">backoff </span>
                    {formatDuration(exec.retry_delay_ms)}
                  </div>
                )}
              </div>

              {exec.error_message && (
                <div className="mt-2 bg-danger-dim border border-danger/20 rounded px-3 py-2">
                  <div className="text-2xs font-mono text-danger font-medium mb-0.5">
                    {exec.error_type ?? 'ERROR'}
                  </div>
                  <div className="text-2xs font-mono text-ink-secondary">{exec.error_message}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

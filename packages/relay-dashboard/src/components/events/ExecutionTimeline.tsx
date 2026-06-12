'use client';

import { motion } from 'framer-motion';
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
        const isFailed = exec.status === 'FAILED' || exec.status === 'TIMED_OUT';
        const isCompleted = exec.status === 'COMPLETED';

        const dotColor = isCompleted
          ? 'bg-success'
          : isFailed
          ? 'bg-danger'
          : 'bg-amber-accent';

        const dotGlow = isCompleted
          ? '0 0 5px rgba(90,158,111,0.55)'
          : isFailed
          ? '0 0 5px rgba(212,88,72,0.55)'
          : '0 0 5px rgba(201,146,74,0.55)';

        return (
          <motion.div
            key={`${exec.event_id}-${exec.attempt}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: idx * 0.06, ease: 'easeOut' }}
            className="flex gap-4"
          >
            {/* Rail */}
            <div className="flex flex-col items-center flex-shrink-0 w-8">
              <div
                className={`w-2 h-2 rounded-full mt-3.5 flex-shrink-0 ${dotColor}`}
                style={{ boxShadow: dotGlow }}
              />
              {!isLast && <div className="w-px flex-1 bg-border-base mt-1" />}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
              <div className="flex items-start justify-between gap-4 mb-2">
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

              {/* Failed attempts: error block with more presence */}
              {isFailed && exec.error_message && (
                <div className="mt-3 border border-danger/25 rounded">
                  <div className="px-3 py-2 border-b border-danger/15">
                    <span className="text-2xs font-mono text-danger font-medium tracking-wider uppercase">
                      {exec.error_type ?? 'error'}
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-xs font-mono text-ink-secondary">{exec.error_message}</p>
                  </div>
                </div>
              )}

              {/* Non-failed errors (edge case) */}
              {!isFailed && exec.error_message && (
                <div className="mt-2 bg-danger-dim border border-danger/20 rounded px-3 py-2">
                  <div className="text-2xs font-mono text-danger font-medium mb-0.5">
                    {exec.error_type ?? 'ERROR'}
                  </div>
                  <div className="text-2xs font-mono text-ink-secondary">{exec.error_message}</div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { StatusPill } from '../../../components/ui/StatusPill';
import { ExecutionTimeline } from '../../../components/events/ExecutionTimeline';
import { getEvent } from '../../../lib/api/index';
import { formatTimestamp, formatDuration } from '../../../lib/utils/format';

interface PageProps {
  params: Promise<{ event_id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { event_id } = await params;

  let data: Awaited<ReturnType<typeof getEvent>>;
  try {
    data = await getEvent(event_id);
  } catch {
    notFound();
  }

  const { event, executions } = data;
  const completedExecution = executions.find((e) => e.status === 'COMPLETED');
  const totalDuration =
    completedExecution?.duration_ms !== undefined
      ? formatDuration(completedExecution.duration_ms)
      : null;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-ink-secondary">
          <Link href="/events" className="hover:text-cyan-accent transition-colors">
            Events
          </Link>
          <span>›</span>
          <span className="text-ink-primary">{event.event_id}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-mono font-medium text-ink-primary">
                {event.event_type}
              </h1>
              <StatusPill status={event.status} />
            </div>
            <p className="text-xs font-mono text-ink-muted">{event.event_id}</p>
          </div>
          {totalDuration && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-mono text-ink-secondary">Duration</div>
              <div className="text-sm font-mono text-ink-primary">{totalDuration}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: metadata */}
          <div className="col-span-1 space-y-4">
            <div className="bg-bg-surface border border-border-base rounded-lg p-5">
              <h2 className="text-xs font-mono text-ink-secondary uppercase tracking-widest mb-4">
                Event Details
              </h2>
              <dl className="space-y-3 text-xs font-mono">
                <div>
                  <dt className="text-ink-muted mb-0.5">Project</dt>
                  <dd className="text-ink-primary">{event.project_id}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted mb-0.5">Created</dt>
                  <dd className="text-ink-primary">{formatTimestamp(event.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted mb-0.5">Updated</dt>
                  <dd className="text-ink-primary">{formatTimestamp(event.updated_at)}</dd>
                </div>
                {event.completed_at && (
                  <div>
                    <dt className="text-ink-muted mb-0.5">Completed</dt>
                    <dd className="text-ink-primary">{formatTimestamp(event.completed_at)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-ink-muted mb-0.5">Attempts</dt>
                  <dd className="text-ink-primary">{event.attempt_count}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted mb-0.5">Payload</dt>
                  <dd className="text-ink-secondary">
                    {event.payload_size_bytes} bytes
                  </dd>
                </div>
                {event.idempotency_key && (
                  <div>
                    <dt className="text-ink-muted mb-0.5">Idempotency Key</dt>
                    <dd className="text-ink-secondary break-all">{event.idempotency_key}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right: execution timeline */}
          <div className="col-span-2">
            <div className="bg-bg-surface border border-border-base rounded-lg p-5">
              <h2 className="text-xs font-mono text-ink-secondary uppercase tracking-widest mb-5">
                Execution Timeline
              </h2>
              <ExecutionTimeline executions={executions} />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

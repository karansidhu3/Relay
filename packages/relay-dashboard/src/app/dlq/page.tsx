export const dynamic = 'force-dynamic';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { MetricCard } from '../../components/ui/MetricCard';
import { DlqTable } from '../../components/dlq/DlqTable';
import { getDlq } from '../../lib/api/index';
import { formatRelativeTime } from '../../lib/utils/format';

export default async function DlqPage() {
  let events: Awaited<ReturnType<typeof getDlq>>['events'] = [];
  let count = 0;
  let loadError = false;

  try {
    const data = await getDlq();
    events = data.events;
    count = data.count;
  } catch {
    loadError = true;
  }

  const oldest = events.length > 0
    ? events.reduce((a, b) => (a.updated_at < b.updated_at ? a : b))
    : null;

  const hasEvents = count > 0;

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* Header — weight of the count in the heading when populated */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-sans font-semibold text-ink-primary tracking-tight">
              Dead Letter Queue
            </h1>
            {hasEvents && (
              <p className="text-xs font-mono text-warning mt-1">
                {count} event{count !== 1 ? 's' : ''} requiring attention
              </p>
            )}
          </div>
        </div>

        {loadError && (
          <div className="border border-danger/20 bg-danger-dim rounded-lg px-4 py-3 text-xs font-mono text-danger">
            Failed to load — check API connectivity
          </div>
        )}

        {!loadError && (
          <>
            {/* Summary row — only show detail cards when there's something */}
            {hasEvents ? (
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Dead Letters" value={count} warn />
                <MetricCard
                  label="Oldest Entry"
                  value={oldest ? formatRelativeTime(oldest.updated_at) : '—'}
                />
                <MetricCard label="Period" value="14 days" />
              </div>
            ) : (
              <div className="bg-bg-surface border border-border-base rounded-lg px-5 py-3">
                <span className="font-mono text-xs text-ink-muted">
                  No dead letters.
                </span>
              </div>
            )}

            {hasEvents && <DlqTable events={events} />}
          </>
        )}
      </div>
    </PageWrapper>
  );
}

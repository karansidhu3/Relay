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

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-mono font-medium text-ink-primary">Dead Letter Queue</h1>
          <p className="text-xs font-mono text-ink-secondary mt-0.5">
            Events that exhausted all retry attempts — last 14 days
          </p>
        </div>

        {loadError && (
          <div className="bg-danger-dim border border-danger/20 rounded-lg px-4 py-3 text-xs font-mono text-danger">
            Failed to load DLQ — check API connectivity
          </div>
        )}

        {/* Summary cards */}
        {!loadError && (
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="Dead Letters"
              value={count}
              accent={count > 0}
            />
            <MetricCard
              label="Oldest Entry"
              value={oldest ? formatRelativeTime(oldest.updated_at) : '—'}
            />
            <MetricCard
              label="Status"
              value={count === 0 ? 'Clear' : 'Needs attention'}
            />
          </div>
        )}

        {/* Table */}
        {!loadError && <DlqTable events={events} />}
      </div>
    </PageWrapper>
  );
}

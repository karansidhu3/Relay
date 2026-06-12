export const dynamic = 'force-dynamic';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatusDonut } from '../../components/charts/StatusDonut';
import { EventBarChart } from '../../components/charts/EventBarChart';
import { getOverview } from '../../lib/api/index';
import { formatDuration } from '../../lib/utils/format';
import type { OverviewStats } from '../../types/relay';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border-base rounded-lg p-5">
      <h2 className="text-2xs font-mono text-ink-muted uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  let stats: OverviewStats | null = null;
  let loadError = false;

  try {
    stats = await getOverview();
  } catch {
    loadError = true;
  }

  const projectData = (stats?.events_by_project ?? []).map((p) => ({
    label: p.name,
    value: p.count,
  }));

  const typeData = (stats?.events_by_type ?? []).map((t) => ({
    label: t.event_type.split('.').slice(-2).join('.'),
    value: t.count,
  }));

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-sans font-semibold text-ink-primary tracking-tight">Analytics</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5">Last 24 hours</p>
        </div>

        {loadError && (
          <div className="border border-danger/20 bg-danger-dim rounded-lg px-4 py-3 text-xs font-mono text-danger">
            Failed to load — check API connectivity
          </div>
        )}

        {stats && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Events', value: stats.total_events.toLocaleString() },
                { label: 'Success Rate', value: `${(stats.success_rate * 100).toFixed(1)}%` },
                { label: 'Avg Duration', value: stats.avg_execution_ms > 0 ? formatDuration(stats.avg_execution_ms) : '—' },
                { label: 'Dead Letters', value: stats.dead_lettered.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-bg-surface border border-border-base rounded-lg px-4 py-3">
                  <div className="text-2xs font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-lg font-sans font-bold text-ink-primary">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SectionCard title="Status breakdown">
                <StatusDonut
                  completed={stats.completed}
                  failed={stats.failed}
                  dead_lettered={stats.dead_lettered}
                  processing={stats.processing}
                />
              </SectionCard>

              <SectionCard title="Events by project">
                <EventBarChart
                  data={projectData}
                  color="#c9924a"
                  emptyMessage="No project data"
                />
              </SectionCard>
            </div>

            <SectionCard title="Events by type">
              <EventBarChart
                data={typeData}
                color="#5a9e6f"
                emptyMessage="No type data for this period"
              />
            </SectionCard>
          </>
        )}
      </div>
    </PageWrapper>
  );
}

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { MetricCard } from '../components/ui/MetricCard';
import { MetricCardSkeleton } from '../components/ui/Skeleton';
import { PageWrapper } from '../components/layout/PageWrapper';
import { getOverview } from '../lib/api/index';
import { formatSuccessRate, formatDuration } from '../lib/utils/format';
import type { OverviewStats } from '../types/relay';

async function OverviewMetrics() {
  let stats: OverviewStats;
  try {
    stats = await getOverview();
  } catch {
    return (
      <div className="col-span-4 bg-danger-dim border border-danger/20 rounded-lg px-4 py-3 text-xs font-mono text-danger">
        Failed to load overview — check API connectivity
      </div>
    );
  }

  const successColor =
    stats.success_rate >= 0.95
      ? 'text-success'
      : stats.success_rate >= 0.8
      ? 'text-warning'
      : 'text-danger';

  return (
    <>
      <MetricCard label="Total Events (24h)" value={stats.total_events} />
      <MetricCard
        label="Success Rate"
        value={formatSuccessRate(stats.success_rate)}
        accent
      />
      <MetricCard
        label="Avg Duration"
        value={formatDuration(stats.avg_execution_ms)}
        sub="p50"
      />
      <MetricCard label="Dead Letters" value={stats.dead_lettered} />

      {/* Status breakdown row */}
      <div className="col-span-4 bg-bg-surface border border-border-base rounded-lg px-5 py-4">
        <div className="flex items-center gap-8">
          <span className="text-xs font-mono text-ink-secondary uppercase tracking-widest">
            Breakdown
          </span>
          <div className="flex items-center gap-8 font-mono text-xs">
            <span>
              <span className="text-success">{stats.completed}</span>
              <span className="text-ink-muted ml-1">completed</span>
            </span>
            <span>
              <span className="text-cyan-accent">{stats.processing}</span>
              <span className="text-ink-muted ml-1">processing</span>
            </span>
            <span>
              <span className="text-danger">{stats.failed}</span>
              <span className="text-ink-muted ml-1">failed</span>
            </span>
            <span>
              <span className="text-warning">{stats.dead_lettered}</span>
              <span className="text-ink-muted ml-1">dead-lettered</span>
            </span>
          </div>
          <div className="ml-auto">
            <span className={`text-sm font-mono font-medium ${successColor}`}>
              {stats.success_rate >= 0.95
                ? '● Healthy'
                : stats.success_rate >= 0.8
                ? '● Degraded'
                : '● Unhealthy'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <PageWrapper>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-mono font-medium text-ink-primary">System Overview</h1>
            <p className="text-xs font-mono text-ink-secondary mt-0.5">Last 24 hours</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/events"
              className="text-xs font-mono text-ink-secondary hover:text-cyan-accent transition-colors border border-border-base hover:border-cyan-accent/40 px-3 py-1.5 rounded"
            >
              Events →
            </Link>
            <Link
              href="/dlq"
              className="text-xs font-mono text-ink-secondary hover:text-warning transition-colors border border-border-base hover:border-warning/40 px-3 py-1.5 rounded"
            >
              DLQ →
            </Link>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-4">
          <Suspense
            fallback={
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            }
          >
            <OverviewMetrics />
          </Suspense>
        </div>
      </div>
    </PageWrapper>
  );
}

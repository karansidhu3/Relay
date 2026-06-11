export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { MetricCard } from '../components/ui/MetricCard';
import { Skeleton } from '../components/ui/Skeleton';
import { PageWrapper } from '../components/layout/PageWrapper';
import { getOverview } from '../lib/api/index';
import { formatSuccessRate, formatDuration } from '../lib/utils/format';
import type { OverviewStats } from '../types/relay';

function getHealthState(stats: OverviewStats): 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' {
  if (stats.success_rate < 0.5 || stats.dead_lettered > 3) return 'CRITICAL';
  if (stats.success_rate < 0.95 || stats.failed > 0 || stats.dead_lettered > 0) return 'DEGRADED';
  return 'OPERATIONAL';
}

async function OverviewContent() {
  let stats: OverviewStats;
  try {
    stats = await getOverview();
  } catch {
    return (
      <div className="bg-danger-dim border border-danger/20 rounded-lg px-4 py-3 text-xs font-mono text-danger">
        Failed to load — check API connectivity
      </div>
    );
  }

  const health = getHealthState(stats);
  const hasAnomalies = stats.failed > 0 || stats.dead_lettered > 0 || stats.processing > 0;

  const stateStyles = {
    OPERATIONAL: {
      bar: 'border-border-base',
      label: 'text-ink-muted',
    },
    DEGRADED: {
      bar: 'border-warning/30 bg-warning/[0.04]',
      label: 'text-warning',
    },
    CRITICAL: {
      bar: 'border-danger/40 bg-danger/[0.06]',
      label: 'text-danger',
    },
  }[health];

  return (
    <>
      {/* System state bar — sets the room tone */}
      <div className={`border rounded-lg px-5 py-3.5 flex items-center justify-between ${stateStyles.bar}`}>
        <span
          className={`font-mono text-sm font-medium tracking-[0.2em] uppercase ${stateStyles.label}`}
        >
          {health}
        </span>
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {stats.total_events} event{stats.total_events !== 1 ? 's' : ''} · last 24h
        </span>
      </div>

      {/* Metrics — success rate dominant (2 of 6 columns) */}
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-2">
          <MetricCard
            label="Success Rate"
            value={formatSuccessRate(stats.success_rate)}
            accent={health === 'OPERATIONAL'}
            danger={health === 'CRITICAL'}
            warn={health === 'DEGRADED'}
          />
        </div>
        <MetricCard label="Avg Duration" value={formatDuration(stats.avg_execution_ms)} sub="p50" />
        <MetricCard label="Total Events" value={stats.total_events} />
        <MetricCard label="Processing" value={stats.processing} />
        <MetricCard label="Dead Letters" value={stats.dead_lettered} />
      </div>

      {/* Breakdown — only when there is something to report */}
      {hasAnomalies && (
        <div className="bg-bg-surface border border-border-base rounded-lg px-5 py-3">
          <div className="flex items-center gap-6 font-mono text-xs">
            <span className="text-ink-secondary uppercase tracking-widest text-2xs">Breakdown</span>
            {stats.processing > 0 && (
              <span>
                <span className="text-cyan-accent">{stats.processing}</span>
                <span className="text-ink-muted ml-1.5">processing</span>
              </span>
            )}
            {stats.failed > 0 && (
              <span>
                <span className="text-danger">{stats.failed}</span>
                <span className="text-ink-muted ml-1.5">failed</span>
              </span>
            )}
            {stats.dead_lettered > 0 && (
              <span>
                <span className="text-warning">{stats.dead_lettered}</span>
                <span className="text-ink-muted ml-1.5">dead-lettered</span>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div className="border border-border-base rounded-lg px-5 py-3.5 flex items-center justify-between">
        <Skeleton width="120px" height="14px" />
        <Skeleton width="80px" height="12px" />
      </div>
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-2 bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2">
          <Skeleton width="80px" height="11px" />
          <Skeleton width="140px" height="36px" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2">
            <Skeleton width="64px" height="11px" />
            <Skeleton width="80px" height="36px" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <PageWrapper>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-mono text-ink-secondary uppercase tracking-widest">
            relay infrastructure
          </h1>
        </div>
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewContent />
        </Suspense>
      </div>
    </PageWrapper>
  );
}

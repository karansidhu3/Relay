export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { MetricCard } from '../components/ui/MetricCard';
import { Skeleton } from '../components/ui/Skeleton';
import { PageWrapper } from '../components/layout/PageWrapper';
import { HealthAtmosphere } from '../components/ui/HealthAtmosphere';
import { CountUp } from '../components/ui/CountUp';
import { getOverview } from '../lib/api/index';
import { formatDuration } from '../lib/utils/format';
import type { OverviewStats } from '../types/relay';

type HealthState = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';

function getHealthState(stats: OverviewStats): HealthState {
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
      <div className="border border-danger/20 bg-danger-dim rounded-lg px-4 py-3 text-xs font-mono text-danger">
        Failed to load — check API connectivity
      </div>
    );
  }

  const health = getHealthState(stats);
  const hasAnomalies = stats.failed > 0 || stats.dead_lettered > 0 || stats.processing > 0;

  const healthColor: Record<HealthState, string> = {
    OPERATIONAL: 'text-success',
    DEGRADED:    'text-warning',
    CRITICAL:    'text-danger',
  };

  const successPct = parseFloat((stats.success_rate * 100).toFixed(1));

  return (
    <>
      {/* Ambient atmosphere — bleeds from top-left, shifts tonally with health */}
      <HealthAtmosphere health={health} />

      {/* Identity + dominant health state */}
      <div className="relative">
        <p className="text-2xs font-mono text-ink-muted uppercase tracking-widest mb-4">
          relay infrastructure
        </p>
        <div className="flex items-baseline justify-between gap-6">
          <h1
            className={`text-5xl font-sans font-black tracking-tight leading-none ${healthColor[health]}`}
          >
            {health}
          </h1>
          <span className="font-mono text-sm text-ink-secondary self-center flex-shrink-0 tabular-nums">
            {stats.total_events.toLocaleString()} event{stats.total_events !== 1 ? 's' : ''} · last 24h
          </span>
        </div>
        <div className="mt-5 h-px bg-border-subtle" />
      </div>

      {/* Metrics — 4 equal columns */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Success Rate"
          value={
            <>
              <CountUp value={successPct} decimals={1} />
              <span className="text-xl font-sans font-semibold text-ink-secondary">%</span>
            </>
          }
          accent={health === 'OPERATIONAL'}
          danger={health === 'CRITICAL'}
          warn={health === 'DEGRADED'}
          gauge={stats.success_rate}
        />
        <MetricCard
          label="Total Events"
          value={<CountUp value={stats.total_events} />}
        />
        <MetricCard
          label="Failed"
          value={<CountUp value={stats.failed} />}
          danger={stats.failed > 0}
        />
        <MetricCard
          label="Dead Letters"
          value={<CountUp value={stats.dead_lettered} />}
          warn={stats.dead_lettered > 0 && stats.dead_lettered <= 3}
          danger={stats.dead_lettered > 3}
        />
      </div>

      {/* Context strip — compact, only when relevant */}
      {hasAnomalies && (
        <div className="flex items-center gap-5 px-5 py-3 bg-bg-surface border border-border-base rounded-lg">
          <span className="text-2xs font-mono text-ink-muted uppercase tracking-widest flex-shrink-0">
            Context
          </span>
          <div className="flex items-center gap-5 font-mono text-xs">
            {stats.processing > 0 && (
              <span>
                <span className="text-amber-accent tabular-nums">{stats.processing}</span>
                <span className="text-ink-muted ml-1.5">processing</span>
              </span>
            )}
            {stats.failed > 0 && (
              <span>
                <span className="text-danger tabular-nums">{stats.failed}</span>
                <span className="text-ink-muted ml-1.5">failed</span>
              </span>
            )}
            {stats.dead_lettered > 0 && (
              <span>
                <span className="text-warning tabular-nums">{stats.dead_lettered}</span>
                <span className="text-ink-muted ml-1.5">dead-lettered</span>
              </span>
            )}
          </div>
          {stats.avg_execution_ms > 0 && (
            <span className="ml-auto font-mono text-xs text-ink-secondary tabular-nums">
              {formatDuration(stats.avg_execution_ms)} avg execution
            </span>
          )}
        </div>
      )}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div>
        <Skeleton width="120px" height="10px" className="mb-4" />
        <Skeleton width="260px" height="48px" />
        <div className="mt-5 h-px bg-border-subtle" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2">
            <Skeleton width="72px" height="10px" />
            <Skeleton width="90px" height="36px" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <PageWrapper>
      <div className="space-y-5">
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewContent />
        </Suspense>
      </div>
    </PageWrapper>
  );
}

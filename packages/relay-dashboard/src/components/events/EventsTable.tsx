'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { StatusPill } from '../ui/StatusPill';
import { TableRowSkeleton } from '../ui/Skeleton';
import type { RelayEvent } from '../../types/relay';
import { formatRelativeTime, shortenEventId } from '../../lib/utils/format';

const PROJECT_ID = 'proj_careeeros';
const BASE_URL = process.env.NEXT_PUBLIC_RELAY_API_BASE_URL ?? '';

async function fetchEvents(url: string): Promise<{ events: RelayEvent[]; count: number }> {
  const res = await fetch(`${BASE_URL}${url}`);
  const body = await res.json();
  if (!body.success) throw new Error(body.error?.message ?? 'Fetch failed');
  return body.data as { events: RelayEvent[]; count: number };
}

const STATUS_OPTIONS = ['', 'COMPLETED', 'FAILED', 'PROCESSING', 'QUEUED', 'DEAD_LETTERED'] as const;

export function EventsTable() {
  const [statusFilter, setStatusFilter] = useState('');

  const qs = new URLSearchParams({ project_id: PROJECT_ID });
  if (statusFilter) qs.set('status', statusFilter);
  qs.set('limit', '50');

  const { data, error, isLoading } = useSWR(
    `/events?${qs.toString()}`,
    fetchEvents,
    { refreshInterval: 30_000 },
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-mono text-ink-secondary">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-bg-surface border border-border-base text-ink-primary text-xs font-mono rounded px-2 py-1.5 focus:outline-none focus:border-amber-accent/50 transition-colors"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        {data && (
          <span className="text-xs font-mono text-ink-muted ml-auto">
            {data.count} event{data.count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-base rounded-lg overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border-base">
              <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
                Event
              </th>
              <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
                Attempts
              </th>
              <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-danger">
                  Failed to load events — {error.message}
                </td>
              </tr>
            )}
            {data?.events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-secondary">
                  No events found
                </td>
              </tr>
            )}
            {data?.events.map((ev) => (
              <tr
                key={ev.event_id}
                className="border-t border-border-base hover:bg-bg-hover transition-colors duration-100 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/events/${ev.event_id}`}
                    className="text-ink-secondary hover:text-amber-accent transition-colors"
                  >
                    {shortenEventId(ev.event_id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-secondary max-w-[200px] truncate">
                  {ev.event_type}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={ev.status} />
                </td>
                <td className="px-4 py-3 text-ink-secondary tabular-nums">
                  {ev.attempt_count}
                </td>
                <td className="px-4 py-3 text-ink-secondary">
                  {formatRelativeTime(ev.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

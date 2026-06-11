'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RelayEvent } from '../../types/relay';
import { formatRelativeTime, shortenEventId } from '../../lib/utils/format';

const BASE_URL = process.env.NEXT_PUBLIC_RELAY_API_BASE_URL ?? '';

interface DlqTableProps {
  events: RelayEvent[];
}

export function DlqTable({ events }: DlqTableProps) {
  const [requeueing, setRequeueing] = useState<Record<string, boolean>>({});
  const [requeued, setRequeued] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRequeue(eventId: string) {
    setRequeueing((prev) => ({ ...prev, [eventId]: true }));
    setErrors((prev) => { const next = { ...prev }; delete next[eventId]; return next; });

    try {
      const res = await fetch(`${BASE_URL}/dashboard/dlq/${eventId}/requeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Requeue failed');
      setRequeued((prev) => ({ ...prev, [eventId]: true }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [eventId]: err instanceof Error ? err.message : 'Requeue failed',
      }));
    } finally {
      setRequeueing((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  if (events.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-base rounded-lg px-6 py-12 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="text-sm font-mono text-ink-secondary">Dead letter queue is empty</p>
      </div>
    );
  }

  return (
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
              Project
            </th>
            <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
              Attempts
            </th>
            <th className="text-left px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
              Age
            </th>
            <th className="text-right px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const isRequeueing = requeueing[ev.event_id];
            const hasBeenRequeued = requeued[ev.event_id];
            const error = errors[ev.event_id];

            return (
              <tr
                key={ev.event_id}
                className="border-t border-border-base hover:bg-bg-hover transition-colors duration-100"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/events/${ev.event_id}`}
                    className="text-ink-primary hover:text-cyan-accent transition-colors"
                  >
                    {shortenEventId(ev.event_id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-secondary max-w-[200px] truncate">
                  {ev.event_type}
                </td>
                <td className="px-4 py-3 text-ink-secondary">{ev.project_id}</td>
                <td className="px-4 py-3 text-ink-secondary tabular-nums">{ev.attempt_count}</td>
                <td className="px-4 py-3 text-ink-secondary">
                  {formatRelativeTime(ev.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {error && (
                    <span className="text-danger mr-2" title={error}>
                      Error
                    </span>
                  )}
                  {hasBeenRequeued ? (
                    <span className="text-success">Requeued</span>
                  ) : (
                    <button
                      onClick={() => handleRequeue(ev.event_id)}
                      disabled={isRequeueing}
                      className={`
                        px-2.5 py-1 rounded border text-2xs font-medium transition-colors duration-150
                        ${
                          isRequeueing
                            ? 'border-border-base text-ink-secondary cursor-wait'
                            : 'border-cyan-accent/40 text-cyan-accent hover:bg-cyan-dim cursor-pointer'
                        }
                      `}
                    >
                      {isRequeueing ? 'Requeueing…' : 'Requeue'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { RelayEvent } from '../../types/relay';
import { formatRelativeTime, shortenEventId } from '../../lib/utils/format';

const BASE_URL = process.env.NEXT_PUBLIC_RELAY_API_BASE_URL ?? '';

interface DlqTableProps {
  events: RelayEvent[];
}

type RequeueState = 'idle' | 'confirming' | 'requeueing' | 'requeued' | 'error';

export function DlqTable({ events }: DlqTableProps) {
  const [states, setStates] = useState<Record<string, RequeueState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmProgress, setConfirmProgress] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      Object.values(intervals.current).forEach(clearInterval);
    };
  }, []);

  function getState(id: string): RequeueState {
    return states[id] ?? 'idle';
  }

  function startConfirm(eventId: string) {
    setStates((prev) => ({ ...prev, [eventId]: 'confirming' }));
    setConfirmProgress((prev) => ({ ...prev, [eventId]: 100 }));

    let remaining = 100;
    intervals.current[eventId] = setInterval(() => {
      remaining -= 100 / 30; // 3s at ~100ms ticks
      setConfirmProgress((prev) => ({ ...prev, [eventId]: Math.max(0, remaining) }));
    }, 100);

    timers.current[eventId] = setTimeout(() => {
      cancelConfirm(eventId);
    }, 3000);
  }

  function cancelConfirm(eventId: string) {
    clearTimeout(timers.current[eventId]);
    clearInterval(intervals.current[eventId]);
    setStates((prev) => ({ ...prev, [eventId]: 'idle' }));
    setConfirmProgress((prev) => ({ ...prev, [eventId]: 0 }));
  }

  async function executeRequeue(eventId: string) {
    clearTimeout(timers.current[eventId]);
    clearInterval(intervals.current[eventId]);
    setStates((prev) => ({ ...prev, [eventId]: 'requeueing' }));
    setConfirmProgress((prev) => ({ ...prev, [eventId]: 0 }));
    setErrors((prev) => { const next = { ...prev }; delete next[eventId]; return next; });

    try {
      const res = await fetch(`${BASE_URL}/dashboard/dlq/${eventId}/requeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Requeue failed');
      setStates((prev) => ({ ...prev, [eventId]: 'requeued' }));
    } catch (err) {
      setStates((prev) => ({ ...prev, [eventId]: 'error' }));
      setErrors((prev) => ({
        ...prev,
        [eventId]: err instanceof Error ? err.message : 'Requeue failed',
      }));
    }
  }

  return (
    <div className="bg-bg-surface border border-border-base rounded-lg overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border-base">
            {['Event', 'Type', 'Project', 'Attempts', 'Age', ''].map((h) => (
              <th
                key={h}
                className={`px-4 py-3 text-ink-secondary font-medium uppercase tracking-wider text-left text-2xs ${
                  h === '' ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const state = getState(ev.event_id);
            const progress = confirmProgress[ev.event_id] ?? 0;
            const error = errors[ev.event_id];

            return (
              <tr
                key={ev.event_id}
                className="border-t border-border-base hover:bg-bg-hover transition-colors duration-100"
              >
                <td className="px-4 py-3.5">
                  <Link
                    href={`/events/${ev.event_id}`}
                    className="text-ink-primary hover:text-cyan-accent transition-colors"
                  >
                    {shortenEventId(ev.event_id)}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-ink-secondary max-w-[200px] truncate">
                  {ev.event_type}
                </td>
                <td className="px-4 py-3.5 text-ink-secondary">{ev.project_id}</td>
                <td className="px-4 py-3.5 text-ink-secondary tabular-nums">{ev.attempt_count}</td>
                <td className="px-4 py-3.5 text-ink-secondary">{formatRelativeTime(ev.updated_at)}</td>
                <td className="px-4 py-3.5 text-right">
                  {state === 'requeued' && (
                    <span className="text-success font-mono text-2xs">requeued</span>
                  )}
                  {state === 'error' && (
                    <span className="text-danger font-mono text-2xs" title={error}>
                      failed
                    </span>
                  )}
                  {state === 'requeueing' && (
                    <span className="text-ink-secondary font-mono text-2xs">requeueing…</span>
                  )}
                  {state === 'confirming' && (
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => cancelConfirm(ev.event_id)}
                        className="text-2xs font-mono text-ink-secondary hover:text-ink-primary transition-colors cursor-pointer"
                      >
                        cancel
                      </button>
                      {/* Confirm button with draining progress bar */}
                      <button
                        onClick={() => executeRequeue(ev.event_id)}
                        className="relative overflow-hidden text-2xs font-medium font-mono text-danger border border-danger/50 rounded px-2.5 py-1 cursor-pointer"
                      >
                        <span
                          className="absolute inset-0 bg-danger/10 origin-left transition-none"
                          style={{ transform: `scaleX(${progress / 100})` }}
                        />
                        <span className="relative">confirm requeue</span>
                      </button>
                    </div>
                  )}
                  {state === 'idle' && (
                    <button
                      onClick={() => startConfirm(ev.event_id)}
                      className="text-2xs font-medium font-mono text-ink-secondary border border-border-base hover:border-border-hover hover:text-ink-primary rounded px-2.5 py-1 transition-colors duration-150 cursor-pointer"
                    >
                      requeue
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

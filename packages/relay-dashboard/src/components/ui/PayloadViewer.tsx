'use client';

import { useState } from 'react';

interface PayloadViewerProps {
  eventId: string;
  sizeBytes: number;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const BASE_URL = process.env.NEXT_PUBLIC_RELAY_API_BASE_URL ?? '';

function renderJson(value: unknown, depth = 0): React.ReactNode {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);

  if (value === null) return <span className="text-ink-muted">null</span>;
  if (typeof value === 'boolean') return <span className="text-amber-accent">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-success">{value}</span>;
  if (typeof value === 'string') return <span className="text-ink-secondary">"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-muted">[]</span>;
    return (
      <>
        {'['}
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: '1.5em' }}>
            {renderJson(item, depth + 1)}
            {i < value.length - 1 && ','}
          </div>
        ))}
        {indent}{']'}
      </>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-ink-muted">{'{}'}</span>;
    return (
      <>
        {'{'}
        {entries.map(([k, v], i) => (
          <div key={k} style={{ paddingLeft: '1.5em' }}>
            <span className="text-ink-primary">"{k}"</span>
            <span className="text-ink-muted">: </span>
            {renderJson(v, depth + 1)}
            {i < entries.length - 1 && <span className="text-ink-muted">,</span>}
          </div>
        ))}
        {indent}{'}'}
      </>
    );
  }

  return <span className="text-ink-secondary">{String(value)}</span>;
}

export function PayloadViewer({ eventId, sizeBytes }: PayloadViewerProps) {
  const [state, setState] = useState<LoadState>('idle');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    setState('loading');
    try {
      const res = await fetch(`${BASE_URL}/events/${eventId}/payload`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Load failed');
      setPayload(body.data.payload as Record<string, unknown>);
      setState('loaded');
      setOpen(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Load failed');
      setState('error');
    }
  }

  function toggle() {
    if (state === 'idle') {
      load();
    } else {
      setOpen((o) => !o);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={toggle}
        disabled={state === 'loading'}
        className="flex items-center gap-2 text-2xs font-mono text-ink-secondary hover:text-ink-primary transition-colors cursor-pointer disabled:opacity-50"
      >
        <span className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>›</span>
        <span>
          {state === 'idle' && `View payload · ${sizeBytes} bytes`}
          {state === 'loading' && 'Loading payload…'}
          {state === 'loaded' && (open ? 'Hide payload' : 'Show payload')}
          {state === 'error' && 'Failed to load'}
        </span>
      </button>

      {state === 'error' && (
        <p className="mt-1 text-2xs font-mono text-danger">{errorMsg}</p>
      )}

      {state === 'loaded' && open && payload && (
        <div className="mt-3 bg-bg-root border border-border-base rounded-lg p-4 overflow-x-auto">
          <pre className="text-2xs font-mono leading-relaxed text-ink-secondary whitespace-pre-wrap">
            {renderJson(payload)}
          </pre>
        </div>
      )}
    </div>
  );
}

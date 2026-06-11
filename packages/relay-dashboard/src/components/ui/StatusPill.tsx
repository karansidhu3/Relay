'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { EventStatus, ExecutionStatus } from '../../types/relay';

type AnyStatus = EventStatus | ExecutionStatus;

interface StatusConfig {
  label: string;
  dot: string;
  bg: string;
  text: string;
  glow: string;
}

const STATUS_CONFIG: Record<AnyStatus, StatusConfig> = {
  RECEIVED: {
    label: 'Received',
    dot: 'bg-ink-secondary',
    bg: 'bg-neutral-dim',
    text: 'text-ink-secondary',
    glow: 'rgba(100,116,139,0.6)',
  },
  QUEUED: {
    label: 'Queued',
    dot: 'bg-cyan-accent',
    bg: 'bg-cyan-dim',
    text: 'text-cyan-accent',
    glow: 'rgba(6,182,212,0.6)',
  },
  PROCESSING: {
    label: 'Processing',
    dot: 'bg-cyan-accent animate-pulse',
    bg: 'bg-cyan-dim',
    text: 'text-cyan-accent',
    glow: 'rgba(6,182,212,0.6)',
  },
  RUNNING: {
    label: 'Running',
    dot: 'bg-cyan-accent animate-pulse',
    bg: 'bg-cyan-dim',
    text: 'text-cyan-accent',
    glow: 'rgba(6,182,212,0.6)',
  },
  COMPLETED: {
    label: 'Completed',
    dot: 'bg-success',
    bg: 'bg-success-dim',
    text: 'text-success',
    glow: 'rgba(16,185,129,0.6)',
  },
  FAILED: {
    label: 'Failed',
    dot: 'bg-danger',
    bg: 'bg-danger-dim',
    text: 'text-danger',
    glow: 'rgba(244,63,94,0.6)',
  },
  DEAD_LETTERED: {
    label: 'Dead Lettered',
    dot: 'bg-warning',
    bg: 'bg-warning-dim',
    text: 'text-warning',
    glow: 'rgba(245,158,11,0.6)',
  },
  TIMED_OUT: {
    label: 'Timed Out',
    dot: 'bg-warning',
    bg: 'bg-warning-dim',
    text: 'text-warning',
    glow: 'rgba(245,158,11,0.6)',
  },
  SKIPPED: {
    label: 'Skipped',
    dot: 'bg-ink-secondary',
    bg: 'bg-neutral-dim',
    text: 'text-ink-secondary',
    glow: 'rgba(100,116,139,0.6)',
  },
};

interface StatusPillProps {
  status: AnyStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.RECEIVED;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-mono font-medium ${config.bg} ${config.text}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
          style={{ boxShadow: `0 0 6px 1px ${config.glow}` }}
        />
        {config.label}
      </motion.span>
    </AnimatePresence>
  );
}

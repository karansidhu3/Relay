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
    glow: 'rgba(138,126,113,0.45)',
  },
  QUEUED: {
    label: 'Queued',
    dot: 'bg-amber-accent',
    bg: 'bg-amber-dim',
    text: 'text-amber-accent',
    glow: 'rgba(201,146,74,0.45)',
  },
  PROCESSING: {
    label: 'Processing',
    dot: 'bg-amber-accent animate-pulse',
    bg: 'bg-amber-dim',
    text: 'text-amber-accent',
    glow: 'rgba(201,146,74,0.45)',
  },
  RUNNING: {
    label: 'Running',
    dot: 'bg-amber-accent animate-pulse',
    bg: 'bg-amber-dim',
    text: 'text-amber-accent',
    glow: 'rgba(201,146,74,0.45)',
  },
  COMPLETED: {
    label: 'Completed',
    dot: 'bg-success',
    bg: 'bg-success-dim',
    text: 'text-success',
    glow: 'rgba(90,158,111,0.45)',
  },
  FAILED: {
    label: 'Failed',
    dot: 'bg-danger',
    bg: 'bg-danger-dim',
    text: 'text-danger',
    glow: 'rgba(212,88,72,0.45)',
  },
  DEAD_LETTERED: {
    label: 'Dead Lettered',
    dot: 'bg-warning',
    bg: 'bg-warning-dim',
    text: 'text-warning',
    glow: 'rgba(230,160,32,0.45)',
  },
  TIMED_OUT: {
    label: 'Timed Out',
    dot: 'bg-warning',
    bg: 'bg-warning-dim',
    text: 'text-warning',
    glow: 'rgba(230,160,32,0.45)',
  },
  SKIPPED: {
    label: 'Skipped',
    dot: 'bg-ink-secondary',
    bg: 'bg-neutral-dim',
    text: 'text-ink-secondary',
    glow: 'rgba(138,126,113,0.45)',
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

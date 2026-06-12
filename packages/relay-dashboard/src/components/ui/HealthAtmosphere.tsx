'use client';

import { motion } from 'framer-motion';

type HealthState = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';

const bgMap: Record<HealthState, string> = {
  OPERATIONAL: 'radial-gradient(ellipse 700px 500px at -100px -80px, rgba(90,158,111,0.04) 0%, transparent 65%)',
  DEGRADED:    'radial-gradient(ellipse 700px 500px at -100px -80px, rgba(230,160,32,0.045) 0%, transparent 65%)',
  CRITICAL:    'radial-gradient(ellipse 700px 500px at -100px -80px, rgba(212,88,72,0.06) 0%, transparent 65%)',
};

export function HealthAtmosphere({ health }: { health: HealthState }) {
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      animate={{ background: bgMap[health] }}
      transition={{ duration: 2.5, ease: 'easeInOut' }}
    />
  );
}

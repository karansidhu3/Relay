'use client';

import { useEffect, useState } from 'react';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
}

export function CountUp({ value, decimals = 0, duration = 750 }: CountUpProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(value * eased);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [value, duration]);

  if (decimals > 0) return <>{displayed.toFixed(decimals)}</>;
  return <>{Math.round(displayed).toLocaleString()}</>;
}

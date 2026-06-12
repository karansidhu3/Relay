'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarItem {
  label: string;
  value: number;
}

interface EventBarChartProps {
  data: BarItem[];
  color?: string;
  emptyMessage?: string;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1a1815',
    border: '1px solid #2a2520',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#f2ede6',
  },
};

export function EventBarChart({ data, color = '#c9924a', emptyMessage = 'No data' }: EventBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px]">
        <span className="text-xs font-mono text-ink-muted">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#4a4035' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          width={60}
        />
        <YAxis
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#4a4035' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [(value as number).toLocaleString(), 'events']}
          cursor={{ fill: 'rgba(201,146,74,0.06)' }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.75 + (i === 0 ? 0.25 : 0)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

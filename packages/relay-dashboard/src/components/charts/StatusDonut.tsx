'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface StatusDonutProps {
  completed: number;
  failed: number;
  dead_lettered: number;
  processing: number;
}

const SLICES = [
  { key: 'completed' as const, label: 'Completed', color: '#5a9e6f' },
  { key: 'failed' as const, label: 'Failed', color: '#d45848' },
  { key: 'dead_lettered' as const, label: 'Dead Letters', color: '#e6a020' },
  { key: 'processing' as const, label: 'Processing', color: '#c9924a' },
];

export function StatusDonut({ completed, failed, dead_lettered, processing }: StatusDonutProps) {
  const values = { completed, failed, dead_lettered, processing };
  const data = SLICES.map((s) => ({ name: s.label, value: values[s.key], color: s.color })).filter(
    (d) => d.value > 0,
  );

  const total = completed + failed + dead_lettered + processing;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px]">
        <span className="text-xs font-mono text-ink-muted">No data</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="w-[160px] h-[160px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1a1815',
                border: '1px solid #2a2520',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#f2ede6',
              }}
              formatter={(value) => [(value as number).toLocaleString(), '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2.5">
        {SLICES.map((s) => {
          const v = values[s.key];
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return (
            <div key={s.key} className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-xs font-mono text-ink-secondary w-24">{s.label}</span>
              <span className="text-xs font-mono text-ink-primary tabular-nums w-10 text-right">{v.toLocaleString()}</span>
              <span className="text-xs font-mono text-ink-muted tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

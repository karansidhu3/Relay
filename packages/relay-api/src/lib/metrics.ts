// Emits a CloudWatch metric via Embedded Metric Format (EMF).
// CloudWatch Logs processes EMF lines automatically — no SDK call required.
export function emitMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Milliseconds' | 'Seconds',
  dimensions: Record<string, string>,
): void {
  const emf = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'Relay',
          Dimensions: [Object.keys(dimensions)],
          Metrics: [{ Name: metricName, Unit: unit }],
        },
      ],
    },
    [metricName]: value,
    ...dimensions,
  };
  process.stdout.write(JSON.stringify(emf) + '\n');
}

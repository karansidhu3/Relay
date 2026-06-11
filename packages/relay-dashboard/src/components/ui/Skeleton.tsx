interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <span
      className={`skeleton inline-block ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-bg-surface border border-border-base rounded-lg p-5 flex flex-col gap-2">
      <Skeleton height="12px" width="80px" />
      <Skeleton height="36px" width="120px" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height="14px" width={i === 0 ? '160px' : '100px'} />
        </td>
      ))}
    </tr>
  );
}

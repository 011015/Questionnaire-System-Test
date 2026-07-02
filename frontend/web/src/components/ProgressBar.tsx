export function ProgressBar({ index, total }: { index: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round(((index + 1) / total) * 100);
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">
        {Math.min(index + 1, total)} / {total}
      </span>
    </div>
  );
}

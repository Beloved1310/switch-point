export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="experiment-progress" aria-label={`${done} of ${total} choices made`}>
      <div className="progress-meta"><span>Your progress</span><span className="tabular">{done} / {total}</span></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${(done / total) * 100}%` }} /></div>
    </div>
  );
}

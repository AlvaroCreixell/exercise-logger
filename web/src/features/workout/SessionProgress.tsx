interface SessionProgressProps {
  totalSets: number;
  loggedSets: number;
}

export function SessionProgress({
  totalSets,
  loggedSets,
}: SessionProgressProps) {
  const pct = totalSets > 0 ? Math.min(100, (loggedSets / totalSets) * 100) : 0;

  return (
    <div className="px-5 pb-3">
      <div className="flex items-center gap-3">
        <div className="relative h-1 flex-1 overflow-hidden rounded-[2px] bg-line-soft">
          <div
            data-progress-bar
            className="absolute inset-y-0 left-0 bg-accent-cli transition-all duration-[var(--dur-base)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className="shrink-0 text-xs font-semibold text-ink-3 tabular-nums"
          aria-label={`${loggedSets} of ${totalSets} sets logged`}
        >
          {loggedSets}/{totalSets}
        </span>
      </div>
    </div>
  );
}

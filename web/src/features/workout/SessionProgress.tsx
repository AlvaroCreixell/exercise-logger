import { useEffect, useState } from "react";
import { Stat } from "@/shared/components/Stat";

interface SessionProgressProps {
  startedAt: string;
  totalSets: number;
  loggedSets: number;
  totalExercises: number;
}

function computeElapsedMin(startedAt: string): number {
  const ms = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function SessionProgress({
  startedAt,
  totalSets,
  loggedSets,
  totalExercises,
}: SessionProgressProps) {
  const [elapsedMin, setElapsedMin] = useState(() => computeElapsedMin(startedAt));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMin(computeElapsedMin(startedAt));
    }, 60_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const pct = totalSets > 0 ? Math.min(100, (loggedSets / totalSets) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 px-5 py-1.5 border-b border-border">
        <Stat
          value={loggedSets}
          label={`of ${totalSets} sets`}
          size="sm"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {elapsedMin} min · {totalExercises} {totalExercises === 1 ? "exercise" : "exercises"}
        </span>
      </div>
      <div className="h-0.5 bg-muted relative overflow-hidden">
        <div
          data-progress-bar
          className="absolute inset-y-0 left-0 bg-cta transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

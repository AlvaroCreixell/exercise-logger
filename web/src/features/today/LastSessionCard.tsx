import { Flame } from "lucide-react";
import type { Session } from "@/domain/types";
import { Stat } from "@/shared/components/Stat";
import type { TrainingCadence } from "@/shared/hooks/useTrainingCadence";

interface LastSessionCardProps {
  session: Session;
  cadence: TrainingCadence | undefined;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function formatDurationMin(start: string, end: string | null): number | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 60000);
}

export function LastSessionCard({ session, cadence }: LastSessionCardProps) {
  const durationMin = formatDurationMin(session.startedAt, session.finishedAt);
  // Threshold: `>= 3` avoids a perma-on ribbon for 2x-per-week trainers,
  // so the signal actually means "strong week" rather than "you trained".
  const showRibbon = (cadence?.sessionsLast7Days ?? 0) >= 3;

  return (
    <div className="border-t-2 border-border-strong pt-3 space-y-2">
      {showRibbon && cadence && (
        <div className="inline-flex items-center gap-1.5 bg-accent-warm-soft text-accent-warm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest">
          <Flame className="h-3 w-3" strokeWidth={2.5} />
          <span>{cadence.sessionsLast7Days} sessions this week</span>
        </div>
      )}
      <div className="flex items-baseline gap-4">
        <Stat
          value={session.dayLabelSnapshot}
          label={formatRelativeDate(session.finishedAt ?? session.startedAt)}
          size="sm"
        />
        {durationMin != null && (
          <Stat value={durationMin} label="min" size="sm" className="ml-auto" />
        )}
      </div>
    </div>
  );
}

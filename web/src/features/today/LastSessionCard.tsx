import type { Session } from "@/domain/types";
import { Stat } from "@/shared/components/Stat";

interface LastSessionCardProps {
  session: Session;
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

export function LastSessionCard({ session }: LastSessionCardProps) {
  const durationMin = formatDurationMin(session.startedAt, session.finishedAt);

  return (
    <div className="border-t border-line pt-3">
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

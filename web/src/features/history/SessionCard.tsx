import { Link } from "react-router";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import { Badge } from "@/shared/ui/badge";

interface SessionCardProps {
  summary: FinishedSessionSummary;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "< 1 min";
  return `${min} min`;
}

export function SessionCard({ summary }: SessionCardProps) {
  const { session, exerciseCount, loggedSetCount } = summary;

  return (
    <Link
      to={`/history/${session.id}`}
      className="block border-t border-border-strong p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="bg-cta text-white shrink-0 mt-0.5">
          {session.dayId}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold truncate">
            {session.routineNameSnapshot} — {session.dayLabelSnapshot}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {formatDate(summary.displayDate)}
            {session.finishedAt && (
              <> &middot; {formatDuration(session.startedAt, session.finishedAt)}</>
            )}
            &middot; {exerciseCount} exercises &middot; {loggedSetCount} sets
          </p>
        </div>
      </div>
    </Link>
  );
}

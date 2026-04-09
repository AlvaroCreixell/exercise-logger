import type { Session } from "@/domain/types";

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

function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const min = Math.round(ms / 60000);
  return `${min} min`;
}

export function LastSessionCard({ session }: LastSessionCardProps) {
  return (
    <div className="border-t-2 border-border-strong px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Last workout: {session.dayLabelSnapshot} &middot;{" "}
        <span className="tabular-nums">
          {formatRelativeDate(session.finishedAt ?? session.startedAt)}
        </span>
        {session.finishedAt && (
          <> &middot; <span className="tabular-nums">{formatDuration(session.startedAt, session.finishedAt)}</span></>
        )}
      </p>
    </div>
  );
}

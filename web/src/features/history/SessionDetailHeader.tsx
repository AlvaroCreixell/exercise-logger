import { Link } from "react-router";
import { Back } from "@/shared/icons";
import type { Session } from "@/domain/types";
import { formatShortDuration } from "./lib/sessionStats";

interface SessionDetailHeaderProps {
  session: Session;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatEyebrow(session: Session): string {
  const date = new Date(session.finishedAt ?? session.startedAt);
  const month = MONTH_FMT.format(date).toUpperCase();
  const day = date.getDate();
  const duration = formatShortDuration(session.startedAt, session.finishedAt).toUpperCase();
  return duration ? `${month} ${day} · ${duration}` : `${month} ${day}`;
}

export function SessionDetailHeader({ session }: SessionDetailHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/history"
        aria-label="Back"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-foreground hover:bg-sage-soft/50 transition-colors"
      >
        <Back />
      </Link>

      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">{formatEyebrow(session)}</p>
        <h1 className="text-hero-serif text-foreground">
          {session.dayLabelSnapshot}
        </h1>
      </div>
    </div>
  );
}

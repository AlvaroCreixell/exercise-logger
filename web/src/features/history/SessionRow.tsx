import { Link } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import { Chevron } from "@/shared/icons";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { UnitSystem } from "@/domain/enums";
import { formatShortDuration, formatVolume } from "./lib/sessionStats";

interface SessionRowProps {
  summary: FinishedSessionSummary;
  units: UnitSystem;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatDateChip(iso: string): { month: string; day: number } {
  const date = new Date(iso);
  return { month: MONTH_FMT.format(date).toUpperCase(), day: date.getDate() };
}

export function SessionRow({ summary, units }: SessionRowProps) {
  const { session, loggedSetCount, volumeKg } = summary;
  const { month, day } = formatDateChip(summary.displayDate);

  const metaParts = [
    formatShortDuration(session.startedAt, session.finishedAt),
    `${loggedSetCount} ${loggedSetCount === 1 ? "set" : "sets"}`,
    volumeKg > 0 ? formatVolume(volumeKg, units) : "",
  ].filter(Boolean);

  return (
    <Link to={`/history/${session.id}`} className="block">
      <Card className="py-0">
        <CardContent className="flex items-center gap-3 px-3 py-3">
          <div
            aria-hidden="true"
            className="flex flex-col items-center justify-center rounded-[var(--radius-set-empty)] bg-sage-soft px-2 py-1 text-sage-deep"
          >
            <span className="text-[10px] font-semibold tracking-widest">
              {month}
            </span>
            <span className="text-base font-bold leading-none tabular-nums">
              {day}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {session.dayLabelSnapshot}
            </p>
            <p className="text-meta tabular-nums">{metaParts.join(" · ")}</p>
          </div>

          <Chevron direction="right" className="shrink-0 text-ink-3" />
        </CardContent>
      </Card>
    </Link>
  );
}

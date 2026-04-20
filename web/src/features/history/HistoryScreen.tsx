import { History } from "lucide-react";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { useHistoryStats } from "@/shared/hooks/useHistoryStats";
import { useSettings } from "@/shared/hooks/useSettings";
import { EmptyState } from "@/shared/components/EmptyState";
import { HistoryStatsTile } from "./HistoryStatsTile";
import { SessionRow } from "./SessionRow";
import { groupSessionsByMonth } from "./lib/groupByMonth";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();
  const stats = useHistoryStats();
  const settings = useSettings();

  if (summaries === undefined || settings === undefined) return null;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No History Yet"
        body="Complete a workout to see it here."
      />
    );
  }

  const groups = groupSessionsByMonth(summaries);

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Training Log</p>
        <h1 className="text-hero-serif italic text-foreground">History</h1>
      </div>

      <HistoryStatsTile stats={stats} />

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.monthKey} className="space-y-2">
            <p className="text-eyebrow text-ink-3">{group.monthLabel}</p>
            <ul className="space-y-2" aria-label={group.monthLabel}>
              {group.sessions.map((summary) => (
                <li key={summary.session.id}>
                  <SessionRow summary={summary} units={settings.units} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

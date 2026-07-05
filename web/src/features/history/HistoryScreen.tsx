import { useState } from "react";
import { History } from "@/shared/icons";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { useHistoryStats } from "@/shared/hooks/useHistoryStats";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseSearchSessionIds } from "@/shared/hooks/useExerciseSearchSessionIds";
import { EmptyState } from "@/shared/components/EmptyState";
import { HistoryStatsTile } from "./HistoryStatsTile";
import { HistoryFilters } from "./HistoryFilters";
import { SessionRow } from "./SessionRow";
import { groupSessionsByMonth } from "./lib/groupByMonth";
import { filterSummaries, distinctDayIds } from "./lib/filterSessions";

/**
 * Below this many finished sessions the list is scannable at a glance, so the
 * filter bar would be noise. Past it, day chips + exercise search appear.
 */
const FILTERS_MIN_SESSIONS = 6;

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();
  const stats = useHistoryStats();
  const settings = useSettings();
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const matchingSessionIds = useExerciseSearchSessionIds(query);

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

  const showFilters = summaries.length >= FILTERS_MIN_SESSIONS;
  const filtered = showFilters
    ? filterSummaries(summaries, {
        day: activeDay,
        // While the search query is still resolving, keep the unfiltered list
        // rather than flashing empty.
        matchingSessionIds: matchingSessionIds ?? null,
      })
    : summaries;
  const groups = groupSessionsByMonth(filtered);

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Training Log</p>
        <h1 className="text-hero-serif italic text-foreground">History</h1>
      </div>

      <HistoryStatsTile stats={stats} />

      {showFilters && (
        <HistoryFilters
          dayIds={distinctDayIds(summaries)}
          activeDay={activeDay}
          onDayChange={setActiveDay}
          query={query}
          onQueryChange={setQuery}
        />
      )}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">
          No sessions match. Adjust the day filter or search.
        </p>
      ) : (
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
      )}
    </div>
  );
}

import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";

export interface HistoryFilter {
  /** Day id to keep, or null for all days. */
  day: string | null;
  /** Session ids matching the exercise search, or null when no search active. */
  matchingSessionIds: ReadonlySet<string> | null;
}

export function filterSummaries(
  summaries: FinishedSessionSummary[],
  filter: HistoryFilter,
): FinishedSessionSummary[] {
  return summaries.filter((summary) => {
    if (filter.day !== null && summary.session.dayId !== filter.day) {
      return false;
    }
    if (
      filter.matchingSessionIds !== null &&
      !filter.matchingSessionIds.has(summary.session.id)
    ) {
      return false;
    }
    return true;
  });
}

/** Distinct day ids across the summaries, sorted for a stable chip order. */
export function distinctDayIds(summaries: FinishedSessionSummary[]): string[] {
  return [...new Set(summaries.map((s) => s.session.dayId))].sort();
}

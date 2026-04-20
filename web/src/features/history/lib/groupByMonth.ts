import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";

export interface SessionMonthGroup {
  /** YYYY-MM for stable sort. Local calendar month. */
  monthKey: string;
  /** Uppercase display label, e.g. "APRIL 2026". */
  monthLabel: string;
  /** Sessions in this month — preserves input order. */
  sessions: FinishedSessionSummary[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthKeyFor(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Group finished-session summaries by their local calendar month.
 * Groups are returned newest-first; sessions within each group keep input order
 * (callers are expected to pass summaries sorted newest-first already).
 */
export function groupSessionsByMonth(
  summaries: FinishedSessionSummary[],
): SessionMonthGroup[] {
  if (summaries.length === 0) return [];

  const buckets = new Map<string, SessionMonthGroup>();
  for (const summary of summaries) {
    const date = new Date(summary.displayDate);
    const key = monthKeyFor(date);
    const existing = buckets.get(key);
    if (existing) {
      existing.sessions.push(summary);
    } else {
      buckets.set(key, {
        monthKey: key,
        monthLabel: MONTH_LABEL_FMT.format(date).toUpperCase(),
        sessions: [summary],
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );
}

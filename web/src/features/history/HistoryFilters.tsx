import { cn } from "@/shared/lib/utils";

interface HistoryFiltersProps {
  /** Distinct day ids, sorted. Chip row renders only when more than one. */
  dayIds: string[];
  /** Currently selected day, or null for all. */
  activeDay: string | null;
  onDayChange: (day: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

function chipClass(active: boolean): string {
  return cn(
    "rounded-[var(--radius-pill)] border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40",
    active
      ? "border-accent-cli-bright bg-accent-cli-bright text-paper"
      : "border-line bg-background text-ink-3 hover:border-accent-cli hover:text-accent-cli-bright",
  );
}

/** Day chips + exercise search for the History list. */
export function HistoryFilters({
  dayIds,
  activeDay,
  onDayChange,
  query,
  onQueryChange,
}: HistoryFiltersProps) {
  return (
    <div className="space-y-2">
      {dayIds.length > 1 && (
        <div role="group" aria-label="Filter by day" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={activeDay === null}
            onClick={() => onDayChange(null)}
            className={chipClass(activeDay === null)}
          >
            All
          </button>
          {dayIds.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={activeDay === day}
              onClick={() => onDayChange(activeDay === day ? null : day)}
              className={chipClass(activeDay === day)}
            >
              Day {day}
            </button>
          ))}
        </div>
      )}
      <input
        type="search"
        aria-label="Search by exercise"
        placeholder="Search exercise…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full rounded-[var(--radius-card)] border border-line bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-ink-3 focus-visible:border-accent-cli focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
      />
    </div>
  );
}

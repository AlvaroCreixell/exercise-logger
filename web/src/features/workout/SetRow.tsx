import { Check } from "@/shared/icons";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface SetRowProps {
  /** Continuous-across-blocks 1-based index shown in the empty-state row. */
  setNumber: number;
  /** The logged set record, or undefined when the row is empty. */
  loggedSet: LoggedSet | undefined;
  /** User's effective unit for the parent exercise. */
  units: UnitSystem;
  /** True when the parent block has `tag === "top"` — drives the TOP badge. */
  isTopBlock: boolean;
  /** Optional "Tap to log · last …" hint text for empty rows. */
  lastHint?: string;
  /** Triggered on click (opens SetLogSheet). */
  onClick: () => void;
}

function formatLoggedValue(
  ls: LoggedSet,
  units: UnitSystem,
): {
  primary: string | null;
  unit: string | null;
  secondary: string | null;
} {
  if (ls.performedWeightKg != null && ls.performedReps != null) {
    return {
      primary: `${toDisplayWeight(ls.performedWeightKg, units)}`,
      unit: units,
      secondary: `${ls.performedReps}`,
    };
  }
  if (ls.performedReps != null) {
    return { primary: `${ls.performedReps}`, unit: "reps", secondary: null };
  }
  if (ls.performedDurationSec != null) {
    return { primary: `${ls.performedDurationSec}`, unit: "s", secondary: null };
  }
  if (ls.performedDistanceM != null) {
    return { primary: `${ls.performedDistanceM}`, unit: "m", secondary: null };
  }
  return { primary: "✓", unit: null, secondary: null };
}

export function SetRow({
  setNumber,
  loggedSet,
  units,
  isTopBlock,
  lastHint,
  onClick,
}: SetRowProps) {
  const isLogged = loggedSet !== undefined;

  if (isLogged) {
    const { primary, unit, secondary } = formatLoggedValue(loggedSet, units);
    const showTop = isTopBlock;
    const showPR = loggedSet.isPersonalRecord === true;

    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Set ${setNumber}: ${primary}${unit ?? ""}${secondary ? ` × ${secondary}` : ""}`}
        className="flex w-full items-center gap-3 rounded-[var(--radius-set-logged)] bg-sage-soft px-3 py-2.5 text-left transition-colors hover:bg-sage-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-deep text-paper"
        >
          <Check size={14} />
        </span>
        <span className="flex items-baseline gap-1 text-foreground tabular-nums">
          <span className="text-value">{primary}</span>
          {unit && <span className="text-xs text-ink-3">{unit}</span>}
          {secondary && (
            <>
              <span className="text-xs text-ink-3">×</span>
              <span className="text-value">{secondary}</span>
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          {showTop && <span className="text-warm">TOP</span>}
          {showPR && <span className="text-sage-deep">↑ PR</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Set ${setNumber}: empty, tap to log${lastHint ? `, last ${lastHint}` : ""}`}
      className="flex w-full items-center gap-3 rounded-[var(--radius-set-empty)] border border-line bg-background px-3 py-2.5 text-left transition-colors hover:border-sage hover:bg-sage-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 text-xs font-semibold tabular-nums"
      >
        {setNumber}
      </span>
      <span className="text-sm text-ink-3">
        Tap to log{lastHint ? ` · last ${lastHint}` : ""}
      </span>
    </button>
  );
}

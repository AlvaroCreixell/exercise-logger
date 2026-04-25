import { Check } from "@/shared/icons";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { formatLoggedSetParts } from "@/shared/lib/formatLoggedSet";

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
    const parts = formatLoggedSetParts(loggedSet, units);
    const primary = parts?.primary ?? "✓";
    const unit = parts?.unit ?? null;
    const secondary = parts?.secondary ?? null;
    const tertiary = parts?.tertiary ?? null;
    const showTop = isTopBlock;
    const showPR = loggedSet.isPersonalRecord === true;

    const ariaSecondary = secondary ? ` × ${secondary}` : "";
    const ariaTertiary = tertiary ? ` · ${tertiary.value}${tertiary.unit}` : "";

    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Set ${setNumber}: ${primary}${unit ?? ""}${ariaSecondary}${ariaTertiary}`}
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
          {tertiary && (
            <>
              <span className="text-xs text-ink-3">·</span>
              <span className="text-value">{tertiary.value}</span>
              <span className="text-xs text-ink-3">{tertiary.unit}</span>
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

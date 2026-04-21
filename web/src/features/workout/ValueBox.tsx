import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

interface ValueBoxProps {
  /** "Weight", "Reps", etc. Shown as the eyebrow label above the value. */
  label: string;
  /** The current string value. Empty renders as "—". */
  value: string;
  /** Optional unit suffix shown below the value ("kg", "lbs"). */
  unit?: string;
  /** Controls the focused outline (which field the keypad drives). */
  isActive: boolean;
  /** Called when the tile itself is tapped (request focus). */
  onFocus: () => void;
  /** Called when the minus button is tapped. */
  onNudgeDown: () => void;
  /** Called when the plus button is tapped. */
  onNudgeUp: () => void;
  /** Optional corner slot (e.g. kg/lbs toggle). */
  unitToggle?: ReactNode;
}

export function ValueBox({
  label,
  value,
  unit,
  isActive,
  onFocus,
  onNudgeDown,
  onNudgeUp,
  unitToggle,
}: ValueBoxProps) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label={`${label} value`}
        aria-pressed={isActive}
        data-active={isActive ? "true" : "false"}
        onClick={onFocus}
        className="flex-1 rounded-[var(--radius-card)] border px-4 py-3 text-left transition-colors data-[active=true]:border-sage-deep data-[active=true]:bg-sage-soft/30 data-[active=false]:border-line data-[active=false]:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">
            {label}
          </span>
          {unitToggle}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
          <span className="text-3xl font-semibold text-foreground">
            {value === "" ? "—" : value}
          </span>
          {unit && <span className="text-sm text-ink-3">{unit}</span>}
        </div>
      </button>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={onNudgeUp}
          className="flex-1 rounded-[var(--radius-pill)] border border-line bg-background px-2 text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={onNudgeDown}
          className="flex-1 rounded-[var(--radius-pill)] border border-line bg-background px-2 text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

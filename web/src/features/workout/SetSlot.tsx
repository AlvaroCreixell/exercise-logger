import { Check } from "lucide-react";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";
import type { ExerciseEquipment } from "@/domain/enums";

interface SetSlotProps {
  setIndex: number;
  loggedSet: LoggedSet | undefined;
  units: UnitSystem;
  equipment: ExerciseEquipment;
  onClick: () => void;
  /** When true, unlogged slots render as inert, non-interactive elements */
  disabled?: boolean;
}

export function SetSlot({
  setIndex,
  loggedSet,
  units,
  equipment,
  onClick,
  disabled = false,
}: SetSlotProps) {
  const isLogged = loggedSet !== undefined;

  function formatValue(ls: LoggedSet): string {
    if (ls.performedWeightKg != null && ls.performedReps != null) {
      const w = toDisplayWeight(ls.performedWeightKg, equipment, units);
      return `${w}x${ls.performedReps}`;
    }
    if (ls.performedReps != null) return `${ls.performedReps}r`;
    if (ls.performedDurationSec != null) return `${ls.performedDurationSec}s`;
    if (ls.performedDistanceM != null) return `${ls.performedDistanceM}m`;
    return "\u2713";
  }

  if (disabled && !isLogged) {
    return (
      <div
        data-testid="set-slot"
        aria-label={`Set ${setIndex + 1}: empty`}
        className="min-h-[44px] min-w-[3.5rem] rounded-lg px-2 text-xs font-medium tabular-nums flex items-center justify-center gap-1 shrink-0 border border-border/50 text-muted-foreground/40"
      >
        <span>{setIndex + 1}</span>
      </div>
    );
  }

  return (
    <button
      data-testid="set-slot"
      onClick={onClick}
      aria-label={isLogged ? `Set ${setIndex + 1}: ${formatValue(loggedSet)}` : `Set ${setIndex + 1}: empty`}
      className={`min-h-[44px] min-w-[3.5rem] rounded-lg px-2 text-xs font-medium tabular-nums flex items-center justify-center gap-1 transition-colors shrink-0 ${
        isLogged
          ? "border border-success bg-success-soft text-success"
          : "border border-border text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {isLogged ? (
        <>
          <Check className="h-3 w-3 shrink-0" />
          <span>{formatValue(loggedSet)}</span>
        </>
      ) : (
        <span>{setIndex + 1}</span>
      )}
    </button>
  );
}

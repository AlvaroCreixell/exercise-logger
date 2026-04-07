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
}

export function SetSlot({
  setIndex,
  loggedSet,
  units,
  equipment,
  onClick,
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

  return (
    <button
      data-testid="set-slot"
      onClick={onClick}
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

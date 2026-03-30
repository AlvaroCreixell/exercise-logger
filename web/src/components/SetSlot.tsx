import type { LoggedSet } from "@/domain/types";
import type { UnitSystem, ExerciseEquipment, TargetKind } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface SetSlotProps {
  /** The set index within the block (0-based). */
  setIndex: number;
  /** The logged set for this slot, if any. */
  loggedSet: LoggedSet | null;
  /** What kind of target this block prescribes. */
  targetKind: TargetKind;
  /** Current display units. */
  units: UnitSystem;
  /** Equipment for weight rounding. */
  equipment: ExerciseEquipment;
  /** Handler when the slot is tapped. */
  onTap: () => void;
}

function formatLoggedValue(
  ls: LoggedSet,
  _targetKind: TargetKind,
  units: UnitSystem,
  equipment: ExerciseEquipment
): string {
  const parts: string[] = [];

  if (ls.performedWeightKg !== null) {
    const display = toDisplayWeight(ls.performedWeightKg, equipment, units);
    parts.push(`${display}${units}`);
  }

  if (ls.performedReps !== null) {
    parts.push(`${ls.performedReps}`);
  }

  if (ls.performedDurationSec !== null) {
    parts.push(`${ls.performedDurationSec}s`);
  }

  if (ls.performedDistanceM !== null) {
    if (ls.performedDistanceM >= 1000) {
      parts.push(`${(ls.performedDistanceM / 1000).toFixed(1)}km`);
    } else {
      parts.push(`${ls.performedDistanceM}m`);
    }
  }

  return parts.join(" x ") || "-";
}

export default function SetSlot({
  setIndex,
  loggedSet,
  targetKind,
  units,
  equipment,
  onTap,
}: SetSlotProps) {
  const isLogged = loggedSet !== null;

  return (
    <button
      onClick={onTap}
      className={`inline-flex min-w-[4rem] items-center justify-center rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
        isLogged
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
      aria-label={`Set ${setIndex + 1}${isLogged ? " (logged)" : ""}`}
    >
      {isLogged ? (
        formatLoggedValue(loggedSet, targetKind, units, equipment)
      ) : (
        <span className="text-xs">{setIndex + 1}</span>
      )}
    </button>
  );
}

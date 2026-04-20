import { Card, CardContent } from "@/shared/ui/card";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface SessionDetailExerciseCardProps {
  exerciseName: string;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  onSetTap: (blockIndex: number, setIndex: number) => void;
}

function formatPillContent(set: LoggedSet, units: UnitSystem): string {
  if (set.performedWeightKg == null || set.performedReps == null) return "—";
  return `${toDisplayWeight(set.performedWeightKg, units)}×${set.performedReps}`;
}

export function SessionDetailExerciseCard({
  exerciseName,
  loggedSets,
  units,
  onSetTap,
}: SessionDetailExerciseCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">{exerciseName}</p>
        {loggedSets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {loggedSets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onSetTap(set.blockIndex, set.setIndex)}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-sage-soft px-2.5 py-1 text-xs font-medium tabular-nums text-sage-deep transition-colors hover:bg-sage-soft/70 focus-visible:ring-2 focus-visible:ring-sage/40 outline-none"
                >
                  {formatPillContent(set, units)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

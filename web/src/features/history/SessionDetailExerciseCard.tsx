import { Link } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { formatLoggedSet } from "@/shared/lib/formatLoggedSet";

interface SessionDetailExerciseCardProps {
  /** Display name (snapshot from session). */
  exerciseName: string;
  /** Exercise catalog ID. Drives the link to per-exercise history. */
  exerciseId: string;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  onSetTap: (blockIndex: number, setIndex: number) => void;
}

export function SessionDetailExerciseCard({
  exerciseName,
  exerciseId,
  loggedSets,
  units,
  onSetTap,
}: SessionDetailExerciseCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <Link
          to={`/history/exercise/${exerciseId}`}
          className="inline-block text-sm font-semibold text-foreground hover:text-accent-cli-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 rounded-sm"
        >
          {exerciseName}
        </Link>
        {loggedSets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {loggedSets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onSetTap(set.blockIndex, set.setIndex)}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-accent-cli-soft px-2.5 py-1 text-xs font-medium tabular-nums text-accent-cli-bright transition-colors hover:bg-accent-cli-soft/70 focus-visible:ring-2 focus-visible:ring-accent-cli/40 outline-none"
                >
                  {formatLoggedSet(set, units)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

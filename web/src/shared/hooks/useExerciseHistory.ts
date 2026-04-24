import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { SessionExercise } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData } from "@/services/progression-service";
import { getExerciseHistoryData } from "@/services/progression-service";

/**
 * Reactively load per-block history data and suggestions for a routine exercise.
 * Returns undefined while loading.
 *
 * Deps: `[sessionExercise?.id, units]`. This is intentionally narrow even
 * though `getExerciseHistoryData` reads other scalar fields off
 * `sessionExercise` (`instanceLabel`, `setBlocksSnapshot`, `effectiveType`,
 * `effectiveEquipment`, `unitOverride`). The invariant: every realistic
 * mutation path that changes one of those fields also triggers a re-run
 * through a separate channel:
 *
 * - Bodyweight promotion (mutates `effectiveType` via `set-service.logSet`)
 *   also writes to `loggedSets`, which Dexie's `useLiveQuery` observes
 *   inside `getExerciseHistoryData` and re-runs the query.
 * - `setUnitOverride` mutates `unitOverride`, but the parent
 *   (`ExerciseCardWithHistory` in `WorkoutScreen`) re-renders with a new
 *   `units` derived from the mutated override, and `units` IS in deps.
 * - `instanceLabel` and `setBlocksSnapshot` are snapshot fields fixed at
 *   SessionExercise creation; they cannot change in-session.
 *
 * Adding the scalar fields to the deps array would thrash the query on
 * irrelevant identity changes without catching any new real mutation.
 */
export function useExerciseHistory(
  sessionExercise: SessionExercise | undefined,
  units: UnitSystem
): ExerciseHistoryData | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionExercise) {
        return { lastTime: [], suggestions: [] };
      }
      return getExerciseHistoryData(db, sessionExercise, units);
    },
    [sessionExercise?.id, units]
  );
}

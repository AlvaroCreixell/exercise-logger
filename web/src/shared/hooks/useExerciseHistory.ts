import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { SessionExercise } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData } from "@/services/progression-service";
import { getExerciseHistoryData } from "@/services/progression-service";

/**
 * Reactively load per-block history data and suggestions for a routine exercise.
 * Returns undefined while loading.
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

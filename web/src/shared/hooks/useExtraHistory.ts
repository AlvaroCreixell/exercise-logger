import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { ExtraExerciseHistory } from "@/services/progression-service";
import { getExtraExerciseHistory } from "@/services/progression-service";

/**
 * Reactively load the most recent history for an extra exercise.
 * Returns undefined while loading, null if no history exists.
 */
export function useExtraHistory(
  exerciseId: string | undefined
): ExtraExerciseHistory | null | undefined {
  return useLiveQuery(
    async () => {
      if (!exerciseId) return null;
      return getExtraExerciseHistory(db, exerciseId);
    },
    [exerciseId]
  );
}

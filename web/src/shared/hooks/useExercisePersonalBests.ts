import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import {
  computePersonalBests,
  type PersonalBests,
} from "@/domain/personal-records";

/**
 * Live all-time personal bests for one exercise, computed over ALL logged
 * sets — any session status (active sessions count), extras included.
 * Invariant 7 restricts progression suggestions, not PR detection.
 *
 * Returns undefined while loading or when exerciseId is undefined.
 */
export function useExercisePersonalBests(
  exerciseId: string | undefined
): PersonalBests | undefined {
  return useLiveQuery(
    async () => {
      if (!exerciseId) return undefined;

      // MUST use compound index [exerciseId+loggedAt] — no plain exerciseId index exists
      const sets = await db.loggedSets
        .where("[exerciseId+loggedAt]")
        .between([exerciseId, ""], [exerciseId, "￿"])
        .toArray();

      return computePersonalBests(sets);
    },
    [exerciseId]
  );
}

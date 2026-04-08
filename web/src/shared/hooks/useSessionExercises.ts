import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export interface SessionExerciseWithSets {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
}

/**
 * Reactively load all session exercises and their logged sets for a given session.
 * Returns undefined while loading.
 */
export function useSessionExercises(
  sessionId: string | undefined
): SessionExerciseWithSets[] | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionId) return [];

      const sessionExercises = await db.sessionExercises
        .where("sessionId")
        .equals(sessionId)
        .sortBy("orderIndex");

      const loggedSets = await db.loggedSets
        .where("sessionId")
        .equals(sessionId)
        .toArray();

      // Group logged sets by sessionExerciseId
      const setsByExercise = new Map<string, LoggedSet[]>();
      for (const ls of loggedSets) {
        const existing = setsByExercise.get(ls.sessionExerciseId);
        if (existing) {
          existing.push(ls);
        } else {
          setsByExercise.set(ls.sessionExerciseId, [ls]);
        }
      }

      return sessionExercises.map((se) => ({
        sessionExercise: se,
        loggedSets: (setsByExercise.get(se.id) ?? []).sort(
          (a, b) => {
            if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
            return a.setIndex - b.setIndex;
          }
        ),
      }));
    },
    [sessionId]
  );
}

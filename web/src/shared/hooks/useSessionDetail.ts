import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

export interface SessionExerciseWithSets {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
}

export interface SessionDetailData {
  session: Session;
  exercises: SessionExerciseWithSets[];
}

export function useSessionDetail(
  sessionId: string | undefined
): SessionDetailData | null | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionId) return null;
      const session = await db.sessions.get(sessionId);
      if (!session) return null;

      const sessionExercises = await db.sessionExercises
        .where("sessionId")
        .equals(sessionId)
        .sortBy("orderIndex");

      const loggedSets = await db.loggedSets
        .where("sessionId")
        .equals(sessionId)
        .toArray();

      const setsByExercise = new Map<string, LoggedSet[]>();
      for (const ls of loggedSets) {
        const existing = setsByExercise.get(ls.sessionExerciseId);
        if (existing) {
          existing.push(ls);
        } else {
          setsByExercise.set(ls.sessionExerciseId, [ls]);
        }
      }

      const exercises: SessionExerciseWithSets[] = sessionExercises.map((se) => ({
        sessionExercise: se,
        loggedSets: (setsByExercise.get(se.id) ?? []).sort((a, b) => {
          if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
          return a.setIndex - b.setIndex;
        }),
      }));

      return { session, exercises };
    },
    [sessionId]
  );
}

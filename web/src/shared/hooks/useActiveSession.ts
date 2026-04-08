import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

export interface ActiveSessionData {
  session: Session;
  sessionExercises: SessionExercise[];
  loggedSets: LoggedSet[];
}

/**
 * Reactively load the active session with all its exercises and logged sets.
 * Returns null if no active session exists. Returns undefined while loading.
 */
export function useActiveSession(): ActiveSessionData | null | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions
      .where("status")
      .equals("active")
      .toArray();

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0]!;

    const sessionExercises = await db.sessionExercises
      .where("sessionId")
      .equals(session.id)
      .sortBy("orderIndex");

    const loggedSets = await db.loggedSets
      .where("sessionId")
      .equals(session.id)
      .toArray();

    return { session, sessionExercises, loggedSets };
  });
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session } from "@/domain/types";

export interface FinishedSessionSummary {
  session: Session;
  exerciseCount: number;
  loggedSetCount: number;
  displayDate: string;
}

export function useFinishedSessionSummaries(): FinishedSessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions
      .where("status")
      .equals("finished")
      .toArray();

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    const allExercises = await db.sessionExercises
      .where("sessionId")
      .anyOf(sessionIds)
      .toArray();
    const allSets = await db.loggedSets
      .where("sessionId")
      .anyOf(sessionIds)
      .toArray();

    const exerciseCounts = new Map<string, number>();
    for (const se of allExercises) {
      exerciseCounts.set(se.sessionId, (exerciseCounts.get(se.sessionId) ?? 0) + 1);
    }
    const setCounts = new Map<string, number>();
    for (const ls of allSets) {
      setCounts.set(ls.sessionId, (setCounts.get(ls.sessionId) ?? 0) + 1);
    }

    const summaries: FinishedSessionSummary[] = sessions.map((session) => ({
      session,
      exerciseCount: exerciseCounts.get(session.id) ?? 0,
      loggedSetCount: setCounts.get(session.id) ?? 0,
      displayDate: session.finishedAt ?? session.startedAt,
    }));

    return summaries.sort((a, b) =>
      b.displayDate.localeCompare(a.displayDate)
    );
  });
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export interface HistoryStats {
  sessionCount: number;
  setCount: number;
  hours: number;
}

export function useHistoryStats(): HistoryStats | undefined {
  return useLiveQuery(async () => {
    const finished = await db.sessions.where("status").equals("finished").toArray();

    if (finished.length === 0) {
      return { sessionCount: 0, setCount: 0, hours: 0 };
    }

    const sessionIds = finished.map((s) => s.id);
    const setCount = await db.loggedSets
      .where("sessionId")
      .anyOf(sessionIds)
      .count();

    let totalMs = 0;
    for (const s of finished) {
      if (!s.finishedAt) continue;
      totalMs += new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
    }
    const hours = Math.round(totalMs / (60 * 60 * 1000));

    return { sessionCount: finished.length, setCount, hours };
  });
}

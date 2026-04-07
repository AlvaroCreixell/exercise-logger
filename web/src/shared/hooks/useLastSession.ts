import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session } from "@/domain/types";

export function useLastSession(
  routineId: string | null | undefined
): Session | null | undefined {
  return useLiveQuery(
    async () => {
      if (!routineId) return null;
      const sessions = await db.sessions
        .where("[routineId+startedAt]")
        .between([routineId, ""], [routineId, "\uffff"])
        .reverse()
        .toArray();
      const finished = sessions.find((s) => s.status === "finished");
      return finished ?? null;
    },
    [routineId]
  );
}

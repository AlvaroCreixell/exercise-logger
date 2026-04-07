import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, LoggedSet } from "@/domain/types";
import type { ExerciseEquipment } from "@/domain/enums";

export interface ExerciseHistoryEntry {
  instanceLabel: string;
  effectiveEquipment: ExerciseEquipment;
  sets: LoggedSet[];
}

export interface ExerciseHistoryGroup {
  session: Pick<Session, "id" | "dayLabelSnapshot" | "routineNameSnapshot" | "startedAt">;
  entries: ExerciseHistoryEntry[];
}

export function useExerciseHistoryGroups(
  exerciseId: string | undefined
): ExerciseHistoryGroup[] | null | undefined {
  return useLiveQuery(
    async () => {
      if (!exerciseId) return null;

      // MUST use compound index [exerciseId+loggedAt] — no plain exerciseId index exists
      const allSets = await db.loggedSets
        .where("[exerciseId+loggedAt]")
        .between([exerciseId, ""], [exerciseId, "\uffff"])
        .toArray();

      if (allSets.length === 0) return [];

      const sessionIds = new Set(allSets.map((s) => s.sessionId));
      const seIds = new Set(allSets.map((s) => s.sessionExerciseId));

      const sessions = await db.sessions.bulkGet([...sessionIds]);
      const finishedSessions = new Map<string, Session>();
      for (const s of sessions) {
        if (s && s.status === "finished") {
          finishedSessions.set(s.id, s);
        }
      }

      const sessionExercises = await db.sessionExercises.bulkGet([...seIds]);
      const seMap = new Map<string, { instanceLabel: string; effectiveEquipment: ExerciseEquipment }>();
      for (const se of sessionExercises) {
        if (se) {
          seMap.set(se.id, {
            instanceLabel: se.instanceLabel,
            effectiveEquipment: se.effectiveEquipment,
          });
        }
      }

      // Group by sessionId -> sessionExerciseId (handles same exercise twice in one session)
      const sessionGroupMap = new Map<string, Map<string, LoggedSet[]>>();
      for (const ls of allSets) {
        if (!finishedSessions.has(ls.sessionId)) continue;
        let seGroup = sessionGroupMap.get(ls.sessionId);
        if (!seGroup) {
          seGroup = new Map();
          sessionGroupMap.set(ls.sessionId, seGroup);
        }
        const existing = seGroup.get(ls.sessionExerciseId);
        if (existing) {
          existing.push(ls);
        } else {
          seGroup.set(ls.sessionExerciseId, [ls]);
        }
      }

      const groups: ExerciseHistoryGroup[] = [];
      for (const [sessionId, seGroup] of sessionGroupMap) {
        const session = finishedSessions.get(sessionId)!;
        const entries: ExerciseHistoryEntry[] = [];
        for (const [seId, sets] of seGroup) {
          const seData = seMap.get(seId);
          entries.push({
            instanceLabel: seData?.instanceLabel ?? "",
            effectiveEquipment: seData?.effectiveEquipment ?? "bodyweight",
            sets: sets.sort((a, b) => {
              if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
              return a.setIndex - b.setIndex;
            }),
          });
        }
        groups.push({
          session: {
            id: session.id,
            dayLabelSnapshot: session.dayLabelSnapshot,
            routineNameSnapshot: session.routineNameSnapshot,
            startedAt: session.startedAt,
          },
          entries,
        });
      }

      return groups.sort((a, b) =>
        b.session.startedAt.localeCompare(a.session.startedAt)
      );
    },
    [exerciseId]
  );
}

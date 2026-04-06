import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Routine } from "@/domain/types";

/**
 * Reactively load a routine by ID.
 * Returns undefined while loading, null if the ID is null.
 */
export function useRoutine(routineId: string | null | undefined): Routine | null | undefined {
  return useLiveQuery(
    async () => {
      if (!routineId) return undefined;
      const routine = await db.routines.get(routineId);
      return routine ?? undefined;
    },
    [routineId]
  ) ?? (routineId ? undefined : null);
}

/**
 * Reactively load all routines.
 * Returns undefined while loading.
 */
export function useAllRoutines(): Routine[] | undefined {
  return useLiveQuery(() => db.routines.toArray());
}

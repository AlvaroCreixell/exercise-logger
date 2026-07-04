import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

/**
 * Session ids whose exercises match the search text (case-insensitive
 * substring on the exercise name snapshot).
 *
 * Returns `null` for a blank query (no filter), `undefined` while loading,
 * and a `Set` (possibly empty) otherwise. A full-table filter is fine at
 * single-user scale.
 */
export function useExerciseSearchSessionIds(
  query: string,
): Set<string> | null | undefined {
  const normalized = query.trim().toLowerCase();
  return useLiveQuery(async () => {
    if (normalized === "") return null;
    const matches = await db.sessionExercises
      .filter((se) => se.exerciseNameSnapshot.toLowerCase().includes(normalized))
      .toArray();
    return new Set(matches.map((se) => se.sessionId));
  }, [normalized]);
}

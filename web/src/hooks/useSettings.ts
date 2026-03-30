import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Settings } from "@/domain/types";

/**
 * Reactively load the current settings.
 * Returns undefined while loading.
 */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get("user"));
}

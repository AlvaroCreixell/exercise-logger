import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { computeTrainingCadence } from "@/services/progression-service";

export interface TrainingCadence {
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  daysSinceLastSession: number | null;
}

/** Live training cadence. Returns undefined while loading, then TrainingCadence. */
export function useTrainingCadence(): TrainingCadence | undefined {
  return useLiveQuery(() => computeTrainingCadence(db, new Date()), []);
}

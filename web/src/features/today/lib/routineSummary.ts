import type { Exercise, RoutineDay } from "@/domain/types";
import { deriveDayMuscleGroups } from "./muscleGroups";

export interface RoutineDaySummary {
  dayId: string;
  dayLabel: string;
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  muscleGroups: string[];
}

export function summarizeRoutineDay(
  day: RoutineDay,
  exercisesById: Map<string, Exercise>,
): RoutineDaySummary {
  let exerciseCount = 0;
  let setCount = 0;
  let firstExerciseName: string | null = null;

  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      exerciseCount += 1;
      setCount += entry.setBlocks.reduce((sum, block) => sum + block.count, 0);
      if (firstExerciseName === null) {
        firstExerciseName =
          exercisesById.get(entry.exerciseId)?.name ?? entry.exerciseId;
      }
    } else {
      for (const item of entry.items) {
        exerciseCount += 1;
        setCount += item.setBlocks.reduce((sum, block) => sum + block.count, 0);
        if (firstExerciseName === null) {
          firstExerciseName =
            exercisesById.get(item.exerciseId)?.name ?? item.exerciseId;
        }
      }
    }
  }

  return {
    dayId: day.id,
    dayLabel: day.label,
    exerciseCount,
    setCount,
    firstExerciseName,
    muscleGroups: deriveDayMuscleGroups(day, exercisesById),
  };
}

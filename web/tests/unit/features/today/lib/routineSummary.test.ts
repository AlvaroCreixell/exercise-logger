import { describe, it, expect } from "vitest";
import {
  summarizeRoutineDay,
  type RoutineDaySummary,
} from "@/features/today/lib/routineSummary";
import type { Exercise, RoutineDay } from "@/domain/types";

const squat: Exercise = {
  id: "barbell-back-squat",
  name: "Barbell Back Squat",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Legs"],
};
const bench: Exercise = {
  id: "barbell-bench-press",
  name: "Barbell Bench Press",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Chest"],
};
const row: Exercise = {
  id: "dumbbell-row",
  name: "Dumbbell Row",
  type: "weight",
  equipment: "dumbbell",
  muscleGroups: ["Back"],
};

const exercisesById = new Map<string, Exercise>([
  [squat.id, squat],
  [bench.id, bench],
  [row.id, row],
]);

describe("summarizeRoutineDay", () => {
  it("counts exercises and sets across standalone entries", () => {
    const day: RoutineDay = {
      id: "A",
      label: "Push",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: squat.id,
          setBlocks: [
            { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" },
            { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
          ],
        },
        {
          kind: "exercise",
          entryId: "e2",
          exerciseId: bench.id,
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    };
    const result: RoutineDaySummary = summarizeRoutineDay(day, exercisesById);
    expect(result.dayId).toBe("A");
    expect(result.dayLabel).toBe("Push");
    expect(result.exerciseCount).toBe(2);
    expect(result.setCount).toBe(7);
    expect(result.firstExerciseName).toBe("Barbell Back Squat");
    expect(result.muscleGroups).toEqual(["Legs", "Chest"]);
  });

  it("counts each superset member as a separate exercise", () => {
    const day: RoutineDay = {
      id: "B",
      label: "Pull",
      entries: [
        {
          kind: "superset",
          groupId: "g1",
          items: [
            {
              entryId: "e1",
              exerciseId: bench.id,
              setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
            },
            {
              entryId: "e2",
              exerciseId: row.id,
              setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
            },
          ],
        },
      ],
    };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.exerciseCount).toBe(2);
    expect(result.setCount).toBe(6);
    expect(result.firstExerciseName).toBe("Barbell Bench Press");
    expect(result.muscleGroups).toEqual(["Chest", "Back"]);
  });

  it("falls back to the exercise id when the catalog lookup misses", () => {
    const day: RoutineDay = {
      id: "C",
      label: "Mystery",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: "unknown-exercise",
          setBlocks: [{ targetKind: "reps", exactValue: 5, count: 1 }],
        },
      ],
    };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.firstExerciseName).toBe("unknown-exercise");
    expect(result.muscleGroups).toEqual([]);
  });

  it("returns null firstExerciseName when the day has no entries", () => {
    const day: RoutineDay = { id: "D", label: "Rest", entries: [] };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.exerciseCount).toBe(0);
    expect(result.setCount).toBe(0);
    expect(result.firstExerciseName).toBeNull();
    expect(result.muscleGroups).toEqual([]);
  });
});

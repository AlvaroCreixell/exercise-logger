import { describe, it, expect } from "vitest";
import { deriveDayMuscleGroups } from "@/features/today/lib/muscleGroups";
import type { RoutineDay, Exercise } from "@/domain/types";

function makeExercise(id: string, muscleGroups: string[]): Exercise {
  return {
    id,
    name: id,
    type: "weight",
    equipment: "barbell",
    muscleGroups,
  };
}

function makeDay(entries: RoutineDay["entries"]): RoutineDay {
  return { id: "day-a", label: "Day A", entries };
}

describe("deriveDayMuscleGroups", () => {
  it("returns unique muscle groups in first-appearance order", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", makeExercise("squat", ["Quads", "Glutes"])],
      ["bench", makeExercise("bench", ["Chest", "Triceps"])],
      ["row",   makeExercise("row",   ["Back", "Biceps"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "squat", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "bench", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "3", exerciseId: "row",   instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual([
      "Quads", "Glutes", "Chest", "Triceps", "Back", "Biceps",
    ]);
  });

  it("deduplicates across exercises", () => {
    const exercises = new Map<string, Exercise>([
      ["squat",    makeExercise("squat",    ["Quads", "Glutes"])],
      ["leg-ext",  makeExercise("leg-ext",  ["Quads"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "squat",   instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "leg-ext", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Quads", "Glutes"]);
  });

  it("walks into superset items", () => {
    const exercises = new Map<string, Exercise>([
      ["curl",  makeExercise("curl",  ["Biceps"])],
      ["pushd", makeExercise("pushd", ["Triceps"])],
    ]);
    const day = makeDay([
      {
        kind: "superset",
        groupId: "g1",
        items: [
          { entryId: "1", exerciseId: "curl",  instanceLabel: "", setBlocks: [] },
          { entryId: "2", exerciseId: "pushd", instanceLabel: "", setBlocks: [] },
        ],
      },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Biceps", "Triceps"]);
  });

  it("caps at 6 groups", () => {
    const exercises = new Map<string, Exercise>([
      ["a", makeExercise("a", ["G1", "G2", "G3", "G4"])],
      ["b", makeExercise("b", ["G5", "G6", "G7", "G8"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "a", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "b", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6"]);
  });

  it("skips unknown exercises gracefully", () => {
    const exercises = new Map<string, Exercise>([
      ["known", makeExercise("known", ["Legs"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "ghost", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "known", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Legs"]);
  });

  it("returns empty array for a day with no entries", () => {
    const day = makeDay([]);
    expect(deriveDayMuscleGroups(day, new Map())).toEqual([]);
  });
});

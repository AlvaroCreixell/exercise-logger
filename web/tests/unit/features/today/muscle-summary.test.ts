import { describe, it, expect } from "vitest";
import { summarizeMuscleGroups } from "@/features/today/muscle-summary";
import type { RoutineEntry, Exercise } from "@/domain/types";

function ex(id: string, name: string, groups: string[]): Exercise {
  return { id, name, type: "weight", equipment: "barbell", muscleGroups: groups };
}

function flat(exerciseId: string): RoutineEntry {
  return {
    kind: "exercise",
    entryId: `e-${exerciseId}`,
    exerciseId,
    setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
  };
}

describe("summarizeMuscleGroups", () => {
  it("counts each entry once against its primary (first) muscle group", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", ex("squat", "Squat", ["Legs"])],
      ["deadlift", ex("deadlift", "Deadlift", ["Back", "Legs"])], // primary = Back
      ["bench", ex("bench", "Bench", ["Chest"])],
    ]);

    const result = summarizeMuscleGroups(
      [flat("squat"), flat("deadlift"), flat("bench")],
      exercises,
    );

    expect(result).toEqual([
      { group: "Legs", count: 1 },
      { group: "Back", count: 1 },
      { group: "Chest", count: 1 },
    ]);
    expect(result.reduce((s, r) => s + r.count, 0)).toBe(3);
  });

  it("orders by count desc, with canonical tiebreak (Legs > Back > Chest > Shoulders > Arms > Core)", () => {
    const exercises = new Map<string, Exercise>([
      ["e1", ex("e1", "A", ["Arms"])],
      ["e2", ex("e2", "B", ["Chest"])],
      ["e3", ex("e3", "C", ["Legs"])],
      ["e4", ex("e4", "D", ["Chest"])],
      ["e5", ex("e5", "E", ["Legs"])],
      ["e6", ex("e6", "F", ["Legs"])],
    ]);

    const result = summarizeMuscleGroups(
      ["e1", "e2", "e3", "e4", "e5", "e6"].map(flat),
      exercises,
    );

    expect(result).toEqual([
      { group: "Legs", count: 3 },
      { group: "Chest", count: 2 },
      { group: "Arms", count: 1 },
    ]);
  });

  it("breaks count ties using the canonical order", () => {
    const exercises = new Map<string, Exercise>([
      ["e1", ex("e1", "A", ["Arms"])],
      ["e2", ex("e2", "B", ["Legs"])],
      ["e3", ex("e3", "C", ["Chest"])],
    ]);

    const result = summarizeMuscleGroups(
      ["e1", "e2", "e3"].map(flat),
      exercises,
    );

    expect(result.map((r) => r.group)).toEqual(["Legs", "Chest", "Arms"]);
  });

  it("buckets missing catalog entries as 'Other' and places them last", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", ex("squat", "Squat", ["Legs"])],
    ]);

    const result = summarizeMuscleGroups(
      [flat("squat"), flat("unknown-exercise")],
      exercises,
    );

    expect(result).toEqual([
      { group: "Legs", count: 1 },
      { group: "Other", count: 1 },
    ]);
  });

  it("buckets exercises with empty muscleGroups as 'Other'", () => {
    const exercises = new Map<string, Exercise>([
      ["mystery", ex("mystery", "Mystery", [])],
    ]);

    const result = summarizeMuscleGroups([flat("mystery")], exercises);

    expect(result).toEqual([{ group: "Other", count: 1 }]);
  });

  it("flattens supersets into their items before counting", () => {
    const exercises = new Map<string, Exercise>([
      ["curl", ex("curl", "Curl", ["Arms"])],
      ["push", ex("push", "Pushdown", ["Arms"])],
    ]);

    const superset: RoutineEntry = {
      kind: "superset",
      groupId: "g1",
      items: [
        {
          entryId: "e-1",
          exerciseId: "curl",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
        {
          entryId: "e-2",
          exerciseId: "push",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    };

    const result = summarizeMuscleGroups([superset], exercises);

    expect(result).toEqual([{ group: "Arms", count: 2 }]);
  });

  it("returns an empty array when there are no entries", () => {
    expect(summarizeMuscleGroups([], new Map())).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  generatedRoutineSchema,
  toRawRoutine,
  type GeneratedRoutine,
} from "@/services/llm/routine-schema";

function minimalGenerated(): GeneratedRoutine {
  return {
    name: "Test Plan",
    rest_default_sec: 90,
    rest_superset_sec: 60,
    days: [
      {
        id: "A",
        label: "Full Body",
        entries: [
          {
            kind: "exercise",
            exercise: {
              exercise_id: "barbell-back-squat",
              instance_label: null,
              notes: null,
              sets: [
                { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null },
              ],
            },
          },
        ],
      },
    ],
    notes: [],
    cardio: null,
  };
}

describe("generatedRoutineSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(generatedRoutineSchema.safeParse(minimalGenerated()).success).toBe(true);
  });

  it("rejects an entry with an unknown kind", () => {
    const g = minimalGenerated() as unknown as { days: { entries: unknown[] }[] };
    g.days[0]!.entries[0] = { kind: "circuit" };
    expect(generatedRoutineSchema.safeParse(g).success).toBe(false);
  });
});

describe("toRawRoutine", () => {
  it("derives version and day_order and keys days by id", () => {
    const raw = toRawRoutine(minimalGenerated()) as {
      version: number;
      day_order: string[];
      days: Record<string, { label: string }>;
    };
    expect(raw.version).toBe(1);
    expect(raw.day_order).toEqual(["A"]);
    expect(raw.days["A"]!.label).toBe("Full Body");
  });

  it("converts range and exact set blocks to the contract shape", () => {
    const g = minimalGenerated();
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: null,
        notes: null,
        sets: [
          { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: "top" },
          { target_kind: "duration", min_value: null, max_value: null, exact_value: 45, count: 2, tag: null },
        ],
      },
    };
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: { sets: Record<string, unknown>[] }[] }>;
    };
    const sets = raw.days["A"]!.entries[0]!.sets;
    expect(sets[0]).toEqual({ reps: [5, 8], count: 3, tag: "top" });
    expect(sets[1]).toEqual({ duration: 45, count: 2 });
  });

  it("converts a superset entry to the contract superset array", () => {
    const g = minimalGenerated();
    const item = (id: string) => ({
      exercise_id: id,
      instance_label: null,
      notes: null,
      sets: [{ target_kind: "reps" as const, min_value: 8, max_value: 12, exact_value: null, count: 3, tag: null }],
    });
    g.days[0]!.entries.push({ kind: "superset", items: [item("barbell-row"), item("barbell-bench-press")] });
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: Record<string, unknown>[] }>;
    };
    const entry = raw.days["A"]!.entries[1]! as { superset: { exercise_id: string }[] };
    expect(entry.superset.map((i) => i.exercise_id)).toEqual(["barbell-row", "barbell-bench-press"]);
  });

  it("omits null/empty optionals and includes non-empty notes and cardio", () => {
    const g = minimalGenerated();
    g.notes = ["Rotation is continuous."];
    g.cardio = { notes: "After lifting", options: [{ name: "Walk", detail: "20-30 min" }] };
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: "heavy",
        notes: "",
        sets: [{ target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null }],
      },
    };
    const raw = toRawRoutine(g) as Record<string, unknown> & {
      days: Record<string, { entries: Record<string, unknown>[] }>;
    };
    const entry = raw.days["A"]!.entries[0]!;
    expect(entry["instance_label"]).toBe("heavy");
    expect("notes" in entry).toBe(false); // empty string omitted
    expect(raw["notes"]).toEqual(["Rotation is continuous."]);
    expect(raw["cardio"]).toEqual({ notes: "After lifting", options: [{ name: "Walk", detail: "20-30 min" }] });
  });

  it("is total on degenerate targets: all-null values become an invalid range for the validator", () => {
    const g = minimalGenerated();
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: null,
        notes: null,
        sets: [{ target_kind: "reps", min_value: null, max_value: null, exact_value: null, count: 3, tag: null }],
      },
    };
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: { sets: { reps: unknown }[] }[] }>;
    };
    // [0, 0] fails the validator's positive-finite range rule → repair loop.
    expect(raw.days["A"]!.entries[0]!.sets[0]!.reps).toEqual([0, 0]);
  });
});

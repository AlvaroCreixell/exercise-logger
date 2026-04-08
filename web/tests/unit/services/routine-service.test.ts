import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
  type ValidationError,
} from "@/services/routine-service";
import type { Exercise, Routine } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal exercise lookup map for validation. */
function buildLookup(ids: string[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const id of ids) {
    map.set(id, {
      id,
      name: id,
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    });
  }
  return map;
}

/**
 * Minimal valid YAML that passes all validation rules.
 * All exercise_ids in this YAML must be present in the lookup.
 */
const VALID_EXERCISE_IDS = [
  "barbell-back-squat",
  "leg-curl",
  "dumbbell-bench-press",
  "dumbbell-row",
];

const VALID_YAML = `
version: 1
name: "Test Routine"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]

days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 3 }
`;

const VALID_LOOKUP = buildLookup(VALID_EXERCISE_IDS);

/** Helper to get error messages from a failed validation result. */
function getErrors(yamlStr: string, lookup?: Map<string, Exercise>): ValidationError[] {
  const result = validateAndNormalizeRoutine(yamlStr, lookup ?? VALID_LOOKUP);
  if (result.ok) {
    throw new Error("Expected validation to fail but it succeeded");
  }
  return result.errors;
}

/** Helper to get the routine from a successful validation result. */
function getRoutine(yamlStr: string, lookup?: Map<string, Exercise>): Routine {
  const result = validateAndNormalizeRoutine(yamlStr, lookup ?? VALID_LOOKUP);
  if (!result.ok) {
    throw new Error(
      `Expected validation to succeed but it failed:\n${result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`
    );
  }
  return result.routine;
}

// ---------------------------------------------------------------------------
// Validation rule tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — validation rules", () => {
  describe("Rule: unknown version", () => {
    it("rejects missing version", () => {
      const yaml = `
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version")).toBe(true);
    });

    it("rejects unsupported version number", () => {
      const yaml = `
version: 99
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version" && e.message.includes("Unsupported version"))).toBe(true);
    });

    it("rejects non-numeric version", () => {
      const yaml = `
version: "one"
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version")).toBe(true);
    });
  });

  describe("Rule: missing or duplicate day IDs", () => {
    it("rejects missing days section", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "days")).toBe(true);
    });

    it("rejects duplicate day IDs in day_order", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate day ID"))).toBe(true);
    });
  });

  describe("Rule: day_order does not match declared days exactly", () => {
    it("rejects day in day_order but not in days", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"B" is in day_order but not declared'))).toBe(true);
    });

    it("rejects day in days but not in day_order", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
  B:
    label: "Day B"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"B" is declared in days but not in day_order'))).toBe(true);
    });
  });

  describe("Rule: exercise_id does not exist in catalog", () => {
    it("rejects unknown exercise_id", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: unknown-exercise
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"unknown-exercise" does not exist in the catalog'))).toBe(true);
    });

    it("rejects unknown exercise_id inside a superset", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: nonexistent-exercise
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"nonexistent-exercise" does not exist'))).toBe(true);
    });
  });

  describe("Rule: range has min >= max", () => {
    it("rejects reps range where min >= max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [12, 8], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (12) must be less than max (8)"))).toBe(true);
    });

    it("rejects reps range where min equals max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 8], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (8) must be less than max (8)"))).toBe(true);
    });

    it("rejects duration range where min >= max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { duration: [60, 30], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (60) must be less than max (30)"))).toBe(true);
    });
  });

  describe("Rule: count < 1", () => {
    it("rejects count of 0", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 0 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
    });

    it("rejects negative count", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: -1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
    });

    it("rejects missing count", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8] }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count is required"))).toBe(true);
    });
  });

  describe("Rule: more than one of reps/duration/distance in a block", () => {
    it("rejects block with both reps and duration", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, duration: 30, count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of reps/duration/distance"))).toBe(true);
    });

    it("rejects block with all three targets", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, duration: 30, distance: 1000, count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of reps/duration/distance"))).toBe(true);
    });

    it("rejects block with no target", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of: reps, duration, distance"))).toBe(true);
    });
  });

  describe("Rule: superset does not have exactly 2 items", () => {
    it("rejects superset with 1 item", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly 2 items, got 1"))).toBe(true);
    });

    it("rejects superset with 3 items", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: leg-curl
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly 2 items, got 3"))).toBe(true);
    });
  });

  describe("Rule: superset pair does not have equal total working set count", () => {
    it("rejects superset with unequal set counts", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(
        errors.some(
          (e) =>
            e.message.includes("equal total working set count") &&
            e.message.includes("3 sets") &&
            e.message.includes("2 sets")
        )
      ).toBe(true);
    });

    it("accepts superset with equal set counts across multiple blocks", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [6, 8], count: 1 }
              - { reps: [8, 12], count: 2 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const routine = getRoutine(yaml);
      expect(routine).toBeDefined();
    });
  });

  describe("Rule: duplicate same-day exercise entries without instance_label", () => {
    it("rejects duplicate exercise_id in same day without instance_label", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate exercise") && e.message.includes("instance_label"))).toBe(true);
    });

    it("accepts duplicate exercise_id with distinct instance_labels", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        instance_label: heavy
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const routine = getRoutine(yaml);
      expect(routine).toBeDefined();
    });

    it("rejects when first entry has no label but second does", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate exercise") || e.message.includes("instance_label"))).toBe(true);
    });
  });

  describe("Rule: unsupported type_override or equipment_override", () => {
    it("rejects unsupported type_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        type_override: swimming
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('Unsupported type_override "swimming"'))).toBe(true);
    });

    it("rejects unsupported equipment_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        equipment_override: trampoline
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('Unsupported equipment_override "trampoline"'))).toBe(true);
    });

    it("accepts valid type_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        type_override: bodyweight
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const routine = getRoutine(yaml);
      const entry = routine.days["A"]!.entries[0]!;
      expect(entry.kind).toBe("exercise");
      if (entry.kind === "exercise") {
        expect(entry.typeOverride).toBe("bodyweight");
      }
    });

    it("accepts valid equipment_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        equipment_override: dumbbell
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const routine = getRoutine(yaml);
      const entry = routine.days["A"]!.entries[0]!;
      expect(entry.kind).toBe("exercise");
      if (entry.kind === "exercise") {
        expect(entry.equipmentOverride).toBe("dumbbell");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Normalization tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — normalization", () => {
  it("normalizes a valid minimal YAML into a Routine record", () => {
    const routine = getRoutine(VALID_YAML);

    expect(routine.schemaVersion).toBe(1);
    expect(routine.name).toBe("Test Routine");
    expect(routine.restDefaultSec).toBe(90);
    expect(routine.restSupersetSec).toBe(60);
    expect(routine.dayOrder).toEqual(["A"]);
    expect(routine.nextDayId).toBe("A");
    expect(routine.notes).toEqual([]);
    expect(routine.cardio).toBeNull();
    expect(routine.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(routine.importedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("generates deterministic entryIds from day and position", () => {
    const routine = getRoutine(VALID_YAML);
    const entries = routine.days["A"]!.entries;

    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("exercise");
    if (entries[0]!.kind === "exercise") {
      expect(entries[0]!.entryId).toBe("A-e0");
    }
  });

  it("normalizes set blocks with range values", () => {
    const routine = getRoutine(VALID_YAML);
    const entry = routine.days["A"]!.entries[0]!;
    expect(entry.kind).toBe("exercise");
    if (entry.kind === "exercise") {
      expect(entry.setBlocks).toHaveLength(2);

      const block0 = entry.setBlocks[0]!;
      expect(block0.targetKind).toBe("reps");
      expect(block0.minValue).toBe(6);
      expect(block0.maxValue).toBe(8);
      expect(block0.exactValue).toBeUndefined();
      expect(block0.count).toBe(1);
      expect(block0.tag).toBe("top");

      const block1 = entry.setBlocks[1]!;
      expect(block1.targetKind).toBe("reps");
      expect(block1.minValue).toBe(8);
      expect(block1.maxValue).toBe(12);
      expect(block1.exactValue).toBeUndefined();
      expect(block1.count).toBe(3);
      expect(block1.tag).toBeUndefined();
    }
  });

  it("normalizes exact value set blocks", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, count: 3 }
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      const block = entry.setBlocks[0]!;
      expect(block.targetKind).toBe("reps");
      expect(block.exactValue).toBe(8);
      expect(block.minValue).toBeUndefined();
      expect(block.maxValue).toBeUndefined();
      expect(block.count).toBe(3);
    }
  });

  it("normalizes duration set blocks", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { duration: [30, 60], count: 2 }
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      const block = entry.setBlocks[0]!;
      expect(block.targetKind).toBe("duration");
      expect(block.minValue).toBe(30);
      expect(block.maxValue).toBe(60);
    }
  });

  // P3-E: Positive test case for distance target kind
  it("normalizes distance set blocks", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { distance: 2000, count: 1 }
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      const block = entry.setBlocks[0]!;
      expect(block.targetKind).toBe("distance");
      expect(block.exactValue).toBe(2000);
      expect(block.count).toBe(1);
      expect(block.minValue).toBeUndefined();
      expect(block.maxValue).toBeUndefined();
    }
  });

  it("normalizes superset entries with correct entryIds and groupId", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Each arm"
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    expect(entry.kind).toBe("superset");
    if (entry.kind === "superset") {
      expect(entry.groupId).toBe("A-e0-group");
      expect(entry.items).toHaveLength(2);
      expect(entry.items[0]!.entryId).toBe("A-e0-s0");
      expect(entry.items[0]!.exerciseId).toBe("dumbbell-bench-press");
      expect(entry.items[1]!.entryId).toBe("A-e0-s1");
      expect(entry.items[1]!.exerciseId).toBe("dumbbell-row");
      expect(entry.items[1]!.notes).toBe("Each arm");
    }
  });

  it("normalizes multi-day routines with correct nextDayId", () => {
    const yaml = `
version: 1
name: "Multi-day"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B, C]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
  B:
    label: "Day B"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
  C:
    label: "Day C"
    entries:
      - exercise_id: dumbbell-row
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const routine = getRoutine(yaml);
    expect(routine.dayOrder).toEqual(["A", "B", "C"]);
    expect(routine.nextDayId).toBe("A");
    expect(Object.keys(routine.days)).toHaveLength(3);
  });

  it("normalizes notes and cardio sections", () => {
    const yaml = `
version: 1
name: "With extras"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
notes:
  - "First note"
  - "Second note"
cardio:
  notes: "After lifting"
  options:
    - { name: "Walk", detail: "20-30 min" }
    - { name: "Run", detail: "5K" }
`;
    const routine = getRoutine(yaml);
    expect(routine.notes).toEqual(["First note", "Second note"]);
    expect(routine.cardio).not.toBeNull();
    expect(routine.cardio!.notes).toBe("After lifting");
    expect(routine.cardio!.options).toHaveLength(2);
    expect(routine.cardio!.options[0]!.name).toBe("Walk");
    expect(routine.cardio!.options[0]!.detail).toBe("20-30 min");
    expect(routine.cardio!.options[1]!.name).toBe("Run");
    expect(routine.cardio!.options[1]!.detail).toBe("5K");
  });

  it("preserves exercise notes on individual entries", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
        notes: "Warm up with 2 lighter sets"
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      expect(entry.notes).toBe("Warm up with 2 lighter sets");
    }
  });

  it("preserves instanceLabel on entries", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        instance_label: heavy
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const routine = getRoutine(yaml);
    const entries = routine.days["A"]!.entries;
    expect(entries).toHaveLength(2);
    if (entries[0]!.kind === "exercise") {
      expect(entries[0]!.instanceLabel).toBe("heavy");
      expect(entries[0]!.entryId).toBe("A-e0");
    }
    if (entries[1]!.kind === "exercise") {
      expect(entries[1]!.instanceLabel).toBe("light");
      expect(entries[1]!.entryId).toBe("A-e1");
    }
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — edge cases", () => {
  it("rejects invalid YAML syntax", () => {
    const yaml = `
version: 1
name: "Test
  this is broken
`;
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.message).toContain("Invalid YAML");
    }
  });

  it("rejects YAML that parses to a scalar", () => {
    const yaml = "just a string";
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
  });

  it("rejects YAML that parses to null", () => {
    const yaml = "";
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
  });

  it("rejects entry with no exercise_id or superset key", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - sets:
          - { reps: [6, 8], count: 1 }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("exercise_id") || e.message.includes("superset"))).toBe(true);
  });

  it("rejects exercise entry with no sets", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("At least one set block is required"))).toBe(true);
  });

  it("rejects exercise entry with empty sets array", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets: []
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("At least one set block is required"))).toBe(true);
  });

  it("handles fractional count (non-integer)", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 2.5 }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
  });

  it("handles unsupported tag value", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: warmup }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes('Unsupported tag "warmup"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// importRoutine tests
// ---------------------------------------------------------------------------

describe("importRoutine", () => {
  let db: ExerciseLoggerDB;

  beforeEach(() => {
    db = new ExerciseLoggerDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("stores a routine in the database", async () => {
    const routine = getRoutine(VALID_YAML);
    await importRoutine(db, routine);

    const stored = await db.routines.get(routine.id);
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("Test Routine");
    expect(stored!.dayOrder).toEqual(["A"]);
    expect(stored!.nextDayId).toBe("A");
  });

  it("stores multiple routines", async () => {
    const r1 = getRoutine(VALID_YAML);

    const yaml2 = `
version: 1
name: "Second Routine"
rest_default_sec: 60
rest_superset_sec: 45
day_order: [X]
days:
  X:
    label: "Day X"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const r2 = getRoutine(yaml2);

    await importRoutine(db, r1);
    await importRoutine(db, r2);

    const all = await db.routines.toArray();
    expect(all).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: real catalog + real routine YAML
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — integration with real files", () => {
  it("validates the Full Body 3-Day Rotation YAML against the real catalog", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // Read the real catalog CSV
    const csvPath = path.resolve(
      __dirname,
      "../../../src/data/catalog.csv"
    );
    const csv = fs.readFileSync(csvPath, "utf-8");

    // Parse it into Exercise[]
    const { parseExerciseCatalog } = await import(
      "@/services/catalog-service"
    );
    const exercises = parseExerciseCatalog(csv);

    // Build the lookup map
    const lookup = new Map(exercises.map((e) => [e.id, e]));

    // Read the real YAML routine
    const yamlPath = path.resolve(
      __dirname,
      "../../../data/routines/full-body-3day.yaml"
    );
    const yamlStr = fs.readFileSync(yamlPath, "utf-8");

    // Validate and normalize
    const result = validateAndNormalizeRoutine(yamlStr, lookup);

    // It must succeed
    if (!result.ok) {
      throw new Error(
        `Expected validation to succeed but got errors:\n${result.errors
          .map((e) => `  ${e.path}: ${e.message}`)
          .join("\n")}`
      );
    }

    const routine = result.routine;

    // Verify basic structure
    expect(routine.name).toBe("Full Body 3-Day Rotation");
    expect(routine.schemaVersion).toBe(1);
    expect(routine.restDefaultSec).toBe(90);
    expect(routine.restSupersetSec).toBe(60);
    expect(routine.dayOrder).toEqual(["A", "B", "C"]);
    expect(routine.nextDayId).toBe("A");

    // Verify day A
    const dayA = routine.days["A"]!;
    expect(dayA.label).toBe("Heavy Squat + Horizontal Push/Pull");
    expect(dayA.entries).toHaveLength(6);

    // First entry: barbell-back-squat with 2 set blocks
    const squat = dayA.entries[0]!;
    expect(squat.kind).toBe("exercise");
    if (squat.kind === "exercise") {
      expect(squat.exerciseId).toBe("barbell-back-squat");
      expect(squat.setBlocks).toHaveLength(2);
      expect(squat.setBlocks[0]!.tag).toBe("top");
      expect(squat.setBlocks[0]!.count).toBe(1);
      expect(squat.setBlocks[1]!.count).toBe(3);
      expect(squat.notes).toBe("Hard top set, 30-60 sec rest");
    }

    // Fourth entry: superset (dumbbell-bench-press + dumbbell-row)
    const superset = dayA.entries[3]!;
    expect(superset.kind).toBe("superset");
    if (superset.kind === "superset") {
      expect(superset.items[0]!.exerciseId).toBe("dumbbell-bench-press");
      expect(superset.items[1]!.exerciseId).toBe("dumbbell-row");
      expect(superset.items[1]!.notes).toBe("Each arm");
    }

    // Verify day B
    const dayB = routine.days["B"]!;
    expect(dayB.label).toBe("Moderate Hinge + Vertical Push/Pull");
    expect(dayB.entries).toHaveLength(7);

    // Wrist roller uses duration target
    const wristRoller = dayB.entries[6]!;
    if (wristRoller.kind === "exercise") {
      expect(wristRoller.exerciseId).toBe("wrist-roller");
      expect(wristRoller.setBlocks[0]!.targetKind).toBe("duration");
      expect(wristRoller.setBlocks[0]!.minValue).toBe(30);
      expect(wristRoller.setBlocks[0]!.maxValue).toBe(60);
    }

    // Verify day C
    const dayC = routine.days["C"]!;
    expect(dayC.label).toBe("Unilateral + Accessories");
    expect(dayC.entries).toHaveLength(6);

    // Medicine ball rotational slam uses exact reps
    const medBall = dayC.entries[5]!;
    if (medBall.kind === "exercise") {
      expect(medBall.exerciseId).toBe("medicine-ball-rotational-slam");
      expect(medBall.setBlocks[0]!.targetKind).toBe("reps");
      expect(medBall.setBlocks[0]!.exactValue).toBe(8);
      expect(medBall.setBlocks[0]!.count).toBe(3);
    }

    // Verify notes and cardio
    expect(routine.notes).toHaveLength(2);
    expect(routine.notes[0]).toContain("Rotation is continuous");
    expect(routine.cardio).not.toBeNull();
    expect(routine.cardio!.options).toHaveLength(3);
    expect(routine.cardio!.options[0]!.name).toBe("Walk");
  });
});

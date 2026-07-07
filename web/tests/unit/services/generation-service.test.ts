import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  generateRoutine,
  MAX_REPAIR_ATTEMPTS,
} from "@/services/generation-service";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "@/services/llm/types";
import type { GeneratedRoutine } from "@/services/llm/routine-schema";
import type { Answers } from "@/features/onboarding/lib/types";

const answers: Answers = {
  goal: { kind: "chip", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "2" },
  equipment: { kind: "chip-multi", values: ["Barbell"] },
  supersets: { kind: "chip", value: "No" },
  cardio: { kind: "chip", value: "No" },
};

function validGenerated(exerciseId = "barbell-back-squat"): GeneratedRoutine {
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
              exercise_id: exerciseId,
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

function providerReturning(...results: (GeneratedRoutine | Error)[]): {
  provider: LlmProvider;
  calls: ProviderMessage[][];
} {
  const calls: ProviderMessage[][] = [];
  let i = 0;
  const provider: LlmProvider = {
    async generateRoutine(_system, messages) {
      calls.push(messages.map((m) => ({ ...m })));
      const result = results[Math.min(i, results.length - 1)]!;
      i++;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { provider, calls };
}

let db: ExerciseLoggerDB;

beforeEach(async () => {
  // Fresh DB per test, seeded with one catalog exercise.
  indexedDB.deleteDatabase("ExerciseLoggerDB");
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
});

describe("generateRoutine", () => {
  it("returns a normalized routine on first-shot success", async () => {
    const { provider, calls } = providerReturning(validGenerated());
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routine.name).toBe("Test Plan");
      expect(result.routine.dayOrder).toEqual(["A"]);
    }
    expect(calls).toHaveLength(1);
    // First call carries only the user prompt.
    expect(calls[0]).toHaveLength(1);
    expect(calls[0]![0]!.role).toBe("user");
    expect(calls[0]![0]!.content).toContain("Build muscle");
  });

  it("repairs once when the first attempt has a semantic error", async () => {
    const { provider, calls } = providerReturning(
      validGenerated("not-a-real-exercise"),
      validGenerated()
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    // Repair call: user prompt + assistant JSON + repair instructions.
    expect(calls[1]).toHaveLength(3);
    expect(calls[1]![1]!.role).toBe("assistant");
    expect(calls[1]![2]!.role).toBe("user");
    expect(calls[1]![2]!.content).toContain("not-a-real-exercise");
  });

  it("gives up after MAX_REPAIR_ATTEMPTS repairs with a validation failure", async () => {
    const { provider, calls } = providerReturning(
      validGenerated("not-a-real-exercise")
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe("validation");
      expect(result.failure.validationErrors.length).toBeGreaterThan(0);
    }
    expect(calls).toHaveLength(1 + MAX_REPAIR_ATTEMPTS);
  });

  it("passes through a GenerationFailure thrown by the provider", async () => {
    const { provider } = providerReturning(
      new GenerationFailure("auth", "invalid key")
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("auth");
  });

  it("wraps an unknown provider error as kind 'unknown'", async () => {
    const { provider } = providerReturning(new Error("boom"));
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("unknown");
  });
});

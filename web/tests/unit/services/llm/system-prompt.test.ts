import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/services/llm/system-prompt";
import type { Exercise } from "@/domain/types";

const exercises: Exercise[] = [
  { id: "barbell-back-squat", name: "Barbell Back Squat", type: "weight", equipment: "barbell", muscleGroups: ["Legs"] },
  { id: "run-walk", name: "Run / Walk", type: "cardio", equipment: "cardio", muscleGroups: ["Full Body"] },
];

describe("buildSystemPrompt", () => {
  it("lists every catalog exercise with id, name, type, equipment, and muscle groups", () => {
    const prompt = buildSystemPrompt(exercises);
    expect(prompt).toContain("barbell-back-squat");
    expect(prompt).toContain("Barbell Back Squat");
    expect(prompt).toContain("run-walk");
    expect(prompt).toContain("(cardio, cardio)");
    expect(prompt).toContain("Legs");
  });

  it("states the rules the schema cannot enforce", () => {
    const prompt = buildSystemPrompt(exercises);
    expect(prompt).toContain("exactly 2");           // superset arity
    expect(prompt).toContain("equal total");          // superset balance
    expect(prompt).toContain("min_value");            // range rule wording
    expect(prompt).toContain("instance_label");       // duplicate-exercise rule
    expect(prompt).toContain("verbatim");             // catalog-ID rule
  });
});

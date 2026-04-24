import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import { validateAndNormalizeRoutine } from "@/services/routine-service";
import { loadEmbeddedCatalog } from "@/services/catalog-service";
import bundledYaml from "../../../data/routines/full-body-3day.yaml?raw";

describe("routine-service — bundled YAML baseline", () => {
  let exerciseLookup: Map<string, ReturnType<typeof loadEmbeddedCatalog>[number]>;

  beforeAll(() => {
    const exercises = loadEmbeddedCatalog();
    exerciseLookup = new Map(exercises.map((e) => [e.id, e]));
  });

  it("validates the bundled full-body-3day.yaml under current rules", async () => {
    const result = await validateAndNormalizeRoutine(bundledYaml, exerciseLookup);
    if (!result.ok) {
      // Surface every error path so failures are diagnosable.
      const messages = result.errors
        .map((e) => `  - ${e.path}: ${e.message}`)
        .join("\n");
      throw new Error(`bundled YAML failed validation:\n${messages}`);
    }
    expect(result.ok).toBe(true);
  });
});

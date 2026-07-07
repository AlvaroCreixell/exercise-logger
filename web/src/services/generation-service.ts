// Orchestrates one routine generation: build prompts → provider round trip →
// convert structured output to the YAML-contract shape → domain validation →
// automatic repair loop. Pure service: no React, provider injected for
// testability, db is only read (exercises table).

import type { ExerciseLoggerDB } from "@/db/database";
import type { Routine } from "@/domain/types";
import type { Answers } from "@/features/onboarding/lib/types";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import {
  validateRoutineObject,
  type ValidationError,
} from "@/services/routine-service";
import { toRawRoutine } from "@/services/llm/routine-schema";
import { buildSystemPrompt } from "@/services/llm/system-prompt";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "@/services/llm/types";

/** Repair round-trips after the initial attempt (spec: max 2). */
export const MAX_REPAIR_ATTEMPTS = 2;

export type GenerationResult =
  | { ok: true; routine: Routine }
  | { ok: false; failure: GenerationFailure };

function buildRepairPrompt(errors: ValidationError[]): string {
  const lines = errors
    .map((e) => (e.path === "" ? `- ${e.message}` : `- ${e.path}: ${e.message}`))
    .join("\n");
  return (
    "Your previous routine failed validation with these errors:\n\n" +
    `${lines}\n\n` +
    "Fix exactly these problems and return the complete corrected routine. " +
    "Do not change anything that was not flagged.\n\n" +
    "Note: error paths refer to a converted form of your routine — " +
    "`days.<id>` means the entry in your `days` array with that `id`, and " +
    "`reps`/`duration`/`distance` values (or `[min, max]` ranges) correspond " +
    "to your `target_kind` with `exact_value` (or `min_value`/`max_value`)."
  );
}

function toFailure(err: unknown): GenerationFailure {
  if (err instanceof GenerationFailure) return err;
  const message = err instanceof Error ? err.message : "Generation failed";
  return new GenerationFailure("unknown", message);
}

/**
 * Generate, validate, and normalize a routine from questionnaire answers.
 * Never throws — every outcome is a GenerationResult.
 */
export async function generateRoutine(
  db: ExerciseLoggerDB,
  answers: Answers,
  provider: LlmProvider
): Promise<GenerationResult> {
  const exercises = await db.exercises.toArray();
  const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
  const system = buildSystemPrompt(exercises);

  let userPrompt: string;
  try {
    userPrompt = buildPrompt(answers);
  } catch (err) {
    return { ok: false, failure: toFailure(err) };
  }

  const messages: ProviderMessage[] = [{ role: "user", content: userPrompt }];
  let lastErrors: ValidationError[] = [];

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    let generated;
    try {
      generated = await provider.generateRoutine(system, messages);
    } catch (err) {
      return { ok: false, failure: toFailure(err) };
    }

    const result = validateRoutineObject(toRawRoutine(generated), lookup);
    if (result.ok) {
      return { ok: true, routine: result.routine };
    }

    lastErrors = result.errors;
    messages.push({ role: "assistant", content: JSON.stringify(generated) });
    messages.push({ role: "user", content: buildRepairPrompt(result.errors) });
  }

  return {
    ok: false,
    failure: new GenerationFailure(
      "validation",
      "The generated routine failed validation after automatic repairs.",
      lastErrors
    ),
  };
}

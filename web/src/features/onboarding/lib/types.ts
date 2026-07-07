/**
 * Answer-shape contract for the onboarding questionnaire.
 *
 * Consumed by:
 *   - features/onboarding/lib/prompt-builder.ts (builds the LLM user prompt)
 *   - features/onboarding/lib/questionnaire-state.ts (wizard reducer)
 *   - features/onboarding/GenerationScreen.tsx (reads Answers out of wizard
 *     state and passes them to generation-service.generateRoutine)
 *
 * These 11 StepIds correspond 1-to-1 with the 11 intake topics the system
 * prompt expects (see services/llm/system-prompt.ts) — originally the intake
 * topics of the deprecated custom GPT (docs/custom-gpt/DEPRECATED.md).
 * The welcome/name screen at /onboarding is NOT part of this enum — it
 * writes `userName` directly via setUserName(), not through answers.
 */
export type StepId =
  | "goal"
  | "experience"
  | "restrictions"
  | "daysPerWeek"
  | "sessionLength"
  | "distinctDays"
  | "equipment"
  | "priorities"
  | "favoritesAvoid"
  | "supersets"
  | "cardio";

/**
 * A single answer. The `kind` discriminator tells consumers how to render
 * and serialize the payload.
 *
 *   - "chip":            single-select from a fixed list (e.g. experience).
 *   - "chip-multi":      multi-select (e.g. equipment, priorities).
 *   - "text":            free-text (restrictions).
 *   - "chip-with-other": single-select OR free-text "Other" (goal step 1).
 *                        When `value === "Other"`, `otherText` holds the
 *                        user's typed answer and becomes the prompt value.
 *   - "favorites-avoid": the two stacked text areas on step 9. Both are
 *                        optional and may be empty strings.
 */
export type Answer =
  | { kind: "chip"; value: string }
  | { kind: "chip-multi"; values: string[] }
  | { kind: "text"; value: string }
  | { kind: "chip-with-other"; value: string; otherText?: string }
  | { kind: "favorites-avoid"; favorites: string; avoid: string };

/**
 * Partial record because the user can submit the wizard with only the
 * required (non-optional) steps answered. Optional steps (restrictions,
 * priorities, favoritesAvoid) may be absent entirely — `buildPrompt`
 * omits them rather than rendering a placeholder.
 */
export type Answers = Partial<Record<StepId, Answer>>;

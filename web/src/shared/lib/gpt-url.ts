/**
 * Canonical URL for the Exercise Logger custom GPT that turns the
 * onboarding questionnaire answers into a routine YAML.
 *
 * Imported by:
 *   - features/settings/RoutineImportScreen (existing "Open GPT" link)
 *   - features/onboarding/HandoffScreen (Sprint D: window.open target)
 *
 * Keep in lockstep with the system prompt at
 * `docs/custom-gpt/workout-routine-gpt.instructions.md` — if the GPT is
 * re-created or re-linked, update both in the same commit.
 */
export const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";

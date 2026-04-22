import type { ExerciseLoggerDB } from "@/db/database";
import { nowISO } from "@/domain/timestamp";

/**
 * Mark onboarding as completed. Called after a successful YAML import on the
 * handoff screen's Stage 2. Idempotent — later calls overwrite the timestamp,
 * which is intentional: re-running the questionnaire re-stamps completion.
 */
export async function markOnboardingCompleted(
  db: ExerciseLoggerDB
): Promise<void> {
  await db.settings.update("user", { onboardingCompletedAt: nowISO() });
}

/**
 * Mark onboarding as skipped. Called by "Maybe later" on the welcome screen.
 * Leaves `onboardingCompletedAt` untouched — "skipped" is a weaker signal and
 * a later completion should set `onboardingCompletedAt` independently.
 */
export async function markOnboardingSkipped(
  db: ExerciseLoggerDB
): Promise<void> {
  await db.settings.update("user", { onboardingSkippedAt: nowISO() });
}

/**
 * Persist the generated prompt and its timestamp. Called by HandoffScreen's
 * Stage-1 "Copy prompt & open GPT" button — not on step-11 Next, so that a
 * user who backs out after the last step does not leave a stale saved prompt.
 *
 * Also resets `onboardingBannerDismissedAt` so a freshly generated prompt
 * causes the Today banner to reappear even if the user dismissed an older one.
 * This single source of truth is documented in the orchestration plan
 * (Appendix B) — do NOT duplicate the reset in HandoffScreen.
 */
export async function saveGeneratedPrompt(
  db: ExerciseLoggerDB,
  prompt: string
): Promise<void> {
  await db.settings.update("user", {
    lastGeneratedPrompt: prompt,
    lastGeneratedPromptAt: nowISO(),
    onboardingBannerDismissedAt: null,
  });
}

/**
 * Null out the saved prompt (both text and timestamp). Called by "Start over"
 * on the handoff screen. Does NOT clear `onboardingBannerDismissedAt` — if the
 * user explicitly dismissed the banner, their dismissal stands until a new
 * prompt is generated.
 */
export async function clearLastPrompt(db: ExerciseLoggerDB): Promise<void> {
  await db.settings.update("user", {
    lastGeneratedPrompt: null,
    lastGeneratedPromptAt: null,
  });
}

/**
 * Stamp the Today banner as dismissed. Resets the next time a new prompt is
 * saved (see `saveGeneratedPrompt`).
 */
export async function dismissOnboardingBanner(
  db: ExerciseLoggerDB
): Promise<void> {
  await db.settings.update("user", { onboardingBannerDismissedAt: nowISO() });
}

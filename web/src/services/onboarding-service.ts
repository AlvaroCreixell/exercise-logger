import type { ExerciseLoggerDB } from "@/db/database";
import { nowISO } from "@/domain/timestamp";

/**
 * Mark onboarding as completed. Called by GenerationScreen.handleAccept after
 * a generated routine is validated and activated (first-run only — the
 * caller checks onboardingCompletedAt === null so Settings re-entry doesn't
 * re-stamp completion). Idempotent — later calls overwrite the timestamp.
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
 * Stamp the Today banner as dismissed.
 */
export async function dismissOnboardingBanner(
  db: ExerciseLoggerDB
): Promise<void> {
  await db.settings.update("user", { onboardingBannerDismissedAt: nowISO() });
}

// sessionStorage persistence for the in-progress wizard state. Silent-fail on
// every error — private browsing (Safari), quota exceeded, or environments
// without sessionStorage (jsdom edge cases) must never surface an exception to
// the caller. Callers still see a "no resume" outcome via loadWizardState()
// returning null.

import type { WizardState } from "./questionnaire-state";

export const STORAGE_KEY = "exercise-logger:onboarding:in-progress";

function isWizardStateShape(value: unknown): value is WizardState {
  if (value === null || typeof value !== "object") return false;
  const v = value as { stepIndex?: unknown; answers?: unknown };
  return (
    typeof v.stepIndex === "number" &&
    typeof v.answers === "object" &&
    v.answers !== null
  );
}

export function saveWizardState(state: WizardState): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* silent — private browsing, quota, etc. */
  }
}

export function loadWizardState(): WizardState | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWizardStateShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearWizardState(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
}

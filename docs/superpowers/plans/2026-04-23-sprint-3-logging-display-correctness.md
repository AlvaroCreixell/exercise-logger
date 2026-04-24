# Sprint 3 — Logged-Set Display Correctness And Sheet UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit findings F3 (`SessionDetailExerciseCard` drops non-weight sets), F5 (cardio-extra distance-only validator dead-end), and F6 (`ConfirmDialog` swallows async errors). Plus Task 0: clear two backward-compat regressions reviewers flagged on Sprint 2's PR (#22) before any Sprint 3 work begins.

**Architecture:** Task 0 ships first as a hotfix branch+PR (validator regression repair). Then Sprint 3 work begins on a fresh branch. Part A introduces a single shared `formatLoggedSet` pure helper in `web/src/shared/lib/`, and migrates the three current formatter sites (`SetRow`, `SessionDetailExerciseCard`, `ExerciseHistoryScreen`) to consume it. Part B teaches `isSetInputEmpty` a cardio-extra mode and wires it through `SetLogSheet`. Part C adds an optional `onError` prop and a default `toast.error` fallback to `ConfirmDialog`. Two new Playwright scenarios verify the user-visible fixes.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Vitest 4, Playwright 1.58, jsdom 29, sonner (toast). No new runtime dependencies. The shared helper lives at `web/src/shared/lib/formatLoggedSet.ts` and is pure (no React, no Dexie).

**Decisions resolved (defaulted from roadmap):**
- Cardio-extra duration+distance display format remains `"30s"` (no `mm:ss`); changing it is out of scope.
- Once the shared formatter is in place, the per-screen formatters (`SetRow.formatLoggedValue`, `SessionDetailExerciseCard.formatPillContent`, `ExerciseHistoryScreen` inline ternary) are deleted, not deprecated.
- Cardio-extra validator gets a flag-based mode (Option A from the roadmap), not a new `targetKind` enum value.
- `ConfirmDialog`'s default error path uses `sonner`'s `toast.error`. Existing callers that already toast themselves keep their explicit handlers; we do not silently double-toast (callers passing `onError` opt out of the default).

---

## PR Review Context — The Sprint 2 Hotfix (Task 0)

After Sprint 2 merged (PR #22, commit `2b6afc1`), CodeRabbit and Codex both posted P1/Major findings on `web/src/services/backup-service.ts`. Both are **real backward-compat regressions** introduced by Sprint 2's validator hardening. They violate documented invariants and affect users with legacy backups OR backups containing sessions whose routines were later deleted.

### Regression A — `validateSettings` rejects `undefined` onboarding fields

**Verified at `web/src/services/backup-service.ts:854-883` (post-Sprint 2 state).** The new validator calls `isStringOrNull(s.userName)` and `isStringOrNull(s[field])` for the five timestamps. `isStringOrNull(undefined)` returns `false`, so any backup produced *before* the onboarding fields were added to the `Settings` shape (where these six keys are simply absent rather than set to `null`) now fails validation.

The audit's own logic refutes the bug: my comment at `backup-service.ts:866-869` says we deliberately don't enforce ISO format on timestamps to avoid rejecting backups from minor format drift. The same reasoning applies to existence — and Sprint 2 missed it. Worse, `importBackup` at lines 1027-1032 explicitly uses `?? null` to tolerate omission, so the validator is now stricter than the importer it gates.

### Regression B — `Session.routineId` FK rejects sessions whose routine was deleted

**Verified at `web/src/services/backup-service.ts:1113-1124` (Task 6 of Sprint 2) and `web/src/services/settings-service.ts:80-110` (`deleteRoutine`).** `deleteRoutine` removes the routine record but does NOT update historical sessions' `routineId`. A backup taken after a routine deletion legitimately contains sessions whose `routineId` points at a now-missing routine.

This violates **invariant 5** ("Finished sessions remain renderable after routine deletion") — a documented domain invariant supported by the snapshot pattern (`routineNameSnapshot`, `dayLabelSnapshot`, `dayOrderSnapshot` etc. on `Session`). My check now rejects backups that the runtime gracefully handles.

### What we're not addressing (and why)

- **CodeRabbit nitpicks #3-#5** on PR #22 (test coverage suggestions, plan-doc Windows path, plan-doc `findBy*/waitFor` JSDoc) are deferred. Coverage is already strong; the plan-doc text only affects future copy-paste — code is correct. We do tick the JSDoc fix opportunistically in Task 0 because we're already touching the test file, but it's not load-bearing.

---

## File Structure

Two phases, distinct branches.

### Task 0 — Sprint 2 Hotfix (separate `hotfix/...` branch, merged before Sprint 3 starts)

- **Modify** `web/src/services/backup-service.ts` — accept `undefined` for the six onboarding fields; remove `Session.routineId` FK check.
- **Modify** `web/tests/unit/services/backup-service.test.ts` — add 2 new tests (legacy settings without onboarding fields; backup with stale routineId after deleteRoutine).
- **Optional opportunistic** `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md` — fix the `findBy*/waitFor` JSDoc snippet (CodeRabbit PR #21 nit).

### Sprint 3 work (Tasks 1–11, on `sprint-3/...` branch)

- **Create** `web/src/shared/lib/formatLoggedSet.ts` — pure helper, ~50 LoC.
- **Create** `web/tests/unit/shared/lib/formatLoggedSet.test.ts` — comprehensive coverage (~10-12 tests).
- **Modify** `web/src/features/workout/SetRow.tsx` — replace local `formatLoggedValue`.
- **Modify** `web/src/features/history/SessionDetailExerciseCard.tsx` — replace local `formatPillContent` (closes F3).
- **Modify** `web/src/features/history/ExerciseHistoryScreen.tsx` — replace inline ternary chain.
- **Modify** `web/src/features/workout/set-log-validation.ts` — add `cardioExtra` option (closes F5).
- **Modify** `web/src/features/workout/SetLogSheet.tsx` — pass `cardioExtra: isCardioExtra` and adjust error toast wording.
- **Modify** `web/tests/unit/features/workout/set-log-validation.test.ts` (or co-located) — cover new cardio-extra cases.
- **Modify** `web/src/shared/components/ConfirmDialog.tsx` — add `onError` prop + default `toast.error` (closes F6).
- **Create or modify** `web/tests/unit/shared/components/ConfirmDialog.test.tsx` — error-path tests.
- **Create** `web/tests/e2e/session-detail-non-weight.spec.ts` (or extend an existing e2e file) — Playwright scenario for bodyweight session-detail rendering.
- **Create** `web/tests/e2e/cardio-extra-distance.spec.ts` (or extend an existing e2e file) — Playwright scenario for cardio-extra distance-only logging.
- **Modify** `web/src/features/history/CLAUDE.md` — note where the formatter lives (one-line update).
- **Update** roadmap and this plan's exit criteria on close.

---

## Working Directory Assumption

All `npm` and `git` commands run from `C:/Users/creix/VSC Projects/exercise_logger/web` unless explicitly noted. Repo root is `C:/Users/creix/VSC Projects/exercise_logger`.

---

## Task 0: Sprint 2 Validator Hotfix (Standalone PR)

**Branch:** `hotfix/sprint-2-backup-validator` — short-lived. Merge before any Sprint 3 work begins.

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`
- Optionally modify: `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md`

- [ ] **Step 1: Confirm clean state on `main` and create the hotfix branch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git checkout main
git pull
git status --short
git log --oneline -3
```

Expected: clean (or only `?? ../docs/superpowers/plans/2026-04-23-sprint-3-logging-display-correctness.md` untracked — the plan doc you are reading). Recent log shows `2b6afc1 feat: data trust hardening (sprint 2) (#22)` near the top.

```bash
git checkout -b hotfix/sprint-2-backup-validator
```

- [ ] **Step 2: Write the two failing regression tests**

Append to `web/tests/unit/services/backup-service.test.ts`, as a sibling describe to the Sprint 2 ones:

```ts
describe("Sprint 2 hotfix — backward-compat", () => {
  it("accepts a legacy settings object that omits the six onboarding fields", () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    // Remove the six onboarding keys entirely (legacy pre-onboarding shape).
    const settingsObj = payload.data.settings as Record<string, unknown>;
    delete settingsObj.userName;
    delete settingsObj.onboardingCompletedAt;
    delete settingsObj.onboardingSkippedAt;
    delete settingsObj.lastGeneratedPrompt;
    delete settingsObj.lastGeneratedPromptAt;
    delete settingsObj.onboardingBannerDismissedAt;
    const errors = validateBackupPayload(payload, cat);
    // None of the six onboarding fields should produce errors when omitted.
    const onboardingFields = [
      "userName",
      "onboardingCompletedAt",
      "onboardingSkippedAt",
      "lastGeneratedPrompt",
      "lastGeneratedPromptAt",
      "onboardingBannerDismissedAt",
    ];
    for (const f of onboardingFields) {
      expect(errors.filter((e) => e.field === `data.settings.${f}`)).toEqual([]);
    }
  });

  it("accepts a backup whose Session.routineId references a routine no longer in routines (post-deleteRoutine)", () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    // Simulate deleteRoutine: the session retains its routineId, but the
    // routine has been removed from the routines collection. The runtime
    // tolerates this via Session snapshot fields (invariant 5).
    payload.data.routines = []; // routine deleted
    payload.data.settings.activeRoutineId = null; // settings would be updated by deleteRoutine
    // payload.data.sessions[0].routineId still equals "r1" (the original makeMinimalValidPayload value).
    const errors = validateBackupPayload(payload, cat);
    // The Session.routineId field MUST NOT produce an error when the
    // referenced routine is missing — invariant 5: history survives routine
    // deletion via snapshots.
    expect(errors.filter((e) => e.field === "data.sessions[0].routineId")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the new tests; confirm both fail**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 hotfix — backward-compat" 2>&1 | tail -25
```

Expected: 2 of 2 FAIL.

- The first fails because `isStringOrNull(undefined)` returns false → 6 errors pushed.
- The second fails because `isString(rId) && !routineIds.has(rId)` evaluates true for the now-missing routine → 1 error pushed.

- [ ] **Step 4: Apply Regression A fix — accept `undefined` for onboarding fields**

In `web/src/services/backup-service.ts`, find `validateSettings` (around lines 825-886). Change the `userName` block from:

```ts
  // userName: string-or-null; codepoint length <= 40 (mirrors setUserName).
  if (!isStringOrNull(s.userName)) {
    errors.push({
      field: `${path}.userName`,
      message: "must be a string or null",
    });
  } else if (typeof s.userName === "string" && Array.from(s.userName).length > 40) {
```

to:

```ts
  // userName: string-or-null OR undefined for legacy backups. importBackup
  // normalizes missing fields to null via `?? null`. Mirrors setUserName's
  // codepoint-length truncation when present.
  if (s.userName !== undefined && !isStringOrNull(s.userName)) {
    errors.push({
      field: `${path}.userName`,
      message: "must be a string or null",
    });
  } else if (typeof s.userName === "string" && Array.from(s.userName).length > 40) {
```

And change the timestamp loop from:

```ts
  for (const field of [
    "onboardingCompletedAt",
    "onboardingSkippedAt",
    "lastGeneratedPrompt",
    "lastGeneratedPromptAt",
    "onboardingBannerDismissedAt",
  ] as const) {
    if (!isStringOrNull(s[field])) {
      errors.push({
        field: `${path}.${field}`,
        message: "must be a string or null",
      });
    }
  }
```

to:

```ts
  // Five timestamp fields: each string-or-null OR undefined for legacy
  // backups. importBackup normalizes missing fields to null via `?? null`,
  // matching live setter behavior. ISO format is intentionally not enforced.
  for (const field of [
    "onboardingCompletedAt",
    "onboardingSkippedAt",
    "lastGeneratedPrompt",
    "lastGeneratedPromptAt",
    "onboardingBannerDismissedAt",
  ] as const) {
    if (s[field] !== undefined && !isStringOrNull(s[field])) {
      errors.push({
        field: `${path}.${field}`,
        message: "must be a string or null",
      });
    }
  }
```

Two single-line guard additions. The codepoint-length check is unchanged (only runs when `userName` is a string).

- [ ] **Step 5: Apply Regression B fix — drop the `Session.routineId` FK check**

In `web/src/services/backup-service.ts`, find the Sprint 2 routineId check (around lines 1113-1124):

```ts
  // Sprint 2: Session.routineId, when non-null, must reference an imported routine.
  sessions.forEach((s, i) => {
    if (typeof s !== "object" || s === null) return;
    const sObj = s as Record<string, unknown>;
    const rId = sObj.routineId;
    if (isString(rId) && !routineIds.has(rId)) {
      errors.push({
        field: `data.sessions[${i}].routineId`,
        message: `references routine "${rId}" which is not in the imported routines`,
      });
    }
  });
```

Replace the entire block with:

```ts
  // Sprint 2 hotfix: do NOT require Session.routineId to reference a current
  // routine. After deleteRoutine, historical sessions retain their stale
  // routineId by design — invariant 5 ("history survives routine deletion")
  // is supported via snapshot fields (routineNameSnapshot, dayLabelSnapshot,
  // dayOrderSnapshot). Rejecting backups with stale routineIds would block
  // restore for any user who had ever deleted a routine.
  // Type-only check on routineId is performed in validateSession.
```

(A comment-only stub. We keep the comment so a future reader knows why the block isn't there.)

- [ ] **Step 6: Run the regression tests; confirm both pass**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 hotfix — backward-compat" 2>&1 | tail -15
```

Expected: 2 of 2 pass.

- [ ] **Step 7: Run the full backup-service file**

```bash
npm test -- tests/unit/services/backup-service.test.ts 2>&1 | tail -10
```

Expected: 67 passed (65 from Sprint 2 + 2 new). If a Sprint 2 test that asserted on `Session.routineId` rejection fails, that test is itself the regression — update its expectation to match the corrected semantic. Specifically: any test in the "extended referential integrity" Sprint 2 describe that asserted a `data.sessions[0].routineId` error must now assert that no such error is produced. Read the test, decide if it's still meaningful (probably not — drop it), and either delete it or repurpose.

Specifically check this test in the existing file:

```ts
it("rejects a Session.routineId that doesn't reference an imported routine", () => {
  // ...
  expect(errors.some((e) =>
    e.field === "data.sessions[0].routineId" &&
    /not in the imported routines/i.test(e.message)
  )).toBe(true);
});
```

This test now contradicts the hotfix. **Delete it.** Do NOT invert it (the inverted version is now covered by the new "accepts a backup whose Session.routineId references a routine no longer in routines" test in Step 2 — semantic duplication).

- [ ] **Step 8: Run the full backup-service file once more after the test cleanup**

```bash
npm test -- tests/unit/services/backup-service.test.ts 2>&1 | tail -10
```

Expected: 66 passed (65 - 1 deleted + 2 new).

- [ ] **Step 9: Optional — fix the plan-doc `findBy*/waitFor` JSDoc**

Edit `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md`. Find the embedded JSDoc snippet (around line 348-351) that reads:

```
/** Timeout used for all findBy*/waitFor calls in this suite. 4000ms is
 * comfortably below Vitest's 5000ms per-test limit and well above the
 * observed async cost of useAppInit + useSettings on slow workers. */
```

Change `findBy*/waitFor` to `findBy* / waitFor` (add spaces around the slash). The actual committed test file already has the spaced form; this is just plan-doc cleanup.

- [ ] **Step 10: Commit the hotfix**

Stage the source, the test changes, and (if done) the plan doc:

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
# If you did Step 9:
# git add ../docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md

git commit -m "$(cat <<'EOF'
fix(backup): restore backward-compat for legacy backups (sprint 2 hotfix)

Sprint 2's validator hardening introduced two backward-compat
regressions that CodeRabbit and Codex flagged on PR #22:

1. validateSettings rejected `undefined` for the six onboarding
   fields. Pre-onboarding backups omit these keys; importBackup
   already normalizes them to null via `?? null`. Validator was
   stricter than the importer it gated. Fix: accept `undefined`
   as equivalent to `null` for `userName` and the five timestamp
   fields.

2. validateBackupPayload's Session.routineId FK check rejected
   any backup containing sessions whose routine was later deleted.
   `deleteRoutine` removes the routine record but does not update
   historical sessions' routineId — invariant 5 ("history survives
   routine deletion") is supported via snapshot fields. Fix: drop
   the FK check entirely; replace with a documenting comment.

Removes the now-incorrect Sprint 2 test that asserted the FK check
fired. Adds two new regression tests covering both legacy shapes.

Closes CodeRabbit PR #22 review thread; closes Codex P1 findings.
EOF
)"
```

- [ ] **Step 11: Push and open the hotfix PR**

```bash
git push -u origin hotfix/sprint-2-backup-validator
gh pr create --title "fix: restore backward-compat for legacy backups (sprint 2 hotfix)" --body "$(cat <<'EOF'
## Summary

Repairs two backward-compat regressions introduced by Sprint 2 (PR #22, commit `2b6afc1`). Both were flagged by CodeRabbit (Major) and Codex (P1) on the Sprint 2 PR.

### Regression A — onboarding fields rejected `undefined`

`validateSettings` in `backup-service.ts` called `isStringOrNull(s.userName)` and `isStringOrNull(s[field])` for the five onboarding timestamp fields. `isStringOrNull(undefined)` returns `false`, so any backup produced before these fields existed in the schema (where the keys are simply absent rather than null) failed validation. Meanwhile `importBackup` at lines 1027-1032 explicitly used `?? null` to tolerate omission — the validator was stricter than the importer it gated.

**Fix:** wrap each onboarding-field check with `s.field !== undefined && !isStringOrNull(...)`. ISO-format strictness was already deferred for similar reasons (line 866-869 comment); this aligns existence-strictness to the same logic.

### Regression B — `Session.routineId` FK rejected deleted-routine sessions

The Sprint 2 check at `backup-service.ts:1113-1124` required `Session.routineId` (when non-null) to reference an imported routine. But `deleteRoutine` (`settings-service.ts:80-110`) deletes the routine record without nulling out historical sessions' `routineId`. Backups taken after a routine deletion legitimately contain sessions with stale routineIds, and the runtime renders them via snapshot fields (invariant 5).

**Fix:** drop the FK check; replace with a documenting comment stub. Type-only validation of `routineId` (string-or-null) remains in `validateSession`.

### Tests

- Removed the now-incorrect Sprint 2 test asserting the FK check fired.
- Added two regression tests covering both legacy shapes (legacy settings without onboarding fields; backup with stale routineId).

## Evidence

- 66 of 66 backup-service tests pass.
- Full suite: 907 → ~906 (one deleted, two added — net +1).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 12: Watch CI, merge, cleanup**

```bash
gh pr checks --watch
```

If green:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git remote prune origin
```

Expected: on `main` with the hotfix squash commit at `HEAD`.

- [ ] **Step 13: Confirm hotfix is on main**

```bash
git log --oneline -3
npm test 2>&1 | tail -5
```

Expected: hotfix commit visible; full suite passes with new total. Record the new total — this is the baseline for Sprint 3 work.

---

## Task 1: Sprint 3 Branch + Baseline

**Files:** None modified.

- [ ] **Step 1: Create the Sprint 3 branch from main (with hotfix landed)**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git checkout main
git pull
git checkout -b sprint-3/logging-display-correctness
```

- [ ] **Step 2: Capture baseline test counts**

```bash
npm test 2>&1 | tail -10
```

Expected: `Test Files 98 passed (98)` / `Tests ~906 passed`. The exact count depends on the hotfix PR's net (-1 + 2 = +1 vs. Sprint 2's 907). Record it.

- [ ] **Step 3: No commit in this task.**

---

## Task 2: Shared `formatLoggedSet` Pure Helper

**Files:**
- Create: `web/src/shared/lib/formatLoggedSet.ts`
- Create: `web/tests/unit/shared/lib/formatLoggedSet.test.ts`

Establish the canonical formatter before migrating any consumer.

- [ ] **Step 1: Write the failing test file**

Create `web/tests/unit/shared/lib/formatLoggedSet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  formatLoggedSet,
  formatLoggedSetParts,
} from "@/shared/lib/formatLoggedSet";

const baseSet = {
  performedWeightKg: null,
  performedReps: null,
  performedDurationSec: null,
  performedDistanceM: null,
};

describe("formatLoggedSet (compact)", () => {
  it("formats weight + reps with kg unit", () => {
    expect(formatLoggedSet({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "kg"))
      .toBe("80kg × 10");
  });

  it("formats weight + reps with lbs unit (display conversion)", () => {
    // 80kg ≈ 176.37lbs at canonical conversion. toDisplayWeight applies floating-
    // point cleanup but no equipment rounding, so the output is "176.37lbs × 10".
    const out = formatLoggedSet({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "lbs");
    expect(out).toMatch(/^176(\.\d+)?lbs × 10$/);
  });

  it("formats reps only (bodyweight)", () => {
    expect(formatLoggedSet({ ...baseSet, performedReps: 12 }, "kg"))
      .toBe("12 reps");
  });

  it("formats duration only (isometric)", () => {
    expect(formatLoggedSet({ ...baseSet, performedDurationSec: 30 }, "kg"))
      .toBe("30s");
  });

  it("formats distance only (cardio extra distance-only)", () => {
    expect(formatLoggedSet({ ...baseSet, performedDistanceM: 1000 }, "kg"))
      .toBe("1000m");
  });

  it("prefers reps over duration when both present (matches SetRow precedence)", () => {
    expect(formatLoggedSet({ ...baseSet, performedReps: 12, performedDurationSec: 30 }, "kg"))
      .toBe("12 reps");
  });

  it("returns the default fallback for an empty set", () => {
    expect(formatLoggedSet(baseSet, "kg")).toBe("—");
  });

  it("returns a custom fallback when provided", () => {
    expect(formatLoggedSet(baseSet, "kg", { fallback: "✓" })).toBe("✓");
  });
});

describe("formatLoggedSetParts (structured for custom layouts)", () => {
  it("returns weight+reps parts with kg unit", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "kg"))
      .toEqual({ primary: "80", unit: "kg", secondary: "10" });
  });

  it("returns reps-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedReps: 12 }, "kg"))
      .toEqual({ primary: "12", unit: "reps", secondary: null });
  });

  it("returns duration-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedDurationSec: 30 }, "kg"))
      .toEqual({ primary: "30", unit: "s", secondary: null });
  });

  it("returns distance-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedDistanceM: 500 }, "kg"))
      .toEqual({ primary: "500", unit: "m", secondary: null });
  });

  it("returns null for an empty set (caller handles fallback)", () => {
    expect(formatLoggedSetParts(baseSet, "kg")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test; confirm all 13 fail (module does not exist)**

```bash
npm test -- tests/unit/shared/lib/formatLoggedSet.test.ts 2>&1 | tail -20
```

Expected: failure with `Cannot find module '@/shared/lib/formatLoggedSet'` or similar resolver error.

- [ ] **Step 3: Implement the helper**

Create `web/src/shared/lib/formatLoggedSet.ts`:

```ts
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

/**
 * Subset of LoggedSet that this formatter needs. Accepting a structural type
 * (rather than the full LoggedSet) keeps the helper independent of the
 * domain layer's full record shape.
 */
export interface LoggedSetSubset {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

/**
 * Structured parts of a logged set, suitable for custom layouts (e.g.
 * SetRow renders primary/unit/secondary in separate spans with distinct
 * styling). Returns `null` when the set is empty (no performance fields
 * are non-null) — callers decide how to render empty.
 */
export interface LoggedSetParts {
  primary: string;
  unit: string | null;
  secondary: string | null;
}

/**
 * Render a logged set into its structured parts. Precedence (matches the
 * existing SetRow logic):
 * 1. weight + reps  → display weight, unit = kg/lbs, secondary = reps
 * 2. reps only      → primary = reps,  unit = "reps"
 * 3. duration only  → primary = sec,   unit = "s"
 * 4. distance only  → primary = m,     unit = "m"
 * 5. otherwise      → null
 */
export function formatLoggedSetParts(
  set: LoggedSetSubset,
  units: UnitSystem,
): LoggedSetParts | null {
  if (set.performedWeightKg !== null && set.performedReps !== null) {
    return {
      primary: String(toDisplayWeight(set.performedWeightKg, units)),
      unit: units,
      secondary: String(set.performedReps),
    };
  }
  if (set.performedReps !== null) {
    return { primary: String(set.performedReps), unit: "reps", secondary: null };
  }
  if (set.performedDurationSec !== null) {
    return { primary: String(set.performedDurationSec), unit: "s", secondary: null };
  }
  if (set.performedDistanceM !== null) {
    return { primary: String(set.performedDistanceM), unit: "m", secondary: null };
  }
  return null;
}

/**
 * Render a logged set as a compact string. Used for pills and hint strips
 * where a single-string output is preferred over per-part styling.
 *
 * Joining rules:
 * - weight unit (kg/lbs) is appended directly: "80kg"
 * - reps unit appears as " reps": "12 reps"
 * - duration "s" and distance "m" are appended directly: "30s", "500m"
 * - secondary (reps in weight+reps mode) joined with " × ": "80kg × 10"
 *
 * Returns `opts.fallback` (default `"—"`) when the set is empty.
 */
export function formatLoggedSet(
  set: LoggedSetSubset,
  units: UnitSystem,
  opts: { fallback?: string } = {},
): string {
  const parts = formatLoggedSetParts(set, units);
  if (parts === null) return opts.fallback ?? "—";
  let result = parts.primary;
  if (parts.unit === "reps") {
    result += " reps";
  } else if (parts.unit !== null) {
    // weight (kg/lbs), duration "s", distance "m" — all append directly
    result += parts.unit;
  }
  if (parts.secondary !== null) {
    result += " × " + parts.secondary;
  }
  return result;
}
```

- [ ] **Step 4: Run the test; confirm 13 of 13 pass**

```bash
npm test -- tests/unit/shared/lib/formatLoggedSet.test.ts 2>&1 | tail -10
```

Expected: 13 of 13 pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/formatLoggedSet.ts tests/unit/shared/lib/formatLoggedSet.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): add formatLoggedSet pure helper

Single source of truth for rendering LoggedSet performance fields,
both as a compact string (formatLoggedSet) and as structured parts
(formatLoggedSetParts) for custom layouts. Pure module — no React,
no Dexie. Lives in shared/lib so both workout and history features
can consume it.

Precedence matches existing SetRow logic:
- weight+reps: "80kg × 10" / parts: {primary, unit, secondary}
- reps only:   "12 reps"
- duration:    "30s"
- distance:    "500m"
- empty:       "—" (or caller-supplied fallback)

Subsequent tasks migrate SetRow, SessionDetailExerciseCard, and
ExerciseHistoryScreen to consume this helper.

Part of sprint-3/logging-display-correctness (F3).
EOF
)"
```

---

## Task 3: Migrate `SetRow` To Use `formatLoggedSetParts`

**Files:**
- Modify: `web/src/features/workout/SetRow.tsx`

`SetRow.formatLoggedValue` is the canonical reference today; we replace it with the shared helper. Behavior must not change.

- [ ] **Step 1: Read current `SetRow.tsx` and confirm the local function**

Open `web/src/features/workout/SetRow.tsx`. Confirm `formatLoggedValue` exists at lines ~21-46. The render at lines ~76-90 consumes `{primary, unit, secondary}` exactly.

- [ ] **Step 2: Apply the migration**

In `web/src/features/workout/SetRow.tsx`:

1. Remove the import of `toDisplayWeight` from `@/domain/unit-conversion` (no longer used directly).
2. Add import: `import { formatLoggedSetParts } from "@/shared/lib/formatLoggedSet";`
3. Delete the local `formatLoggedValue` function entirely (lines 21-46).
4. Replace its sole call site (around line 59) `const { primary, unit, secondary } = formatLoggedValue(loggedSet, units);` with:

```ts
    const parts = formatLoggedSetParts(loggedSet, units);
    const primary = parts?.primary ?? "✓";
    const unit = parts?.unit ?? null;
    const secondary = parts?.secondary ?? null;
```

Behavior preservation:
- Weight+reps, reps-only, duration, distance: identical output (the helper returns the same shape).
- Empty (all four null): the local function returned `{ primary: "✓", unit: null, secondary: null }`. The new code reproduces this via the `?? "✓"` defaults.

- [ ] **Step 3: Run the workout-feature unit tests to catch regressions**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- tests/unit/features/workout 2>&1 | tail -15
```

Expected: all pass. If a SetRow render snapshot changes, investigate — the parts shape should be identical to the old function's output.

- [ ] **Step 4: Run the full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: same total as Task 1 baseline + the 13 new formatLoggedSet tests = ~919.

- [ ] **Step 5: Commit**

```bash
git add src/features/workout/SetRow.tsx
git commit -m "$(cat <<'EOF'
refactor(workout): migrate SetRow to shared formatLoggedSetParts

Drop the local formatLoggedValue function in favor of the shared
formatLoggedSetParts helper added in the previous commit. Behavior
is preserved: weight+reps, reps-only, duration, distance all render
identically; the empty-set fallback "✓" is preserved via the parts
defaults.

Part of sprint-3/logging-display-correctness (F3 cleanup).
EOF
)"
```

---

## Task 4: Migrate `SessionDetailExerciseCard` (Closes F3 Dash Bug)

**Files:**
- Modify: `web/src/features/history/SessionDetailExerciseCard.tsx`

This is the closing fix for F3. Today the pill renders `"—"` for any non-(weight+reps) set; after this task it renders the actual logged value.

- [ ] **Step 1: Write a failing component test**

Create or extend a test file at `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`. If the file exists, append tests; if not, create it with the existing pattern from sibling component test files.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionDetailExerciseCard } from "@/features/history/SessionDetailExerciseCard";
import type { LoggedSet } from "@/domain/types";

function makeLoggedSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls-test",
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "test-ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-23T10:00:00.000Z",
    updatedAt: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("SessionDetailExerciseCard", () => {
  it("renders weight + reps as 'Wkg × R'", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Squat"
        loggedSets={[makeLoggedSet({ performedWeightKg: 80, performedReps: 10 })]}
        units="kg"
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /80kg × 10/ })).toBeInTheDocument();
  });

  it("renders reps-only as 'R reps' (was '—' pre-fix)", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Push-up"
        loggedSets={[makeLoggedSet({ performedReps: 12 })]}
        units="kg"
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /12 reps/ })).toBeInTheDocument();
  });

  it("renders duration-only as 'Ds' (was '—' pre-fix)", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Plank"
        loggedSets={[makeLoggedSet({ performedDurationSec: 60 })]}
        units="kg"
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /60s/ })).toBeInTheDocument();
  });

  it("renders distance-only as 'Dm' (was '—' pre-fix)", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Run"
        loggedSets={[makeLoggedSet({ performedDistanceM: 500 })]}
        units="kg"
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /500m/ })).toBeInTheDocument();
  });

  it("renders the dash for a truly empty set", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Empty"
        loggedSets={[makeLoggedSet({})]}
        units="kg"
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /—/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run; confirm 3 fail (reps-only, duration, distance) and 2 pass (weight+reps, empty)**

```bash
npm test -- tests/unit/features/history/SessionDetailExerciseCard.test.tsx 2>&1 | tail -20
```

Expected: 3 fail with the rendered text being `"—"` instead of the expected value; 2 pass.

- [ ] **Step 3: Apply the migration**

Replace the entire contents of `web/src/features/history/SessionDetailExerciseCard.tsx` with:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { formatLoggedSet } from "@/shared/lib/formatLoggedSet";

interface SessionDetailExerciseCardProps {
  exerciseName: string;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  onSetTap: (blockIndex: number, setIndex: number) => void;
}

export function SessionDetailExerciseCard({
  exerciseName,
  loggedSets,
  units,
  onSetTap,
}: SessionDetailExerciseCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">{exerciseName}</p>
        {loggedSets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {loggedSets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onSetTap(set.blockIndex, set.setIndex)}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-sage-soft px-2.5 py-1 text-xs font-medium tabular-nums text-sage-deep transition-colors hover:bg-sage-soft/70 focus-visible:ring-2 focus-visible:ring-sage/40 outline-none"
                >
                  {formatLoggedSet(set, units)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

Removed: `toDisplayWeight` import, local `formatPillContent` function. Added: `formatLoggedSet` import.

- [ ] **Step 4: Run the new tests; confirm 5 of 5 pass**

```bash
npm test -- tests/unit/features/history/SessionDetailExerciseCard.test.tsx 2>&1 | tail -10
```

Expected: 5 of 5 pass.

- [ ] **Step 5: Run the full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all green; total +5 vs. Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/features/history/SessionDetailExerciseCard.tsx tests/unit/features/history/SessionDetailExerciseCard.test.tsx
git commit -m "$(cat <<'EOF'
fix(history): SessionDetailExerciseCard renders all set kinds (closes F3)

Replace the local formatPillContent — which returned "—" for any
non-(weight+reps) set — with the shared formatLoggedSet helper.
Bodyweight reps, isometric duration, distance, and cardio sets
now render their actual values instead of a dash on the session
detail screen.

Closes audit finding F3. Part of sprint-3/logging-display-correctness.
EOF
)"
```

---

## Task 5: Migrate `ExerciseHistoryScreen` Inline Formatter

**Files:**
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx`

ExerciseHistoryScreen has an inline ternary at lines 101-114 that mostly works but uses lowercase `x` instead of `×` and has minor formatting drift. Migrating yields one canonical form.

- [ ] **Step 1: Identify the affected block**

Open `web/src/features/history/ExerciseHistoryScreen.tsx`. Find the inline ternary inside the `groupSetsByBlock` rendering (lines ~100-114):

```tsx
{block.sets.map((ls, si) => {
  let text = "";
  if (ls.performedWeightKg != null && ls.performedReps != null) {
    const w = toDisplayWeight(
      ls.performedWeightKg,
      entryUnits
    );
    text = `${w}${entryUnits} x ${ls.performedReps}`;
  } else if (ls.performedReps != null) {
    text = `${ls.performedReps} reps`;
  } else if (ls.performedDurationSec != null) {
    text = `${ls.performedDurationSec}s`;
  } else if (ls.performedDistanceM != null) {
    text = `${ls.performedDistanceM}m`;
  }
  return (
    <span key={si} className="text-sm tabular-nums font-medium">
      {text}
    </span>
  );
})}
```

- [ ] **Step 2: Apply the migration**

1. Remove the `toDisplayWeight` import at the top of the file (no longer used).
2. Add: `import { formatLoggedSet } from "@/shared/lib/formatLoggedSet";`
3. Replace the entire inline block above with:

```tsx
{block.sets.map((ls, si) => (
  <span key={si} className="text-sm tabular-nums font-medium">
    {formatLoggedSet(ls, entryUnits, { fallback: "" })}
  </span>
))}
```

Visual change: `"80kg x 10"` becomes `"80kg × 10"` (true multiplication sign instead of letter `x`). This matches `SetRow` and `SessionDetailExerciseCard`. Empty sets render as the empty string instead of being silently omitted via the `text = ""` initializer — same visual.

- [ ] **Step 3: Run e2e + unit suites to catch any visible regression**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test 2>&1 | tail -5
```

If a snapshot or assertion test relied on the lowercase `x` literal, update it to `×`. Search for the old literal:

```bash
grep -rn "kg x [0-9]" tests/ 2>/dev/null || true
grep -rn "lbs x [0-9]" tests/ 2>/dev/null || true
```

Update any results to use `×`. The change is intentional (canonical formatting).

- [ ] **Step 4: Commit**

```bash
git add src/features/history/ExerciseHistoryScreen.tsx
# plus any test fixture updates from Step 3
git commit -m "$(cat <<'EOF'
refactor(history): migrate ExerciseHistoryScreen to formatLoggedSet

Drop the inline formatter ternary in favor of the shared
formatLoggedSet helper. Visible change: weight+reps lines now
read "80kg × 10" instead of "80kg x 10" (true multiplication
sign matches SetRow and SessionDetailExerciseCard). All other
formats unchanged.

Removes the third copy of logged-set formatting logic from the
codebase.

Part of sprint-3/logging-display-correctness (F3 cleanup).
EOF
)"
```

---

## Task 6: Update `features/history` CLAUDE.md

**Files:**
- Modify: `web/src/features/history/CLAUDE.md`

The Local Utilities section currently lists `sessionStats.ts`. It does not mention the new shared formatter. One-line note for discoverability.

- [ ] **Step 1: Add the formatter reference**

Open `web/src/features/history/CLAUDE.md`. Find the section that documents shared dependencies (something like "Hooks used" or a sibling). Add a line under a "Shared utilities used" subsection (or extend the existing "Hooks used" prose):

```markdown
- `formatLoggedSet` — `@/shared/lib/formatLoggedSet` — single source of truth for rendering a `LoggedSet` (used by `SessionDetailExerciseCard` pills and `ExerciseHistoryScreen` inline values).
```

If the file does not have an obvious place, add it immediately above "## Services called". Keep the addition minimal — one line.

- [ ] **Step 2: Commit (no test run needed for docs-only change)**

```bash
git add src/features/history/CLAUDE.md
git commit -m "docs(history): note shared formatLoggedSet helper"
```

---

## Task 7: Cardio-Extra Validator Fix (Closes F5)

**Files:**
- Modify: `web/src/features/workout/set-log-validation.ts`
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify or create: `web/tests/unit/features/workout/set-log-validation.test.ts`

`isSetInputEmpty` at `set-log-validation.ts:19` requires `performedDurationSec` whenever `targetKind === "duration"`. Cardio extras default `targetKind` to `"duration"` but expose a distance field — so a user can enter only distance and be blocked. The fix introduces a flag-based mode.

- [ ] **Step 1: Locate or create the validation test file**

Check whether `web/tests/unit/features/workout/set-log-validation.test.ts` exists.

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/tests/unit/features/workout/" | grep set-log-validation
```

If it does not exist, create it. If it does, append to the existing describe.

Test file content (full file if creating, otherwise append the new describe):

```ts
import { describe, it, expect } from "vitest";
import { isSetInputEmpty } from "@/features/workout/set-log-validation";

const baseInput = {
  performedWeightKg: null,
  performedReps: null,
  performedDurationSec: null,
  performedDistanceM: null,
};

describe("isSetInputEmpty — standard mode", () => {
  it("reps target needs reps", () => {
    expect(isSetInputEmpty("reps", baseInput)).toBe(true);
    expect(isSetInputEmpty("reps", { ...baseInput, performedReps: 10 })).toBe(false);
  });

  it("duration target needs duration", () => {
    expect(isSetInputEmpty("duration", baseInput)).toBe(true);
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30 })).toBe(false);
  });

  it("distance target needs distance", () => {
    expect(isSetInputEmpty("distance", baseInput)).toBe(true);
    expect(isSetInputEmpty("distance", { ...baseInput, performedDistanceM: 1000 })).toBe(false);
  });

  it("non-cardio-extra duration target rejects distance-only input", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDistanceM: 1000 })).toBe(true);
  });
});

describe("isSetInputEmpty — cardio extra mode", () => {
  it("accepts duration-only", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30 }, { cardioExtra: true })).toBe(false);
  });

  it("accepts distance-only (closes F5)", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDistanceM: 1000 }, { cardioExtra: true })).toBe(false);
  });

  it("accepts both duration and distance", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30, performedDistanceM: 1000 }, { cardioExtra: true })).toBe(false);
  });

  it("rejects neither (truly empty)", () => {
    expect(isSetInputEmpty("duration", baseInput, { cardioExtra: true })).toBe(true);
  });

  it("does not accept reps-only as a fallback for cardio extras", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedReps: 10 }, { cardioExtra: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run; confirm the cardio-extra describe fails (5 fails); standard describe passes**

```bash
npm test -- tests/unit/features/workout/set-log-validation.test.ts 2>&1 | tail -25
```

Expected: 5 cardio-extra tests fail with `Error: Expected ... but got ...` (the function ignores the `cardioExtra` option since it doesn't exist yet); standard-mode tests pass.

- [ ] **Step 3: Update `isSetInputEmpty`**

In `web/src/features/workout/set-log-validation.ts`, replace the entire current contents with:

```ts
import type { TargetKind } from "@/domain/enums";

interface SetInput {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

interface ValidationOptions {
  /**
   * When true, treats the input as a cardio-extra entry (no `SetBlock`,
   * `effectiveType === "cardio"`). Cardio extras accept any combination
   * of `performedDurationSec` and/or `performedDistanceM`. The `targetKind`
   * argument is ignored in this mode (cardio-extras default to `"duration"`
   * upstream, but the user is allowed to log either field).
   */
  cardioExtra?: boolean;
}

/**
 * Returns true if the set input has no meaningful performance data.
 *
 * Standard validation is target-aware:
 * - reps blocks require performedReps
 * - duration blocks require performedDurationSec
 * - distance blocks require performedDistanceM
 * Weight alone is never sufficient — the target metric must be present.
 *
 * Cardio-extra mode (opts.cardioExtra=true) accepts any non-null value
 * in performedDurationSec OR performedDistanceM, since cardio-extras
 * surface both fields and the user may log either or both.
 */
export function isSetInputEmpty(
  targetKind: TargetKind,
  input: SetInput,
  opts: ValidationOptions = {},
): boolean {
  if (opts.cardioExtra) {
    return input.performedDurationSec == null && input.performedDistanceM == null;
  }
  if (targetKind === "reps") return input.performedReps == null;
  if (targetKind === "duration") return input.performedDurationSec == null;
  if (targetKind === "distance") return input.performedDistanceM == null;
  return true;
}
```

- [ ] **Step 4: Wire the flag through `SetLogSheet`**

In `web/src/features/workout/SetLogSheet.tsx`, find the call site at line ~214:

```ts
    if (isSetInputEmpty(targetKind, input)) {
      toast.error("Enter at least " + (targetKind === "reps" ? "reps" : targetKind === "duration" ? "duration" : "distance") + " to save.");
      return;
    }
```

Replace with:

```ts
    if (isSetInputEmpty(targetKind, input, { cardioExtra: isCardioExtra })) {
      const requiredField = isCardioExtra
        ? "duration or distance"
        : targetKind === "reps"
          ? "reps"
          : targetKind === "duration"
            ? "duration"
            : "distance";
      toast.error(`Enter at least ${requiredField} to save.`);
      return;
    }
```

The `isCardioExtra` variable is already in scope at line 90.

- [ ] **Step 5: Run all unit tests**

```bash
npm test 2>&1 | tail -10
```

Expected: cardio-extra tests pass (10 in the validation file, +5 standard). No regressions elsewhere. If a SetLogSheet integration test asserts the toast message, update its expectation to match the new wording.

- [ ] **Step 6: Commit**

```bash
git add src/features/workout/set-log-validation.ts src/features/workout/SetLogSheet.tsx tests/unit/features/workout/set-log-validation.test.ts
git commit -m "$(cat <<'EOF'
fix(workout): cardio-extra distance-only logging works (closes F5)

isSetInputEmpty now accepts a `cardioExtra` option. When true,
the validator accepts any non-null value in performedDurationSec
OR performedDistanceM, matching the dual fields cardio extras
display in SetLogSheet. The save handler passes
{ cardioExtra: isCardioExtra } and adjusts the error toast to
say "duration or distance" for cardio-extra inputs.

Without this, a user adding cardio as an extra exercise (no
SetBlock → defaults to targetKind="duration") could see the
distance field, enter only distance, and be blocked by a
duration-required toast.

Closes audit finding F5. Part of sprint-3/logging-display-correctness.
EOF
)"
```

---

## Task 8: ConfirmDialog `onError` + Default Toast (Closes F6)

**Files:**
- Modify: `web/src/shared/components/ConfirmDialog.tsx`
- Modify or create: `web/tests/unit/shared/components/ConfirmDialog.test.tsx`

Today the dialog's `handleConfirm` catches errors silently, only resetting `pending`. After the change: callers get a toast by default (or a custom `onError` handler), and the dialog stays open.

- [ ] **Step 1: Locate or create the test file**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/tests/unit/shared/components/" | grep ConfirmDialog
```

If not present, create. Append/create with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("ConfirmDialog error surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onError when onConfirm rejects and onError is provided", async () => {
    const user = userEvent.setup();
    const err = new Error("boom");
    const onError = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { throw err; }}
        onError={onError}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onError).toHaveBeenCalledWith(err);
    expect(toast.error).not.toHaveBeenCalled();
    // Dialog should remain open (handleOpenChange(false) NOT called for the close path).
    // Cancel-path or success-path opens onOpenChange(false); error path does not.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falls back to toast.error when onError is not provided", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { throw new Error("kaboom"); }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(toast.error).toHaveBeenCalledWith("kaboom");
  });

  it("closes the dialog on a successful onConfirm", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { /* resolve */ }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run; confirm 2 fail (the error-path tests), 1 passes (success path)**

```bash
npm test -- tests/unit/shared/components/ConfirmDialog.test.tsx 2>&1 | tail -20
```

Expected: 2 of 3 fail (current implementation calls neither `onError` nor `toast.error`); 1 passes.

- [ ] **Step 3: Update `ConfirmDialog`**

In `web/src/shared/components/ConfirmDialog.tsx`, modify the props interface and the `handleConfirm` function. The full updated file:

```tsx
import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
  /**
   * Optional handler invoked when `onConfirm` rejects. When provided,
   * the default toast fallback is suppressed — the caller owns the
   * UX. When omitted, the dialog surfaces the error via
   * `toast.error(message)` so destructive actions cannot fail silently.
   * In both cases the dialog stays open after the error.
   */
  onError?: (err: unknown) => void;
  variant?: "default" | "destructive";
  doubleConfirm?: boolean;
  doubleConfirmText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  onError,
  variant = "default",
  doubleConfirm = false,
  doubleConfirmText = "Tap again to confirm",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [confirmedOnce, setConfirmedOnce] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmedOnce(false);
        setPending(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const handleConfirm = useCallback(async () => {
    if (doubleConfirm && !confirmedOnce) {
      setConfirmedOnce(true);
      return;
    }
    setPending(true);
    try {
      await onConfirm();
      handleOpenChange(false);
    } catch (err) {
      setPending(false);
      if (onError) {
        onError(err);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
      // Dialog remains open so the user can retry or cancel.
    }
  }, [doubleConfirm, confirmedOnce, onConfirm, onError, handleOpenChange]);

  const buttonLabel = doubleConfirm && confirmedOnce
    ? doubleConfirmText
    : confirmText;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-sm gap-3 p-5">
        <AlertDialogHeader className="gap-2">
          <AlertDialogTitle className="text-title-serif text-[1.35rem] leading-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-ink-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mx-0 mb-0 flex-row gap-2 border-none bg-transparent p-0 pt-1">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
            className="flex-1"
          >
            {pending ? "..." : buttonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Changes:
- Added `import { toast } from "sonner";`.
- Added optional `onError?: (err: unknown) => void;` prop.
- Replaced bare `catch { setPending(false); }` with a catch that calls `onError` (if provided) or `toast.error(message)` (default), and keeps `pending` false / dialog open.

- [ ] **Step 4: Run the new ConfirmDialog tests**

```bash
npm test -- tests/unit/shared/components/ConfirmDialog.test.tsx 2>&1 | tail -10
```

Expected: 3 of 3 pass.

- [ ] **Step 5: Audit existing callers for double-toast risk**

Check the existing callers found by `grep`:
- `web/src/features/history/SessionDetailScreen.tsx:209`
- `web/src/features/onboarding/HandoffScreen.tsx:133, 141`
- `web/src/features/onboarding/components/WizardShell.tsx:110`
- `web/src/features/onboarding/components/LastPromptCard.tsx:104`
- `web/src/features/workout/WorkoutScreen.tsx:290, 304`
- `web/src/features/settings/RoutineList.tsx:75`
- `web/src/features/settings/SettingsScreen.tsx:281, 292, 304`

For each: read the surrounding code and determine whether the `onConfirm` handler currently catches errors itself and calls `toast.error`. If yes, the caller is now at risk of double-toasting (their internal catch + the new default catch in ConfirmDialog).

Decision tree per caller:
- **Caller's `onConfirm` doesn't throw OR catches errors silently** → leave as-is. New default toast is a strict improvement.
- **Caller's `onConfirm` already toasts on error** → either (a) wrap the toast inside an explicit re-throw so ConfirmDialog's catch never sees it (caller-controlled), or (b) pass `onError={() => {}}` to opt out of the default toast.

For each caller, prefer the simplest of the two. If unclear, leave as-is and verify by running the suite — most callers won't double-toast in practice because their errors don't propagate (they're already swallowed at the service-call site).

- [ ] **Step 6: Run the full unit suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all pass. If any UI test fails because it asserted on a specific toast or dialog-state behavior, update the assertion.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/ConfirmDialog.tsx tests/unit/shared/components/ConfirmDialog.test.tsx
# plus any caller adjustments from Step 5
git commit -m "$(cat <<'EOF'
fix(shared): ConfirmDialog surfaces async errors (closes F6)

Add an optional `onError` prop. When provided, the caller owns the
UX. When omitted, ConfirmDialog calls `toast.error(message)` so
destructive actions cannot fail silently. In both cases the dialog
stays open after a rejected onConfirm, letting the user retry or
cancel.

Previously a bare `catch { setPending(false); }` swallowed all
errors with no user feedback unless every caller wrapped their
own try/catch around `onConfirm`.

Closes audit finding F6. Part of sprint-3/logging-display-correctness.
EOF
)"
```

---

## Task 9: Playwright Scenario — Bodyweight Session Detail Renders

**Files:**
- Modify or create: a Playwright spec at `web/tests/e2e/session-detail-non-weight.spec.ts`

Verify F3's fix end-to-end. The user logs a bodyweight (reps-only) set, finishes the session, opens session detail, and sees the actual reps value rather than `"—"`.

- [ ] **Step 1: Read existing e2e patterns**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/tests/e2e/"
```

Read one or two existing spec files to learn the project's helpers (selecting routines, starting sessions, logging sets, finishing). Likely uses Playwright with localStorage or fake-indexeddb seeding.

- [ ] **Step 2: Write the scenario**

Create `web/tests/e2e/session-detail-non-weight.spec.ts`. Adapt the structure to the existing e2e-spec convention. The general flow:

```ts
import { test, expect } from "@playwright/test";

// Adapt these helpers to whatever the existing specs use:
// - seed routine helper
// - start-session helper
// - log-set helper
// - finish-session helper
// - go-to-history-detail helper

test.describe("Session detail — non-weight set rendering (F3)", () => {
  test("a bodyweight reps-only set shows '12 reps' on session detail (was '—')", async ({ page }) => {
    // Step A: Seed a routine that contains a bodyweight exercise (e.g.
    // "push-up" with effectiveType="bodyweight" or a routine entry with
    // typeOverride="bodyweight"). Use whatever seeding helper the
    // existing specs use. If none exists, programmatically import a
    // YAML routine via the Settings → Import flow.

    // Step B: Start a session.

    // Step C: Open the SetLogSheet for the bodyweight exercise's first
    // block, enter reps=12 (no weight), tap Save.

    // Step D: Finish the session.

    // Step E: Navigate to History → tap the just-finished session.

    // Step F: Locate the bodyweight exercise's pill and assert it
    // reads "12 reps".
    const pill = page.getByRole("button", { name: /12 reps/ });
    await expect(pill).toBeVisible();

    // Step G: Confirm the dash text is NOT shown anywhere on this
    // session-detail card for the bodyweight exercise.
    await expect(page.getByRole("button", { name: "—" })).toHaveCount(0);
  });
});
```

**Implementation note:** if the existing e2e helpers don't exist or don't support this flow, write a minimal direct-DB-seed approach using `page.evaluate(...)` to dispatch into IndexedDB before navigating. Ask before building elaborate new e2e infrastructure — Sprint 3's e2e additions should be 1-2 scenarios, not a framework refactor.

- [ ] **Step 3: Run the scenario**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run test:e2e -- session-detail-non-weight 2>&1 | tail -10
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/session-detail-non-weight.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): bodyweight set renders on session detail (covers F3)

End-to-end verification: log a bodyweight reps-only set, finish the
session, open session detail, and confirm the pill reads "12 reps"
(not "—" as it would have under the pre-Sprint-3 SessionDetailExerciseCard).

Part of sprint-3/logging-display-correctness.
EOF
)"
```

---

## Task 10: Playwright Scenario — Cardio-Extra Distance-Only Logging

**Files:**
- Modify or create: a Playwright spec at `web/tests/e2e/cardio-extra-distance.spec.ts`

Verify F5's fix end-to-end.

- [ ] **Step 1: Write the scenario**

Create `web/tests/e2e/cardio-extra-distance.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Cardio extra — distance-only logging (F5)", () => {
  test("user can save a cardio extra with only distance entered", async ({ page }) => {
    // Step A: Seed a minimal routine and start a session.

    // Step B: Tap "+ Exercise" in WorkoutFooter to open ExercisePicker.

    // Step C: Pick a cardio-type exercise from the catalog (e.g., one
    // whose `type === "cardio"`).

    // Step D: SetLogSheet opens for the new extra. Both duration and
    // distance fields are visible.

    // Step E: Enter distance = 1000 (do NOT touch duration).

    // Step F: Tap Save.

    // Step G: Confirm the toast does NOT show "Enter at least duration to save."
    // and the SetLogSheet closes (set saved successfully).
    const errorToast = page.getByText(/Enter at least/);
    await expect(errorToast).toHaveCount(0);

    // Step H: Confirm the new set is rendered on the workout card with
    // the distance value.
    const distanceText = page.getByText(/1000m/);
    await expect(distanceText).toBeVisible();
  });
});
```

Adapt to the existing e2e patterns as in Task 9.

- [ ] **Step 2: Run the scenario**

```bash
npm run test:e2e -- cardio-extra-distance 2>&1 | tail -10
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cardio-extra-distance.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cardio extra accepts distance-only entry (covers F5)

End-to-end verification: add a cardio extra mid-session, enter
distance only (no duration), save. Asserts the validator does
not block the save and the set renders with the distance value.

Part of sprint-3/logging-display-correctness.
EOF
)"
```

---

## Task 11: Full Sprint Gate

**Files:** None modified.

- [ ] **Step 1: Three consecutive `npm test` runs**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | tail -5
done
```

Expected: each ends with `0 failed`. New totals approximately 98 files / ~935 tests (Task 1 baseline + ~28 new across formatLoggedSet/SessionDetail/cardio/ConfirmDialog tests).

- [ ] **Step 2: Lint, typecheck, build, e2e**

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: each exits 0. E2E now reports 22 tests passing (baseline 20 + 2 new from Tasks 9-10).

- [ ] **Step 3: No commit in this task.**

---

## Task 12: PR, CI, Merge

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-sprint-3-logging-display-correctness.md` — tick Exit Criteria.
- Modify: `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 3 in the Rollup.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin sprint-3/logging-display-correctness
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: logged-set display correctness + sheet UX (sprint 3)" --body "$(cat <<'EOF'
## Summary

Sprint 3 of the [v2 Post-Audit Hardening Roadmap](../blob/main/docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md). Closes audit findings F3 (`SessionDetailExerciseCard` drops non-weight sets), F5 (cardio-extra distance-only validator dead-end), and F6 (`ConfirmDialog` swallows async errors).

(The Sprint 2 backward-compat hotfix landed separately — see PR for that fix.)

### Part A — shared formatLoggedSet (closes F3)

- New `web/src/shared/lib/formatLoggedSet.ts` with two entry points: `formatLoggedSet` (compact string for pills/hints) and `formatLoggedSetParts` (structured for SetRow's custom layout).
- `SetRow` migrated from local `formatLoggedValue` (no behavior change).
- `SessionDetailExerciseCard` migrated from local `formatPillContent` — bodyweight, isometric, distance, cardio sets now render their actual values instead of `"—"`.
- `ExerciseHistoryScreen` inline ternary replaced; weight×reps lines now use `×` (true multiplication sign) instead of `x`.

### Part B — cardio-extra validator (closes F5)

- `isSetInputEmpty` accepts an optional `cardioExtra` flag. When true, accepts any non-null value in `performedDurationSec` OR `performedDistanceM`.
- `SetLogSheet.handleSave` passes `{ cardioExtra: isCardioExtra }` and adjusts the error toast wording to "Enter at least duration or distance to save." for cardio extras.

### Part C — ConfirmDialog error surfacing (closes F6)

- New optional `onError?: (err: unknown) => void` prop. Default behavior when omitted: `toast.error(message)` via sonner, dialog stays open. Existing callers that handled errors themselves are audited for double-toast risk; opt-out is `onError={() => {}}`.

## Evidence

- ~28 new tests across formatLoggedSet, SessionDetailExerciseCard, set-log-validation, ConfirmDialog. Total ~935 unit/integration tests.
- 2 new Playwright scenarios (bodyweight session-detail rendering; cardio-extra distance-only).
- 3/3 `npm test` consecutive runs green; lint, typecheck, build, e2e all pass.

## Test plan

- [ ] CI run 1 green on this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Tick the Exit Criteria in both plan docs**

Edit `docs/superpowers/plans/2026-04-23-sprint-3-logging-display-correctness.md` Exit Criteria: tick all items.

Edit `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`:
- In the "Sprint 3 — Logging & History Display Correctness" Exit Criteria, tick all items.
- In the Rollup section, tick:
  - "Every logged-set kind renders non-dash on every screen that shows logged sets."
  - "`ConfirmDialog` rejection produces a visible toast by default."

- [ ] **Step 5: Commit doc updates and push**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md docs/superpowers/plans/2026-04-23-sprint-3-logging-display-correctness.md
git commit -m "$(cat <<'EOF'
docs: mark sprint 3 exit criteria complete

CI green on sprint-3/logging-display-correctness. F3, F5, F6 closed.
EOF
)"
git push
```

- [ ] **Step 6: Merge**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
gh pr merge --squash --delete-branch
```

- [ ] **Step 7: Cleanup local**

```bash
git checkout main
git pull
git remote prune origin
```

---

## Exit Criteria

- [x] **Task 0:** Sprint 2 hotfix PR merged. `validateSettings` accepts `undefined`. `Session.routineId` FK check removed. Backward-compat regression tests added.
- [x] **Task 2:** `formatLoggedSet` + `formatLoggedSetParts` implemented with paired tests for all five value combinations + fallback.
- [x] **Task 3:** SetRow uses the shared helper; behavior preserved.
- [x] **Task 4:** SessionDetailExerciseCard renders all five value combinations correctly (no more `"—"` dash for non-weight sets).
- [x] **Task 5:** ExerciseHistoryScreen uses the shared helper; canonical `×` multiplication sign.
- [x] **Task 6:** features/history CLAUDE.md notes the formatter location.
- [x] **Task 7:** Cardio-extra distance-only save succeeds; standard validation paths unchanged.
- [x] **Task 8:** ConfirmDialog rejection produces a visible toast by default; `onError` opt-out works.
- [x] **Tasks 9-10:** Two new Playwright scenarios cover the user-visible fixes for F3 and F5.
- [x] **Task 11:** Full gate green: 3 consecutive `npm test`, lint, typecheck, build, e2e.
- [x] **Task 12:** CI green; PR merged; roadmap Sprint 3 ticked.
- [x] **Cleanup:** the three local formatters (SetRow.formatLoggedValue, SessionDetailExerciseCard.formatPillContent, ExerciseHistoryScreen inline) no longer exist anywhere in `web/src/**`.

---

## Risks And Contingencies

### Risk 1: ConfirmDialog default toast double-fires with existing caller catches

Audit of the 11 caller sites in Task 8 Step 5 may reveal one or more callers that already toast errors themselves. The risk: user sees two toasts for one failure. Mitigation: passing `onError={() => {}}` to ConfirmDialog opts out of the default. If two or more callers need this, consider extracting a `useConfirmWithToast` hook — but only if the duplication actually emerges. Don't pre-build it.

### Risk 2: ExerciseHistoryScreen multiplication sign change visible to users

Switching `x` → `×` in history weight×reps lines is a visible change. It matches SetRow and SessionDetailExerciseCard, so consistency improves. If a user finds it unexpected, the change is intentional and trivial to revert.

### Risk 3: Cardio-extra validator change unblocks an existing duration-target validation

The `cardioExtra` flag-based mode is additive — it does not change the standard duration validation. But if a future change conflates `targetKind === "duration"` with `cardioExtra: true` accidentally, distance-only saves could leak into non-cardio duration blocks. Mitigation: the test covering "non-cardio-extra duration target rejects distance-only input" guards this edge.

### Risk 4: Playwright scenarios are brittle under existing seed helpers

If the existing e2e suite uses ad-hoc seeding that doesn't surface a clean way to set up a bodyweight or cardio-extra workflow, Tasks 9-10 may need new helpers. Cap effort at 1 hour per scenario; if the helper work blows past that, file a follow-up to expand e2e infrastructure and ship without the new e2e scenario for now (the unit tests in Tasks 4 and 7 still cover the behavior).

### Risk 5: `findBy*/waitFor` plan-doc fix in Task 0 missed

If the plan-doc fix is skipped, the bug persists in the plan text but the actual code is correct (sprint 1 implementer caught and fixed it). Low harm; defer to next opportunistic doc cleanup.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage.** F3 → Tasks 2, 4, 5, 6, 9. F5 → Task 7, 10. F6 → Task 8. Hotfix (regressions) → Task 0. Gate → Task 11. Ship → Task 12.
- [x] **Placeholder scan.** Component test stubs in Tasks 9-10 explicitly note adaptation to existing e2e helpers; the ConfirmDialog test code is full and runnable.
- [x] **Type consistency.** `LoggedSetSubset`, `LoggedSetParts`, `formatLoggedSet`, `formatLoggedSetParts`, `isSetInputEmpty`, `ValidationOptions`, `cardioExtra`, `onError`, `isCardioExtra` are named consistently across all tasks. The `parts` shape `{primary, unit, secondary}` matches `SetRow`'s existing usage exactly.
- [x] **No source scope creep.** Modifies only `services/`, `features/`, `shared/`, `tests/`, and one CLAUDE.md. No domain/types changes. No Dexie schema. No package.json.
- [x] **Hotfix is standalone.** Task 0 produces its own PR before Sprint 3 work starts. Cleanup leaves the working tree clean for Task 1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-sprint-3-logging-display-correctness.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

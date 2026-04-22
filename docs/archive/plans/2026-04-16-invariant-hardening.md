# Session 1 — Invariant Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
>
> **Source:** Approved via `/ultraplan` remote session on 2026-04-16 (https://claude.ai/code/session_01W9bpLSoEDNNcBteYpzXbAA).

**Goal:** Close the five data-integrity / test-quality ship-blockers flagged in `docs/codebase-review-2026-04-16.md` (R1 logSet race, R2 editSet finished-session promotion, R3 editSet null-guard, R4 finishSession rotation guard, T1 E2E assertion hardening). Service-layer only. No UI changes.

**Decision locked in:** R2 option B — `editSet` will NOT promote `effectiveType` on finished sessions. Snapshots stay immutable after finish.

---

## Context

`docs/codebase-review-2026-04-16.md` flagged five items that are ship-blockers before sharing with friends. None are catastrophic today (single user, slow taps, no friends yet) but every one is the kind of latent bug that surfaces the first time someone taps fast, edits history, imports a corrupt backup, or regresses the UI. This session closes all five in one pass.

---

## Scope — five changes

| # | ID | File | Effort |
|---|----|------|--------|
| 1 | R1 | `web/src/services/set-service.ts` — wrap `logSet` in a transaction spanning `sessions + sessionExercises + loggedSets` | ~1.5h |
| 2 | R4 | `web/src/services/session-service.ts` — `finishSession` rotation guard on `indexOf === -1` | ~30m |
| 3 | R3 | `web/src/services/set-service.ts` — `editSet` must throw when `sessionExercise` missing | ~15m |
| 4 | R2 | `web/src/services/set-service.ts` — `editSet` blocks promotion when session is not active | ~30m |
| 5 | T1 | `web/tests/e2e/full-workflow.spec.ts` — remove all `.catch(() => false)` guards | ~2h |

Changes 1, 3, 4 all edit `set-service.ts`; do them together. 2 is isolated. 5 is test-only.

---

## `logSet` transaction boundary — before / after

```
BEFORE  (set-service.ts:97-212)                AFTER
──────────────────────────────                 ──────────────────────────────
logSet(...) {                                  logSet(...) {
  read sessionExercise    ← race window          validateSetInput(input)
  read session            ← race window          return db.transaction("rw",
  validate + compute sig                           [sessions, sessionExercises, loggedSets],
  read existing loggedSet ← race window            async () => {
  [TXN: loggedSets only]                              read sessionExercise   (inside txn)
    add/update loggedSet                              read session (active?) (inside txn)
  [TXN end]                                           resolve block sig + tag
  if promote needed:      ← race window               read existing loggedSet slot
    update sessionExercise    (separate write)        add/update loggedSet
}                                                     if (weight !== null && se.effectiveType === "bw")
                                                        update sessionExercise to "weight"
                                                      return loggedSet
                                                    }
                                               }
```

Existing behaviour still holds (upsert, weighted-bodyweight promotion on both create + update). The change is strictly atomicity. Two concurrent `logSet()` calls on the same `sessionExercise` will now serialize through Dexie, so they cannot both read `effectiveType: "bodyweight"` and both write a promotion.

---

## Detailed edits

### 1. `web/src/services/set-service.ts` — `logSet` (R1)

Wrap the entire body (after `validateSetInput`) inside:

```ts
return db.transaction(
  "rw",
  db.sessions,
  db.sessionExercises,
  db.loggedSets,
  async () => {
    // existing reads + writes + promotion, verbatim
  }
);
```

- `db.sessions` is required because the active-session check is inside the transaction (TOCTOU).
- The function's return shape is unchanged — `result` becomes the transaction's return value.
- The session-status guard (`session.status !== "active"`) is preserved as-is but now runs inside the txn.

### 2. `web/src/services/set-service.ts` — `editSet` (R2 + R3)

Current (lines 252–260):
```ts
if (input.performedWeightKg !== null) {
  const sessionExercise = await db.sessionExercises.get(existing.sessionExerciseId);
  if (sessionExercise && sessionExercise.effectiveType === "bodyweight") {
    await db.sessionExercises.update(existing.sessionExerciseId, { effectiveType: "weight" });
  }
}
```

Replace with (still after the main `db.loggedSets.update`):
```ts
if (input.performedWeightKg !== null) {
  const sessionExercise = await db.sessionExercises.get(existing.sessionExerciseId);
  if (!sessionExercise) {
    throw new Error(`SessionExercise "${existing.sessionExerciseId}" not found`);
  }
  const session = await db.sessions.get(sessionExercise.sessionId);
  if (
    session?.status === "active" &&
    sessionExercise.effectiveType === "bodyweight"
  ) {
    await db.sessionExercises.update(existing.sessionExerciseId, {
      effectiveType: "weight",
    });
  }
}
```

- R3: fail loudly when the sessionExercise row is gone (race with discard).
- R2: promotion only on `status === "active"`. Finished/discarded sessions keep their snapshot.
- `session?.status` tolerates a missing session row (the edit still succeeded, just no promotion); we don't need to fail here because the loggedSet write already committed — the session deletion would be an orphan case the backup validator catches elsewhere.

### 3. `web/src/services/session-service.ts` — `finishSession` (R4)

Current (lines 441–444):
```ts
const dayOrder = session.dayOrderSnapshot;
const currentIndex = dayOrder.indexOf(session.dayId);
const nextIndex = (currentIndex + 1) % dayOrder.length;
const nextDayId = dayOrder[nextIndex]!;
```

Replace with:
```ts
const dayOrder = session.dayOrderSnapshot;
const currentIndex = dayOrder.indexOf(session.dayId);
if (currentIndex === -1) {
  throw new Error(
    `Corrupt dayOrderSnapshot: session.dayId "${session.dayId}" not in [${dayOrder.join(", ")}]`
  );
}
const nextIndex = (currentIndex + 1) % dayOrder.length;
const nextDayId = dayOrder[nextIndex]!;
```

Also guard `dayOrder.length === 0` (same throw) — a zero-length `dayOrder` with a non-empty `dayId` was the other silent-wrap case.

### 4. Unit tests

**`web/tests/unit/services/set-service.test.ts` — add three tests**

- **R1 concurrent-tap test**: Start a session on a bodyweight exercise (`pull-up`). `await Promise.all([logSet(se, 0, 0, {weight: 10, reps: 5, ...}), logSet(se, 0, 0, {weight: 10, reps: 5, ...})])`. Assert: exactly one `loggedSet` row exists (upsert), its `performedWeightKg === 10`, and `sessionExercise.effectiveType === "weight"`. The test doesn't prove atomicity in fake-indexeddb (transactions there are mostly sequential) but it locks in the expected end-state so a future refactor that drops the transaction wrap breaks it.

- **R2 finished-session-no-promotion test**: Start session on `pull-up`, `logSet` with null weight (no promotion), `finishSession`, then `editSet` to add weight. Assert `sessionExercise.effectiveType === "bodyweight"` (NOT promoted) and the loggedSet's `performedWeightKg === <new value>` (edit did succeed).

- **R3 missing-sessionExercise test**: Log a set, then `await db.sessionExercises.delete(seId)`, then `editSet(db, loggedSet.id, {weight: 10, ...})`. Assert it throws `/SessionExercise ".*" not found/`.

**`web/tests/unit/services/session-service.test.ts` — add one test**

- **R4 corrupt-dayOrder test**: Start a session, then `db.sessions.update(sessionId, { dayOrderSnapshot: ["Z"] })` (session.dayId is "A"), then `finishSession`. Assert it throws `/Corrupt dayOrderSnapshot/`. Bonus: second case with `dayOrderSnapshot: []`.

### 5. `web/tests/e2e/full-workflow.spec.ts` — T1

The file's `full workflow: start -> log -> finish -> history -> export` test guards every critical action with `.isVisible({timeout}).catch(() => false)`. A missing set slot, a missing weight input, a missing save button all silently skip their step and the test still passes.

Audit pass, replacing each hedged branch with a hard assertion. Concrete edits:

| line | current | replace with |
|---|---|---|
| 54–55 | `const setSlot = ...first(); if (await setSlot.isVisible(...).catch(...)) { ... }` | `const setSlot = page.locator('[data-testid="set-slot"]').first(); await expect(setSlot).toBeVisible({ timeout: 5000 }); await setSlot.click();` |
| 60–67 | `weightInput... if visible { fill("60") }` | `const weightInput = page.locator('input[inputmode="decimal"], input[name="weight"]').first(); await expect(weightInput).toBeVisible(); await weightInput.fill("60");` |
| 69–78 | `repsInput... if visible { fill("10") }` | `const repsInput = page.locator('input[name="reps"]').first(); await expect(repsInput).toBeVisible(); await repsInput.fill("10");` |
| 81–88 | `saveButton... if visible { click }` | `const saveButton = page.getByRole("button", { name: /save|log|submit/i }); await expect(saveButton).toBeVisible(); await saveButton.click();` |
| 96–101 | `confirmButton... if visible { click }` | Keep hedged only if the confirm dialog is genuinely conditional; otherwise assert + click. **Check at implementation time** — the finish confirm dialog is currently always shown in WorkoutScreen, so this should become a hard assertion. |
| 119–128 | `downloadPromise = ...catch(() => null); if (download) { expect... }` | `const downloadPromise = page.waitForEvent("download", { timeout: 10000 }); await exportButton.click(); const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/exercise-logger-backup.*\.json/);` |

Expectation: the test tightens from "does the page load?" to "does the logged set round-trip through history and export?" If the hardened test flakes, investigate and fix the underlying selector fragility — do not re-add `.catch`.

Cross-reference when implementing: `features/workout/SetLogSheet.tsx` and `features/workout/SetSlot.tsx` for the actual `data-testid` / `inputmode` / input-name attributes in use, plus `features/settings/SettingsScreen.tsx` for the export-button role/name. Update selectors to match reality rather than guessing.

### 6. Docs touch-up

`web/src/services/CLAUDE.md` — under `set-service.ts`, replace the line

> `editSet(db, loggedSetId, input)` → LoggedSet — Works on active AND finished sessions. Also triggers weighted bodyweight promotion.

with

> `editSet(db, loggedSetId, input)` → LoggedSet — Works on active AND finished sessions. Weighted bodyweight promotion runs **only on active sessions** to keep finished-session snapshots immutable.

No other doc surface needs an update.

---

## Verification

Run in order:

```bash
cd web
npm test                                    # expect 440 + 4 new = 444 passing
npm run lint                                # clean
npm run test:e2e -- --grep "full workflow"  # hardened workflow test passes end-to-end
```

Manual spot-checks:
- Start a session with a bodyweight exercise, log a set with 10kg, confirm the exercise card switches to the weighted layout — existing behavior, unchanged.
- Start a session, finish it, go to History → session detail → edit a bodyweight set to add weight. Confirm the set shows the new weight **but** the exercise stays labeled as bodyweight in that session's history (R2 guard).
- DevTools → IDB → corrupt a finished routine's `dayOrderSnapshot` on a live active session, then try to finish. Confirm the error surfaces instead of silently resetting rotation (R4).

---

## Out of scope (next sessions)

- R5 `unitOverride` extras-scoping
- R6 kg-branch cleanup rounding in `calculateBlockSuggestion`
- R7 `Routine.cardio` structural validation in `validateBackupPayload`
- R9 remove dead `"discarded"` SessionStatus value
- Component tests for Workout / SetLogSheet / Settings / Today (T2)
- Hook tests for `useActiveSession` etc. (T3)

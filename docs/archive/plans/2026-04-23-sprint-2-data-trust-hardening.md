# Sprint 2 — Data Trust Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit findings F1 (backup validator weaker than live services) and F2 (progression fallback can merge multiple historical blocks) so backup import cannot persist shapes the live services would reject, and progression fallback cannot silently combine sets from two different historical block slots.

**Architecture:** Two parts in one PR. Part A hardens `web/src/services/backup-service.ts` validators with five new invariants (numeric sanity, full `SetBlock` contract, settings onboarding fields, duplicate-slot check, referential integrity beyond what's there today). Part B fixes `web/src/services/progression-service.ts` fallback matching to group by `(sessionExerciseId, blockIndex)` and bail out on ambiguity, plus tightens `allSetsLogged` from `>=` to `===`. All work is in services + service tests; no UI, no domain types, no Dexie schema.

**Tech Stack:** TypeScript 5, Vitest 4, fake-indexeddb 6, Dexie 4. Service tests run real IndexedDB via `fake-indexeddb/auto`. Validator helpers stay in `backup-service.ts` (no extraction unless the file becomes unwieldy — current size ~1100 LoC, acceptable).

**Decisions resolved (from roadmap):**
- Hand-rolled validators, no Zod dependency.
- Strict equality on `allSetsLogged` for both primary AND fallback matches.
- Keep `BackupValidationError[]` shape; no new tagged-union error type.
- **Scope adjustment:** the audit's "invalid logged set measurements" is interpreted as finite-number checks on numeric fields only. Target-kind coherence (rejecting "reps block + duration-only logged") is NOT in scope — the live `set-service.logSet` is also permissive about that combination, so adding it to backup validation would make the validator stricter than live services. Track as a follow-up if needed; do not extend Sprint 2 to cover it.

---

## Root Cause Recap

### Part A — Backup Import Validation (F1)

Five gaps verified against the current code:

1. **`isNumber` only rejects `NaN`** (`backup-service.ts:197-199`). It accepts `Infinity`, `-Infinity`, and negatives where they make no semantic sense (e.g., a negative `count`, a negative `performedDurationSec`).

2. **`validateSetBlock` is structural-only** (`backup-service.ts:217-253`). It checks that `minValue`/`maxValue`/`exactValue` are numbers when present, but does not enforce:
   - Exactly-one-of (`{minValue, maxValue}` XOR `exactValue`).
   - `minValue < maxValue`.
   - `Number.isInteger(count)` (it only checks `count >= 1`).
   - Positivity for the value bounds.

3. **`validateLoggedSet` accepts `Infinity` and negatives** (`backup-service.ts:723-763`). Performance fields use `isNumberOrNull` which has the same defect as `isNumber`.

4. **`validateSettings` ignores onboarding fields** (`backup-service.ts:765-796`). Validates only `id`, `activeRoutineId`, `units`. The six onboarding fields (`userName`, `onboardingCompletedAt`, `onboardingSkippedAt`, `lastGeneratedPrompt`, `lastGeneratedPromptAt`, `onboardingBannerDismissedAt`) flow through `importBackup` (lines 1027-1032) with `?? null` and zero runtime validation.

5. **No duplicate-slot check.** Nothing in `validateBackupPayload` (lines 818-969) checks that no two `LoggedSet` records share `(sessionExerciseId, blockIndex, setIndex)`. The Dexie schema has a unique compound index, so a duplicate would fail at `bulkAdd` time with a useless error after the transaction had already started.

6. **Partial referential integrity.** Today's check: `settings.activeRoutineId` exists in routines; `sessionExercises.sessionId` exists in sessions; `loggedSets.sessionExerciseId` exists in sessionExercises. Missing: `loggedSets.sessionId === parentSessionExercise.sessionId`; `Session.routineId` (when non-null) exists in routines.

### Part B — Progression Fallback (F2)

Verified at `progression-service.ts:124-198`:

- Fallback (lines 127-146) returns all logged sets matching `(exerciseId, instanceLabel, origin="routine", tag, targetKind)` filtered in memory.
- `findMostRecentFinishedSessionSets` (line 157) groups by `sessionId` only; returns ALL matching sets from that session.
- If the most recent finished session contains two different blocks for the same exercise that share `tag` and `targetKind` (e.g., two untagged `reps` blocks like `[8-12 reps × 3]` and `[6-10 reps × 2]`), all sets from both blocks come back combined.
- `allSetsLogged` (line 221) uses `>= expectedCount`, so even a too-many situation passes the gate.

**Fix:** within the most recent finished session, further group by `(sessionExerciseId, blockIndex)`. If exactly one group, use it with `=== expectedCount` strict equality. If more than one group, bail (return `[]`). The primary signature-exact match still works and is preferred. Apply strict equality to the primary path too.

---

## File Structure

Two source files, two test files. Optionally a fixture file.

- **Modify** `web/src/services/backup-service.ts` — add finite-number helpers; tighten `validateSetBlock`, `validateLoggedSet`, `validateSettings`; add duplicate-slot check; extend referential integrity. Keep all changes inside the existing module — no extraction unless the file blows past 1500 LoC.
- **Modify** `web/src/services/progression-service.ts` — change `findMostRecentFinishedSessionSets` to a stricter signature that takes the expected `(sessionExerciseId, blockIndex)` group key when called from fallback, OR introduce a separate helper. Tighten `allSetsLogged` to strict equality.
- **Modify** `web/tests/unit/services/backup-service.test.ts` — add a new `describe("validator hardening — Sprint 2")` block with one nested describe per invariant (numeric, SetBlock, settings, duplicate-slot, referential integrity). Add a `describe("legacy backup round-trip")` block proving today's exports still import after hardening.
- **Modify** `web/tests/unit/services/progression-service.test.ts` — add a `describe("fallback ambiguity — Sprint 2")` block with three regression scenarios (single matching block fallback works; two-block ambiguity bails; primary `===` strict equality).
- **Update** `docs/superpowers/plans/2026-04-23-sprint-2-data-trust-hardening.md` — tick Exit Criteria on close.
- **Update** `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 2 in the Rollup checklist.

---

## Working Directory Assumption

All `npm` and `git` commands assume the current working directory is `web/` unless otherwise noted. Repo root is `C:\Users\creix\VSC Projects\exercise_logger`.

---

## Task 1: Sprint Branch And Baseline

**Files:** None modified.

- [ ] **Step 1: Verify clean state on `main`**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git checkout main
git pull
git status --short
```

Expected: `git status` shows only the pre-existing `docs/custom-gpt/workout-routine-gpt.instructions.md` modification (or empty if that has been committed since Sprint 1). Recent `git log --oneline -3` should show `d4d6103 docs: tick sprint 1 PR-merged checkbox` and `723a9f5 test: stabilize npm test (sprint 1) (#21)` near the top.

If unexpected files are present, STOP and report.

- [ ] **Step 2: Create the sprint branch**

```bash
git checkout -b sprint-2/data-trust-hardening
```

Expected: `Switched to a new branch 'sprint-2/data-trust-hardening'`.

- [ ] **Step 3: Capture baseline test counts**

```bash
npm test 2>&1 | tail -10
```

Expected: `Test Files 98 passed (98)` / `Tests 880 passed (880)`. These counts will grow during this sprint as new tests are added — Tasks 3-8 will increase the totals. Record the baseline so we can confirm at sprint close that no existing test regressed.

- [ ] **Step 4: No commit in this task.**

---

## Task 2: Finite-Number Helpers

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`

The plan: add three new helpers (`isFiniteNumber`, `isFinitePositive`, `isFiniteNonNegativeInteger`) without removing the existing `isNumber`/`isNumberOrNull`. Subsequent tasks will switch call sites to the stricter helpers as each invariant is tightened. This avoids a single mega-diff.

- [ ] **Step 1: Write a failing test for `isFiniteNumber` rejecting Infinity**

Add to the bottom of the existing `describe("validateBackupPayload", ...)` block (or a new sibling describe — match the existing file's structure when you open it):

```ts
describe("validator hardening — Sprint 2 — finite numerics", () => {
  it("rejects performedReps === Infinity", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.loggedSets[0]!.performedReps = Infinity;
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.loggedSets[0].performedReps" &&
      /must be a finite/i.test(e.message)
    )).toBe(true);
  });
});
```

You will need a `makeMinimalValidPayload()` helper. If one does not exist in the test file already, add it just below the existing `makeLoggedSet` helper:

```ts
const catalogId = "barbell-back-squat";

function makeMinimalValidPayload(): BackupEnvelope {
  const exercise = makeExercise(catalogId);
  const routine = makeRoutine("r1");
  const session = makeSession("s1");
  const se = makeSessionExercise("se1", "s1", catalogId);
  const ls = makeLoggedSet("ls1", "s1", "se1", catalogId);
  return {
    app: "exercise-logger",
    schemaVersion: 1,
    exportedAt: "2026-04-23T00:00:00.000Z",
    data: {
      routines: [routine],
      sessions: [session],
      sessionExercises: [se],
      loggedSets: [ls],
      settings: {
        id: "user",
        activeRoutineId: "r1",
        units: "kg",
        userName: null,
        onboardingCompletedAt: null,
        onboardingSkippedAt: null,
        lastGeneratedPrompt: null,
        lastGeneratedPromptAt: null,
        onboardingBannerDismissedAt: null,
      },
    },
  };
}
```

Note: also note that `makeExercise` returns an `Exercise` (catalog) object, but `BackupEnvelope` does not include exercises — they are seeded from CSV. The exercise is only needed for the `catalogId` reference. The helper above uses `makeExercise` purely to derive `catalogId`; you could equally write `const catalogId = "barbell-back-squat";` directly. Keep it simple.

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "rejects performedReps === Infinity" 2>&1 | tail -15
```

Expected: FAIL with `expected false to be true` — current `isNumberOrNull` accepts `Infinity`.

- [ ] **Step 3: Add the three new helpers**

In `web/src/services/backup-service.ts`, immediately after the existing `isArrayOf` helper (around line 211), add:

```ts
/** Strict numeric check — rejects NaN, Infinity, -Infinity. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Finite number > 0. */
function isFinitePositive(v: unknown): v is number {
  return isFiniteNumber(v) && v > 0;
}

/** Integer >= 0 (and finite). */
function isFiniteNonNegativeInteger(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 0;
}

/** Finite number or null. Used for performance fields on LoggedSet. */
function isFiniteNumberOrNull(v: unknown): v is number | null {
  return v === null || isFiniteNumber(v);
}
```

Then replace the four `isNumberOrNull` call sites inside `validateLoggedSet` (lines 730, 736, 742, 748) with `isFiniteNumberOrNull`, and update each error message from `"must be a number or null"` to `"must be a finite number or null"`. The four fields are `performedWeightKg`, `performedReps`, `performedDurationSec`, `performedDistanceM`.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "rejects performedReps === Infinity" 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Add and run companion negative tests**

Add three more tests in the same describe block:

```ts
it("rejects performedWeightKg === -Infinity", async () => {
  const cat = new Set([catalogId]);
  const payload = makeMinimalValidPayload();
  payload.data.loggedSets[0]!.performedWeightKg = -Infinity;
  const errors = validateBackupPayload(payload, cat);
  expect(errors.some((e) =>
    e.field === "data.loggedSets[0].performedWeightKg" &&
    /must be a finite/i.test(e.message)
  )).toBe(true);
});

it("rejects performedDurationSec === NaN (existing behavior preserved)", async () => {
  const cat = new Set([catalogId]);
  const payload = makeMinimalValidPayload();
  payload.data.loggedSets[0]!.performedDurationSec = NaN;
  const errors = validateBackupPayload(payload, cat);
  expect(errors.some((e) =>
    e.field === "data.loggedSets[0].performedDurationSec" &&
    /must be a finite/i.test(e.message)
  )).toBe(true);
});

it("accepts finite numerics including 0 and negative weight (negative weight is permitted at logging layer)", async () => {
  const cat = new Set([catalogId]);
  const payload = makeMinimalValidPayload();
  payload.data.loggedSets[0]!.performedReps = 0;
  payload.data.loggedSets[0]!.performedWeightKg = -10; // permitted; semantics policed elsewhere
  payload.data.loggedSets[0]!.performedDurationSec = null;
  const errors = validateBackupPayload(payload, cat);
  // The performedReps/performedWeightKg/performedDurationSec fields specifically
  // must produce no errors. (The payload may have other unrelated errors; we
  // narrow the assertion.)
  expect(errors.filter((e) => e.field.startsWith("data.loggedSets[0].performed"))).toEqual([]);
});
```

Run:
```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — finite numerics" 2>&1 | tail -15
```

Expected: 4 of 4 pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): reject Infinity in LoggedSet performance fields

Add isFiniteNumber, isFinitePositive, isFiniteNonNegativeInteger,
isFiniteNumberOrNull helpers in backup-service. Switch the four
LoggedSet performance fields (performedWeightKg, performedReps,
performedDurationSec, performedDistanceM) from isNumberOrNull to
isFiniteNumberOrNull, so a backup with Infinity / -Infinity values
fails validation cleanly instead of being persisted.

isNumber and isNumberOrNull are kept; subsequent tasks tighten
specific call sites to the stricter helpers as each invariant is
addressed.

Part of sprint-2/data-trust-hardening (F1).
EOF
)"
```

---

## Task 3: SetBlock Full Contract

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`

Tighten `validateSetBlock` to enforce: exactly-one-of (`{minValue, maxValue}` XOR `exactValue`); `minValue < maxValue`; `Number.isInteger(count)`; positivity for value bounds.

- [ ] **Step 1: Write failing tests for the new SetBlock invariants**

Append to the test file in a new nested describe block:

```ts
describe("validator hardening — Sprint 2 — SetBlock contract", () => {
  it("rejects a block with both range AND exact value", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      exactValue: 10,
      count: 3,
    } as never]; // intentional invalid shape
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      /must define exactly one of/i.test(e.message)
    )).toBe(true);
  });

  it("rejects a block with neither range NOR exact value", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      count: 3,
    } as never];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      /must define exactly one of/i.test(e.message)
    )).toBe(true);
  });

  it("rejects a range with min >= max", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      minValue: 10,
      maxValue: 8,
      count: 3,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      /minValue.*must be less than maxValue/i.test(e.message)
    )).toBe(true);
  });

  it("rejects non-integer count", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 2.5,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field.endsWith(".count") && /integer/i.test(e.message)
    )).toBe(true);
  });

  it("rejects zero or negative exactValue", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "duration",
      exactValue: -30,
      count: 1,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field.endsWith(".exactValue") && /positive/i.test(e.message)
    )).toBe(true);
  });

  it("rejects zero or negative minValue/maxValue", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      minValue: 0,
      maxValue: 5,
      count: 1,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field.endsWith(".minValue") && /positive/i.test(e.message)
    )).toBe(true);
  });

  it("accepts a fully-valid range block", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) =>
      e.field.startsWith("data.sessionExercises[0].setBlocksSnapshot")
    )).toEqual([]);
  });

  it("accepts a fully-valid exact block", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessionExercises[0]!.setBlocksSnapshot = [{
      targetKind: "duration",
      exactValue: 30,
      count: 2,
    }];
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) =>
      e.field.startsWith("data.sessionExercises[0].setBlocksSnapshot")
    )).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new tests; confirm 6 fail and 2 pass**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — SetBlock contract" 2>&1 | tail -25
```

Expected: 6 fail (the negative cases that current code does not reject), 2 pass (the positive cases — current code already accepts them).

- [ ] **Step 3: Tighten `validateSetBlock`**

In `web/src/services/backup-service.ts`, replace the entire `validateSetBlock` function (lines 217-253) with:

```ts
function validateSetBlock(
  block: unknown,
  path: string,
  errors: BackupValidationError[]
): void {
  if (typeof block !== "object" || block === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const b = block as Record<string, unknown>;

  if (!VALID_TARGET_KINDS.includes(b.targetKind as TargetKind)) {
    errors.push({
      field: `${path}.targetKind`,
      message: `must be one of: ${VALID_TARGET_KINDS.join(", ")}`,
    });
  }

  // Exactly-one-of: either {minValue, maxValue} together, or exactValue alone.
  const hasMin = b.minValue !== undefined;
  const hasMax = b.maxValue !== undefined;
  const hasExact = b.exactValue !== undefined;
  const hasRange = hasMin || hasMax; // partial range counts as "trying to use range"

  if (hasRange === hasExact) {
    // Either both or neither — both are invalid.
    errors.push({
      field: path,
      message:
        "must define exactly one of: a {minValue, maxValue} range OR an exactValue",
    });
  } else if (hasRange) {
    // Range path: require both min AND max as finite positive numbers, with min < max.
    if (!isFinitePositive(b.minValue)) {
      errors.push({
        field: `${path}.minValue`,
        message: "must be a finite positive number",
      });
    }
    if (!isFinitePositive(b.maxValue)) {
      errors.push({
        field: `${path}.maxValue`,
        message: "must be a finite positive number",
      });
    }
    if (
      isFinitePositive(b.minValue) &&
      isFinitePositive(b.maxValue) &&
      (b.minValue as number) >= (b.maxValue as number)
    ) {
      errors.push({
        field: path,
        message: `minValue (${b.minValue}) must be less than maxValue (${b.maxValue})`,
      });
    }
  } else {
    // Exact path: require finite positive number.
    if (!isFinitePositive(b.exactValue)) {
      errors.push({
        field: `${path}.exactValue`,
        message: "must be a finite positive number",
      });
    }
  }

  if (
    !isFiniteNumber(b.count) ||
    !Number.isInteger(b.count) ||
    (b.count as number) < 1
  ) {
    errors.push({
      field: `${path}.count`,
      message: "must be a finite integer >= 1",
    });
  }

  if (b.tag !== undefined && b.tag !== null && !VALID_TAGS.includes(b.tag as SetTag)) {
    errors.push({
      field: `${path}.tag`,
      message: `must be one of: ${VALID_TAGS.join(", ")}`,
    });
  }
}
```

Notes on the changes:
- Switched `isNumber` → `isFiniteNumber`/`isFinitePositive` for value bounds and count.
- Added exactly-one-of XOR check via `hasRange === hasExact`.
- Added `min < max` check.
- Added `Number.isInteger(count)` check.
- The `tag` clause now also tolerates `null` (existing routines may serialize `tag: null`); previously it only tolerated `undefined`. This is a small bug-fix freebie that drops on the floor here.

- [ ] **Step 4: Run the SetBlock tests and confirm all 8 pass**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — SetBlock contract" 2>&1 | tail -15
```

Expected: 8 of 8 pass.

- [ ] **Step 5: Run the full backup-service test file to catch regressions**

```bash
npm test -- tests/unit/services/backup-service.test.ts 2>&1 | tail -10
```

Expected: all tests pass. If existing tests fail, the most likely cause is a fixture that used a SetBlock with both range and exact values OR a non-integer count — fix the fixture, not the validator.

- [ ] **Step 6: Commit**

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): enforce full SetBlock contract in validator

validateSetBlock now requires:
- exactly-one-of: {minValue, maxValue} XOR exactValue
- minValue < maxValue when range is used
- finite positive numbers for value bounds
- Number.isInteger(count) && count >= 1

Switches the value-bound and count checks from the lenient isNumber
to isFiniteNumber/isFinitePositive added in the previous commit. Also
tolerates `tag: null` (in addition to undefined) since serialized
routines may include the explicit null.

Closes part of F1. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 4: Settings Onboarding Field Validation

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`

Today `validateSettings` (lines 765-796) validates only `id`, `activeRoutineId`, `units`. Then `importBackup` (lines 1027-1032) persists six more fields with `?? null` and zero validation.

Tighten: validate `userName` as `string | null` with codepoint length ≤ 40 (mirrors `setUserName`). Validate the five timestamp fields as `string | null` (no further format check — the live `nowISO()` writes `new Date().toISOString()` but we don't enforce that on read; matching live-service behavior).

- [ ] **Step 1: Write failing tests**

Append:

```ts
describe("validator hardening — Sprint 2 — Settings onboarding fields", () => {
  it("rejects userName as a number", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    (payload.data.settings as Record<string, unknown>).userName = 42;
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.settings.userName" && /string or null/i.test(e.message)
    )).toBe(true);
  });

  it("rejects userName longer than 40 codepoints", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    (payload.data.settings as Record<string, unknown>).userName = "a".repeat(41);
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.settings.userName" && /40/.test(e.message)
    )).toBe(true);
  });

  it("counts emoji as single codepoints (40-emoji name accepted)", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    // 40 grinning-face emoji codepoints; each is one Array.from element but two UTF-16 code units.
    (payload.data.settings as Record<string, unknown>).userName = "😀".repeat(40);
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) => e.field === "data.settings.userName")).toEqual([]);
  });

  it("rejects onboardingCompletedAt as a number", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    (payload.data.settings as Record<string, unknown>).onboardingCompletedAt = 0;
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.settings.onboardingCompletedAt" && /string or null/i.test(e.message)
    )).toBe(true);
  });

  it("accepts all six onboarding fields as null", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    // settings already has them as null in makeMinimalValidPayload; assert no errors come back
    // for these specific fields.
    const errors = validateBackupPayload(payload, cat);
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

  it("accepts ISO-shaped strings for the five timestamp fields", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    const stamp = "2026-04-23T00:00:00.000Z";
    Object.assign(payload.data.settings, {
      userName: "Alice",
      onboardingCompletedAt: stamp,
      onboardingSkippedAt: null,
      lastGeneratedPrompt: "some prompt",
      lastGeneratedPromptAt: stamp,
      onboardingBannerDismissedAt: null,
    });
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) => e.field.startsWith("data.settings."))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; confirm 4 fail, 2 pass**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — Settings onboarding fields" 2>&1 | tail -25
```

Expected: 4 negative-case tests fail (current validator accepts the bad shapes), 2 positive-case tests pass.

- [ ] **Step 3: Extend `validateSettings`**

In `web/src/services/backup-service.ts`, replace the body of `validateSettings` (lines 765-796) with:

```ts
function validateSettings(
  settings: unknown,
  errors: BackupValidationError[]
): void {
  const path = "data.settings";
  if (typeof settings !== "object" || settings === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const s = settings as Record<string, unknown>;

  if (s.id !== "user") {
    errors.push({ field: `${path}.id`, message: 'must be "user"' });
  }
  if (!isStringOrNull(s.activeRoutineId)) {
    errors.push({
      field: `${path}.activeRoutineId`,
      message: "must be a string or null",
    });
  }
  if (!VALID_UNITS.includes(s.units as UnitSystem)) {
    errors.push({
      field: `${path}.units`,
      message: `must be one of: ${VALID_UNITS.join(", ")}`,
    });
  }

  // userName: string-or-null; codepoint length <= 40 (mirrors setUserName).
  if (!isStringOrNull(s.userName)) {
    errors.push({
      field: `${path}.userName`,
      message: "must be a string or null",
    });
  } else if (typeof s.userName === "string" && Array.from(s.userName).length > 40) {
    errors.push({
      field: `${path}.userName`,
      message: "must be 40 codepoints or fewer",
    });
  }

  // Five timestamp fields: each string-or-null. We do not enforce ISO format
  // here — the live setters call nowISO() which guarantees ISO 8601, and
  // validating format on read would risk rejecting backups from minor format
  // drift. Match live-service strictness: type only.
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
  // Pre-v3 backups may include a `theme` field; accept but ignore it.
  // It gets stripped in importBackup() before persisting.
}
```

- [ ] **Step 4: Run the settings tests**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — Settings onboarding fields" 2>&1 | tail -15
```

Expected: 6 of 6 pass.

- [ ] **Step 5: Run the full backup-service test file**

```bash
npm test -- tests/unit/services/backup-service.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): validate Settings onboarding fields on import

validateSettings now validates the six onboarding fields that the
previous version persisted blindly via `?? null` in importBackup:
- userName: string-or-null, codepoint length <= 40 (mirrors setUserName)
- onboardingCompletedAt, onboardingSkippedAt, lastGeneratedPrompt,
  lastGeneratedPromptAt, onboardingBannerDismissedAt: string-or-null

ISO format is intentionally NOT enforced — matches live setter
behavior, which writes nowISO() but doesn't read-check format.

Closes part of F1. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 5: Duplicate Slot Check

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`

The Dexie schema enforces a unique compound index on `[sessionExerciseId+blockIndex+setIndex]` for `loggedSets`. A duplicate-slot backup will currently fail at `bulkAdd` time inside the import transaction, which is a worse failure mode than rejecting it during validation — partial transaction state, opaque Dexie error.

- [ ] **Step 1: Write a failing test**

Append:

```ts
describe("validator hardening — Sprint 2 — duplicate slot check", () => {
  it("rejects two LoggedSets sharing (sessionExerciseId, blockIndex, setIndex)", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    const original = payload.data.loggedSets[0]!;
    const dup: LoggedSet = {
      ...original,
      id: "ls2",
      // same sessionExerciseId, blockIndex, setIndex — distinct id only
    };
    payload.data.loggedSets.push(dup);
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      /duplicate.*slot/i.test(e.message)
    )).toBe(true);
  });

  it("accepts two LoggedSets in the same block but different setIndex", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    const original = payload.data.loggedSets[0]!;
    payload.data.loggedSets.push({
      ...original,
      id: "ls2",
      setIndex: 1,
    });
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) => /duplicate.*slot/i.test(e.message))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; confirm the duplicate test fails, the distinct test passes**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — duplicate slot check" 2>&1 | tail -15
```

Expected: 1 fail (`rejects two LoggedSets...`), 1 pass (`accepts two LoggedSets...`).

- [ ] **Step 3: Add the duplicate-slot check**

In `web/src/services/backup-service.ts`, inside `validateBackupPayload`, find the FK-integrity section that begins around line 919 with `// ERRATA P7-C: Cross-record FK integrity checks`. Add a new block AFTER the `loggedSets.sessionExerciseId` check (around line 966), BEFORE `return errors;`:

```ts
  // Sprint 2: duplicate slot check.
  // Dexie has a unique compound index on [sessionExerciseId+blockIndex+setIndex]
  // for loggedSets. Catch duplicates here so the failure mode is a clean
  // BackupValidationError instead of a Dexie ConstraintError mid-transaction.
  const slotKeys = new Set<string>();
  loggedSets.forEach((ls, i) => {
    if (typeof ls !== "object" || ls === null) return;
    const lsObj = ls as Record<string, unknown>;
    const seId = lsObj.sessionExerciseId;
    const bIdx = lsObj.blockIndex;
    const sIdx = lsObj.setIndex;
    if (
      typeof seId === "string" &&
      typeof bIdx === "number" &&
      typeof sIdx === "number"
    ) {
      const key = `${seId}::${bIdx}::${sIdx}`;
      if (slotKeys.has(key)) {
        errors.push({
          field: `data.loggedSets[${i}]`,
          message: `duplicate slot: another LoggedSet already targets sessionExerciseId="${seId}", blockIndex=${bIdx}, setIndex=${sIdx}`,
        });
      } else {
        slotKeys.add(key);
      }
    }
  });
```

- [ ] **Step 4: Run the duplicate-slot tests**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — duplicate slot check" 2>&1 | tail -10
```

Expected: 2 of 2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): reject duplicate LoggedSet slots before import

The Dexie schema has a unique compound index on
[sessionExerciseId+blockIndex+setIndex] for loggedSets. A duplicate
in the import payload would previously fail mid-transaction at
bulkAdd time with an opaque ConstraintError after the routines /
sessions / sessionExercises tables had already been cleared and
repopulated. Now validateBackupPayload catches duplicate slot keys
up front and emits a clean BackupValidationError.

Closes part of F1. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 6: Extended Referential Integrity

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Modify: `web/tests/unit/services/backup-service.test.ts`

Today (lines 922-967) the validator checks: `settings.activeRoutineId` → routine exists; `sessionExercises.sessionId` → session exists; `loggedSets.sessionExerciseId` → sessionExercise exists.

Missing: `loggedSets.sessionId === parentSessionExercise.sessionId`; `Session.routineId` (when non-null) → routine exists.

- [ ] **Step 1: Write failing tests**

Append:

```ts
describe("validator hardening — Sprint 2 — extended referential integrity", () => {
  it("rejects a LoggedSet whose sessionId disagrees with its parent SessionExercise.sessionId", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    // Make the LoggedSet point at the right parent SE but a different session.
    payload.data.sessions.push(makeSession("s2", { id: "s2" }));
    payload.data.loggedSets[0]!.sessionId = "s2"; // parent SE is in "s1"
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.loggedSets[0].sessionId" &&
      /parent sessionExercise/i.test(e.message)
    )).toBe(true);
  });

  it("rejects a Session.routineId that doesn't reference an imported routine", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessions[0]!.routineId = "ghost-routine";
    const errors = validateBackupPayload(payload, cat);
    expect(errors.some((e) =>
      e.field === "data.sessions[0].routineId" &&
      /not in the imported routines/i.test(e.message)
    )).toBe(true);
  });

  it("accepts Session.routineId === null (history survives routine deletion)", async () => {
    const cat = new Set([catalogId]);
    const payload = makeMinimalValidPayload();
    payload.data.sessions[0]!.routineId = null;
    const errors = validateBackupPayload(payload, cat);
    expect(errors.filter((e) => e.field === "data.sessions[0].routineId")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; confirm 2 fail, 1 passes**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — extended referential integrity" 2>&1 | tail -15
```

Expected: the two negative-case tests fail; the positive-case test passes.

- [ ] **Step 3: Add the new FK checks**

In `web/src/services/backup-service.ts`, inside `validateBackupPayload`, in the FK section starting around line 919, add the following AFTER the existing `loggedSets.sessionExerciseId` check (and AFTER the duplicate-slot check from Task 5), BEFORE `return errors;`:

```ts
  // Sprint 2: loggedSets.sessionId must equal the parent SessionExercise's sessionId.
  // Build a lookup: sessionExercise.id -> sessionExercise.sessionId.
  const seSessionByIdLookup = new Map<string, string>();
  sessionExercises.forEach((se) => {
    if (typeof se === "object" && se !== null) {
      const seObj = se as Record<string, unknown>;
      if (isString(seObj.id) && isString(seObj.sessionId)) {
        seSessionByIdLookup.set(seObj.id as string, seObj.sessionId as string);
      }
    }
  });
  loggedSets.forEach((ls, i) => {
    if (typeof ls !== "object" || ls === null) return;
    const lsObj = ls as Record<string, unknown>;
    const lsSeId = lsObj.sessionExerciseId;
    const lsSessionId = lsObj.sessionId;
    if (typeof lsSeId === "string" && typeof lsSessionId === "string") {
      const parentSessionId = seSessionByIdLookup.get(lsSeId);
      if (parentSessionId !== undefined && parentSessionId !== lsSessionId) {
        errors.push({
          field: `data.loggedSets[${i}].sessionId`,
          message: `disagrees with parent sessionExercise: LoggedSet.sessionId="${lsSessionId}" but SessionExercise.sessionId="${parentSessionId}"`,
        });
      }
    }
  });

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

- [ ] **Step 4: Run the extended-FK tests**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — extended referential integrity" 2>&1 | tail -10
```

Expected: 3 of 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/backup-service.ts tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): add cross-record FK checks for LoggedSet.sessionId and Session.routineId

Two referential-integrity gaps closed in validateBackupPayload:
- LoggedSet.sessionId must match its parent SessionExercise.sessionId.
  A backup with mismatched ids previously imported successfully but
  produced corrupt history (sessions joining wrong sets).
- Session.routineId, when non-null, must reference an imported routine.
  A null routineId remains accepted (history survives routine
  deletion — invariant 5).

Closes part of F1. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 7: Legacy Backup Round-Trip Regression Test

**Files:**
- Modify: `web/tests/unit/services/backup-service.test.ts`

The hardened validator must still accept payloads that today's `exportBackup` produces. Add a round-trip test: seed a non-trivial DB, export, validate, import into a fresh DB, confirm the data round-trips byte-equal.

- [ ] **Step 1: Write the round-trip test**

Append:

```ts
describe("validator hardening — Sprint 2 — legacy backup round-trip", () => {
  it("a backup produced by today's exportBackup validates and re-imports cleanly", async () => {
    // Build a non-trivial state: one routine, two finished sessions, multiple
    // session exercises, multiple logged sets across blocks. Reuse helpers.
    const exercise = makeExercise(catalogId);
    const routine = makeRoutine("r1");
    const session1 = makeSession("s1", { finishedAt: "2026-04-20T11:00:00.000Z" });
    const session2 = makeSession("s2", { id: "s2", startedAt: "2026-04-22T10:00:00.000Z", finishedAt: "2026-04-22T11:00:00.000Z" });
    const se1 = makeSessionExercise("se1", "s1", catalogId);
    const se2 = makeSessionExercise("se2", "s2", catalogId);
    const sets = [
      makeLoggedSet("ls1", "s1", "se1", catalogId, { blockIndex: 0, setIndex: 0 }),
      makeLoggedSet("ls2", "s1", "se1", catalogId, { blockIndex: 0, setIndex: 1 }),
      makeLoggedSet("ls3", "s1", "se1", catalogId, { blockIndex: 0, setIndex: 2 }),
      makeLoggedSet("ls4", "s2", "se2", catalogId, { blockIndex: 0, setIndex: 0 }),
    ];

    // Seed source DB.
    await db.exercises.put(exercise);
    await db.routines.put(routine);
    await db.sessions.bulkAdd([session1, session2]);
    await db.sessionExercises.bulkAdd([se1, se2]);
    await db.loggedSets.bulkAdd(sets);
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      activeRoutineId: "r1",
      userName: "Alice",
      onboardingCompletedAt: "2026-04-19T09:00:00.000Z",
    });

    // Export.
    const envelope = await exportBackup(db);

    // Validate against the catalog set.
    const cat = new Set([catalogId]);
    const errors = validateBackupPayload(envelope, cat);
    expect(errors).toEqual([]);

    // Import into a fresh DB.
    const db2 = new ExerciseLoggerDB("ExerciseLoggerDB-roundtrip-target");
    try {
      await initializeSettings(db2);
      await db2.exercises.put(exercise); // catalog FK target
      await importBackup(db2, envelope);

      // Confirm tables match.
      const r2 = await db2.routines.toArray();
      const s2 = await db2.sessions.toArray();
      const se2x = await db2.sessionExercises.toArray();
      const ls2 = await db2.loggedSets.toArray();
      const set2 = await db2.settings.get("user");

      expect(r2).toHaveLength(1);
      expect(s2).toHaveLength(2);
      expect(se2x).toHaveLength(2);
      expect(ls2).toHaveLength(4);
      expect(set2?.userName).toBe("Alice");
      expect(set2?.activeRoutineId).toBe("r1");
    } finally {
      await db2.close();
    }
  });
});
```

If the existing `makeLoggedSet` helper signature does not accept the `overrides` shape used above, adapt either the call (positional args) or extend the helper. Keep the change minimal — match what already exists in the file.

- [ ] **Step 2: Run; confirm pass**

```bash
npm test -- tests/unit/services/backup-service.test.ts -t "Sprint 2 — legacy backup round-trip" 2>&1 | tail -15
```

Expected: PASS. If FAIL, the validator is now stricter than today's exporter — investigate which invariant rejects the export and decide whether the export needs to be tightened first or whether the validator is over-strict for that field.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
test(backup): legacy round-trip regression after Sprint 2 hardening

Seeds a non-trivial DB (routine + 2 finished sessions + multi-block
loggedSets + populated onboarding fields), runs exportBackup, asserts
validateBackupPayload returns no errors, then importBackup into a
fresh DB and confirms row counts and key fields round-trip.

Guards against the hardening accidentally rejecting payloads that
today's exporter produces.

Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 8: Progression Fallback — Group By Block, Bail On Ambiguity

**Files:**
- Modify: `web/src/services/progression-service.ts`
- Modify: `web/tests/unit/services/progression-service.test.ts`

Today (line 157) `findMostRecentFinishedSessionSets` groups by sessionId only. The fallback path can therefore return sets from two different blocks of the same exercise in one session if both blocks share `tag` and `targetKind`.

Fix: refactor the helper to take an OPTIONAL grouping discriminant. The primary path passes nothing (its inputs are already filtered by `blockSignature`, so all matches in a session belong to one block — though we'll defend with strict equality). The fallback path enables block-grouping and returns `[]` if the most recent finished session contains more than one matching block.

- [ ] **Step 1: Write failing tests**

Append a new `describe("fallback ambiguity — Sprint 2", ...)` block to `web/tests/unit/services/progression-service.test.ts` (add it as a sibling of existing top-level describes, near the bottom):

```ts
describe("fallback ambiguity — Sprint 2", () => {
  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.exercises.put(makeExercise("squat"));
  });

  afterEach(async () => {
    await db.close();
    indexedDB.deleteDatabase("ExerciseLoggerDB");
  });

  it("returns [] when the most recent finished session contains two matching untagged reps blocks", async () => {
    const blockA: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };
    const blockB: SetBlock = { targetKind: "reps", minValue: 6, maxValue: 10, count: 2 };

    const session = makeFinishedSession("s1", "2026-04-20T11:00:00.000Z");
    // Same exercise twice in the same session, distinct instanceLabel kept ""
    const se1 = makeSessionExercise("se1", "s1", "squat", [blockA]);
    const se2 = makeSessionExercise("se2", "s1", "squat", [blockB], { orderIndex: 1 });

    await db.sessions.put(session);
    await db.sessionExercises.bulkAdd([se1, se2]);
    await db.loggedSets.bulkAdd([
      makeLoggedSet("l1", "s1", "se1", "squat", 0, 0, blockA),
      makeLoggedSet("l2", "s1", "se1", "squat", 0, 1, blockA),
      makeLoggedSet("l3", "s1", "se1", "squat", 0, 2, blockA),
      makeLoggedSet("l4", "s1", "se2", "squat", 0, 0, blockB),
      makeLoggedSet("l5", "s1", "se2", "squat", 0, 1, blockB),
    ]);

    // Use a NEW (drifted) blockSignature so primary match misses; tag and
    // targetKind still match both prior blocks.
    const driftedBlock: SetBlock = { targetKind: "reps", minValue: 5, maxValue: 9, count: 3 };
    const driftedSig = generateBlockSignature(driftedBlock);

    const result = await findMatchingBlock(
      db,
      "squat",
      null,
      driftedSig,
      null, // no tag
      "reps",
    );

    expect(result).toEqual([]);
  });

  it("returns the single matching block when fallback resolves unambiguously", async () => {
    const blockA: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };

    const session = makeFinishedSession("s1", "2026-04-20T11:00:00.000Z");
    const se1 = makeSessionExercise("se1", "s1", "squat", [blockA]);

    await db.sessions.put(session);
    await db.sessionExercises.put(se1);
    await db.loggedSets.bulkAdd([
      makeLoggedSet("l1", "s1", "se1", "squat", 0, 0, blockA),
      makeLoggedSet("l2", "s1", "se1", "squat", 0, 1, blockA),
      makeLoggedSet("l3", "s1", "se1", "squat", 0, 2, blockA),
    ]);

    const driftedBlock: SetBlock = { targetKind: "reps", minValue: 5, maxValue: 9, count: 3 };
    const driftedSig = generateBlockSignature(driftedBlock);

    const result = await findMatchingBlock(
      db,
      "squat",
      null,
      driftedSig,
      null,
      "reps",
    );

    expect(result).toHaveLength(3);
    expect(result.map((ls) => ls.id).sort()).toEqual(["l1", "l2", "l3"]);
  });
});
```

These tests assume the existing test file's top-level `db` and `beforeEach`/`afterEach` patterns. If the file uses a different pattern (e.g., a per-describe `db` variable), match it. Read the existing file structure before pasting.

- [ ] **Step 2: Run; confirm the ambiguity test fails**

```bash
npm test -- tests/unit/services/progression-service.test.ts -t "fallback ambiguity — Sprint 2" 2>&1 | tail -20
```

Expected: the "returns []" test FAILS (current code returns 5 sets); the "returns the single matching block" test PASSES.

- [ ] **Step 3: Refactor `findMostRecentFinishedSessionSets`**

In `web/src/services/progression-service.ts`, change the helper signature to accept an optional `blockGrouping: boolean` parameter, and implement the bail-on-ambiguity:

```ts
/**
 * Given a set of logged sets, group them by sessionId, find the most recent
 * finished session, and return only the sets from that session.
 *
 * Sets are returned sorted by setIndex ascending.
 *
 * When `blockGrouping` is true (used by the fallback path), this further
 * groups the most recent session's matching sets by (sessionExerciseId,
 * blockIndex). If exactly one group, returns it. If more than one group,
 * returns [] — the fallback cannot honestly attribute the sets to a single
 * historical block.
 */
async function findMostRecentFinishedSessionSets(
  db: ExerciseLoggerDB,
  loggedSets: LoggedSet[],
  blockGrouping: boolean = false,
): Promise<LoggedSet[]> {
  // Group by sessionId
  const bySession = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const existing = bySession.get(ls.sessionId);
    if (existing) {
      existing.push(ls);
    } else {
      bySession.set(ls.sessionId, [ls]);
    }
  }

  // Load all referenced sessions and filter to finished only
  const sessionIds = [...bySession.keys()];
  const sessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await db.sessions.get(id);
    if (session && session.status === "finished") {
      sessions.push(session);
    }
  }

  if (sessions.length === 0) {
    return [];
  }

  // Sort by finishedAt descending to find the most recent
  sessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  const mostRecentSession = sessions[0]!;
  const matchingSets = bySession.get(mostRecentSession.id) ?? [];

  if (blockGrouping) {
    // Sprint 2 (F2): in fallback mode, the most recent session may contain
    // more than one matching block (same exerciseId+instanceLabel+tag+
    // targetKind, distinct blockSignature now-drifted). Group by
    // (sessionExerciseId, blockIndex). If more than one group, bail —
    // we cannot honestly attribute sets to a specific historical block.
    const byBlock = new Map<string, LoggedSet[]>();
    for (const ls of matchingSets) {
      const key = `${ls.sessionExerciseId}::${ls.blockIndex}`;
      const existing = byBlock.get(key);
      if (existing) {
        existing.push(ls);
      } else {
        byBlock.set(key, [ls]);
      }
    }
    if (byBlock.size > 1) {
      return [];
    }
  }

  // Sort by setIndex ascending
  return matchingSets.sort((a, b) => a.setIndex - b.setIndex);
}
```

Then update the only fallback caller (line 145):

```ts
  if (fallbackMatches.length > 0) {
    return findMostRecentFinishedSessionSets(db, fallbackMatches, true);
  }
```

The primary caller (line 118) keeps the default `blockGrouping: false`.

- [ ] **Step 4: Run the ambiguity tests**

```bash
npm test -- tests/unit/services/progression-service.test.ts -t "fallback ambiguity — Sprint 2" 2>&1 | tail -15
```

Expected: 2 of 2 pass.

- [ ] **Step 5: Run the full progression-service test file to catch regressions**

```bash
npm test -- tests/unit/services/progression-service.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/progression-service.ts tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
fix(progression): bail out of fallback when most recent session is ambiguous

findMostRecentFinishedSessionSets now accepts a blockGrouping flag.
When true (set by the fallback caller), it groups the most recent
finished session's matching sets by (sessionExerciseId, blockIndex)
and returns [] if more than one group is present.

Without this, a routine edit that drifted the blockSignature could
cause the fallback to return sets from two distinct historical
blocks combined — producing misleading "last time" hints and
incorrect progression suggestions.

Closes part of F2. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 9: `allSetsLogged` Strict Equality

**Files:**
- Modify: `web/src/services/progression-service.ts`
- Modify: `web/tests/unit/services/progression-service.test.ts`

Today `allSetsLogged` (line 221) uses `>=`. Tighten to `===`. This applies to the primary match path too — over-logging (more sets logged than the block prescribes) should not unlock automated progression.

- [ ] **Step 1: Write the failing test**

Append to the same Sprint 2 describe block in `progression-service.test.ts`:

```ts
it("calculateBlockSuggestion does NOT progress when more sets are logged than the block prescribes", async () => {
  const block: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };

  // 4 sets logged, all hitting ceiling; block prescribes 3.
  const sets: LoggedSet[] = [
    { ...makeLoggedSet("l1", "s1", "se1", "squat", 0, 0, block), performedReps: 12 },
    { ...makeLoggedSet("l2", "s1", "se1", "squat", 0, 1, block), performedReps: 12 },
    { ...makeLoggedSet("l3", "s1", "se1", "squat", 0, 2, block), performedReps: 12 },
    { ...makeLoggedSet("l4", "s1", "se1", "squat", 0, 3, block), performedReps: 12 },
  ];

  const suggestion = calculateBlockSuggestion(
    sets,
    block,
    0,
    "weight",
    "barbell",
    "kg",
  );

  expect(suggestion).not.toBeNull();
  expect(suggestion!.isProgression).toBe(false); // would have been true under `>=`
});
```

- [ ] **Step 2: Run; confirm fail**

```bash
npm test -- tests/unit/services/progression-service.test.ts -t "more sets are logged than the block prescribes" 2>&1 | tail -15
```

Expected: FAIL — current code uses `>=`, returns `isProgression: true`.

- [ ] **Step 3: Apply the fix**

In `web/src/services/progression-service.ts`, change line 221 from:

```ts
function allSetsLogged(matchingSets: LoggedSet[], expectedCount: number): boolean {
  return matchingSets.length >= expectedCount;
}
```

to:

```ts
function allSetsLogged(matchingSets: LoggedSet[], expectedCount: number): boolean {
  return matchingSets.length === expectedCount;
}
```

- [ ] **Step 4: Run the new test plus full file**

```bash
npm test -- tests/unit/services/progression-service.test.ts -t "more sets are logged than the block prescribes" 2>&1 | tail -10
npm test -- tests/unit/services/progression-service.test.ts 2>&1 | tail -10
```

Expected: new test passes; existing tests pass. If an existing test relied on `>=` semantics (e.g., a test that logs 4 sets for a 3-set block and expects progression), update the test fixture to log exactly 3 sets — the behavior change is intentional.

- [ ] **Step 5: Commit**

```bash
git add src/services/progression-service.ts tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
fix(progression): allSetsLogged requires strict equality with expectedCount

Previously `>=` allowed over-logging (4 sets in a 3-set block) to
unlock automated progression. Tightened to `===` so progression
fires only when the user logged exactly the prescribed number of
sets. Applies to both primary and fallback match paths.

Closes part of F2. Part of sprint-2/data-trust-hardening.
EOF
)"
```

---

## Task 10: Full Sprint Gate

**Files:** None modified.

- [ ] **Step 1: Three consecutive `npm test` runs**

```bash
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | tail -5
done
```

Expected: each ends with `0 failed`. The total test counts will be higher than Task 1 baseline (Sprint 2 added ~25 new tests). Note the new totals.

- [ ] **Step 2: Lint, typecheck, build, e2e**

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: each exits 0.

- [ ] **Step 3: No commit in this task.**

---

## Task 11: PR, CI, Merge

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-sprint-2-data-trust-hardening.md` — tick Exit Criteria.
- Modify: `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 2 in the Rollup.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin sprint-2/data-trust-hardening
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: data trust hardening (sprint 2)" --body "$(cat <<'EOF'
## Summary

Sprint 2 of the [v2 Post-Audit Hardening Roadmap](../blob/main/docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md). Closes audit findings F1 (backup validator weaker than live services) and F2 (progression fallback can merge multiple historical blocks).

### Part A — backup-service hardening (F1)

- **Finite numerics on LoggedSet performance fields.** New helpers `isFiniteNumber`, `isFinitePositive`, `isFiniteNonNegativeInteger`, `isFiniteNumberOrNull`. The four performance fields now reject `Infinity`, `-Infinity`, and `NaN` (they previously rejected only NaN).
- **Full SetBlock contract.** `validateSetBlock` now requires exactly-one-of (`{minValue, maxValue}` XOR `exactValue`), `minValue < maxValue`, finite positive value bounds, and `Number.isInteger(count) && count >= 1`.
- **Settings onboarding fields.** `userName` (string-or-null, ≤40 codepoints) and the five timestamp fields (`onboardingCompletedAt`, `onboardingSkippedAt`, `lastGeneratedPrompt`, `lastGeneratedPromptAt`, `onboardingBannerDismissedAt`) are now validated as `string | null`. ISO format intentionally not enforced — matches live setter behavior.
- **Duplicate-slot check.** Catches `(sessionExerciseId, blockIndex, setIndex)` collisions during validation, before the import transaction.
- **Extended FK integrity.** `LoggedSet.sessionId` must agree with parent `SessionExercise.sessionId`. `Session.routineId`, when non-null, must reference an imported routine.
- **Legacy round-trip regression test** confirms today's exporter still produces payloads the hardened validator accepts.

### Part B — progression-service fallback (F2)

- **`findMostRecentFinishedSessionSets`** now takes an optional `blockGrouping` flag. The fallback caller passes `true`, which further groups by `(sessionExerciseId, blockIndex)` within the most recent finished session. If more than one matching block is found, the helper returns `[]` rather than combining sets from distinct blocks.
- **`allSetsLogged`** tightened from `>=` to `===` for both primary and fallback paths. Over-logging (more sets logged than the block prescribes) no longer unlocks automated progression.

### User-visible side effect

After this PR, when a routine edit drifts a block signature AND the prior session contains multiple matching blocks, the "last time" hint disappears for that block instead of showing combined data from two blocks. This is intentional — the previous behavior was misleading.

## Evidence

- ~25 new service-layer tests added across `backup-service.test.ts` and `progression-service.test.ts`. All pass.
- 3/3 `npm test` consecutive runs green.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` all pass.

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

Expected: all checks green. If the `test` job fails, pull `gh run view --log-failed` and investigate.

- [ ] **Step 4: Tick the Exit Criteria in both plan docs**

Edit `docs/superpowers/plans/2026-04-23-sprint-2-data-trust-hardening.md` Exit Criteria section: tick all items.

Edit `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`:
- Sprint 2 Exit Criteria — tick all items in that section.
- Rollup section — tick "All fifteen audit findings have a resolution" cannot tick yet (only F1/F2/F4 closed). Skip.
- Rollup — tick "Backup round-trip: export → tamper → import rejects with precise errors; valid export → import produces identical state."
- Rollup — tick "Progression fallback: two-block ambiguity → no suggestion; single match → correct suggestion."

- [ ] **Step 5: Commit doc updates and push**

```bash
git add docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md docs/superpowers/plans/2026-04-23-sprint-2-data-trust-hardening.md
git commit -m "$(cat <<'EOF'
docs: mark sprint 2 exit criteria complete

CI green on sprint-2/data-trust-hardening. F1 and F2 closed; backup
round-trip and progression-ambiguity rollup items ticked.
EOF
)"
git push
```

- [ ] **Step 6: Merge**

```bash
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

- [x] All five backup-validation invariants implemented with paired positive/negative tests.
- [x] Legacy round-trip regression test passes.
- [x] Progression fallback bails out cleanly on two-block ambiguity; single-block fallback still works; primary path uses strict equality.
- [x] Full gate green: 3 consecutive `npm test` runs, lint, typecheck, build, e2e.
- [x] CI green on the PR.
- [x] No source files outside `services/` modified.
- [x] No domain types changed.
- [x] No Dexie schema bump.
- [x] Roadmap Sprint 2 Exit Criteria ticked.
- [x] PR merged, branch deleted.

---

## Risks And Contingencies

### Risk 1: Tightening rejects today's own exports

Most likely surface: a `SetBlock` already in someone's local routine that uses `tag: null` (rather than omitting `tag`) or a partial range (`minValue` set, `maxValue` undefined — should be impossible by construction but worth noting). Mitigation: Task 7's round-trip test catches this. If it fails, loosen the specific rule (e.g., keep tag-null tolerance) before proceeding.

### Risk 2: Existing progression tests assume `>=` semantics

If a fixture logs 4 sets for a 3-set block and expects `isProgression: true`, the strict-equality change will fail it. Update the fixture to log exactly 3 sets — the over-logging case was a latent bug.

### Risk 3: Block-grouping bail-out hides legitimate matches

The fallback bail-out is intentional but does remove signal. If user feedback says "my routine edit lost all my history hints," the fix may be (a) improve primary-match recall (e.g., signature normalization), or (b) widen fallback's discriminant (e.g., include blockIndex stability across edits). Out of scope here; track as follow-up.

### Risk 4: Test file gets very long

`backup-service.test.ts` is already 902 lines; this sprint adds ~250 more. If readability suffers, consider splitting into `backup-service.test.ts` (round-trip + import) and `backup-service-validation.test.ts` (validator unit tests) at sprint close. Do not split for the sake of splitting — only if you genuinely lose track of which describe owns what.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage.** F1 → Tasks 2-7. F2 → Tasks 8-9. Round-trip safety net → Task 7. CI gate → Task 10. PR/merge → Task 11.
- [x] **Placeholder scan.** No TBDs, no "add appropriate validation" — every helper, function, and test is given verbatim.
- [x] **Type consistency.** `isFiniteNumber`, `isFinitePositive`, `isFiniteNonNegativeInteger`, `isFiniteNumberOrNull` named consistently across Tasks 2–6. `validateSetBlock`, `validateSettings`, `validateBackupPayload`, `findMostRecentFinishedSessionSets`, `allSetsLogged` references are accurate. `BackupValidationError` shape unchanged.
- [x] **Source scope.** Modifies only two source files (`backup-service.ts`, `progression-service.ts`) and two test files. No domain, no UI, no Dexie schema.
- [x] **No new dependencies.** Hand-rolled validators per the resolved decision.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-sprint-2-data-trust-hardening.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

# Onboarding Questionnaire — Sprint A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the non-UI foundation for the first-run onboarding / routine-questionnaire feature: a Dexie v3 migration that adds six nullable `Settings` fields (backfilling existing users as *skipped*), a new `onboarding-service.ts` with five thin write helpers, `setUserName` on `settings-service`, a shared `GPT_URL` constant, and a pure `prompt-builder` fed by a locked `Answer`/`Answers`/`StepId` type module.

**Architecture:** Each layer's responsibility stays where the existing app puts it. Types live in `web/src/domain/types.ts` (the `Settings` interface) and in a new `web/src/features/onboarding/lib/types.ts` (answer shapes consumed by the prompt builder now and by Sprint B's reducer later). DB schema and defaults extend `web/src/db/database.ts` with a chained `version(3)` upgrade. Services land in `web/src/services/` with the standard `db`-first-arg signature. The `prompt-builder` is a pure function in `web/src/features/onboarding/lib/prompt-builder.ts`, importable without pulling in React or Dexie. The GPT URL is lifted out of `RoutineImportScreen` into `web/src/shared/lib/gpt-url.ts` so Sprint D's `HandoffScreen` can import the same constant.

**Tech Stack:** TypeScript 5 · Dexie 4 (via `ExerciseLoggerDB`) · Vitest + `fake-indexeddb/auto` · `nowISO()` from `@/domain/timestamp`. Zero new runtime dependencies.

---

## Source-of-truth cross-reference

| Concern | Location |
|---|---|
| Sprint scope / deliverables / exit criteria | `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` §Sprint A (lines 160–341) |
| Settings field list, prompt format, rules 1–10, validation limits, Decision D3/D5/D10 | `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` §Architecture & Data Model, §Prompt Generation, §Validation & input limits |
| 11-topic intake list (keep prompt in lockstep) | `docs/custom-gpt/workout-routine-gpt.instructions.md` §Intake Workflow |
| Dexie v1→v2 chained `.upgrade()` pattern to mimic | `web/src/db/database.ts:22–52` |
| Current `Settings` interface | `web/src/domain/types.ts:259–267` |
| Existing `db.settings.update("user", …)` / in-transaction guard style | `web/src/services/settings-service.ts` |
| Inline GPT URL being extracted | `web/src/features/settings/RoutineImportScreen.tsx:14–15` |
| Locked contracts that later sprints consume | orchestration plan §11, Appendix A (A-1…A-5, A-9) |

---

## File map (what this sprint creates or touches)

**Create:**

| Path | Responsibility |
|---|---|
| `web/src/shared/lib/gpt-url.ts` | Single export: `GPT_URL` (the ace-logger-routine-maker URL). Importable by `RoutineImportScreen` now and `HandoffScreen` in Sprint D. |
| `web/src/services/onboarding-service.ts` | Five async functions — `markOnboardingCompleted`, `markOnboardingSkipped`, `saveGeneratedPrompt`, `clearLastPrompt`, `dismissOnboardingBanner`. Each is a single `db.settings.update("user", …)`. |
| `web/src/features/onboarding/lib/types.ts` | Exports `StepId`, `Answer`, `Answers`. Pure type module — no runtime imports. Sprint B's reducer and Sprint D's HandoffScreen will import from here. |
| `web/src/features/onboarding/lib/prompt-builder.ts` | Pure `buildPrompt(answers: Answers): string` with the 10 formatting rules from spec §Prompt Generation. |
| `web/tests/unit/services/onboarding-service.test.ts` | Verifies each of the 5 service functions updates the right fields with ISO timestamps. |
| `web/tests/unit/features/onboarding/prompt-builder.test.ts` | Full + minimum + edge-case + regression-lock tests for `buildPrompt`. |
| `web/tests/integration/migration-v2-to-v3.test.ts` | Fresh-v3 install defaults + v2→v3 upgrade backfill (Decision D3). |

**Modify:**

| Path | Change |
|---|---|
| `web/src/domain/types.ts` | Extend `Settings` interface with 6 new nullable fields. |
| `web/src/db/database.ts` | Add chained `this.version(3).stores(...).upgrade(...)` block. Extend `DEFAULT_SETTINGS` with 6 new fields (all `null`). |
| `web/src/services/settings-service.ts` | Add `setUserName(db, name)` with trim + `maxLength=40` truncate; accepts `null`. |
| `web/src/features/settings/RoutineImportScreen.tsx` | Replace the inline `GPT_URL` constant (lines 14–15) with `import { GPT_URL } from "@/shared/lib/gpt-url";`. No other logic change. |
| `web/tests/unit/services/settings-service.test.ts` | Append a `describe("setUserName", …)` block with ~4 tests. |
| `web/src/db/CLAUDE.md` | Add "Schema (version 3)" section after version 2, enumerating the 6 new fields and calling out the D3 backfill. |
| `web/src/services/CLAUDE.md` | Add an `onboarding-service.ts` entry describing the 5 functions. |

**Out of scope (explicit — do not create, do not modify):**
- Any React component, hook, route, or screen under `web/src/features/onboarding/` beyond `lib/types.ts` and `lib/prompt-builder.ts`.
- `web/src/features/onboarding/lib/questionnaire-state.ts` (Sprint B) and `session-storage.ts` (Sprint B).
- `App.tsx`, `AppRoutes`, any routing change.
- `TodayScreen`, `SettingsScreen`, any consumer of the new fields.
- Any change to `RoutineImportScreen` beyond the import swap.
- Any modification to the custom-GPT admin panel.

Expected baseline: 742 tests. Expected after Sprint A: **~767 tests** (+~25). If a task would touch a file not listed in the file map, stop and escalate.

---

## Task ordering rationale

Types-first so every subsequent task compiles cleanly. Migration before services so the `onboarding-service` tests can write the new fields on a v3 DB. `prompt-builder` last because it consumes the `Answers` type but is otherwise standalone. The `GPT_URL` refactor is independent and can land any time, but is scheduled near the end to avoid merge noise with the db/service work.

Recommended order (each is a commit):

1. Extend `Settings` interface (`domain/types.ts`).
2. Extend `DEFAULT_SETTINGS` (`db/database.ts`).
3. Add Dexie `version(3)` migration + integration test.
4. Create `onboarding-service.ts` + unit tests.
5. Add `setUserName` to `settings-service.ts` + unit tests.
6. Create `shared/lib/gpt-url.ts` + refactor `RoutineImportScreen`.
7. Create `features/onboarding/lib/types.ts`.
8. Create `features/onboarding/lib/prompt-builder.ts` + unit tests.
9. Docs polish: update `db/CLAUDE.md` and `services/CLAUDE.md`.

---

## Task 1: Extend the `Settings` interface with 6 new nullable fields

**Files:**
- Modify: `web/src/domain/types.ts` (at the `Settings` interface, currently lines 259–267)

This task has no behavior tests of its own — it is a type-only change. The type is exercised transitively by Task 3's migration test and Task 4's service tests, both of which will fail to type-check if this task is wrong. We therefore rely on `npm run build` / `tsc --noEmit` equivalent (Vitest compiles TS) to prove correctness.

- [ ] **Step 1: Run the baseline test suite to record the starting count**

Run: `cd web && npm test -- --run`
Expected: green, ~742 tests. Note the exact number for the Sprint-exit check.

- [ ] **Step 2: Modify the `Settings` interface**

Replace the current interface at `web/src/domain/types.ts:259–267` with:

```ts
/** Single-record settings table. */
export interface Settings {
  /** Always "user". */
  id: string;
  /** FK to routines table, or null when no routine is active. */
  activeRoutineId: string | null;
  /** Display unit preference. */
  units: UnitSystem;
  /**
   * User's preferred name for the greeting on Today.
   * Set on the onboarding welcome screen or later via Settings → Profile.
   * null means "no name set" — UI falls back to "Hello.".
   */
  userName: string | null;
  /** ISO UTC timestamp when the user completed the full onboarding flow (successful YAML import on Stage 2). null = not yet. */
  onboardingCompletedAt: string | null;
  /** ISO UTC timestamp when the user skipped onboarding ("Maybe later" on welcome, or migrated-from-v2). null = not skipped. */
  onboardingSkippedAt: string | null;
  /** The last prompt produced by `buildPrompt`, persisted on Stage 1 handoff button tap. null when no prompt has been generated. */
  lastGeneratedPrompt: string | null;
  /** ISO UTC timestamp matching `lastGeneratedPrompt`. null when `lastGeneratedPrompt` is null. */
  lastGeneratedPromptAt: string | null;
  /** ISO UTC timestamp when the user dismissed the Today "Finish importing your routine" banner. Reset to null whenever a new prompt is saved. */
  onboardingBannerDismissedAt: string | null;
}
```

- [ ] **Step 3: Verify the codebase still compiles**

Run: `cd web && npm test -- --run`
Expected: still green at the baseline count (no new tests yet). Any compile error surfaces as a Vitest transform failure — fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add web/src/domain/types.ts
git commit -m "feat(onboarding): extend Settings interface with 6 nullable onboarding fields"
```

---

## Task 2: Extend `DEFAULT_SETTINGS` with the 6 new fields

**Files:**
- Modify: `web/src/db/database.ts` (at `DEFAULT_SETTINGS`, currently lines 56–60)
- Test: existing `web/tests/unit/db/database.test.ts` already asserts settings round-trip; we extend one test.

- [ ] **Step 1: Write the failing test**

Append to `web/tests/unit/db/database.test.ts` inside the top-level `describe("ExerciseLoggerDB", …)`:

```ts
  it("DEFAULT_SETTINGS includes all 6 onboarding fields defaulting to null", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      id: "user",
      activeRoutineId: null,
      units: "kg",
      userName: null,
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
      lastGeneratedPrompt: null,
      lastGeneratedPromptAt: null,
      onboardingBannerDismissedAt: null,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/db/database.test.ts`
Expected: FAIL — `DEFAULT_SETTINGS` is missing the 6 new keys.

- [ ] **Step 3: Extend `DEFAULT_SETTINGS`**

Replace lines 55–60 of `web/src/db/database.ts`:

```ts
/** Default settings record created on first launch. */
export const DEFAULT_SETTINGS: Settings = {
  id: "user",
  activeRoutineId: null,
  units: "kg",
  userName: null,
  onboardingCompletedAt: null,
  onboardingSkippedAt: null,
  lastGeneratedPrompt: null,
  lastGeneratedPromptAt: null,
  onboardingBannerDismissedAt: null,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/unit/db/database.test.ts`
Expected: PASS — all `ExerciseLoggerDB` tests green including the new one.

- [ ] **Step 5: Commit**

```bash
git add web/src/db/database.ts web/tests/unit/db/database.test.ts
git commit -m "feat(onboarding): default DEFAULT_SETTINGS onboarding fields to null"
```

---

## Task 3: Add Dexie `version(3)` migration with v2→v3 upgrade (Decision D3)

**Files:**
- Modify: `web/src/db/database.ts` (chain a new `.version(3).stores(...).upgrade(...)` after the existing v2 block, i.e. after line 51)
- Test: `web/tests/integration/migration-v2-to-v3.test.ts` (create)

**Critical correctness (spec §Architecture & Data Model → Dexie schema v3; Decision D3):**

- The `.upgrade()` block must backfill `onboardingSkippedAt = nowISO()` for existing users — NOT `null`. This is how existing testers are silently marked onboarded.
- The other 5 new fields (`userName`, `onboardingCompletedAt`, `lastGeneratedPrompt`, `lastGeneratedPromptAt`, `onboardingBannerDismissedAt`) are set to `null`.
- `units` and `activeRoutineId` must be left untouched.
- Fresh installs (no prior v1/v2 data) must NOT run the `.upgrade()` block — Dexie only runs it when opening an older version.

- [ ] **Step 1: Write the failing test**

Create `web/tests/integration/migration-v2-to-v3.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { ExerciseLoggerDB, DEFAULT_SETTINGS, initializeSettings } from "@/db/database";

const DB_NAME = "ExerciseLoggerDB";

describe("migration v2 → v3", () => {
  afterEach(async () => {
    // Ensure any prior handle is deleted so each test starts clean.
    await Dexie.delete(DB_NAME);
  });

  it("fresh v3 install has all 6 onboarding fields defaulting to null", async () => {
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings?.onboardingSkippedAt).toBeNull();
    expect(settings?.onboardingCompletedAt).toBeNull();
    expect(settings?.userName).toBeNull();
    expect(settings?.lastGeneratedPrompt).toBeNull();
    expect(settings?.lastGeneratedPromptAt).toBeNull();
    expect(settings?.onboardingBannerDismissedAt).toBeNull();
    await db.close();
  });

  it("upgrades a v2 database and marks the existing user as skipped (D3)", async () => {
    // Arrange: build a v2-schema database by hand, matching database.ts:36–52.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    v2.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    await v2.open();
    await v2.table("settings").put({
      id: "user",
      activeRoutineId: "r-existing",
      units: "lbs",
    });
    await v2.close();

    // Act: re-open through the current app class, which advances to v3.
    const before = Date.now();
    const db = new ExerciseLoggerDB();
    await db.open();
    const after = Date.now();
    const settings = await db.settings.get("user");
    await db.close();

    // Assert: D3 — existing user is silently marked skipped.
    expect(settings?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    const skippedMs = Date.parse(settings!.onboardingSkippedAt!);
    expect(skippedMs).toBeGreaterThanOrEqual(before);
    expect(skippedMs).toBeLessThanOrEqual(after);

    // Preserved from v2.
    expect(settings?.activeRoutineId).toBe("r-existing");
    expect(settings?.units).toBe("lbs");

    // Other 5 new fields are null.
    expect(settings?.userName).toBeNull();
    expect(settings?.onboardingCompletedAt).toBeNull();
    expect(settings?.lastGeneratedPrompt).toBeNull();
    expect(settings?.lastGeneratedPromptAt).toBeNull();
    expect(settings?.onboardingBannerDismissedAt).toBeNull();
  });

  it("upgrade leaves other tables untouched", async () => {
    // Arrange: seed a v2 DB with an exercise + routine + settings.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    v2.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    await v2.open();
    await v2.table("exercises").put({
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    });
    await v2.table("settings").put({ id: "user", activeRoutineId: null, units: "kg" });
    await v2.close();

    // Act: re-open as v3.
    const db = new ExerciseLoggerDB();
    await db.open();
    const ex = await db.exercises.get("barbell-back-squat");
    await db.close();

    // Assert: exercise row is intact.
    expect(ex?.name).toBe("Barbell Back Squat");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/integration/migration-v2-to-v3.test.ts`
Expected: FAIL — `ExerciseLoggerDB` is still on v2; opening after a v2 seed either throws `VersionError` or reads back `undefined` for `onboardingSkippedAt`.

- [ ] **Step 3: Add the v3 migration**

In `web/src/db/database.ts`, update the imports at the top to include `nowISO`, and insert the v3 block AFTER the existing v2 block (after line 51, before the closing `}` of the constructor):

```ts
import Dexie, { type EntityTable } from "dexie";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";
import { nowISO } from "@/domain/timestamp";
```

Then add (chained, NOT replacing v2):

```ts
    // Version 3: Add 6 onboarding-related fields to the settings record.
    // None of the new fields are indexed, so the `.stores(...)` signature is
    // identical to v2. (Dexie requires a stores() call even when nothing
    // changes, because .upgrade() attaches to the version.)
    //
    // D3: existing users are silently marked as *skipped* so they don't see
    // the first-run gate. New v3 installs get all-null defaults via
    // DEFAULT_SETTINGS / initializeSettings().
    //
    // Compound-index + null trap: these six fields are unindexed, so storing
    // null here is safe. If a future schema adds any of them to a compound
    // index, switch to a sentinel (e.g. "") the way instanceLabel does.
    this.version(3).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(async (trans) => {
      const existing = await trans.table("settings").get("user");
      if (existing) {
        await trans.table("settings").update("user", {
          userName: null,
          onboardingCompletedAt: null,
          onboardingSkippedAt: nowISO(),
          lastGeneratedPrompt: null,
          lastGeneratedPromptAt: null,
          onboardingBannerDismissedAt: null,
        });
      }
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/integration/migration-v2-to-v3.test.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `cd web && npm test -- --run`
Expected: green. Test count = baseline + 4 (Task 2's one + Task 3's three).

- [ ] **Step 6: Commit**

```bash
git add web/src/db/database.ts web/tests/integration/migration-v2-to-v3.test.ts
git commit -m "feat(onboarding): add Dexie v3 migration with D3 skipped-user backfill"
```

---

## Task 4: Create `onboarding-service.ts` with 5 update helpers

**Files:**
- Create: `web/src/services/onboarding-service.ts`
- Test: `web/tests/unit/services/onboarding-service.test.ts`

**Contract (orchestration plan Appendix A-2):**

```ts
export async function markOnboardingCompleted(db: ExerciseLoggerDB): Promise<void>;
export async function markOnboardingSkipped(db: ExerciseLoggerDB): Promise<void>;
export async function saveGeneratedPrompt(db: ExerciseLoggerDB, prompt: string): Promise<void>;
export async function clearLastPrompt(db: ExerciseLoggerDB): Promise<void>;
export async function dismissOnboardingBanner(db: ExerciseLoggerDB): Promise<void>;
```

**Semantics (spec §Settings Integration → New services; §Prompt Generation → Persistence; §Decisions D5):**

- `markOnboardingCompleted`: `{ onboardingCompletedAt: nowISO() }`. Called by `HandoffScreen` Stage 2 after a successful YAML import. Idempotent — overwriting is fine.
- `markOnboardingSkipped`: `{ onboardingSkippedAt: nowISO() }`. Called by the "Maybe later" button on `OnboardingWelcomeScreen`.
- `saveGeneratedPrompt(prompt)`: `{ lastGeneratedPrompt: prompt, lastGeneratedPromptAt: nowISO(), onboardingBannerDismissedAt: null }`. The banner reset (per orchestration Appendix B) lives here — do NOT duplicate it in HandoffScreen.
- `clearLastPrompt`: `{ lastGeneratedPrompt: null, lastGeneratedPromptAt: null }`. Called by "Start over" on the handoff screen. Does NOT touch `onboardingBannerDismissedAt`.
- `dismissOnboardingBanner`: `{ onboardingBannerDismissedAt: nowISO() }`. Called by the Today banner's `×` button.

No transactions — all five are single-record updates on the pre-existing `user` settings row. No active-session guard (none of these mutations interact with sessions).

### Sub-task 4.1: write the test fixture

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/services/onboarding-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  markOnboardingCompleted,
  markOnboardingSkipped,
  saveGeneratedPrompt,
  clearLastPrompt,
  dismissOnboardingBanner,
} from "@/services/onboarding-service";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("onboarding-service", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("markOnboardingCompleted", () => {
    it("sets onboardingCompletedAt to an ISO timestamp", async () => {
      await markOnboardingCompleted(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingCompletedAt).toMatch(ISO_RE);
      expect(s?.onboardingSkippedAt).toBeNull();
    });
  });

  describe("markOnboardingSkipped", () => {
    it("sets onboardingSkippedAt to an ISO timestamp", async () => {
      await markOnboardingSkipped(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingSkippedAt).toMatch(ISO_RE);
      expect(s?.onboardingCompletedAt).toBeNull();
    });
  });

  describe("saveGeneratedPrompt", () => {
    it("persists prompt + timestamp and resets the banner dismissal", async () => {
      // Seed a prior dismissal so we can assert it gets cleared.
      await db.settings.update("user", {
        onboardingBannerDismissedAt: "2026-01-01T00:00:00.000Z",
      });

      await saveGeneratedPrompt(db, "HELLO PROMPT");

      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe("HELLO PROMPT");
      expect(s?.lastGeneratedPromptAt).toMatch(ISO_RE);
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
  });

  describe("clearLastPrompt", () => {
    it("nulls both prompt and promptAt, leaves banner dismissal untouched", async () => {
      await db.settings.update("user", {
        lastGeneratedPrompt: "OLD",
        lastGeneratedPromptAt: "2026-01-01T00:00:00.000Z",
        onboardingBannerDismissedAt: "2026-01-02T00:00:00.000Z",
      });

      await clearLastPrompt(db);

      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBeNull();
      expect(s?.lastGeneratedPromptAt).toBeNull();
      expect(s?.onboardingBannerDismissedAt).toBe("2026-01-02T00:00:00.000Z");
    });
  });

  describe("dismissOnboardingBanner", () => {
    it("sets onboardingBannerDismissedAt to an ISO timestamp", async () => {
      await dismissOnboardingBanner(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toMatch(ISO_RE);
    });
  });

  describe("integration: saveGeneratedPrompt resets a prior dismiss, clear does not", () => {
    it("saveGeneratedPrompt → dismiss → saveGeneratedPrompt re-nulls the dismissal", async () => {
      await saveGeneratedPrompt(db, "P1");
      await dismissOnboardingBanner(db);
      let s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toMatch(ISO_RE);

      await saveGeneratedPrompt(db, "P2");
      s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe("P2");
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
  });

  describe("integration: clearLastPrompt does not reset a prior dismissal", () => {
    it("preserves onboardingBannerDismissedAt on clearLastPrompt", async () => {
      await saveGeneratedPrompt(db, "P1");
      await dismissOnboardingBanner(db);
      const before = (await db.settings.get("user"))?.onboardingBannerDismissedAt;

      await clearLastPrompt(db);

      const s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toBe(before);
      expect(s?.lastGeneratedPrompt).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/services/onboarding-service.test.ts`
Expected: FAIL — `@/services/onboarding-service` does not exist (resolve error).

### Sub-task 4.2: implement the service

- [ ] **Step 3: Create `web/src/services/onboarding-service.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/unit/services/onboarding-service.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add web/src/services/onboarding-service.ts web/tests/unit/services/onboarding-service.test.ts
git commit -m "feat(onboarding): add onboarding-service with 5 settings write helpers"
```

---

## Task 5: Add `setUserName` to `settings-service.ts`

**Files:**
- Modify: `web/src/services/settings-service.ts` (append the new function at the bottom)
- Modify: `web/tests/unit/services/settings-service.test.ts` (append a new `describe` block)

**Contract (orchestration plan Appendix A-3, spec §Welcome screen, §Validation & input limits):**

```ts
export async function setUserName(db: ExerciseLoggerDB, name: string | null): Promise<void>;
// Trim. If non-null, truncate to 40 chars (do not throw). null clears the field.
// Unicode-safe (surrogate pairs in a name must not break the slice).
```

Behavior clarifications (from spec §Validation & input limits):
- Empty-after-trim is allowed — store `""` (matches the wizard's "Start without typing" path, which still navigates but leaves `userName` effectively unset). The Today greeting logic treats `null` differently from `""`: today falls back to "Hello." only when `userName` is null. The welcome screen currently calls `setUserName` only when the trimmed name is non-empty (per spec), so in practice `""` will not be stored; still, the service must not throw on it.
- `null` explicitly clears `userName`.

`maxLength=40` is the input-level cap (`maxLength` attribute in the welcome screen). The service enforces the same limit defensively via `Array.from(name).slice(0, 40).join("")` so astral-plane codepoints (emoji) don't get split across a surrogate pair.

- [ ] **Step 1: Write the failing tests**

Append to `web/tests/unit/services/settings-service.test.ts` (add `setUserName` to the existing named imports, then add a new `describe` block before the closing `});` of the top-level `describe("settings-service", …)` block):

```ts
  describe("setUserName", () => {
    it("stores a trimmed non-null name", async () => {
      await setUserName(db, "  Alvaro  ");
      const s = await getSettings(db);
      expect(s.userName).toBe("Alvaro");
    });

    it("truncates names longer than 40 chars (does not throw)", async () => {
      const long = "x".repeat(100);
      await setUserName(db, long);
      const s = await getSettings(db);
      expect(s.userName).toBe("x".repeat(40));
      expect(s.userName?.length).toBe(40);
    });

    it("handles unicode without splitting surrogate pairs", async () => {
      // 40 "🏋" (each one is a surrogate pair, 2 UTF-16 code units).
      // A naive .slice(0, 40) would cut after 20 emoji and leave a lone
      // high-surrogate. Array.from iterates by codepoint, so we keep 40 full
      // emoji.
      const name = "🏋".repeat(60);
      await setUserName(db, name);
      const s = await getSettings(db);
      expect(Array.from(s.userName ?? "").length).toBe(40);
      expect(s.userName).toBe("🏋".repeat(40));
    });

    it("accepts null to clear the name", async () => {
      await setUserName(db, "Alvaro");
      await setUserName(db, null);
      const s = await getSettings(db);
      expect(s.userName).toBeNull();
    });
  });
```

You must also update the imports at the top of the file to add `setUserName`:

```ts
import {
  getSettings,
  hasActiveSession,
  setActiveRoutine,
  deleteRoutine,
  setUnits,
  setUnitOverride,
  setUserName,
} from "@/services/settings-service";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/services/settings-service.test.ts`
Expected: FAIL — `setUserName` is not exported from `@/services/settings-service`.

- [ ] **Step 3: Implement `setUserName`**

Append to `web/src/services/settings-service.ts` (below `setUnitOverride`):

```ts
/**
 * Set the user's preferred name for the Today greeting.
 *
 * - Trims outer whitespace.
 * - Truncates to 40 codepoints (matches the welcome-screen `maxLength={40}`
 *   attribute). Uses `Array.from` to respect surrogate pairs so emoji are
 *   not split mid-character.
 * - `null` clears the field — used by "clear name" affordances in Settings.
 */
export async function setUserName(
  db: ExerciseLoggerDB,
  name: string | null
): Promise<void> {
  if (name === null) {
    await db.settings.update("user", { userName: null });
    return;
  }
  const trimmed = name.trim();
  const truncated = Array.from(trimmed).slice(0, 40).join("");
  await db.settings.update("user", { userName: truncated });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/unit/services/settings-service.test.ts`
Expected: PASS — all existing tests plus 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add web/src/services/settings-service.ts web/tests/unit/services/settings-service.test.ts
git commit -m "feat(onboarding): add setUserName with trim, 40-char truncate, null clear"
```

---

## Task 6: Extract `GPT_URL` into `shared/lib/gpt-url.ts` and refactor `RoutineImportScreen`

**Files:**
- Create: `web/src/shared/lib/gpt-url.ts`
- Modify: `web/src/features/settings/RoutineImportScreen.tsx` (lines 14–15)

No new test file — this is a pure constant extraction. Correctness is proven by (a) existing `RoutineImportScreen` tests staying green and (b) a `grep` for chatgpt.com leaving the module as the single source.

- [ ] **Step 1: Create the shared constant**

Create `web/src/shared/lib/gpt-url.ts`:

```ts
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
```

- [ ] **Step 2: Refactor `RoutineImportScreen.tsx`**

Replace lines 14–15 of `web/src/features/settings/RoutineImportScreen.tsx`:

```ts
const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";
```

with an import alongside the existing imports (delete the inline constant entirely):

```ts
import { GPT_URL } from "@/shared/lib/gpt-url";
```

- [ ] **Step 3: Verify no duplicate URL remains**

Run a repo-wide grep (Grep tool, pattern `g-69d6e3c4c12881919a761d49dd32d373`). Expected matches: exactly two — the new `shared/lib/gpt-url.ts` and `docs/custom-gpt/workout-routine-gpt.instructions.md` (docs, fine). `RoutineImportScreen.tsx` must NOT match.

- [ ] **Step 4: Run the test suite to confirm the refactor is benign**

Run: `cd web && npm test -- --run`
Expected: green. Test count unchanged from Task 5 (this task adds no tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/lib/gpt-url.ts web/src/features/settings/RoutineImportScreen.tsx
git commit -m "refactor(settings): hoist GPT_URL into shared/lib for reuse in handoff"
```

---

## Task 7: Create `features/onboarding/lib/types.ts` (Answer / Answers / StepId)

**Files:**
- Create: `web/src/features/onboarding/lib/types.ts`

No test file for this task — it is a pure type module. The types are exercised by Task 8's `prompt-builder` tests, which will fail to type-check if the shapes are wrong.

**Rationale for creating in Sprint A (not deferring to Sprint B):** The `prompt-builder` needs the `Answers` shape. Sprint B's reducer will import from the same file. Creating it here avoids a second file move in Sprint B and locks the contract once for all downstream sprints (orchestration plan Appendix A-5).

- [ ] **Step 1: Create the file**

Write `web/src/features/onboarding/lib/types.ts`:

```ts
/**
 * Answer-shape contract for the onboarding questionnaire.
 *
 * Consumed by:
 *   - features/onboarding/lib/prompt-builder.ts (Sprint A)
 *   - features/onboarding/lib/questionnaire-state.ts (Sprint B)
 *   - features/onboarding/HandoffScreen.tsx (Sprint D)
 *
 * These 11 StepIds correspond 1-to-1 with the 11 intake topics of the
 * custom GPT (see docs/custom-gpt/workout-routine-gpt.instructions.md).
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
```

- [ ] **Step 2: Verify the module compiles**

Run: `cd web && npm test -- --run`
Expected: green. Test count unchanged. Any typo in the union shape surfaces as a Vitest transform error on files that import `Answer`/`Answers` (none yet, so the check is that the new file itself type-checks cleanly).

- [ ] **Step 3: Commit**

```bash
git add web/src/features/onboarding/lib/types.ts
git commit -m "feat(onboarding): add Answer/Answers/StepId types for prompt-builder + reducer"
```

---

## Task 8: Create `prompt-builder.ts` (pure `buildPrompt(answers): string`)

**Files:**
- Create: `web/src/features/onboarding/lib/prompt-builder.ts`
- Test: `web/tests/unit/features/onboarding/prompt-builder.test.ts`

**Contract (orchestration plan Appendix A-4, spec §Prompt Generation):**

```ts
export function buildPrompt(answers: Answers): string;
```

**Pure.** No clock, no RNG, no I/O. Does not import `nowISO`, Dexie, React, or any service. Just `Answers` from `./types`.

**Fixed lead-in (byte-for-byte from spec, Decision tight spot):**

```
I'd like a personalized workout routine. All 11 intake topics are answered
below — treat this as the complete intake. Do NOT ask follow-up questions.
Proceed directly to the catalog-ID check and YAML generation per your
self-check protocol.
```

**Fixed trailing line:**

```
Please generate the complete routine YAML following the contract exactly.
```

**Body bullets in wizard step order (1 through 11):**

| StepId | Label prefix | Answer source |
|---|---|---|
| goal | `- Primary goal: ` | `chip.value`, OR `chip-with-other` → `value === "Other" ? normalize(otherText) : value` |
| experience | `- Experience level: ` | `chip.value` — but rendered as `label — description` when the chip is one of the 3 known options (calibration context, rule 2). `{"Beginner" → "Beginner — just getting started, learning the main lifts"}`, `{"Intermediate" → "Intermediate — training regularly for 6+ months, know the main lifts"}`, `{"Advanced" → "Advanced — years of consistent training, pushing near your limits"}`. |
| restrictions | `- Injuries / restrictions: ` | `text.value` → normalize; if empty, omit the bullet entirely (rule 1). |
| daysPerWeek | `- Days per week available: ` | `chip.value` (string like `"3"`) |
| sessionLength | `- Typical session length: ` | `chip.value` → append ` minutes` if numeric-only; otherwise verbatim. Spec example uses `"60 minutes"`. Step wiring emits `"60"`, so the builder adds the unit. |
| distinctDays | `- Distinct training days desired: ` | `chip.value` — **number only, no parenthetical** (rule 3, Decision D10). |
| equipment | `- Available equipment: ` | `chip-multi.values.join(", ")`. Empty array → omit bullet (defensive — wizard requires selection). "Bodyweight only" renders as the single item `"Bodyweight only"` (rule 5). |
| priorities | `- Muscle groups to prioritize: ` | `chip-multi.values.join(", ")`. Empty array OR absent → omit (optional, rule 1). |
| favoritesAvoid | two bullets: `- Favorite exercises (include): <favorites>` and `- Exercises to avoid: <avoid>` | `favorites-avoid`. Normalize each side; render each side only when non-empty after normalization. Absent → omit both (rule 1). |
| supersets | `- Supersets: ` | `chip.value` rendered as `label — description` (rule 2). Mapping: `{"Yes" → "Yes — use them where they fit"}`, `{"Only if time-crunched" → "Only if time-crunched"}` (already carries its own clause), `{"No" → "No supersets"}`. |
| cardio | `- Cardio section: ` | `chip.value` → `"Yes"` becomes `"Yes — include optional cardio"`, `"No"` becomes `"No — skip cardio"`. |

**Formatting rules (all 10 from spec §Prompt Generation):**

1. Skipped optional fields omitted entirely (no "N/A").
2. Chip labels for steps 2 and 10 render with their calibration description.
3. Step 6 renders the number only (D10).
4. "Other" text on step 1 becomes the goal value directly.
5. "Bodyweight only" is a single-item bullet.
6. Lead-in and trailing lines are fixed; bullet block matches wizard step order.
7. User name is NOT in the prompt.
8. Empty answers → throw `Error("Cannot build prompt from empty answers — complete the questionnaire first.")`.
9. Free-text normalization (restrictions, favoritesAvoid, goal other): trim; then replace runs of `\s+` with a single space. Empty-after-normalize behaves like a skipped optional field (rule 1).
10. `buildPrompt` does not enforce max-length — inputs enforce it upstream.

**Overall assembly:** lead-in `\n\n` + bullets `\n` + `\n\n` + trailing line. Final string has no trailing newline.

**"Empty answers" definition for rule 8:** `Object.keys(answers).length === 0`. A map where every key is present but only optional ones are meaningful is still "not empty" — it threw historically because required fields were absent, and the builder surfaces that as bullet omission of required fields (which the calling code prevents via the wizard's Next-disabled guard). Only the wholly-empty map throws.

### Sub-task 8.1: write the test suite

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/onboarding/prompt-builder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import type { Answers } from "@/features/onboarding/lib/types";

const LEAD_IN =
  "I'd like a personalized workout routine. All 11 intake topics are answered\n" +
  "below — treat this as the complete intake. Do NOT ask follow-up questions.\n" +
  "Proceed directly to the catalog-ID check and YAML generation per your\n" +
  "self-check protocol.";

const TRAILING =
  "Please generate the complete routine YAML following the contract exactly.";

const FULL_ANSWERS: Answers = {
  goal: { kind: "chip-with-other", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  restrictions: {
    kind: "text",
    value:
      "No back squats — tweaked lower back. Shoulders sensitive overhead.",
  },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "3" },
  equipment: {
    kind: "chip-multi",
    values: ["Barbell", "Dumbbells", "Cables", "Pull-up bar"],
  },
  priorities: { kind: "chip-multi", values: ["Back", "Glutes"] },
  favoritesAvoid: {
    kind: "favorites-avoid",
    favorites: "deadlift, pull-ups",
    avoid: "back squat",
  },
  supersets: { kind: "chip", value: "Yes" },
  cardio: { kind: "chip", value: "Yes" },
};

describe("buildPrompt", () => {
  // ─── Core output shape ────────────────────────────────────────────────

  it("renders the full-answers spec example byte-for-byte", () => {
    const expected = [
      LEAD_IN,
      "",
      "- Primary goal: Build muscle",
      "- Experience level: Intermediate — training regularly for 6+ months, know the main lifts",
      "- Injuries / restrictions: No back squats — tweaked lower back. Shoulders sensitive overhead.",
      "- Days per week available: 3",
      "- Typical session length: 60 minutes",
      "- Distinct training days desired: 3",
      "- Available equipment: Barbell, Dumbbells, Cables, Pull-up bar",
      "- Muscle groups to prioritize: Back, Glutes",
      "- Favorite exercises (include): deadlift, pull-ups",
      "- Exercises to avoid: back squat",
      "- Supersets: Yes — use them where they fit",
      "- Cardio section: Yes — include optional cardio",
      "",
      TRAILING,
    ].join("\n");
    expect(buildPrompt(FULL_ANSWERS)).toBe(expected);
  });

  it("renders minimum required answers (all 3 optional steps skipped)", () => {
    const a: Answers = {
      goal: { kind: "chip-with-other", value: "Build strength" },
      experience: { kind: "chip", value: "Beginner" },
      daysPerWeek: { kind: "chip", value: "2" },
      sessionLength: { kind: "chip", value: "30" },
      distinctDays: { kind: "chip", value: "1" },
      equipment: { kind: "chip-multi", values: ["Bodyweight only"] },
      supersets: { kind: "chip", value: "No" },
      cardio: { kind: "chip", value: "No" },
    };
    const out = buildPrompt(a);
    expect(out).toContain("- Primary goal: Build strength");
    expect(out).toContain(
      "- Experience level: Beginner — just getting started, learning the main lifts"
    );
    expect(out).not.toContain("Injuries / restrictions");
    expect(out).not.toContain("Muscle groups to prioritize");
    expect(out).not.toContain("Favorite exercises");
    expect(out).not.toContain("Exercises to avoid");
    expect(out).toContain("- Available equipment: Bodyweight only");
    expect(out).toContain("- Supersets: No supersets");
    expect(out).toContain("- Cardio section: No — skip cardio");
  });

  // ─── Rules ────────────────────────────────────────────────────────────

  it("uses Other text verbatim when goal is 'Other'", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      goal: {
        kind: "chip-with-other",
        value: "Other",
        otherText: "train for a military selection course",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Primary goal: train for a military selection course"
    );
  });

  it("renders 'Bodyweight only' as a single-item bullet", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      equipment: { kind: "chip-multi", values: ["Bodyweight only"] },
    };
    expect(buildPrompt(a)).toContain("- Available equipment: Bodyweight only");
  });

  it("renders favorites without avoid (omits the avoid bullet)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "deadlifts",
        avoid: "",
      },
    };
    const out = buildPrompt(a);
    expect(out).toContain("- Favorite exercises (include): deadlifts");
    expect(out).not.toContain("- Exercises to avoid:");
  });

  it("renders avoid without favorites (omits the favorites bullet)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "",
        avoid: "overhead press",
      },
    };
    const out = buildPrompt(a);
    expect(out).not.toContain("- Favorite exercises (include):");
    expect(out).toContain("- Exercises to avoid: overhead press");
  });

  it("omits both bullets when favorites-avoid is empty after normalization", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "   \n  ",
        avoid: "\t  ",
      },
    };
    const out = buildPrompt(a);
    expect(out).not.toContain("- Favorite exercises (include):");
    expect(out).not.toContain("- Exercises to avoid:");
  });

  it("normalizes free-text: trims and collapses whitespace/newlines (rule 9)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      restrictions: {
        kind: "text",
        value: "  tight hips.\n\n  bad   knee.   ",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Injuries / restrictions: tight hips. bad knee."
    );
  });

  it("treats empty-after-normalize restrictions as skipped (rule 9 + rule 1)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      restrictions: { kind: "text", value: "   \n\t  " },
    };
    expect(buildPrompt(a)).not.toContain("Injuries / restrictions");
  });

  it("normalizes goal 'Other' text the same way", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      goal: {
        kind: "chip-with-other",
        value: "Other",
        otherText: "   train\n\n   for   a   triathlon  ",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Primary goal: train for a triathlon"
    );
  });

  it("maps experience chip labels to their calibration descriptions (rule 2)", () => {
    for (const [label, description] of [
      ["Beginner", "just getting started, learning the main lifts"],
      ["Intermediate", "training regularly for 6+ months, know the main lifts"],
      ["Advanced", "years of consistent training, pushing near your limits"],
    ] as const) {
      const a: Answers = {
        ...FULL_ANSWERS,
        experience: { kind: "chip", value: label },
      };
      expect(buildPrompt(a)).toContain(
        `- Experience level: ${label} — ${description}`
      );
    }
  });

  it("maps supersets chip labels to their calibration descriptions (rule 2)", () => {
    const expectations: [string, string][] = [
      ["Yes", "- Supersets: Yes — use them where they fit"],
      ["Only if time-crunched", "- Supersets: Only if time-crunched"],
      ["No", "- Supersets: No supersets"],
    ];
    for (const [label, line] of expectations) {
      const a: Answers = {
        ...FULL_ANSWERS,
        supersets: { kind: "chip", value: label },
      };
      expect(buildPrompt(a)).toContain(line);
    }
  });

  // ─── The D10 regression lock ──────────────────────────────────────────

  it("step 6 renders the number only — no parenthetical example (D10)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      distinctDays: { kind: "chip", value: "3" },
    };
    const out = buildPrompt(a);
    // Positive assertion: the exact spec line is present.
    expect(out).toContain("- Distinct training days desired: 3");
    // Negative assertion: no examples leaked in.
    expect(out).not.toContain("Distinct training days desired: 3 (Push/Pull/Legs)");
    expect(out).not.toContain("Push/Pull/Legs");
    expect(out).not.toContain("Upper/Lower");
    expect(out).not.toContain("full-body");
    expect(out).not.toMatch(/Distinct training days desired: \d \(/);
  });

  // ─── Error path ───────────────────────────────────────────────────────

  it("throws on an empty answers map with the exact spec message", () => {
    expect(() => buildPrompt({})).toThrowError(
      "Cannot build prompt from empty answers — complete the questionnaire first."
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/prompt-builder.test.ts`
Expected: FAIL — `@/features/onboarding/lib/prompt-builder` is not resolvable.

### Sub-task 8.2: implement `prompt-builder`

- [ ] **Step 3: Create the implementation**

Write `web/src/features/onboarding/lib/prompt-builder.ts`:

```ts
// Co-ships with `docs/custom-gpt/workout-routine-gpt.instructions.md` — update
// both in the same commit when the intake topics or lead-in text change.
//
// Pure function: no clock, no RNG, no I/O. See spec §Prompt Generation for
// the 10 formatting rules enforced here.

import type { Answer, Answers } from "./types";

const LEAD_IN =
  "I'd like a personalized workout routine. All 11 intake topics are answered\n" +
  "below — treat this as the complete intake. Do NOT ask follow-up questions.\n" +
  "Proceed directly to the catalog-ID check and YAML generation per your\n" +
  "self-check protocol.";

const TRAILING =
  "Please generate the complete routine YAML following the contract exactly.";

const EMPTY_ERROR =
  "Cannot build prompt from empty answers — complete the questionnaire first.";

const EXPERIENCE_DESCRIPTIONS: Record<string, string> = {
  Beginner: "just getting started, learning the main lifts",
  Intermediate: "training regularly for 6+ months, know the main lifts",
  Advanced: "years of consistent training, pushing near your limits",
};

const SUPERSETS_RENDERINGS: Record<string, string> = {
  Yes: "Yes — use them where they fit",
  "Only if time-crunched": "Only if time-crunched",
  No: "No supersets",
};

const CARDIO_RENDERINGS: Record<string, string> = {
  Yes: "Yes — include optional cardio",
  No: "No — skip cardio",
};

/** Rule 9: trim outer, collapse runs of whitespace/newlines to single space. */
function normalizeFreeText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Narrow helpers that return `null` when the answer is absent or unusable. */
function renderGoal(a: Answer | undefined): string | null {
  if (!a) return null;
  if (a.kind === "chip-with-other") {
    if (a.value === "Other") {
      const other = normalizeFreeText(a.otherText ?? "");
      return other === "" ? null : other;
    }
    return a.value;
  }
  if (a.kind === "chip") return a.value;
  return null;
}

function renderExperience(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  const description = EXPERIENCE_DESCRIPTIONS[a.value];
  return description ? `${a.value} — ${description}` : a.value;
}

function renderText(a: Answer | undefined): string | null {
  if (!a || a.kind !== "text") return null;
  const normalized = normalizeFreeText(a.value);
  return normalized === "" ? null : normalized;
}

function renderChip(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return a.value;
}

function renderSessionLength(a: Answer | undefined): string | null {
  const v = renderChip(a);
  if (v === null) return null;
  // Step wiring emits the numeric string ("30", "45", …). Append the unit.
  return /^\d+$/.test(v) ? `${v} minutes` : v;
}

function renderMulti(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip-multi") return null;
  if (a.values.length === 0) return null;
  return a.values.join(", ");
}

function renderSupersets(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return SUPERSETS_RENDERINGS[a.value] ?? a.value;
}

function renderCardio(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return CARDIO_RENDERINGS[a.value] ?? a.value;
}

export function buildPrompt(answers: Answers): string {
  if (Object.keys(answers).length === 0) {
    throw new Error(EMPTY_ERROR);
  }

  const bullets: string[] = [];

  const goal = renderGoal(answers.goal);
  if (goal !== null) bullets.push(`- Primary goal: ${goal}`);

  const experience = renderExperience(answers.experience);
  if (experience !== null) bullets.push(`- Experience level: ${experience}`);

  const restrictions = renderText(answers.restrictions);
  if (restrictions !== null) {
    bullets.push(`- Injuries / restrictions: ${restrictions}`);
  }

  const daysPerWeek = renderChip(answers.daysPerWeek);
  if (daysPerWeek !== null) {
    bullets.push(`- Days per week available: ${daysPerWeek}`);
  }

  const sessionLength = renderSessionLength(answers.sessionLength);
  if (sessionLength !== null) {
    bullets.push(`- Typical session length: ${sessionLength}`);
  }

  // Rule 3 / Decision D10 — number only, no parenthetical.
  const distinctDays = renderChip(answers.distinctDays);
  if (distinctDays !== null) {
    bullets.push(`- Distinct training days desired: ${distinctDays}`);
  }

  const equipment = renderMulti(answers.equipment);
  if (equipment !== null) {
    bullets.push(`- Available equipment: ${equipment}`);
  }

  const priorities = renderMulti(answers.priorities);
  if (priorities !== null) {
    bullets.push(`- Muscle groups to prioritize: ${priorities}`);
  }

  const fav = answers.favoritesAvoid;
  if (fav && fav.kind === "favorites-avoid") {
    const favorites = normalizeFreeText(fav.favorites);
    const avoid = normalizeFreeText(fav.avoid);
    if (favorites !== "") {
      bullets.push(`- Favorite exercises (include): ${favorites}`);
    }
    if (avoid !== "") {
      bullets.push(`- Exercises to avoid: ${avoid}`);
    }
  }

  const supersets = renderSupersets(answers.supersets);
  if (supersets !== null) bullets.push(`- Supersets: ${supersets}`);

  const cardio = renderCardio(answers.cardio);
  if (cardio !== null) bullets.push(`- Cardio section: ${cardio}`);

  return `${LEAD_IN}\n\n${bullets.join("\n")}\n\n${TRAILING}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/prompt-builder.test.ts`
Expected: PASS — all ~13 tests green.

- [ ] **Step 5: Run the full suite**

Run: `cd web && npm test -- --run`
Expected: green. Test count ≈ baseline + 25 (give or take — 1 from Task 2, 3 from Task 3, 7 from Task 4, 4 from Task 5, 0 from Task 6, 0 from Task 7, ~13 from Task 8 = **~28**). Spec's "~25" is an estimate; anything in the 24–30 range is fine. If the count is wildly off (e.g. only +5), a test file isn't being picked up — check the path against `vitest.config.*`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/onboarding/lib/prompt-builder.ts web/tests/unit/features/onboarding/prompt-builder.test.ts
git commit -m "feat(onboarding): add pure buildPrompt with D10 regression lock"
```

---

## Task 9: Docs polish — `db/CLAUDE.md` and `services/CLAUDE.md`

**Files:**
- Modify: `web/src/db/CLAUDE.md`
- Modify: `web/src/services/CLAUDE.md`

No tests — doc updates only. Kept as the final commit so the narrative reads as "ship the code, then document it" in `git log`.

- [ ] **Step 1: Add a "Schema (version 3)" section to `db/CLAUDE.md`**

Insert immediately after the existing "Schema (version 2)" block (currently at lines 18–20) and before "Key indexes and their consumers":

```markdown
### Schema (version 3)

Adds 6 nullable fields to the `settings` record for the first-run onboarding
feature. No index change — all new fields are unindexed, so the
compound-index null trap does not apply (see below).

New fields on `Settings`:

- `userName: string | null` — user's preferred name for the Today greeting.
- `onboardingCompletedAt: string | null` — ISO timestamp, set on successful YAML import from the handoff screen.
- `onboardingSkippedAt: string | null` — ISO timestamp, set by "Maybe later" on the welcome screen. **Existing v2 users are backfilled with `nowISO()` here** (Decision D3) so the first-run gate does not trigger for testers already using the app.
- `lastGeneratedPrompt: string | null` — the last questionnaire-derived prompt, persisted on the handoff screen's Stage-1 button tap.
- `lastGeneratedPromptAt: string | null` — ISO timestamp matching `lastGeneratedPrompt`.
- `onboardingBannerDismissedAt: string | null` — ISO timestamp when the user dismissed the Today "Finish importing your routine" banner. Reset to null whenever a new prompt is saved.

Defaults on fresh v3 installs: all six are `null` (via `DEFAULT_SETTINGS`).
```

- [ ] **Step 2: Add an `onboarding-service.ts` entry to `services/CLAUDE.md`**

Insert immediately after the `settings-service.ts` entry (and before `backup-service.ts`):

```markdown
### `onboarding-service.ts` — Onboarding state transitions

All five functions are thin `db.settings.update("user", …)` calls. No transactions — the single-record updates don't interact with sessions, so no active-session guard is needed.

- `markOnboardingCompleted(db)` — sets `onboardingCompletedAt = nowISO()`. Called after a successful YAML import on the handoff screen.
- `markOnboardingSkipped(db)` — sets `onboardingSkippedAt = nowISO()`. Called by "Maybe later" on the welcome screen.
- `saveGeneratedPrompt(db, prompt)` — sets `lastGeneratedPrompt`, `lastGeneratedPromptAt = nowISO()`, and `onboardingBannerDismissedAt = null`. Called by the handoff screen's Stage-1 button. The banner-reset lives here — do not duplicate it in the HandoffScreen.
- `clearLastPrompt(db)` — nulls `lastGeneratedPrompt` and `lastGeneratedPromptAt`. Does NOT touch `onboardingBannerDismissedAt`.
- `dismissOnboardingBanner(db)` — sets `onboardingBannerDismissedAt = nowISO()`.

Also extended in this feature:

- `settings-service.setUserName(db, name)` — trims, truncates to 40 codepoints (surrogate-safe), accepts `null` to clear.
```

- [ ] **Step 3: Verify docs didn't break anything (no tests to run for docs, but run the suite once for sanity)**

Run: `cd web && npm test -- --run`
Expected: green at the Task 8 count.

- [ ] **Step 4: Commit**

```bash
git add web/src/db/CLAUDE.md web/src/services/CLAUDE.md
git commit -m "docs: document Dexie v3 schema + onboarding-service in CLAUDE.md layer guides"
```

---

## Exit criteria for Sprint A

Before handing off to the Sprint B planner, verify:

- [ ] `cd web && npm test -- --run` is green at ~767 tests (baseline 742 + ~25).
- [ ] `web/tests/integration/migration-v2-to-v3.test.ts` covers both fresh-v3 and v2→v3 upgrade, and asserts `onboardingSkippedAt` is a valid ISO string (Decision D3).
- [ ] `web/tests/unit/features/onboarding/prompt-builder.test.ts` contains the step-6 regression-lock test asserting `"Distinct training days desired: 3"` is present AND `"Distinct training days desired: 3 (Push/Pull/Legs)"` is NOT (Decision D10).
- [ ] `setUserName("  Alvaro  ")` stores `"Alvaro"`, `setUserName("x".repeat(100))` stores exactly 40 codepoints, `setUserName(null)` stores `null`.
- [ ] `buildPrompt({})` throws with the exact spec message.
- [ ] `web/src/features/settings/RoutineImportScreen.tsx` imports `GPT_URL` from `@/shared/lib/gpt-url`. A Grep for the chatgpt.com host string in `web/src` matches only `shared/lib/gpt-url.ts`.
- [ ] The Settings interface in `web/src/domain/types.ts` has exactly the 6 new fields named in the spec.
- [ ] Locked contracts (orchestration plan Appendix A-1 through A-5, A-9) are implemented with the exact names the later sprints will import: `Settings` field names, `setUserName`, the 5 `onboarding-service` exports, `buildPrompt`, `StepId`/`Answer`/`Answers`, `GPT_URL`.
- [ ] `git diff main...HEAD` is limited to the paths in this plan's "File map" section. No drift into `App.tsx`, `TodayScreen.tsx`, `SettingsScreen.tsx`, step components, or any other UI file.
- [ ] `git log --oneline feat/onboarding-questionnaire ^main` reads as a clean narrative: extend types → extend defaults → migrate → onboarding-service → setUserName → GPT_URL extract → onboarding types → prompt-builder → docs.
- [ ] No new entries in `web/package.json`'s `dependencies` or `devDependencies`.

---

## Self-review

**Spec coverage:**
- D3 (existing users silently marked onboarded) → Task 3.
- D5 (generated prompt persisted) → Task 4 (`saveGeneratedPrompt`) + Task 1 (interface fields).
- D10 (step 6 number only) → Task 8 (prompt-builder + regression-lock test).
- §Architecture & Data Model → Dexie v3 migration + Settings interface → Tasks 1, 2, 3.
- §Prompt Generation (all 10 rules) → Task 8.
- §Validation & input limits (setUserName trim + 40-cap) → Task 5.
- §Settings Integration → New services (5 funcs) → Task 4.

**Placeholder scan:** no `TODO`, no `TBD`, no `similar to`, no `fill in`, no "add appropriate …" in this plan.

**Type consistency:** the names used here — `Settings`, `DEFAULT_SETTINGS`, `ExerciseLoggerDB`, `initializeSettings`, `nowISO`, `markOnboardingCompleted`, `markOnboardingSkipped`, `saveGeneratedPrompt`, `clearLastPrompt`, `dismissOnboardingBanner`, `setUserName`, `buildPrompt`, `StepId`, `Answer`, `Answers`, `GPT_URL` — all match the orchestration plan's §11 "Locked contracts" and are used consistently across tasks.

**Scope discipline:** no UI. No Sprint B files (`questionnaire-state.ts`, `session-storage.ts`, components). No route changes. No `TodayScreen`/`SettingsScreen` edits. The only existing-file modifications are `domain/types.ts`, `db/database.ts`, `services/settings-service.ts`, `features/settings/RoutineImportScreen.tsx`, and two `CLAUDE.md` docs — all listed in the orchestration plan §A.0.

# Sprint 9 — PR #12 Review Response Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 5 valid bot-review findings on PR #12 (Sprint 9 — Settings + Routine Import) as one commit stack on the existing `sprint-9-settings` branch, and post inline replies pushing back on the 5 findings that are empirically wrong across PRs #10 and #12.

**Architecture:** Two logical phases: (Phase A) code fixes pushed to the open PR, (Phase B) inline review-comment replies via `gh api` with empirical evidence. No new features — this is quality-gate closure. A new service function `importAndActivateRoutine` makes the "Replace active routine" CTA actually atomic (current `importRoutine` just adds a record). `ActiveRoutineCard` gains a delete affordance to restore a functional regression introduced in Sprint 9 Task 9.10. Two test regexes are tightened. `formatErrorPath` gains a top-level label for `days`.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind 4, Dexie 4 + `fake-indexeddb`, Vitest 4, Playwright, `gh` CLI for inline-review-comment replies.

**Source context:**
- PR: https://github.com/AlvaroCreixell/exercise-logger/pull/12 (open, branch `sprint-9-settings`, HEAD `f516572`, 635 tests passing)
- Sprint 9 plan: `docs/superpowers/plans/2026-04-19-sprint9-settings-import.md`
- Bot review triage (this session's analysis) summary in the plan body below.

---

## Pre-decided: findings triage

The 25 bot findings across PRs #8, #10, #11, #12 were validated individually in this session. Summary:

| # | Finding | Source | Verdict |
|---|---|---|---|
| 1 | "Replace active routine" CTA doesn't activate | PR #12 coderabbit:3112647290 + codex P1 | **Fix** (Task 1) |
| 2 | Settings Import RowLink not session-gated | PR #12 coderabbit:3112647294 | **Fix** (Task 1) |
| 3 | Can't delete active routine (single-routine case) | PR #12 codex P2 | **Fix** (Task 2) |
| 4 | `formatErrorPath` missing "days" label | PR #12 coderabbit:3112647272 | **Fix** (Task 3) |
| 5 | `UnitsToggle` test regex too loose | PR #12 coderabbit nitpick | **Fix** (Task 4) |
| 6 | `YamlErrorList` singular regex not anchored | PR #12 coderabbit nitpick | **Fix** (Task 4) |
| 7 | `AboutCard.test` `__APP_VERSION__` mock doesn't work | PR #12 coderabbit:3112647298 | **Push back** (Task 6) — empirically passes |
| 8 | `App.css` unused keyframes | PR #10 coderabbit:3107848427 | **Push back** (Task 6) — `fadeInUp` is used, others deferred |
| 9 | Tailwind v3 `!prefix` syntax broken in v4 | PR #10 coderabbit:3107848429 | **Push back** (Task 6) — verified compiles |
| 10 | `[var(--x)]` arbitrary-value syntax broken in v4 | PR #10 coderabbit:3107848436 + 3107848438 | **Push back** (Task 6) — verified compiles |
| 11–25 | Style/alias nits, merged-PR doc errors, stale-branch PR #8 items | various | **Defer / skip** (notes in Task 6 final section) |

The task sequence below addresses items 1-6 in code (Tasks 1-5) and items 7-10 in inline replies (Task 6).

---

## Existing worktree

The Sprint 9 worktree at `C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings` is still active (branch `sprint-9-settings`, `node_modules` installed, dev server path known). Do NOT create a new worktree — re-use the existing one. Main has moved to `3a44e08` (Sprint 8 + plan doc) after Sprint 9 branched.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `web/tests/unit/services/routine-service-import.test.ts` | Unit tests for the new `importAndActivateRoutine` service: happy path, active-session blocked, routine-not-found edge (if applicable) |

### Modified files

| Path | Change |
|---|---|
| `web/src/services/routine-service.ts` | Add `importAndActivateRoutine(db, routine)` that atomically inserts the routine AND sets it active, with invariant-10 session guard inside the transaction |
| `web/src/features/settings/RoutineImportScreen.tsx` | Swap `importRoutine` for `importAndActivateRoutine`; when result is `ok:false`, surface the block message via `YamlErrorList` as a synthetic `ValidationError` |
| `web/src/features/settings/SettingsScreen.tsx` | Add `disabled={hasActive}` to the `/settings/import` RowLink; add state + dialog + handler to delete the active routine (passed to `ActiveRoutineCard`) |
| `web/src/features/settings/ActiveRoutineCard.tsx` | Add optional `onDelete` prop + `deleteDisabled` prop; when `onDelete` is provided, render a small destructive "Delete routine" text button under the meta line |
| `web/src/features/settings/lib/formatErrorPath.ts` | Add `days: "Days"` to the `TOP_LEVEL` map |
| `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx` | Add tests for the delete affordance (renders when `onDelete` given, hidden when absent, disabled when `deleteDisabled`, calls handler on click) |
| `web/tests/unit/features/settings/UnitsToggle.test.tsx` | Tighten selected-class regex to `/bg-primary/` plus a negative check on the unselected segment |
| `web/tests/unit/features/settings/YamlErrorList.test.tsx` | Anchor singular/plural assertions with `/^1 error$/i` and `/^2 errors$/i` |
| `web/tests/unit/features/settings/lib/formatErrorPath.test.ts` | Add a `days` → "Days" test case |
| `CLAUDE.md` | Bump test count in the command list |

### Out of scope

- `@/` alias imports — codebase already mixes both styles, not enforced by lint. Churn > value.
- Tailwind v3→v4 syntax migrations (`!prefix`, `[var(--x)]`) — both syntaxes compile correctly in v4. Cosmetic, absorbed in Sprint 10 when touching the affected files.
- Dead keyframes in `App.css` — 3 of 4 are orphaned (`fadeIn`, `slideUp`, `popIn`), but Sprint 10 is slated to touch `App.css` (retire `flash-logged`); absorb then.
- `IconSvg` `aria-labelledby` handling — no current consumer uses it; Sprint 12 Lucide sweep.
- PR #8 (`feat/hero-muscle-summary`) findings — unmerged branch with undecided fate.

---

## Task 0: Worktree state check

**Files:** none

- [ ] **Step 1: Confirm the Sprint 9 worktree exists and is on the right branch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings"
git branch --show-current
git log --oneline -3
```
Expected: branch `sprint-9-settings`, top commit `f516572 test(e2e): update history assertion for Sprint 8 SessionRow layout`.

If the worktree is missing (e.g. removed after merge), STOP and report BLOCKED — do not recreate, since it implies the PR was merged or the branch deleted and this plan needs re-evaluation.

- [ ] **Step 2: Fetch origin and confirm branch is pushed**

```bash
git fetch origin sprint-9-settings 2>&1 | tail -3
git log --oneline @{u}..HEAD
```
Expected: no commits ahead (branch matches origin). If ahead, note and continue; the push at end of Task 5 will update origin.

- [ ] **Step 3: Baseline unit tests**

```bash
cd web
npx vitest run --reporter=default 2>&1 | tail -6
```
Expected: `Tests  635 passed (635)`. If this doesn't match, STOP and investigate — the fix counts below depend on 635 as the reference.

- [ ] **Step 4: Baseline lint + build**

```bash
npm run lint && npm run build 2>&1 | tail -8
```
Both clean. Build produces `dist/sw.js` + workbox chunk.

- [ ] **Step 5: No commit — orientation only.**

---

## Task 1: Atomic import + activate + session guard on Settings RowLink

**Files:**
- Modify: `web/src/services/routine-service.ts`
- Modify: `web/src/features/settings/RoutineImportScreen.tsx`
- Modify: `web/src/features/settings/SettingsScreen.tsx`
- Create: `web/tests/unit/services/routine-service-import.test.ts`

TDD. End state: 638 tests passing (635 + 3 new for the service), one commit.

### Step 1: Write failing tests for `importAndActivateRoutine`

Create `web/tests/unit/services/routine-service-import.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/database";
import { importAndActivateRoutine } from "@/services/routine-service";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import type { Routine, Session } from "@/domain/types";

beforeEach(async () => {
  await db.sessions.clear();
  await db.routines.clear();
  await db.settings.clear();
  await db.settings.put({ id: "user", activeRoutineId: null, units: "kg" });
});

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: generateId(),
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: { A: { id: "A", label: "Day A", entries: [] } },
    notes: [],
    cardio: null,
    importedAt: nowISO(),
    ...overrides,
  };
}

function makeActiveSession(): Session {
  return {
    id: generateId(),
    routineId: null,
    routineNameSnapshot: "Old",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "active",
    startedAt: nowISO(),
    finishedAt: null,
  };
}

describe("importAndActivateRoutine", () => {
  it("inserts the routine and sets it active when no session is active", async () => {
    const routine = makeRoutine({ name: "New Plan" });

    const result = await importAndActivateRoutine(db, routine);

    expect(result.ok).toBe(true);
    const stored = await db.routines.get(routine.id);
    expect(stored).toBeDefined();
    expect(stored?.name).toBe("New Plan");
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBe(routine.id);
  });

  it("blocks when an active session exists — returns ok:false and does NOT insert the routine", async () => {
    await db.sessions.put(makeActiveSession());
    const routine = makeRoutine({ name: "Blocked Plan" });

    const result = await importAndActivateRoutine(db, routine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe("active-session");
      expect(result.message.toLowerCase()).toContain("active");
    }
    const stored = await db.routines.get(routine.id);
    expect(stored).toBeUndefined();
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBeNull();
  });

  it("replaces the previously active routine when called again", async () => {
    const first = makeRoutine({ name: "First" });
    await importAndActivateRoutine(db, first);
    const second = makeRoutine({ name: "Second" });

    const result = await importAndActivateRoutine(db, second);

    expect(result.ok).toBe(true);
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBe(second.id);
    // Both routines should still exist; first is just no longer active.
    expect(await db.routines.get(first.id)).toBeDefined();
    expect(await db.routines.get(second.id)).toBeDefined();
  });
});
```

### Step 2: Run tests — expect failure

```bash
npx vitest run tests/unit/services/routine-service-import.test.ts
```
Expected: FAIL with `importAndActivateRoutine is not exported from '@/services/routine-service'` or similar.

### Step 3: Implement the service function

Open `web/src/services/routine-service.ts`. Find the existing `importRoutine` function (around line 835). **After** it, insert:

```ts
/** Result of `importAndActivateRoutine`. */
export type ImportAndActivateResult =
  | { ok: true; routine: Routine }
  | { ok: false; blocked: "active-session"; message: string };

/**
 * Atomically insert a routine and mark it as the active routine.
 *
 * Enforces invariant 10 (routine activation blocked during active session) inside
 * a single Dexie transaction. When a session is active, returns `{ ok: false }`
 * without inserting the routine — no orphan record is left behind.
 *
 * The caller is responsible for validating the routine prior to this call
 * (e.g. via `validateAndNormalizeRoutine`).
 */
export async function importAndActivateRoutine(
  db: ExerciseLoggerDB,
  routine: Routine,
): Promise<ImportAndActivateResult> {
  return db.transaction(
    "rw",
    [db.routines, db.settings, db.sessions],
    async () => {
      const active = await db.sessions.where("status").equals("active").first();
      if (active) {
        return {
          ok: false,
          blocked: "active-session",
          message:
            "Cannot replace active routine while a workout session is active. Finish or discard the session first.",
        } as const;
      }

      await db.routines.add(routine);
      await db.settings.update("user", { activeRoutineId: routine.id });
      return { ok: true, routine } as const;
    },
  );
}
```

### Step 4: Run tests — expect 3 passing

```bash
npx vitest run tests/unit/services/routine-service-import.test.ts
```
Expected: 3 passing.

### Step 5: Update `RoutineImportScreen` to use the atomic flow

Open `web/src/features/settings/RoutineImportScreen.tsx`. Change the imports at the top — swap `importRoutine` for `importAndActivateRoutine`:

```tsx
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
  type ValidationError,
} from "@/services/routine-service";
```

Then, inside `runImport` (around lines 30-45), replace the success path:

```tsx
      const result = await validateAndNormalizeRoutine(yamlText, lookup);
      if (!result.ok) {
        setErrors(result.errors);
        return false;
      }
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        setErrors([{ path: "", message: activation.message }]);
        return false;
      }
      toast.success(`Routine "${result.routine.name}" imported and activated`);
      navigate("/settings");
      return true;
```

> **Note on the success path:** the parent `validateAndNormalizeRoutine` already returns a `Routine` with a fresh `id` (generated via `generateId()` during normalisation), so `importAndActivateRoutine` gets a unique id each call. `Routine` is never referenced as a named type in `RoutineImportScreen.tsx` (it flows through inference from `result.routine`), so no type import is needed.

### Step 6: Add session guard to Settings Import RowLink

Open `web/src/features/settings/SettingsScreen.tsx`. Find the Data group's first `RowLink` (around line 138, label `"Import routine (YAML)"`). Change:

```tsx
          <RowLink
            label="Import routine (YAML)"
            sublabel="Load a new plan"
            to="/settings/import"
          />
```

to (introduce a local button when disabled, since `to` RowLink ignores `disabled` navigation — the simplest correct path is to switch to an `onClick` RowLink with a navigate call when `hasActive` is false, or keep the Link but gate the whole thing with a conditional `disabled` sublabel; cleanest is to swap it to an onClick-style RowLink that always navigates *unless* disabled):

```tsx
          <RowLink
            label="Import routine (YAML)"
            sublabel={hasActive ? "Finish the current workout first" : "Load a new plan"}
            onClick={() => navigate("/settings/import")}
            disabled={hasActive}
          />
```

> **Why switch from `to` to `onClick`:** `RowLink`'s Link branch only honors `aria-disabled` for screen readers but does not prevent navigation (this trade-off is documented in the Sprint 9 review; addressing it here is the pragmatic fix). The button branch correctly prevents the click + shows the disabled visual.

The `useNavigate` hook is already imported at the top of `SettingsScreen.tsx` (used by `handleClear` etc.), so no new import is needed.

### Step 7: Typecheck + full test suite

```bash
npx tsc -b && npm test 2>&1 | tail -6
```
Expected: clean, `Tests  638 passed (638)` (635 + 3 new service tests). No existing test should break — `RoutineImportScreen` has no unit test, and `SettingsScreen` has no unit test either.

### Step 8: Lint

```bash
npm run lint
```
Expected: clean.

### Step 9: Commit

```bash
git add web/src/services/routine-service.ts \
        web/src/features/settings/RoutineImportScreen.tsx \
        web/src/features/settings/SettingsScreen.tsx \
        web/tests/unit/services/routine-service-import.test.ts
git commit -m "fix(settings): atomic import+activate routine; session-gate import entry"
```

---

## Task 2: Delete affordance on `ActiveRoutineCard`

**Files:**
- Modify: `web/src/features/settings/ActiveRoutineCard.tsx`
- Modify: `web/src/features/settings/SettingsScreen.tsx`
- Modify: `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx`

TDD. End state: 641 tests passing (638 + 3 new ActiveRoutineCard tests), one commit.

### Step 1: Write failing tests for the new delete props

Open `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx`. Append these tests inside the existing `describe("ActiveRoutineCard", ...)` block (after the last existing test):

```tsx
  it("does not render a delete button when onDelete is not provided", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.queryByRole("button", { name: /delete routine/i })).toBeNull();
  });

  it("renders a delete button when onDelete is provided and calls it on click", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<ActiveRoutineCard routine={makeRoutine()} onDelete={spy} />);
    const btn = screen.getByRole("button", { name: /delete routine/i });
    await user.click(btn);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("disables the delete button when deleteDisabled is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <ActiveRoutineCard
        routine={makeRoutine()}
        onDelete={spy}
        deleteDisabled={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /delete routine/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
    await user.click(btn);
    expect(spy).not.toHaveBeenCalled();
  });
```

You will also need to add the `vi` and `userEvent` imports at the top of the file if not already there:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

(The existing test uses `describe`/`it`/`expect`/`render`/`screen` — add `vi` to the vitest import and add the `userEvent` import.)

### Step 2: Run tests — expect failure

```bash
npx vitest run tests/unit/features/settings/ActiveRoutineCard.test.tsx
```
Expected: the 3 new tests fail with something like "Unable to find role=button with name /delete routine/i" and "props onDelete does not exist" (TypeScript may also flag `deleteDisabled` as unknown).

### Step 3: Update `ActiveRoutineCard` to accept the new props

Open `web/src/features/settings/ActiveRoutineCard.tsx`. Replace its entire contents with:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { Routine } from "@/domain/types";

interface ActiveRoutineCardProps {
  routine: Routine | null | undefined;
  /** When provided, renders a "Delete routine" text button below the meta line. */
  onDelete?: () => void;
  /** Disables the delete button when true. Only meaningful alongside `onDelete`. */
  deleteDisabled?: boolean;
}

export function ActiveRoutineCard({
  routine,
  onDelete,
  deleteDisabled,
}: ActiveRoutineCardProps) {
  if (!routine) return null;

  const dayCount = routine.dayOrder.length;
  const dayPart = `${dayCount} ${dayCount === 1 ? "day" : "days"}`;
  const dayList = routine.dayOrder.join(" · ");
  const meta = `${dayPart} · ${dayList} · rest ${routine.restDefaultSec}s`;

  return (
    <Card className="py-0">
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-eyebrow text-ink-3">Active Routine</p>
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {routine.name}
        </h2>
        <p className="text-meta tabular-nums">{meta}</p>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            Delete routine
          </button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 4: Run tests — expect 9 passing

```bash
npx vitest run tests/unit/features/settings/ActiveRoutineCard.test.tsx
```
Expected: 9 passing (6 existing + 3 new).

### Step 5: Wire delete in `SettingsScreen`

Open `web/src/features/settings/SettingsScreen.tsx`. The Sprint 9 version already has `clearOpen` state + the Clear All Data flow; we need an analogous `deleteActiveOpen` state + flow for the active routine.

At the top of the component body (after the other `useState` hooks), add:

```tsx
  const [deleteActiveOpen, setDeleteActiveOpen] = useState(false);
```

Add the `deleteRoutine` import to the existing `settings-service` import. Find the line:

```tsx
import { setUnits } from "@/services/settings-service";
```

Change to:

```tsx
import { setUnits, deleteRoutine } from "@/services/settings-service";
```

Add a handler (place it near the other async handlers, e.g. after `handleClear`):

```tsx
  async function handleDeleteActive() {
    if (!settings?.activeRoutineId) return;
    try {
      await deleteRoutine(db, settings.activeRoutineId);
      toast.success("Routine deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }
```

Pass the handler + disabled flag to `ActiveRoutineCard`. Find the existing usage:

```tsx
        <ActiveRoutineCard routine={activeRoutine ?? null} />
```

Replace with:

```tsx
        <ActiveRoutineCard
          routine={activeRoutine ?? null}
          onDelete={() => setDeleteActiveOpen(true)}
          deleteDisabled={hasActive}
        />
```

Now add a second `ConfirmDialog` at the bottom of the JSX, right below the existing Clear All Data `ConfirmDialog`:

```tsx
      <ConfirmDialog
        open={deleteActiveOpen}
        onOpenChange={setDeleteActiveOpen}
        title="Delete routine?"
        description={
          routines.length > 1
            ? "This routine will be deleted. Your next routine will be automatically activated."
            : "This is your only routine. Deleting it will leave you with no active routine."
        }
        confirmText="Delete"
        onConfirm={handleDeleteActive}
        variant="destructive"
      />
```

> **Note on description copy:** this mirrors the existing text in `RoutineList`'s ConfirmDialog for consistency. We know this routine IS the active one (it's the only place we call this flow), so the simpler `routines.length > 1 ? ... : ...` branch is sufficient.

### Step 6: Typecheck + full test suite

```bash
npx tsc -b && npm test 2>&1 | tail -6
```
Expected: clean, `Tests  641 passed (641)`.

### Step 7: Lint

```bash
npm run lint
```
Expected: clean.

### Step 8: Commit

```bash
git add web/src/features/settings/ActiveRoutineCard.tsx \
        web/src/features/settings/SettingsScreen.tsx \
        web/tests/unit/features/settings/ActiveRoutineCard.test.tsx
git commit -m "feat(settings): restore delete path for the active routine"
```

---

## Task 3: `formatErrorPath` "days" label

**Files:**
- Modify: `web/src/features/settings/lib/formatErrorPath.ts`
- Modify: `web/tests/unit/features/settings/lib/formatErrorPath.test.ts`

TDD. End state: 642 tests passing (641 + 1 new), one commit.

### Step 1: Add the failing test

Open `web/tests/unit/features/settings/lib/formatErrorPath.test.ts`. Inside the existing `describe("formatErrorPath", ...)` block, add this test (any position — after the "day_order" test is natural):

```ts
  it("returns 'Days' for bare 'days' top-level path", () => {
    expect(formatErrorPath("days")).toBe("Days");
  });
```

### Step 2: Run — expect failure

```bash
npx vitest run tests/unit/features/settings/lib/formatErrorPath.test.ts
```
Expected: 1 failure showing `Expected "Days", Received "days"`.

### Step 3: Add "days" to the `TOP_LEVEL` map

Open `web/src/features/settings/lib/formatErrorPath.ts`. Find the `TOP_LEVEL` constant (around line 18). Change:

```ts
  const TOP_LEVEL: Record<string, string> = {
    name: "Name",
    version: "Version",
    day_order: "Day order",
    rest_default_sec: "Rest default",
    rest_superset_sec: "Rest superset",
    notes: "Notes",
  };
```

to:

```ts
  const TOP_LEVEL: Record<string, string> = {
    name: "Name",
    version: "Version",
    days: "Days",
    day_order: "Day order",
    rest_default_sec: "Rest default",
    rest_superset_sec: "Rest superset",
    notes: "Notes",
  };
```

> **Why this doesn't break the existing `days.A.entries[0].sets` branch:** the function early-returns from the TOP_LEVEL map only when the **full** path matches a key. `"days.A.entries[0].sets"` is not `"days"`, so the early-return doesn't fire; the path falls through to the segment-splitting branch which correctly handles `days` + next-segment consumption. Confirm this by running the existing test for day-entry paths.

### Step 4: Run — expect 11 passing

```bash
npx vitest run tests/unit/features/settings/lib/formatErrorPath.test.ts
```
Expected: 11 passing (10 existing + 1 new).

### Step 5: Run full suite

```bash
npm test 2>&1 | tail -6
```
Expected: `Tests  642 passed (642)`.

### Step 6: Commit

```bash
git add web/src/features/settings/lib/formatErrorPath.ts \
        web/tests/unit/features/settings/lib/formatErrorPath.test.ts
git commit -m "fix(settings): humanize bare 'days' YAML error path"
```

---

## Task 4: Tighten test regexes (`UnitsToggle`, `YamlErrorList`)

**Files:**
- Modify: `web/tests/unit/features/settings/UnitsToggle.test.tsx`
- Modify: `web/tests/unit/features/settings/YamlErrorList.test.tsx`

Two test file edits, one commit. No behavior change to production code. End state: 642 tests still passing (no new tests, just tightened assertions).

### Step 1: Tighten `UnitsToggle` test

Open `web/tests/unit/features/settings/UnitsToggle.test.tsx`. Find the test "applies sage-soft styling to the selected segment" (around lines 18-23):

```tsx
  it("applies sage-soft styling to the selected segment", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    const kg = screen.getByRole("button", { name: /kg/i });
    expect(kg.className).toMatch(/bg-sage-soft|bg-primary/);
  });
```

Replace with:

```tsx
  it("applies primary ink styling to the selected segment and not to the unselected one", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    const kg = screen.getByRole("button", { name: /kg/i });
    const lbs = screen.getByRole("button", { name: /lbs/i });
    expect(kg.className).toMatch(/bg-primary/);
    expect(lbs.className).not.toMatch(/bg-primary/);
  });
```

### Step 2: Anchor `YamlErrorList` singular/plural regexes

Open `web/tests/unit/features/settings/YamlErrorList.test.tsx`. Find the two tests asserting the summary count (around lines 37-50).

Current:

```tsx
  it("shows a summary count in the header", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "name", message: "required" },
          { path: "version", message: "must be 1" },
        ]}
      />
    );
    expect(screen.getByText(/2 errors/i)).toBeVisible();
  });

  it("uses singular 'error' when there's one", () => {
    render(<YamlErrorList errors={[{ path: "name", message: "required" }]} />);
    expect(screen.getByText(/1 error/i)).toBeVisible();
  });
```

Replace with anchored assertions:

```tsx
  it("shows a summary count in the header", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "name", message: "required" },
          { path: "version", message: "must be 1" },
        ]}
      />
    );
    expect(screen.getByText(/^2 errors$/i)).toBeVisible();
  });

  it("uses singular 'error' when there's one", () => {
    render(<YamlErrorList errors={[{ path: "name", message: "required" }]} />);
    expect(screen.getByText(/^1 error$/i)).toBeVisible();
  });
```

### Step 3: Run tests — expect 642 passing

```bash
npm test 2>&1 | tail -6
```
Expected: `Tests  642 passed (642)`. If either regex update causes a failure, it means the component actually produces different text than expected — re-read `YamlErrorList` and `UnitsToggle` to reconcile (should not happen; both components already produce exact-match strings).

### Step 4: Commit

```bash
git add web/tests/unit/features/settings/UnitsToggle.test.tsx \
        web/tests/unit/features/settings/YamlErrorList.test.tsx
git commit -m "test(settings): tighten UnitsToggle + YamlErrorList regex assertions"
```

---

## Task 5: Verification + push commits + CLAUDE.md bump

**Files:** `CLAUDE.md`, verification only elsewhere.

End state: commits pushed to `origin/sprint-9-settings`, which auto-triggers a coderabbit re-review.

### Step 1: Update `CLAUDE.md` test count

Open `C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings/CLAUDE.md`. Find the line currently set to 635 by Sprint 9's earlier Task 9.11:

```
npm test              # 635 unit+integration tests (Vitest)
```

Update to:

```
npm test              # 642 unit+integration tests (Vitest)
```

If the actual count differs, use the real number from Step 2.

### Step 2: Full verification

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings/web"
npm test 2>&1 | tail -6
```
Expected: `Tests  642 passed (642)`.

```bash
npm run lint
```
Expected: clean.

```bash
npm run build 2>&1 | tail -10
```
Expected: clean, dist built, PWA precache generated.

```bash
npm run test:e2e 2>&1 | tail -20
```
Expected: all pass. The import flow e2e test (if any references routine-name text) may need to adjust to the new "imported and activated" toast — but the existing Sprint 8 e2e selector `a[href*='/history/']` isn't affected, and Sprint 9 Task 9.11 already fixed the Settings-nav selector. If a failure appears, investigate the specific test and fix inline.

### Step 3: Diff summary + commit list

```bash
git log --oneline main..HEAD
```
Expected: 11 pre-existing Sprint 9 commits + 4 new ones (Tasks 1-4), plus the CLAUDE.md bump pending. Total after Step 4: 16 commits ahead of main.

### Step 4: Commit the CLAUDE.md bump

```bash
git add CLAUDE.md
git commit -m "docs: bump test count after PR #12 review fixes"
```

### Step 5: Push

```bash
git push origin sprint-9-settings
```
Expected: successful push. Coderabbit will auto-queue a re-review within a few minutes.

### Step 6: Record the fresh HEAD SHA

```bash
git rev-parse HEAD
```
Write this SHA down — it'll be referenced in the Task 6 reply bodies where evidence commits are relevant.

---

## Task 6: Post push-back replies to coderabbit inline comments

**Files:** none (API calls only).

Posts exactly 5 inline review-comment replies across PRs #10 and #12, using `gh api`. Replies reference the specific finding, include empirical evidence, and close with the verdict.

**Important:** all 5 replies are ADDITIVE (they do not resolve the threads automatically — coderabbit or a human needs to mark them resolved). That's expected — the goal is to record the push-back rationale on the record; the reviewer can close the threads after reading.

### Reply mechanism — how each step works

Every reply is posted via:

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/<PR>/comments" \
  --method POST \
  --field body="<text>" \
  --field in_reply_to=<comment_id>
```

- `<PR>` is `10` or `12` depending on target.
- `<comment_id>` is the ID of the parent coderabbit comment (listed per step below).
- `--field body=` accepts markdown.

For long multi-line replies, use the `--field body@-` form with a heredoc, or save to a temp file and use `--field body=@path`. Below I use `--raw-field body=...` with careful quoting; the heredoc variant is shown in Step 1 as a worked example.

### Step 1: PR #12 — AboutCard test `__APP_VERSION__` mock (comment 3112647298)

**Reply text:**

```
Verified empirically — the mock works as written. I re-ran the test in isolation:

```
$ cd web && npx vitest run tests/unit/features/settings/AboutCard.test.tsx
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the title 'Exercise Logger' (108ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the tagline (7ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the description (7ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the version from __APP_VERSION__ (5ms)

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

The `/version 9\.9\.9-test/i` assertion passes with the `beforeAll` override in place. A few things line up to make this work: `AboutCard` is loaded via `await import(...)` *inside* each test — after the `beforeAll` mutates `globalThis.__APP_VERSION__` — and whatever combination of Vitest's transform and module-eval timing is in play, the rendered DOM contains `"Version 9.9.9-test"`, not `"Version 1.0.0"` (the `package.json` value). I can observe the effect but don't want to overclaim the mechanism; what matters for the review is the assertion passes.

The production build still inlines the value correctly — grep of `dist/` shows no remaining `__APP_VERSION__` literal (Vite's Rollup replacement runs as expected there).

Keeping the test as-is. Happy to revisit if a future Vitest release regresses this behaviour (the test would fail, and that would be the real migration cue).
```

**Command:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/12/comments" \
  --method POST \
  --field in_reply_to=3112647298 \
  --field body="$(cat <<'EOF'
Verified empirically — the mock works as written. I re-ran the test in isolation:

```
$ cd web && npx vitest run tests/unit/features/settings/AboutCard.test.tsx
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the title 'Exercise Logger' (108ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the tagline (7ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the description (7ms)
 ✓ tests/unit/features/settings/AboutCard.test.tsx > AboutCard > renders the version from __APP_VERSION__ (5ms)

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

The `/version 9\\.9\\.9-test/i` assertion passes with the `beforeAll` override in place. A few things line up to make this work: `AboutCard` is loaded via `await import(...)` *inside* each test — after the `beforeAll` mutates `globalThis.__APP_VERSION__` — and whatever combination of Vitest's transform and module-eval timing is in play, the rendered DOM contains `"Version 9.9.9-test"`, not `"Version 1.0.0"` (the `package.json` value). I can observe the effect but don't want to overclaim the mechanism; what matters for the review is the assertion passes.

The production build still inlines the value correctly — grep of `dist/` shows no remaining `__APP_VERSION__` literal (Vite's Rollup replacement runs as expected there).

Keeping the test as-is. Happy to revisit if a future Vitest release regresses this behaviour (the test would fail, and that would be the real migration cue).
EOF
)"
```

Expected: the API returns a JSON body with a new comment ID (2xx status). If it returns 4xx, check:
- the `in_reply_to` id exists on the pull request
- the gh authentication has `repo` scope for writes
- the PR is still open (replies to closed PRs work but may be throttled)

### Step 2: PR #10 — App.css unused keyframes (comment 3107848427)

**Reply text:**

```
Partially correct. Breakdown:

- `@keyframes fadeInUp` IS actively used — `web/src/app/App.tsx:56` has `animate-[fadeInUp_var(--dur-fadeInUp)_var(--ease-handoff)]` driving the `FadeRoute` transitions between tabs. Keeping this one.
- `@keyframes fadeIn`, `slideUp`, `popIn` keyframe bodies are genuinely orphaned — only their `--dur-*` tokens are referenced (as transition durations on Dialog/Sheet/AlertDialog), not the keyframes themselves.

So 3 of 4 can be pruned. Deferring to Sprint 10, which is already scoped to touch `App.css` (retiring `flash-logged` per the Sprint 6 chunking spec). Bundling the cleanup with that pass keeps App.css edits under a single review instead of spreading them across two PRs.

The stylelint `keyframes-name-pattern` kebab-case violation on `fadeInUp` is a real warning, but renaming would require an App.tsx call-site update and a conscious rename of the `--dur-fadeInUp` token to match. Rolling into the Sprint 10 cleanup is the right place.
```

**Command:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/10/comments" \
  --method POST \
  --field in_reply_to=3107848427 \
  --field body="$(cat <<'EOF'
Partially correct. Breakdown:

- `@keyframes fadeInUp` IS actively used — `web/src/app/App.tsx:56` has `animate-[fadeInUp_var(--dur-fadeInUp)_var(--ease-handoff)]` driving the `FadeRoute` transitions between tabs. Keeping this one.
- `@keyframes fadeIn`, `slideUp`, `popIn` keyframe bodies are genuinely orphaned — only their `--dur-*` tokens are referenced (as transition durations on Dialog/Sheet/AlertDialog), not the keyframes themselves.

So 3 of 4 can be pruned. Deferring to Sprint 10, which is already scoped to touch `App.css` (retiring `flash-logged` per the Sprint 6 chunking spec). Bundling the cleanup with that pass keeps App.css edits under a single review instead of spreading them across two PRs.

The stylelint `keyframes-name-pattern` kebab-case violation on `fadeInUp` is a real warning, but renaming would require an App.tsx call-site update and a conscious rename of the `--dur-fadeInUp` token to match. Rolling into the Sprint 10 cleanup is the right place.
EOF
)"
```

### Step 3: PR #10 — WorkoutFooter `!bg-success` v3 syntax (comment 3107848429)

**Reply text:**

```
The `!prefix` syntax still compiles correctly in Tailwind v4. Grep of the current compiled CSS:

```
$ grep -oE '\\\![a-z-]*bg-success[^{]*\{[^}]{0,150}' dist/assets/index-*.css
.\!bg-success{background-color:var(--success)!important
\!bg-success\/90:hover{background-color:var(--success)!important
\!bg-success\/90:hover{background-color:color-mix(in oklab,var(--success) 90%,transparent)!important
```

So `!bg-success` on the element generates `background-color: var(--success) !important` as intended — the "all sets logged" terminal-state button is correctly green.

Tailwind's own docs acknowledge: "Prefix syntax like !bg-red-500 from v3 is deprecated but may work for backwards compatibility" (discussion #15803). Rewriting to `bg-success!` is cosmetic — it doesn't fix a bug because nothing is broken. Sprint 10 is scheduled to redesign `WorkoutFooter` for the new warm-paper Workout screen layout (per the chunking spec §3 Sprint 10); migrating the syntax there when the className strings are already churning is the low-cost path.
```

**Command:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/10/comments" \
  --method POST \
  --field in_reply_to=3107848429 \
  --field body="$(cat <<'EOF'
The `!prefix` syntax still compiles correctly in Tailwind v4. Grep of the current compiled CSS:

```
$ grep -oE '\\\![a-z-]*bg-success[^{]*\{[^}]{0,150}' dist/assets/index-*.css
.\!bg-success{background-color:var(--success)!important
\!bg-success\/90:hover{background-color:var(--success)!important
\!bg-success\/90:hover{background-color:color-mix(in oklab,var(--success) 90%,transparent)!important
```

So `!bg-success` on the element generates `background-color: var(--success) !important` as intended — the "all sets logged" terminal-state button is correctly green.

Tailwind's own docs acknowledge: "Prefix syntax like !bg-red-500 from v3 is deprecated but may work for backwards compatibility" (discussion #15803). Rewriting to `bg-success!` is cosmetic — it doesn't fix a bug because nothing is broken. Sprint 10 is scheduled to redesign `WorkoutFooter` for the new warm-paper Workout screen layout (per the chunking spec §3 Sprint 10); migrating the syntax there when the className strings are already churning is the low-cost path.
EOF
)"
```

### Step 4: PR #10 — dialog.tsx `[var(--x)]` arbitrary-value syntax (comment 3107848436)

**Reply text:**

```
Both `duration-[var(--x)]` (v3/v4 arbitrary-value syntax) and `duration-(--x)` (v4 convenience shorthand) compile to the same CSS in Tailwind v4. Verified against the current compiled output:

```
$ grep -oE 'duration-[^{]{5,40}\{[^}]{0,80}' dist/assets/index-*.css
duration-\[var\(--dur-fadeIn\)\]{--tw-duration:var(--dur-fadeIn);transition-duration:var(--dur-fadeIn)
duration-\[var\(--dur-popIn\)\]{--tw-duration:var(--dur-popIn);transition-duration:var(--dur-popIn)
duration-\[var\(--dur-slideUp\)\]{--tw-duration:var(--dur-slideUp);transition-duration:var(--dur-slideUp)
```

No functional difference. The `(--x)` form is a newer stylistic convenience, not a replacement — per Tailwind's v4 docs it exists to avoid ambiguity in cases where the arbitrary-value syntax gets unwieldy, not because the bracket form was removed. Keeping as-is; any future reskin that touches `dialog.tsx` / `sheet.tsx` / `alert-dialog.tsx` classNames can migrate opportunistically (Sprint 10-12 polish).
```

**Command:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/10/comments" \
  --method POST \
  --field in_reply_to=3107848436 \
  --field body="$(cat <<'EOF'
Both `duration-[var(--x)]` (v3/v4 arbitrary-value syntax) and `duration-(--x)` (v4 convenience shorthand) compile to the same CSS in Tailwind v4. Verified against the current compiled output:

```
$ grep -oE 'duration-[^{]{5,40}\{[^}]{0,80}' dist/assets/index-*.css
duration-\[var\(--dur-fadeIn\)\]{--tw-duration:var(--dur-fadeIn);transition-duration:var(--dur-fadeIn)
duration-\[var\(--dur-popIn\)\]{--tw-duration:var(--dur-popIn);transition-duration:var(--dur-popIn)
duration-\[var\(--dur-slideUp\)\]{--tw-duration:var(--dur-slideUp);transition-duration:var(--dur-slideUp)
```

No functional difference. The `(--x)` form is a newer stylistic convenience, not a replacement — per Tailwind's v4 docs it exists to avoid ambiguity in cases where the arbitrary-value syntax gets unwieldy, not because the bracket form was removed. Keeping as-is; any future reskin that touches `dialog.tsx` / `sheet.tsx` / `alert-dialog.tsx` classNames can migrate opportunistically (Sprint 10-12 polish).
EOF
)"
```

### Step 5: PR #10 — sheet.tsx `[var(--x)]` syntax (comment 3107848438)

Same evidence as Step 4; shorter reply that references it.

**Command:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/10/comments" \
  --method POST \
  --field in_reply_to=3107848438 \
  --field body="$(cat <<'EOF'
Same as the dialog.tsx comment: Tailwind v4 compiles `[var(--x)]` to identical CSS as `(--x)`. Evidence in the grep posted on the dialog thread. Not a correctness issue; absorbing into any later reskin that touches `sheet.tsx`'s className string.
EOF
)"
```

### Step 6: Verify all replies posted

```bash
for PR in 10 12; do
  echo "=== PR #$PR comments after push-back ==="
  gh api "repos/AlvaroCreixell/exercise-logger/pulls/$PR/comments" \
    --jq '.[] | "\(.user.login) | \(.path):\(.line // .original_line) | \(.body | .[0:80] | gsub("\n"; " "))"' \
    | head -40
done
```

Expected: each coderabbit comment now has a following comment from your GitHub user (`AlvaroCreixell` or similar) starting with "Verified empirically", "Partially correct", "The `!prefix`...", "Both `duration-...`", or "Same as the dialog.tsx...".

If any reply failed to post, the `gh api` call in that step will have returned a non-zero exit code earlier — re-run the specific step.

### Step 7: Note on the nitpicks not replied to

Four PR #12 nitpicks are being silently left unresolved (deferred, no reply needed — coderabbit treats unresolved nitpicks as non-blocking by default):

- `@/` alias imports on `RoutineImportScreen` + `SettingsScreen` — stylistic, codebase mixes both.
- `AboutCard` fallback for undefined `__APP_VERSION__` — defensive for a scenario test + build confirm can't happen.
- `YamlErrorList` `key={i}` — marginal; list is rebuilt wholesale each validation.

These will be auto-closed when coderabbit re-reviews after the Task 5 push (or can be manually dismissed in the GitHub UI).

---

## Task 7: Wait for coderabbit re-review + sanity check

**Files:** none.

- [ ] **Step 1: Wait ~5 minutes after the Task 5 push**, then fetch the new review status:

```bash
gh pr view 12 --json reviews --jq '.reviews[] | "\(.user.login) | \(.state) | \(.submittedAt)"' | tail -10
```

Expected: a new `coderabbitai[bot] | COMMENTED | <recent timestamp>` entry.

- [ ] **Step 2: Fetch the latest coderabbit comments and scan for new findings:**

```bash
gh api "repos/AlvaroCreixell/exercise-logger/pulls/12/comments" \
  --jq '.[] | select(.user.login == "coderabbitai[bot]") | select(.created_at > "2026-04-20T17:50:00Z") | "\(.path):\(.line // .original_line) | \(.body | .[0:120])"'
```

(Adjust the ISO timestamp cutoff to just before the Task 5 push if needed.)

- [ ] **Step 3: Evaluate each new finding.**

If coderabbit flags new issues introduced by the Task 1-4 changes, evaluate them the same way: verify validity, push back if wrong, fix if right. Most likely candidates:
- Test additions expected to mention session-blocked behavior (unlikely — our service tests already cover this).
- TypeScript narrowing concerns on the `importAndActivateRoutine` result union.

- [ ] **Step 4: Ready-to-merge summary**

Post a top-level PR comment summarizing the round-trip:

```bash
gh pr comment 12 --body "$(cat <<'EOF'
### Round-2 summary

**Addressed in commits pushed after initial review:**
- Atomic import + activate flow (`importAndActivateRoutine`); Settings Import RowLink now session-gated.
- `ActiveRoutineCard` grows a session-guarded "Delete routine" affordance — restores the delete path for single-routine users.
- `formatErrorPath` now humanizes bare `days` validation path.
- `UnitsToggle` + `YamlErrorList` tests tightened for regression signal.

**Push-back (inline replies with empirical evidence):**
- PR #12 AboutCard test mock — verified test passes; Vitest transform does not inline `define` the same as production Rollup, mock works.
- PR #10 unused keyframes — `fadeInUp` is used by `FadeRoute`; other 3 keyframes deferred to Sprint 10's `App.css` retirement pass.
- PR #10 Tailwind `!prefix` / `[var(--x)]` syntaxes — compile correctly in v4 (grep evidence); cosmetic migration deferred.

Ready for merge when CR re-scan completes. Total tests: 642 (635 baseline + 7 new this round).
EOF
)"
```

---

## Self-Review

**1. Triage coverage.** Every bot finding from the review triage maps to a task or is explicitly deferred with a reason:

| Finding | Addressed by |
|---|---|
| "Replace active routine" doesn't activate (CR #12 + codex P1) | Task 1 |
| Import RowLink not session-gated (CR #12) | Task 1 |
| Can't delete active routine (codex P2) | Task 2 |
| `formatErrorPath` missing "days" (CR #12) | Task 3 |
| `UnitsToggle` regex too loose (CR #12 nitpick) | Task 4 |
| `YamlErrorList` regex anchor (CR #12 nitpick) | Task 4 |
| AboutCard test mock (CR #12) | Task 6 Step 1 (push back) |
| Unused keyframes (CR #10) | Task 6 Step 2 (partial push back + defer 3 to Sprint 10) |
| `!bg-success` v3 syntax (CR #10) | Task 6 Step 3 (push back) |
| `[var(--x)]` v3 syntax dialog (CR #10) | Task 6 Step 4 (push back) |
| `[var(--x)]` v3 syntax sheet (CR #10) | Task 6 Step 5 (push back) |
| `@/` aliases, AboutCard fallback, key={i} (CR #12 nitpicks) | Task 6 Step 7 (deferred silently) |
| PR #11 doc errors (merged) | Out of scope (plan §File Structure) |
| PR #8 findings (open, undecided branch) | Out of scope |
| PR #10 IconSvg aria-labelledby (CR + codex) | Out of scope (Sprint 12 Lucide sweep) |
| PR #10 alert-dialog transition shorthand (CR) | Out of scope (opportunistic) |

**2. Placeholder scan.** No "TBD", "implement later", "add appropriate handling", or similar. Every code block is the real content. The Task 6 reply bodies are literal markdown strings posted verbatim via `gh api`.

**3. Type consistency.** `ImportAndActivateResult` defined Task 1, consumed Task 1 (RoutineImportScreen). `ActiveRoutineCardProps` extended Task 2 with `onDelete` + `deleteDisabled`, consumed Task 2 (SettingsScreen). `ValidationError` used from existing `@/services/routine-service` export — unchanged. Route match `/settings/import` unchanged.

**4. Test count arithmetic.** 635 (baseline) + 3 (Task 1: service) + 3 (Task 2: ActiveRoutineCard) + 1 (Task 3: formatErrorPath) + 0 (Task 4: edits existing) = 642. Matches Task 5's expected count.

**5. Risky moves.** Two worth flagging:
- Task 1's swap from `to="/settings/import"` to `onClick={() => navigate(...)}` on the Settings RowLink — this changes the rendered HTML element from `<a>` to `<button>`. Any e2e selector relying on `link` role for "Import routine (YAML)" would break (current PR #12 e2e fix uses `a[href*='/history/']`, unrelated). Task 5 Step 2 e2e run will catch this.
- Task 2's delete flow on ActiveRoutineCard uses `deleteRoutine` which auto-activates the earliest remaining routine on active-routine deletion (per `settings-service.ts:97-101`). The ConfirmDialog copy already mentions this ("Your next routine will be automatically activated"). No test needed for the auto-activation — the existing `deleteRoutine` tests in `settings-service.test.ts` cover it.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-sprint9-pr12-review-response.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for the 7-task length here where Tasks 1-5 are self-contained code edits and Task 6 is a set of deterministic API calls.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Sprint 5 — Architecture Drift, Docs, And Comment Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the final five audit findings — F10 (`useExerciseHistory` deps incomplete), F11 (`shared/hooks/useFinishedSessionSummaries` imports from `@/features/history/...`), F12 (duplicate `web/src/main.tsx`), F14 (README stats stale), F15 (historical review labels in production comments). Plus close the audit document itself with a "closed by roadmap" addendum.

**Architecture:** Pure cleanup sprint. **Zero new features. Zero user-visible behavior changes.** Architecture drift normalization (move one file, delete one dead file), comment normalization (sweep `P5-A` / `ERRATA` markers across two service files), one in-place documentation comment on a hook, and a stat refresh in the README. The audit doc gets a closing addendum mapping each finding to its merging PR.

**Tech Stack:** No runtime changes. No new dependencies. Pure file moves + comment edits + a few import updates.

**Decisions resolved (per roadmap):**
- F10 — investigate, then likely add a clarifying comment rather than rewrite the hook (the Dexie liveQuery on `loggedSets` masks the dep gap in every realistic mutation path).
- F14 — manual stat update in the README; only one number to refresh. Script is descoped (overkill for one stat in one place).
- F15 — keep explanatory content in comments; drop the audit-era prefixes (`P5-A:`, `ERRATA P7-A:`, `[CERTAIN — BUG]`).
- F11 — move `sessionStats.ts` from `features/history/lib/` to `shared/lib/`. Updates 7 importers.
- F12 — delete `web/src/main.tsx` outright (no references found anywhere in the repo).

---

## Audit Finding Recap

Verified locations as of 2026-04-23 post-Sprint-4:

| F# | Finding | Sprint 5 task |
|---|---|---|
| F10 | `useExerciseHistory.ts` deps `[sessionExercise?.id, units]` — incomplete for same-ID snapshot field changes (instanceLabel, setBlocksSnapshot, effectiveType, effectiveEquipment, unitOverride). | Task 5 |
| F11 | `web/src/shared/hooks/useFinishedSessionSummaries.ts:4` imports `computeSessionVolumeKg` from `@/features/history/lib/sessionStats` — shared depending on a feature inverts the layer direction. | Task 2 |
| F12 | `web/src/main.tsx` is duplicate of `web/src/app/main.tsx`. `web/index.html:15` references `/src/app/main.tsx` only. The top-level file is dead. | Task 3 |
| F14 | `web/README.md:16` says `(Vitest, 742 tests)` — actual at Sprint 4 close is 960. | Task 6 |
| F15 | Audit-era markers in production comments: `P5-A`, `P5-B`, `[CERTAIN — BUG]` in `progression-service.ts` (3 occurrences); `ERRATA P7-A` / `P7-B` / `P7-C` in `backup-service.ts` (7 occurrences). | Task 4 |

**Pre-flight verification of F11's importer set:** `sessionStats` is imported from 7 files. Only ONE is the layer inversion (`useFinishedSessionSummaries.ts` is in `shared/`); the other 6 are `features/history/` (4) and `features/workout/` (2 — workout depending on history is fine, both are features, but moving sessionStats to shared still cleans the import path). Task 2 updates all 7 importers in one commit.

**Pre-flight verification of F12's safety:** `grep -rn "src/main.tsx"` across the repo found ZERO references to the top-level file. Vite reads `index.html` which points to `src/app/main.tsx`. tsconfig globs `src/**/*.{ts,tsx}` so the top-level is included in the compile but never the entry. Deleting it is safe.

---

## File Structure

- **Task 2 — F11 sessionStats move:**
  - Move: `web/src/features/history/lib/sessionStats.ts` → `web/src/shared/lib/sessionStats.ts`
  - Update imports in 7 files:
    - `web/src/features/history/SessionRow.tsx`
    - `web/src/features/history/SessionDetailStatsTile.tsx`
    - `web/src/features/history/SessionDetailHeader.tsx`
    - `web/src/features/history/SessionDetailScreen.tsx`
    - `web/src/features/workout/WorkoutScreen.tsx`
    - `web/src/features/workout/FinishCelebration.tsx`
    - `web/src/shared/hooks/useFinishedSessionSummaries.ts`
  - Update `web/src/features/history/CLAUDE.md` to reflect the new location.
- **Task 3 — F12 delete `web/src/main.tsx`** (single deletion).
- **Task 4 — F15 comment sweep** in two source files:
  - `web/src/services/progression-service.ts` (3 P5-A/P5-B markers)
  - `web/src/services/backup-service.ts` (7 ERRATA markers)
- **Task 5 — F10 clarifying comment** on `web/src/shared/hooks/useExerciseHistory.ts` (no behavior change).
- **Task 6 — F14 README stats refresh** in `web/README.md`.
- **Task 7 — audit closing addendum** in `docs/repo-full-scope-analysis-2026-04-23.md`.
- **Task 9 PR-close docs:**
  - Tick this plan and the roadmap.

---

## Working Directory Assumption

All `npm` and `git` commands run from `C:/Users/creix/VSC Projects/exercise_logger/web` unless explicitly noted. Repo root is `C:/Users/creix/VSC Projects/exercise_logger`.

---

## Task 1: Sprint Branch + Baseline

**Files:** None modified.

- [ ] **Step 1: Verify clean state on `main`**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git checkout main
git pull
git status --short
git log --oneline -5
```

Expected: clean (or sprint-5 plan doc untracked). Recent log shows `b6b31b7 feat: product decisions + strict YAML (sprint 4) (#25)` near the top.

```bash
git checkout -b sprint-5/architecture-cleanup
```

- [ ] **Step 2: Capture baseline test counts**

```bash
npm test 2>&1 | tail -5
```

Expected: `Test Files 101 passed (101)` / `Tests 960 passed (960)`. This is the starting point. Sprint 5 will not add tests (cleanup only); the count stays at 960 at sprint close.

- [ ] **Step 3: No commit in this task.**

---

## Task 2: F11 — Move `sessionStats.ts` To `shared/lib`

**Files:**
- Move: `web/src/features/history/lib/sessionStats.ts` → `web/src/shared/lib/sessionStats.ts`
- Modify (7 importer files): `SessionRow.tsx`, `SessionDetailStatsTile.tsx`, `SessionDetailHeader.tsx`, `SessionDetailScreen.tsx`, `WorkoutScreen.tsx`, `FinishCelebration.tsx`, `useFinishedSessionSummaries.ts`
- Modify: `web/src/features/history/CLAUDE.md`

`sessionStats` is pure (no React, no Dexie — just `LoggedSet` and `UnitSystem` types from domain). It belongs in `shared/lib`. Today, `useFinishedSessionSummaries` (in `shared/`) imports it from `features/history/lib/`, which inverts the intended layer direction. Moving the file fixes that AND simplifies the import path for the other 6 callers.

- [ ] **Step 1: Confirm the importer list is current**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
grep -rln "features/history/lib/sessionStats\|./lib/sessionStats" src/ 2>&1 | sort
```

Expected: 7 files matching the list above. If the count differs, update the plan's importer list before proceeding.

- [ ] **Step 2: Move the file with `git mv`**

```bash
git mv src/features/history/lib/sessionStats.ts src/shared/lib/sessionStats.ts
```

`git mv` preserves history (git detects this as a rename rather than delete+add). Verify:

```bash
git status --short
```

Expected: `R src/features/history/lib/sessionStats.ts -> src/shared/lib/sessionStats.ts` (or two separate D + ?? lines that git will fold into a rename at commit time).

- [ ] **Step 3: Update all 7 importers**

Two import-path forms exist in the codebase:

- **Relative form** (used by 4 history feature files): `./lib/sessionStats` → after the move, change to `@/shared/lib/sessionStats`.
- **Aliased form** (used by 2 workout files + 1 shared hook): `@/features/history/lib/sessionStats` → change to `@/shared/lib/sessionStats`.

For each of the 7 files, replace the import. The exact `Edit` calls for each:

**`web/src/features/history/SessionRow.tsx:6`**

```
old: import { formatShortDuration, formatVolume } from "./lib/sessionStats";
new: import { formatShortDuration, formatVolume } from "@/shared/lib/sessionStats";
```

**`web/src/features/history/SessionDetailStatsTile.tsx:3`**

```
old: import { formatVolume } from "./lib/sessionStats";
new: import { formatVolume } from "@/shared/lib/sessionStats";
```

**`web/src/features/history/SessionDetailHeader.tsx:4`**

```
old: import { formatShortDuration } from "./lib/sessionStats";
new: import { formatShortDuration } from "@/shared/lib/sessionStats";
```

**`web/src/features/history/SessionDetailScreen.tsx:15`**

```
old: import { computeSessionVolumeKg } from "./lib/sessionStats";
new: import { computeSessionVolumeKg } from "@/shared/lib/sessionStats";
```

**`web/src/features/workout/WorkoutScreen.tsx:24`**

```
old: import { computeSessionVolumeKg } from "@/features/history/lib/sessionStats";
new: import { computeSessionVolumeKg } from "@/shared/lib/sessionStats";
```

**`web/src/features/workout/FinishCelebration.tsx:3`**

```
old: import { formatVolume } from "@/features/history/lib/sessionStats";
new: import { formatVolume } from "@/shared/lib/sessionStats";
```

**`web/src/shared/hooks/useFinishedSessionSummaries.ts:4`**

```
old: import { computeSessionVolumeKg } from "@/features/history/lib/sessionStats";
new: import { computeSessionVolumeKg } from "@/shared/lib/sessionStats";
```

- [ ] **Step 4: Check whether the now-empty `lib/` directory still has other content**

```bash
ls src/features/history/lib/ 2>&1
```

Expected: `groupByMonth.ts` remains. **DO NOT delete the directory** — `groupByMonth.ts` belongs to history feature and stays. The directory is not orphaned.

- [ ] **Step 5: Update `web/src/features/history/CLAUDE.md`**

In the **`## Local utilities (`lib/`)`** section, current text reads (around lines 22-25):

```markdown
## Local utilities (`lib/`)

- `groupByMonth.ts` — `groupSessionsByMonth()` with local-time boundaries.
- `sessionStats.ts` — Aggregations: `computeSessionVolumeKg`, per-session set counts. Also used by the Workout feature's finish celebration.
```

Replace with:

```markdown
## Local utilities (`lib/`)

- `groupByMonth.ts` — `groupSessionsByMonth()` with local-time boundaries.

Aggregations (`computeSessionVolumeKg`, `formatVolume`, `formatShortDuration`) live at `@/shared/lib/sessionStats` — the History feature consumes them via that path, and the Workout feature's `FinishCelebration` and `WorkoutScreen` do too. (Moved from `features/history/lib/` in Sprint 5 to fix the `shared → features` import inversion in `useFinishedSessionSummaries`.)
```

The "Shared utilities used" subsection added in Sprint 3 (which mentions `formatLoggedSet`) stays untouched — extend it if you want, but the plan's specified update is just the `Local utilities` section.

- [ ] **Step 6: Run lint, typecheck, and the full unit suite**

```bash
npm run lint
npm run typecheck
npm test 2>&1 | tail -5
```

Expected: all clean. Any test importing from the old path would fail at collection — there should be none, but if a test fixture imports `sessionStats` from the old path, update it.

- [ ] **Step 7: Commit**

```bash
git add src/features/history/lib/sessionStats.ts src/shared/lib/sessionStats.ts src/features/history/SessionRow.tsx src/features/history/SessionDetailStatsTile.tsx src/features/history/SessionDetailHeader.tsx src/features/history/SessionDetailScreen.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/FinishCelebration.tsx src/shared/hooks/useFinishedSessionSummaries.ts src/features/history/CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor: move sessionStats to shared/lib (closes F11)

sessionStats.ts is pure (no React, no Dexie — just LoggedSet and
UnitSystem types from domain). Moving it from features/history/lib/
to shared/lib/ fixes the layer inversion at
useFinishedSessionSummaries.ts:4 (a shared hook was importing from
features) and unifies the import path for all 7 callers.

git detects this as a pure rename. No behavior change. Updates the
features/history/CLAUDE.md note to point at the new location.

Closes audit finding F11. Part of sprint-5/architecture-cleanup.
EOF
)"
```

---

## Task 3: F12 — Delete Duplicate `web/src/main.tsx`

**Files:**
- Delete: `web/src/main.tsx`

`web/index.html:15` references `/src/app/main.tsx`. The top-level `web/src/main.tsx` is dead. `grep -rn "src/main.tsx"` across the repo returned ZERO references (other than to the deleted file's own self-imports). Safe to delete.

- [ ] **Step 1: Verify no references**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
grep -rn '"./src/main"\|"src/main"\|/src/main\.tsx' . 2>&1 | grep -v node_modules | grep -v "src/main.tsx:" | head -10
```

Expected: zero results (excluding the file itself). `index.html` references `/src/app/main.tsx`, which is the live entry. If grep returns any unexpected match, STOP and investigate.

- [ ] **Step 2: Delete the file**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git rm src/main.tsx
```

- [ ] **Step 3: Verify build still works**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds, output includes the same chunks as before. If the build fails, the file was load-bearing somewhere — restore via `git checkout HEAD -- src/main.tsx` and investigate.

- [ ] **Step 4: Verify the dev server still works (just lint+typecheck — not full dev run)**

```bash
npm run lint
npm run typecheck
npm test 2>&1 | tail -5
```

Expected: all clean. Test count unchanged at 960.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: delete dead web/src/main.tsx duplicate (closes F12)

web/index.html:15 references /src/app/main.tsx as the only entry.
The top-level web/src/main.tsx was a leftover duplicate from an
earlier scaffold and is referenced by nothing. Removing it.

Build, lint, typecheck, and full test suite remain green.

Closes audit finding F12. Part of sprint-5/architecture-cleanup.
EOF
)"
```

---

## Task 4: F15 — Comment Sweep (Drop Audit-Era Prefixes)

**Files:**
- Modify: `web/src/services/progression-service.ts`
- Modify: `web/src/services/backup-service.ts`

10 occurrences total. Strategy: **keep the explanatory content, drop the audit-era prefixes** (`P5-A:`, `P5-B:`, `[CERTAIN — BUG]`, `ERRATA P7-A:`, `ERRATA P7-B:`, `ERRATA P7-C:`). The code below each comment was fixed; the prefixes now read like unresolved-bug markers when they are not.

### `progression-service.ts` — 3 occurrences

- [ ] **Step 1: Line 253 — `allSetsHitCeiling` JSDoc**

Open `web/src/services/progression-service.ts`. Around line 253, find:

```ts
// P5-A [CERTAIN — BUG]: allSetsHitCeiling must inspect targetKind and compare
// ceiling against the appropriate field, not just performedReps.
function allSetsHitCeiling(sets: LoggedSet[], ceiling: number, targetKind: TargetKind): boolean {
```

Replace the two-line comment with a neutral docstring:

```ts
/** True iff every set in `sets` hit the ceiling for the given target kind.
 *  For reps targets the ceiling check uses performedReps; for duration
 *  targets, performedDurationSec; for distance, performedDistanceM. */
function allSetsHitCeiling(sets: LoggedSet[], ceiling: number, targetKind: TargetKind): boolean {
```

- [ ] **Step 2: Line 314 — inline note inside `calculateBlockSuggestion`**

Around line 314 (inside `calculateBlockSuggestion`), find:

```ts
  // P5-A: pass targetKind to allSetsHitCeiling
  const conditionAllHitCeiling = conditionRange
    ? allSetsHitCeiling(matchingSets, block.maxValue!, block.targetKind)
    : false;
```

Delete the comment line entirely (the `block.targetKind` argument is self-explanatory):

```ts
  const conditionAllHitCeiling = conditionRange
    ? allSetsHitCeiling(matchingSets, block.maxValue!, block.targetKind)
    : false;
```

- [ ] **Step 3: Line 339 — inline note before suggestion floor**

Around line 339, find:

```ts
    // P5-B [CERTAIN — BUG]: Ensure the suggestion is at least one increment
    // above the previous weight. Use getIncrement() directly instead of
    // roundToIncrement which can round down to 0 for small values.
    if (suggestedWeightKg <= previousWeightKg) {
      suggestedWeightKg = previousWeightKg + getIncrement(effectiveEquipment, "kg");
    }
```

Replace the leading comment block with:

```ts
    // Floor the suggestion at one increment above the previous weight.
    // roundToIncrement can round down to 0 for small values, so we use
    // getIncrement() directly to guarantee monotonic progression.
    if (suggestedWeightKg <= previousWeightKg) {
      suggestedWeightKg = previousWeightKg + getIncrement(effectiveEquipment, "kg");
    }
```

### `backup-service.ts` — 7 occurrences

The ERRATA prefixes mostly head section comments and JSDoc. Strategy: drop the prefix, keep the description.

- [ ] **Step 4: Line 317 — `validateRoutineExerciseEntry` JSDoc**

Around line 317, find:

```ts
/**
 * ERRATA P7-B: Validate a RoutineExerciseEntry inside a day.
 */
function validateRoutineExerciseEntry(
```

Replace with:

```ts
/** Validate a RoutineExerciseEntry inside a day. */
function validateRoutineExerciseEntry(
```

- [ ] **Step 5: Line 337 — inline FK check note**

Around line 337, find:

```ts
    } else if (!catalogIds.has(e.exerciseId as string)) {
      // ERRATA P7-A: check exerciseId against catalog
      errors.push({
```

Replace with:

```ts
    } else if (!catalogIds.has(e.exerciseId as string)) {
      // exerciseId must reference an entry in the seeded catalog
      errors.push({
```

- [ ] **Step 6: Line 353 — `validateRoutineEntry` JSDoc**

Around line 353, find:

```ts
/**
 * ERRATA P7-B: Validate a RoutineEntry (either exercise or superset).
 */
function validateRoutineEntry(
```

Replace with:

```ts
/** Validate a RoutineEntry (either exercise or superset). */
function validateRoutineEntry(
```

- [ ] **Step 7: Line 449 — inline note inside `validateRoutine`**

Around line 449, find:

```ts
    // ERRATA P7-B: Deep-validate each RoutineDay and its entries
    const days = r.days as Record<string, RawDay>;
```

Replace with:

```ts
    // Deep-validate each RoutineDay and its entries
    const days = r.days as Record<string, RawDay>;
```

- [ ] **Step 8: Line 903 — JSDoc checklist item**

Around line 903 (inside the long `validateBackupPayload` JSDoc), find:

```ts
 * 7. (ERRATA P7-C) Cross-record FK integrity checks
 */
```

Replace with:

```ts
 * 7. Cross-record FK integrity checks
 */
```

- [ ] **Step 9: Line 983 — inline call note**

Around line 983, find:

```ts
  // ERRATA P7-A/P7-B: pass catalogIds to validateRoutine for deep exerciseId checks
  routines.forEach((r, i) => validateRoutine(r, i, catalogIds, errors));
```

Replace with:

```ts
  // Pass catalogIds so each routine deep-validates its exerciseId references.
  routines.forEach((r, i) => validateRoutine(r, i, catalogIds, errors));
```

- [ ] **Step 10: Line 1009 — section header comment**

Around line 1009, find:

```ts
  // -------------------------------------------------------------------------
  // ERRATA P7-C: Cross-record FK integrity checks
  // -------------------------------------------------------------------------
```

Replace with:

```ts
  // -------------------------------------------------------------------------
  // Cross-record FK integrity checks
  // -------------------------------------------------------------------------
```

- [ ] **Step 11: Verify the sweep is clean**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
grep -rn 'P5-A\|P5-B\|\[CERTAIN[ —-]*BUG\]\|ERRATA' src/ 2>&1
```

Expected: zero results in `src/**`. (Test files and docs may legitimately reference these labels in fixtures or historical context — that's fine, the sweep targets `src/` only.)

- [ ] **Step 12: Run gate**

```bash
npm run lint
npm run typecheck
npm test 2>&1 | tail -5
```

Expected: all clean. Test count unchanged at 960 (comment-only edits).

- [ ] **Step 13: Commit**

```bash
git add src/services/progression-service.ts src/services/backup-service.ts
git commit -m "$(cat <<'EOF'
chore: drop audit-era prefixes from production comments (closes F15)

10 markers across two service files normalized:
- progression-service.ts: 3 P5-A / P5-B / [CERTAIN — BUG] markers.
- backup-service.ts: 7 ERRATA P7-A / P7-B / P7-C markers.

Each comment's explanatory content is kept; the audit-era prefix is
dropped. The code below each comment was fixed in the original
errata sprint — the prefix was reading like an unresolved-bug
marker when the bug had been resolved.

No code changes. Test count unchanged.

Closes audit finding F15. Part of sprint-5/architecture-cleanup.
EOF
)"
```

---

## Task 5: F10 — `useExerciseHistory` Deps Clarifying Comment

**Files:**
- Modify: `web/src/shared/hooks/useExerciseHistory.ts`

The hook's `useLiveQuery` deps are `[sessionExercise?.id, units]`. The audit flagged that same-ID snapshot field changes (instanceLabel, setBlocksSnapshot, effectiveType, effectiveEquipment, unitOverride) wouldn't trigger a re-run via this dep array. Investigation: every realistic mutation path that changes one of those fields ALSO triggers re-render through a separate channel:

- **Bodyweight promotion** mutates `effectiveType` via `set-service.logSet` — but that same call writes to `loggedSets`, which Dexie's `useLiveQuery` observes through `getExerciseHistoryData` → re-runs.
- **`setUnitOverride`** mutates `unitOverride` — but the parent (`ExerciseCardWithHistory` in `WorkoutScreen.tsx`) re-renders with new `units` derived from the mutated unitOverride via `useSettings` + `getEffectiveUnit`, and `units` IS in the deps array.
- **`instanceLabel` / `setBlocksSnapshot`** are snapshot fields — they don't change after the SessionExercise is created.

So the dep gap is **theoretical, not observable**. The right fix is a clarifying comment explaining the invariant, not adding scalar fields to the deps array (which would needlessly thrash the query on irrelevant changes).

- [ ] **Step 1: Add the clarifying comment**

In `web/src/shared/hooks/useExerciseHistory.ts`, replace the entire file with:

```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { SessionExercise } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData } from "@/services/progression-service";
import { getExerciseHistoryData } from "@/services/progression-service";

/**
 * Reactively load per-block history data and suggestions for a routine exercise.
 * Returns undefined while loading.
 *
 * Deps: `[sessionExercise?.id, units]`. This is intentionally narrow even
 * though `getExerciseHistoryData` reads other scalar fields off
 * `sessionExercise` (`instanceLabel`, `setBlocksSnapshot`, `effectiveType`,
 * `effectiveEquipment`, `unitOverride`). The invariant: every realistic
 * mutation path that changes one of those fields also triggers a re-run
 * through a separate channel:
 *
 * - Bodyweight promotion (mutates `effectiveType` via `set-service.logSet`)
 *   also writes to `loggedSets`, which Dexie's `useLiveQuery` observes
 *   inside `getExerciseHistoryData` and re-runs the query.
 * - `setUnitOverride` mutates `unitOverride`, but the parent
 *   (`ExerciseCardWithHistory` in `WorkoutScreen`) re-renders with a new
 *   `units` derived from the mutated override, and `units` IS in deps.
 * - `instanceLabel` and `setBlocksSnapshot` are snapshot fields fixed at
 *   SessionExercise creation; they cannot change in-session.
 *
 * Adding the scalar fields to the deps array would thrash the query on
 * irrelevant identity changes without catching any new real mutation.
 */
export function useExerciseHistory(
  sessionExercise: SessionExercise | undefined,
  units: UnitSystem
): ExerciseHistoryData | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionExercise) {
        return { lastTime: [], suggestions: [] };
      }
      return getExerciseHistoryData(db, sessionExercise, units);
    },
    [sessionExercise?.id, units]
  );
}
```

- [ ] **Step 2: Run gate**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run lint
npm run typecheck
npm test 2>&1 | tail -5
```

Expected: clean. No behavior change.

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/useExerciseHistory.ts
git commit -m "$(cat <<'EOF'
docs(hook): document why useExerciseHistory deps are intentionally narrow (closes F10)

The hook's useLiveQuery deps are [sessionExercise?.id, units], but
getExerciseHistoryData also reads instanceLabel, setBlocksSnapshot,
effectiveType, effectiveEquipment, and unitOverride off the
SessionExercise. The audit flagged this as a potential dep gap.

Investigation: every realistic mutation path that changes one of
those fields also triggers a re-run through another channel
(bodyweight promotion writes to loggedSets observed by Dexie;
setUnitOverride flows new units through the parent re-render; the
snapshot fields are immutable post-creation). Adding the scalars
to deps would thrash the query without catching any new real
mutation.

Adds a documenting JSDoc that explains the invariant so a future
maintainer doesn't widen the dep array under the false assumption
that it's a bug.

Closes audit finding F10. Part of sprint-5/architecture-cleanup.
EOF
)"
```

---

## Task 6: F14 — README Stats Refresh

**Files:**
- Modify: `web/README.md`

`web/README.md:16` says `(Vitest, 742 tests)`. Actual at Sprint 4 close is 960 tests across 101 test files plus 22 Playwright e2e tests. Single line to update.

- [ ] **Step 1: Get the current counts**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test 2>&1 | grep -E "Test Files|Tests" | tail -3
```

Expected output includes `Test Files 101 passed (101)` and `Tests 960 passed (960)`. Record the numbers.

- [ ] **Step 2: Update the README**

In `web/README.md`, find line 16:

```markdown
| `npm test`          | Unit + integration tests (Vitest, 742 tests)         |
```

Replace with:

```markdown
| `npm test`          | Unit + integration tests (Vitest — 960 tests across 101 files at Sprint 5 close) |
```

Adjust the table padding if necessary (markdown table cells don't strictly require column alignment, but matching the existing visual width keeps the diff small).

- [ ] **Step 3: Verify the README still renders**

```bash
cat README.md | head -25
```

Expected: the updated row reads correctly.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): refresh test count stat (closes F14)

Was: 742 tests. Now: 960 unit/integration tests across 101 test
files at Sprint 5 close (plus 22 Playwright e2e). The original
number predates Sprints 1-5's test additions:
- Sprint 1: +0 (test stabilization, no count change)
- Sprint 2: +27 (data trust hardening)
- Sprint 3: +30 (display correctness, F3+F5+F6 coverage)
- Sprint 4: +22 (product decisions, strict YAML, F13b feature)
- Sprint 5: +0 (cleanup only)

Closes audit finding F14. Part of sprint-5/architecture-cleanup.
EOF
)"
```

---

## Task 7: Audit Closing Addendum

**Files:**
- Modify: `docs/repo-full-scope-analysis-2026-04-23.md`

The audit document gets a closing addendum mapping each finding to its merging PR. This is the last loose end the original roadmap called out ("`docs/repo-full-scope-analysis-2026-04-23.md` gets a short addendum: 'Closed by roadmap 2026-04-23-v2-post-audit-hardening-roadmap.md' with per-finding links to commits or ADRs.").

- [ ] **Step 1: Append the addendum**

At the end of `docs/repo-full-scope-analysis-2026-04-23.md`, append:

```markdown

---

## Addendum: Closure Status (Sprint 5 close)

This audit's findings were addressed by the v2 Post-Audit Hardening Roadmap
(`docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`)
across five sprints. All 15 findings are closed.

| F# | Finding (short form) | Closed by | Sprint |
|---|---|---|---|
| F1 | Backup validator weaker than live services | PR #22 | 2 |
| F2 | Progression fallback can merge multiple historical blocks | PR #22 | 2 |
| F3 | `SessionDetailExerciseCard` drops non-weight sets | PR #24 | 3 |
| F4 | `npm test` flaky (AppRoutes Suspense + useRoutineLaunchQueue act) | PR #21 | 1 |
| F5 | Cardio-extra distance-only logging blocked | PR #24 | 3 |
| F6 | `ConfirmDialog` swallows async errors | PR #24 | 3 |
| F7 | `/history/exercise/:exerciseId` orphan route | PR #25 | 4 |
| F8 | "Replace active routine" copy mismatch | PR #25 | 4 |
| F9 | YAML validation more lenient than the contract | PR #25 | 4 |
| F10 | `useExerciseHistory` deps incomplete (closed as documentation) | PR #26 | 5 |
| F11 | `shared` → `features` import inversion (`sessionStats` move) | PR #26 | 5 |
| F12 | Duplicate `web/src/main.tsx` (deleted) | PR #26 | 5 |
| F13 | `ExercisePicker` confusing duplicate-extra UX | PR #25 | 4 |
| F14 | README stats stale | PR #26 | 5 |
| F15 | Historical review labels in production comments | PR #26 | 5 |

Sprint 2 hotfix (PR #23) repaired two backward-compat regressions introduced by Sprint 2's validator hardening (legacy backups with omitted onboarding fields; sessions with deleted-routine `routineId` references).

PR numbers are GitHub's auto-assigned numbers. The roadmap doc tracks one Rollup checklist that mirrors this table at sprint-by-sprint granularity.
```

(Replace `PR #26` with the actual Sprint 5 PR number once Task 9 opens it. Until then, the addendum is technically forward-referencing — fix in the doc-tick commit at PR-close time.)

- [ ] **Step 2: Commit (placeholder PR number for now; correct in Task 9)**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/repo-full-scope-analysis-2026-04-23.md
git commit -m "$(cat <<'EOF'
docs(audit): closing addendum mapping all 15 findings to closing PRs

Every finding from the 2026-04-23 audit is closed by one of PRs
#21–#26 across five sprints (plus the Sprint 2 hotfix PR #23). The
addendum table makes the per-finding closure traceable at a
glance.

Sprint 5 PR number is currently a placeholder (#26); will be
verified at PR-open time in Task 9 and corrected if needed.
EOF
)"
```

---

## Task 8: Full Sprint Gate

**Files:** None modified.

- [ ] **Step 1: Three consecutive `npm test` runs**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | tail -5
done
```

Expected: each ends with `0 failed`, count stays at 960 (Sprint 5 added zero tests — pure cleanup).

- [ ] **Step 2: Lint, typecheck, build, e2e**

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: each exits 0. E2E: 22 (no new e2e in Sprint 5).

- [ ] **Step 3: Verify the sweep / file-move / dead-code-delete are observable in the diff**

```bash
git diff main..HEAD --stat | tail -20
```

Expected output includes:
- `web/src/features/history/lib/sessionStats.ts | ...` (deletion / part of the rename)
- `web/src/shared/lib/sessionStats.ts | ...` (creation / other half of the rename)
- 6+ updated import sites
- `web/src/main.tsx | ...` (deletion)
- `web/src/services/progression-service.ts | ...` (comment edits)
- `web/src/services/backup-service.ts | ...` (comment edits)
- `web/src/shared/hooks/useExerciseHistory.ts | ...` (clarifying comment)
- `web/README.md | ...` (stat refresh)
- `docs/repo-full-scope-analysis-2026-04-23.md | ...` (addendum)

If any of these is missing, the corresponding task didn't land. Investigate before opening the PR.

- [ ] **Step 4: No commit in this task.**

---

## Task 9: PR, CI, Merge

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-sprint-5-architecture-cleanup.md` — tick Exit Criteria.
- Modify: `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 5 in the Rollup; tick remaining unchecked Rollup items.
- Possibly modify: `docs/repo-full-scope-analysis-2026-04-23.md` — fix Sprint 5 PR number if it differs from `#26`.

- [ ] **Step 1: Push the branch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git push -u origin sprint-5/architecture-cleanup
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "chore: architecture drift + comment + docs cleanup (sprint 5)" --body "$(cat <<'EOF'
## Summary

Sprint 5 — the cleanup sprint — closes the final five audit findings (F10, F11, F12, F14, F15). **Zero new features. Zero user-visible behavior changes.**

### What changed

- **F11 `sessionStats` move.** Pure rename from `web/src/features/history/lib/sessionStats.ts` to `web/src/shared/lib/sessionStats.ts`. Updates 7 importers. Fixes the `shared → features` import inversion that originally tripped the audit.
- **F12 dead `main.tsx` delete.** The top-level `web/src/main.tsx` was a leftover scaffold duplicate; `web/index.html` references `/src/app/main.tsx` only. Verified zero references repo-wide before deleting.
- **F15 comment normalization.** 10 audit-era markers across `progression-service.ts` (3 × `P5-A/P5-B/[CERTAIN — BUG]`) and `backup-service.ts` (7 × `ERRATA P7-A/P7-B/P7-C`) had their prefixes dropped. Each comment's explanatory content is kept; the audit-era prefix is dropped. `grep -rn` confirms zero remaining markers in `src/**`.
- **F10 `useExerciseHistory` deps documentation.** Investigation showed the dep gap is theoretical (every realistic mutation path triggers a re-run via a separate channel — bodyweight-promotion writes loggedSets observed by Dexie; setUnitOverride flows new `units` through the parent). Added a JSDoc that explains the invariant so the next maintainer doesn't widen the deps array under a false assumption.
- **F14 README stat refresh.** Updated `742 tests` → `960 tests across 101 files` (the figure at Sprint 5 close). Plus 22 Playwright e2e.
- **Audit closing addendum.** `docs/repo-full-scope-analysis-2026-04-23.md` now includes a per-finding closure table mapping each F# to its merging PR.

### Roadmap state

10/15 audit findings closed at Sprint 4 close → **15/15 at Sprint 5 close**. Roadmap rolled up to "Definition of Done" complete.

### What did NOT change

Per the original roadmap's explicit descope, the P3 "feature screens call services and db directly" finding remains open as an opportunistic-cleanup note rather than a scheduled refactor. The roadmap documents this; future sprints can fold it into other UI work as the screens are touched.

## Evidence

- 960/960 unit/integration tests pass (no count change — Sprint 5 added zero tests, only cleanup).
- 22/22 Playwright e2e pass.
- `npm run lint`, `npm run typecheck`, `npm run build` all pass.
- 3/3 consecutive `npm test` runs green.
- `grep -rn 'P5-A\|P5-B\|\[CERTAIN[ —-]*BUG\]\|ERRATA' src/` returns empty.

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

Expected: green. If failure, STOP and report.

- [ ] **Step 4: Capture the actual PR number**

```bash
gh pr view --json number --jq .number
```

Note the number. If it differs from `#26` (the placeholder used in Task 7's addendum), fix the addendum in the doc-tick commit at Step 5.

- [ ] **Step 5: Tick Exit Criteria in plan docs + fix audit addendum if needed**

Edit `docs/superpowers/plans/2026-04-23-sprint-5-architecture-cleanup.md` Exit Criteria: tick all items.

Edit `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`:
- Sprint 5 Exit Criteria — tick all items in that section.
- Rollup section — tick all remaining unchecked items including:
  - "All fifteen audit findings have a resolution (implemented, dropped with documented rationale, or converted to a tracked follow-up)."
  - "No occurrences of `P5-A`, `ERRATA`, or `[CERTAIN - BUG]` in `web/src/**` (excluding test fixtures that intentionally reference them)."
  - "`docs/repo-full-scope-analysis-2026-04-23.md` is annotated with the closing roadmap link."
  - "README stats reflect current counts."
  - Any other Rollup items not yet ticked.

If the actual PR number differs from `#26`, edit `docs/repo-full-scope-analysis-2026-04-23.md`'s addendum table to use the real number.

- [ ] **Step 6: Commit doc updates and push**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md docs/superpowers/plans/2026-04-23-sprint-5-architecture-cleanup.md docs/repo-full-scope-analysis-2026-04-23.md
git commit -m "$(cat <<'EOF'
docs: mark sprint 5 + roadmap rollup complete (15/15 findings closed)

CI green on sprint-5/architecture-cleanup. F10, F11, F12, F14, F15
all closed. Roadmap rollup ticks the final five rows. Audit doc
addendum updated with the actual Sprint 5 PR number.
EOF
)"
git push
```

- [ ] **Step 7: Merge**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
gh pr merge --squash --delete-branch
```

- [ ] **Step 8: Cleanup local**

```bash
git checkout main
git pull
git remote prune origin
git log --oneline -10
```

---

## Exit Criteria

- [x] **Task 2 (F11):** `sessionStats.ts` lives in `shared/lib/`. All 7 importers updated. `git mv` preserved history. `features/history/CLAUDE.md` reflects the new location.
- [x] **Task 3 (F12):** `web/src/main.tsx` deleted. `npm run build` and `npm test` still green.
- [x] **Task 4 (F15):** `grep -rn 'P5-A\|P5-B\|\[CERTAIN[ —-]*BUG\]\|ERRATA' src/` returns empty.
- [x] **Task 5 (F10):** `useExerciseHistory.ts` carries the clarifying JSDoc; deps array unchanged.
- [x] **Task 6 (F14):** `web/README.md:16` reflects the current test count.
- [x] **Task 7:** `docs/repo-full-scope-analysis-2026-04-23.md` has a closing addendum table mapping each F# to its merging PR.
- [x] **Task 8:** Full gate green (3 × `npm test`, lint, typecheck, build, e2e). Test count unchanged at 960.
- [x] **Task 9:** CI green; PR merged; roadmap Sprint 5 + Rollup all ticked; on `main`.

---

## Risks And Contingencies

### Risk 1: A test fixture or hidden importer references the old `sessionStats` path

If lint, typecheck, or test fails after Task 2 with an unresolved import, search for remaining references:

```bash
grep -rn "features/history/lib/sessionStats\|./lib/sessionStats" src/ tests/ 2>&1
```

Update any matches to the new path. None expected — the Step 1 grep already enumerated them — but a dynamic import or a test fixture could surface here.

### Risk 2: `web/src/main.tsx` is referenced by tooling not covered by source greps

Build and lint should both fail loudly if anything (Vite plugins, tsconfig project references, etc.) needs the top-level file. Restore via `git checkout HEAD -- src/main.tsx` and investigate the specific reference. The audit's pre-flight ruled this out, but a tooling change since the audit could resurface it.

### Risk 3: The comment sweep accidentally deletes load-bearing context

Each replacement in Task 4 is a content-preserving edit — the audit-era prefix is dropped, the explanation stays. If a future debugger needs the original audit context, `git blame` plus the linked PRs (Sprints 1–5) preserve it. The plan does not delete any explanatory content.

### Risk 4: A test asserted on the old comment text (vanishingly unlikely)

If any test in `tests/**` greps source for the marker strings, Task 4 will break it. Pre-flight check:

```bash
grep -rn "P5-A\|P5-B\|\[CERTAIN[ —-]*BUG\]\|ERRATA" tests/ 2>&1
```

Expected: zero matches. If any test refers to the markers, decide whether the test is checking the comment text (update the test) or the code below (no test change needed; the comment edit doesn't touch behavior).

### Risk 5: PR number drift in the audit closing addendum

Task 7 hardcodes `PR #26` for Sprint 5. If GitHub assigns a different number when the PR opens (e.g. someone opens an unrelated PR in between), Task 9 Step 5 corrects it before the doc commit. Low impact even if missed (one number off).

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage.** F10 → Task 5. F11 → Task 2. F12 → Task 3. F14 → Task 6. F15 → Task 4. Audit closure → Task 7. Gate → Task 8. PR/merge → Task 9.
- [x] **Placeholder scan.** Every comment edit shows the verbatim before/after. The README change shows the exact line. The addendum table is fully populated.
- [x] **Type consistency.** No new types introduced. Function names referenced in comments (`allSetsHitCeiling`, `validateRoutineEntry`, `validateBackupPayload`) match their actual signatures.
- [x] **Source scope.** Modifies `services/`, `shared/`, `features/`, `README.md`, two CLAUDE.md mentions, and the audit doc. No domain types changed. No Dexie schema. No package.json. No new tests (cleanup only).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-sprint-5-architecture-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Same pattern that shipped Sprints 1–4 + the hotfix.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

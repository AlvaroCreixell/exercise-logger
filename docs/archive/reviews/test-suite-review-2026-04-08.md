# Test Suite Review

Date: April 8, 2026

## Scope

Reviewed the runtime code under `web/src` and the test suite under `web/tests`.

Commands run:

- `cd web && npm test`
- `cd web && npm run test:e2e`
- `cd web && npm run build`
- `cd web && npm run lint`
- `cd web && npx vitest run --coverage`

Observed results:

- Vitest: 22 files, 377 tests, all passing.
- Playwright: 9 tests, all passing.
- Build: passing.
- Lint: passing.
- Coverage command: failed because `@vitest/coverage-v8` is not installed.

## Executive Summary

The core domain, database, and service layers are in good shape. The suite is strong where the code is pure or Dexie-backed and weak where the code is interactive, stateful, or UI-driven.

The biggest issue is not raw test count. The issue is distribution:

- `services/` is heavily and mostly meaningfully tested.
- `features/` is barely directly tested.
- `app/` is effectively untested.
- several critical UI flows are only covered by weak E2E assertions that can silently skip the behavior they claim to verify.

As written, I would not say "all coded behaviors correspond to a test." I would say:

- most business rules do correspond to tests;
- many user-visible behaviors do not;
- some currently passing tests are too weak to serve as reliable guards.

## Coverage Assessment By Layer

### Strong

- `web/src/domain/block-signature.ts`
- `web/src/domain/slug.ts`
- `web/src/domain/timestamp.ts`
- `web/src/domain/unit-conversion.ts`
- `web/src/domain/uuid.ts`
- `web/src/db/database.ts`
- `web/src/services/catalog-service.ts`
- `web/src/services/routine-service.ts`
- `web/src/services/session-service.ts`
- `web/src/services/set-service.ts`
- `web/src/services/settings-service.ts`
- `web/src/services/progression-service.ts`
- `web/src/services/backup-service.ts`
- `web/src/shared/lib/csv-parser.ts`
- `web/src/shared/hooks/useLastSession.ts`
- `web/src/shared/hooks/useFinishedSessionSummaries.ts`
- `web/src/shared/hooks/useExerciseHistoryGroups.ts`
- `web/src/shared/hooks/useSessionDetail.ts`
- `web/src/shared/components/ConfirmDialog.tsx`
- `web/tests/integration/acceptance.test.ts` gives useful real-data coverage using the real CSV and bundled YAML.

Notes:

- `downloadBackupFile()` is the main exception inside the otherwise well-covered services layer. It has no direct test and the current E2E test does not reliably verify it.

### Partial

- `web/src/shared/hooks/useExerciseHistory.ts`
- `web/src/shared/hooks/useExtraHistory.ts`

These are thin wrappers over well-tested services, so they are not the highest priority individually, but they are still not directly locked down.

### Weak / Missing

The entire feature layer is under-tested relative to its behavior surface.

Large untested files by line count:

| Lines | File |
|---|---|
| 345 | `web/src/features/workout/WorkoutScreen.tsx` |
| 268 | `web/src/features/history/SessionDetailScreen.tsx` |
| 267 | `web/src/features/workout/SetLogSheet.tsx` |
| 227 | `web/src/features/settings/SettingsScreen.tsx` |
| 205 | `web/src/features/workout/ExerciseCard.tsx` |
| 152 | `web/src/features/today/TodayScreen.tsx` |
| 150 | `web/src/app/App.tsx` |
| 127 | `web/src/features/history/ExerciseHistoryScreen.tsx` |
| 117 | `web/src/features/workout/ExercisePicker.tsx` |
| 108 | `web/src/features/settings/RoutineList.tsx` |

Untested hooks with real behavior:

- `web/src/shared/hooks/useAppInit.ts`
- `web/src/shared/hooks/useActiveSession.ts`
- `web/src/shared/hooks/useRoutine.ts`
- `web/src/shared/hooks/useSettings.ts`
- `web/src/shared/hooks/useExtraHistory.ts`
- `web/src/shared/hooks/useSessionExercises.ts`

Untested feature components/screens with real behavior:

- `web/src/app/App.tsx`
- `web/src/features/today/TodayScreen.tsx`
- `web/src/features/today/DaySelector.tsx`
- `web/src/features/today/DayPreview.tsx`
- `web/src/features/today/LastSessionCard.tsx`
- `web/src/features/workout/WorkoutScreen.tsx`
- `web/src/features/workout/ExerciseCard.tsx`
- `web/src/features/workout/SetLogSheet.tsx`
- `web/src/features/workout/ExercisePicker.tsx`
- `web/src/features/workout/SetSlot.tsx`
- `web/src/features/workout/WorkoutFooter.tsx`
- `web/src/features/workout/SupersetGroup.tsx`
- `web/src/features/history/HistoryScreen.tsx`
- `web/src/features/history/SessionCard.tsx`
- `web/src/features/history/SessionDetailScreen.tsx`
- `web/src/features/history/ExerciseHistoryScreen.tsx`
- `web/src/features/settings/SettingsScreen.tsx`
- `web/src/features/settings/RoutineList.tsx`
- `web/src/features/settings/RoutineImporter.tsx`

### Reasonable Exclusions

I would not spend time adding direct tests for these unless they gain custom logic:

- `web/src/app/main.tsx`
- `web/src/domain/types.ts`
- `web/src/domain/enums.ts`
- `web/src/shared/lib/utils.ts`
- `web/src/shared/ui/*`

## Findings

### High: extra-exercise set editing can break after deleting an earlier extra set

Files:

- `web/src/features/workout/ExerciseCard.tsx:180-187`
- `web/src/features/workout/WorkoutScreen.tsx:64-65`
- `web/src/features/history/SessionDetailScreen.tsx:65`

Why this matters:

- extra sets are stored with persistent `setIndex` values;
- the extra-exercise UI re-renders them using the display loop index `i`;
- after deleting a middle extra set, the remaining displayed index can diverge from the stored `setIndex`;
- `WorkoutScreen` and `SessionDetailScreen` both look up existing sets by `blockIndex + setIndex`.

Effect:

- tapping an existing extra set after a deletion can open the "new set" flow instead of editing the existing row;
- this is a real behavioral bug that the current suite does not cover.

Recommended action:

- add a component/screen test that logs 3 extra sets, deletes the middle one, and verifies the remaining later set still opens as an existing set;
- fix the render path to pass the stored `loggedSet.setIndex` rather than the display index.

### High: distance-based "last time" history is not rendered in `ExerciseCard`

File:

- `web/src/features/workout/ExerciseCard.tsx:31-52`

Why this matters:

- `formatLastTime()` handles weight, reps, and duration;
- it never handles `distanceM`;
- distance-based blocks therefore render blank history text on workout cards and extra-history cards.

Effect:

- service-level history exists and is tested;
- the UI path that should display it is currently not covered and appears broken.

Recommended action:

- add a component test for distance history display;
- add the missing `distanceM` branch in `formatLastTime()`.

### High: the main E2E workflow test can pass without logging a set or verifying a download

File:

- `web/tests/e2e/full-workflow.spec.ts:55-87`
- `web/tests/e2e/full-workflow.spec.ts:96-100`
- `web/tests/e2e/full-workflow.spec.ts:119-125`

Why this matters:

- critical assertions are wrapped in `if (...)` guards with `.catch(() => false)`;
- the test silently tolerates missing set slots, missing inputs, missing save buttons, missing finish confirmation, and missing downloads.

Effect:

- the suite currently reports green even if the set logger UI or export flow regresses badly;
- `downloadBackupFile()` is not meaningfully guarded today.

Recommended action:

- remove the conditional fallbacks around critical steps;
- make set logging and export download hard assertions;
- explicitly verify at least one logged set is visible in History or Session Detail after finish.

### Medium: the app shell and feature layer are missing direct tests

Files:

- `web/src/app/App.tsx`
- most of `web/src/features/*`

Why this matters:

- this layer contains routing, loading/error states, theme synchronization, tri-state hooks, confirmation copy, picker/filter behavior, set-sheet prefills, and history rendering logic;
- these are user-visible contracts, not just presentation.

Examples of important untested behaviors:

- `useAppInit()` seeds settings, catalog, bundled routine, and active routine on first run.
- `App.tsx` syncs theme with `matchMedia`, handles loading state, error state, and wildcard routing.
- `TodayScreen` has three distinct states: no routine, active session resume, and start-workout flow.
- `WorkoutScreen` builds superset render groups, computes unlogged-set copy, opens edit/new set sheet states, and wires finish/discard/add-extra flows.
- `SettingsScreen` contains export, import validation, import-to-resume navigation, clear-all confirmation, and theme side effects.
- `SessionDetailScreen` intentionally allows editing existing logged sets on finished sessions but blocks creating new ones.

Recommended action:

- add targeted component/screen tests rather than trying to rely on broad E2E smoke to cover this layer.

### Medium: `ExercisePicker` state reset on close-by-selection is likely broken

Source inference:

- `web/src/features/workout/ExercisePicker.tsx:45-49`
- `web/src/features/workout/ExercisePicker.tsx:84-85`

Reasoning:

- search/tab reset lives inside `Sheet`'s `onOpenChange`;
- selecting an exercise calls the parent `onOpenChange(false)` directly;
- that likely bypasses the local reset path.

Likely effect:

- reopening the picker after choosing an exercise may preserve stale search text or the previous muscle-group tab.

Recommended action:

- add a component test that searches, selects, reopens, and expects a clean picker state;
- move reset logic into a shared close helper used by both `Sheet.onOpenChange` and item selection.

### Medium: no direct test covers `downloadBackupFile()`

File:

- `web/src/services/backup-service.ts:108-124`

Why this matters:

- this function touches `Blob`, `URL.createObjectURL`, DOM node creation, click triggering, filename generation, and URL cleanup;
- the current E2E test does not fail when no download happens.

Recommended action:

- add a DOM-mocked unit test to assert:
  - filename shape;
  - anchor creation and click;
  - object URL creation and revocation.

### Medium: coverage is not enforceable in CI today

Evidence:

- `web/package.json` has no coverage script or `@vitest/coverage-v8`;
- `npx vitest run --coverage` fails.

Why this matters:

- manual review can identify today's gaps;
- it cannot prevent future drift.

Recommended action:

- install `@vitest/coverage-v8`;
- add `npm run test:coverage`;
- add thresholds by layer, excluding bootstrap/type-only files.

### Low: stale acceptance-test comment references a nonexistent timer store

File:

- `web/tests/integration/acceptance.test.ts:631`

Issue:

- the comment says timer behavior is tested in `timer-store.test.ts` and mentions Zustand;
- there is no timer-store test and no Zustand timer implementation in the current repo.

Effect:

- misleading documentation inside the suite;
- suggests coverage that does not actually exist.

Recommended action:

- update the comment to describe the actual scope of the test;
- if timer behavior is planned, add a real test when the feature exists.

### Low: `useSessionExercises()` is unused and should not receive new tests unless the code stays

Evidence:

- hook defined in `web/src/shared/hooks/useSessionExercises.ts:14`;
- no current callers found in `web/src`.

Recommendation:

- either remove the hook as dead code or wire it into the app;
- do not spend test effort on it while it is unused.

### Low: `useRoutine()` has a null/undefined contract mismatch that is not tested

Files:

- `web/src/shared/hooks/useRoutine.ts:10-17`
- `web/src/features/today/TodayScreen.tsx:53-67`

Issue:

- `useRoutine()` returns `null` only for a nullish ID and `undefined` both while loading and when a requested routine is missing;
- `TodayScreen` treats `routine === null` as "No Active Routine" and `routine === undefined` as render nothing.

Effect:

- a missing-but-referenced routine can lead to a blank state instead of the intended fallback.

This is lower-risk because service/import flows try to preserve settings consistency, but it is still a real contract edge worth locking down.

## Proposed Test Suite Edits

### New Tests

#### Must add

1. `web/tests/unit/features/workout/ExerciseCard.test.tsx`

- renders reps, duration, and distance last-time text correctly;
- renders suggestion chips for progression vs repeat;
- verifies extra sets use stable stored indexes, especially after deleting a middle extra set;
- verifies `readOnly` hides empty slots but keeps existing logged slots actionable.

2. `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- prefill priority: existing set > suggestion > last time > default;
- target-aware validation errors for reps/duration/distance;
- bodyweight "+ Add weight" flow;
- delete path closes on success and shows error on failure.

3. `web/tests/unit/features/workout/WorkoutScreen.test.tsx`

- empty state with no active session;
- finish dialog copy when unlogged routine sets remain;
- add-extra flow;
- tapping existing vs empty slots opens correct sheet mode;
- finish and discard navigate to the correct routes and show the correct toast.

4. `web/tests/unit/features/settings/SettingsScreen.test.tsx`

- export button calls `downloadBackupFile()`;
- invalid import payload renders useful errors;
- successful import with active session navigates to `/workout`;
- theme toggles update both settings and DOM class;
- import and clear buttons disable during active session.

5. `web/tests/unit/features/today/TodayScreen.test.tsx`

- no-active-routine state;
- active-session resume card state;
- selected day override starts the requested day;
- cardio section rendering;
- last-session card rendering;
- elapsed-time updates using fake timers.

6. `web/tests/unit/features/history/SessionDetailScreen.test.tsx`

- session-not-found state;
- grouped display for single vs superset exercises;
- only existing logged sets are editable on finished sessions;
- edit and delete flows propagate correctly.

7. `web/tests/unit/features/history/ExerciseHistoryScreen.test.tsx`

- grouped block rendering with tags and instance labels;
- reps/weight/duration/distance formatting;
- empty-history state.

8. `web/tests/unit/app/App.test.tsx`

- loading state while `useAppInit()` is unresolved;
- error state when init fails;
- wildcard route redirect;
- theme sync for `light`, `dark`, and `system`;
- `matchMedia` listener attach/detach behavior.

9. Add direct `downloadBackupFile()` coverage in `web/tests/unit/services/backup-service.test.ts`

- assert anchor creation, click, filename, and URL cleanup.

#### Should add

1. `web/tests/unit/shared/hooks/useActiveSession.test.ts`

- tri-state contract;
- session exercise ordering;
- logged-set aggregation.

2. `web/tests/unit/shared/hooks/useRoutine.test.ts`

- null ID vs loading vs missing routine semantics.

3. `web/tests/unit/shared/hooks/useSettings.test.ts`

- simple contract test so screens can rely on it without re-testing the hook in every screen test.

4. `web/tests/unit/features/workout/ExercisePicker.test.tsx`

- search filtering;
- muscle-group tab filtering;
- reset behavior on close and on selection;
- "In workout" badge rendering.

5. `web/tests/unit/features/today/DayPreview.test.tsx`

- set-summary formatting for reps/duration/distance;
- superset preview rendering.

### Modified Tests

1. Harden `web/tests/e2e/full-workflow.spec.ts`

- remove all conditional skips around critical UI behavior;
- fail if no set slot appears;
- fail if no save button appears;
- fail if export does not trigger a download;
- assert the finished workout shows up with concrete postconditions, not just a routine title.

2. Update `web/tests/integration/acceptance.test.ts`

- rename Scenario 10 to match what it actually proves;
- remove the nonexistent `timer-store.test.ts`/Zustand comment;
- if timer behavior is later introduced, cover the actual timer state separately.

3. Extend `web/tests/unit/shared/components/ConfirmDialog.test.tsx`

- add a rejection-path test proving pending state resets and the dialog stays open when `onConfirm` throws.

4. Refactor repetitive setter tests in `web/tests/unit/services/settings-service.test.ts`

- keep the coverage;
- collapse the repetitive `setTheme` / `setUnits` cases into table-driven tests.

### Remove Or Consolidate

1. Remove one duplicate Playwright startup smoke test

- `web/tests/e2e/smoke.spec.ts:3`
- `web/tests/e2e/full-workflow.spec.ts:13`

Keep one strong startup test, not two differently-asserted versions of the same behavior.

2. Do not add tests for low-value bootstrap/type-only files

- `web/src/app/main.tsx`
- `web/src/domain/types.ts`
- `web/src/domain/enums.ts`
- `web/src/shared/lib/utils.ts`
- `web/src/shared/ui/*`

3. Do not add tests for `useSessionExercises()` unless the hook is kept and used

- otherwise test effort will go into dead code.

## Suggested Priority Order

1. Harden `full-workflow.spec.ts` so critical UI regressions stop slipping through.
2. Add `ExerciseCard` and `WorkoutScreen` tests, then fix the extra-set index bug and distance-history display bug.
3. Add `SettingsScreen`, `SetLogSheet`, and `TodayScreen` tests.
4. Add `App.tsx` and hook contract tests.
5. Install coverage tooling and set thresholds so these gaps do not reopen later.

## Bottom Line

The project is already unusually well tested for its service layer. The remaining risk is concentrated in the UI contract layer and in a few tests that are green but not actually guarding the behavior they claim to cover.

To make the statement "all coded behaviors correspond to a test" defensible, the next work should focus on:

- feature/screen tests,
- stronger E2E assertions,
- direct coverage for browser-only helpers,
- and eliminating the few source-confirmed bugs the current suite misses.

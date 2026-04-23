# Full Scope Codebase Analysis - 2026-04-23

## Executive Summary

Exercise Logger is a mature local-first React/TypeScript PWA with a strong domain core, unusually broad automated coverage, and a clear architectural intent: feature UI reads through hooks, business rules live in services, and IndexedDB is the only persisted source of truth. The codebase is in good shape overall. Lint, typecheck, production build, and Playwright E2E pass locally. The full Vitest suite also passes when the async timeout is raised to 5 seconds.

The biggest risks are not broad architectural collapse. They are narrower contract edges:

1. Backup import validation is weaker than live service validation, so malformed backups can bypass invariants and persist bad settings, set blocks, or logged set data.
2. Progression fallback matching can merge multiple historical blocks when exact block signatures no longer match.
3. History detail formatting drops non-weight performance data, making bodyweight, isometric, cardio, and distance sets render as a dash.
4. Unit tests are currently timing-sensitive: `npm test` failed once under the default timeout, while the same tests passed in isolation and with `--testTimeout=5000`.
5. Some UI copy and routes drift from actual behavior, especially "Replace active routine" and the orphan exercise-history route.

The recommended next sprint is a hardening sprint focused on backup schema validation, progression matching correctness, non-weight set display, and test flake elimination. A second sprint should follow for architecture cleanup and UI/UX polish.

## Scope And Method

Reviewed areas:

- Repository structure, active source, archived docs, custom GPT docs, CI, and build tooling.
- Domain models, enums, unit conversion, timestamps, IDs, and slugs.
- Dexie schema and migrations.
- Services for catalog, routine import, session lifecycle, set logging, progression, settings, onboarding, and backup.
- Shared hooks, feature UI, app shell/routing, PWA config, and UI primitives.
- Unit, integration, and E2E test structure.
- DRYness, separation of concerns, layering, data contracts, validation boundaries, and UX behavior.

Local inventory:

- Active source files: 159 under `web/src`.
- Test files: 107 under `web/tests`.
- Docs files: 119 under `docs`.
- Source lines: 12,805.
- Test lines: 16,716.
- Test-to-source ratio: 1.31x.

Pre-existing dirty worktree note:

- `docs/custom-gpt/workout-routine-gpt.instructions.md` was already modified before this report was written. I did not touch it.

## Verification Results

| Command | Result | Notes |
|---|---:|---|
| `npm.cmd run lint` | Pass | ESLint reports no issues. |
| `npm.cmd run typecheck` | Pass | `tsc -b` passes. |
| `npm.cmd test` | Fail once | 878 passed, 2 failed. Failures were timing/act related. |
| `npm.cmd test -- tests/unit/app/AppRoutes.test.tsx --testTimeout=5000` | Pass | Confirms AppRoutes failure is timeout-sensitive. |
| `npm.cmd test -- tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx` | Pass | Confirms launch queue failure is not stable in isolation. |
| `npm.cmd test -- --testTimeout=5000` | Pass | 98 files, 880 tests passed. |
| `npm.cmd run build` | Pass | Vite production build passes. |
| `npm.cmd run test:e2e` | Pass | 20 Playwright tests passed. |

Environment note: Vite/Vitest/Playwright needed permission to spawn esbuild/browser child processes. The first non-escalated attempts failed with `spawn EPERM`; reruns succeeded.

## High-Level Architecture Assessment

The intended architecture is documented consistently in `CLAUDE.md` and layer-specific guides:

```text
Features -> Hooks -> Services -> Dexie
```

Strengths:

- Domain contracts are centralized in `web/src/domain/types.ts` and `web/src/domain/enums.ts`.
- Service functions consistently accept `db` as their first argument, which makes tests deterministic and avoids hidden singletons in business logic.
- Session snapshots are well modeled. Finished history survives routine deletion.
- Critical Dexie compound-index constraints are documented and handled through the `instanceLabel: ""` sentinel.
- Multi-step mutations generally use Dexie transactions and place active-session guards inside those transactions.
- The test suite is broad and includes domain, service, hook, component, integration, Playwright, and accessibility coverage.
- PWA build/deploy setup is practical and verified.

Weaknesses:

- Validation is duplicated and uneven between YAML import and JSON backup import.
- Some UI feature components call services and `db` directly. This is workable, but it weakens the documented "features -> hooks -> services" boundary.
- `shared` imports one feature helper: `web/src/shared/hooks/useFinishedSessionSummaries.ts:4` imports from `@/features/history/lib/sessionStats`. That inverts the shared/feature dependency direction.
- A few old review annotations remain in production comments, for example `P5-A [CERTAIN - BUG]` in `web/src/services/progression-service.ts`.
- `web/src/main.tsx` duplicates `web/src/app/main.tsx`, while `web/index.html:15` points only to `web/src/app/main.tsx`.

## Prioritized Findings

### P1. Backup Import Can Persist Shapes The App Would Never Create Live

Evidence:

- `web/src/services/backup-service.ts:197` uses `isNumber` that rejects `NaN` but not all invalid semantic values.
- `web/src/services/backup-service.ts:217` validates set blocks structurally, but does not enforce the full YAML contract: exactly one of range/exact, finite positive targets, integer counts, or `minValue < maxValue`.
- `web/src/services/backup-service.ts:765` validates only `id`, `activeRoutineId`, and `units` for settings.
- `web/src/services/backup-service.ts:1027` persists onboarding fields from the imported settings object using `?? null`, without validating their runtime types.

Impact:

- A JSON backup can restore bad `Settings` values, malformed set blocks, invalid logged set measurements, or structurally inconsistent history that normal services would reject.
- Because backup import is a full overwrite, this is a high-leverage trust boundary.

Recommended fix:

- Define a single runtime schema for persisted backup entities, preferably close to `domain/types.ts`.
- Make backup validation at least as strict as live service input:
  - finite numeric fields,
  - integer fields where required,
  - non-negative/positive measurement rules,
  - `SetBlock` exactly-one target shape,
  - `minValue < maxValue`,
  - timestamp string sanity checks,
  - settings onboarding field types,
  - duplicate logged slot checks for `[sessionExerciseId, blockIndex, setIndex]`,
  - `loggedSets.sessionId` matches the parent `sessionExercise.sessionId`.
- Add import tests that intentionally bypass live services and prove malformed backups are rejected.

This deserves a dedicated backup-schema hardening analysis/sprint.

### P1. Progression Fallback Can Merge Multiple Historical Blocks

Evidence:

- Fallback matching starts at `web/src/services/progression-service.ts:124`.
- It filters candidates by exercise, instance label, origin, tag, and target kind at `web/src/services/progression-service.ts:136`.
- It then passes all fallback matches to `findMostRecentFinishedSessionSets` at `web/src/services/progression-service.ts:145`.
- `allSetsLogged` only checks `matchingSets.length >= expectedCount` at `web/src/services/progression-service.ts:221`.

Impact:

- If a prior finished session has multiple blocks with the same tag and target kind, and the exact block signature no longer matches after a routine edit/import, fallback can combine sets from multiple old blocks.
- That can produce misleading "last time" displays and incorrect progression suggestions.

Recommended fix:

- In fallback mode, group candidates by `(sessionId, sessionExerciseId, blockIndex, blockSignature)` before selecting the most recent block.
- Require unique set indexes and expected count equality for progression eligibility.
- Add regression tests with two untagged `reps` blocks in the same exercise where only one should match.

This deserves a focused progression-engine analysis because the matching semantics are subtle and user trust depends on them.

### P1. Session Detail Drops Non-Weight Set Values

Evidence:

- `web/src/features/history/SessionDetailExerciseCard.tsx:13` defines `formatPillContent`.
- `web/src/features/history/SessionDetailExerciseCard.tsx:14` returns a dash unless both `performedWeightKg` and `performedReps` are present.

Impact:

- Bodyweight reps, isometric duration, cardio duration, distance, and unweighted rep sets display as `-` in session detail even though the data exists.
- The active workout row and exercise history screen handle more value types, so this is inconsistent and user-visible.

Recommended fix:

- Extract a shared logged-set formatter used by `SetRow`, `SessionDetailExerciseCard`, `ExerciseHistoryScreen`, and history hints.
- Cover combinations:
  - weight + reps,
  - reps only,
  - duration only,
  - distance only,
  - duration + distance for cardio,
  - empty/corrupt set fallback.

### P1. Default Unit Test Command Is Flaky Under Current Timing

Evidence:

- `npm.cmd test` failed with 2 failures:
  - `tests/unit/app/AppRoutes.test.tsx`: default `findByRole` timeout hit while lazy route still showed `Loading...`.
  - `tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`: navigation assertion failed with an `act(...)` warning.
- Both files passed in isolation.
- Full suite passed with `npm.cmd test -- --testTimeout=5000`.

Impact:

- CI uses `npm test` in `.github/workflows/deploy-web.yml`, so timing flake can block deploys.
- The app behavior appears okay, since Playwright onboarding and launch-adjacent flows pass, but the test harness needs hardening.

Recommended fix:

- Update the AppRoutes test to wait for app initialization/lazy route completion with a longer explicit timeout or more deterministic seeded state.
- Wrap launch queue consumer invocation in `act`.
- Consider setting a project-level Vitest timeout if React 19 lazy route tests routinely exceed 1 second on slower machines.

### P2. Cardio Extra Logging Shows Distance But Requires Duration

Evidence:

- `web/src/features/workout/SetLogSheet.tsx:90` identifies cardio extras.
- `web/src/features/workout/SetLogSheet.tsx:435` shows distance when `targetKind === "distance" || isCardioExtra`.
- `web/src/features/workout/set-log-validation.ts:21` requires `performedDurationSec` whenever target kind is `duration`.
- Cardio extras default to `duration` when there is no set block.

Impact:

- A user can see a distance field for a cardio extra, enter only distance, and still be blocked because duration is required.

Recommended fix:

- Give extras a flexible validation mode: require at least one meaningful performance field appropriate to the exercise type.
- For cardio extras, allow duration-only, distance-only, or duration + distance.
- Add component and service tests for cardio extra distance-only logging.

### P2. ConfirmDialog Swallows Async Errors Without User Feedback

Evidence:

- `web/src/shared/components/ConfirmDialog.tsx:58` catches errors and only clears pending state.

Impact:

- Any confirm action that does not catch internally fails silently. Examples include clear-all-data races or future destructive actions.
- Some callers catch and toast themselves, but the component contract does not require it.

Recommended fix:

- Add an optional `onError(error)` prop, or let errors bubble and require callers to catch.
- Prefer a default toast fallback for shared destructive confirmations.
- Add a test that rejected `onConfirm` keeps the dialog open and surfaces an error.

### P2. Exercise History Route Is Implemented But Orphaned

Evidence:

- `web/src/app/App.tsx:183` explicitly comments that `/history/exercise/:exerciseId` is orphaned.
- The original spec says tapping an exercise name should open per-exercise history.

Impact:

- A built screen and hook exist but are not discoverable through the UI.
- Tests can pass while a planned user workflow remains absent.

Recommended fix:

- Either add links from session detail exercise cards and possibly active workout cards, or remove the route/screen if abandoned.
- If added, ensure the route works for snapshot names and deleted catalog entries.

### P2. Routine Import Copy Says "Replace" But The Service Adds A Routine

Evidence:

- `web/src/features/settings/RoutineImportScreen.tsx:133` shows `Replace active routine`.
- `web/src/services/routine-service.ts:875` inserts the new routine, then `web/src/services/routine-service.ts:876` sets it active. It does not delete or replace the previous active routine.

Impact:

- Users may expect the previous routine to be removed.
- The app may accumulate routines when the user believes they are replacing one.

Recommended fix:

- Change copy to `Import and activate routine`.
- If true replacement is desired, implement a separate explicit replace flow with deletion rules and history-safe wording.

### P2. YAML Routine Validation Is More Lenient Than The Contract

Evidence:

- `web/src/services/routine-service.ts:455` coerces `notes` elements with `String(...)` despite copy saying they must be strings.
- `web/src/services/routine-service.ts:466` through `483` tolerates partially invalid cardio content by filling blanks instead of reporting field-specific errors.
- `web/src/services/routine-service.ts:726` accepts exact target values without checking positivity.
- `web/src/services/routine-service.ts:713` checks range order but not positivity/finite values.

Impact:

- GPT-generated YAML or hand-written YAML can import semantically weak data that later produces odd logging UI or progression behavior.

Recommended fix:

- Decide whether the importer is intentionally permissive or contract-strict.
- If strict, reject non-string notes/cardio fields and non-positive target values.
- If permissive, document the coercions in `docs/custom-gpt/routine-yaml-contract.md`.

### P2. `useExerciseHistory` Dependencies Can Go Stale For Same-ID Snapshot Changes

Evidence:

- `web/src/shared/hooks/useExerciseHistory.ts:23` depends only on `[sessionExercise?.id, units]`.
- The query result also depends on `sessionExercise.instanceLabel`, `setBlocksSnapshot`, `effectiveType`, and `effectiveEquipment`.

Impact:

- If a same-ID session exercise snapshot changes, for example weighted bodyweight promotion or unit/equipment-related edits, the hook can rely on Dexie invalidation rather than explicit React dependencies.
- This is probably masked during normal set logging because `loggedSets` changes trigger live-query reruns, but the dependency contract is incomplete.

Recommended fix:

- Include the relevant scalar fields or a stable signature in the dependency array.
- Alternatively have the hook load the session exercise by ID inside the live query so Dexie observes that table directly.

### P2. Shared Layer Depends On A Feature Helper

Evidence:

- `web/src/shared/hooks/useFinishedSessionSummaries.ts:4` imports `computeSessionVolumeKg` from `@/features/history/lib/sessionStats`.

Impact:

- This reverses the intended dependency direction. It is small, but it makes `shared` less reusable and feature boundaries less clear.

Recommended fix:

- Move `sessionStats.ts` to `web/src/shared/lib` or `web/src/domain` if it stays pure.

### P2. Duplicate App Entry Point Is Dead Code

Evidence:

- `web/index.html:15` points to `/src/app/main.tsx`.
- `web/src/main.tsx` also renders the app and duplicates `web/src/app/main.tsx`.

Impact:

- Small but unnecessary confusion for future contributors and agents.

Recommended fix:

- Delete `web/src/main.tsx`, or make it a thin re-export only if needed by tooling.

### P3. Feature Screens Often Call Services And `db` Directly

Evidence:

- Examples include `TodayScreen`, `WorkoutScreen`, `SettingsScreen`, `RoutineImportScreen`, `HandoffScreen`, and `SessionDetailScreen`.

Impact:

- The documented architecture says features flow through hooks to services, but command handlers live directly in screens.
- This is not causing obvious bugs, and for a small app it is pragmatic. The cost is that async error behavior, pending state, and toasts are repeated across screens.

Recommended fix:

- Do not refactor wholesale now.
- For touched areas, introduce small command hooks only where they remove duplicated error/pending/toast behavior.

### P3. Exercise Picker Marks Existing Exercises But Still Allows Picking Them

Evidence:

- `web/src/features/workout/ExercisePicker.tsx:68` computes `inWorkout`.
- `web/src/features/workout/ExercisePicker.tsx:75` still calls `onPick(ex.id)`.
- `web/src/features/workout/ExercisePicker.tsx:86` displays `In workout`.

Impact:

- This may be intentional if duplicate extras are allowed, but the badge reads like a disabled state.

Recommended fix:

- Decide product behavior:
  - allow duplicates and change copy to `Add again`, or
  - disable already-present exercises.

### P3. Docs And README Stats Are Stale

Evidence:

- README says 120 source files, 69 test files, 742 unit/integration tests.
- Current local counts are 159 source files, 107 test files, and 880 Vitest tests plus 20 E2E tests.

Impact:

- The README undersells current coverage and can confuse future maintenance.

Recommended fix:

- Update the stats after the hardening sprint.
- Consider generating stats with a script to avoid manual drift.

### P3. Production Comments Still Contain Historical Review Labels

Evidence:

- `web/src/services/progression-service.ts` includes comments such as `P5-A [CERTAIN - BUG]`.
- `web/src/services/backup-service.ts` includes several `ERRATA` labels.

Impact:

- These comments were useful during review, but in production they read like unresolved bugs even when the code below has fixed the issue.

Recommended fix:

- Convert them into neutral explanatory comments or remove them.

## Domain And Data Model Notes

Strong points:

- Types are coherent and easy to reason about.
- `Session`, `SessionExercise`, and `LoggedSet` form a useful snapshot model.
- `instanceLabel` string sentinel is well documented and correctly aligned with Dexie compound index behavior.
- Unit conversion is intentionally pure and avoids equipment rounding except in progression suggestions.

Risks:

- Runtime validation is not centralized. TypeScript interfaces do not protect data restored from JSON.
- Backup schema version remains `1` while Dexie schema is now `3`; this is okay only if backup validation/backfill continues to absorb all persisted shape changes.
- `LoggedSet.isPersonalRecord` is optional for back-compat but backup validation does not currently validate it.
- Rest timer snapshot fields are retained but unused. That is acceptable if intentionally reserved, but it should remain documented as drift.

## Service Layer Notes

Strong points:

- Session lifecycle service enforces the most important invariants.
- Routine activation/deletion guards are inside transactions.
- Set logging upserts by slot and denormalizes fields needed by progression.
- Import/clear operations use all-or-nothing transactions.

Risks and cleanup:

- `deleteSet` is a simple read-then-delete outside a transaction. This is not currently dangerous, but if future code cascades or validates parent state, wrap it.
- `setUnitOverride` can update any session exercise by ID. If unit override is intended to be active-session-only, enforce that in the service.
- `findPreviousUnitOverride` scans all finished sessions and session exercises in memory. Fine for current local-first scale, but a future large-history optimization could add an index or more targeted query.
- Progression matching should be treated as a high-value trust area and given its own regression matrix.

## UI/UX Notes

Strong points:

- The app is clearly phone-first.
- The main workflow is direct: Today -> Workout -> SetLogSheet -> Finish -> History.
- Empty states are present and generally specific.
- Playwright includes keyboard and axe-core checks for key onboarding surfaces.
- The PWA install/update flow is present.

Risks:

- Session detail formatting does not represent all logged set kinds.
- Cardio extras expose a field combination the validator rejects.
- Several errors depend on caller-specific toasts; shared dialog errors can disappear.
- The app shell always shows bottom nav around onboarding routes. That may be intentional, but first-run onboarding can feel less like a focused flow.
- Some UI copy uses symbols inside text labels where an icon component might be clearer, for example the Today start CTA.
- The route for exercise history exists but users cannot reach it.

## Testing And CI Notes

Strong points:

- Coverage breadth is excellent.
- Service tests are deep and exercise real IndexedDB through fake-indexeddb.
- E2E has meaningful workflows, a11y checks, and offline service-worker coverage.
- CI runs lint, unit tests, build, and E2E before deploy.

Risks:

- Default `npm test` can be flaky under local full-suite timing. CI uses this exact command.
- App TypeScript build only includes `src`; tests rely on Vitest transform rather than `tsc` project coverage.
- ESLint has no import-boundary or a11y plugin. Current tests cover some a11y, but static checks would catch issues earlier.
- E2E is serialized, which is appropriate for IndexedDB isolation, but total runtime will grow as scenarios expand.

Recommendations:

- Add a dedicated `test:unit` script with a project-level timeout if needed.
- Add `eslint-plugin-jsx-a11y` if the UI surface continues to grow.
- Add a lightweight dependency-boundary check, even a simple script, to prevent `shared -> features` imports.
- Consider a separate `tsconfig.test.json` if test type safety becomes important.

## Folder Structure And Documentation Notes

Strong points:

- Active app structure is understandable:
  - `app`
  - `domain`
  - `db`
  - `services`
  - `shared`
  - `features`
  - `data`
- Layer-specific `CLAUDE.md` files are useful and unusually explicit.
- Archive docs preserve decision history without polluting active source.

Risks:

- `docs/archive` is large. That is fine for provenance, but active docs should be clearly separated from historical docs.
- README stats have drifted.
- Some docs point at superseded spec locations or mention older assumptions; the design spec has a drift block, which helps.
- Custom GPT routine docs should be kept in sync with `web/src/data/catalog.csv` and the stricter import contract.

## DRY And Separation Of Concerns

Good DRY:

- Domain helpers for units, slugs, timestamps, block signatures, and IDs are centralized.
- UI primitives and shared components prevent repeated base styling.
- Services concentrate mutation rules.

Duplication to reduce:

- Set value formatting is duplicated and inconsistent across active workout, session detail, exercise history, and hint strips.
- YAML validation and backup validation duplicate enum and set-block rules but differ behaviorally.
- Onboarding completion is partially in `onboarding-service.ts` and partially hand-coded in `HandoffScreen`.
- Async command pending/error/toast patterns are repeated in screens.

Recommended abstractions:

- `formatLoggedSet(set, units, options)` in a shared pure module.
- Shared runtime validation helpers for `SetBlock`, measurements, settings, and timestamps.
- Optional command hooks for high-churn UI flows, not a blanket state-management rewrite.

## Proposed Sprint Strategy

### Sprint 1: Data Trust And Test Stability

Goal: eliminate restore/progression correctness risks and make CI deterministic.

Tasks:

1. Harden backup validation to match live service invariants.
2. Add malformed-backup regression tests.
3. Fix progression fallback grouping and unique set-count checks.
4. Add progression regression tests for multi-block fallback collisions.
5. Stabilize `npm test` by fixing async route/launch-queue tests or increasing Vitest timeout.
6. Run full gates: lint, typecheck, unit/integration, build, E2E.

### Sprint 2: History And Logging UX Correctness

Goal: make all logged set kinds display and save consistently.

Tasks:

1. Extract shared logged-set formatter.
2. Fix session detail pills for reps-only, duration, distance, and cardio sets.
3. Fix cardio extra distance-only validation.
4. Add tests for non-weight history display and cardio extra logging.
5. Decide duplicate-extra behavior in ExercisePicker.

### Sprint 3: Architecture Cleanup

Goal: remove small sources of drift and improve maintainability without a rewrite.

Tasks:

1. Move `sessionStats` out of `features/history` if shared hooks need it.
2. Remove duplicate `web/src/main.tsx`.
3. Normalize production comments that still contain review labels.
4. Replace misleading routine import copy.
5. Decide whether exercise history route is shipping or dead.

### Sprint 4: Documentation And Contract Sync

Goal: keep external routine generation and user-facing docs aligned with the app.

Tasks:

1. Update README stats and verification claims.
2. Sync custom GPT docs with current catalog and YAML validation behavior.
3. Add a tiny script or checklist for regenerating catalog references.
4. Refresh active design/spec docs, leaving archive docs untouched.

## Areas Worth Dedicated Follow-Up Analysis

1. Backup schema and migration strategy.
   The backup format is the highest-risk boundary because it bypasses live service constructors.

2. Progression engine semantics.
   Matching, fallback behavior, unit rounding, block identity, and routine changes deserve their own test matrix.

3. Onboarding architecture.
   It works, but completion state, prompt persistence, direct settings updates, and route guards are spread across service, screen, and app shell.

4. UI accessibility beyond onboarding.
   Existing E2E covers keyboard basics and onboarding axe checks. Workout and session-detail surfaces should get a focused a11y pass.

5. Documentation automation.
   README stats and custom GPT catalog references will continue drifting unless generated.

## Bottom Line

The repo is strong. It has a real domain model, good local-first architecture, serious tests, and a working PWA deployment path. The highest-return work is not a rewrite. It is targeted hardening of import/progression contracts, fixing a few user-visible history/logging inconsistencies, and removing small architecture/documentation drifts before they compound.

# Workout Rhythm — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans. This plan supersedes the blueprint at
> `docs/archive/plans/2026-04-25-sprint-2-workout-rhythm.md` — read that blueprint for full UX
> contract, prompts, and test matrices; THIS file records what was re-validated on 2026-07-04
> and what changed. Follow the blueprint's steps except where a delta below overrides it.

**Goal:** Rest timer from session snapshots, explicit superset A1→B1 round flow, visible
set-sheet cancel, contextual (quieter) extra-set affordance. No schema changes, no sound/haptics.

## ⚠️ Base branch — read first

**Branch from `main` only AFTER PR #28 (first-run activation) is merged.** PR #28 touches
`SetLogSheet.tsx` and workout-adjacent tests; basing this work on pre-merge main guarantees
conflicts. If #28 is somehow abandoned, re-validate every file reference below first.

Suggested branch: `sprint/2026-07-04-workout-rhythm`.

## Validated current state (2026-07-04, at sprint/first-run-activation-v2 tip d2ffdcc)

- `Session.restDefaultSecSnapshot` / `restSupersetSecSnapshot` exist (`domain/types.ts:153-155`),
  are written at session start (`services/session-service.ts:216-217`), and are validated by
  backup import (`backup-service.ts:564-573`). Nothing reads them in the UI. ✓ blueprint claim.
- `SupersetGroup.tsx` is a trivial children wrapper (border + "Superset" `SectionHeader`).
  New prop API required for the round rail. ✓ blueprint claim.
- `SetLogSheet.tsx:295` renders `showCloseButton={false}` — no visible cancel. ✓ blueprint claim.
- `ExerciseCard.tsx` renders "+ Add extra set" per block unconditionally (lines ~185-201),
  driven by the Sprint 4 D3b per-block tap counter. ✓ blueprint claim — **delta 3 below**.
- `WorkoutScreen.tsx:127-140` `handleSave` ALREADY branches edit (`sheetExistingSet` →
  `editSet`) vs create (`logSet`). **Delta 1 below.**
- `WorkoutScreen.tsx:56-68` uses a `setTick` re-render loop + derive-at-render
  (`computeElapsedSec(startedAt)`), not a `nowMs` state. **Delta 2 below.**
- `npm run typecheck` (`tsc -b`) exists in `web/package.json`. ✓

## Deltas vs the blueprint

1. **Create/edit split half-exists.** `handleSave` already routes edits through `editSet`.
   Still add the blueprint's second guard: before treating a save as "new", check the current
   `loggedSets` snapshot for the `[sessionExerciseId, blockIndex, setIndex]` slot (stale-sheet
   case) — `logSet` upserts, so a stale create is really an update and must NOT start rest.
2. **Keep the existing tick pattern.** Don't introduce `nowMs` state; reuse the `setTick`
   re-render loop and derive `restRemainingSec` at render from `timer.startedAtMs` +
   `Date.now()`, same as `elapsedSec`. The tick already runs whenever a session is active,
   which covers the entire life of any rest timer. Transition `running → done` at render time
   (derived), not via a separate timeout.
3. **Extra-set hiding must integrate with the Sprint 4 tap counter.** `ExerciseCard` keeps
   local `extraTaps` per block plus persisted extra rows. The contextual rule is:
   show control iff `isBlockComplete(bi) || extraTaps[bi] > 0 || persistedExtraRows(bi) > 0`.
   Preserve existing aria-labels (`Add extra set to set block N`) — tests depend on them.
4. **Verify `logSet` return value at execution time** (blueprint claims it returns the
   `LoggedSet`). If it doesn't, extend set-service rather than re-querying in the component.
5. **Superset pairing:** blueprint's ordinal-flattening approach stands. Pull pair membership
   from `SessionExercise` superset grouping as rendered by `WorkoutScreen` (the same data that
   feeds `SupersetGroup` children today) — do not re-derive from routine snapshots.

## Execution order (from the blueprint, unchanged)

1. Baseline: `npm run typecheck` + targeted workout unit tests.
2. Worker C (SetLogSheet cancel) and Worker D (ExerciseCard contextual extras) — disjoint, start immediately.
3. Worker B: `superset-rhythm.ts` helpers + `SupersetRoundRail.tsx` + `SupersetGroup` API — no WorkoutScreen edits.
4. Worker A: `rest-timer.ts` + `RestTimerBar.tsx` + WorkoutScreen integration.
5. Coordinator: wire superset helper into rest-timer start logic; integrate rail into WorkoutScreen.
6. Worker E: `tests/e2e/workout-rhythm.spec.ts`.
7. Final gate: full `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`.

Acceptance criteria, test matrix, worker prompts, and risk mitigations: use the blueprint's
sections verbatim (they were reviewed and still apply).

## Definition of done

Blueprint's DoD plus: PR against `main`, review comments triaged the same day, and manual QA
note in the PR body covering iPhone Safari + Android Chrome timer/cancel reachability.

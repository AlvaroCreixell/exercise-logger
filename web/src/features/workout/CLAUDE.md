# Workout Feature

The active workout screen (`/workout`). Only accessible when a session is in progress. Handles set logging, superset grouping, PR marking, adding extra exercises, and finishing or discarding the session.

## Screens

- `WorkoutScreen.tsx` — Main layout and state machine for set-logging. Orchestrates the SetLogSheet, ExercisePicker, FinishCelebration, and ConfirmDialog (for discard).

## Components

- `SessionHeader.tsx` — Top bar with day label and elapsed time.
- `SessionProgress.tsx` — Progress indicator across exercises.
- `ExerciseCard.tsx` — One exercise with its set blocks and set rows.
- `SupersetGroup.tsx` — Paired exercise layout for `kind: "superset"` entries.
- `SetRow.tsx` — One set row with weight/reps display and tap-to-edit.
- `SetDots.tsx` — Visual indicator of set completion state within a block.
- `SetLogSheet.tsx` — Bottom sheet for logging/editing a set. Uses `Keypad` + `ValueBox`.
- `Keypad.tsx` — Custom numeric keypad (digits, decimal, backspace, ± nudge). Reducer-driven.
- `ValueBox.tsx` — The active weight/reps field the keypad targets.
- `PrToggle.tsx` — Toggle for marking a set as a personal record.
- `ExercisePicker.tsx` — Sheet for picking an extra exercise to add mid-session.
- `WorkoutFooter.tsx` — Sticky footer with "+ Exercise", "Finish", "Discard".
- `FinishCelebration.tsx` — Celebration overlay shown briefly before navigating to the session detail.

## Local utilities (`lib/`)

- `formatSetTarget.ts` — Renders a `SetBlock`'s target as a human string (`"8–12 reps"`, `"30 sec"`, etc.).
- `keypad-reducer.ts` — Reducer for `Keypad` state (active field, digit buffer, nudge behavior).

Top-level: `set-log-validation.ts` — guards against invalid set input before hitting `logSet`.

## Hooks used

`useActiveSession`, `useSettings`, `useExerciseHistory`, `useExtraHistory` — from `@/shared/hooks/`.

## Services called

- `logSet`, `editSet`, `deleteSet` — `@/services/set-service`.
- `addExtraExercise`, `finishSession`, `discardSession` — `@/services/session-service`.
- `getBlockLabel` plus `BlockSuggestion`, `BlockLastTime`, `ExerciseHistoryData`, `ExtraExerciseHistory` types — `@/services/progression-service` (consumed via the `useExerciseHistory` and `useExtraHistory` hooks; not called directly by components).
- `setUnitOverride` — `@/services/settings-service`.
- `getEffectiveUnit` — `@/domain/unit-helpers`.

## Key UI invariants

- **Set logging upserts by `[sessionExerciseId, blockIndex, setIndex]`** (invariant 9). The sheet passes these three identifiers; never a `loggedSetId` on create.
- **Extra exercises never see progression suggestions** (invariant 7). `WorkoutScreen` only invokes `useExerciseHistory` for routine-origin exercises; extras route through `useExtraHistory`, which returns most-recent sets for display but never a +5% suggestion.
- **Weighted bodyweight promotion runs only on active sessions** (set-service contract). Editing a finished-session set never mutates `effectiveType`.
- **Discard does not advance rotation** (invariant 4). `finishSession` is the only path that advances `nextDayId`.

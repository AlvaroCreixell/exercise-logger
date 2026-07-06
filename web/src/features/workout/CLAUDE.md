# Workout Feature

The active workout screen (`/workout`). Only accessible when a session is in progress. Handles set logging, superset grouping, PR marking, adding extra exercises, and finishing or discarding the session.

## Screens

- `WorkoutScreen.tsx` — Main layout and state machine for set-logging. Orchestrates the SetLogSheet, ExercisePicker, FinishCelebration, and ConfirmDialog (for discard).

## Components

- `SessionHeader.tsx` — Top bar with day label and elapsed time.
- `SessionProgress.tsx` — Progress indicator across exercises.
- `ExerciseCard.tsx` — One exercise with its set blocks and set rows.
- `SupersetGroup.tsx` — Paired exercise layout for `kind: "superset"` entries. With the optional `exercises` + `setsByExercise` props it renders the A/B side labels and `SupersetRoundRail`; children-only renders the legacy layout.
- `SupersetRoundRail.tsx` — Non-interactive A1/B1/A2/B2 chip rail (complete/current/upcoming). Context only, never a second logger.
- `RestTimerBar.tsx` — Compact rest countdown docked **above `WorkoutFooter`** (thumb zone). Running: label + m:ss + "+30s" + "Skip" (≥44 px hit areas) + a ≥16 px `next: <target>` line; done: "Rest complete" + "Dismiss" (`aria-live="polite"` on the done text only).
- `SetRow.tsx` — One set row with weight/reps display and tap-to-edit. A `primed` prop renders the guided-logging variant: `❯ <target> [LOG]` (row tap LOGS the target, `data-primed-row`) plus a trailing ✎ button that opens the sheet.
- `SetDots.tsx` — Visual indicator of set completion state within a block.
- `SetLogSheet.tsx` — Bottom sheet for logging/editing a set. Uses `Keypad` + `ValueBox`.
- `Keypad.tsx` — Custom numeric keypad (digits, decimal, backspace, ± nudge). Reducer-driven.
- `ValueBox.tsx` — The active weight/reps field the keypad targets.
- `PrToggle.tsx` — Toggle for marking a set as a personal record. Shows a quiet "auto" hint when the on-state came from best-ever auto-detection rather than a manual tap.
- `ExercisePicker.tsx` — Sheet for picking an extra exercise to add mid-session.
- `WorkoutFooter.tsx` — Sticky footer with "+ Exercise", "Finish", "Discard".
- `FinishCelebration.tsx` — Celebration overlay shown briefly before navigating to the session detail.

## Local utilities (`lib/`)

- `formatSetTarget.ts` — Renders a `SetBlock`'s target as a human string (`"8–12 reps"`, `"30 sec"`, etc.).
- `quick-target.ts` — Guided logging: `resolvePrimedSlot` (first empty prescribed slot), `resolveQuickTarget` (per-block one-tap payload: carryover → suggestion weight; progression restarts reps at the range floor; non-weight blocks require block history), `formatQuickTarget`, `formatBlockTargetHint` (day-one row hint).
- `keypad-reducer.ts` — Reducer for `Keypad` state (active field, digit buffer, nudge behavior). Supports **pristine-replace**: the first digit after prefill/focus replaces the whole value; backspace/nudges switch to append.
- `rest-timer.ts` — Pure rest-timer model: `getRestTimerStartAfterNewSet` (single vs superset-round rules), `getRestRemainingSec`, `formatRestClock`.
- `superset-rhythm.ts` — Pure superset ordinals: `flattenPrescribedSlots`, `getSlotOrdinal`, `isRoundComplete`, `buildSupersetRail`. Ordinals are 1-based and flattened across blocks — never compare raw `setIndex` between partners.

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
- **Rest timers start only in `handleSave`'s create path** — never from effects observing `loggedSets`, never on edit/delete/stale-slot saves. Timer state is ephemeral UI state (resets on reload; never persisted). Durations come from `Session.restDefaultSecSnapshot` / `restSupersetSecSnapshot`; superset rest waits for `isRoundComplete` on the saved set's ordinal.
- **Extra-set control is contextual** — visible only when the block's prescribed slots are complete, or extras (persisted or locally tapped) already exist. Extra-origin exercises are unaffected.
- **Auto-PR is best-ever and create-mode only.** `SetLogSheet` receives `personalBests` (from `useExercisePersonalBests`; all previously logged sets for the exerciseId, any session status, extras included) and defaults the PR toggle via `isNewPersonalBest` (`@/domain/personal-records`). Manual toggle taps override auto until the sheet closes; edit mode never auto-flags; no prior comparable set → not a PR (day one stays quiet). Cardio (duration+distance) never auto-PRs. Quick-logged sets get the identical verdict (computed in `ExerciseCardWithHistory` before `logSet`).
- **Quick-log = same create path as the sheet.** `WorkoutScreen.saveNewSet` is the single create path (upsert stale-slot guard, superset round rest, timer start). One primed row per routine card (first empty prescribed slot) logs its resolved target in one tap; undo toast (8 s) hard-deletes the set and cancels only the timer whose `ActiveRestTimer.loggedSetId` matches. Extras and day-one blocks never prime (invariant 7 / never invent numbers).
- **Sheet prefill waits for history.** `SetLogSheetWithHistory` is keyed by exercise id and passes `historyLoaded`; create-mode prefill runs once per open AFTER the exercise's history query resolves, and any user input claims the open (no late clobber). `parseCurrentInput` nulls measures whose field isn't rendered — hidden weight/reps can never save (the cardio-extra poisoning bug). Progression prefill restarts reps at the range floor; day-one weight prefills empty, never "0"; weight nudges step by `getIncrement(effectiveEquipment, units)`.
- **Flow focus.** Complete cards collapse to `⏺ name n/n` + one `⎿` summary line (`aria-expanded` header toggle); superset pairs collapse as a unit (key = `supersetGroupId`); the unit that just received a save stays expanded until the next save elsewhere; completing a card auto-scrolls the next `[data-primed-row]` to center.
- **Gym-proofing.** `useWakeLock` holds a screen lock while a session is active and `settings.keepScreenOn`; the rest-complete cue is ONE `setTimeout` per timer identity (an effect on `restTimer` — +30s reschedules, Skip/unmount cancels, never double-fires) firing `playRestCue` (`@/shared/lib/cues`) only while the page is visible; the audio context is primed from save/+30s gestures when `restCueSound` is on. Timers still start exclusively in `saveNewSet`.

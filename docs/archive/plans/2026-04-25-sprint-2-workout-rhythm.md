# Sprint 2 - Workout Rhythm Blueprint

> Status: planning blueprint.
> Date: 2026-04-25.
> Scope: rest timer, clearer superset A1/B1 flow, visible set-sheet cancel, quieter extra-set affordance, and optional haptics later.

## Goal

Make the active workout feel like it has rhythm instead of feeling like a passive set ledger.

The user should always know:

- What they just logged.
- Whether they should rest now.
- What comes next in a superset.
- How to back out of the set sheet without saving.
- How to add extra work without every routine card shouting for extra sets from the first render.

North-star outcome: a user can start a workout, log regular sets and superset rounds, and keep moving without needing to infer timing or flow from the raw set list.

## Current Diagnosis

### 1. Rest Times Are Stored But Not Used

Routine and session records already snapshot rest settings:

- `Routine.restDefaultSec`
- `Routine.restSupersetSec`
- `Session.restDefaultSecSnapshot`
- `Session.restSupersetSecSnapshot`

Current code stores these values during session start, but the workout screen never turns them into behavior.

Current files:

- `web/src/domain/types.ts`
- `web/src/services/session-service.ts`
- `web/src/features/workout/WorkoutScreen.tsx`
- `web/src/features/workout/SessionHeader.tsx`
- `web/src/features/workout/SessionProgress.tsx`

Decision: use the existing session snapshots. Do not add schema or settings work for Sprint 2.

### 2. Supersets Are Grouped, But The A1/B1 Flow Is Implicit

`SupersetGroup` currently renders a left border, a `Superset` label, and two normal exercise cards. That groups the exercises visually, but it does not explain the intended sequence:

- A1
- B1
- rest
- A2
- B2
- rest

Current files:

- `web/src/features/workout/WorkoutScreen.tsx`
- `web/src/features/workout/SupersetGroup.tsx`
- `web/src/features/workout/ExerciseCard.tsx`

Decision: keep the existing exercise cards for Sprint 2, but add explicit A/B round context around them. Avoid a full interleaved-row rewrite until manual use proves the labels and round rail are insufficient.

### 3. The Set Sheet Has No Visible Cancel

`SetLogSheet` renders:

```tsx
<SheetContent side="bottom" className="max-h-[70dvh]" showCloseButton={false}>
```

The user can close the sheet through backdrop/gesture behavior, but there is no visible cancel action. In a gym flow, that feels risky because the sheet is where set data is entered and saved.

Current files:

- `web/src/features/workout/SetLogSheet.tsx`
- `web/tests/unit/features/workout/SetLogSheet.test.tsx`

Decision: add an explicit cancel control inside the sheet header. It closes without saving and without deleting.

### 4. Extra-Set Affordance Is Too Noisy

`ExerciseCard` currently renders `+ Add extra set` under every routine block immediately. It was a useful capability unlock, but it now competes with the primary task: logging prescribed sets.

Current files:

- `web/src/features/workout/ExerciseCard.tsx`
- `web/tests/unit/features/workout/ExerciseCard.test.tsx`

Decision: hide the extra-set control until it becomes contextually relevant. A block should show extra-set access when its prescribed sets are complete or when extra rows already exist.

### 5. Haptics Are Useful, But Not A Sprint 2 Dependency

Timer completion haptics can make the workout feel better on phones, but browser/PWA support varies and the app does not currently have a haptics setting.

Decision: leave a clean extension point, but do not add settings schema, notification permission, sound, or haptic behavior in Sprint 2 core.

## Non-Goals

- No routine editor.
- No timer persistence across reload.
- No push notifications, local notifications, or background alarms.
- No sound.
- No haptics setting in Sprint 2 core.
- No database migration.
- No full superset row interleaving rewrite.
- No broad visual redesign of the workout screen.
- No changes to progression math.
- No changes to finished session history display, except tests confirming active-workout behavior does not regress saved data.

## Target UX

### Flow A: Regular Set Rest

1. User starts a workout.
2. User taps a prescribed set row.
3. Set sheet opens.
4. User enters values and saves.
5. Sheet closes.
6. A compact rest timer appears below session progress.
7. Timer uses `session.restDefaultSecSnapshot`.
8. User can dismiss/skip the timer.
9. If the user logs another set before the timer finishes, the timer restarts from the new save.
10. Editing an already logged set does not restart the timer.
11. Deleting a set does not restart the timer.

### Flow B: Superset Round Rest

1. User sees a superset group with explicit A/B labels and a round rail.
2. User logs A1.
3. No rest timer appears yet.
4. Round rail marks A1 complete and B1 as next.
5. User logs B1.
6. Rest timer starts using `session.restSupersetSecSnapshot`.
7. Round rail marks A1 and B1 complete and points to A2.
8. The same pattern repeats for A2/B2, A3/B3, and any extra matching rounds.

### Flow C: Visible Cancel

1. User opens a set sheet.
2. A visible cancel action is present in the sheet header.
3. User taps Cancel.
4. Sheet closes.
5. No save is called.
6. Existing logged set data remains unchanged.

### Flow D: Quieter Extra Sets

1. User sees routine card prescribed rows.
2. Extra-set button is not shown on an incomplete block.
3. User completes the block's prescribed rows.
4. A low-emphasis `Extra set` control appears for that block.
5. User taps it.
6. One empty extra row appears after the prescribed rows.
7. Existing logged extra rows still rehydrate and keep the control visible.
8. Extra-origin exercises still show their normal next empty row.

## UX Contract

### Rest Timer Placement

Place the timer directly below `SessionProgress` and above the scrollable exercise list.

Rationale:

- It stays near the workout state, not inside an individual card that may scroll away.
- It does not block set logging.
- It keeps the header area as the stable command zone.

Timer states:

- `idle`: render nothing.
- `running`: show label, remaining time, skip/dismiss, and optional `+30s`.
- `done`: show `Rest complete` until dismissed or replaced by the next logged set.

Suggested copy:

- Running single: `Rest - Bench Press`
- Running superset: `Rest - Superset round 1`
- Done: `Rest complete`

Do not announce every countdown tick to assistive tech. If using `aria-live`, reserve it for the transition into `done`.

### Superset Group Presentation

Keep a light group container, but make the sequence explicit:

- Header: `Superset`
- Sub-label: `Alternate A then B before resting`
- Round rail chips: `A1`, `B1`, `A2`, `B2`, etc.
- Completed chips use the existing complete/check treatment.
- The next chip uses `aria-current="step"`.
- The two exercise sections are labelled `A` and `B`.

Do not duplicate the full set rows in the rail. The rail is navigation/context, not a second logger.

### Set Sheet Cancel

Add a visible cancel action in the header.

Acceptance details:

- Accessible name should include `Cancel`.
- It calls `onOpenChange(false)`.
- It does not call `onSave`.
- It does not call `onDelete`.
- It remains visible in create and edit modes.
- It is reachable by keyboard.

### Extra-Set Control

Replace the always-visible per-block affordance with a contextual control:

- If block prescribed slots are incomplete and no extra rows exist: hide the control.
- If block prescribed slots are complete: show low-emphasis `Extra set`.
- If extra rows already exist from local taps or persisted logged sets: show the control.
- For multi-block exercises, keep one independent control per block.
- Keep existing aria labels for disambiguation, but update visible copy to be quieter.

Recommended visible copy:

- Single block: `Extra set`
- Multi-block aria label: `Add extra set to set block 1`

## Architecture Decisions

### Rest Timer Should Be Local UI State

Do not persist timer state in IndexedDB for Sprint 2.

Reasoning:

- The app is local-first and session data is durable, but active rest countdown state is ephemeral.
- Persistence across reload introduces clock reconciliation, stale-done states, and hidden notification expectations.
- The high-value behavior is immediate feedback after a set save.

If the app reloads during a rest, the timer can reset to idle. The logged set remains saved.

### Start Timer From Save Handler, Not From Effects

Start rest only inside `WorkoutScreen.handleSave` after a successful new-set save.

Current service contract:

```ts
const savedSet = await logSet(db, sheetExercise.id, sheetBlockIndex, sheetSetIndex, input);
```

`logSet` returns the created or updated `LoggedSet`.

Implementation rule:

- If `sheetExistingSet` exists: call `editSet`; do not start rest.
- If the slot was already present in the current `loggedSets` snapshot: treat it as an update; do not start rest.
- Otherwise call `logSet`; use the returned set to decide whether to start rest.

This prevents accidental timer restarts from:

- Dexie live query re-renders.
- Editing a previous set.
- Deleting a set.
- Reopening and saving the same slot after stale UI state.

### Use One Time Source In WorkoutScreen

`WorkoutScreen` already has a one-second tick for elapsed workout duration. Sprint 2 should move toward a shared render clock:

```ts
const [nowMs, setNowMs] = useState(() => Date.now());
```

Use `nowMs` to derive:

- `elapsedSec`
- `restRemainingSec`

Only tick while an active session exists, or while a rest timer is running/done.

### Pure Rest Helpers

Add a small helper module:

- `web/src/features/workout/lib/rest-timer.ts`
- `web/tests/unit/features/workout/lib/rest-timer.test.ts`

Suggested types:

```ts
export type RestTimerKind = "single" | "superset";

export interface RestTimerStart {
  kind: RestTimerKind;
  durationSec: number;
  label: string;
  roundOrdinal: number | null;
}

export interface ActiveRestTimer {
  status: "running" | "done";
  kind: RestTimerKind;
  durationSec: number;
  startedAtMs: number;
  label: string;
  roundOrdinal: number | null;
}
```

Core helper:

```ts
export function getRestTimerStartAfterNewSet(args: {
  session: Session;
  sessionExercises: SessionExercise[];
  loggedSetsBefore: LoggedSet[];
  savedSet: LoggedSet;
}): RestTimerStart | null
```

Rules:

- Return `null` if duration is `0` or less.
- Return default rest for single exercise saves.
- Return default rest for extra exercises.
- For superset saves, return `null` until both A and B have a logged set for the same round ordinal.
- For superset saves, use `session.restSupersetSecSnapshot`.
- For routine overrun extra sets inside a superset, start superset rest only if both A and B have that same overrun ordinal logged.

### Superset Slot Ordinals

Do not rely only on `blockIndex` and `setIndex` matching between paired exercises. Multi-block exercises can reset `setIndex`.

Add pure helpers:

- `web/src/features/workout/lib/superset-rhythm.ts`
- `web/tests/unit/features/workout/lib/superset-rhythm.test.ts`

Suggested helpers:

```ts
export interface SupersetSlot {
  ordinal: number;
  blockIndex: number;
  setIndex: number;
}

export function flattenPrescribedSlots(se: SessionExercise): SupersetSlot[];

export function getSlotOrdinal(
  se: SessionExercise,
  blockIndex: number,
  setIndex: number,
): number;

export function buildSupersetRail(args: {
  exercises: [SessionExercise, SessionExercise];
  setsByExercise: Map<string, LoggedSet[]>;
}): SupersetRailItem[];
```

Ordinal rule:

- Prescribed slots are flattened in the same order `ExerciseCard` renders them.
- Extra overrun slots are ordinals after prescribed slots.
- A round is complete when both exercise A and exercise B have logged the same ordinal.

This keeps A1/B1 behavior stable even if one exercise has multiple set blocks.

### Rest Timer Component

Add:

- `web/src/features/workout/RestTimerBar.tsx`
- `web/tests/unit/features/workout/RestTimerBar.test.tsx`

Props:

```ts
interface RestTimerBarProps {
  timer: ActiveRestTimer;
  nowMs: number;
  onSkip: () => void;
  onAddSeconds: (seconds: number) => void;
}
```

Behavior:

- Derive remaining seconds from `durationSec - elapsed`.
- When remaining reaches zero, parent transitions status to `done`.
- `+30s` increases `durationSec`.
- `Skip` clears the timer.
- New timer replaces old timer.

Keep visual treatment compact:

- No modal.
- No toast-only timer.
- No full-screen overlay.
- No animation that shifts the exercise list every second.

### Haptics Extension Point

Do not implement haptics as a user-facing feature in this sprint.

If an extension point is needed, keep it internal:

```ts
type RestTimerCompleteHandler = (timer: ActiveRestTimer) => void;
```

Future haptic work can add:

- `web/src/features/workout/lib/haptics.ts`
- A settings flag.
- A graceful `navigator.vibrate` wrapper.

No Sprint 2 acceptance test should require vibration support.

## Implementation Plan

### Step 0: Baseline

Coordinator runs targeted baseline checks before edits:

```bash
cd web
npm run typecheck
npm run test -- tests/unit/features/workout/WorkoutScreen.test.tsx tests/unit/features/workout/SetLogSheet.test.tsx tests/unit/features/workout/ExerciseCard.test.tsx
```

If failures already exist, record them before assigning workers. Do not mix pre-existing failures with Sprint 2 regressions.

### Step 1: Rest Timer Model And Component

Files to add:

- `web/src/features/workout/lib/rest-timer.ts`
- `web/src/features/workout/RestTimerBar.tsx`
- `web/tests/unit/features/workout/lib/rest-timer.test.ts`
- `web/tests/unit/features/workout/RestTimerBar.test.tsx`

Files to edit:

- `web/src/features/workout/WorkoutScreen.tsx`
- `web/tests/unit/features/workout/WorkoutScreen.test.tsx`

Tasks:

- Add timer state to `WorkoutScreen`.
- Replace the elapsed-only tick with a shared `nowMs` tick.
- In `handleSave`, distinguish create vs edit/update.
- After successful new-set save, call `getRestTimerStartAfterNewSet`.
- Render `RestTimerBar` below `SessionProgress` when timer is active.
- Mark timer as `done` when remaining reaches zero.
- Clear timer on skip.
- Add 30 seconds on `+30s`.

Tests:

- Regular new set starts default rest.
- Edit existing set does not restart rest.
- Saving a stale already-logged slot does not restart rest as if it were new.
- Delete does not start rest.
- Timer can be skipped.
- Timer reaches done state with fake timers or controlled `nowMs`.

### Step 2: Superset Rhythm Helpers And UI

Files to add:

- `web/src/features/workout/lib/superset-rhythm.ts`
- `web/tests/unit/features/workout/lib/superset-rhythm.test.ts`
- `web/src/features/workout/SupersetRoundRail.tsx`
- `web/tests/unit/features/workout/SupersetGroup.test.tsx`

Files to edit:

- `web/src/features/workout/SupersetGroup.tsx`
- `web/src/features/workout/WorkoutScreen.tsx`

Tasks:

- Add pure helpers for flattening slots and building rail state.
- Update `SupersetGroup` props so it can render rail data, not only children.
- Keep existing child exercise cards.
- Add visible `A` and `B` labels either in `SupersetGroup` wrappers or through a narrow prop passed into card wrappers.
- Integrate superset helper with rest timer helper.

Tests:

- Rail renders A1/B1/A2/B2 for two 2-set exercises.
- A1 completed, B1 current after logging A1 only.
- A1 and B1 completed, A2 current after logging both.
- Mismatched set structures do not crash.
- Superset timer does not start after A1 only.
- Superset timer starts after B1 completes round 1.

### Step 3: Visible Set Sheet Cancel

Files to edit:

- `web/src/features/workout/SetLogSheet.tsx`
- `web/tests/unit/features/workout/SetLogSheet.test.tsx`

Tasks:

- Add a visible cancel button/control in the sheet header.
- Use existing button primitives and icon system where appropriate.
- Keep `showCloseButton={false}` if the default close button conflicts with desired placement.
- Ensure the visible control calls `onOpenChange(false)`.
- Keep save and delete behavior unchanged.

Tests:

- Cancel control is visible in create mode.
- Cancel control is visible in edit mode.
- Clicking cancel closes the sheet.
- Clicking cancel does not call `onSave`.
- Clicking cancel does not call `onDelete`.
- Existing Enter-to-save behavior remains intact.

### Step 4: Quieter Extra-Set Affordance

Files to edit:

- `web/src/features/workout/ExerciseCard.tsx`
- `web/tests/unit/features/workout/ExerciseCard.test.tsx`

Tasks:

- Add `isBlockComplete(blockIndex)` helper inside `ExerciseCard`.
- Render extra-set control only when `isBlockComplete(bi) || getExtraCount(bi) > 0`.
- Keep persisted extra rows rehydrating from `loggedSets`.
- Keep local extra taps additive and per block.
- Keep extra-origin exercise behavior unchanged.
- Lower visual priority of the control.

Tests:

- Routine card does not show extra-set control before prescribed block completion.
- Completing all prescribed rows for a block shows the control.
- Existing logged extra rows show the control on render.
- Tapping the control adds one extra row.
- Multi-block controls remain independent.
- Extra-origin exercises still render the next empty row.
- Extra rows do not count toward routine progress.

### Step 5: E2E And Manual QA

Files to add or edit:

- `web/tests/e2e/workout-rhythm.spec.ts`
- `web/tests/e2e/helpers/onboarding-helpers.ts` only if helper reuse is needed.

E2E targets:

- Start workout, log first normal set, see rest timer.
- Open set sheet and cancel without saving.
- Log A1 in a superset and confirm no timer.
- Log B1 and confirm superset rest timer.
- Complete a prescribed block and confirm extra-set affordance appears.

Manual QA targets:

- iPhone Safari/PWA viewport.
- Android Chrome viewport.
- Desktop narrow viewport.
- Keyboard-only cancel/save path.
- Fast logging path where a user logs sets before previous rest timer completes.

## Subagent-Driven Implementation Flow

The coordinator owns sequencing, integration, and final verification. Workers are not alone in the codebase; each worker must avoid reverting edits from other workers and must adjust to changes already present.

### Coordinator Responsibilities

- Run baseline checks.
- Spawn workers with disjoint ownership.
- Keep `WorkoutScreen.tsx` integration conflicts under control.
- Review each worker patch before merging concepts.
- Resolve prop/API boundaries.
- Run final unit, typecheck, and E2E checks.
- Keep the sprint to UX rhythm, not broader workout redesign.

### Worker A: Rest Timer

Ownership:

- `web/src/features/workout/lib/rest-timer.ts`
- `web/src/features/workout/RestTimerBar.tsx`
- `web/tests/unit/features/workout/lib/rest-timer.test.ts`
- `web/tests/unit/features/workout/RestTimerBar.test.tsx`
- Timer-related sections of `web/src/features/workout/WorkoutScreen.tsx`
- Timer-related tests in `web/tests/unit/features/workout/WorkoutScreen.test.tsx`

Prompt:

```text
Implement Sprint 2 rest timer behavior. You are not alone in the codebase; do not revert edits from other workers. Own the rest timer helper, RestTimerBar component, and WorkoutScreen timer integration. Start timers only after successful new-set saves, never after edits or deletes. Use session rest snapshots. Add focused unit tests and list changed files.
```

Acceptance:

- Default rest starts after regular new set.
- Superset rest waits for round completion once superset helper is integrated.
- Edits/deletes do not start rest.
- Timer UI is compact and testable.

### Worker B: Superset Rhythm

Ownership:

- `web/src/features/workout/lib/superset-rhythm.ts`
- `web/src/features/workout/SupersetRoundRail.tsx`
- `web/src/features/workout/SupersetGroup.tsx`
- `web/tests/unit/features/workout/lib/superset-rhythm.test.ts`
- `web/tests/unit/features/workout/SupersetGroup.test.tsx`

Prompt:

```text
Implement Sprint 2 superset rhythm helpers and presentation. You are not alone in the codebase; do not revert edits from other workers. Own superset helper logic, the rail component, and SupersetGroup tests. Avoid editing WorkoutScreen unless absolutely necessary; expose a clean prop API for coordinator integration. List changed files.
```

Acceptance:

- A/B rail is explicit.
- Current/complete states are derived from logged sets.
- Helper supports multi-block exercises through flattened ordinals.
- No full ExerciseCard rewrite.

### Worker C: Set Sheet Cancel

Ownership:

- `web/src/features/workout/SetLogSheet.tsx`
- `web/tests/unit/features/workout/SetLogSheet.test.tsx`

Prompt:

```text
Add a visible cancel control to SetLogSheet. You are not alone in the codebase; do not revert edits from other workers. The control must close the sheet without saving or deleting. Preserve existing save, delete, keypad, and prefill behavior. Add focused tests and list changed files.
```

Acceptance:

- Visible cancel in create and edit mode.
- No save/delete side effects.
- Existing keyboard save tests still pass.

### Worker D: Extra-Set Affordance

Ownership:

- `web/src/features/workout/ExerciseCard.tsx`
- `web/tests/unit/features/workout/ExerciseCard.test.tsx`

Prompt:

```text
Make ExerciseCard's routine extra-set affordance quieter. You are not alone in the codebase; do not revert edits from other workers. Hide extra-set controls until the relevant prescribed block is complete or existing extras are present. Keep extra-origin exercises unchanged. Preserve progress semantics. Add focused tests and list changed files.
```

Acceptance:

- Extra-set controls are no longer visible on untouched prescribed blocks.
- Controls appear after block completion or existing extras.
- Existing extra rows rehydrate.
- Progress counters remain prescribed-only.

### Worker E: Regression And E2E

Ownership:

- `web/tests/e2e/workout-rhythm.spec.ts`
- Additional targeted unit test adjustments after coordinator integration.

Prompt:

```text
Add Sprint 2 workout rhythm regression coverage. You are not alone in the codebase; do not revert edits from other workers. Focus on user-level flows: rest timer after normal save, no timer after superset A1 only, timer after B1, visible set-sheet cancel, and contextual extra-set affordance. List changed files and any uncovered risk.
```

Acceptance:

- E2E covers the main rhythm path.
- Tests do not depend on brittle animation timing.
- Failures point to user-visible regressions.

## Integration Sequence

1. Coordinator runs baseline checks.
2. Worker C and Worker D can run immediately because their files are disjoint.
3. Worker B builds superset helpers and UI without editing `WorkoutScreen.tsx` unless necessary.
4. Worker A builds rest timer and touches `WorkoutScreen.tsx`.
5. Coordinator integrates Worker B's `SupersetGroup` API into `WorkoutScreen.tsx`.
6. Coordinator wires `superset-rhythm` helper into `rest-timer`.
7. Worker E adds E2E coverage after the integrated UI exists.
8. Coordinator runs full targeted verification.

Conflict watch:

- `WorkoutScreen.tsx` is the main integration hotspot.
- `ExerciseCard.tsx` should belong to Worker D only.
- `SetLogSheet.tsx` should belong to Worker C only.
- Superset labels should be implemented in `SupersetGroup` wrappers where possible to avoid overlapping Worker D's card work.

## Test Matrix

### Unit

```bash
cd web
npm run test -- tests/unit/features/workout/lib/rest-timer.test.ts
npm run test -- tests/unit/features/workout/lib/superset-rhythm.test.ts
npm run test -- tests/unit/features/workout/RestTimerBar.test.tsx
npm run test -- tests/unit/features/workout/SupersetGroup.test.tsx
npm run test -- tests/unit/features/workout/WorkoutScreen.test.tsx
npm run test -- tests/unit/features/workout/SetLogSheet.test.tsx
npm run test -- tests/unit/features/workout/ExerciseCard.test.tsx
```

### Typecheck

```bash
cd web
npm run typecheck
```

### E2E

```bash
cd web
npm run test:e2e -- tests/e2e/workout-rhythm.spec.ts
```

### Final Confidence Run

```bash
cd web
npm run test -- tests/unit/features/workout
npm run typecheck
npm run build
```

Run the full E2E suite only if targeted E2E or build changes touch shared app shell behavior.

## Acceptance Criteria

- A newly logged regular set starts a visible rest timer using `restDefaultSecSnapshot`.
- Editing an existing set does not start or restart the timer.
- Deleting a set does not start or restart the timer.
- A superset timer does not start after A1 alone.
- A superset timer starts after B1 completes the A1/B1 round, using `restSupersetSecSnapshot`.
- Superset UI clearly labels A/B order and shows round state.
- Set sheet has a visible cancel control.
- Cancel closes the set sheet without saving or deleting.
- Extra-set controls are hidden on incomplete prescribed blocks.
- Extra-set controls appear after prescribed block completion or when extra rows already exist.
- Existing extra exercise logging remains unchanged.
- No database schema changes are introduced.
- No haptic, notification, or sound behavior is required for tests to pass.

## Risks And Mitigations

### Risk: Timer Starts Twice

Cause: starting timer from effects that observe `loggedSets`.

Mitigation: start timer only inside `handleSave` after a successful new-set save.

### Risk: Edits Look Like New Logs

Cause: `logSet` can update an existing slot if called on a duplicate.

Mitigation: check both `sheetExistingSet` and the current `loggedSets` snapshot for the slot before treating it as a new set.

### Risk: Superset Round Logic Breaks On Multi-Block Exercises

Cause: matching only by `setIndex`.

Mitigation: flatten slots into ordinals and match A/B by ordinal.

### Risk: Timer Is Annoying For Accessibility

Cause: countdown text changes every second.

Mitigation: do not put the live countdown itself in an assertive live region. Announce only state transitions like `Rest complete`.

### Risk: Extra Sets Become Too Hidden

Cause: hiding all incomplete-block extra controls removes an escape hatch for users who intentionally overrun early.

Mitigation: ship the contextual rule first, then watch manual QA. If it feels too hidden, add a compact card-level overflow action in a follow-up without returning to always-visible per-block text buttons.

### Risk: Worker Conflicts In WorkoutScreen

Cause: rest timer and superset integration both need `WorkoutScreen.tsx`.

Mitigation: Worker B exposes helper/component APIs without editing `WorkoutScreen.tsx`; coordinator performs final integration after Worker A.

## Definition Of Done

- Markdown plan is converted into discrete implementation tasks or subagent prompts.
- Rest timer, superset rhythm, cancel, and extra-set changes are implemented.
- Targeted unit tests pass.
- Typecheck passes.
- At least one E2E workout-rhythm flow passes.
- Manual mobile QA confirms the timer and cancel controls are reachable and not visually cramped.
- No unrelated UX redesign or schema work ships inside Sprint 2.


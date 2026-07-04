# Sprint 1 - First-Run Activation And GPT Handoff Recovery Blueprint

> Status: planning blueprint.
> Date: 2026-04-25.
> Scope: first-run activation, full-screen onboarding, starter-routine value, Today active-routine context, iPhone-safe GPT handoff recovery, and regression locks for recently closed trust bugs.

## Goal

Ship a first-run experience that gets a cold-install user to a logged set quickly and safely:

- Onboarding is full-screen. The bottom app nav is absent from onboarding routes.
- The first screen explains that a starter routine is already ready, instead of starting with a name-only prompt.
- The user has two clear paths: use the starter routine now, or build a personalized routine.
- The personalized-routine handoff works on iPhone Safari/PWA: no JS popup dependency, no lost prompt when clipboard is blocked.
- Today makes the active routine visible so users know which plan they are starting.
- Existing high-trust fixes stay locked by regression tests.

North-star outcome: cold install to first logged set can be completed in under 60 seconds by choosing the starter routine.

## Current Diagnosis

### 1. Onboarding Is Inside The App Shell

`/onboarding`, `/onboarding/questionnaire`, and `/onboarding/handoff` currently render under the same `Shell` as Today, Workout, History, and Settings. The bottom nav is therefore visible during onboarding.

Current files:

- `web/src/app/App.tsx`
- `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`
- `web/src/features/onboarding/QuestionnaireScreen.tsx`
- `web/src/features/onboarding/components/WizardShell.tsx`

Decision: split routes into separate layouts. Do not merely hide the nav with CSS. Onboarding routes should be rendered under an `OnboardingLayout` with no bottom navigation in the DOM.

### 2. The First Screen Does Not Sell The Ready State

The app already seeds and activates `full-body-3day.yaml` on fresh install through `useAppInit`, but first-run users are redirected to onboarding before Today shows the routine. The current first screen asks "What should we call you?" before explaining the product value.

Current files:

- `web/src/shared/hooks/useAppInit.ts`
- `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`
- `web/src/features/today/TodayScreen.tsx`
- `web/src/features/today/TodayHeroCard.tsx`
- `web/data/routines/full-body-3day.yaml`

Decision: turn the welcome screen into a first-run choice screen:

- Show "Starter routine ready" with the active starter routine name, next day label, exercise count, set count, and first exercise.
- Primary CTA: "Use starter routine" marks onboarding skipped and routes to Today.
- Secondary CTA: "Build personalized routine" stores the optional name and routes to the questionnaire.
- If a saved wizard state exists, show "Continue personalized routine" and a small "Start over" affordance. Continue resumes; Start over clears sessionStorage explicitly.
- Optional name field remains, but is not the main value proposition.

### 3. GPT Handoff Burns The iOS User Gesture

The current Stage 1 button awaits IndexedDB persistence before `navigator.clipboard.writeText`, then calls `window.open`. iPhone Safari and installed PWAs are strict about transient user activation for clipboard and popup calls. There is also a detection problem: `window.open(..., "noopener,noreferrer")` may return `null` even when the tab opened, so the app can show a false "popup blocked" message.

Current files:

- `web/src/features/onboarding/HandoffScreen.tsx`
- `web/src/features/onboarding/components/LastPromptCard.tsx`
- `web/src/features/today/OnboardingBanner.tsx`
- `web/tests/e2e/helpers/onboarding-helpers.ts`

Decision: remove JS popup opening from the handoff. Use an explicit saved-prompt workflow:

- Generate and save the prompt when the handoff screen loads.
- Always show the saved prompt on the handoff/recovery screen.
- `Copy prompt` only attempts clipboard copy. It performs no awaited DB write first.
- `Open GPT` is a real anchor: `<a href={GPT_URL} target="_blank" rel="noopener noreferrer">`.
- The YAML import form lives on the same recovery screen as the saved prompt, copy button, and GPT link.
- Clipboard failure is an inline state, not only a toast. It expands the prompt and tells the user to long-press/select manually.

### 4. Today Does Not Name The Active Routine

Today shows the next day and workout contents, but not the active routine name. Settings has a reusable active-routine summary, but Today needs lightweight context too.

Current files:

- `web/src/features/today/TodayScreen.tsx`
- `web/src/features/today/TodayHeroCard.tsx`
- `web/src/features/settings/ActiveRoutineCard.tsx`

Decision: add active routine context on Today:

- Hero eyebrow or meta line includes `routine.name`.
- Active-session resume card includes `session.routineNameSnapshot`.
- The day switcher remains secondary.

### 5. Trust Bugs Are Mostly Closed, But Need Locks

The Apr 23 audit findings are now largely addressed, but Sprint 1 should preserve them with explicit regression checks rather than rediscovering them later.

Regression lock targets:

- Session detail renders reps-only, duration-only, distance-only, and cardio duration+distance without an accidental dash.
- Backup import rejects malformed set blocks, malformed settings onboarding fields, duplicate logged-set slots, and logged-set/sessionExercise session mismatches.
- Progression fallback does not merge ambiguous historical blocks.
- Cardio extra distance-only logging remains valid.
- Exercise-history route remains reachable from session detail.

## Non-Goals

- No routine editor.
- No new chart/dashboard surface.
- No account, sync, or server telemetry.
- No dark mode.
- No rest timer or superset rhythm in this sprint.
- No new runtime dependencies.
- No broad visual redesign beyond first-run and Today context.

## Target UX Flows

### Flow A: Cold Install, Use Starter

1. User opens `/`.
2. App initializes catalog and seeds the starter routine.
3. App redirects to `/onboarding`.
4. Screen is full-screen with no bottom nav.
5. User sees:
   - "Starter routine ready"
   - `Full Body 3-Day Rotation`
   - next day label
   - exercise count, set count, first exercise
6. User optionally enters name.
7. User taps "Use starter routine".
8. App calls `markOnboardingSkipped(db)` and saves name if present.
9. App routes to Today.
10. Today shows active routine context and "Start workout".

Success metric: a user can then start a workout, log the first set, and finish the critical path in under 60 seconds in the E2E/manual QA script.

### Flow B: Cold Install, Build Personalized Routine

1. User opens `/`.
2. User sees starter value and chooses "Build personalized routine".
3. App saves optional name.
4. App routes to `/onboarding/questionnaire`.
5. No bottom nav appears during the wizard.
6. Mid-wizard reload resumes the same step from `sessionStorage`.
7. Exiting the wizard preserves progress and returns to the first-run choice screen or Today depending on onboarding flags.
8. Start over explicitly clears the wizard state.

### Flow C: GPT Handoff On iPhone

1. User completes questionnaire.
2. App routes to `/onboarding/handoff` with `state.justCompleted=true`.
3. Handoff builds prompt from sessionStorage, stores it in settings, and renders it locally.
4. User taps "Copy prompt".
5. If clipboard succeeds, inline state says copied.
6. If clipboard fails or `navigator.clipboard` is absent, the prompt expands and manual-copy instructions are visible.
7. User taps "Open GPT", which is a normal anchor link.
8. User returns with YAML and pastes it into the same screen.
9. Import succeeds, clears prompt, marks onboarding completed, clears wizard state, and routes to Today.

### Flow D: Recovery From Saved Prompt

1. User generated a prompt but did not import YAML.
2. Today banner and Settings saved-prompt card route to `/onboarding/handoff`.
3. Handoff shows the saved prompt, copy action, GPT link, and YAML import form.
4. No paste-only dead end exists.

## Architecture Decisions

### Route Layout

Add a separate onboarding route layout in `App.tsx`:

```tsx
function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-lg flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
      <BottomNav />
    </div>
  );
}

function OnboardingLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-lg flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
    </div>
  );
}
```

Implementation can keep names local to `App.tsx`; the key is route split:

- App shell: `/`, `/workout`, `/history`, `/settings`, etc.
- Onboarding shell: `/onboarding`, `/onboarding/questionnaire`, `/onboarding/handoff`.

This also gives desktop a constrained app frame without waiting for a separate desktop-polish sprint.

### Wizard Resume Semantics

Change the questionnaire close behavior from destructive exit to resumable exit.

Current behavior:

- `QuestionnaireScreen.onClose` clears wizard sessionStorage.
- `WizardShell` says "Your answers won't be saved."

Sprint 1 behavior:

- `QuestionnaireScreen.onClose` does not clear sessionStorage. It navigates away only.
- `WizardShell` dialog copy becomes "Save and exit?" with body "Your answers stay on this device so you can continue later."
- Explicit Start over actions are the only UI path that clears wizard sessionStorage before import success.
- `OnboardingWelcomeScreen` reads `loadWizardState()` and shows Continue/Start over when saved progress exists.

### First-Run Decision Helper

Extract readable booleans inside `AppRoutes`:

```ts
const hasCompletedOnboarding = settings.onboardingCompletedAt !== null;
const hasSkippedOnboarding = settings.onboardingSkippedAt !== null;
const hasSeenOnboarding = hasCompletedOnboarding || hasSkippedOnboarding;
```

Guards:

- Fresh root `/` redirects to `/onboarding`.
- `/onboarding` redirects to `/` only when `hasSeenOnboarding` and there is no explicit relaunch state.
- `/onboarding/questionnaire` remains accessible from Settings even for skipped/completed users.
- `/onboarding/handoff` without saved prompt and without `justCompleted` redirects to `/onboarding/questionnaire`.

### Starter Summary Data

Create a shared pure helper so onboarding and Today do not duplicate count logic:

`web/src/features/today/lib/routineSummary.ts`

Exports:

```ts
export interface RoutineDaySummary {
  dayId: string;
  dayLabel: string;
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  muscleGroups: string[];
}

export function summarizeRoutineDay(...): RoutineDaySummary;
```

Keep this helper pure. It accepts the `RoutineDay` and exercise lookup map. It does not read Dexie.

### Handoff State Model

Replace `stage1` / `handoff-complete` with a simpler "prompt plus import" screen model.

Suggested local state:

```ts
type CopyState = "idle" | "copied" | "blocked";

const [prompt, setPrompt] = useState<string | null>(settings.lastGeneratedPrompt);
const [promptExpanded, setPromptExpanded] = useState(false);
const [copyState, setCopyState] = useState<CopyState>("idle");
const [yaml, setYaml] = useState("");
const [errors, setErrors] = useState<ValidationError[]>([]);
const [inlineMessage, setInlineMessage] = useState<string | null>(null);
```

On `justCompleted && settings.lastGeneratedPrompt === null`:

1. Load wizard state.
2. Build prompt.
3. Put prompt in local state immediately.
4. Call `saveGeneratedPrompt(db, prompt)` in an effect. The copy button should not depend on the write finishing.

Copy button:

```ts
async function handleCopy() {
  if (!prompt) return;
  try {
    await navigator.clipboard.writeText(prompt);
    setCopyState("copied");
  } catch {
    setCopyState("blocked");
    setPromptExpanded(true);
  }
}
```

Open GPT:

```tsx
<a href={GPT_URL} target="_blank" rel="noopener noreferrer">Open GPT</a>
```

No `window.open`, no popup-blocker inference.

### Activation Measurement

Do not add remote analytics. Use two levels of measurement:

1. Automated E2E stopwatch: cold install to first logged set must pass comfortably under 60 seconds in Chromium on CI. Use this as a smoke signal, not product analytics.
2. Manual QA checklist: record iPhone Safari/PWA and Android Chrome stopwatch time in the PR body.

If future product telemetry is desired, add local-only settings fields in a separate sprint. Sprint 1 should not expand the Dexie schema solely for metrics.

## Subagent Implementation Strategy

Use one integration lead and four workers. Workers are not alone in the codebase; they must not revert edits by other workers and must keep changes within their assigned write sets. The lead owns shared files that would otherwise create conflicts.

### Lead: Branch, Baseline, Integration, Final Gate

Owns:

- Branch creation.
- This plan as source of truth.
- Assignment sequencing.
- Final conflict resolution.
- Final test gate.

Write set:

- None during worker implementation unless resolving integration.

Commands:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git status --short
cd web
npm test
npm run lint
npm run typecheck
npm run build
```

### Worker A: Route Layout And Onboarding Resume Semantics

Owns:

- `web/src/app/App.tsx`
- `web/tests/unit/app/AppRoutes.test.tsx`
- `web/src/features/onboarding/QuestionnaireScreen.tsx`
- `web/src/features/onboarding/components/WizardShell.tsx`
- `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
- `web/tests/e2e/onboarding-a11y.e2e.ts`
- `web/tests/e2e/onboarding-skip.e2e.ts`
- `web/tests/e2e/onboarding-first-run.e2e.ts` only for nav-absence assertions

Tasks:

- Split app and onboarding layouts.
- Ensure bottom nav is absent from onboarding routes and present on app routes.
- Clarify first-run guard booleans.
- Keep questionnaire route accessible from Settings for skipped/completed users.
- Make questionnaire exit preserve saved sessionStorage state.
- Update tests.

Do not edit:

- Handoff screen internals.
- Today hero copy.
- Welcome screen content.

### Worker B: First-Run Starter Choice

Owns:

- `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`
- `web/src/features/onboarding/components/StarterRoutineSummary.tsx` (new)
- `web/src/features/today/lib/routineSummary.ts` (new)
- `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`
- `web/tests/unit/features/today/lib/routineSummary.test.ts`

Tasks:

- Replace name-first welcome with starter-ready first-run choice.
- Reuse active starter routine seeded by `useAppInit`.
- Add optional name field.
- Add "Use starter routine" path: save name if present, mark skipped, navigate `/`.
- Add "Build personalized routine" path: save name if present, navigate `/onboarding/questionnaire`.
- Add "Continue personalized routine" when `loadWizardState()` returns progress.
- Add explicit "Start over" action that clears saved wizard progress.
- Preserve accessibility and focus behavior.

Do not edit:

- `App.tsx`.
- `HandoffScreen.tsx`.
- Today screen integration.

### Worker C: iPhone-Safe GPT Handoff And Recovery

Owns:

- `web/src/features/onboarding/HandoffScreen.tsx`
- `web/src/features/onboarding/components/LastPromptCard.tsx`
- `web/src/features/today/OnboardingBanner.tsx`
- `web/tests/unit/features/onboarding/HandoffScreen.test.tsx`
- `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`
- `web/tests/unit/features/today/OnboardingBanner.test.tsx`
- `web/tests/e2e/helpers/onboarding-helpers.ts`
- `web/tests/e2e/onboarding-banner-recovery.e2e.ts`

Tasks:

- Remove `window.open`.
- Add anchor-based Open GPT.
- Make saved prompt visible on every handoff/recovery state.
- Make copy failure expand prompt and show inline manual-copy instructions.
- Ensure Today banner and LastPromptCard route to the unified recovery screen.
- Make import blocked by active session visible inline, not toast-only.
- Update tests to include clipboard reject and missing clipboard cases.

Do not edit:

- `App.tsx` route structure.
- `TodayScreen.tsx` hero content.

### Worker D: Today Active Routine Context

Owns:

- `web/src/features/today/TodayScreen.tsx`
- `web/src/features/today/TodayHeroCard.tsx`
- `web/src/features/today/LastSessionCard.tsx` only if needed for spacing consistency
- `web/tests/unit/features/today/TodayScreen.test.tsx`
- `web/tests/unit/features/today/TodayHeroCard.test.tsx`

Tasks:

- Add active routine name/context to Today hero.
- Add routine name to active-session resume card.
- Keep start CTA unchanged in behavior.
- Use shared `routineSummary` helper from Worker B.

Do not edit:

- `OnboardingWelcomeScreen.tsx`.
- `HandoffScreen.tsx`.

### Worker E: Trust Regression Lock Suite

Owns:

- `web/tests/unit/shared/lib/formatLoggedSet.test.ts`
- `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`
- `web/tests/unit/services/backup-service.test.ts`
- `web/tests/unit/services/progression-service.test.ts`
- `web/tests/unit/features/workout/set-log-validation.test.ts`
- `web/tests/e2e/session-detail-non-weight.spec.ts`
- `web/tests/e2e/cardio-extra-distance.spec.ts`

Tasks:

- Audit existing regression coverage.
- Add only missing tests.
- Do not change production code unless a missing regression test reveals an actual bug. If it does, stop and report to the lead.

Target checks:

- Non-weight history rendering, including cardio duration+distance.
- Strict backup validation of malformed set blocks/settings/onboarding fields.
- Duplicate logged-set slot rejection.
- loggedSets.sessionId must match parent sessionExercise.sessionId.
- Progression fallback ambiguity remains blocked.
- Cardio extra distance-only path remains valid.
- Exercise history link remains reachable.

## Implementation Tasks

### Task 0: Baseline And Branch

Lead only.

- [ ] Verify worktree state. Do not revert unrelated changes.
- [ ] Create branch `sprint-1/first-run-activation`.
- [ ] Run baseline:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
npm run lint
npm run typecheck
npm run build
```

- [ ] Capture test counts in the PR notes.

### Task 1: Route Layout Split

Worker A.

Tests first:

- [ ] Extend `AppRoutes.test.tsx`:
  - `/onboarding` has no `navigation` role named "Main navigation".
  - `/onboarding/questionnaire` has no bottom nav.
  - `/onboarding/handoff` has no bottom nav when a saved prompt exists.
  - `/`, `/workout`, `/history`, `/settings` still have bottom nav.
  - skipped/completed users can navigate directly to `/onboarding/questionnaire` from Settings relaunch.
- [ ] Extend `QuestionnaireScreen.test.tsx`:
  - close/exit preserves `STORAGE_KEY`.
  - Start over or restart path, if added here, clears `STORAGE_KEY` explicitly.

Implementation:

- [ ] Extract `BottomNav`.
- [ ] Rename existing `Shell` to `AppShell`.
- [ ] Add `OnboardingLayout`.
- [ ] Split route tree.
- [ ] Keep `Toaster` and `SWUpdatePrompt` unchanged.
- [ ] Change `QuestionnaireScreen.onClose` to preserve sessionStorage.
- [ ] Update `WizardShell` exit-dialog copy to make the preservation explicit.

Verification:

```bash
npm test -- tests/unit/app/AppRoutes.test.tsx
npm run test:e2e -- onboarding-skip
```

Commit:

```bash
git commit -m "feat(app): render onboarding routes without bottom nav"
```

### Task 2: Starter-Ready First-Run Screen

Worker B.

Tests first:

- [ ] `routineSummary.test.ts`:
  - counts exercises and sets for single exercises and supersets.
  - resolves first exercise name from catalog.
  - handles missing catalog name by falling back to exercise id.
- [ ] `OnboardingWelcomeScreen.test.tsx`:
  - shows starter routine name and next day value.
  - "Use starter routine" marks skipped and navigates home.
  - "Build personalized routine" saves optional name and navigates to questionnaire.
  - saved wizard state shows "Continue personalized routine".
  - Start over clears saved wizard state before starting a new questionnaire.
  - screen works when routine is still loading.

Implementation:

- [ ] Add pure summary helper.
- [ ] Add `StarterRoutineSummary` component.
- [ ] Refactor `OnboardingWelcomeScreen` to starter-first copy.
- [ ] Keep optional name input.
- [ ] Keep "Maybe later" only if copy clearly maps it to "Use starter routine"; preferred label is "Use starter routine".

Verification:

```bash
npm test -- tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx
npm test -- tests/unit/features/today/lib/routineSummary.test.ts
```

Commit:

```bash
git commit -m "feat(onboarding): show starter routine choice on first run"
```

### Task 3: iPhone-Safe Handoff

Worker C.

Tests first:

- [ ] Update `HandoffScreen.test.tsx`:
  - just-completed route builds and displays prompt.
  - saved-prompt route displays prompt, copy button, Open GPT anchor, and YAML form.
  - copy success calls `navigator.clipboard.writeText(prompt)`.
  - copy failure keeps the prompt visible and shows manual-copy inline text.
  - missing `navigator.clipboard` keeps the prompt visible and shows manual-copy inline text.
  - `window.open` is not called.
  - import success clears prompt, clears wizard state, marks completed, and routes home.
  - active-session import block appears inline and preserves prompt.
- [ ] Update `LastPromptCard.test.tsx`:
  - copy failure expands prompt.
  - Paste YAML routes to unified handoff with saved prompt visible.
- [ ] Update `OnboardingBanner.test.tsx`:
  - clicking banner routes to unified handoff.

Implementation:

- [ ] Refactor `HandoffScreen` to prompt-plus-import model.
- [ ] Remove `popupBlocked` and all `window.open`.
- [ ] Add `Open GPT` anchor.
- [ ] Ensure prompt generation/saving happens before copy action but not inside copy handler.
- [ ] Make import errors inline through `YamlErrorList` or a small error block.
- [ ] Align `LastPromptCard` and `OnboardingBanner` copy with the new recovery model.

Verification:

```bash
npm test -- tests/unit/features/onboarding/HandoffScreen.test.tsx
npm test -- tests/unit/features/onboarding/LastPromptCard.test.tsx
npm test -- tests/unit/features/today/OnboardingBanner.test.tsx
```

Commit:

```bash
git commit -m "fix(onboarding): make GPT handoff recoverable on iPhone"
```

### Task 4: Today Active Routine Context

Worker D.

Tests first:

- [ ] `TodayHeroCard.test.tsx`:
  - renders active routine name.
  - preserves day title and CTA.
- [ ] `TodayScreen.test.tsx`:
  - active routine name appears on normal Today state.
  - resume card shows routine snapshot and day label.
  - starter context is visible without visiting Settings.

Implementation:

- [ ] Add `routineName` or `routineContext` prop to `TodayHeroCard`.
- [ ] Pass `routine.name` from `TodayScreen`.
- [ ] Add routine snapshot to resume card.
- [ ] Keep day selector behavior unchanged.

Verification:

```bash
npm test -- tests/unit/features/today/TodayHeroCard.test.tsx
npm test -- tests/unit/features/today/TodayScreen.test.tsx
```

Commit:

```bash
git commit -m "feat(today): show active routine context"
```

### Task 5: Trust Regression Locks

Worker E.

Audit first:

- [ ] Search existing tests before adding new ones.
- [ ] Add missing assertions only.

Required checks:

- [ ] `formatLoggedSet` handles:
  - weight plus reps.
  - reps only.
  - duration only.
  - distance only.
  - duration plus distance cardio. If production currently drops distance in this case, stop and report.
  - truly empty fallback.
- [ ] `SessionDetailExerciseCard` has no dash for reps/duration/distance values.
- [ ] `backup-service` rejects malformed persisted shapes.
- [ ] `progression-service` fallback ambiguity remains blocked.
- [ ] cardio extra distance-only E2E still passes.
- [ ] exercise history link remains reachable.

Verification:

```bash
npm test -- tests/unit/shared/lib/formatLoggedSet.test.ts
npm test -- tests/unit/features/history/SessionDetailExerciseCard.test.tsx
npm test -- tests/unit/services/backup-service.test.ts
npm test -- tests/unit/services/progression-service.test.ts
npm run test:e2e -- session-detail-non-weight cardio-extra-distance exercise-history-link
```

Commit:

```bash
git commit -m "test: lock Sprint 1 trust regressions"
```

### Task 6: E2E Activation Path

Lead or Worker A after integration.

Tests:

- [ ] Update or add `web/tests/e2e/onboarding-starter-first-set.e2e.ts`.
- [ ] Scenario:
  1. Reset app state.
  2. Navigate to `/`.
  3. Assert full-screen onboarding with no bottom nav.
  4. Assert starter routine summary visible.
  5. Click "Use starter routine".
  6. Assert Today active routine context.
  7. Start workout.
  8. Log first set with keypad.
  9. Assert set row logged.
  10. Measure wall-clock elapsed from first page goto to logged set. Assert under 60 seconds with a generous timeout note.

The assertion should be stable. If CI timing is too noisy, assert the number of user actions and print elapsed time instead; keep the under-60 target in manual QA.

Verification:

```bash
npm run test:e2e -- onboarding-starter-first-set
```

Commit:

```bash
git commit -m "test(e2e): cold install to first logged starter set"
```

### Task 7: Integration Gate

Lead only.

- [ ] Rebase or merge worker branches in this order:
  1. Worker A route layout.
  2. Worker B starter choice.
  3. Worker C handoff.
  4. Worker D Today context.
  5. Worker E regression tests.
  6. E2E activation path.
- [ ] Resolve import/test conflicts.
- [ ] Run full gates:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

- [ ] Run manual dev-server walkthrough:

```bash
npm run dev
```

Manual paths:

- [ ] Cold install -> Use starter routine -> Today -> Start workout -> log first set.
- [ ] Cold install -> Build personalized routine -> Handoff -> copy blocked simulation -> manual prompt visible.
- [ ] Saved prompt recovery from Today banner.
- [ ] Saved prompt recovery from Settings.
- [ ] iPhone Safari/PWA manual check if device is available.

Commit:

```bash
git commit -m "test: complete Sprint 1 activation gate"
```

## Acceptance Criteria

- [ ] Bottom nav absent on all onboarding routes.
- [ ] Bottom nav present on app routes.
- [ ] First-run screen shows starter routine value before asking the user to do work.
- [ ] "Use starter routine" reaches Today with active routine context.
- [ ] "Build personalized routine" reaches questionnaire.
- [ ] Mid-wizard reload resumes prior answers.
- [ ] Exiting the wizard preserves state; Start over is the explicit destructive path.
- [ ] Handoff screen never depends on JS `window.open`.
- [ ] Handoff screen always exposes the saved prompt when YAML import is pending.
- [ ] Clipboard failure has an inline recovery state.
- [ ] Today shows active routine context.
- [ ] Starter first-set E2E path exists.
- [ ] Trust regression checks pass.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` pass.

## PR Description Template

```markdown
## Summary

Sprint 1: First-Run Activation.

- Full-screen onboarding with no bottom nav.
- Starter-routine first-run choice.
- iPhone-safe GPT handoff: copy and Open GPT are separate, prompt is always recoverable, no JS popup dependency.
- Today now shows active routine context.
- Regression locks for recent trust fixes.

## Product Flow

- Cold install -> Use starter routine -> Today -> Start workout -> first set.
- Cold install -> Build personalized routine -> GPT handoff -> YAML import.
- Saved prompt recovery from Today and Settings.

## Verification

- [ ] npm test
- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm run build
- [ ] npm run test:e2e
- [ ] Manual iPhone Safari/PWA handoff check
- [ ] Manual Android Chrome handoff check

## Notes

No new runtime dependencies. No remote telemetry. No server/account changes.
```

## Known Risks

### Clipboard API Still Can Fail

Even with a direct copy button, iOS can deny clipboard access. The product must not depend on clipboard success. Manual prompt visibility is the real fallback.

### Anchor Behavior In Installed PWAs

Opening ChatGPT from an installed PWA may switch browser contexts differently across iOS and Android. A plain anchor is still more reliable and explainable than `window.open`.

### Route Guard Races

The existing app uses Dexie live queries; after writes, settings may propagate asynchronously. Tests should wait for visible route content rather than immediate URL assumptions.

### Shared Helper Merge Conflicts

Worker B creates `routineSummary.ts`; Worker D consumes it. Merge Worker B before Worker D.

### E2E Under-60 Timing

CI performance can vary. If the stopwatch assertion flakes, keep the E2E behavior path and move the exact under-60 threshold to manual QA notes.

## Handoff Prompts For Workers

### Worker A Prompt

Implement Task 1 from `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. You own `web/src/app/App.tsx`, `web/tests/unit/app/AppRoutes.test.tsx`, and onboarding E2E nav-absence assertions. You are not alone in the codebase; do not revert edits outside your ownership. Split onboarding routes into a nav-free layout. Add tests first.

### Worker B Prompt

Implement Task 2 from `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. You own the first-run starter choice screen and the pure routine summary helper. Do not edit `App.tsx`, `HandoffScreen.tsx`, or Today integration. Add tests first.

### Worker C Prompt

Implement Task 3 from `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. You own the GPT handoff/recovery surfaces. Remove `window.open`, use an anchor for GPT, and make the saved prompt always recoverable. You are not alone in the codebase; do not revert edits outside your ownership. Add tests first.

### Worker D Prompt

Implement Task 4 from `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. You own Today active routine context. Consume the routine summary helper after Worker B lands. Do not edit onboarding or handoff internals. Add tests first.

### Worker E Prompt

Implement Task 5 from `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. You own regression tests only. Audit existing coverage first and add missing tests. If a test reveals a production bug, stop and report instead of making a broad fix.

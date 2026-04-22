# Onboarding Feature

Routes (Sprint C): `/onboarding`, `/onboarding/questionnaire`, `/onboarding/handoff` (Sprint D). First-run gate lives in `App.tsx`'s `AppRoutes` (Sprint D).

## Module shape

```
features/onboarding/
  CLAUDE.md                    # this file
  lib/
    types.ts                   # Answer / Answers / StepId — Sprint A
    prompt-builder.ts          # pure buildPrompt(answers) — Sprint A
    questionnaire-state.ts     # pure reducer + WizardState/WizardAction — Sprint B
    session-storage.ts         # silent-fail sessionStorage helpers — Sprint B
  components/
    WizardShell.tsx            # chrome, progress bar, close confirm, heading focus
    ChipRow.tsx                # single-select chips (radiogroup when ≤5 options)
    ChipMulti.tsx              # multi-select chips with optional exclusive value
    ChipWithDescription.tsx    # vertical single-select with secondary descriptions
    StepTextArea.tsx           # textarea + optional skip chip + character counter
  OnboardingWelcomeScreen.tsx    # route /onboarding
  QuestionnaireScreen.tsx        # route /onboarding/questionnaire (orchestrator)
  steps/
    GoalStep.tsx                 # step 1 — chip-with-other for "Something else…"
    ExperienceStep.tsx           # step 2
    RestrictionsStep.tsx         # step 3 — StepTextArea + skip chip
    DaysPerWeekStep.tsx          # step 4
    SessionLengthStep.tsx        # step 5
    DistinctDaysStep.tsx         # step 6 — numbers-only chips (D10)
    EquipmentStep.tsx            # step 7 — ChipMulti with Bodyweight-only exclusivity
    PrioritiesStep.tsx           # step 8 — multi-select + standalone skip chip
    FavoritesAvoidStep.tsx       # step 9 — two stacked StepTextAreas
    SupersetsStep.tsx            # step 10 — value/label divergence for "No"
    CardioStep.tsx               # step 11 — value/label divergence for "No cardio"
  HandoffScreen.tsx              # route /onboarding/handoff (Stage 1 / Stage 2 state machine)
  components/LastPromptCard.tsx  # Settings card when lastGeneratedPrompt !== null
```

## Invariants

- **Reducer is pure.** `questionnaire-state.ts` imports only from `./types` and has no clock, no RNG, no storage. The orchestrator binds side effects via `useEffect`.
- **sessionStorage is silent-fail.** `session-storage.ts` swallows every exception — private browsing, quota, missing sessionStorage — and degrades gracefully to "no resume."
- **Exclusivity lives in `ChipMulti`.** The reducer stores whatever values array it receives; the mutual-exclusion rule for "Bodyweight only" is enforced inside `ChipMulti.nextFor`.
- **Prompt co-ships with the GPT instructions.** `prompt-builder.ts` and `docs/custom-gpt/workout-routine-gpt.instructions.md` must be updated in the same commit when the intake topics or lead-in text change.

## Routes owned by this feature

| Route | Component | Sprint |
|---|---|---|
| `/onboarding` | `OnboardingWelcomeScreen` | C |
| `/onboarding/questionnaire` | `QuestionnaireScreen` | C |
| `/onboarding/handoff` | `HandoffScreen` | D |

## Services the feature consumes (Sprint C/D)

- `setUserName` from `@/services/settings-service` (welcome screen).
- `markOnboardingCompleted`, `markOnboardingSkipped`, `saveGeneratedPrompt`, `clearLastPrompt`, `dismissOnboardingBanner` from `@/services/onboarding-service`.
- `buildPrompt` from `./lib/prompt-builder` (HandoffScreen Stage 1).
- `importAndActivateRoutine`, `validateAndNormalizeRoutine` from `@/services/routine-service` (HandoffScreen Stage 2).

## Shared primitives reused

- `ConfirmDialog` from `@/shared/components/ConfirmDialog` — wizard exit confirm, "Start over" confirm.
- `Button`, `Textarea` from `@/shared/ui/*`.
- `cn()` from `@/shared/lib/utils` for conditional class composition.
- `GPT_URL` from `@/shared/lib/gpt-url` (HandoffScreen window.open target).

## First-run gate

Wired in `@/app/App.tsx:AppRoutes`. Three guards:

1. `/` with `onboardingCompletedAt === null && onboardingSkippedAt === null` → redirect to `/onboarding`.
2. `/onboarding` with `onboardingCompletedAt !== null` → redirect to `/`.
3. `/onboarding/handoff` with `lastGeneratedPrompt === null` AND no `location.state.justCompleted === true` → redirect to `/onboarding/questionnaire`.

The `HandoffScreen` component has a defensive `useEffect` redirect that matches guard 3 — it's a no-op once `AppRoutes` short-circuits first, but keeps the screen correct in isolation (e.g., in component tests). That effect also short-circuits when `onboardingCompletedAt !== null`, so a successful Stage-2 import does not bounce back to the questionnaire during the brief re-render window between the settings write and the navigation.

## Design tokens

All tokens pre-exist in `web/src/app/App.css`. This feature uses:
`--radius-pill`, `--radius-card`, `--sage`, `--sage-soft`, `--line`, `--line-soft`, `--ink`, `--ink-2`, `--ink-3`, `--paper`, plus the `text-hero-serif`, `text-eyebrow`, `text-meta` typography utilities. No new tokens or utilities are introduced.

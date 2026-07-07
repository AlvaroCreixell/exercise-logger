# Onboarding Feature

Routes: `/onboarding`, `/onboarding/questionnaire`, `/onboarding/generate`. First-run gate lives in `App.tsx`'s `AppRoutes`. The custom-GPT copy/paste flow (`HandoffScreen`, saved-prompt lifecycle) was removed in favor of in-app generation — see `docs/custom-gpt/DEPRECATED.md`.

## Module shape

```
features/onboarding/
  CLAUDE.md                    # this file
  lib/
    types.ts                   # Answer / Answers / StepId
    prompt-builder.ts          # pure buildPrompt(answers) — user-prompt half of generation
    questionnaire-state.ts     # pure reducer + WizardState/WizardAction
    session-storage.ts         # silent-fail sessionStorage helpers
  components/
    WizardShell.tsx             # chrome, progress bar, close confirm, heading focus
    ChipRow.tsx                 # single-select chips (radiogroup when ≤5 options)
    ChipMulti.tsx                # multi-select chips with optional exclusive value
    ChipWithDescription.tsx     # vertical single-select with secondary descriptions
    StepTextArea.tsx             # textarea + optional skip chip + character counter
    StarterRoutineSummary.tsx   # welcome-screen preview of the bundled starter routine
    RoutinePreview.tsx           # generation-screen preview of a freshly generated Routine
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
  GenerationScreen.tsx           # route /onboarding/generate (LLM call, preview, accept)
```

## Invariants

- **Reducer is pure.** `questionnaire-state.ts` imports only from `./types` and has no clock, no RNG, no storage. The orchestrator binds side effects via `useEffect`.
- **sessionStorage is silent-fail.** `session-storage.ts` swallows every exception — private browsing, quota, missing sessionStorage — and degrades gracefully to "no resume."
- **Exclusivity lives in `ChipMulti`.** The reducer stores whatever values array it receives; the mutual-exclusion rule for "Bodyweight only" is enforced inside `ChipMulti.nextFor`.
- **The user prompt co-ships with the system prompt.** `prompt-builder.ts` (`buildPrompt(answers)`, the user-turn half of a generation request) and `@/services/llm/system-prompt.ts` (`buildSystemPrompt(exercises)`, the system-turn half) must be updated together when the intake topics, their renderings, or the lead-in/trailing text change — they are read together by `generation-service.generateRoutine`.

## Routes owned by this feature

| Route | Component | Notes |
|---|---|---|
| `/onboarding` | `OnboardingWelcomeScreen` | Name capture, starter-routine preview, entry point |
| `/onboarding/questionnaire` | `QuestionnaireScreen` | 11-step wizard orchestrator |
| `/onboarding/generate` | `GenerationScreen` | LLM call → preview → accept/regenerate |

## Services the feature consumes

- `setUserName` from `@/services/settings-service` (welcome screen).
- `markOnboardingCompleted`, `markOnboardingSkipped`, `dismissOnboardingBanner` from `@/services/onboarding-service`.
- `buildPrompt` from `./lib/prompt-builder` — consumed indirectly via `generateRoutine` (see below), not called directly by any screen.
- `generateRoutine` from `@/services/generation-service` (GenerationScreen — the LLM round trip + validation + repair loop).
- `createAnthropicProvider` from `@/services/llm/anthropic-provider` (GenerationScreen — builds the `LlmProvider` from the saved/just-entered API key).
- `setLlmApiKey` from `@/services/settings-service` (GenerationScreen's inline "no key yet" form).
- `importAndActivateRoutine` from `@/services/routine-service` (GenerationScreen — accepting the previewed routine).

## Shared primitives reused

- `ConfirmDialog` from `@/shared/components/ConfirmDialog` — wizard exit confirm, welcome-screen "Start over" confirm.
- `Button`, `Input`, `Card` from `@/shared/ui/*`.
- `cn()` from `@/shared/lib/utils` for conditional class composition.
- `YamlErrorList` from `@/features/settings/YamlErrorList` — reused by `GenerationScreen`'s `"validation"` failure view to render the same `ValidationError[]` shape the manual YAML importer shows.

## First-run gate

Wired in `@/app/App.tsx:AppRoutes`. Two guards (a third, the `/onboarding/handoff` guard, was removed along with `HandoffScreen`):

1. `/` with `onboardingCompletedAt === null && onboardingSkippedAt === null` → redirect to `/onboarding`.
2. `/onboarding` with `onboardingCompletedAt !== null || onboardingSkippedAt !== null` → redirect to `/`.

There is no route-level guard on `/onboarding/generate`. `GenerationScreen` self-redirects instead: its mount effect checks `loadWizardState()` and navigates to `/onboarding/questionnaire` (`replace: true`) if no wizard state exists (or answers are empty) — so visiting `/onboarding/generate` directly, or after "Start over" cleared sessionStorage, bounces back to the questionnaire rather than 404ing or rendering blank.

## Generation flow

Wizard state in `sessionStorage` (`lib/session-storage.ts`, key `exercise-logger:onboarding:in-progress`) is the single recovery source — there is no persisted "last prompt" anywhere in the database anymore. The Today onboarding banner (`@/features/today/OnboardingBanner.tsx`) keys off the same wizard state existing (`loadWizardState() !== null`), not off a saved-prompt field.

1. **Answering.** `QuestionnaireScreen` persists `WizardState` (`{ stepIndex, answers }`) to sessionStorage on every state change via a `useEffect`. Reaching "Next" on the last step (index 10) navigates to `/onboarding/generate` — it does not clear wizard state.
2. **Generating.** `GenerationScreen` is a small state machine over `Phase` (`"boot" | "generating" | "preview" | "error"`). On mount, once `settings` resolves: if there's no wizard state, redirect to the questionnaire; if `settings.llmApiKey === ""`, render an inline API-key form instead of auto-generating; otherwise call `generateRoutine(db, wizard.answers, createAnthropicProvider(apiKey))` exactly once (guarded by a `useRef`, StrictMode-safe). A successful key entry (`handleSaveKey`) or a manual retry (`handleRetry`) can also (re-)trigger generation.
3. **Previewing.** On success, `phase` becomes `{ name: "preview", routine }` and renders `<RoutinePreview>` (days, set blocks, cardio, notes) with "Use this routine →" and "Regenerate" actions.
4. **Accepting.** `handleAccept` calls `importAndActivateRoutine` (transactional insert + activate, invariant 10). On success it calls `markOnboardingCompleted` **only when `onboardingCompletedAt === null`** (so re-entering generation from Settings after onboarding is already complete doesn't re-stamp it), then `clearWizardState()`, then navigates to `/` — in that order, so a concurrent settings-driven re-check of wizard state can't race the navigation.
5. **Failing.** Any provider error, prompt-build error, or exhausted repair loop lands in `{ name: "error", failure }`. The error copy is keyed by `failure.kind`; a `"validation"` failure additionally renders the final `ValidationError[]` via `YamlErrorList`. Every error state offers "Try again" and a manual-YAML-import escape hatch (`/settings/import`); an `"auth"` failure also links to `/settings`.
6. **Clearing wizard state.** Only two paths clear it: `OnboardingWelcomeScreen`'s "Start over" confirm dialog, and `GenerationScreen.handleAccept` on successful activation. Neither the questionnaire nor the generation screen clears it on exit/error — abandoning either screen returns to a state the user can resume.

## Design tokens

All tokens pre-exist in `web/src/app/App.css`. This feature uses:
`--radius-pill`, `--radius-card`, `--sage`, `--sage-soft`, `--line`, `--line-soft`, `--ink`, `--ink-2`, `--ink-3`, `--paper`, plus the `text-hero-serif`, `text-eyebrow`, `text-meta` typography utilities. No new tokens or utilities are introduced.

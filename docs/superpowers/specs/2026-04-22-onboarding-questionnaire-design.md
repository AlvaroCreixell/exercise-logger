# 2026-04-22 — First-Run Onboarding & Routine-Questionnaire — Design

## Context & Intent

The Custom GPT ("ace-logger-routine-maker") currently asks every new user a
series of intake questions before generating a routine YAML. Users then copy the YAML,
come back to the app, paste it into `RoutineImportScreen`, and activate it.
The friction is concentrated at the handoff: users arrive at the GPT cold,
have to remember what the GPT will ask, and type answers without UI support.

This feature moves the intake phase *into the app*. A sequence of well-designed
wizard screens asks the 11 intake questions with phone-first input controls,
builds a structured prompt, copies it to the clipboard, and opens the GPT. The
user pastes one message instead of 11 answers, receives YAML, switches back,
and pastes — landing on the same screen they left with a paste area already
waiting.

A companion first-run welcome captures the user's name (editable anytime in
Settings) so the Today screen's greeting can read "Hi, *Alvaro*." instead of
just "Hello."

- **Audience:** everyone on first install; existing users via a "Create a
  personalized routine" entry point in Settings.
- **Primary goal:** turn a 10-minute "talk to the GPT" intake into a guided
  2-minute wizard + one-tap handoff.
- **Secondary goal:** give the Today screen a small personalization lift.

## Non-Goals

- Not replacing the Custom GPT — it still generates the YAML. We only replace
  the *intake phase* of the conversation.
- No server-side or networked intake processing. The prompt is built locally
  and copied to the clipboard; the user handles the GPT round-trip themselves.
- No automated return from the GPT tab (no deep links back, no URL query
  params). We rely on the clipboard for the forward hand-off and a paste area
  for the return.
- No persistence of questionnaire answers between runs. Each questionnaire
  launch starts fresh. The *generated prompt* is preserved so the user can
  re-copy without re-answering.
- No analytics / telemetry. Local-first ethos preserved.
- No dark mode, charts, or social features (consistent with existing app
  scope).
- No new exercise-catalog entries or routine-schema changes.

## Decisions Locked During Brainstorming

| # | Decision | Rationale |
|---|---|---|
| D1 | **Soft first-run gate.** New users see a welcome + name prompt; questionnaire is offered but skippable. | Keeps the app low-friction; questionnaire surfaces when the user is ready. |
| D2 | **Questionnaire always re-runnable from Settings.** | Handles the "I want a new routine next month" case without forcing the user to reset the app. |
| D3 | **Existing users silently marked onboarded.** | Zero disruption to current testers. |
| D4 | **Answers NOT persisted between runs.** Each questionnaire starts fresh. | No stale-data ghost from 6 months ago; simpler schema. |
| D5 | **Generated prompt IS persisted (`lastGeneratedPrompt`).** | Lets the user re-copy from Settings without re-answering. |
| D6 | **One-at-a-time wizard (Option A).** | Polish per step, hard to overwhelm, animates well. |
| D7 | **Auto-advance on single-select chips.** Back button is the safety net. | Saves 6+ taps across the wizard. |
| D8 | **Combined "Copy prompt & open GPT" button with finale Stage 2 paste area on the same screen.** | Single-tap handoff; user lands back on the paste area when they switch tabs. |
| D9 | **Today banner recovers users who close the app mid-flow.** | "Finish importing your routine →" links to Stage 2. |
| D10 | **Step 6 ("distinct training days") captures only the number.** Examples (Push/Pull/Legs, Upper/Lower) appear as UI teaching aids only; they do NOT leak into the prompt. | Prevents the GPT from over-constraining on what was meant as an example. |
| D11 | **Design language strictly inherits from `docs/archive/claude-design-handoffs/2026-04-21/`:** paper+sage palette, Instrument Serif for hero headlines only, Inter for chrome, 18px card radius, 999px chip pills, hairlines not shadows. | Cohesion with existing screens; no new visual vocabulary. |
| D12 | **sessionStorage-based mid-wizard resume.** Reload during the wizard restores state; explicit exit clears it. | Robust without schema changes. |

## Architecture & Data Model

### Feature module

New module at `web/src/features/onboarding/`, same layered style as existing
features:

```
web/src/features/onboarding/
  CLAUDE.md                    # feature guide
  OnboardingWelcomeScreen.tsx  # route /onboarding — name + "Start" / "Maybe later"
  QuestionnaireScreen.tsx      # route /onboarding/questionnaire — wizard host
  HandoffScreen.tsx            # route /onboarding/handoff — stage 1 → stage 2
  steps/
    GoalStep.tsx
    ExperienceStep.tsx
    RestrictionsStep.tsx
    DaysPerWeekStep.tsx
    SessionLengthStep.tsx
    DistinctDaysStep.tsx
    EquipmentStep.tsx
    PrioritiesStep.tsx
    FavoritesAvoidStep.tsx
    SupersetsStep.tsx
    CardioStep.tsx
  lib/
    questionnaire-state.ts     # Answer types, reducer, step order
    prompt-builder.ts          # pure function: answers → prompt string
    session-storage.ts         # save/restore in-progress answers
  components/
    WizardShell.tsx            # progress bar, Back/Next footer, close dialog
    ChipRow.tsx                # single-select with auto-advance
    ChipMulti.tsx              # multi-select with "bodyweight-only" rule
    ChipWithDescription.tsx    # chip + secondary description line
    StepTextArea.tsx           # multi-line + Skip chip
    LastPromptCard.tsx         # shown in Settings when a prompt is saved
```

### Routes added to `App.tsx`

- `/onboarding` — `OnboardingWelcomeScreen`
- `/onboarding/questionnaire` — `QuestionnaireScreen`
- `/onboarding/handoff` — `HandoffScreen`

### First-run gate

Implemented in `AppRoutes` using the reactive `useSettings` hook:

```ts
if (
  location.pathname === "/" &&
  settings.onboardingCompletedAt == null &&
  settings.onboardingSkippedAt == null
) {
  return <Navigate to="/onboarding" replace />;
}
```

Accessible from `/settings` → "Create a personalized routine" at any time,
regardless of gate state.

### Dexie schema v3 (additive migration)

```ts
this.version(3).stores({ /* identical indexes to v2 */ })
  .upgrade(async (trans) => {
    const existing = await trans.table("settings").get("user");
    if (existing) {
      await trans.table("settings").update("user", {
        userName: null,
        onboardingCompletedAt: null,
        onboardingSkippedAt: new Date().toISOString(),
        lastGeneratedPrompt: null,
        lastGeneratedPromptAt: null,
        onboardingBannerDismissedAt: null,
      });
    }
  });
```

`Settings` interface gains six nullable fields:

```ts
interface Settings {
  id: "user";
  activeRoutineId: string | null;
  units: UnitSystem;
  // NEW:
  userName: string | null;
  onboardingCompletedAt: string | null;     // ISO timestamp
  onboardingSkippedAt: string | null;       // ISO timestamp
  lastGeneratedPrompt: string | null;
  lastGeneratedPromptAt: string | null;     // ISO timestamp
  onboardingBannerDismissedAt: string | null;
}
```

`DEFAULT_SETTINGS` extends with all six fields defaulting to `null`.

## Questionnaire UX

### Wizard chrome

Reused on every step. Applies the handoff design tokens.

- **Top bar:** thin sage progress bar (`--sage`, 2px) spanning step-count. `×`
  close button on the right. `role="progressbar"` with `aria-valuenow`,
  `aria-valuemin=1`, `aria-valuemax=11`.
- **Eyebrow:** 11px Inter 600 uppercase 0.08em tracking. Format: `STEP N OF 11
  · CATEGORY` (Schedule / Equipment / Preferences / etc.). The wizard has 11
  questions, one per GPT intake topic. The welcome/name screen at
  `/onboarding` and the handoff screen are not numbered into this count.
- **Hero:** 32px Instrument Serif 400 italic. The question headline.
- **Subtitle:** 14px Inter 400 `--ink-2`. Explanatory text.
- **Input zone:** chips, multi-select, or text area per step.
- **Footer:** `Back` (ghost) left, `Next` (dark ink primary) right.
  Single-select steps with auto-advance render only `Back`.

### Welcome screen (`/onboarding`)

The welcome screen is its own route, rendered by `OnboardingWelcomeScreen` —
not part of the 11-step wizard chrome. Two explicit actions:

- **Start** — trims the name input; if non-empty, saves it via
  `setUserName(db, name)`. Navigates to `/onboarding/questionnaire` step 0.
  Does NOT set `onboardingSkippedAt` or `onboardingCompletedAt`. Completion
  happens only after a successful YAML import on Stage 2.
- **Maybe later** — does NOT save the name. Sets
  `onboardingSkippedAt = nowISO()` and navigates to `/`. The user lands on
  Today with the default "Hello." greeting and the pre-seeded starter
  routine still active.

The name input is autofocused on mount (`ref.current?.focus()` inside a
`useEffect` with empty deps). Enter submits Start, not Maybe later.
`maxLength={40}` caps length to prevent Today-greeting overflow.

Later edits via Settings → Profile → "Your name" only write `userName`; they
do not touch `onboardingCompletedAt` or `onboardingSkippedAt`.

### Step copy (final)

| # | Category | Title | Input | Notes |
|---|---|---|---|---|
| 0 | Welcome | "What should we call you?" | Text input | Separate route `/onboarding`. Skippable via "Maybe later". |
| 1 | About you | "What's your main goal?" | 5 chips + "Something else…" | Build muscle / Build strength / Lose fat / Conditioning / General fitness / Other → text. Auto-advance. |
| 2 | About you | "How experienced are you with lifting?" | 3 chips with description | Beginner / Intermediate / Advanced — each with a secondary description line (concrete anchor like "6+ months"). Auto-advance. |
| 3 | About you | "Anything we should work around?" | Text area + "All clear — skip" chip | Optional. |
| 4 | Schedule | "How many days a week can you train?" | 5 chips: 2 / 3 / 4 / 5 / 6 | Auto-advance. |
| 5 | Schedule | "How long is a typical session?" | 5 chips: 30/45/60/75/90 min | Auto-advance. |
| 6 | Schedule | "How many different workouts do you want in your rotation?" | 5 chips: 1 / 2 / 3 / 4 / 5 | Examples in **subtitle only** — explicitly "for reference only", not prescriptive. Auto-advance. |
| 7 | Equipment | "What equipment do you have access to?" | Multi-select chips | Barbell / Dumbbells / Machines / Cables / Kettlebells / Resistance bands / Pull-up bar / Bodyweight only. "Bodyweight only" is mutually exclusive with others. Explicit Next tap. |
| 8 | Preferences | "Any muscle groups to prioritize?" | Multi-select chips + "Keep it balanced — skip" | Chest / Back / Legs / Shoulders / Arms / Core / Glutes. Optional. |
| 9 | Preferences | "Any specific exercises to include or avoid?" | Two stacked text areas (Love / Avoid) | Optional. One screen, two labeled fields. |
| 10 | Preferences | "Are supersets okay?" | 3 chips with description | Yes — use them where they fit / Only if time-crunched / No supersets. Auto-advance. |
| 11 | Preferences | "Include an optional cardio section?" | 2 chips | Yes / No cardio. Auto-advance. |

### Step 6 copy (the disambiguation fix)

- **Title:** "How many different workouts do you want in your rotation?"
- **Subtitle:** "This is about variety, not frequency. **For reference only:**
  full-body = 1, Upper/Lower = 2, Push/Pull/Legs = 3, body-part split = 5.
  Your goals, equipment, and experience will shape the actual split — you
  don't need to prescribe one here."
- **Chips:** `1` · `2` · `3` · `4` · `5` (numbers only).
- **Prompt rendering:** `Distinct training days desired: 3` (no parenthetical).

### State management

```ts
type StepId =
  | "goal" | "experience" | "restrictions"
  | "daysPerWeek" | "sessionLength" | "distinctDays"
  | "equipment" | "priorities" | "favoritesAvoid"
  | "supersets" | "cardio";

type Answer =
  | { kind: "chip"; value: string }
  | { kind: "chip-multi"; values: string[] }
  | { kind: "text"; value: string }
  | { kind: "chip-with-other"; value: string; otherText?: string }
  | { kind: "favorites-avoid"; favorites: string; avoid: string };

type Answers = Partial<Record<StepId, Answer>>;

type WizardState = {
  stepIndex: number;     // 0..10
  answers: Answers;
};

type WizardAction =
  | { type: "answer"; stepId: StepId; answer: Answer }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; to: number }
  | { type: "restart" };
```

Reducer is pure. Lives at `lib/questionnaire-state.ts`. Unit tested.

### Auto-advance rules

- **Single-select chips (goal, experience, daysPerWeek, sessionLength,
  distinctDays, supersets, cardio):** tapping a chip selects it AND advances.
  Back is the safety net for accidental taps.
- **Multi-select chips (equipment, priorities):** tapping toggles; explicit
  Next tap required.
- **Text areas (restrictions, favoritesAvoid):** no auto-advance. Next
  enabled when any text entered OR "Skip" chip tapped.
- **Chip-with-other (goal with "Something else…"):** "Something else…"
  expands a text input without advancing. Next enabled when text is
  non-empty. Any preset chip tap advances normally.

### Mid-wizard resume via sessionStorage

- Key: `exercise-logger:onboarding:in-progress`.
- Value: JSON `{ stepIndex, answers }`.
- Written on every reducer action except `restart`.
- Read on `QuestionnaireScreen` mount. If present and valid, restore.
- Cleared on: successful completion (handoff Stage 1 button tap), explicit
  exit via close dialog, `restart` action.
- sessionStorage unavailable (private browsing edge case): silently continue
  without resume — answers live in React state only.

### Validation & input limits

- Steps 3, 8, 9 are always optional — Next is enabled immediately.
- All other steps require a selection before Next is tappable. Disabled Next
  button (no toast).
- **Name input (welcome screen)**: trimmed on save. `maxLength={40}`.
  Empty-after-trim on "Start" still navigates to the questionnaire but leaves
  `userName` null. See **Welcome screen (`/onboarding`)** above for the full
  button semantics.
- **Restrictions text (step 3)**: `maxLength={300}`. An inline character
  counter below the textarea appears once the user passes 240 chars.
- **Favorites / Avoid text (step 9)**: `maxLength={200}` each, with the same
  counter treatment when approaching the limit.
- **Goal "Something else…" text (step 1)**: `maxLength={60}`, no counter.
- All free-text fields are trimmed and have runs of whitespace/newlines
  collapsed to a single space before reaching `buildPrompt` (see Prompt
  Generation rule 9).

### Accessibility

- Each step's heading receives focus on mount (via `useEffect` +
  `ref.current?.focus()`). Screen readers announce the new question.
- Welcome screen: the name input autofocuses on mount. The "You can change
  this anytime in Settings" hint is linked via `aria-describedby`. Enter
  submits the Start action; Maybe later requires an explicit tap.
- Chips: `<button type="button">` with `aria-pressed` for selection state.
- Single-select steps with ≤ 5 options use native `<input type="radio">`
  instead of buttons for proper radiogroup semantics.
- Progress bar: `role="progressbar"` with `aria-valuemin=1`, `aria-valuemax=11`, `aria-valuenow={stepIndex+1}`.
- Close button: `aria-label="Exit questionnaire"`.
- Focus trap in the close-confirmation dialog (reuse existing `ConfirmDialog`).

## Prompt Generation

### `buildPrompt(answers: Answers): string`

Pure, stateless, lives at `lib/prompt-builder.ts`.

**Full-answers output:**

```
I'd like a personalized workout routine. All 11 intake topics are answered
below — treat this as the complete intake. Do NOT ask follow-up questions.
Proceed directly to the catalog-ID check and YAML generation per your
self-check protocol.

- Primary goal: Build muscle
- Experience level: Intermediate — training regularly for 6+ months, know the main lifts
- Injuries / restrictions: No back squats — tweaked lower back. Shoulders sensitive overhead.
- Days per week available: 3
- Typical session length: 60 minutes
- Distinct training days desired: 3
- Available equipment: Barbell, Dumbbells, Cables, Pull-up bar
- Muscle groups to prioritize: Back, Glutes
- Favorite exercises (include): deadlift, pull-ups
- Exercises to avoid: back squat
- Supersets: Yes — use them where they fit
- Cardio section: Yes — include optional cardio

Please generate the complete routine YAML following the contract exactly.
```

**Formatting rules enforced by `buildPrompt`:**

1. Skipped optional fields are **omitted entirely** — no "N/A", no "Not
   specified".
2. Chip labels render with their secondary descriptions for steps 2 and 10
   (where the description is calibration context, not prescription).
3. Step 6 renders the **number only** — no parenthetical example. This is the
   D10 lock.
4. "Other" text on the goal step becomes the goal value directly.
5. "Bodyweight only" renders as `"Bodyweight only"` (single item, matches chip
   label).
6. Lead-in and trailing lines are fixed. The bullet block matches wizard step
   order.
7. User name is NOT in the prompt — name is UI-only.
8. Empty answers map → throws:
   `Error("Cannot build prompt from empty answers — complete the questionnaire first.")`.
9. Free-text answers (restrictions, favoritesAvoid, goal "other") are
   normalized before insertion: trim outer whitespace, then collapse runs of
   whitespace and newlines to a single space. Empty-after-normalization
   behaves identically to a skipped optional field (rule 1).
10. `buildPrompt` does not enforce max-length — the wizard's text inputs do.
    See **Validation & input limits** above.

### Persistence

Called during `HandoffScreen` Stage 1 button tap, *not* on step-11-Next:

```ts
const prompt = buildPrompt(answers);
await db.settings.update("user", {
  lastGeneratedPrompt: prompt,
  lastGeneratedPromptAt: nowISO(),
  onboardingBannerDismissedAt: null,
});
```

Rationale: completing the last step and then backing out to reconsider
shouldn't persist a prompt. Only the explicit handoff action commits.

## Finale Screen State Machine

`HandoffScreen` has two visual stages driven by `settings.lastGeneratedPrompt`.

### Stage 1 — "Ready to hand off"

Shown when `lastGeneratedPrompt === null` OR user just arrived from Step 11
(local state overrides until the user taps the button).

- Eyebrow `READY`.
- Hero: "Ready to build your routine?" (serif italic).
- Subtitle: "Tap below to copy your prompt and open the routine-maker GPT.
  Paste it there, then switch back here with the YAML."
- Primary button: **Copy prompt & open GPT →**. Handler:
  1. `buildPrompt(answers)`.
  2. `db.settings.update(...)` to persist prompt + timestamp + reset banner
     dismiss.
  3. `await navigator.clipboard.writeText(prompt)` — catch and toast on
     failure, continue.
  4. `window.open(GPT_URL, "_blank", "noopener,noreferrer")`.
  5. Toast: "Prompt copied · GPT opening in a new tab".
  6. `setStage("handoff-complete")` — flips local stage state.
- Secondary: **Show prompt** (expandable monospace block).
- Tertiary: **Start over** (confirms, clears answers + sessionStorage, back
  to `/onboarding/questionnaire` step 0).
- `×` top-right: confirms "Exit? Your answers won't be saved." → Exit /
  Cancel.

### Stage 2 — "Paste your routine"

Shown when:
- Local stage state is `handoff-complete` (just tapped the Stage 1 button), OR
- User arrives at `/onboarding/handoff` and `settings.lastGeneratedPrompt !==
  null`.

- Eyebrow: `YOUR TURN`.
- Hero: "Paste your routine when you're back." (serif italic).
- Subtitle: "When the GPT gives you YAML, copy it and paste it below."
- YAML paste area: monospace textarea.
- **Paste from clipboard** secondary chip — tries
  `navigator.clipboard.readText()`, fills textarea on success.
- Inline validation errors: reuse existing `YamlErrorList` component.
- Primary button: **Import routine →**. Handler:
  1. `validateAndNormalizeRoutine(yaml, exerciseLookup)` — set errors and
     return on failure.
  2. `importAndActivateRoutine(db, routine)` — toast `result.message` on
     failure (active session blocks, etc.).
  3. On success: `db.settings.update(...)` clearing prompt + setting
     `onboardingCompletedAt` (if null) + clearing banner dismiss.
  4. Toast: "Routine imported. Time to train."
  5. `navigate("/", { replace: true })`.
- **Copy prompt again** expandable — retries clipboard write.
- **Start over** — confirms, clears `lastGeneratedPrompt` and answers,
  restarts the wizard.
- Back arrow top-left: returns to Today without clearing anything.

### Today banner

`TodayScreen` renders a banner above existing content when:

```
settings.lastGeneratedPrompt !== null &&
settings.onboardingBannerDismissedAt === null &&
location.pathname === "/"
```

- Visual: sage-soft background, ink-deep text, 12px radius, hairline border.
- Text: "📋 Paste your routine YAML here →".
- Close `×` sets `onboardingBannerDismissedAt = nowISO()`. A fresh generated
  prompt resets that field (so a second attempt re-shows the banner).
- Tap body → `/onboarding/handoff` (lands on Stage 2).
- `role="status"` for assistive tech.

## Settings Integration

### Profile section (new, top of Settings)

- Eyebrow `PROFILE`.
- Row: "Your name". Value shows `userName` or italic "Not set" when null.
  Tap opens inline editor (text field + Save / Cancel). Saves via new
  `setUserName(db, name)` service.

### Routine management section (restructured)

Order within the section:

1. `ActiveRoutineCard` (existing).
2. **New row: "✨ Create a personalized routine"** — subtitle "Answer a
   short questionnaire." Tap navigates to `/onboarding/questionnaire`
   (skipping step 0 welcome since name may already be set). If
   `lastGeneratedPrompt !== null`, opens a dialog: "You have an unfinished
   routine prompt. Start over will discard it. Continue?" with options
   *Start over* / *Continue with previous prompt* / *Cancel*.
3. **New conditional card: `<LastPromptCard>`** (rendered only when
   `lastGeneratedPrompt !== null`). Shows relative time, Copy / Paste YAML /
   Show prompt / Clear actions. Sage-soft accent.
4. `RowLink` "Import routine (YAML)" (existing, unchanged).
5. `RoutineList` (existing).

### New services

```ts
// settings-service.ts
export async function setUserName(
  db: ExerciseLoggerDB,
  name: string | null
): Promise<void>;

// onboarding-service.ts (new file)
export async function markOnboardingCompleted(db): Promise<void>;
export async function markOnboardingSkipped(db): Promise<void>;
export async function saveGeneratedPrompt(db, prompt: string): Promise<void>;
export async function clearLastPrompt(db): Promise<void>;
export async function dismissOnboardingBanner(db): Promise<void>;
```

Each is a straightforward Dexie `update` on the settings record. All write
ISO timestamps via `nowISO()`.

### Today screen greeting

`TodayScreen.tsx:164` changes from:

```tsx
<h1 className="text-hero-serif italic text-foreground">Hello.</h1>
```

to:

```tsx
const greeting = settings.userName ? `Hi, ${settings.userName}.` : "Hello.";
<h1 className="text-hero-serif italic text-foreground">{greeting}</h1>
```

Time-of-day prefix ("Good morning") deferred — out of scope.

## Error Handling

| Scenario | Handling |
|---|---|
| `clipboard.writeText` throws | Toast "Clipboard blocked — copy manually." Stage 2 flips anyway. The **"Show prompt"** block auto-expands; its textarea is `readOnly` with select-all on focus so the user can long-press-copy as a fallback. |
| `window.open()` returns null (popup blocker) | Toast + inline GPT link as manual fallback. Stage 2 flips. |
| Invalid YAML on Stage 2 | Reuse `YamlErrorList`. Same UX as `RoutineImportScreen`. `lastGeneratedPrompt` is preserved so the user can retry without re-running the wizard. |
| Active session blocks import (invariant 10) | `importAndActivateRoutine` returns `{ok: false, message}` — toast the message. Prompt stays saved for later retry. |
| `clipboard.readText` fails on "Paste from clipboard" | Toast "Couldn't read clipboard. Long-press to paste manually." Button stays visible for retry. |
| sessionStorage unavailable | Wizard skips resume mechanism silently; answers live in React state only. |
| Route: `/onboarding` after completion | Guard redirects to `/` if `onboardingCompletedAt !== null`. |
| Route: `/onboarding/handoff` with `lastGeneratedPrompt == null` and no just-completed local state | Redirect to `/onboarding/questionnaire` — nothing to hand off yet. |
| Route: `/onboarding/questionnaire` with empty sessionStorage | Silently reset to step 0 (default reducer state). No user-visible error. |
| Browser back from mid-wizard | Exits `/onboarding/questionnaire` to the previous page. sessionStorage is preserved so re-entering restores the step. Only the close-confirmation dialog and `restart` clear sessionStorage. |

## Testing

### Unit tests (Vitest)

- **`prompt-builder.test.ts`** (~10 cases): full, minimum, Other goal,
  bodyweight-only, favorites-without-avoid and vice versa, special
  characters, empty-answers throws, **step-6 no-parenthetical regression
  lock**, chip label mapping.
- **`questionnaire-state.test.ts`**: reducer — answer/next/back/jump/restart
  actions, bounds checking.
- **`onboarding-service.test.ts`**: Dexie ops via fake-indexeddb. Verify
  timestamps are valid ISO strings.
- **`settings-service.test.ts`** extension: `setUserName` — null, empty
  string, normal, unicode.

### Integration tests

- Migration v2 → v3: populate v2 DB, upgrade, assert fields + skipped flag.
- First-run flow end-to-end through services (no UI).
- Acceptance suite (`tests/integration/acceptance.test.ts`) stays green —
  no behavior change to sessions / sets / progression.

### Component tests (RTL)

- `OnboardingWelcomeScreen` — name input, Skip → Today, Start → wizard.
- `QuestionnaireScreen` — step progression, auto-advance on single-select,
  no auto-advance on multi-select, Back restores answer, Next disabled until
  valid.
- `HandoffScreen` — Stage 1 CTA with mocked clipboard + window.open, Stage 2
  after flip, import round-trip via fake-indexeddb.
- `LastPromptCard` — hidden when null, shown otherwise, all actions wired.
- `TodayScreen` — banner visibility conditions, greeting with/without name.

### E2E (Playwright)

- `onboarding-first-run.e2e.ts`: fresh install → welcome → questionnaire →
  Stage 1 → mock paste YAML → Stage 2 → Import → Today with name + new
  active routine.
- `onboarding-skip.e2e.ts`: welcome → Maybe later → Today with bundled
  routine and default "Hello." greeting.
- `onboarding-settings-relaunch.e2e.ts`: pre-skipped user → Settings →
  Create routine → complete → import.
- `onboarding-banner-recovery.e2e.ts`: generate prompt → reload → banner
  visible → tap → Stage 2. Dismiss → reload → banner hidden. Fresh prompt →
  banner re-shows.

Target delta: **~60 new unit+integration tests, ~10 component tests, ~4 E2E
tests**. Total test count 742 → ~810.

## Rollout

- Ship on feature branch → PR → merge to `main`.
- Existing testers silently migrated via `onboardingSkippedAt`. Zero
  disruption.
- Live demo visitors see first-run flow.
- No feature flag needed — gate logic is inherent.
- **Pre-seeded starter routine:** the app auto-seeds a bundled starter
  routine on first launch. First-time users who complete the questionnaire
  have their GPT-generated routine imported via
  `importAndActivateRoutine`, which replaces the starter as the active
  routine. The starter remains in the routine list (non-active) and can be
  deleted from Settings. The success toast "Routine imported. Time to
  train." is sufficient — no explicit "Replacing the starter routine"
  messaging.
- Users who tap **Maybe later** keep the pre-seeded starter as their active
  routine with the default "Hello." greeting, and can launch the
  questionnaire later from Settings → "Create a personalized routine".
- **GPT instructions ship in the same PR** — `docs/custom-gpt/workout-routine-gpt.instructions.md`
  is updated alongside the app: the "equipment preferences and dislikes"
  intake topic is dropped (so the wizard's 11 steps map 1:1 to GPT topics),
  and a paragraph is added instructing the GPT to skip the intake phase
  when the user's first message already contains all 11 answers. The GPT
  custom-GPT admin UI still needs a manual paste of the updated
  instructions after merge — add a release-checklist line in the PR
  description.

## Risks & Open Questions

**Risk 1 — Clipboard API variance across browsers.** iOS Safari historically
required `clipboard.writeText` to be in a user-gesture handler — which ours
is, inside the button click. Should be fine, but worth E2E-testing on
actual iOS device during QA.

**Risk 2 — sessionStorage quota.** The in-progress answer blob is tiny (< 1
KB). Not a real risk but worth keeping the JSON minimal.

**Risk 3 — GPT URL changes.** The GPT URL is hardcoded at `RoutineImportScreen.tsx:15`
and will be reused from `HandoffScreen`. Extract to a shared constant
`GPT_URL` in `features/onboarding/lib/gpt-url.ts` (or `shared/lib/`) so
there's a single source of truth. This is a small refactor included in
scope.

**Open question — none.** All scope decisions locked during brainstorming.

## Appendix — Step copy (final, for reference)

Full step text is in the implementation plan's per-component sections. The
authoritative source of final copy lives in the browser mockup at
`.superpowers/brainstorm/186-1776836513/content/final-copy.html` during
brainstorming, and will be transcribed verbatim into the component files
during implementation.

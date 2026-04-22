# Onboarding Questionnaire — Sprint C (Wizard Content) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the user-visible onboarding flow — an `OnboardingWelcomeScreen` at `/onboarding`, 11 step components, and a `QuestionnaireScreen` orchestrator at `/onboarding/questionnaire` that binds Sprint B's reducer to sessionStorage and navigates to `/onboarding/handoff` on step-11 Next. No Settings integration, no first-run gate, no prompt persistence — those are Sprint D.

**Architecture:** Each step component renders its own `WizardShell` wrapping one input primitive (`ChipRow` / `ChipMulti` / `ChipWithDescription` / `StepTextArea`). Step props are a 6-field contract: `stepIndex`, `answer`, `onAnswer`, `onBack`, `onNext`, `onClose`. Steps know their own title/subtitle/category (copied verbatim from `final-copy.html`) and their own validation rules. The orchestrator maintains a `stepIndex → StepId` mapping, binds `useReducer` + `useEffect` for sessionStorage save/load, and dispatches through a `<Switch>` on step index.

**Tech Stack:** React 19 + `react-router` 7 · Vitest + RTL + `userEvent` · Zero new runtime dependencies. Lazy-loaded routes via `React.lazy`.

---

## Source-of-truth cross-reference

| Concern | Location |
|---|---|
| Sprint scope / deliverables / exit criteria | `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` §Sprint C (§8) |
| Step copy (titles, subtitles, chip labels) — **verbatim source** | `.superpowers/brainstorm/186-1776836513/content/final-copy.html` |
| Step-6 subtitle + chips-are-numbers-only rule (Decision D10) | spec `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` §Step 6 copy |
| Welcome screen behavior (Start / Maybe later) | spec §Welcome screen (`/onboarding`) |
| Validation & input limits (maxLengths, optional steps) | spec §Validation & input limits |
| Auto-advance rules | spec §Auto-advance rules |
| Mid-wizard resume via sessionStorage | spec §Mid-wizard resume via sessionStorage |
| Accessibility (focus, aria, radiogroup, progressbar) | spec §Accessibility |
| Existing route table (`AppRoutes`, `FadeRoute`, `Shell`) | `web/src/app/App.tsx` |
| Sprint A outputs the screens import | `web/src/features/onboarding/lib/types.ts`, `prompt-builder.ts`, `web/src/services/onboarding-service.ts`, `web/src/services/settings-service.ts` |
| Sprint B outputs the screens import | `web/src/features/onboarding/lib/questionnaire-state.ts`, `session-storage.ts`, `components/{WizardShell,ChipRow,ChipMulti,ChipWithDescription,StepTextArea}.tsx` |

---

## Frozen step-props contract

Every step component accepts exactly these six props — nothing more. The orchestrator populates them; step tests mock them. No step component imports Dexie, no step calls `onboarding-service`, no step calls `buildPrompt`.

```ts
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  /** 0..10 — passed straight to WizardShell. */
  stepIndex: number;
  /** Current answer for this step from the reducer. undefined = unanswered. */
  answer: Answer | undefined;
  /** Dispatch a new answer. Orchestrator turns this into { type: "answer", stepId, answer }. */
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  /** Both the footer Next button callback AND the auto-advance callback. */
  onNext: () => void;
  /** Called AFTER the user confirms exit in WizardShell's close dialog. */
  onClose: () => void;
}
```

Each step passes `stepIndex`, `TOTAL_STEPS`, its hard-coded `category` / `title` / `subtitle`, the two navigation callbacks, `nextDisabled` (step-specific), and `hideNext` (step-specific) into `WizardShell`.

---

## Step-by-step wiring table (the source of truth for the implementer)

| idx | StepId | Category | Title (verbatim from final-copy) | Input | Chip values (what the Answer stores) | Auto-adv? | `hideNext`? | `nextDisabled` rule |
|---|---|---|---|---|---|---|---|---|
| 0 | `goal` | About you | `What's your main goal?` | `ChipRow` + "Something else…" branch → text input | `"Build muscle"`, `"Build strength"`, `"Lose fat"`, `"Conditioning"`, `"General fitness"`, `"Other"` | yes for presets; no for `"Other"` | false | `answer === undefined OR (answer.value === "Other" AND otherText.trim() === "")` |
| 1 | `experience` | About you | `How experienced are you with lifting?` | `ChipWithDescription` (3) | `"Beginner"` / `"Intermediate"` / `"Advanced"` | yes | true | n/a |
| 2 | `restrictions` | About you | `Anything we should work around?` | `StepTextArea` (max 300, counter@240) + skip chip `"All clear — skip"` | `{kind:"text", value}` | no | false | always false (optional) |
| 3 | `daysPerWeek` | Schedule | `How many days a week can you train?` | `ChipRow` 5 options | `"2"` / `"3"` / `"4"` / `"5"` / `"6"` | yes | true | n/a |
| 4 | `sessionLength` | Schedule | `How long is a typical session?` | `ChipRow` 5 options, labels show `"30 min"` etc. | `"30"` / `"45"` / `"60"` / `"75"` / `"90"` | yes | true | n/a |
| 5 | `distinctDays` | Schedule | `How many different workouts do you want in your rotation?` | `ChipRow` 5 options — **numbers only, no parenthetical** (D10) | `"1"` / `"2"` / `"3"` / `"4"` / `"5"` | yes | true | n/a |
| 6 | `equipment` | Equipment | `What equipment do you have access to?` | `ChipMulti` with `exclusiveValue="Bodyweight only"` | `"Barbell"`, `"Dumbbells"`, `"Machines"`, `"Cables"`, `"Kettlebells"`, `"Resistance bands"`, `"Pull-up bar"`, `"Bodyweight only"` | no | false | `values.length === 0` |
| 7 | `priorities` | Preferences | `Any muscle groups to prioritize?` | `ChipMulti` (no exclusive) + standalone skip chip `"Keep it balanced — skip"` | `"Chest"`, `"Back"`, `"Legs"`, `"Shoulders"`, `"Arms"`, `"Core"`, `"Glutes"` | no | false | always false (optional) |
| 8 | `favoritesAvoid` | Preferences | `Any specific exercises to include or avoid?` | Two stacked `StepTextArea`s (each max 200, counter@160) | `{kind:"favorites-avoid", favorites, avoid}` | no | false | always false (optional) |
| 9 | `supersets` | Preferences | `Are supersets okay?` | `ChipWithDescription` (3) — chip labels are `"Yes"` / `"Only if time-crunched"` / `"No supersets"`, but VALUES are `"Yes"` / `"Only if time-crunched"` / `"No"` (prompt-builder's `SUPERSETS_RENDERINGS` keys) | `"Yes"` / `"Only if time-crunched"` / `"No"` | yes | true | n/a |
| 10 | `cardio` | Preferences | `Include an optional cardio section?` | `ChipRow` 2 options — chip labels `"Yes"` / `"No cardio"`, values `"Yes"` / `"No"` | `"Yes"` / `"No"` | yes | true | n/a |

**Subtitles** (verbatim from final-copy.html):

| idx | Subtitle |
|---|---|
| 0 | `Pick the one that matters most right now. You can always adjust later by regenerating.` |
| 1 | `Honest is better than optimistic — the routine matches what you're ready for.` |
| 2 | `Injuries, pain spots, or movements your body doesn't like. Totally skippable.` |
| 3 | `Count the days you'll actually show up — better to start lower and level up.` |
| 4 | `Time you have for the whole workout — warm-up, lifts, everything.` |
| 5 | `This is about variety, not frequency. For reference only: full-body = 1, Upper/Lower = 2, Push/Pull/Legs = 3, body-part split = 5. Your goals, equipment, and experience will shape the actual split — you don't need to prescribe one here.` (spec §Step 6 copy, NOT final-copy.html — the design-spec version is authoritative because it enforces D10 by keeping the examples out of chip labels) |
| 6 | `Tap everything you can use. If you train at a full gym, you can just tap them all.` |
| 7 | `We'll give these a bit more volume. Skip for a balanced routine.` |
| 8 | `Optional. Helpful if you have a favorite lift or one that always hurts.` |
| 9 | `A superset pairs two exercises back-to-back with no rest — saves time, harder on recovery.` |
| 10 | `A short cardio block at the end of some sessions. Always optional on the day — you can skip it if you're done.` |

**ChipWithDescription chip descriptions** (secondary text, under each option):

Step 1 (experience):
- `Beginner` → `New to lifting, or back after a long break`
- `Intermediate` → `Training regularly for 6+ months, know the main lifts`
- `Advanced` → `Several years of structured training`

Step 9 (supersets) — the **label** shown to the user differs from the **stored value**:
- value `"Yes"` → label `"Yes"`, description `"Use them where they fit"`
- value `"Only if time-crunched"` → label `"Only if time-crunched"`, description `"Prefer single exercises when possible"`
- value `"No"` → label `"No supersets"`, description `"I like one exercise at a time"`

The `ChipWithDescription` component renders `opt.label`. The `onSelect` callback receives `opt.value`. Steps 9's `ChipOption` array therefore uses `{value:"No", label:"No supersets", description:"…"}` so the prompt-builder's keyed lookup (`SUPERSETS_RENDERINGS["No"]`) works.

**`ChipRow` option mapping for label-vs-value divergence:**

Step 4 (sessionLength): `[{value:"30", label:"30 min"}, {value:"45", label:"45 min"}, ...]`. Value is the numeric string because prompt-builder's `renderSessionLength` appends `" minutes"` only when the string is numeric.

Step 10 (cardio): `[{value:"Yes", label:"Yes"}, {value:"No", label:"No cardio"}]`.

Other ChipRow steps have `value === label`.

---

## File map

**Create (code):**

| Path | Responsibility |
|---|---|
| `web/src/features/onboarding/OnboardingWelcomeScreen.tsx` | Route `/onboarding`. Serif heading + name input (autofocus, `maxLength=40`) + `Start` and `Maybe later` buttons. Start: trim name, `setUserName` if non-empty, `navigate("/onboarding/questionnaire", { replace: true })`. Maybe later: `markOnboardingSkipped`, `navigate("/", { replace: true })`. Enter submits Start. |
| `web/src/features/onboarding/QuestionnaireScreen.tsx` | Route `/onboarding/questionnaire`. Orchestrator: `useReducer` (Sprint B), mount-time restore via `loadWizardState`, persist-on-change via `useEffect`, close-dialog clears sessionStorage and navigates home, step-11 Next navigates to `/onboarding/handoff` (no prompt persistence — that's Sprint D). |
| `web/src/features/onboarding/steps/GoalStep.tsx` | Step 1. 5 preset chips + a sixth chip "Something else…" that reveals a text input. Auto-advance on preset; explicit Next for Other. |
| `web/src/features/onboarding/steps/ExperienceStep.tsx` | Step 2. `ChipWithDescription`, 3 options, auto-advance. |
| `web/src/features/onboarding/steps/RestrictionsStep.tsx` | Step 3. `StepTextArea` with maxLength 300, counter threshold 240, skip chip "All clear — skip". |
| `web/src/features/onboarding/steps/DaysPerWeekStep.tsx` | Step 4. `ChipRow` 2/3/4/5/6, auto-advance. |
| `web/src/features/onboarding/steps/SessionLengthStep.tsx` | Step 5. `ChipRow` 30/45/60/75/90 min, auto-advance. |
| `web/src/features/onboarding/steps/DistinctDaysStep.tsx` | Step 6. `ChipRow` 1/2/3/4/5, auto-advance. Chips are number-only; examples live in the subtitle. |
| `web/src/features/onboarding/steps/EquipmentStep.tsx` | Step 7. `ChipMulti` with `exclusiveValue="Bodyweight only"`. Next disabled when selection is empty. |
| `web/src/features/onboarding/steps/PrioritiesStep.tsx` | Step 8. `ChipMulti` + standalone skip chip below. Skip clears selection AND advances. |
| `web/src/features/onboarding/steps/FavoritesAvoidStep.tsx` | Step 9. Two `StepTextArea`s (Love / Avoid) each max 200, counter 160. Emits `{kind:"favorites-avoid", favorites, avoid}`. |
| `web/src/features/onboarding/steps/SupersetsStep.tsx` | Step 10. `ChipWithDescription`, auto-advance. Note the value/label divergence for `"No"`. |
| `web/src/features/onboarding/steps/CardioStep.tsx` | Step 11. `ChipRow` Yes / No cardio, auto-advance. |

**Modify:**

| Path | Change |
|---|---|
| `web/src/app/App.tsx` | Add 2 `lazy()` imports + 2 `<Route>` entries (`/onboarding`, `/onboarding/questionnaire`) inside `<Shell>`. No first-run gate in this sprint. |
| `web/src/features/onboarding/CLAUDE.md` | Append a "Screens + routes" section listing the 2 new routes and the 11 step files. |

**Create (tests) — all under `web/tests/unit/features/onboarding/` except the integration:**

| Path | Count |
|---|---|
| `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx` | ~4 |
| `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx` | ~6 |
| `web/tests/unit/features/onboarding/steps/GoalStep.test.tsx` | ~3 |
| `web/tests/unit/features/onboarding/steps/ExperienceStep.test.tsx` | ~1 |
| `web/tests/unit/features/onboarding/steps/RestrictionsStep.test.tsx` | ~2 |
| `web/tests/unit/features/onboarding/steps/DaysPerWeekStep.test.tsx` | ~1 |
| `web/tests/unit/features/onboarding/steps/SessionLengthStep.test.tsx` | ~1 |
| `web/tests/unit/features/onboarding/steps/DistinctDaysStep.test.tsx` | ~2 (the D10 lock) |
| `web/tests/unit/features/onboarding/steps/EquipmentStep.test.tsx` | ~2 |
| `web/tests/unit/features/onboarding/steps/PrioritiesStep.test.tsx` | ~2 |
| `web/tests/unit/features/onboarding/steps/FavoritesAvoidStep.test.tsx` | ~2 |
| `web/tests/unit/features/onboarding/steps/SupersetsStep.test.tsx` | ~1 |
| `web/tests/unit/features/onboarding/steps/CardioStep.test.tsx` | ~1 |
| `web/tests/integration/onboarding-walkthrough.test.tsx` | ~1 |

Expected test delta: ~29 tests (orchestration estimate ~22; overshoot from TDD-per-behavior is fine). Baseline after Sprint B: 815 → **~844**. The pre-existing `useRoutineLaunchQueue.test.tsx` flake is a no-op — pass in isolation, occasional fail under full-suite interleaving. Ignore when it surfaces; panic only if OTHER tests fail.

**Out of scope (explicit):**
- `HandoffScreen.tsx`. All Sprint D.
- `LastPromptCard.tsx`, Settings changes, Today changes. Sprint D.
- First-run redirect gate in `AppRoutes`. Sprint D.
- `saveGeneratedPrompt`, `markOnboardingCompleted`, `buildPrompt` calls inside the orchestrator. Sprint D wires those through HandoffScreen.
- `clearWizardState()` on step-11 Next — per spec §Mid-wizard resume, sessionStorage is cleared on **successful completion (handoff Stage 1 button tap)**. Sprint D owns the clear.
- E2E / Playwright. Sprint E.

---

## Task ordering

1. Routes + placeholder screens (Task 1) — unblocks downstream dev-server manual checks.
2. OnboardingWelcomeScreen (Task 2).
3. Eleven step components (Tasks 3–13). Order does not matter logically, but reading-order makes the sequential walk intuitive: Goal → Experience → Restrictions → DaysPerWeek → SessionLength → DistinctDays → Equipment → Priorities → FavoritesAvoid → Supersets → Cardio.
4. QuestionnaireScreen orchestrator (Task 14) — imports all 11 steps, binds reducer + sessionStorage, handles navigation.
5. Walkthrough integration test (Task 15) — exercises all steps end-to-end, calls `buildPrompt(state.answers)` at the end and asserts the D10 line.
6. CLAUDE.md polish (Task 16).

Total: **16 tasks**. Each step component is small (~40–60 lines + ~20–30 test lines), so tasks 3–13 can run in parallel if the executor dispatches multiple subagents. The sequential writing below assumes single-track execution; parallel execution is safe because no two step files collide.

Commits: one per task. Conventional commits — `feat(onboarding): add <thing>`, `test(onboarding): …`, `docs: …`.

---

## Shared conventions

1. **Imports.** `@/` aliases. Step files import from `@/features/onboarding/components/*` and `@/features/onboarding/lib/types` only (no Dexie, no services).
2. **Classes.** Compose with `cn(...)` from `@/shared/lib/utils`.
3. **Tests.** Mirror `UnitsToggle.test.tsx` style: `describe/it/expect` from vitest, `render/screen` from `@testing-library/react`, `userEvent.setup()`. No explicit `afterEach(cleanup)`.
4. **Navigation.** `useNavigate` from `react-router` (the project uses react-router v7 — import path is `react-router`, not `react-router-dom`).
5. **Named exports only** for step components and the orchestrator screens use `export default` (they're lazy-loaded routes).
6. **No `useCallback`/`useMemo`** unless necessary. Small phone UI; readability first.

---

## Task 1: Route additions + placeholder screens

**Files:**
- Modify: `web/src/app/App.tsx` (add 2 lazy imports + 2 routes)
- Create: `web/src/features/onboarding/OnboardingWelcomeScreen.tsx` (temporary stub — Task 2 replaces)
- Create: `web/src/features/onboarding/QuestionnaireScreen.tsx` (temporary stub — Task 14 replaces)

Rationale: land the route scaffolding first so subsequent tasks compile cleanly under typechecking. The stubs are thrown away in Tasks 2 and 14.

- [ ] **Step 1.1: Create placeholder `OnboardingWelcomeScreen.tsx`**

```tsx
export default function OnboardingWelcomeScreen() {
  return <div className="p-6 text-sm text-ink-2">Welcome (placeholder)</div>;
}
```

- [ ] **Step 1.2: Create placeholder `QuestionnaireScreen.tsx`**

```tsx
export default function QuestionnaireScreen() {
  return <div className="p-6 text-sm text-ink-2">Questionnaire (placeholder)</div>;
}
```

- [ ] **Step 1.3: Add lazy imports + routes to `App.tsx`**

In the top lazy-import block (around line 27–30), add:

```tsx
const OnboardingWelcomeScreen = lazy(
  () => import("@/features/onboarding/OnboardingWelcomeScreen"),
);
const QuestionnaireScreen = lazy(
  () => import("@/features/onboarding/QuestionnaireScreen"),
);
```

Inside the `<Route element={<Shell />}>` block (after the `/settings/import` route, before `<Route path="*" element={<Navigate to="/" replace />} />`), add:

```tsx
          <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
          <Route
            path="/onboarding/questionnaire"
            element={<QuestionnaireScreen />}
          />
```

- [ ] **Step 1.4: Sanity check**

Run: `cd web && npm test -- --run`
Expected: **815** green, unchanged. No new tests this task.

- [ ] **Step 1.5: Commit**

```bash
git add web/src/app/App.tsx web/src/features/onboarding/OnboardingWelcomeScreen.tsx web/src/features/onboarding/QuestionnaireScreen.tsx
git commit -m "feat(onboarding): add /onboarding and /onboarding/questionnaire routes"
```

---

## Task 2: `OnboardingWelcomeScreen`

**Files:**
- Modify: `web/src/features/onboarding/OnboardingWelcomeScreen.tsx` (replace placeholder)
- Create: `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`

### Behavior (spec §Welcome screen)

- Autofocus the text input on mount (`useRef` + `useEffect([])`).
- `maxLength={40}` on the input. Enter key in the input submits Start.
- **Start:** trim the name; if non-empty, `await setUserName(db, trimmed)`; then `navigate("/onboarding/questionnaire", { replace: true })`. Empty-after-trim is allowed — still navigates but does NOT call `setUserName`.
- **Maybe later:** `await markOnboardingSkipped(db)`, then `navigate("/", { replace: true })`. Does NOT save the name.
- Neither button touches `onboardingCompletedAt` (that happens on Stage-2 YAML import in Sprint D).

### Step 2.1 — Write the failing test

Create `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import OnboardingWelcomeScreen from "@/features/onboarding/OnboardingWelcomeScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";

// Replace the shared `db` singleton imported by the screen with a fresh fake
// per test. The screen imports from "@/db/database", so we mock the module.
vi.mock("@/db/database", async () => {
  const real = await vi.importActual<typeof import("@/db/database")>("@/db/database");
  return { ...real };
});

function WithRouter({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={children} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingWelcomeScreen", () => {
  beforeEach(async () => {
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.settings.clear();
    await db.settings.put({
      id: "user",
      activeRoutineId: null,
      units: "kg",
      userName: null,
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
      lastGeneratedPrompt: null,
      lastGeneratedPromptAt: null,
      onboardingBannerDismissedAt: null,
    });
    await db.close();
  });

  it("autofocuses the name input on mount", () => {
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    expect(input.getAttribute("maxlength")).toBe("40");
  });

  it("Start with a name trims, saves via setUserName, and navigates to the questionnaire", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.type(screen.getByRole("textbox"), "  Alvaro  ");
    await user.click(screen.getByRole("button", { name: /^start$/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();

    // Verify the name was persisted (trimmed).
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.userName).toBe("Alvaro");
    expect(s?.onboardingSkippedAt).toBeNull();
    await db.close();
  });

  it("Start with an empty name navigates to the questionnaire without calling setUserName", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /^start$/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();

    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.userName).toBeNull();
    await db.close();
  });

  it("Maybe later calls markOnboardingSkipped and navigates to /", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();

    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(s?.userName).toBeNull();
    await db.close();
  });
});
```

### Step 2.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`
Expected: FAIL — the placeholder screen doesn't have the required UI.

### Step 2.3 — Implement the screen

Replace `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { db } from "@/db/database";
import { setUserName } from "@/services/settings-service";
import { markOnboardingSkipped } from "@/services/onboarding-service";

export default function OnboardingWelcomeScreen() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    const trimmed = name.trim();
    if (trimmed !== "") {
      await setUserName(db, trimmed);
    }
    navigate("/onboarding/questionnaire", { replace: true });
  }

  async function handleSkip() {
    if (busy) return;
    setBusy(true);
    await markOnboardingSkipped(db);
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <div className="text-eyebrow text-ink-3">WELCOME</div>
        <h1 className="text-hero-serif italic text-ink">
          What should we call you?
        </h1>
        <p id="name-hint" className="text-sm text-ink-2 leading-relaxed">
          We'll use this as a greeting in the app — like "Hi, Alvaro." You can
          change it anytime in Settings, or skip for now.
        </p>
      </div>

      <Input
        ref={inputRef}
        aria-label="Your name"
        aria-describedby="name-hint"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleStart();
          }
        }}
        placeholder="Your name"
        className="rounded-[var(--radius-card)] bg-paper"
      />

      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={handleStart} disabled={busy}>Start</Button>
        <Button variant="outline" onClick={handleSkip} disabled={busy}>
          Maybe later
        </Button>
      </div>
    </div>
  );
}
```

### Step 2.4 — Run tests green

Run: `cd web && npm test -- --run tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`
Expected: 4 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **~819** (815 + 4). Pre-existing flake ignored.

### Step 2.5 — Commit

```bash
git add web/src/features/onboarding/OnboardingWelcomeScreen.tsx web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx
git commit -m "feat(onboarding): add welcome screen with name input and Maybe-later skip"
```

---

## Tasks 3–13: Eleven step components

Every step follows the **same skeleton**:

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function XyzStep({ stepIndex, answer, onAnswer, onBack, onNext, onClose }: StepProps) {
  // … derive selected value from answer; compute nextDisabled / hideNext.
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="…"
      title="…"
      subtitle="…"
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      nextDisabled={/* step-specific */}
      hideNext={/* step-specific */}
    >
      {/* the input primitive */}
    </WizardShell>
  );
}
```

Redeclaring `StepProps` in each file is acceptable — they are a frozen inline contract. To keep DRY without an extra file, each step file re-declares the same interface. Sprint D will not reshape this contract.

Test skeleton for every step file:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { XyzStep } from "@/features/onboarding/steps/XyzStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: N,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}
```

### Task 3: `GoalStep` (step 1 — chip-with-other)

**Files:**
- Create: `web/src/features/onboarding/steps/GoalStep.tsx`
- Create: `web/tests/unit/features/onboarding/steps/GoalStep.test.tsx`

The unique twist: tapping "Something else…" should NOT commit an answer or advance. Instead it reveals an inline text input. Tapping one of the 5 preset chips commits `{kind:"chip-with-other", value:<preset>}` and auto-advances. The user types into the text input, which commits `{kind:"chip-with-other", value:"Other", otherText}`; Next is enabled when `otherText.trim() !== ""`.

Local state: `otherActive: boolean` — toggled true when the user taps the "Something else…" chip. Set back to false when the user taps a preset chip.

- [ ] **Step 3.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 0,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("GoalStep", () => {
  it("tapping a preset chip emits chip-with-other with that value and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<GoalStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("Build muscle"));
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-with-other",
      value: "Build muscle",
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("tapping 'Something else…' reveals a text input and does NOT advance", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<GoalStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText(/Something else/i));
    // Text input appears.
    const textInput = screen.getByPlaceholderText(/e\.g\./i);
    expect(textInput).toBeInTheDocument();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).not.toHaveBeenCalled();
    // Selecting "Something else" does NOT commit an answer by itself — it just
    // opens the input. The answer is committed on typing.
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("typing in the Other input emits chip-with-other with value='Other' and otherText", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(
      <GoalStep
        {...makeProps({
          answer: { kind: "chip-with-other", value: "Other", otherText: "" },
          onAnswer,
        })}
      />
    );
    // The input should already be visible because the answer says Other.
    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, "parkour");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "chip-with-other",
      value: "Other",
      otherText: "parkour",
    });
  });
});
```

- [ ] **Step 3.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/steps/GoalStep.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 3.3: Implement `GoalStep`**

```tsx
import { useState, useEffect } from "react";
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { Input } from "@/shared/ui/input";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const PRESETS: ChipOption[] = [
  { value: "Build muscle", label: "Build muscle" },
  { value: "Build strength", label: "Build strength" },
  { value: "Lose fat", label: "Lose fat" },
  { value: "Conditioning", label: "Conditioning" },
  { value: "General fitness", label: "General fitness" },
  { value: "Other", label: "Something else…" },
];

export function GoalStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const isOther =
    answer?.kind === "chip-with-other" && answer.value === "Other";
  const otherText =
    answer?.kind === "chip-with-other" ? (answer.otherText ?? "") : "";

  // Local toggle: true whenever the user has clicked "Something else…" — so
  // the text input shows even before they start typing. The reducer-held
  // answer may still be undefined at that moment.
  const [otherActive, setOtherActive] = useState(isOther);
  useEffect(() => {
    if (isOther) setOtherActive(true);
  }, [isOther]);

  const selected =
    answer?.kind === "chip-with-other"
      ? answer.value
      : otherActive
        ? "Other"
        : null;

  const handleSelect = (value: string) => {
    if (value === "Other") {
      setOtherActive(true);
      // Don't commit until the user types or advances; orchestrator's
      // nextDisabled will hold them on this step until otherText is non-empty.
      return;
    }
    setOtherActive(false);
    onAnswer({ kind: "chip-with-other", value });
  };

  const handleOtherChange = (text: string) => {
    onAnswer({ kind: "chip-with-other", value: "Other", otherText: text });
  };

  const nextDisabled =
    answer === undefined ||
    (answer.kind === "chip-with-other" &&
      answer.value === "Other" &&
      otherText.trim() === "");

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="About you"
      title="What's your main goal?"
      subtitle="Pick the one that matters most right now. You can always adjust later by regenerating."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      nextDisabled={nextDisabled}
    >
      <div className="flex flex-col gap-3">
        <ChipRow
          name="goal"
          options={PRESETS}
          selected={selected}
          onSelect={handleSelect}
          autoAdvance
          onAdvance={onNext}
          ariaLabel="Primary goal"
        />
        {otherActive && (
          <Input
            aria-label="Your custom goal"
            maxLength={60}
            value={otherText}
            onChange={(e) => handleOtherChange(e.target.value)}
            placeholder="e.g., train for a triathlon"
            className="rounded-[var(--radius-card)] bg-paper"
          />
        )}
      </div>
    </WizardShell>
  );
}
```

Note: `ChipRow` with 6 options falls into the "aria-pressed buttons" branch (>5). That's fine for step 1 — the "Something else…" chip behaves differently anyway, so the radiogroup semantics wouldn't have matched the UX.

**Caveat:** `ChipRow`'s `autoAdvance` fires `onAdvance` for EVERY `onSelect`, including the "Other" one. To prevent auto-advancing when the user taps "Something else…", the step's `handleSelect` short-circuits before calling `onAnswer`, but `ChipRow` still calls `queueMicrotask(onAdvance)` regardless. Our `onAdvance` target is `onNext`, which dispatches the reducer `next` action — that's wrong.

**Fix option 1 (preferred):** don't pass `autoAdvance` / `onAdvance` to `ChipRow` in step 1. Instead, handle advance manually inside `handleSelect`:

```tsx
const handleSelect = (value: string) => {
  if (value === "Other") {
    setOtherActive(true);
    return;
  }
  setOtherActive(false);
  onAnswer({ kind: "chip-with-other", value });
  queueMicrotask(onNext);
};
```

Then `ChipRow` is called without `autoAdvance`. The test still passes (the `onNext` spy observes the microtask dispatch).

Use Fix option 1 — update the `ChipRow` invocation in the implementation above:

```tsx
<ChipRow
  name="goal"
  options={PRESETS}
  selected={selected}
  onSelect={handleSelect}
  ariaLabel="Primary goal"
/>
```

And confirm the test still passes (it tests `onNext` being called, not specifically `autoAdvance`).

- [ ] **Step 3.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/steps/GoalStep.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **~822** (819 + 3).

- [ ] **Step 3.5: Commit**

```bash
git add web/src/features/onboarding/steps/GoalStep.tsx web/tests/unit/features/onboarding/steps/GoalStep.test.tsx
git commit -m "feat(onboarding): add GoalStep with preset chips + chip-with-other branch"
```

---

### Task 4: `ExperienceStep` (step 2)

**Files:**
- Create: `web/src/features/onboarding/steps/ExperienceStep.tsx`
- Create: `web/tests/unit/features/onboarding/steps/ExperienceStep.test.tsx`

- [ ] **Step 4.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienceStep } from "@/features/onboarding/steps/ExperienceStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 1,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("ExperienceStep", () => {
  it("tapping a chip emits {kind:'chip', value} and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<ExperienceStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText(/Intermediate/));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "Intermediate" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/steps/ExperienceStep.test.tsx`

- [ ] **Step 4.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import {
  ChipWithDescription,
} from "@/features/onboarding/components/ChipWithDescription";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  {
    value: "Beginner",
    label: "Beginner",
    description: "New to lifting, or back after a long break",
  },
  {
    value: "Intermediate",
    label: "Intermediate",
    description: "Training regularly for 6+ months, know the main lifts",
  },
  {
    value: "Advanced",
    label: "Advanced",
    description: "Several years of structured training",
  },
];

export function ExperienceStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="About you"
      title="How experienced are you with lifting?"
      subtitle="Honest is better than optimistic — the routine matches what you're ready for."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipWithDescription
        name="experience"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Experience"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 4.4: Run green + commit**

```bash
cd web && npm test -- --run tests/unit/features/onboarding/steps/ExperienceStep.test.tsx
```
Expected: 1 pass.

Full suite: ~823. Commit:

```bash
git add web/src/features/onboarding/steps/ExperienceStep.tsx web/tests/unit/features/onboarding/steps/ExperienceStep.test.tsx
git commit -m "feat(onboarding): add ExperienceStep (step 2)"
```

---

### Task 5: `RestrictionsStep` (step 3)

**Files:**
- Create: `web/src/features/onboarding/steps/RestrictionsStep.tsx`
- Create: `web/tests/unit/features/onboarding/steps/RestrictionsStep.test.tsx`

Optional step. Skip chip clears any typed text and advances.

- [ ] **Step 5.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestrictionsStep } from "@/features/onboarding/steps/RestrictionsStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 2,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("RestrictionsStep", () => {
  it("typing emits {kind:'text', value}", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    // Controlled-input test needs a stateful harness since the component is
    // controlled by the parent's `answer` prop.
    function Harness() {
      const [a, setA] = useState<Answer | undefined>(undefined);
      return (
        <RestrictionsStep
          {...makeProps({
            answer: a,
            onAnswer: (ans: Answer) => {
              setA(ans);
              onAnswer(ans);
            },
          })}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("textbox"), "bad knee");
    expect(onAnswer).toHaveBeenLastCalledWith({ kind: "text", value: "bad knee" });
  });

  it("tapping the skip chip commits empty text and advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<RestrictionsStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByRole("button", { name: /all clear — skip/i }));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "text", value: "" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

Add this import at the top of the test file:

```tsx
import { useState } from "react";
import type { Answer } from "@/features/onboarding/lib/types";
```

- [ ] **Step 5.2: Confirm failure**

- [ ] **Step 5.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { StepTextArea } from "@/features/onboarding/components/StepTextArea";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function RestrictionsStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const value = answer?.kind === "text" ? answer.value : "";
  const skipped = value === "" && answer?.kind === "text";

  const handleSkip = () => {
    onAnswer({ kind: "text", value: "" });
    queueMicrotask(onNext);
  };

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="About you"
      title="Anything we should work around?"
      subtitle="Injuries, pain spots, or movements your body doesn't like. Totally skippable."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <StepTextArea
        ariaLabel="Restrictions"
        value={value}
        onChange={(v) => onAnswer({ kind: "text", value: v })}
        maxLength={300}
        showCounterAt={240}
        placeholder={`e.g., "No back squats — tweaked my lower back. Shoulders are sensitive overhead."`}
        skipChipLabel="All clear — skip"
        onSkip={handleSkip}
        skipped={skipped}
      />
    </WizardShell>
  );
}
```

- [ ] **Step 5.4: Run tests green + commit**

Commit message: `feat(onboarding): add RestrictionsStep (step 3) with skip chip`

---

### Task 6: `DaysPerWeekStep` (step 4)

- [ ] **Step 6.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaysPerWeekStep } from "@/features/onboarding/steps/DaysPerWeekStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 3,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("DaysPerWeekStep", () => {
  it("tapping a chip emits {kind:'chip', value} as numeric string and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<DaysPerWeekStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("4"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "4" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6.2: Confirm failure**

- [ ] **Step 6.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
];

export function DaysPerWeekStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Schedule"
      title="How many days a week can you train?"
      subtitle="Count the days you'll actually show up — better to start lower and level up."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="days-per-week"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Days per week"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 6.4: Run tests green + commit**

Commit: `feat(onboarding): add DaysPerWeekStep (step 4)`

---

### Task 7: `SessionLengthStep` (step 5)

Identical skeleton to Task 6 with these differences:
- `stepIndex: 4`
- Title: `"How long is a typical session?"`
- Subtitle: `"Time you have for the whole workout — warm-up, lifts, everything."`
- Options: `[{value:"30",label:"30 min"},{value:"45",label:"45 min"},{value:"60",label:"60 min"},{value:"75",label:"75 min"},{value:"90",label:"90 min"}]`
- ariaLabel: `"Session length"`

- [ ] **Step 7.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionLengthStep } from "@/features/onboarding/steps/SessionLengthStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 4,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("SessionLengthStep", () => {
  it("tapping '60 min' emits numeric value '60' and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<SessionLengthStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("60 min"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "60" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7.2–7.4: Implement** (same skeleton as DaysPerWeekStep with the constants above) and commit with message `feat(onboarding): add SessionLengthStep (step 5)`.

---

### Task 8: `DistinctDaysStep` (step 6) — the D10 lock

**Critical:** chip labels are numbers ONLY. The examples live only in the subtitle.

- [ ] **Step 8.1: Write the failing test — includes the D10 lock**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistinctDaysStep } from "@/features/onboarding/steps/DistinctDaysStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 5,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("DistinctDaysStep", () => {
  it("tapping '3' emits {kind:'chip', value:'3'} and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<DistinctDaysStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("3"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "3" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("chip labels are numbers only — no parenthetical examples (D10)", () => {
    render(<DistinctDaysStep {...makeProps()} />);
    // Each chip's accessible label is a bare number.
    for (const n of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByLabelText(n)).toBeInTheDocument();
    }
    // No example strings leak into the chip-group area.
    const group = screen.getByRole("radiogroup", { name: /distinct days/i });
    expect(group.textContent ?? "").not.toMatch(/Push\/Pull\/Legs/);
    expect(group.textContent ?? "").not.toMatch(/Upper\/Lower/);
    expect(group.textContent ?? "").not.toMatch(/full-body/i);
    // Examples DO appear in the step text overall — but not inside the chip group.
    expect(screen.getByText(/full-body = 1/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8.2: Confirm failure**

- [ ] **Step 8.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

export function DistinctDaysStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Schedule"
      title="How many different workouts do you want in your rotation?"
      subtitle={
        "This is about variety, not frequency. For reference only: full-body = 1, Upper/Lower = 2, Push/Pull/Legs = 3, body-part split = 5. Your goals, equipment, and experience will shape the actual split — you don't need to prescribe one here."
      }
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="distinct-days"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Distinct days"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 8.4: Run green + commit**

Commit: `feat(onboarding): add DistinctDaysStep (step 6) with D10 number-only lock`

---

### Task 9: `EquipmentStep` (step 7) — ChipMulti with exclusive

- [ ] **Step 9.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EquipmentStep } from "@/features/onboarding/steps/EquipmentStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 6,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("EquipmentStep", () => {
  it("Next is disabled when nothing is selected", () => {
    render(<EquipmentStep {...makeProps()} />);
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();
  });

  it("tapping Barbell emits {kind:'chip-multi', values:['Barbell']}; Bodyweight-only exclusivity routes through ChipMulti", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<EquipmentStep {...makeProps({ onAnswer })} />);
    await user.click(screen.getByRole("button", { name: /^barbell$/i }));
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-multi",
      values: ["Barbell"],
    });
  });
});
```

- [ ] **Step 9.2: Confirm failure**

- [ ] **Step 9.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "Barbell", label: "Barbell" },
  { value: "Dumbbells", label: "Dumbbells" },
  { value: "Machines", label: "Machines" },
  { value: "Cables", label: "Cables" },
  { value: "Kettlebells", label: "Kettlebells" },
  { value: "Resistance bands", label: "Resistance bands" },
  { value: "Pull-up bar", label: "Pull-up bar" },
  { value: "Bodyweight only", label: "Bodyweight only" },
];

export function EquipmentStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const values = answer?.kind === "chip-multi" ? answer.values : [];
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Equipment"
      title="What equipment do you have access to?"
      subtitle="Tap everything you can use. If you train at a full gym, you can just tap them all."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      nextDisabled={values.length === 0}
    >
      <ChipMulti
        options={OPTIONS}
        selected={values}
        onChange={(next) => onAnswer({ kind: "chip-multi", values: next })}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 9.4: Run green + commit**

Commit: `feat(onboarding): add EquipmentStep (step 7) with Bodyweight-only exclusivity`

---

### Task 10: `PrioritiesStep` (step 8) — multi + standalone skip chip

The skip chip here is a standalone `<button>` below the `ChipMulti`. Tapping it clears selection AND advances (matches the UX "I'm done, nothing to add").

- [ ] **Step 10.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrioritiesStep } from "@/features/onboarding/steps/PrioritiesStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 7,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("PrioritiesStep", () => {
  it("tapping Back emits {kind:'chip-multi', values:['Back']}", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<PrioritiesStep {...makeProps({ onAnswer })} />);
    await user.click(screen.getByRole("button", { name: /^back$/i, pressed: false }));
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-multi",
      values: ["Back"],
    });
  });

  it("skip chip clears selection, emits empty values, and advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(
      <PrioritiesStep
        {...makeProps({
          answer: { kind: "chip-multi", values: ["Back", "Legs"] },
          onAnswer,
          onNext,
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: /keep it balanced — skip/i }));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip-multi", values: [] });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

Note: the "Back" name selector needs `{ pressed: false }` because the `WizardShell`'s footer has a Back button — the selector needs to disambiguate from the chip. If RTL cannot disambiguate that way, use `screen.getAllByRole("button", { name: /^back$/i })` and pick the chip (the one without `aria-disabled` or the one without the outline variant).

- [ ] **Step 10.2: Confirm failure**

- [ ] **Step 10.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";
import { cn } from "@/shared/lib/utils";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "Chest", label: "Chest" },
  { value: "Back", label: "Back" },
  { value: "Legs", label: "Legs" },
  { value: "Shoulders", label: "Shoulders" },
  { value: "Arms", label: "Arms" },
  { value: "Core", label: "Core" },
  { value: "Glutes", label: "Glutes" },
];

const skipChip =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft self-start";

export function PrioritiesStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const values = answer?.kind === "chip-multi" ? answer.values : [];
  const handleSkip = () => {
    onAnswer({ kind: "chip-multi", values: [] });
    queueMicrotask(onNext);
  };
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Any muscle groups to prioritize?"
      subtitle="We'll give these a bit more volume. Skip for a balanced routine."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <ChipMulti
          options={OPTIONS}
          selected={values}
          onChange={(next) => onAnswer({ kind: "chip-multi", values: next })}
          ariaLabel="Priorities"
        />
        <button type="button" onClick={handleSkip} className={cn(skipChip)}>
          Keep it balanced — skip
        </button>
      </div>
    </WizardShell>
  );
}
```

- [ ] **Step 10.4: Run green + commit**

Commit: `feat(onboarding): add PrioritiesStep (step 8) with skip-and-advance chip`

---

### Task 11: `FavoritesAvoidStep` (step 9) — two textareas

- [ ] **Step 11.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoritesAvoidStep } from "@/features/onboarding/steps/FavoritesAvoidStep";
import type { Answer } from "@/features/onboarding/lib/types";

function makeProps(overrides = {}) {
  return {
    stepIndex: 8,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("FavoritesAvoidStep", () => {
  it("typing in Love emits favorites-avoid with the value preserved; avoid defaults to ''", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    function Harness() {
      const [a, setA] = useState<Answer | undefined>(undefined);
      return (
        <FavoritesAvoidStep
          {...makeProps({
            answer: a,
            onAnswer: (ans: Answer) => {
              setA(ans);
              onAnswer(ans);
            },
          })}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: /love/i }), "deadlifts");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "favorites-avoid",
      favorites: "deadlifts",
      avoid: "",
    });
  });

  it("typing in Avoid preserves the existing favorites value", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    function Harness() {
      const [a, setA] = useState<Answer | undefined>({
        kind: "favorites-avoid",
        favorites: "squats",
        avoid: "",
      });
      return (
        <FavoritesAvoidStep
          {...makeProps({
            answer: a,
            onAnswer: (ans: Answer) => {
              setA(ans);
              onAnswer(ans);
            },
          })}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: /avoid/i }), "deadlifts");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "favorites-avoid",
      favorites: "squats",
      avoid: "deadlifts",
    });
  });
});
```

- [ ] **Step 11.2: Confirm failure**

- [ ] **Step 11.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { StepTextArea } from "@/features/onboarding/components/StepTextArea";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function FavoritesAvoidStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const favorites =
    answer?.kind === "favorites-avoid" ? answer.favorites : "";
  const avoid = answer?.kind === "favorites-avoid" ? answer.avoid : "";

  const commit = (nextFavorites: string, nextAvoid: string) => {
    onAnswer({
      kind: "favorites-avoid",
      favorites: nextFavorites,
      avoid: nextAvoid,
    });
  };

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Any specific exercises to include or avoid?"
      subtitle="Optional. Helpful if you have a favorite lift or one that always hurts."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-3">LOVE (MUST-INCLUDE)</span>
          <StepTextArea
            ariaLabel="Love"
            value={favorites}
            onChange={(v) => commit(v, avoid)}
            maxLength={200}
            showCounterAt={160}
            placeholder={`e.g., "Back squat, bench press, pull-ups"`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-3">AVOID (SKIP THESE)</span>
          <StepTextArea
            ariaLabel="Avoid"
            value={avoid}
            onChange={(v) => commit(favorites, v)}
            maxLength={200}
            showCounterAt={160}
            placeholder={`e.g., "Deadlifts — bad back"`}
          />
        </div>
      </div>
    </WizardShell>
  );
}
```

- [ ] **Step 11.4: Run green + commit**

Commit: `feat(onboarding): add FavoritesAvoidStep (step 9) with paired text areas`

---

### Task 12: `SupersetsStep` (step 10) — value/label divergence

**Critical:** value `"No"` with label `"No supersets"` so `prompt-builder`'s `SUPERSETS_RENDERINGS["No"]` lookup hits.

- [ ] **Step 12.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupersetsStep } from "@/features/onboarding/steps/SupersetsStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 9,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("SupersetsStep", () => {
  it("'No supersets' chip has a visible label of 'No supersets' but emits value 'No'", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<SupersetsStep {...makeProps({ onAnswer })} />);
    await user.click(screen.getByLabelText(/No supersets/));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "No" });
  });
});
```

- [ ] **Step 12.2: Confirm failure**

- [ ] **Step 12.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import {
  ChipWithDescription,
} from "@/features/onboarding/components/ChipWithDescription";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  {
    value: "Yes",
    label: "Yes",
    description: "Use them where they fit",
  },
  {
    value: "Only if time-crunched",
    label: "Only if time-crunched",
    description: "Prefer single exercises when possible",
  },
  {
    value: "No",
    label: "No supersets",
    description: "I like one exercise at a time",
  },
];

export function SupersetsStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Are supersets okay?"
      subtitle="A superset pairs two exercises back-to-back with no rest — saves time, harder on recovery."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipWithDescription
        name="supersets"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Supersets"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 12.4: Run green + commit**

Commit: `feat(onboarding): add SupersetsStep (step 10) with value/label divergence`

---

### Task 13: `CardioStep` (step 11)

- [ ] **Step 13.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardioStep } from "@/features/onboarding/steps/CardioStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 10,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("CardioStep", () => {
  it("'No cardio' chip emits value 'No' and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<CardioStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("No cardio"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "No" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 13.2: Confirm failure**

- [ ] **Step 13.3: Implement**

```tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No cardio" },
];

export function CardioStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Include an optional cardio section?"
      subtitle="A short cardio block at the end of some sessions. Always optional on the day — you can skip it if you're done."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="cardio"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Cardio"
      />
    </WizardShell>
  );
}
```

- [ ] **Step 13.4: Run green + commit**

Commit: `feat(onboarding): add CardioStep (step 11)`

---

## Task 14: `QuestionnaireScreen` orchestrator

**Files:**
- Modify: `web/src/features/onboarding/QuestionnaireScreen.tsx` (replace placeholder)
- Create: `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`

### Behavior

- `useReducer(questionnaireReducer, initialWizardState, init)` where `init` tries `loadWizardState()`; if shape-valid, use it; otherwise fall back to `initialWizardState`.
- `useEffect([state])`: persist via `saveWizardState(state)`. The first mount writes the state too — that's fine; the reducer is idempotent on re-open.
- `useNavigate` for step-11-Next navigation (`navigate("/onboarding/handoff")`).
- `onClose` handler (passed to every step): clears `clearWizardState()`, then `navigate("/", { replace: true })`.
- `onNext` handler: when `stepIndex === TOTAL_STEPS - 1` (= 10), `navigate("/onboarding/handoff")` without dispatching `next` (there's no step 12 to go to). Otherwise dispatch `{ type: "next" }`.
- `onBack`: dispatch `{ type: "back" }`. On step 0, WizardShell already disables the button, so the dispatch is a no-op.
- `onAnswer`: takes the step's `Answer`, dispatches `{ type: "answer", stepId: STEP_IDS[stepIndex], answer }`.

### Step-id mapping (orchestrator-owned)

```ts
const STEP_IDS: readonly StepId[] = [
  "goal",
  "experience",
  "restrictions",
  "daysPerWeek",
  "sessionLength",
  "distinctDays",
  "equipment",
  "priorities",
  "favoritesAvoid",
  "supersets",
  "cardio",
];
```

### Step rendering

`switch (state.stepIndex)` returning the right `<XyzStep>` with the common 6 props.

- [ ] **Step 14.1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import QuestionnaireScreen from "@/features/onboarding/QuestionnaireScreen";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";

function WithRouter({ initialPath = "/onboarding/questionnaire" }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("QuestionnaireScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders step 1 (goal) on fresh mount", () => {
    render(<WithRouter />);
    expect(screen.getByRole("heading", { name: /What's your main goal/i })).toBeInTheDocument();
  });

  it("resumes at the saved stepIndex when sessionStorage has valid state", async () => {
    saveWizardState({ stepIndex: 3, answers: {} });
    render(<WithRouter />);
    // Step 3 in user-facing terms is index 3: DaysPerWeek.
    expect(await screen.findByRole("heading", { name: /How many days/i })).toBeInTheDocument();
  });

  it("auto-advances from step 1 to step 2 after a preset chip tap", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(screen.getByLabelText("Build muscle"));
    expect(await screen.findByRole("heading", { name: /How experienced/i })).toBeInTheDocument();
  });

  it("Back from step 3 keeps the step-2 answer", async () => {
    saveWizardState({
      stepIndex: 2, // RestrictionsStep
      answers: {
        goal: { kind: "chip-with-other", value: "Build muscle" },
        experience: { kind: "chip", value: "Intermediate" },
      },
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    expect(await screen.findByRole("heading", { name: /Anything we should work around/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(await screen.findByRole("heading", { name: /How experienced/i })).toBeInTheDocument();
    // Intermediate stays selected.
    const intermediate = screen.getByLabelText(/Intermediate/);
    expect((intermediate as HTMLInputElement).checked).toBe(true);
  });

  it("Next is disabled on step 7 (equipment) until a selection is made", async () => {
    saveWizardState({
      stepIndex: 6,
      answers: {},
    });
    render(<WithRouter />);
    expect(await screen.findByRole("button", { name: /^next$/i })).toBeDisabled();
  });

  it("step-11 Next navigates to /onboarding/handoff without persisting a prompt", async () => {
    saveWizardState({
      stepIndex: 10, // CardioStep
      answers: {},
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    expect(await screen.findByRole("heading", { name: /cardio section/i })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Yes"));
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();
    // sessionStorage NOT cleared yet — Sprint D owns that.
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
```

- [ ] **Step 14.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
Expected: failures — the placeholder screen doesn't do any of this.

- [ ] **Step 14.3: Implement**

Replace `web/src/features/onboarding/QuestionnaireScreen.tsx`:

```tsx
// Orchestrator binds reducer ↔ sessionStorage. Persistence of the generated
// prompt happens in HandoffScreen (Sprint D), not here. Clearing the wizard's
// sessionStorage also happens there (on Stage-1 success) per spec §Mid-wizard
// resume. This screen only clears sessionStorage on explicit exit (close
// dialog confirm).

import { useEffect, useReducer } from "react";
import { useNavigate } from "react-router";
import {
  questionnaireReducer,
  initialWizardState,
  TOTAL_STEPS,
  type WizardState,
} from "@/features/onboarding/lib/questionnaire-state";
import {
  loadWizardState,
  saveWizardState,
  clearWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Answer, StepId } from "@/features/onboarding/lib/types";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";
import { ExperienceStep } from "@/features/onboarding/steps/ExperienceStep";
import { RestrictionsStep } from "@/features/onboarding/steps/RestrictionsStep";
import { DaysPerWeekStep } from "@/features/onboarding/steps/DaysPerWeekStep";
import { SessionLengthStep } from "@/features/onboarding/steps/SessionLengthStep";
import { DistinctDaysStep } from "@/features/onboarding/steps/DistinctDaysStep";
import { EquipmentStep } from "@/features/onboarding/steps/EquipmentStep";
import { PrioritiesStep } from "@/features/onboarding/steps/PrioritiesStep";
import { FavoritesAvoidStep } from "@/features/onboarding/steps/FavoritesAvoidStep";
import { SupersetsStep } from "@/features/onboarding/steps/SupersetsStep";
import { CardioStep } from "@/features/onboarding/steps/CardioStep";

const STEP_IDS: readonly StepId[] = [
  "goal",
  "experience",
  "restrictions",
  "daysPerWeek",
  "sessionLength",
  "distinctDays",
  "equipment",
  "priorities",
  "favoritesAvoid",
  "supersets",
  "cardio",
];

function initWizard(): WizardState {
  const resumed = loadWizardState();
  if (resumed !== null) return resumed;
  return initialWizardState;
}

export default function QuestionnaireScreen() {
  const [state, dispatch] = useReducer(
    questionnaireReducer,
    undefined as unknown as WizardState,
    initWizard
  );
  const navigate = useNavigate();

  useEffect(() => {
    saveWizardState(state);
  }, [state]);

  const onAnswer = (answer: Answer) => {
    const stepId = STEP_IDS[state.stepIndex];
    if (stepId !== undefined) {
      dispatch({ type: "answer", stepId, answer });
    }
  };

  const onBack = () => dispatch({ type: "back" });

  const onNext = () => {
    if (state.stepIndex >= TOTAL_STEPS - 1) {
      // Sprint D reads the same sessionStorage state from HandoffScreen and
      // commits the prompt on Stage 1. Do NOT clear sessionStorage here.
      navigate("/onboarding/handoff");
      return;
    }
    dispatch({ type: "next" });
  };

  const onClose = () => {
    clearWizardState();
    dispatch({ type: "restart" });
    navigate("/", { replace: true });
  };

  const stepProps = {
    stepIndex: state.stepIndex,
    answer: state.answers[STEP_IDS[state.stepIndex] as StepId],
    onAnswer,
    onBack,
    onNext,
    onClose,
  };

  switch (state.stepIndex) {
    case 0:
      return <GoalStep {...stepProps} />;
    case 1:
      return <ExperienceStep {...stepProps} />;
    case 2:
      return <RestrictionsStep {...stepProps} />;
    case 3:
      return <DaysPerWeekStep {...stepProps} />;
    case 4:
      return <SessionLengthStep {...stepProps} />;
    case 5:
      return <DistinctDaysStep {...stepProps} />;
    case 6:
      return <EquipmentStep {...stepProps} />;
    case 7:
      return <PrioritiesStep {...stepProps} />;
    case 8:
      return <FavoritesAvoidStep {...stepProps} />;
    case 9:
      return <SupersetsStep {...stepProps} />;
    case 10:
      return <CardioStep {...stepProps} />;
    default:
      return <GoalStep {...stepProps} />;
  }
}
```

- [ ] **Step 14.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
Expected: 6 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **~843** green. Ignore the `useRoutineLaunchQueue` flake if it surfaces.

- [ ] **Step 14.5: Commit**

```bash
git add web/src/features/onboarding/QuestionnaireScreen.tsx web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx
git commit -m "feat(onboarding): add QuestionnaireScreen orchestrator with reducer + sessionStorage binding"
```

---

## Task 15: Walkthrough integration test (ties to D10 prompt-builder lock)

**Files:**
- Create: `web/tests/integration/onboarding-walkthrough.test.tsx`

Drives all 11 steps end-to-end and verifies the final `buildPrompt(state.answers)` string satisfies the D10 line.

- [ ] **Step 15.1: Write the test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import QuestionnaireScreen from "@/features/onboarding/QuestionnaireScreen";
import { loadWizardState } from "@/features/onboarding/lib/session-storage";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route
          path="/onboarding/questionnaire"
          element={<QuestionnaireScreen />}
        />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("onboarding walkthrough (integration)", () => {
  it("completes 11 steps and the resulting buildPrompt contains the D10 line", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<WithRouter />);

    // Step 1: Goal — Build muscle.
    await user.click(await screen.findByLabelText("Build muscle"));

    // Step 2: Experience — Intermediate.
    await user.click(await screen.findByLabelText(/Intermediate/));

    // Step 3: Restrictions — skip.
    await user.click(
      await screen.findByRole("button", { name: /all clear — skip/i })
    );

    // Step 4: DaysPerWeek — 3.
    await user.click(await screen.findByLabelText("3"));

    // Step 5: SessionLength — 60 min.
    await user.click(await screen.findByLabelText("60 min"));

    // Step 6: DistinctDays — 3.
    await user.click(await screen.findByLabelText("3"));

    // Step 7: Equipment — Barbell + Dumbbells, then Next.
    await user.click(await screen.findByRole("button", { name: /^barbell$/i }));
    await user.click(await screen.findByRole("button", { name: /^dumbbells$/i }));
    // Pick the Next in the WizardShell footer (not inside any chip).
    // The shell Next is the only button matching exactly "Next".
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // Step 8: Priorities — skip.
    await user.click(
      await screen.findByRole("button", { name: /keep it balanced — skip/i })
    );

    // Step 9: FavoritesAvoid — leave both empty, just tap Next.
    await screen.findByRole("textbox", { name: /love/i });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // Step 10: Supersets — Yes.
    await user.click(await screen.findByLabelText(/^Yes$/));

    // Step 11: Cardio — Yes.
    await user.click(await screen.findByLabelText("Yes"));

    // After step-11 auto-advance we land on HANDOFF.
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();

    // Inspect sessionStorage and build the prompt.
    const stored = loadWizardState();
    expect(stored).not.toBeNull();
    const prompt = buildPrompt(stored!.answers);

    // D10 lock: bare number, no parenthetical.
    expect(prompt).toContain("- Distinct training days desired: 3");
    expect(prompt).not.toContain("Distinct training days desired: 3 (");
    // A handful of other expected lines for cohesion.
    expect(prompt).toContain("- Primary goal: Build muscle");
    expect(prompt).toContain("- Days per week available: 3");
    expect(prompt).toContain("- Typical session length: 60 minutes");
    expect(prompt).toContain("- Available equipment: Barbell, Dumbbells");
    expect(prompt).toContain("- Supersets: Yes — use them where they fit");
    expect(prompt).toContain("- Cardio section: Yes — include optional cardio");
    // Skipped optional bullets are absent.
    expect(prompt).not.toContain("Injuries / restrictions");
    expect(prompt).not.toContain("Muscle groups to prioritize");
    expect(prompt).not.toContain("Favorite exercises (include):");
    expect(prompt).not.toContain("Exercises to avoid:");
  });
});
```

- [ ] **Step 15.2: Run and confirm green**

Run: `cd web && npm test -- --run tests/integration/onboarding-walkthrough.test.tsx`
Expected: 1 test passes.

Full suite: `cd web && npm test -- --run`
Expected: **~844** green.

- [ ] **Step 15.3: Commit**

```bash
git add web/tests/integration/onboarding-walkthrough.test.tsx
git commit -m "test(onboarding): integration walkthrough with D10 buildPrompt lock"
```

---

## Task 16: Polish — extend `features/onboarding/CLAUDE.md`

**Files:**
- Modify: `web/src/features/onboarding/CLAUDE.md`

Append a section listing the routes and step files that landed in Sprint C.

- [ ] **Step 16.1: Read the current file** (`web/src/features/onboarding/CLAUDE.md`) to find the Sprint-C placeholder comment block added in Sprint B.

- [ ] **Step 16.2: Replace the `# Sprint C adds:` comment block** with the following real list. The pre-existing commented-out block lives inside the `Module shape` code fence and looks like:

```
  # Sprint C adds:
  #   OnboardingWelcomeScreen.tsx
  #   QuestionnaireScreen.tsx    (the orchestrator that binds session-storage)
  #   steps/*.tsx                (11 step components)
```

Remove the leading `# ` hash-prefix on those lines so they become part of the documented structure, and expand the `steps/*.tsx` line into explicit filenames:

```
  OnboardingWelcomeScreen.tsx    # route /onboarding
  QuestionnaireScreen.tsx        # route /onboarding/questionnaire
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
    CardioStep.tsx               # step 11
```

Also add, right below the invariants list, a new subsection:

```markdown
## Routes owned by this feature

| Route | Component | Sprint |
|---|---|---|
| `/onboarding` | `OnboardingWelcomeScreen` | C |
| `/onboarding/questionnaire` | `QuestionnaireScreen` | C |
| `/onboarding/handoff` | `HandoffScreen` | D (pending) |
```

- [ ] **Step 16.3: Sanity test run**

Run: `cd web && npm test -- --run`
Expected: ~844 green, unchanged.

- [ ] **Step 16.4: Commit**

```bash
git add web/src/features/onboarding/CLAUDE.md
git commit -m "docs(onboarding): document Sprint C screens, steps, and routes"
```

---

## Exit criteria for Sprint C

- [ ] `cd web && npm test -- --run` green at ~844 tests (spec estimate ~816; we overshoot because step tests trade specificity for clarity).
- [ ] `/onboarding/questionnaire` is navigable end-to-end in `npm run dev`: welcome → 11 steps → `/onboarding/handoff` (which 404s or renders the placeholder — handoff is Sprint D).
- [ ] Integration test `onboarding-walkthrough.test.tsx` runs `buildPrompt(answers)` at the end and asserts the D10 line.
- [ ] No step component imports Dexie, `onboarding-service`, `setUserName`, `buildPrompt`, or `HandoffScreen`.
- [ ] `QuestionnaireScreen` does NOT call `saveGeneratedPrompt`, does NOT call `buildPrompt`, and does NOT clear sessionStorage on step-11 Next.
- [ ] `TodayScreen.tsx`, `SettingsScreen.tsx`, `RoutineImportScreen.tsx` are UNCHANGED.
- [ ] `App.tsx` adds exactly 2 lazy imports + 2 routes — no gate logic, no redirect guards.
- [ ] Step 6 chips are pure numbers `"1"/"2"/"3"/"4"/"5"` — the `DistinctDaysStep` test asserts no `"Push/Pull/Legs"` / `"Upper/Lower"` / `"full-body"` leaks into the chip group (D10).
- [ ] sessionStorage resume works on reload (covered by `QuestionnaireScreen.test.tsx`'s "resumes at the saved stepIndex" case).
- [ ] Frozen step-props contract (`{ stepIndex, answer, onAnswer, onBack, onNext, onClose }`) is identical across all 11 step files.
- [ ] `web/package.json` unchanged.

---

## Self-review

**Spec coverage:**
- §Welcome screen (`/onboarding`) → Task 2.
- §Step copy — final (all 11 rows) → Tasks 3–13 with subtitles from this plan's subtitle table.
- §Step 6 copy (D10 lock) → Task 8 with a negative assertion + integration D10 assertion in Task 15.
- §State management (reducer-dispatched actions) → Task 14 orchestrator wiring.
- §Auto-advance rules → per-step `autoAdvance` prop + `handleSelect` → `queueMicrotask(onNext)` pattern.
- §Mid-wizard resume → Task 14 `useReducer` with `initWizard` + `useEffect([state])` persist.
- §Validation & input limits — `maxLength`s and counter thresholds in `RestrictionsStep` (300/240), `FavoritesAvoidStep` (200/160), `GoalStep` Other input (60), welcome name (40).
- §Accessibility — reused via `WizardShell` (progressbar aria, heading focus, close button aria-label), `ChipRow`/`ChipMulti` (aria-pressed, radiogroup semantics), `StepTextArea` (aria-label).

**Placeholder scan:** no `TODO`, `TBD`, "similar to", or "fill in" left. Every code block is complete. Tasks 7 (`SessionLengthStep`) omits a full file body and instead refers to the DaysPerWeekStep skeleton — I left the differences as a constants-only delta (title, subtitle, options, stepIndex) and a same-skeleton note. That qualifies as "similar to Task N" which I committed to not write. **Fix inline below.**

**Inline fix — Task 7 full body:**

```tsx
// web/src/features/onboarding/steps/SessionLengthStep.tsx
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "75", label: "75 min" },
  { value: "90", label: "90 min" },
];

export function SessionLengthStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Schedule"
      title="How long is a typical session?"
      subtitle="Time you have for the whole workout — warm-up, lifts, everything."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="session-length"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Session length"
      />
    </WizardShell>
  );
}
```

**Type consistency:** `StepProps` is the same shape in every step file. `StepId`, `Answer`, `Answers`, `WizardState`, `WizardAction`, `TOTAL_STEPS`, `questionnaireReducer`, `initialWizardState` all match Sprint A / Sprint B's exports. The orchestrator's `STEP_IDS` array has exactly 11 elements matching the `StepId` union. `ChipOption` reused from `@/features/onboarding/components/ChipRow` in every consumer. Chip values match the prompt-builder's renderings (supersets `"No"`, cardio `"No"`, sessionLength numeric strings).

**Scope discipline:** zero Settings/Today edits. Zero `onboarding-service` calls from step components. Zero `buildPrompt` call inside orchestrator (only in the integration test). No first-run gate.

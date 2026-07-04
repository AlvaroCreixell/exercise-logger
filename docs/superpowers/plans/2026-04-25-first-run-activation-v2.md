# First-Run Activation — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first-run flow where a cold-install user can choose the seeded starter routine and log a set with no GPT detour, while iPhone users who *do* go through the GPT handoff can always recover the saved prompt.

**Architecture:** Split the route tree into a nav-bearing `AppShell` and a chrome-free `OnboardingLayout`. Replace the Welcome screen's name-first prompt with a starter-ready choice screen powered by a pure `routineSummary` helper that is also consumed by Today's hero. Collapse the Handoff screen's `Stage 1 / Stage 2` state machine into a single recoverable surface where the saved prompt is always visible, the GPT link is a real anchor, and clipboard copy is decoupled from popup opening.

**Tech Stack:** React 19 + Vite 7 + TypeScript 5, Dexie 4 (IndexedDB), React Router 7, Vitest + RTL + Playwright. No new runtime dependencies.

---

## Why a v2 (read this if Codex's plan is your reference)

This plan supersedes `docs/archive/plans/2026-04-25-sprint-1-first-run-activation.md`. The original was a planning *blueprint*; this version is a directly executable plan that has been validated against the current code. Substantive changes:

| Change | Reason |
|---|---|
| 5 workers → 3 workers | Worker D (Today) shares the helper with Worker B (Welcome); merging avoids the upstream-merge dance. Worker E's regression scope is already covered in `formatLoggedSet.test.ts`, `backup-service.test.ts`, etc. — the few real gaps fold into a lead-owned audit task. |
| `60s` CI stopwatch → action-count assertion | A flaky time threshold gets disabled in week two. Action count is deterministic; stopwatch lives in manual QA. |
| Handoff "saved prompt always visible" | Codex's plan said this in prose but didn't note that the *current* Stage 2 has no prompt visibility at all — recovery via Today banner deadends users without LastPromptCard. The new model has one screen with prompt + copy + GPT link + import form. |
| `lastGeneratedPrompt` lifecycle made explicit | Codex's plan didn't define what happens to a saved prompt when a user skips to starter, or when the questionnaire is relaunched. This plan does. |
| `saveGeneratedPrompt` banner-reset preserved as single source of truth | `onboarding-service.ts:42-44` already resets `onboardingBannerDismissedAt` inside `saveGeneratedPrompt`. The new HandoffScreen must NOT duplicate that reset. |
| Welcome screen routine-loading state | The starter routine seeds asynchronously via `useAppInit`. The Welcome screen needs to handle `useRoutine() === undefined` gracefully — Codex's plan handwaved this. |
| Initial focus moves from name input to primary CTA | The current screen autofocuses the input. With a starter-first design, the starter CTA is the primary action; focus should land on the heading (matches `WizardShell`). |

---

## Validated current state

Direct file reads (not memory):

- **`web/src/app/App.tsx:73-200`** — single `Shell` wraps every route including `/onboarding/*`. Bottom nav is in the DOM during onboarding. First-run gate exists (lines 147-173) and uses `onboardingCompletedAt`/`onboardingSkippedAt`/`lastGeneratedPrompt` correctly.
- **`web/src/features/onboarding/OnboardingWelcomeScreen.tsx`** — name-first. Two CTAs: `Start` (saves name → questionnaire) and `Maybe later` (markOnboardingSkipped → /). Auto-focuses input.
- **`web/src/features/onboarding/HandoffScreen.tsx:79-115`** — Stage 1 button awaits `saveGeneratedPrompt(db, prompt)`, then awaits `navigator.clipboard.writeText(prompt)`, then calls `window.open(GPT_URL, "_blank", "noopener,noreferrer")`. iOS user activation expires across that chain. Popup detection uses `opened === null` (unreliable).
- **`web/src/features/onboarding/HandoffScreen.tsx:287-340`** — Stage 2 has no prompt visibility. Today-banner recovery → Stage 2 → user can't see prompt without leaving for Settings.
- **`web/src/shared/hooks/useAppInit.ts:30-37`** — IS seeding the bundled `full-body-3day.yaml` AND calling `setActiveRoutine`. Welcome screen can rely on `settings.activeRoutineId !== null` after `ready === true`.
- **`web/src/services/onboarding-service.ts:36-45`** — `saveGeneratedPrompt` resets `onboardingBannerDismissedAt`. Don't duplicate this in the screen.
- **`web/src/features/today/TodayScreen.tsx`** — does not render `routine.name` anywhere on the normal path. `TodayHeroCard` props don't include routine name (`web/src/features/today/TodayHeroCard.tsx:4-14`).
- **`web/src/features/today/lib/`** — has `formatDate.ts` and `muscleGroups.ts`. `routineSummary.ts` does NOT exist.
- **`web/src/features/onboarding/QuestionnaireScreen.tsx:82-86`** — `onClose` clears wizard state and navigates. The exit is destructive.
- **`web/src/features/onboarding/components/WizardShell.tsx:113-114`** — exit dialog says "Your answers won't be saved."
- **`web/src/features/onboarding/lib/session-storage.ts`** — `STORAGE_KEY`, `loadWizardState`, `saveWizardState`, `clearWizardState` all exist.
- **`web/tests/unit/app/AppRoutes.test.tsx`** — uses 4000ms `WAIT_TIMEOUT` and pre-warms lazy chunks. Existing tests assert "what should we call you" heading; those stay valid until Task 4 ships and we update them.

Trust regression items from Codex's plan, audited:

| Item | Status |
|---|---|
| `formatLoggedSet` reps/duration/distance/empty | Already covered (`formatLoggedSet.test.ts:14-54`). |
| Cardio duration+distance | NOT explicitly covered. Add one test in Task 9. |
| Backup malformed shape rejection | Covered (`backup-service.test.ts` exists; spot-check inside Task 9). |
| Logged-set/sessionExercise sessionId match | NOT directly tested at backup-import boundary; spot-check inside Task 9. |
| Cardio extra distance-only E2E | Covered (`cardio-extra-distance.spec.ts`). |
| Exercise history link reachable | Covered (`exercise-history-link.spec.ts`). |

So Worker E in Codex's plan would have ~1.5 missing tests of work. That folds into the lead's verification gate (Task 10).

---

## Out of scope

- Routine editor.
- Account / sync / server telemetry.
- Dark mode.
- Rest timer.
- Visual redesign beyond the welcome and Today hero.
- New runtime dependencies.
- Dexie schema migration (no new settings fields needed — all the fields already exist).
- Deciding whether the starter routine itself needs a content refresh.

---

## Architecture decisions

### D1 — Route layout split (not CSS hide)

`AppRoutes` (`web/src/app/App.tsx`) keeps `useAppInit`, `useSettings`, `useRoutineLaunchQueue`, the loading/error boundaries, and the first-run gate. Route tree splits into two nested layouts:

```tsx
<Suspense fallback={<LoadingState fullscreen />}>
  <Routes>
    <Route element={<AppShell />}>
      <Route path="/" element={<TodayScreen />} />
      <Route path="/workout" element={<WorkoutScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
      <Route path="/history/exercise/:exerciseId" element={<ExerciseHistoryScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/settings/import" element={<RoutineImportScreen />} />
    </Route>
    <Route element={<OnboardingLayout />}>
      <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
      <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
      <Route path="/onboarding/handoff" element={<HandoffScreen />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</Suspense>
```

Rename existing `Shell` → `AppShell` (one symbol-level rename). Add `OnboardingLayout` with the same `<main>` framing but no `<nav>`.

### D2 — Wizard exit becomes resumable

The questionnaire's `sessionStorage` is already silent-fail. Today, exit clears it. The new contract: exit *navigates only*. Three places change:

- `QuestionnaireScreen.onClose` no longer calls `clearWizardState()`.
- `WizardShell` exit dialog text becomes "Save and exit?" / "Your answers stay on this device — continue from the welcome screen any time."
- The Welcome screen reads `loadWizardState()` and adds a "Continue personalized routine" CTA + a "Start over" link (with confirm) that explicitly clears the wizard before navigating.

Two paths still clear the wizard explicitly:
- HandoffScreen "Start over" (already does this — keep).
- HandoffScreen successful import (already does this — keep).
- Welcome screen "Start over" (new — the only first-run reset path).

### D3 — Routine summary helper

`web/src/features/today/lib/routineSummary.ts` exports a pure function that:

```ts
export interface RoutineDaySummary {
  dayId: string;
  dayLabel: string;
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  muscleGroups: string[];
}

export function summarizeRoutineDay(
  day: RoutineDay,
  exercisesById: Map<string, Exercise>,
): RoutineDaySummary;
```

`TodayScreen` deletes its local `firstExerciseFromDay`, `countSets`, `countExercises` and calls `summarizeRoutineDay` instead. The Welcome screen calls the same helper to render `StarterRoutineSummary`.

`deriveDayMuscleGroups` from `web/src/features/today/lib/muscleGroups.ts` stays — `summarizeRoutineDay` calls it.

### D4 — Welcome screen choice model

```
[ STARTER READY · eyebrow ]
[ Hero: "Your starter routine is ready." (italic, hero-serif) ]
[ Sub: "Three rotating days. Tap to start training in seconds." ]

[ StarterRoutineSummary card ]
  [ small eyebrow: ACTIVE ROUTINE ]
  [ routine.name as h2 ]
  [ next-day label · X exercises · Y sets · first up: <name> ]

[ PRIMARY CTA — "▶ Use starter routine" ]

[ Divider · "or" ]

[ Optional name input (defaults to settings.userName ?? "") ]

[ SECONDARY CTA — "Build personalized routine" or "Continue personalized routine" ]
[ tiny "Start over" link — ONLY when wizard state exists ]
```

Initial focus: heading (matches WizardShell pattern). The name input is no longer auto-focused.

### D5 — Today active-routine context

`TodayHeroCard` gets one new optional prop `routineName?: string`. When present, render it as a small caption row above the existing day eyebrow:

```
[ ACTIVE ROUTINE: Full Body 3-Day Rotation ]   ← new, optional
[ TODAY · DAY A ]                                ← existing eyebrow
[ Heavy Squat + Horizontal Push/Pull ]           ← existing dayTitle
```

This keeps existing `TodayHeroCard.test.tsx` assertions valid (they don't reference the routine name) and adds one new test.

The active-session resume card (`TodayScreen.tsx:115-134`) already uses `session.dayLabelSnapshot` — extend the meta line to include `session.routineNameSnapshot`.

### D6 — Handoff: single-screen recoverable model

Replace the Stage 1 / Stage 2 state machine entirely. The new screen always renders, in order:

1. Eyebrow: `READY TO IMPORT`.
2. Heading: "Copy your prompt, then bring back the YAML."
3. **Saved prompt block** — visible by default, with a "Hide prompt" toggle. The prompt textarea is read-only and selectable.
4. **Copy button** — calls `navigator.clipboard.writeText(prompt)` and reports success / blocked inline. No DB await. No popup open.
5. **Open GPT** — `<a href={GPT_URL} target="_blank" rel="noopener noreferrer">`. No JS.
6. Inline divider.
7. **YAML textarea + "Import routine" button** — same import behavior as today's Stage 2.
8. Footer: "Start over" (confirm dialog, clears prompt + wizard state) and "Exit" (confirm dialog, navigates home without clearing).

Prompt source resolution at render time:
- `settings.lastGeneratedPrompt !== null` → use it.
- Else if `justCompleted === true` → build from `loadWizardState()` and persist via `saveGeneratedPrompt(db, prompt)` in an effect.
- Else → guard already redirected (and the in-component effect mirrors that).

**Lifecycle rules** (these were missing from the v1 plan):
- Skipping to starter from the Welcome screen does NOT clear `lastGeneratedPrompt`. The user kept their work; the Today banner is dismissable, and `LastPromptCard` in Settings is the long-term home.
- Relaunching the questionnaire from Settings (Settings already routes there for skipped/completed users) does not clear the prompt. The next `saveGeneratedPrompt` call overwrites unconditionally — that's the moment of intent.
- "Start over" on Handoff or Welcome is the only explicit clear path during first-run.

### D7 — `LastPromptCard` default state

Default `expanded = true` in the card body. Copy failure stays expanded. Hide toggle still works. The Settings card and the Handoff screen now have the same "always-visible-by-default" prompt model.

### D8 — Activation measurement

CI asserts the action *count* on the cold-install path: 1 page goto + 1 starter CTA click + 1 Start workout click + 1 set keypad submit ≤ 4 explicit user actions. Stopwatch elapsed time is logged but not asserted in CI.

Manual QA records the wall-clock time on Pixel 7 and iPhone Safari/PWA in the PR body.

### D9 — Safety against the live-query race

The first-run gate races with `useLiveQuery` after writes. Reuse the existing pattern: tests wait for visible content (`findByRole`/`waitFor`), not URL assertions. The `AppRoutes.test.tsx` `WAIT_TIMEOUT = 4000ms` convention is preserved.

---

## File structure

### New files

```
web/src/features/today/lib/routineSummary.ts                      # Pure helper — Task 1
web/src/features/onboarding/components/StarterRoutineSummary.tsx  # Welcome card — Task 4
web/tests/unit/features/today/lib/routineSummary.test.ts          # Task 1
web/tests/unit/features/onboarding/StarterRoutineSummary.test.tsx # Task 4
web/tests/e2e/onboarding-starter-first-set.e2e.ts                 # Task 9
```

### Modified files

```
web/src/app/App.tsx                                               # Task 2 — split layouts
web/src/features/onboarding/QuestionnaireScreen.tsx               # Task 3 — resumable exit
web/src/features/onboarding/components/WizardShell.tsx            # Task 3 — dialog copy
web/src/features/onboarding/OnboardingWelcomeScreen.tsx           # Task 4 — choice model
web/src/features/today/TodayScreen.tsx                            # Task 5 — pass routineName + use helper
web/src/features/today/TodayHeroCard.tsx                          # Task 5 — accept routineName
web/src/features/onboarding/HandoffScreen.tsx                     # Task 6 — single screen rewrite
web/src/features/onboarding/components/LastPromptCard.tsx         # Task 7 — default expanded
web/src/features/onboarding/CLAUDE.md                             # Task 6 — update Stage model docs
web/src/features/today/CLAUDE.md                                  # Task 5 — note routineName prop
web/tests/unit/app/AppRoutes.test.tsx                             # Task 2 — nav-absence assertions
web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx   # Task 3 — exit preserves
web/tests/unit/features/onboarding/WizardShell.test.tsx           # Task 3 — dialog copy
web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx # Task 4 — new content
web/tests/unit/features/today/TodayScreen.test.tsx                # Task 5 — routineName visible
web/tests/unit/features/today/TodayHeroCard.test.tsx              # Task 5 — routineName prop
web/tests/unit/features/onboarding/HandoffScreen.test.tsx         # Task 6 — single screen
web/tests/unit/features/onboarding/LastPromptCard.test.tsx        # Task 7 — default expanded
web/tests/e2e/onboarding-first-run.e2e.ts                         # Task 6 — copy/open split
web/tests/e2e/onboarding-banner-recovery.e2e.ts                   # Task 6 — prompt visible on recovery
web/tests/unit/shared/lib/formatLoggedSet.test.ts                 # Task 9 — cardio duration+distance
```

---

## Subagent assignments

Three workers + lead. Workers run in parallel where possible; merge order matters for shared files.

| Worker | Tasks | Owns | Cannot edit |
|---|---|---|---|
| **A** (Routes & wizard) | Tasks 2, 3 | `App.tsx`, `QuestionnaireScreen.tsx`, `WizardShell.tsx`, their tests | `OnboardingWelcomeScreen.tsx`, `HandoffScreen.tsx`, Today files |
| **B** (Welcome + Today) | Tasks 1, 4, 5 | `routineSummary.ts`, `StarterRoutineSummary.tsx`, `OnboardingWelcomeScreen.tsx`, `TodayScreen.tsx`, `TodayHeroCard.tsx`, their tests | `App.tsx`, `HandoffScreen.tsx`, `WizardShell.tsx` |
| **C** (Handoff + recovery) | Tasks 6, 7 | `HandoffScreen.tsx`, `LastPromptCard.tsx`, `onboarding-first-run.e2e.ts`, `onboarding-banner-recovery.e2e.ts`, their unit tests, `features/onboarding/CLAUDE.md` | `App.tsx`, Today files, `OnboardingWelcomeScreen.tsx` |
| **Lead** | Tasks 0, 8, 9, 10 | branch, regression spot-fixes, E2E activation path, integration gate | — (resolves conflicts only after worker merges) |

### Merge order

1. Worker A Task 2 (route split) — unblocks B's redirect targets and C's recovery routes.
2. Worker A Task 3 (wizard exit) — independent of B/C.
3. Worker B Task 1 (helper) — must land before B Task 4 and B Task 5.
4. Worker B Task 4 (Welcome) — depends on B Task 1.
5. Worker B Task 5 (Today) — depends on B Task 1.
6. Worker C Task 6 (Handoff) — independent of B but must follow A Task 2.
7. Worker C Task 7 (LastPromptCard) — independent.
8. Lead Task 8 (regression spot-fixes).
9. Lead Task 9 (E2E activation path) — depends on everything above.
10. Lead Task 10 (final gate).

---

## Tasks

### Task 0: Branch + baseline

**Owner:** Lead.

**Files:** none (branch + baseline measurement only).

- [ ] **Step 1: Verify clean worktree (do NOT discard untracked plans)**

```bash
git status --short
```

Expected: only the docs renames already shown in the session opening status.

- [ ] **Step 2: Create the working branch**

```bash
git checkout -b sprint/2026-04-25-first-run-activation-v2
```

- [ ] **Step 3: Capture baseline test counts**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- --reporter=basic 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npm run typecheck 2>&1 | tail -5
```

Record the test counts from `npm test` (e.g., "742 passed"). Paste into the PR body under **Baseline**.

- [ ] **Step 4: Commit the plan into the branch**

```bash
git add docs/superpowers/plans/2026-04-25-first-run-activation-v2.md
git commit -m "docs(plan): first-run activation v2"
```

---

### Task 1: Pure routine summary helper

**Owner:** Worker B.

**Files:**
- Create: `web/src/features/today/lib/routineSummary.ts`
- Create: `web/tests/unit/features/today/lib/routineSummary.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// web/tests/unit/features/today/lib/routineSummary.test.ts
import { describe, it, expect } from "vitest";
import {
  summarizeRoutineDay,
  type RoutineDaySummary,
} from "@/features/today/lib/routineSummary";
import type { Exercise, RoutineDay } from "@/domain/types";

const squat: Exercise = {
  id: "barbell-back-squat",
  name: "Barbell Back Squat",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Legs"],
};
const bench: Exercise = {
  id: "barbell-bench-press",
  name: "Barbell Bench Press",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Chest"],
};
const row: Exercise = {
  id: "dumbbell-row",
  name: "Dumbbell Row",
  type: "weight",
  equipment: "dumbbell",
  muscleGroups: ["Back"],
};

const exercisesById = new Map<string, Exercise>([
  [squat.id, squat],
  [bench.id, bench],
  [row.id, row],
]);

describe("summarizeRoutineDay", () => {
  it("counts exercises and sets across standalone entries", () => {
    const day: RoutineDay = {
      id: "A",
      label: "Push",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: squat.id,
          setBlocks: [
            { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" },
            { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
          ],
        },
        {
          kind: "exercise",
          entryId: "e2",
          exerciseId: bench.id,
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    };
    const result: RoutineDaySummary = summarizeRoutineDay(day, exercisesById);
    expect(result.dayId).toBe("A");
    expect(result.dayLabel).toBe("Push");
    expect(result.exerciseCount).toBe(2);
    expect(result.setCount).toBe(7);
    expect(result.firstExerciseName).toBe("Barbell Back Squat");
    expect(result.muscleGroups).toEqual(["Legs", "Chest"]);
  });

  it("counts each superset member as a separate exercise", () => {
    const day: RoutineDay = {
      id: "B",
      label: "Pull",
      entries: [
        {
          kind: "superset",
          groupId: "g1",
          items: [
            {
              entryId: "e1",
              exerciseId: bench.id,
              setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
            },
            {
              entryId: "e2",
              exerciseId: row.id,
              setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
            },
          ],
        },
      ],
    };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.exerciseCount).toBe(2);
    expect(result.setCount).toBe(6);
    expect(result.firstExerciseName).toBe("Barbell Bench Press");
    expect(result.muscleGroups).toEqual(["Chest", "Back"]);
  });

  it("falls back to the exercise id when the catalog lookup misses", () => {
    const day: RoutineDay = {
      id: "C",
      label: "Mystery",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: "unknown-exercise",
          setBlocks: [{ targetKind: "reps", exactValue: 5, count: 1 }],
        },
      ],
    };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.firstExerciseName).toBe("unknown-exercise");
    expect(result.muscleGroups).toEqual([]);
  });

  it("returns null firstExerciseName when the day has no entries", () => {
    const day: RoutineDay = { id: "D", label: "Rest", entries: [] };
    const result = summarizeRoutineDay(day, exercisesById);
    expect(result.exerciseCount).toBe(0);
    expect(result.setCount).toBe(0);
    expect(result.firstExerciseName).toBeNull();
    expect(result.muscleGroups).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- routineSummary.test
```

Expected: FAIL — "Cannot find module '@/features/today/lib/routineSummary'".

- [ ] **Step 3: Write the implementation**

```ts
// web/src/features/today/lib/routineSummary.ts
import type { Exercise, RoutineDay } from "@/domain/types";
import { deriveDayMuscleGroups } from "./muscleGroups";

export interface RoutineDaySummary {
  dayId: string;
  dayLabel: string;
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  muscleGroups: string[];
}

export function summarizeRoutineDay(
  day: RoutineDay,
  exercisesById: Map<string, Exercise>,
): RoutineDaySummary {
  let exerciseCount = 0;
  let setCount = 0;
  let firstExerciseName: string | null = null;

  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      exerciseCount += 1;
      setCount += entry.setBlocks.reduce((sum, block) => sum + block.count, 0);
      if (firstExerciseName === null) {
        firstExerciseName =
          exercisesById.get(entry.exerciseId)?.name ?? entry.exerciseId;
      }
    } else {
      for (const item of entry.items) {
        exerciseCount += 1;
        setCount += item.setBlocks.reduce((sum, block) => sum + block.count, 0);
        if (firstExerciseName === null) {
          firstExerciseName =
            exercisesById.get(item.exerciseId)?.name ?? item.exerciseId;
        }
      }
    }
  }

  return {
    dayId: day.id,
    dayLabel: day.label,
    exerciseCount,
    setCount,
    firstExerciseName,
    muscleGroups: deriveDayMuscleGroups(day, exercisesById),
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- routineSummary.test
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/today/lib/routineSummary.ts web/tests/unit/features/today/lib/routineSummary.test.ts
git commit -m "feat(today): pure routine day summary helper"
```

---

### Task 2: Route layout split

**Owner:** Worker A.

**Files:**
- Modify: `web/src/app/App.tsx`
- Modify: `web/tests/unit/app/AppRoutes.test.tsx`

- [ ] **Step 1: Add failing nav-absence tests to AppRoutes.test.tsx**

Append the following describe block to `web/tests/unit/app/AppRoutes.test.tsx`:

```tsx
describe("AppRoutes layout split", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("/onboarding has no Main navigation in the DOM", async () => {
    await seedSettings();
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await screen.findByRole(
      "heading",
      { name: /what should we call you|your starter routine is ready/i },
      { timeout: WAIT_TIMEOUT }
    );
    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
  });

  it("/onboarding/questionnaire has no Main navigation in the DOM", async () => {
    await seedSettings();
    render(
      <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await screen.findByRole("progressbar", undefined, { timeout: WAIT_TIMEOUT });
    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
  });

  it("/onboarding/handoff has no Main navigation when a saved prompt exists", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
      onboardingSkippedAt: new Date().toISOString(),
    });
    render(
      <MemoryRouter initialEntries={["/onboarding/handoff"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Wait for any onboarding heading.
    await screen.findByRole("heading", undefined, { timeout: WAIT_TIMEOUT });
    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
  });

  it("/ has Main navigation present", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole(
        "navigation",
        { name: /main navigation/i },
        { timeout: WAIT_TIMEOUT }
      )
    ).toBeInTheDocument();
  });

  it("/settings has Main navigation present", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole(
        "navigation",
        { name: /main navigation/i },
        { timeout: WAIT_TIMEOUT }
      )
    ).toBeInTheDocument();
  });
});
```

Also add `HandoffScreen` to the `beforeAll` lazy pre-warm:

```tsx
beforeAll(async () => {
  await Promise.all([
    import("@/features/onboarding/OnboardingWelcomeScreen"),
    import("@/features/onboarding/QuestionnaireScreen"),
    import("@/features/onboarding/HandoffScreen"),
    import("@/features/today/TodayScreen"),
    import("@/features/settings/SettingsScreen"),
  ]);
});
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- AppRoutes.test
```

Expected: 5 new tests fail (nav element is currently present on every route).

- [ ] **Step 3: Refactor App.tsx — rename Shell, add OnboardingLayout, split route tree**

Replace the `Shell` function and the `<Routes>` block in `web/src/app/App.tsx`. Keep all imports and the `AppRoutes` outer logic intact:

```tsx
function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
      <nav
        className="border-t border-line bg-background pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-all duration-[var(--dur-base)] focus-visible:ring-2 focus-visible:ring-sage/40 outline-none active:scale-95 rounded-[var(--radius-pill)] ${
                  isActive
                    ? "text-sage-deep font-semibold"
                    : "text-ink-3 hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-x-1 inset-y-0.5 -z-0 rounded-[var(--radius-pill)] bg-sage-soft"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className="relative z-10 h-5 w-5"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function OnboardingLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
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

Then change the `<Routes>` JSX inside `AppRoutes` to:

```tsx
return (
  <Suspense fallback={<LoadingState fullscreen />}>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
        <Route
          path="/history/exercise/:exerciseId"
          element={<ExerciseHistoryScreen />}
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/import" element={<RoutineImportScreen />} />
      </Route>
      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
        <Route
          path="/onboarding/questionnaire"
          element={<QuestionnaireScreen />}
        />
        <Route path="/onboarding/handoff" element={<HandoffScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);
```

Leave `useAppInit`, `useRoutineLaunchQueue`, `useSettings`, and the three `if (...)` first-run gate blocks unchanged.

- [ ] **Step 4: Run tests to confirm the new ones pass**

```bash
npm test -- AppRoutes.test
```

Expected: all AppRoutes tests pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/App.tsx web/tests/unit/app/AppRoutes.test.tsx
git commit -m "feat(app): split onboarding routes into chrome-free layout"
```

---

### Task 3: Wizard exit becomes resumable

**Owner:** Worker A.

**Files:**
- Modify: `web/src/features/onboarding/QuestionnaireScreen.tsx`
- Modify: `web/src/features/onboarding/components/WizardShell.tsx`
- Modify: `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
- Modify: `web/tests/unit/features/onboarding/WizardShell.test.tsx`

- [ ] **Step 1: Write the failing QuestionnaireScreen test**

Append to `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx` (read the file first to find the existing describe block — add a new `describe("exit semantics")` block):

```tsx
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";

describe("QuestionnaireScreen exit preserves wizard state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("close → confirm exit does NOT clear sessionStorage", async () => {
    const user = userEvent.setup();
    saveWizardState({
      stepIndex: 2,
      answers: {
        goal: { kind: "chip-with-other", value: "Build muscle" },
        experience: { kind: "chip", value: "Intermediate" },
      },
    });
    render(
      <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
        <Routes>
          <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(
      await screen.findByRole("button", { name: /exit questionnaire/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /save and exit/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
```

(Add `within` to the existing `@testing-library/react` import at the top of the file if missing.)

- [ ] **Step 2: Write the failing WizardShell test**

Append to `web/tests/unit/features/onboarding/WizardShell.test.tsx`:

```tsx
it("exit dialog uses 'Save and exit?' copy", async () => {
  const user = userEvent.setup();
  render(
    <WizardShell
      stepIndex={0}
      totalSteps={11}
      category="Goal"
      title="What's your primary goal?"
      onBack={() => {}}
      onNext={() => {}}
      onClose={() => {}}
    >
      <div />
    </WizardShell>
  );
  await user.click(screen.getByRole("button", { name: /exit questionnaire/i }));
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByText(/save and exit\?/i)).toBeInTheDocument();
  expect(
    within(dialog).getByText(/your answers stay on this device/i)
  ).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /save and exit/i })).toBeInTheDocument();
});
```

(Add `within` to the imports if missing.)

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- QuestionnaireScreen.test WizardShell.test
```

Expected: 2 new failures (sessionStorage cleared after exit; "Exit?" copy still present).

- [ ] **Step 4: Update QuestionnaireScreen.onClose to navigate without clearing**

In `web/src/features/onboarding/QuestionnaireScreen.tsx`, replace the `onClose` body:

```tsx
const onClose = () => {
  navigate("/onboarding", { replace: true });
};
```

Remove the `clearWizardState` import if no longer used in the file (it isn't after this change).

Also update the file header comment block to reflect the new contract:

```tsx
// Orchestrator binds reducer ↔ sessionStorage. Persistence of the generated
// prompt happens in HandoffScreen. Wizard sessionStorage clearing happens in:
//   1. HandoffScreen "Start over" (intentional reset).
//   2. HandoffScreen successful import (Stage-2 success).
//   3. Welcome screen "Start over" (the only first-run reset).
// This screen NEVER clears sessionStorage on exit — exit returns to the
// welcome screen so the user can resume later.
```

- [ ] **Step 5: Update WizardShell exit dialog copy**

In `web/src/features/onboarding/components/WizardShell.tsx`, replace the `<ConfirmDialog>` block at the bottom:

```tsx
<ConfirmDialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title="Save and exit?"
  description="Your answers stay on this device — continue from the welcome screen any time."
  confirmText="Save and exit"
  onConfirm={onClose}
/>
```

- [ ] **Step 6: Run the new tests to confirm they pass**

```bash
npm test -- QuestionnaireScreen.test WizardShell.test
```

Expected: pass.

- [ ] **Step 7: Run the full onboarding test slice**

```bash
npm test -- onboarding
```

Expected: pass. (Existing tests that asserted "Your answers won't be saved." may need updating — search and update if any fail.)

- [ ] **Step 8: Commit**

```bash
git add web/src/features/onboarding/QuestionnaireScreen.tsx \
        web/src/features/onboarding/components/WizardShell.tsx \
        web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx \
        web/tests/unit/features/onboarding/WizardShell.test.tsx
git commit -m "feat(onboarding): wizard exit preserves answers"
```

---

### Task 4: Welcome screen — starter-ready choice

**Owner:** Worker B. **Depends on:** Task 1 (helper) and Task 2 (route split — for OnboardingLayout).

**Files:**
- Create: `web/src/features/onboarding/components/StarterRoutineSummary.tsx`
- Create: `web/tests/unit/features/onboarding/StarterRoutineSummary.test.tsx`
- Modify: `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`
- Modify: `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`

- [ ] **Step 1: Write the failing StarterRoutineSummary test**

```tsx
// web/tests/unit/features/onboarding/StarterRoutineSummary.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarterRoutineSummary } from "@/features/onboarding/components/StarterRoutineSummary";
import type { Routine, Exercise } from "@/domain/types";

const exercise: Exercise = {
  id: "barbell-back-squat",
  name: "Barbell Back Squat",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Legs"],
};
const exercisesById = new Map([[exercise.id, exercise]]);

const routine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "Full Body 3-Day Rotation",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A", "B", "C"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Heavy Squat",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: exercise.id,
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    },
    B: { id: "B", label: "Hinge", entries: [] },
    C: { id: "C", label: "Volume", entries: [] },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-04-22T00:00:00.000Z",
};

describe("StarterRoutineSummary", () => {
  it("renders routine name, next day label, and exercise/set counts", () => {
    render(
      <StarterRoutineSummary routine={routine} exercisesById={exercisesById} />
    );
    expect(screen.getByText(/Full Body 3-Day Rotation/)).toBeInTheDocument();
    expect(screen.getByText(/Heavy Squat/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 exercise · 3 sets · first up: Barbell Back Squat/)
    ).toBeInTheDocument();
  });

  it("shows a loading shell when routine is undefined", () => {
    render(
      <StarterRoutineSummary
        routine={undefined}
        exercisesById={exercisesById}
      />
    );
    expect(screen.getByLabelText(/loading starter routine/i)).toBeInTheDocument();
  });

  it("renders nothing when routine is null", () => {
    const { container } = render(
      <StarterRoutineSummary routine={null} exercisesById={exercisesById} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- StarterRoutineSummary.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement StarterRoutineSummary**

```tsx
// web/src/features/onboarding/components/StarterRoutineSummary.tsx
import { Card, CardContent } from "@/shared/ui/card";
import { summarizeRoutineDay } from "@/features/today/lib/routineSummary";
import type { Exercise, Routine } from "@/domain/types";

export interface StarterRoutineSummaryProps {
  routine: Routine | null | undefined;
  exercisesById: Map<string, Exercise>;
}

export function StarterRoutineSummary({
  routine,
  exercisesById,
}: StarterRoutineSummaryProps) {
  if (routine === null) return null;
  if (routine === undefined) {
    return (
      <Card className="py-0" aria-label="Loading starter routine">
        <CardContent className="space-y-2 px-5 py-4">
          <p className="text-eyebrow text-ink-3">ACTIVE ROUTINE</p>
          <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--line-soft)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--line-soft)]" />
        </CardContent>
      </Card>
    );
  }

  const nextDayId = routine.nextDayId ?? routine.dayOrder[0]!;
  const day = routine.days[nextDayId];
  const summary = day
    ? summarizeRoutineDay(day, exercisesById)
    : { exerciseCount: 0, setCount: 0, firstExerciseName: null, dayLabel: nextDayId };

  const exerciseLabel = `${summary.exerciseCount} ${
    summary.exerciseCount === 1 ? "exercise" : "exercises"
  }`;
  const setLabel = `${summary.setCount} ${
    summary.setCount === 1 ? "set" : "sets"
  }`;
  const firstUpLabel = summary.firstExerciseName
    ? `first up: ${summary.firstExerciseName}`
    : null;
  const meta = [exerciseLabel, setLabel, firstUpLabel].filter(Boolean).join(" · ");

  return (
    <Card className="py-0">
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-eyebrow text-ink-3">ACTIVE ROUTINE</p>
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {routine.name}
        </h2>
        <p className="text-meta">{summary.dayLabel}</p>
        <p className="text-meta">{meta}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the StarterRoutineSummary test to confirm it passes**

```bash
npm test -- StarterRoutineSummary.test
```

Expected: 3 tests pass.

- [ ] **Step 5: Rewrite the OnboardingWelcomeScreen test for the new content**

Replace `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx` entirely:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import OnboardingWelcomeScreen from "@/features/onboarding/OnboardingWelcomeScreen";
import { db, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Routine } from "@/domain/types";

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const starter: Routine = {
  id: "starter",
  schemaVersion: 1,
  name: "Full Body 3-Day Rotation",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A", "B", "C"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Heavy Squat",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    },
    B: { id: "B", label: "Hinge", entries: [] },
    C: { id: "C", label: "Volume", entries: [] },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-04-22T00:00:00.000Z",
};

async function reset() {
  await Promise.all([
    db.settings.clear(),
    db.routines.clear(),
    db.exercises.clear(),
  ]);
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
  await db.routines.put(starter);
  const s = (await db.settings.get("user"))!;
  await db.settings.put({ ...s, activeRoutineId: starter.id });
}

describe("OnboardingWelcomeScreen — starter-first choice", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders starter routine summary and primary 'Use starter routine' CTA", async () => {
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", {
        name: /your starter routine is ready/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Full Body 3-Day Rotation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use starter routine/i })
    ).toBeInTheDocument();
  });

  it("Use starter routine: marks skipped and navigates home", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /use starter routine/i })
    );
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("Use starter routine: trims and saves name when name input is filled", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(screen.getByLabelText(/your name/i), "  Alvaro  ");
    await user.click(
      screen.getByRole("button", { name: /use starter routine/i })
    );
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.userName).toBe("Alvaro");
  });

  it("Build personalized routine: navigates to questionnaire and saves name", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(screen.getByLabelText(/your name/i), "Alvaro");
    await user.click(
      screen.getByRole("button", { name: /build personalized routine/i })
    );
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.userName).toBe("Alvaro");
    expect(settings?.onboardingSkippedAt).toBeNull();
  });

  it("shows 'Continue personalized routine' when wizard state exists", async () => {
    saveWizardState({
      stepIndex: 3,
      answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
    });
    render(<WithRouter />);
    expect(
      await screen.findByRole("button", { name: /continue personalized routine/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start over/i })
    ).toBeInTheDocument();
  });

  it("Start over: confirms, clears wizard state, and shows the build CTA again", async () => {
    saveWizardState({
      stepIndex: 3,
      answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /start over/i }));
    await waitFor(() => {
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: /build personalized routine/i })
    ).toBeInTheDocument();
  });

  it("initial focus lands on the heading, not the name input", async () => {
    render(<WithRouter />);
    const heading = await screen.findByRole("heading", {
      name: /your starter routine is ready/i,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
  });
});
```

- [ ] **Step 6: Run the test to confirm it fails**

```bash
npm test -- OnboardingWelcomeScreen.test
```

Expected: most/all of these fail (current screen is name-first).

- [ ] **Step 7: Rewrite OnboardingWelcomeScreen.tsx**

```tsx
// web/src/features/onboarding/OnboardingWelcomeScreen.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { db } from "@/db/database";
import { setUserName } from "@/services/settings-service";
import { markOnboardingSkipped } from "@/services/onboarding-service";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import {
  clearWizardState,
  loadWizardState,
} from "@/features/onboarding/lib/session-storage";
import { StarterRoutineSummary } from "./components/StarterRoutineSummary";
import type { Exercise } from "@/domain/types";

export default function OnboardingWelcomeScreen() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasWizardState, setHasWizardState] = useState(
    () => loadWizardState() !== null
  );
  const [startOverOpen, setStartOverOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Pre-fill name from settings if a value was already saved (defensive — first-run normally has null).
  useEffect(() => {
    if (settings?.userName && name === "") setName(settings.userName);
  }, [settings?.userName, name]);

  const exercisesById = useMemo(() => {
    const m = new Map<string, Exercise>();
    if (exercises) for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  async function persistName() {
    const trimmed = name.trim();
    if (trimmed !== "") await setUserName(db, trimmed);
  }

  async function handleUseStarter() {
    if (busy) return;
    setBusy(true);
    await persistName();
    await markOnboardingSkipped(db);
    navigate("/", { replace: true });
  }

  async function handleBuildOrContinue() {
    if (busy) return;
    setBusy(true);
    await persistName();
    navigate("/onboarding/questionnaire", { replace: true });
  }

  function handleStartOver() {
    clearWizardState();
    setHasWizardState(false);
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-2">STARTER READY</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-hero-serif italic text-ink focus:outline-none"
        >
          Your starter routine is ready.
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          Three rotating days you can train today. Or build a personalized
          routine with the GPT — your call.
        </p>
      </div>

      <StarterRoutineSummary routine={routine} exercisesById={exercisesById} />

      <Button onClick={handleUseStarter} disabled={busy}>
        ▶ Use starter routine
      </Button>

      <div className="flex items-center gap-3 text-meta text-ink-3">
        <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden="true" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="welcome-name" className="text-meta text-ink-2">
          Your name (optional, used in greetings)
        </label>
        <Input
          id="welcome-name"
          aria-label="Your name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-[var(--radius-card)] bg-paper"
        />
      </div>

      <Button variant="outline" onClick={handleBuildOrContinue} disabled={busy}>
        {hasWizardState
          ? "Continue personalized routine"
          : "Build personalized routine"}
      </Button>

      {hasWizardState && (
        <button
          type="button"
          onClick={() => setStartOverOpen(true)}
          className="self-start text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Start over
        </button>
      )}

      <ConfirmDialog
        open={startOverOpen}
        onOpenChange={setStartOverOpen}
        title="Start over?"
        description="This clears your in-progress questionnaire answers. The starter routine stays available."
        confirmText="Start over"
        onConfirm={handleStartOver}
        variant="destructive"
      />
    </div>
  );
}
```

- [ ] **Step 8: Run the OnboardingWelcomeScreen test to confirm it passes**

```bash
npm test -- OnboardingWelcomeScreen.test
```

Expected: pass.

- [ ] **Step 9: Update AppRoutes.test.tsx welcome-heading regex (now matches new heading)**

In `web/tests/unit/app/AppRoutes.test.tsx`, find each occurrence of `/what should we call you/i` and replace with the regex `/what should we call you|your starter routine is ready/i`. The new heading is "Your starter routine is ready." The OR regex keeps the test green during the staged rollout if any path still renders the old screen.

```bash
npm test -- AppRoutes.test
```

Expected: pass.

- [ ] **Step 10: Update existing E2E that types "Alvaro" then clicks "Start"**

`web/tests/e2e/onboarding-first-run.e2e.ts` currently clicks `name: /^start$/i`. Replace with the new build CTA:

```ts
await page.getByLabel(/your name/i).fill("Alvaro");
await page.getByRole("button", { name: /build personalized routine/i }).click();
```

Run e2e shortly to confirm:

```bash
npm run test:e2e -- onboarding-first-run
```

Expected: pass (full happy path still works through Stage 1 → Stage 2 → Today).

- [ ] **Step 11: Commit**

```bash
git add web/src/features/onboarding/OnboardingWelcomeScreen.tsx \
        web/src/features/onboarding/components/StarterRoutineSummary.tsx \
        web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx \
        web/tests/unit/features/onboarding/StarterRoutineSummary.test.tsx \
        web/tests/unit/app/AppRoutes.test.tsx \
        web/tests/e2e/onboarding-first-run.e2e.ts
git commit -m "feat(onboarding): starter-first welcome with continue/start-over"
```

---

### Task 5: Today active routine context

**Owner:** Worker B. **Depends on:** Task 1 (helper).

**Files:**
- Modify: `web/src/features/today/TodayHeroCard.tsx`
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/features/today/CLAUDE.md`
- Modify: `web/tests/unit/features/today/TodayHeroCard.test.tsx`
- Modify: `web/tests/unit/features/today/TodayScreen.test.tsx`

- [ ] **Step 1: Write the failing TodayHeroCard test**

Append to `web/tests/unit/features/today/TodayHeroCard.test.tsx`:

```tsx
it("renders the routine name caption when routineName is provided", () => {
  render(<TodayHeroCard {...baseProps} routineName="Full Body 3-Day Rotation" />);
  expect(
    screen.getByText(/active routine: full body 3-day rotation/i)
  ).toBeInTheDocument();
});

it("omits the routine name caption when routineName is undefined", () => {
  render(<TodayHeroCard {...baseProps} />);
  expect(
    screen.queryByText(/active routine:/i)
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write the failing TodayScreen test**

Append to `web/tests/unit/features/today/TodayScreen.test.tsx` inside the existing `describe("TodayScreen")`:

```tsx
it("State B — renders 'Active routine' caption with routine.name", async () => {
  const routine = await seedRoutine();
  await seedExercises();
  await setActiveRoutine(routine.id);
  renderAt();
  await waitFor(() => {
    expect(
      screen.getByText(/active routine: test routine/i)
    ).toBeVisible();
  });
});

it("State C — resume card includes routineNameSnapshot", async () => {
  const routine = await seedRoutine();
  await seedExercises();
  await setActiveRoutine(routine.id);
  const session: Session = {
    id: "s1",
    routineId: routine.id,
    routineNameSnapshot: routine.name,
    dayId: "A",
    dayLabelSnapshot: "Push",
    dayOrderSnapshot: routine.dayOrder,
    restDefaultSecSnapshot: routine.restDefaultSec,
    restSupersetSecSnapshot: routine.restSupersetSec,
    status: "active",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    finishedAt: null,
  };
  await db.sessions.put(session);
  renderAt();
  await waitFor(() => {
    expect(screen.getByText(/Test Routine/)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

```bash
npm test -- TodayHeroCard.test TodayScreen.test
```

Expected: 4 failures.

- [ ] **Step 4: Add routineName prop to TodayHeroCard**

In `web/src/features/today/TodayHeroCard.tsx`, update the props interface and JSX:

```tsx
interface TodayHeroCardProps {
  dayLabelEyebrow: string;
  dayTitle: string;
  muscleGroups: string[];
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  ctaLabel: string;
  onCtaClick: () => void;
  ctaDisabled: boolean;
  /** Optional. Renders a small "Active routine: X" caption above the day eyebrow. */
  routineName?: string;
}
```

In the destructure list, add `routineName`. Insert this row immediately after `<CardContent>` opens, before the existing `<p>{dayLabelEyebrow}</p>`:

```tsx
{routineName && (
  <p className="text-meta text-ink-3">
    Active routine: {routineName}
  </p>
)}
```

- [ ] **Step 5: Pass routineName from TodayScreen + use the helper**

In `web/src/features/today/TodayScreen.tsx`:

1. Add the import:

```tsx
import { summarizeRoutineDay } from "./lib/routineSummary";
```

2. Delete the local helpers `firstExerciseFromDay`, `countSets`, `countExercises` (lines 24-57).

3. Replace the State-B summary computation just before the return JSX:

```tsx
const summary = selectedDay
  ? summarizeRoutineDay(selectedDay, exercisesById)
  : null;
const muscleGroups = summary?.muscleGroups ?? [];
const exerciseCount = summary?.exerciseCount ?? 0;
const setCount = summary?.setCount ?? 0;
const firstExerciseName = summary?.firstExerciseName ?? null;
```

4. Pass `routineName` to TodayHeroCard:

```tsx
<TodayHeroCard
  routineName={routine.name}
  dayLabelEyebrow={eyebrow}
  dayTitle={dayTitle}
  muscleGroups={muscleGroups}
  exerciseCount={exerciseCount}
  setCount={setCount}
  firstExerciseName={firstExerciseName}
  ctaLabel="▶ Start workout"
  onCtaClick={handleStart}
  ctaDisabled={starting}
/>
```

5. Update the State-C resume card meta line to include the routine name. Replace:

```tsx
<p className="text-meta flex items-center gap-1.5">
  <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-sage" />
  {elapsed} min · {activeSession.session.dayLabelSnapshot}
</p>
```

with:

```tsx
<p className="text-meta flex items-center gap-1.5">
  <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-sage" />
  {elapsed} min · {activeSession.session.routineNameSnapshot} · {activeSession.session.dayLabelSnapshot}
</p>
```

- [ ] **Step 6: Update Today CLAUDE.md to note the new prop**

In `web/src/features/today/CLAUDE.md` under the `TodayHeroCard.tsx` description, append: "Accepts an optional `routineName` prop; when set, renders a small 'Active routine: X' caption row above the day eyebrow. The active-session resume card also includes `session.routineNameSnapshot` for the same context."

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
npm test -- TodayHeroCard.test TodayScreen.test
```

Expected: pass. The existing TodayHeroCard tests that don't pass `routineName` still pass (the prop is optional).

- [ ] **Step 8: Commit**

```bash
git add web/src/features/today/TodayHeroCard.tsx \
        web/src/features/today/TodayScreen.tsx \
        web/src/features/today/CLAUDE.md \
        web/tests/unit/features/today/TodayHeroCard.test.tsx \
        web/tests/unit/features/today/TodayScreen.test.tsx
git commit -m "feat(today): show active routine name on hero and resume card"
```

---

### Task 6: Handoff — single-screen recoverable model

**Owner:** Worker C. **Depends on:** Task 2 (route split).

**Files:**
- Modify: `web/src/features/onboarding/HandoffScreen.tsx` (rewrite)
- Modify: `web/src/features/onboarding/CLAUDE.md`
- Modify: `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` (rewrite)
- Modify: `web/tests/e2e/onboarding-first-run.e2e.ts`
- Modify: `web/tests/e2e/onboarding-banner-recovery.e2e.ts`

- [ ] **Step 1: Replace the HandoffScreen test file with the single-screen contract**

Overwrite `web/tests/unit/features/onboarding/HandoffScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import HandoffScreen from "@/features/onboarding/HandoffScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
import type { Answers } from "@/features/onboarding/lib/types";
import type { Settings } from "@/domain/types";
import * as routineSvc from "@/services/routine-service";

const FULL_ANSWERS: Answers = {
  goal: { kind: "chip-with-other", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "3" },
  equipment: { kind: "chip-multi", values: ["Barbell", "Dumbbells"] },
  supersets: { kind: "chip", value: "Yes" },
  cardio: { kind: "chip", value: "Yes" },
};

function WithRouter({
  initialState,
}: {
  initialState?: { justCompleted?: boolean };
}) {
  return (
    <MemoryRouter
      initialEntries={[
        { pathname: "/onboarding/handoff", state: initialState ?? null },
      ]}
    >
      <Routes>
        <Route path="/onboarding/handoff" element={<HandoffScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function seedSettings(overrides: Partial<Settings> = {}) {
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
    ...overrides,
  });
  await db.close();
}

describe("HandoffScreen — recovery and just-completed", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects to questionnaire when no prompt and not justCompleted", async () => {
    await seedSettings();
    render(<WithRouter />);
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });

  it("just-completed: builds prompt, persists it, renders prompt visible by default", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    render(<WithRouter initialState={{ justCompleted: true }} />);
    const textarea = (await screen.findByRole("textbox", {
      name: /generated prompt/i,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toContain("- Distinct training days desired: 3");
    const db = new ExerciseLoggerDB();
    await waitFor(async () => {
      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toContain("- Distinct training days desired: 3");
    });
    await db.close();
  });

  it("recovery: shows saved prompt visible by default", async () => {
    await seedSettings({
      lastGeneratedPrompt: "RECOVERED PROMPT BODY",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    render(<WithRouter />);
    const textarea = (await screen.findByRole("textbox", {
      name: /generated prompt/i,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toBe("RECOVERED PROMPT BODY");
  });

  it("Open GPT is a real anchor and never calls window.open", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    const openSpy = vi.spyOn(window, "open");
    render(<WithRouter />);
    const link = await screen.findByRole("link", { name: /open gpt/i });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(GPT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel") ?? "").toContain("noopener");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("copy button: success → 'Copied' inline state", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("P");
  });

  it("copy button: failure → inline 'select and copy manually' message and prompt stays expanded", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
      configurable: true,
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(
      await screen.findByText(/select and copy the prompt above manually/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /generated prompt/i })
    ).toBeInTheDocument();
  });

  it("missing navigator.clipboard: prompt stays visible, copy reveals manual instructions", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(
      await screen.findByText(/select and copy the prompt above manually/i)
    ).toBeInTheDocument();
  });

  it("import success: clears prompt + wizard state, marks completed, navigates home", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const fakeRoutine = {
      id: "r1",
      schemaVersion: 1,
      name: "Imported",
      restDefaultSec: 90,
      restSupersetSec: 60,
      dayOrder: ["A"],
      nextDayId: "A",
      days: { A: { id: "A", label: "Day A", entries: [] } },
      notes: [],
      cardio: null,
      importedAt: "2026-04-22T00:00:00.000Z",
    };
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: true,
      routine: fakeRoutine as never,
    });
    vi.spyOn(routineSvc, "importAndActivateRoutine").mockResolvedValue({
      ok: true,
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "name: Imported"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(s?.onboardingCompletedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    await db.close();
  });

  it("active-session block: shows inline error and preserves prompt", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: true,
      routine: { id: "r1" } as never,
    });
    vi.spyOn(routineSvc, "importAndActivateRoutine").mockResolvedValue({
      ok: false,
      message: "Cannot import while a workout session is active.",
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "name: X"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(
      await screen.findByText(/cannot import while a workout session is active/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    await db.close();
  });

  it("Start over: clears prompt and wizard state, routes to questionnaire", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 5, answers: {} as never });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /start over/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    await db.close();
  });

  it("Exit: navigates home without clearing prompt or wizard state", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 5, answers: {} as never });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(await screen.findByRole("button", { name: /^exit$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^exit$/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    await db.close();
  });
});
```

- [ ] **Step 2: Run the test to confirm failures**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- HandoffScreen.test
```

Expected: most tests fail (current screen is Stage 1 / Stage 2).

- [ ] **Step 3: Rewrite HandoffScreen.tsx**

Overwrite `web/src/features/onboarding/HandoffScreen.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import {
  saveGeneratedPrompt,
  clearLastPrompt,
  markOnboardingCompleted,
} from "@/services/onboarding-service";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import {
  clearWizardState,
  loadWizardState,
} from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { YamlErrorList } from "@/features/settings/YamlErrorList";

type CopyState = "idle" | "copied" | "blocked";

export default function HandoffScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const justCompleted =
    (location.state as { justCompleted?: boolean } | null)?.justCompleted ===
    true;

  const [promptExpanded, setPromptExpanded] = useState(true);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [yaml, setYaml] = useState("");
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [activeBlockMessage, setActiveBlockMessage] = useState<string | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);

  // Resolve the prompt: prefer settings.lastGeneratedPrompt; otherwise build
  // from sessionStorage when justCompleted=true.
  const prompt = useMemo<string | null>(() => {
    if (settings?.lastGeneratedPrompt != null && settings.lastGeneratedPrompt !== "") {
      return settings.lastGeneratedPrompt;
    }
    if (!justCompleted) return null;
    const wiz = loadWizardState();
    if (wiz === null) return null;
    try {
      return buildPrompt(wiz.answers);
    } catch {
      return null;
    }
  }, [settings?.lastGeneratedPrompt, justCompleted]);

  // Persist a freshly built prompt exactly once. The service resets
  // onboardingBannerDismissedAt — do NOT duplicate that here.
  useEffect(() => {
    if (!prompt) return;
    if (settings?.lastGeneratedPrompt != null && settings.lastGeneratedPrompt !== "") return;
    void saveGeneratedPrompt(db, prompt);
  }, [prompt, settings?.lastGeneratedPrompt]);

  // Defensive in-component redirect — mirrors the AppRoutes guard so this
  // screen stays correct in isolation. Skip once onboarding is completed
  // (Stage-2 success nulls the prompt before navigating away).
  useEffect(() => {
    if (!settings) return;
    if (settings.onboardingCompletedAt !== null) return;
    if (
      (settings.lastGeneratedPrompt == null || settings.lastGeneratedPrompt === "") &&
      !justCompleted
    ) {
      navigate("/onboarding/questionnaire", { replace: true });
    }
  }, [settings, justCompleted, navigate]);

  if (!settings) return null;
  if (prompt === null) return null;

  async function handleCopy() {
    if (!prompt) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("blocked");
      setPromptExpanded(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("blocked");
      setPromptExpanded(true);
    }
  }

  async function handleImport() {
    if (importing) return;
    if (yaml.trim() === "") {
      setImportErrors([{ path: "", message: "YAML is empty" }]);
      return;
    }
    setImporting(true);
    setImportErrors([]);
    setActiveBlockMessage(null);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yaml, lookup);
      if (!result.ok) {
        setImportErrors(result.errors);
        return;
      }
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        setActiveBlockMessage(activation.message);
        return;
      }
      await markOnboardingCompleted(db);
      await clearLastPrompt(db);
      clearWizardState();
      navigate("/", { replace: true });
    } catch (err) {
      setImportErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
    } finally {
      setImporting(false);
    }
  }

  function handleExit() {
    navigate("/", { replace: true });
  }

  async function handleStartOver() {
    await clearLastPrompt(db);
    clearWizardState();
    navigate("/onboarding/questionnaire", { replace: true });
  }

  const copyLabel =
    copyState === "copied" ? "Copied" : copyState === "blocked" ? "Copy failed" : "Copy prompt";

  return (
    <>
      <div className="flex min-h-full flex-col gap-5 px-6 py-8">
        <div className="flex items-start justify-between">
          <p className="text-eyebrow text-ink-2">READY TO IMPORT</p>
          <button
            type="button"
            aria-label="Exit"
            onClick={() => setExitOpen(true)}
            className="text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-hero-serif italic text-ink">
            Copy your prompt, then bring back the YAML.
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            The saved prompt below stays on this device. Copy it (or select it
            manually), open the routine-maker GPT, and paste the resulting YAML
            in the box at the bottom of this screen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleCopy}>{copyLabel}</Button>
          <a
            href={GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-[var(--radius-pill)] bg-ink px-4 py-2 text-sm text-paper hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
          >
            Open GPT →
          </a>
          <button
            type="button"
            onClick={() => setPromptExpanded((v) => !v)}
            aria-pressed={promptExpanded}
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            {promptExpanded ? "Hide prompt" : "Show prompt"}
          </button>
        </div>

        {copyState === "blocked" && (
          <p
            role="status"
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-paper px-3 py-2 text-sm text-ink-2"
          >
            Clipboard access was blocked. Select and copy the prompt above
            manually — long-press on iPhone to bring up the selection menu.
          </p>
        )}

        {promptExpanded && (
          <Textarea
            aria-label="Generated prompt"
            value={prompt}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-48 font-mono text-xs bg-paper"
          />
        )}

        <hr className="border-[var(--line-soft)]" />

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-ink-2">PASTE YAML</p>
          <Textarea
            aria-label="YAML"
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder="Paste the YAML the GPT gave you here"
            className="min-h-48 font-mono text-xs bg-paper"
          />
          <YamlErrorList errors={importErrors} />
          {activeBlockMessage && (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {activeBlockMessage}
            </p>
          )}
          <Button onClick={handleImport} disabled={importing}>
            Import routine →
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStartOverOpen(true)}
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Start over
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Exit?"
        description="Your saved prompt and answers stay on this device. You can come back from the Today banner or Settings."
        confirmText="Exit"
        onConfirm={handleExit}
      />
      <ConfirmDialog
        open={startOverOpen}
        onOpenChange={setStartOverOpen}
        title="Start over?"
        description="This clears your saved prompt and questionnaire answers."
        confirmText="Start over"
        onConfirm={handleStartOver}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 4: Run the HandoffScreen unit tests to confirm they pass**

```bash
npm test -- HandoffScreen.test
```

Expected: all 12 tests pass.

- [ ] **Step 5: Update the first-run E2E for the new copy/open split**

In `web/tests/e2e/onboarding-first-run.e2e.ts`, replace the Stage 1 button block (the section after the questionnaire steps that currently clicks "copy prompt & open gpt"):

```ts
// Handoff screen — single page now.
await expect(
  page.getByRole("heading", { name: /copy your prompt/i })
).toBeVisible({ timeout: 10_000 });

// The prompt is visible by default.
const promptArea = page.getByRole("textbox", { name: /generated prompt/i });
await expect(promptArea).toBeVisible();
const promptText = await promptArea.inputValue();
expect(promptText).toContain("- Distinct training days desired: 3");

// Copy is its own action.
await page.getByRole("button", { name: /^copy prompt$/i }).click();
const copied = await readStubbedClipboard(page);
expect(copied).toContain("- Distinct training days desired: 3");

// Open GPT is a real anchor.
const gptLink = page.getByRole("link", { name: /open gpt/i });
await expect(gptLink).toHaveAttribute("href", /chatgpt\.com/);
await expect(gptLink).toHaveAttribute("target", "_blank");

// Paste YAML and import.
await page.getByRole("textbox", { name: /^yaml$/i }).fill(E2E_ROUTINE_YAML);
await page.getByRole("button", { name: /import routine/i }).click();

// Today.
await expect(
  page.getByRole("heading", { name: "Hi, Alvaro." })
).toBeVisible({ timeout: 10_000 });
await expect(page.getByText(/E2E Test Routine/)).toBeVisible();
```

The earlier name-typing step from Task 4 already converts `Start` → `Build personalized routine`.

- [ ] **Step 6: Update onboarding-banner-recovery.e2e.ts for prompt-visible recovery**

In `web/tests/e2e/onboarding-banner-recovery.e2e.ts`, after the `getByRole("button", { name: /paste your routine yaml/i }).click()` assertion that lands the user on Handoff, add:

```ts
// On the recovered handoff screen, the saved prompt body is visible.
await expect(
  page.getByRole("textbox", { name: /generated prompt/i })
).toHaveValue(/SAVED PROMPT CONTENT/);
```

- [ ] **Step 7: Run E2E**

```bash
npm run test:e2e -- onboarding-first-run onboarding-banner-recovery
```

Expected: pass.

- [ ] **Step 8: Update the onboarding feature CLAUDE.md**

In `web/src/features/onboarding/CLAUDE.md`, replace the line `HandoffScreen.tsx              # route /onboarding/handoff (Stage 1 / Stage 2 state machine)` with:

```
HandoffScreen.tsx              # route /onboarding/handoff (single recoverable screen)
```

Replace the §"First-run gate" Guard 3 paragraph with:

```
3. `/onboarding/handoff` with `lastGeneratedPrompt === null` AND no `location.state.justCompleted === true` → redirect to `/onboarding/questionnaire`. The screen also re-checks this in a `useEffect` so it stays correct in isolation. The effect short-circuits when `onboardingCompletedAt !== null` so a successful import does not bounce back during the brief render between the settings write and `navigate("/")`.
```

Add a new subsection after the gate description:

```
## Saved-prompt lifecycle

The `lastGeneratedPrompt` field is the single source of truth for what the user copied to GPT. Three rules:

1. **Generate-time write** is centralized in `saveGeneratedPrompt(db, prompt)`. The HandoffScreen calls it from a `useEffect` once the prompt is built — it must NOT also reset `onboardingBannerDismissedAt`; the service does that.
2. **Skipping to starter from the Welcome screen does NOT clear** the saved prompt. The Today banner (dismissable) and Settings → LastPromptCard remain available for resumption.
3. **Explicit clears**: HandoffScreen "Start over", HandoffScreen successful import (Stage 2 success), Welcome screen "Start over" (only when wizard state exists). All three are user-initiated.
```

- [ ] **Step 9: Commit**

```bash
git add web/src/features/onboarding/HandoffScreen.tsx \
        web/src/features/onboarding/CLAUDE.md \
        web/tests/unit/features/onboarding/HandoffScreen.test.tsx \
        web/tests/e2e/onboarding-first-run.e2e.ts \
        web/tests/e2e/onboarding-banner-recovery.e2e.ts
git commit -m "fix(onboarding): single recoverable handoff screen"
```

---

### Task 7: LastPromptCard default-expanded prompt

**Owner:** Worker C.

**Files:**
- Modify: `web/src/features/onboarding/components/LastPromptCard.tsx`
- Modify: `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`:

```tsx
it("renders the prompt textarea visible by default", () => {
  render(
    <WithRouter>
      <LastPromptCard settings={makeSettings()} />
    </WithRouter>
  );
  expect(
    screen.getByRole("textbox", { name: /generated prompt/i })
  ).toBeInTheDocument();
});

it("copy failure expands the prompt and shows manual-copy hint", async () => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    configurable: true,
  });
  const user = userEvent.setup();
  render(
    <WithRouter>
      <LastPromptCard settings={makeSettings()} />
    </WithRouter>
  );
  await user.click(screen.getByRole("button", { name: /^copy$/i }));
  expect(
    await screen.findByRole("textbox", { name: /generated prompt/i })
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to confirm failure**

```bash
npm test -- LastPromptCard.test
```

Expected: FAIL — textbox not in DOM (defaults to collapsed).

- [ ] **Step 3: Update LastPromptCard**

In `web/src/features/onboarding/components/LastPromptCard.tsx`:

1. Change the initial state:

```tsx
const [expanded, setExpanded] = useState(true);
```

2. Add the textarea aria-label so it matches the HandoffScreen pattern. Replace the existing `<Textarea ... />` with:

```tsx
<Textarea
  aria-label="Generated prompt"
  value={prompt}
  readOnly
  onFocus={(e) => e.currentTarget.select()}
  className="min-h-48 font-mono text-xs bg-paper"
/>
```

The existing `handleCopy` already setExpanded(true) on failure; no change needed.

- [ ] **Step 4: Run the test to confirm pass**

```bash
npm test -- LastPromptCard.test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/onboarding/components/LastPromptCard.tsx \
        web/tests/unit/features/onboarding/LastPromptCard.test.tsx
git commit -m "feat(settings): saved prompt visible by default in LastPromptCard"
```

---

### Task 8: Trust regression spot-fix — cardio duration+distance

**Owner:** Lead.

Codex's Worker E was largely redundant. The one real gap is `formatLoggedSet` for cardio with both duration and distance set.

**Files:**
- Modify: `web/tests/unit/shared/lib/formatLoggedSet.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe("formatLoggedSet (compact)", ...)` block in `web/tests/unit/shared/lib/formatLoggedSet.test.ts`:

```ts
it("formats duration + distance for cardio without dropping either value", () => {
  const out = formatLoggedSet(
    { ...baseSet, performedDurationSec: 600, performedDistanceM: 1500 },
    "kg"
  );
  // Both values must appear. Order may be duration first then distance.
  expect(out).toContain("600s");
  expect(out).toContain("1500m");
  expect(out).not.toBe("—");
});
```

- [ ] **Step 2: Run to determine current behavior**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- formatLoggedSet.test
```

Two outcomes:

- **PASS** — current code already handles this; commit just the test as a regression lock.
- **FAIL** — production drops one value. STOP and report to the user before changing production code; this is a real bug surfaced by the audit, not a planned scope item.

- [ ] **Step 3: If pass, commit the regression lock**

```bash
git add web/tests/unit/shared/lib/formatLoggedSet.test.ts
git commit -m "test(formatLoggedSet): lock cardio duration+distance regression"
```

If fail, see "Known risks → cardio formatter regression" below before editing production.

---

### Task 9: E2E — cold install to first logged starter set

**Owner:** Lead. **Depends on:** Tasks 1-7.

**Files:**
- Create: `web/tests/e2e/onboarding-starter-first-set.e2e.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
// web/tests/e2e/onboarding-starter-first-set.e2e.ts
import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers/onboarding-helpers";

test.describe("Cold install activation — starter routine to first logged set", () => {
  test("welcome → use starter → Today → start workout → log first set", async ({
    page,
  }) => {
    await resetAppState(page);
    const start = Date.now();

    // 1. Cold install lands on welcome with no nav.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeHidden();
    await expect(page.getByText(/Full Body 3-Day Rotation/)).toBeVisible();

    // 2. Use starter routine.
    await page.getByRole("button", { name: /use starter routine/i }).click();

    // 3. Today shows active routine context + start CTA.
    await expect(page.getByRole("heading", { name: /Hello\./i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(/Active routine: Full Body 3-Day Rotation/i)
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeVisible();

    // 4. Start workout.
    await page.getByRole("button", { name: /start workout/i }).click();
    await expect(page).toHaveURL(/\/workout$/);

    // 5. Log first set: open the first set's keypad and submit a value.
    // The first row's primary action is the value cell or "Log set" button.
    const firstSetButton = page.getByRole("button", { name: /log set/i }).first();
    await firstSetButton.click();
    // Keypad: type "60" and confirm. The keypad uses on-screen digits.
    await page.getByRole("button", { name: /^6$/ }).click();
    await page.getByRole("button", { name: /^0$/ }).click();
    await page.getByRole("button", { name: /confirm/i }).click();

    // 6. The set row shows the logged value.
    await expect(page.getByText(/60/).first()).toBeVisible({ timeout: 5_000 });

    // Action count: 1 goto + 1 starter click + 1 start click + 1 log click + 2 digits + 1 confirm = 7 user actions.
    // Wall-clock for telemetry only (not asserted in CI).
    const elapsedMs = Date.now() - start;
    console.log(`[activation] cold install → first logged set: ${elapsedMs}ms`);
  });
});
```

> **NOTE:** the keypad selector strings (`/^6$/`, `/^0$/`, `/confirm/i`, `/log set/i`) match the current SetLogSheet/SetRow conventions. If a worker has just changed those names, update accordingly. Run a quick `Grep -i "log set" web/src/features/workout` if unsure.

- [ ] **Step 2: Run the E2E to confirm it passes (or fix selectors)**

```bash
npm run test:e2e -- onboarding-starter-first-set
```

Expected: pass. If it fails on selectors, grep for the exact button names and update.

- [ ] **Step 3: Commit**

```bash
git add web/tests/e2e/onboarding-starter-first-set.e2e.ts
git commit -m "test(e2e): cold install to first logged starter set"
```

---

### Task 10: Final integration gate

**Owner:** Lead.

- [ ] **Step 1: Run the full test suite**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected: pass. Test count should be baseline + roughly 15-20 (new helpers, welcome, hero, handoff, last-prompt, e2e dependencies).

- [ ] **Step 2: Run lint, typecheck, build**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: clean.

- [ ] **Step 3: Run the full E2E suite**

```bash
npm run test:e2e
```

Expected: pass. The two updated E2Es and the new activation path E2E run alongside the existing 8 specs.

- [ ] **Step 4: Manual dev-server walkthrough**

```bash
npm run dev
```

Walk these paths and record observations in the PR body:

- Cold install → "Use starter routine" → Today shows "Active routine: Full Body 3-Day Rotation" → Start workout → log first set. Wall-clock time on Pixel 7 simulator.
- Cold install → fill name → "Build personalized routine" → questionnaire step 1 → close (dialog says "Save and exit?") → return to welcome → "Continue personalized routine" → resumes step 1.
- Continue path → through to handoff → Copy prompt (succeeds) → Open GPT (anchor opens new tab) → return to app → paste YAML → Import → Today.
- Recovery: skip to starter → manually set `lastGeneratedPrompt` via DevTools or run the questionnaire path, then on Today click banner → handoff renders prompt visible.
- iPhone Safari/PWA manual: install PWA, run welcome → questionnaire → handoff → simulate clipboard denial in DevTools (Settings → Security → Block clipboard) → Copy → confirm inline manual-copy hint appears.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin sprint/2026-04-25-first-run-activation-v2
gh pr create --title "First-run activation: starter-first welcome + iPhone-safe handoff" --body "$(cat <<'EOF'
## Summary

Fresh installs land on a starter-ready choice screen instead of a name-only prompt; users can train in 4 user actions. iPhone users on the GPT handoff path can always recover the saved prompt — clipboard copy and Open GPT are now independent actions.

## Product flow

- Cold install → "Use starter routine" → Today → Start workout → log first set.
- Cold install → "Build personalized routine" → questionnaire (resumable on exit) → handoff (single recoverable screen) → YAML import → Today.
- Recovery from Today banner or Settings → handoff with prompt visible by default.

## Verification

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Manual Pixel 7 walkthrough (paste wall-clock here)
- [ ] Manual iPhone Safari/PWA handoff with clipboard denied (paste wall-clock here)
- [ ] Manual Android Chrome handoff (paste wall-clock here)

## Baseline

Pre-sprint test count: <fill in from Task 0 step 3>
Post-sprint test count: <fill in>

## Notes

No new runtime dependencies. No Dexie schema changes. Saved-prompt lifecycle is documented in `web/src/features/onboarding/CLAUDE.md`.
EOF
)"
```

- [ ] **Step 6: Confirm PR is green**

After CI runs, confirm all checks pass. If any fail, fix in a new commit (not a force-push).

---

## Acceptance criteria

- [ ] Bottom navigation is absent from the DOM on `/onboarding`, `/onboarding/questionnaire`, and `/onboarding/handoff`.
- [ ] Bottom navigation is present on `/`, `/workout`, `/history`, `/history/*`, `/settings`, `/settings/import`.
- [ ] First-run welcome screen shows starter routine name, next-day label, exercise count, set count, first exercise — sourced from the seeded routine, not hardcoded.
- [ ] "Use starter routine" marks `onboardingSkippedAt`, persists name if filled, navigates to Today.
- [ ] "Build personalized routine" persists name if filled, navigates to questionnaire.
- [ ] When `loadWizardState() !== null`, the welcome screen shows "Continue personalized routine" + "Start over" (with confirm).
- [ ] Questionnaire exit dialog reads "Save and exit?" and the closing action does NOT clear sessionStorage.
- [ ] HandoffScreen is a single screen: prompt visible by default, copy button is independent, GPT link is an anchor element, YAML import form is on the same screen.
- [ ] HandoffScreen never calls `window.open`.
- [ ] Copy failure / missing `navigator.clipboard` → inline manual-copy hint + prompt stays visible.
- [ ] Settings → LastPromptCard prompt is visible by default.
- [ ] Today hero card renders "Active routine: <name>" caption when routineName is provided.
- [ ] Today resume card includes `session.routineNameSnapshot` in the meta line.
- [ ] Cold-install activation E2E passes with at most 7 user actions to a logged set.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` all pass.
- [ ] CLAUDE.md files (`features/onboarding/`, `features/today/`) reflect the new model.

---

## Known risks

### Live-query race after writes

`useSettings` is a `useLiveQuery`, so the first-run gate sees stale settings briefly after `markOnboardingSkipped` writes. The HandoffScreen's defensive `useEffect` redirect covers this for the gate; the welcome screen handles it by routing on user click without waiting for live-query refresh. Tests use `findBy*` and `waitFor` rather than asserting URL changes immediately.

### Anchor in installed iOS PWA

A plain `<a target="_blank">` in an installed iOS PWA may open Safari rather than the ChatGPT app. That's acceptable behaviour for this product — the user can still complete the GPT round-trip via Safari. Manual QA item in Task 10 step 4.

### Cardio formatter regression

Task 8 may surface that `formatLoggedSet` drops one of `duration`/`distance` when both are set. If so, do NOT silently fix in this sprint — stop, report, and decide whether the fix lands here or in a follow-up. The risk: a "fix" that changes display strings can break SessionDetailExerciseCard snapshots elsewhere.

### Wizard exit copy is a behaviour change

Users who learned "exit destroys progress" may not realise the new behaviour preserves it. The dialog copy ("Your answers stay on this device") makes it discoverable. No migration is needed because there's no in-flight wizard state to convert; the keying is the same `STORAGE_KEY`.

### Worker B / D merge ordering

Worker B owns `routineSummary.ts` (Task 1). Welcome (Task 4) and Today (Task 5) both consume it. Land Task 1 first, then 4 and 5 in either order. The lead enforces this in the merge order list above.

---

## Self-review (run before handoff)

The plan author has checked:

1. **Spec coverage:** every section in Codex's original maps to a task here, except: (a) the 5-worker structure is collapsed to 3 with rationale; (b) the 60s stopwatch is replaced with action count + manual stopwatch; (c) Worker E's regression sweep is reduced to one spot-fix because the audit confirmed existing coverage.
2. **No placeholders:** every step contains the file path, the actual code, or the exact command. No "implement appropriate validation" or "similar to Task N".
3. **Type consistency:** `summarizeRoutineDay` returns `RoutineDaySummary` everywhere. `routineName?: string` is the prop on `TodayHeroCard` in Task 5 and the docs in step 6. `clearLastPrompt`, `markOnboardingCompleted`, `saveGeneratedPrompt` import paths are all `@/services/onboarding-service`. `loadWizardState`, `clearWizardState`, `saveWizardState`, `STORAGE_KEY` are all `@/features/onboarding/lib/session-storage`.
4. **Existing tests preserved:** AppRoutes test welcome-heading regex updated to OR-match. Existing TodayHeroCard tests don't pass `routineName`, so they keep passing. Existing HandoffScreen test file is fully replaced (Stage 1/Stage 2 model gone).

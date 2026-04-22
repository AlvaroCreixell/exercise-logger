# Onboarding Questionnaire — Sprint B (Wizard Mechanics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the non-screen wizard machinery — a pure reducer, a silent-fail sessionStorage utility, and 5 reusable components (`WizardShell` + 4 input primitives) — that Sprint C will compose into the 11 step screens and a host. No routes, no step components, no Dexie writes.

**Architecture:** Two pure modules under `features/onboarding/lib/` (reducer + storage) with zero React or DB dependencies. Five components under `features/onboarding/components/` that only speak props — they know nothing about sessionStorage, `buildPrompt`, or `onboarding-service`. All components reuse existing `shadcn/ui` primitives (`Button`, `Textarea`), the shared `ConfirmDialog`, and the `cn()` helper. All design tokens already exist in `App.css` (`--radius-pill`, `--radius-card`, `--sage*`, `text-hero-serif`, `text-eyebrow`) — no new CSS.

**Tech Stack:** TypeScript 5 · React 19 · Vitest + `@testing-library/react` + `@testing-library/user-event` · Tailwind v4 (via `cn()`). Zero new runtime dependencies.

---

## Source-of-truth cross-reference

| Concern | Location |
|---|---|
| Sprint scope / deliverables / exit criteria | `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` §Sprint B (§7) |
| Reducer state/action shapes | `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` §State management |
| Auto-advance rules | spec §Auto-advance rules |
| sessionStorage resume | spec §Mid-wizard resume via sessionStorage |
| Validation & input limits | spec §Validation & input limits |
| Accessibility | spec §Accessibility |
| Wizard chrome & progress bar | spec §Wizard chrome |
| Design tokens | `docs/archive/claude-design-handoffs/2026-04-21/Design Handoff.md` §1 |
| Answer / Answers / StepId | `web/src/features/onboarding/lib/types.ts` (Sprint A output) |
| `ConfirmDialog` to reuse | `web/src/shared/components/ConfirmDialog.tsx` |
| `cn()` helper | `web/src/shared/lib/utils.ts` |
| Component test convention | `web/tests/unit/features/<feature>/<Component>.test.tsx` (match this layout — the orchestration's `components/onboarding/` path is a PM-doc typo; the project convention used by every existing component test is `tests/unit/features/…`) |

---

## File map

**Create (code):**

| Path | Responsibility |
|---|---|
| `web/src/features/onboarding/lib/questionnaire-state.ts` | Pure reducer. Exports `WizardState`, `WizardAction`, `initialWizardState`, `TOTAL_STEPS`, `questionnaireReducer`. Zero I/O, zero clock calls, zero imports outside `./types`. |
| `web/src/features/onboarding/lib/session-storage.ts` | `saveWizardState`, `loadWizardState`, `clearWizardState`. Single `sessionStorage` key `exercise-logger:onboarding:in-progress`. Catches every exception and silently no-ops (private browsing / quota exceeded). |
| `web/src/features/onboarding/components/WizardShell.tsx` | Chrome: progress bar, close button, eyebrow, hero heading (focusable on mount via `headingRef`), subtitle, children (input slot), footer with Back / Next. Owns close-confirmation `ConfirmDialog`. |
| `web/src/features/onboarding/components/ChipRow.tsx` | Single-select. Uses `<input type="radio">` hidden + styled labels when `options.length <= 5`, else `<button aria-pressed>`. Optional auto-advance fires both `onSelect` and `onAdvance`. |
| `web/src/features/onboarding/components/ChipMulti.tsx` | Multi-select with optional `exclusiveValue`. Toggling the exclusive clears siblings; toggling a non-exclusive while the exclusive is selected clears the exclusive. Exclusive-value rule is symmetric. |
| `web/src/features/onboarding/components/ChipWithDescription.tsx` | Vertical / stacked single-select chip list. Each option renders as a full-width card with title + secondary description. Same keyboard semantics as `ChipRow`. |
| `web/src/features/onboarding/components/StepTextArea.tsx` | `Textarea` + optional "skip" chip under it. Shows a character counter once `value.length >= showCounterAt`. Enforces `maxLength`. Skip chip calls `onSkip` and visually dims the textarea. |

**Create (tests — all under `web/tests/unit/features/onboarding/` to match the project convention):**

| Path | Count |
|---|---|
| `web/tests/unit/features/onboarding/questionnaire-state.test.ts` | ~12 |
| `web/tests/unit/features/onboarding/session-storage.test.ts` | ~4 |
| `web/tests/unit/features/onboarding/ChipRow.test.tsx` | ~4 |
| `web/tests/unit/features/onboarding/ChipMulti.test.tsx` | ~5 |
| `web/tests/unit/features/onboarding/ChipWithDescription.test.tsx` | ~3 |
| `web/tests/unit/features/onboarding/StepTextArea.test.tsx` | ~3 |
| `web/tests/unit/features/onboarding/WizardShell.test.tsx` | ~5 |

Expected test delta: ~36 new tests (spec estimate was ~27; modest overshoot expected given TDD-per-behavior). Baseline after Sprint A: 771 → **~807**.

**Create (polish):**

| Path | Responsibility |
|---|---|
| `web/src/features/onboarding/CLAUDE.md` | Module guide: explains the shape (`lib/` pure, `components/` presentational, `steps/` + `*.tsx` screens come in Sprint C/D). Names every file shipped in Sprint B with a one-line description. |

**Out of scope (explicit — do not create, do not modify):**
- Any step component under `steps/` (`GoalStep`, `ExperienceStep`, …). All Sprint C.
- `OnboardingWelcomeScreen`, `QuestionnaireScreen`, `HandoffScreen`. All Sprint C/D.
- Any route in `App.tsx`. Sprint C.
- Any use of `@/services/onboarding-service` or `@/services/settings-service.setUserName`. Sprint C/D wire services to screens.
- Any use of `@/features/onboarding/lib/prompt-builder`. Sprint D's HandoffScreen calls it.
- `TodayScreen`, `SettingsScreen` changes. Sprint D.
- No new color variable, no new Tailwind utility, no new `shadcn/ui` primitive.

If a task wants to touch a file not listed in "File map", stop and escalate.

---

## Shared conventions (apply to every component task)

1. **Imports.** Use `@/...` aliases. Never use relative `../../` escapes across feature boundaries. Within `features/onboarding/components/`, a sibling chip import as `./ChipRow` is fine.
2. **Classes.** Compose with `cn(...)` from `@/shared/lib/utils`. Don't build `className` strings with `+`. Example: `className={cn("rounded-[var(--radius-pill)] px-4 py-2", selected && "bg-ink text-paper")}`.
3. **Tokens.** Use CSS variables via Tailwind arbitrary values: `rounded-[var(--radius-pill)]`, `rounded-[var(--radius-card)]`. Colors via utilities: `bg-sage-soft`, `text-ink-2`, `border-[var(--line)]`. Do NOT hard-code hex values.
4. **Typography.** `text-hero-serif` (Instrument Serif 32px italic) for the hero heading ONLY. `text-eyebrow` (Inter 11px 600 uppercase 0.08em) for the progress eyebrow. Body copy is `text-sm text-ink-2`. Meta is `text-meta`.
5. **Buttons.** Reuse `@/shared/ui/button` (`Button` component) for footer Back/Next. Do not roll your own.
6. **Textarea.** Reuse `@/shared/ui/textarea` (`Textarea` component) inside `StepTextArea`.
7. **Tests.** Mirror the style of `web/tests/unit/features/settings/UnitsToggle.test.tsx`: `import { describe, it, expect } from "vitest"`, `render`, `screen`, `userEvent.setup()`. No explicit `afterEach(cleanup)` needed — Vitest + RTL auto-cleanup is enabled in this project (verified against existing tests). For components with timer/effect state, use `userEvent.setup()` not `fireEvent`.
8. **Handler prop names.** `onSelect` for single-select events, `onChange` for multi-select (receives the new array), `onAdvance` for auto-advance triggers, `onSkip` for skip-chip activation, `onNext` / `onBack` / `onClose` for shell navigation.
9. **No default export anywhere** in Sprint B. Named exports only (matches the rest of `features/*/` component modules — only top-level screens default-export for lazy routing).
10. **No `useMemo`/`useCallback` unless measurably needed.** This is phone-first UI rendering a few chips. Readability beats premature optimization.

---

## Task ordering rationale

Pure modules first (reducer, storage) — they have zero React dependencies, so their tests are the cheapest to land and they lock the types Sprint C's orchestrator will import. Then input primitives in increasing complexity (`ChipRow` → `ChipMulti` → `ChipWithDescription` → `StepTextArea`). Finally `WizardShell`, which wraps them but depends on none. `CLAUDE.md` polish last, so the module description is accurate.

Sequential execution recommended. If the implementer asks to parallelise, "reducer + storage" as one track and "all 5 components" as a second is fine — they share no state.

**Commit narrative (expected):** 8 commits, one per task, each of the form `feat(onboarding): add <thing>` or `test(onboarding): …` / `docs: …` as appropriate.

---

## Task 1: Pure reducer — `questionnaire-state.ts`

**Files:**
- Create: `web/src/features/onboarding/lib/questionnaire-state.ts`
- Test: `web/tests/unit/features/onboarding/questionnaire-state.test.ts`

### Contract (frozen — Sprint C imports these)

```ts
export const TOTAL_STEPS = 11;

export interface WizardState {
  stepIndex: number;        // 0..TOTAL_STEPS - 1
  answers: Answers;
}

export type WizardAction =
  | { type: "answer"; stepId: StepId; answer: Answer }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; to: number }
  | { type: "restart" };

export const initialWizardState: WizardState;
export function questionnaireReducer(state: WizardState, action: WizardAction): WizardState;
```

### Semantics

- `answer`: set `state.answers[stepId] = answer`. Overwrites prior answer for that stepId. Other stepIds preserved. `stepIndex` unchanged. Answers immutability: return a new object with `{ ...state.answers, [stepId]: answer }`.
- `next`: `stepIndex + 1`, clamped to `TOTAL_STEPS - 1 (= 10)`. Answers preserved.
- `back`: `stepIndex - 1`, clamped to `0`. Answers preserved.
- `jump`: if `to` is an integer in `[0, TOTAL_STEPS - 1]`, set `stepIndex = to`. Otherwise return `state` unchanged. Answers preserved.
- `restart`: return `initialWizardState` regardless of current state.
- `answer` and `next` / `back` / `jump` / `restart` all return NEW object references when the state changes, so `React` `useReducer` sees the update. When `jump` is invalid (no-op), return the SAME reference (standard reducer idiom).

### Exclusivity is NOT in the reducer

The chip-multi "bodyweight-only" exclusivity is computed inside `ChipMulti` before the step dispatches `answer`. The reducer stores whatever `values` array it receives, verbatim. Keep the reducer dumb. (This keeps the reducer pure and lets Sprint C swap exclusivity rules without touching state code.)

### Step 1.1 — Write the failing test file

Create `web/tests/unit/features/onboarding/questionnaire-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TOTAL_STEPS,
  initialWizardState,
  questionnaireReducer,
  type WizardState,
  type WizardAction,
} from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

describe("questionnaireReducer", () => {
  describe("initial state", () => {
    it("starts at step 0 with no answers", () => {
      expect(initialWizardState).toEqual({ stepIndex: 0, answers: {} });
    });

    it("exports TOTAL_STEPS = 11 (matches StepId union)", () => {
      expect(TOTAL_STEPS).toBe(11);
    });
  });

  describe("action: answer", () => {
    it("stores a chip answer under the given StepId", () => {
      const next = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(next.answers.goal).toEqual({
        kind: "chip-with-other",
        value: "Build muscle",
      });
      expect(next.stepIndex).toBe(0);
    });

    it("stores a chip-multi answer verbatim (reducer does not enforce exclusivity)", () => {
      const answer: Answer = {
        kind: "chip-multi",
        values: ["Barbell", "Dumbbells"],
      };
      const next = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "equipment",
        answer,
      });
      expect(next.answers.equipment).toEqual(answer);
    });

    it("overwrites an existing answer for the same stepId", () => {
      const first = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "experience",
        answer: { kind: "chip", value: "Beginner" },
      });
      const second = questionnaireReducer(first, {
        type: "answer",
        stepId: "experience",
        answer: { kind: "chip", value: "Advanced" },
      });
      expect(second.answers.experience).toEqual({
        kind: "chip",
        value: "Advanced",
      });
    });

    it("preserves answers for other stepIds", () => {
      const base: WizardState = {
        stepIndex: 3,
        answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
      };
      const next = questionnaireReducer(base, {
        type: "answer",
        stepId: "daysPerWeek",
        answer: { kind: "chip", value: "3" },
      });
      expect(next.answers.goal).toEqual({
        kind: "chip-with-other",
        value: "Build muscle",
      });
      expect(next.answers.daysPerWeek).toEqual({ kind: "chip", value: "3" });
    });
  });

  describe("action: next", () => {
    it("increments stepIndex", () => {
      const next = questionnaireReducer(
        { stepIndex: 0, answers: {} },
        { type: "next" }
      );
      expect(next.stepIndex).toBe(1);
    });

    it("clamps at TOTAL_STEPS - 1 (= 10)", () => {
      const last: WizardState = { stepIndex: 10, answers: {} };
      expect(questionnaireReducer(last, { type: "next" }).stepIndex).toBe(10);
    });
  });

  describe("action: back", () => {
    it("decrements stepIndex", () => {
      const next = questionnaireReducer(
        { stepIndex: 5, answers: {} },
        { type: "back" }
      );
      expect(next.stepIndex).toBe(4);
    });

    it("clamps at 0", () => {
      expect(
        questionnaireReducer(initialWizardState, { type: "back" }).stepIndex
      ).toBe(0);
    });
  });

  describe("action: jump", () => {
    it("jumps to a valid in-range index", () => {
      const next = questionnaireReducer(initialWizardState, {
        type: "jump",
        to: 7,
      });
      expect(next.stepIndex).toBe(7);
    });

    it("returns the same state reference when `to` is out of range", () => {
      const base = { stepIndex: 2, answers: {} };
      expect(questionnaireReducer(base, { type: "jump", to: -1 })).toBe(base);
      expect(questionnaireReducer(base, { type: "jump", to: 11 })).toBe(base);
      expect(
        questionnaireReducer(base, { type: "jump", to: 2.5 })
      ).toBe(base);
    });
  });

  describe("action: restart", () => {
    it("returns initialWizardState regardless of current state", () => {
      const dirty: WizardState = {
        stepIndex: 9,
        answers: {
          goal: { kind: "chip-with-other", value: "Build muscle" },
          equipment: { kind: "chip-multi", values: ["Barbell"] },
        },
      };
      expect(questionnaireReducer(dirty, { type: "restart" })).toEqual(
        initialWizardState
      );
    });
  });

  describe("immutability", () => {
    it("does not mutate the input state on answer", () => {
      const base: WizardState = { stepIndex: 0, answers: {} };
      const before = JSON.stringify(base);
      questionnaireReducer(base, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(JSON.stringify(base)).toBe(before);
    });

    it("returns a new answers object on answer (referentially distinct)", () => {
      const base: WizardState = { stepIndex: 0, answers: {} };
      const next = questionnaireReducer(base, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(next.answers).not.toBe(base.answers);
    });
  });

  it("exhaustively handles all action types (type check only — compile is the assertion)", () => {
    const actions: WizardAction[] = [
      { type: "answer", stepId: "goal", answer: { kind: "chip-with-other", value: "X" } },
      { type: "next" },
      { type: "back" },
      { type: "jump", to: 4 },
      { type: "restart" },
    ];
    for (const a of actions) {
      expect(() => questionnaireReducer(initialWizardState, a)).not.toThrow();
    }
  });
});
```

- [ ] **Step 1.1: Write the failing test**

Create the file above.

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/questionnaire-state.test.ts`
Expected: module-resolution failure — `@/features/onboarding/lib/questionnaire-state` does not exist.

- [ ] **Step 1.3: Write the implementation**

Create `web/src/features/onboarding/lib/questionnaire-state.ts`:

```ts
// Pure reducer — no I/O, no clock, no storage. The orchestrator binds side
// effects (sessionStorage persistence, focus management) via useEffect.
//
// Frozen API contract — Sprint C's QuestionnaireScreen dispatches these
// actions, Sprint D's HandoffScreen inspects `answers` through it.

import type { Answer, Answers, StepId } from "./types";

/** 11 intake topics = 11 reducer steps. Welcome/name screen is a separate route. */
export const TOTAL_STEPS = 11;

export interface WizardState {
  /** 0 through TOTAL_STEPS - 1, inclusive. */
  stepIndex: number;
  answers: Answers;
}

export type WizardAction =
  | { type: "answer"; stepId: StepId; answer: Answer }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; to: number }
  | { type: "restart" };

export const initialWizardState: WizardState = {
  stepIndex: 0,
  answers: {},
};

export function questionnaireReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "answer":
      return {
        stepIndex: state.stepIndex,
        answers: { ...state.answers, [action.stepId]: action.answer },
      };
    case "next": {
      const next = Math.min(state.stepIndex + 1, TOTAL_STEPS - 1);
      return next === state.stepIndex ? state : { ...state, stepIndex: next };
    }
    case "back": {
      const prev = Math.max(state.stepIndex - 1, 0);
      return prev === state.stepIndex ? state : { ...state, stepIndex: prev };
    }
    case "jump": {
      const to = action.to;
      if (!Number.isInteger(to) || to < 0 || to >= TOTAL_STEPS) return state;
      if (to === state.stepIndex) return state;
      return { ...state, stepIndex: to };
    }
    case "restart":
      return initialWizardState;
  }
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/questionnaire-state.test.ts`
Expected: all ~12 tests pass.

Run full suite: `cd web && npm test -- --run`
Expected: 771 + 12 = **~783** tests, green. Ignore the pre-existing `useRoutineLaunchQueue` flake if it surfaces.

- [ ] **Step 1.5: Commit**

```bash
git add web/src/features/onboarding/lib/questionnaire-state.ts web/tests/unit/features/onboarding/questionnaire-state.test.ts
git commit -m "feat(onboarding): add pure wizard reducer with 5 actions"
```

---

## Task 2: sessionStorage utility — `session-storage.ts`

**Files:**
- Create: `web/src/features/onboarding/lib/session-storage.ts`
- Test: `web/tests/unit/features/onboarding/session-storage.test.ts`

### Contract

```ts
export const STORAGE_KEY = "exercise-logger:onboarding:in-progress";

export function saveWizardState(state: WizardState): void; // silent on failure
export function loadWizardState(): WizardState | null;     // null on missing or malformed
export function clearWizardState(): void;                  // silent on failure
```

### Semantics (spec §Mid-wizard resume)

- `saveWizardState(state)`: `sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))`. Wrap in try/catch — any throw (QuotaExceededError, SecurityError in private browsing, or sessionStorage is undefined) is silently swallowed.
- `loadWizardState()`: `JSON.parse(sessionStorage.getItem(STORAGE_KEY))`. Returns `null` if: missing key, parse error, or parsed value fails shape check. Shape check: object with `typeof stepIndex === "number"` and `typeof answers === "object" && answers !== null`. We don't deep-validate the `Answers` content here — Sprint C's dispatcher will tolerate partial answers, and a malformed payload is rare enough that a simple shape check is sufficient.
- `clearWizardState()`: `sessionStorage.removeItem(STORAGE_KEY)`. Silent on throw.

All three functions guard `typeof sessionStorage === "undefined"` because jsdom and SSR environments may not have it. The guard lets tests that mock a throwing `setItem` still exercise the catch block.

### Step 2.1 — Write the failing test

Create `web/tests/unit/features/onboarding/session-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEY,
  saveWizardState,
  loadWizardState,
  clearWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { WizardState } from "@/features/onboarding/lib/questionnaire-state";

const sampleState: WizardState = {
  stepIndex: 4,
  answers: {
    goal: { kind: "chip-with-other", value: "Build muscle" },
    daysPerWeek: { kind: "chip", value: "3" },
  },
};

describe("session-storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips a saved WizardState", () => {
    saveWizardState(sampleState);
    const loaded = loadWizardState();
    expect(loaded).toEqual(sampleState);
    // Serialization check: ensure key matches the spec constant.
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("loadWizardState returns null when the key is absent", () => {
    expect(loadWizardState()).toBeNull();
  });

  it("clearWizardState removes the stored value", () => {
    saveWizardState(sampleState);
    expect(loadWizardState()).not.toBeNull();
    clearWizardState();
    expect(loadWizardState()).toBeNull();
  });

  it("saveWizardState silently no-ops when sessionStorage.setItem throws", () => {
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError (mocked)");
      });
    expect(() => saveWizardState(sampleState)).not.toThrow();
    expect(setSpy).toHaveBeenCalled();
  });

  it("loadWizardState returns null on malformed JSON", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadWizardState()).toBeNull();
  });

  it("loadWizardState returns null when the payload shape is wrong", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(loadWizardState()).toBeNull();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(loadWizardState()).toBeNull();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(42));
    expect(loadWizardState()).toBeNull();
  });
});
```

- [ ] **Step 2.1: Write the failing test** (file above)

- [ ] **Step 2.2: Run test to verify it fails**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/session-storage.test.ts`
Expected: module-resolution error — `@/features/onboarding/lib/session-storage` does not exist.

- [ ] **Step 2.3: Write the implementation**

Create `web/src/features/onboarding/lib/session-storage.ts`:

```ts
// sessionStorage persistence for the in-progress wizard state. Silent-fail on
// every error — private browsing (Safari), quota exceeded, or environments
// without sessionStorage (jsdom edge cases) must never surface an exception to
// the caller. Callers still see a "no resume" outcome via loadWizardState()
// returning null.

import type { WizardState } from "./questionnaire-state";

export const STORAGE_KEY = "exercise-logger:onboarding:in-progress";

function isWizardStateShape(value: unknown): value is WizardState {
  if (value === null || typeof value !== "object") return false;
  const v = value as { stepIndex?: unknown; answers?: unknown };
  return (
    typeof v.stepIndex === "number" &&
    typeof v.answers === "object" &&
    v.answers !== null
  );
}

export function saveWizardState(state: WizardState): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* silent — private browsing, quota, etc. */
  }
}

export function loadWizardState(): WizardState | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWizardStateShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearWizardState(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
}
```

- [ ] **Step 2.4: Run tests to verify green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/session-storage.test.ts`
Expected: all 6 tests pass (spec estimated ~4; the malformed-JSON and shape-check tests are grouped so the count lands around 6 — fine).

Full suite: `cd web && npm test -- --run`
Expected: ~789 green.

- [ ] **Step 2.5: Commit**

```bash
git add web/src/features/onboarding/lib/session-storage.ts web/tests/unit/features/onboarding/session-storage.test.ts
git commit -m "feat(onboarding): add silent-fail sessionStorage utility for wizard resume"
```

---

## Task 3: `ChipRow.tsx` — single-select with auto-advance

**Files:**
- Create: `web/src/features/onboarding/components/ChipRow.tsx`
- Test: `web/tests/unit/features/onboarding/ChipRow.test.tsx`

### Prop surface (frozen)

```ts
export interface ChipOption {
  value: string;
  label: string;
  description?: string; // only used by ChipWithDescription, ignored here
}

export interface ChipRowProps {
  name: string;                // radiogroup name; must be unique per rendered instance
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  /** If true, after onSelect fires, onAdvance is called on the next tick. */
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;           // labels the radiogroup / button group for SR
}
```

### Semantics

- When `options.length <= 5`, render as a `<fieldset>` containing hidden `<input type="radio">` + `<label>` pairs. Attach `role="radiogroup"` to the `<fieldset>` or wrapper `<div>` with `aria-label={ariaLabel}`. Clicking a label fires the radio change → `onSelect(value)`.
- When `options.length > 5`, render `<button type="button" aria-pressed={value === selected}>` wrapped in a `<div role="group" aria-label={ariaLabel}>`. (11 options would overflow a radiogroup visually; fallback is pragmatic.)
- `autoAdvance`: after `onSelect`, call `onAdvance` on the next microtask (`queueMicrotask(onAdvance)`). Two rationale: (a) lets the parent's `dispatch({ type: "answer", …})` commit first so when `onAdvance` dispatches `{type: "next"}` it sees the new answer; (b) matches CSS-native "click → visual feedback → advance" timing.
- Visual spec: chip = `rounded-[var(--radius-pill)] px-4 py-2 text-sm`. Selected: `bg-ink text-paper`. Unselected: `border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft`. Focus ring: `focus-visible:ring-2 focus-visible:ring-sage/40`.
- Keyboard: native radiogroup handles left/right arrow traversal automatically via `<input type="radio">` with a shared `name`. No custom keyboard handler needed.

### Step 3.1 — Write the failing test

Create `web/tests/unit/features/onboarding/ChipRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";

const THREE: ChipOption[] = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

describe("ChipRow (single-select, ≤ 5 options → radiogroup)", () => {
  it("renders a radiogroup with one radio per option and the selected radio checked", () => {
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected="b"
        onSelect={() => {}}
        ariaLabel="Primary goal"
      />
    );
    const group = screen.getByRole("radiogroup", { name: /primary goal/i });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect((radios[0] as HTMLInputElement).checked).toBe(false);
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect((radios[2] as HTMLInputElement).checked).toBe(false);
  });

  it("fires onSelect when a chip is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected={null}
        onSelect={onSelect}
        ariaLabel="Primary goal"
      />
    );
    await user.click(screen.getByLabelText("C"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("fires both onSelect and onAdvance when autoAdvance is true", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected={null}
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Primary goal"
      />
    );
    await user.click(screen.getByLabelText("A"));
    expect(onSelect).toHaveBeenCalledWith("a");
    // onAdvance fires on the next microtask; await a Promise flush.
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("ChipRow (single-select, > 5 options → aria-pressed buttons)", () => {
  const MANY: ChipOption[] = Array.from({ length: 6 }, (_, i) => ({
    value: String(i + 1),
    label: `Option ${i + 1}`,
  }));

  it("renders as a button group with aria-pressed on the selected button", () => {
    render(
      <ChipRow
        name="many"
        options={MANY}
        selected="3"
        onSelect={() => {}}
        ariaLabel="Pick one"
      />
    );
    const group = screen.getByRole("group", { name: /pick one/i });
    expect(group).toBeInTheDocument();
    const three = screen.getByRole("button", { name: /Option 3/i });
    expect(three.getAttribute("aria-pressed")).toBe("true");
    const four = screen.getByRole("button", { name: /Option 4/i });
    expect(four.getAttribute("aria-pressed")).toBe("false");
  });
});
```

- [ ] **Step 3.1: Write the failing test**

- [ ] **Step 3.2: Run test to verify failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipRow.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 3.3: Create `ChipRow.tsx`**

```tsx
import { cn } from "@/shared/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChipRowProps {
  name: string;
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";

const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft";

export function ChipRow({
  name,
  options,
  selected,
  onSelect,
  autoAdvance = false,
  onAdvance,
  ariaLabel,
}: ChipRowProps) {
  const handle = (value: string) => {
    onSelect(value);
    if (autoAdvance && onAdvance) {
      queueMicrotask(onAdvance);
    }
  };

  if (options.length <= 5) {
    return (
      <fieldset
        role="radiogroup"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-2 border-0 p-0"
      >
        {options.map((opt) => {
          const isSelected = opt.value === selected;
          const id = `${name}-${opt.value}`;
          return (
            <div key={opt.value}>
              <input
                type="radio"
                id={id}
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => handle(opt.value)}
                className="sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  chipBase,
                  "cursor-pointer",
                  isSelected ? chipSelected : chipUnselected
                )}
              >
                {opt.label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => handle(opt.value)}
            className={cn(
              chipBase,
              isSelected ? chipSelected : chipUnselected
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipRow.test.tsx`
Expected: 4 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: ~793 green.

- [ ] **Step 3.5: Commit**

```bash
git add web/src/features/onboarding/components/ChipRow.tsx web/tests/unit/features/onboarding/ChipRow.test.tsx
git commit -m "feat(onboarding): add ChipRow single-select with auto-advance"
```

---

## Task 4: `ChipMulti.tsx` — multi-select with symmetric exclusivity

**Files:**
- Create: `web/src/features/onboarding/components/ChipMulti.tsx`
- Test: `web/tests/unit/features/onboarding/ChipMulti.test.tsx`

### Prop surface (frozen)

```ts
export interface ChipMultiProps {
  options: ChipOption[];         // imported from ./ChipRow
  selected: string[];            // current selected values
  onChange: (next: string[]) => void;
  /** e.g. "Bodyweight only" — mutually exclusive with all other options. */
  exclusiveValue?: string;
  ariaLabel: string;
}
```

### Semantics (spec §Wizard chrome, orchestration §B critical correctness)

- Each chip is a `<button type="button" aria-pressed={value ∈ selected}>`.
- Toggle rule **without** `exclusiveValue`: click toggles presence in `selected` array; call `onChange(next)` with the updated array (insertion order preserved for already-selected items; new selections append).
- Toggle rule **with** `exclusiveValue` (symmetric):
  - Clicking the `exclusiveValue` chip: if it was selected, un-select it (`onChange([])` or `onChange(selectedMinusExclusive)`); if it was not selected, call `onChange([exclusiveValue])` — clears all siblings.
  - Clicking any other chip while `exclusiveValue` IS in `selected`: call `onChange([value])` — clears the exclusive, selects just this one.
  - Clicking any other chip while `exclusiveValue` is NOT selected: normal toggle.

### Step 4.1 — Write the failing test

Create `web/tests/unit/features/onboarding/ChipMulti.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";

const EQUIPMENT: ChipOption[] = [
  { value: "Barbell", label: "Barbell" },
  { value: "Dumbbells", label: "Dumbbells" },
  { value: "Bodyweight only", label: "Bodyweight only" },
];

describe("ChipMulti", () => {
  it("toggling an unselected chip adds it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell"]}
        onChange={onChange}
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /dumbbells/i }));
    expect(onChange).toHaveBeenCalledWith(["Barbell", "Dumbbells"]);
  });

  it("toggling an already-selected chip removes it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell", "Dumbbells"]}
        onChange={onChange}
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /barbell/i }));
    expect(onChange).toHaveBeenCalledWith(["Dumbbells"]);
  });

  it("reflects selection via aria-pressed", () => {
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell"]}
        onChange={() => {}}
        ariaLabel="Equipment"
      />
    );
    expect(screen.getByRole("button", { name: /barbell/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /dumbbells/i }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the exclusive chip clears all siblings (direction 1)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell", "Dumbbells"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /bodyweight only/i }));
    expect(onChange).toHaveBeenCalledWith(["Bodyweight only"]);
  });

  it("clicking a non-exclusive chip while exclusive is selected clears the exclusive (direction 2)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Bodyweight only"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /dumbbells/i }));
    expect(onChange).toHaveBeenCalledWith(["Dumbbells"]);
  });

  it("clicking the exclusive chip while it is the only selection deselects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Bodyweight only"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /bodyweight only/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 4.1 & 4.2: Write the failing test, run, confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipMulti.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 4.3: Create `ChipMulti.tsx`**

```tsx
import { cn } from "@/shared/lib/utils";
import type { ChipOption } from "./ChipRow";

export interface ChipMultiProps {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  exclusiveValue?: string;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";
const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft";

export function ChipMulti({
  options,
  selected,
  onChange,
  exclusiveValue,
  ariaLabel,
}: ChipMultiProps) {
  const nextFor = (clicked: string): string[] => {
    const isExclusiveClicked =
      exclusiveValue !== undefined && clicked === exclusiveValue;

    if (isExclusiveClicked) {
      // Clicking the exclusive chip. If already the sole selection, deselect;
      // otherwise replace all selections with just the exclusive.
      return selected.includes(clicked) ? [] : [clicked];
    }

    const exclusiveIsActive =
      exclusiveValue !== undefined && selected.includes(exclusiveValue);

    if (exclusiveIsActive) {
      // Clicking any non-exclusive while the exclusive is on: clear exclusive,
      // start a fresh non-exclusive selection.
      return [clicked];
    }

    // Plain toggle: add if absent, remove if present.
    return selected.includes(clicked)
      ? selected.filter((v) => v !== clicked)
      : [...selected, clicked];
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(nextFor(opt.value))}
            className={cn(chipBase, isSelected ? chipSelected : chipUnselected)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipMulti.test.tsx`
Expected: 6 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: ~799 green.

- [ ] **Step 4.5: Commit**

```bash
git add web/src/features/onboarding/components/ChipMulti.tsx web/tests/unit/features/onboarding/ChipMulti.test.tsx
git commit -m "feat(onboarding): add ChipMulti with symmetric exclusive-value rule"
```

---

## Task 5: `ChipWithDescription.tsx` — vertical single-select

**Files:**
- Create: `web/src/features/onboarding/components/ChipWithDescription.tsx`
- Test: `web/tests/unit/features/onboarding/ChipWithDescription.test.tsx`

Shares the `ChipOption` type and auto-advance pattern with `ChipRow`, but renders each option as a full-width card (title + description) stacked vertically. Used by steps 2 (experience), 6 (distinct days — unused for it actually; step 6 is a ChipRow), and 10 (supersets).

### Prop surface (frozen)

```ts
export interface ChipWithDescriptionProps {
  name: string;
  options: ChipOption[];        // `description` is rendered
  selected: string | null;
  onSelect: (value: string) => void;
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;
}
```

### Semantics

- Same radiogroup semantics as `ChipRow` for `options.length <= 5` (always the case — experience has 3, supersets has 3).
- Vertical layout: `flex flex-col gap-2`.
- Each option: full-width card with `rounded-[var(--radius-card)] border border-[var(--line)] bg-paper p-4 text-left`. Selected state: swap border to `border-ink bg-ink/[0.04]` (sage-soft tint feels wrong for serious content here; use a subtle ink fill). Or, match ChipRow's selected ink-fill. The spec is not pixel-prescriptive — pick `bg-ink text-paper` for consistency so selection reads clearly on-screen.
- Title: `text-sm font-medium`. Description: `text-xs text-ink-3` (selected: `text-paper/75`).

### Step 5.1 — Write the failing test

Create `web/tests/unit/features/onboarding/ChipWithDescription.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipWithDescription } from "@/features/onboarding/components/ChipWithDescription";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";

const EXPERIENCE: ChipOption[] = [
  { value: "Beginner", label: "Beginner", description: "Just starting out" },
  { value: "Intermediate", label: "Intermediate", description: "6+ months in" },
  { value: "Advanced", label: "Advanced", description: "Years of consistent training" },
];

describe("ChipWithDescription", () => {
  it("renders each option's label and description", () => {
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected={null}
        onSelect={() => {}}
        ariaLabel="Experience"
      />
    );
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Just starting out")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("Years of consistent training")).toBeInTheDocument();
  });

  it("marks the selected option's radio as checked", () => {
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected="Intermediate"
        onSelect={() => {}}
        ariaLabel="Experience"
      />
    );
    const radios = screen.getAllByRole("radio");
    expect((radios.find((r) => (r as HTMLInputElement).value === "Intermediate") as HTMLInputElement).checked).toBe(true);
    expect((radios.find((r) => (r as HTMLInputElement).value === "Beginner") as HTMLInputElement).checked).toBe(false);
  });

  it("fires onSelect and then onAdvance when autoAdvance is set", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected={null}
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Experience"
      />
    );
    await user.click(screen.getByLabelText(/Advanced/));
    expect(onSelect).toHaveBeenCalledWith("Advanced");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5.1: Write the failing test**

- [ ] **Step 5.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipWithDescription.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 5.3: Create `ChipWithDescription.tsx`**

```tsx
import { cn } from "@/shared/lib/utils";
import type { ChipOption } from "./ChipRow";

export interface ChipWithDescriptionProps {
  name: string;
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;
}

const cardBase =
  "flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-paper p-4 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";
const cardSelected = "bg-ink text-paper border-ink";
const titleCls = "text-sm font-medium";
const descSelected = "text-xs text-paper/75";
const descUnselected = "text-xs text-ink-3";

export function ChipWithDescription({
  name,
  options,
  selected,
  onSelect,
  autoAdvance = false,
  onAdvance,
  ariaLabel,
}: ChipWithDescriptionProps) {
  const handle = (value: string) => {
    onSelect(value);
    if (autoAdvance && onAdvance) {
      queueMicrotask(onAdvance);
    }
  };

  return (
    <fieldset
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 border-0 p-0"
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        const id = `${name}-${opt.value}`;
        return (
          <div key={opt.value}>
            <input
              type="radio"
              id={id}
              name={name}
              value={opt.value}
              checked={isSelected}
              onChange={() => handle(opt.value)}
              className="sr-only"
            />
            <label
              htmlFor={id}
              className={cn(cardBase, isSelected && cardSelected)}
            >
              <span className={titleCls}>{opt.label}</span>
              {opt.description && (
                <span
                  className={isSelected ? descSelected : descUnselected}
                >
                  {opt.description}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
```

- [ ] **Step 5.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/ChipWithDescription.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: ~802 green.

- [ ] **Step 5.5: Commit**

```bash
git add web/src/features/onboarding/components/ChipWithDescription.tsx web/tests/unit/features/onboarding/ChipWithDescription.test.tsx
git commit -m "feat(onboarding): add vertical ChipWithDescription for steps 2 and 10"
```

---

## Task 6: `StepTextArea.tsx` — multi-line input + optional skip chip

**Files:**
- Create: `web/src/features/onboarding/components/StepTextArea.tsx`
- Test: `web/tests/unit/features/onboarding/StepTextArea.test.tsx`

### Prop surface (frozen)

```ts
export interface StepTextAreaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength: number;           // required; 300 for restrictions, 200 for favorites/avoid
  showCounterAt?: number;      // e.g. 240; counter visible once value.length >= this
  skipChipLabel?: string;
  onSkip?: () => void;
  /** When true, the textarea is visually dimmed and disabled; skip chip is active. */
  skipped?: boolean;
  ariaLabel: string;
}
```

### Semantics (spec §Validation & input limits)

- Reuse `@/shared/ui/textarea`'s `Textarea` component.
- `maxLength` is forwarded as the HTML `maxlength` attribute (hard cap).
- Character counter: only renders when `showCounterAt !== undefined && value.length >= showCounterAt`. Rendered as `text-meta text-ink-3` below the textarea, aligned right. Format: `${value.length} / ${maxLength}`.
- Skip chip: if `skipChipLabel` + `onSkip` are provided, render a `ChipRow`-styled button below the textarea labelled with `skipChipLabel`. Tapping it calls `onSkip()` (the parent switches to `skipped=true`).
- When `skipped` is true: textarea is `disabled`, visually dimmed (`opacity-50`), and the skip chip shows `aria-pressed="true"`. Tapping the skip chip again should call `onSkip()` — parent logic decides whether to un-skip.

### Step 6.1 — Write the failing test

Create `web/tests/unit/features/onboarding/StepTextArea.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepTextArea } from "@/features/onboarding/components/StepTextArea";

describe("StepTextArea", () => {
  it("does NOT render the counter when value length is below showCounterAt", () => {
    render(
      <StepTextArea
        value="short"
        onChange={() => {}}
        maxLength={300}
        showCounterAt={240}
        ariaLabel="Restrictions"
      />
    );
    expect(screen.queryByText(/\/\s*300/)).not.toBeInTheDocument();
  });

  it("renders the counter once the value length hits showCounterAt", () => {
    render(
      <StepTextArea
        value={"x".repeat(250)}
        onChange={() => {}}
        maxLength={300}
        showCounterAt={240}
        ariaLabel="Restrictions"
      />
    );
    expect(screen.getByText("250 / 300")).toBeInTheDocument();
  });

  it("fires onChange with the typed value and respects the maxLength attribute", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StepTextArea
        value=""
        onChange={onChange}
        maxLength={5}
        ariaLabel="Test"
      />
    );
    const textarea = screen.getByRole("textbox", { name: /test/i });
    expect(textarea.getAttribute("maxlength")).toBe("5");
    await user.type(textarea, "hi");
    // each keystroke fires onChange with the running value; last call is "hi".
    expect(onChange).toHaveBeenLastCalledWith("hi");
  });

  it("when `skipped` is true, disables the textarea and marks the skip chip pressed", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <StepTextArea
        value=""
        onChange={() => {}}
        maxLength={300}
        skipChipLabel="All clear — skip"
        onSkip={onSkip}
        skipped
        ariaLabel="Restrictions"
      />
    );
    const textarea = screen.getByRole("textbox", { name: /restrictions/i });
    expect(textarea).toBeDisabled();
    const skipChip = screen.getByRole("button", { name: /all clear — skip/i });
    expect(skipChip.getAttribute("aria-pressed")).toBe("true");
    await user.click(skipChip);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6.1: Write the failing test**

- [ ] **Step 6.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/StepTextArea.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 6.3: Create `StepTextArea.tsx`**

```tsx
import { cn } from "@/shared/lib/utils";
import { Textarea } from "@/shared/ui/textarea";

export interface StepTextAreaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength: number;
  showCounterAt?: number;
  skipChipLabel?: string;
  onSkip?: () => void;
  skipped?: boolean;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";
const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft";

export function StepTextArea({
  value,
  onChange,
  placeholder,
  maxLength,
  showCounterAt,
  skipChipLabel,
  onSkip,
  skipped = false,
  ariaLabel,
}: StepTextAreaProps) {
  const showCounter =
    showCounterAt !== undefined && value.length >= showCounterAt;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={skipped}
        className={cn(
          "min-h-24 rounded-[var(--radius-card)] border-[var(--line)] bg-paper",
          skipped && "opacity-50"
        )}
      />
      {showCounter && (
        <div className="self-end text-meta text-ink-3">
          {value.length} / {maxLength}
        </div>
      )}
      {skipChipLabel && onSkip && (
        <button
          type="button"
          aria-pressed={skipped}
          onClick={onSkip}
          className={cn(
            chipBase,
            "self-start",
            skipped ? chipSelected : chipUnselected
          )}
        >
          {skipChipLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/StepTextArea.test.tsx`
Expected: 4 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: ~806 green.

- [ ] **Step 6.5: Commit**

```bash
git add web/src/features/onboarding/components/StepTextArea.tsx web/tests/unit/features/onboarding/StepTextArea.test.tsx
git commit -m "feat(onboarding): add StepTextArea with counter and skip-chip toggle"
```

---

## Task 7: `WizardShell.tsx` — chrome, progress bar, close confirm

**Files:**
- Create: `web/src/features/onboarding/components/WizardShell.tsx`
- Test: `web/tests/unit/features/onboarding/WizardShell.test.tsx`

### Prop surface (frozen — Sprint C's 11 step components all feed this)

```ts
export interface WizardShellProps {
  stepIndex: number;                 // 0..TOTAL_STEPS - 1
  totalSteps: number;                // pass TOTAL_STEPS from reducer module
  category: string;                  // e.g. "Schedule"
  title: string;                     // hero heading text
  subtitle?: string;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  /** Hide the Next button (auto-advance steps render only Back). */
  hideNext?: boolean;
  onClose: () => void;               // called AFTER the user confirms exit
  children: React.ReactNode;         // input slot
}
```

### Semantics (spec §Wizard chrome, §Accessibility)

- **Progress bar.** `role="progressbar"`, `aria-valuemin={1}`, `aria-valuemax={totalSteps}`, `aria-valuenow={stepIndex + 1}`. Fill width computed as `((stepIndex + 1) / totalSteps) * 100%`. Height 2px, track `bg-[var(--line-soft)]`, fill `bg-sage`.
- **Close button.** `<button aria-label="Exit questionnaire">`. Clicking opens a `ConfirmDialog` locally (internal `useState`). Confirming calls `props.onClose()`.
- **Eyebrow.** `text-eyebrow` rendering `STEP ${stepIndex + 1} OF ${totalSteps} · ${category.toUpperCase()}`.
- **Hero heading.** `<h1 ref={headingRef} tabIndex={-1} className="text-hero-serif italic">{title}</h1>`. On mount and whenever `stepIndex` changes, `useEffect` calls `headingRef.current?.focus()`. `tabIndex={-1}` + focus = screen readers announce the heading without putting it in the tab cycle.
- **Subtitle.** `text-sm text-ink-2` below the hero.
- **Input slot.** Render `children` inside a `<div className="flex-1">`.
- **Footer.** Two `Button`s — "Back" (`variant="outline"`) disabled when `stepIndex === 0`, and "Next" (`variant="default"`) disabled when `nextDisabled`. When `hideNext`, Next is not rendered at all.
- Spacing: outer container `flex flex-col min-h-full px-6 py-5 gap-5`.

### Step 7.1 — Write the failing test

Create `web/tests/unit/features/onboarding/WizardShell.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardShell } from "@/features/onboarding/components/WizardShell";

function renderShell(props: Partial<Parameters<typeof WizardShell>[0]> = {}) {
  const defaults = {
    stepIndex: 0,
    totalSteps: 11,
    category: "Schedule",
    title: "How many days?",
    subtitle: "Pick a number.",
    onBack: () => {},
    onNext: () => {},
    onClose: () => {},
    children: <div>input slot</div>,
  } as const;
  return render(<WizardShell {...defaults} {...props} />);
}

describe("WizardShell", () => {
  it("renders a progress bar with aria-valuenow = stepIndex + 1", () => {
    renderShell({ stepIndex: 3, totalSteps: 11 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("11");
  });

  it("disables Back on step 0", () => {
    renderShell({ stepIndex: 0 });
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("hides Next when hideNext is true", () => {
    renderShell({ hideNext: true });
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
  });

  it("clicking the close button opens a confirm dialog; confirming calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell({ onClose });
    // No dialog yet.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /exit questionnaire/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Confirm text from the shell — matches the spec's "Exit? Your answers
    // won't be saved." dialog. Use a flexible regex to keep the test robust
    // against minor copy tweaks.
    await user.click(screen.getByRole("button", { name: /exit/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the hero heading on mount", () => {
    renderShell({ title: "Focus me" });
    const heading = screen.getByRole("heading", { name: "Focus me" });
    expect(heading).toHaveFocus();
  });
});
```

- [ ] **Step 7.1: Write the failing test**

- [ ] **Step 7.2: Confirm failure**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/WizardShell.test.tsx`
Expected: module-resolution failure.

- [ ] **Step 7.3: Create `WizardShell.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { cn } from "@/shared/lib/utils";

export interface WizardShellProps {
  stepIndex: number;
  totalSteps: number;
  category: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  hideNext?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function WizardShell({
  stepIndex,
  totalSteps,
  category,
  title,
  subtitle,
  onBack,
  onNext,
  nextDisabled = false,
  hideNext = false,
  onClose,
  children,
}: WizardShellProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const fillPercent = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-5">
      {/* Top bar: progress + close */}
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={stepIndex + 1}
          className="h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--line-soft)]"
        >
          <div
            className="h-full bg-sage transition-[width] duration-200"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <button
          type="button"
          aria-label="Exit questionnaire"
          onClick={() => setConfirmOpen(true)}
          className="text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Eyebrow + hero + subtitle */}
      <div className="flex flex-col gap-2">
        <div className="text-eyebrow text-ink-3">
          STEP {stepIndex + 1} OF {totalSteps} · {category.toUpperCase()}
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-hero-serif italic text-ink focus:outline-none"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-2 leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Input slot */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <div className={cn("flex gap-2", hideNext ? "justify-start" : "justify-between")}>
        <Button
          variant="outline"
          onClick={onBack}
          disabled={stepIndex === 0}
        >
          Back
        </Button>
        {!hideNext && (
          <Button onClick={onNext} disabled={nextDisabled}>
            Next
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Exit questionnaire?"
        description="Your answers won't be saved."
        confirmText="Exit"
        onConfirm={onClose}
      />
    </div>
  );
}
```

- [ ] **Step 7.4: Run tests green**

Run: `cd web && npm test -- --run tests/unit/features/onboarding/WizardShell.test.tsx`
Expected: 5 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: ~811 green.

- [ ] **Step 7.5: Commit**

```bash
git add web/src/features/onboarding/components/WizardShell.tsx web/tests/unit/features/onboarding/WizardShell.test.tsx
git commit -m "feat(onboarding): add WizardShell with progress bar, close confirm, heading focus"
```

---

## Task 8: Polish — `features/onboarding/CLAUDE.md`

**Files:**
- Create: `web/src/features/onboarding/CLAUDE.md`

No tests. The file is a human-read guide for future contributors and follow-up sprints.

- [ ] **Step 8.1: Write the file**

Create `web/src/features/onboarding/CLAUDE.md`:

```markdown
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
  # Sprint C adds:
  #   OnboardingWelcomeScreen.tsx
  #   QuestionnaireScreen.tsx    (the orchestrator that binds session-storage)
  #   steps/*.tsx                (11 step components)
  # Sprint D adds:
  #   HandoffScreen.tsx
  #   components/LastPromptCard.tsx
```

## Invariants

- **Reducer is pure.** `questionnaire-state.ts` imports only from `./types` and has no clock, no RNG, no storage. The orchestrator binds side effects via `useEffect`.
- **sessionStorage is silent-fail.** `session-storage.ts` swallows every exception — private browsing, quota, missing sessionStorage — and degrades gracefully to "no resume."
- **Exclusivity lives in `ChipMulti`.** The reducer stores whatever values array it receives; the mutual-exclusion rule for "Bodyweight only" is enforced inside `ChipMulti.nextFor`.
- **Prompt co-ships with the GPT instructions.** `prompt-builder.ts` and `docs/custom-gpt/workout-routine-gpt.instructions.md` must be updated in the same commit when the intake topics or lead-in text change.

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

## Design tokens

All tokens pre-exist in `web/src/app/App.css`. This feature uses:
`--radius-pill`, `--radius-card`, `--sage`, `--sage-soft`, `--line`, `--line-soft`, `--ink`, `--ink-2`, `--ink-3`, `--paper`, plus the `text-hero-serif`, `text-eyebrow`, `text-meta` typography utilities. No new tokens or utilities are introduced.
```

- [ ] **Step 8.2: Run the full suite once more**

Run: `cd web && npm test -- --run`
Expected: ~811, green (unchanged by docs edit).

- [ ] **Step 8.3: Commit**

```bash
git add web/src/features/onboarding/CLAUDE.md
git commit -m "docs(onboarding): add feature module guide for the wizard mechanics"
```

---

## Exit criteria for Sprint B

- [ ] `cd web && npm test -- --run` green at ~807–811 tests (spec estimate ~794; modest overshoot from TDD-per-behavior is fine).
- [ ] `questionnaire-state.ts` has zero imports from `./session-storage`, `@/db`, `@/services`, or anything with a side effect. Only `./types`.
- [ ] `session-storage.ts` unit tests cover: round-trip, missing key, clear, throw-on-setItem (mocked), malformed JSON, shape-check fail.
- [ ] `ChipMulti` tests cover BOTH directions of the exclusive-value rule plus the "deselect-sole-exclusive" case.
- [ ] `WizardShell` tests assert heading focus on mount AND close-dialog flow.
- [ ] `git diff --stat main...HEAD` is limited to:
  - `web/src/features/onboarding/lib/questionnaire-state.ts`
  - `web/src/features/onboarding/lib/session-storage.ts`
  - `web/src/features/onboarding/components/{WizardShell,ChipRow,ChipMulti,ChipWithDescription,StepTextArea}.tsx`
  - `web/src/features/onboarding/CLAUDE.md`
  - `web/tests/unit/features/onboarding/{questionnaire-state,session-storage,ChipRow,ChipMulti,ChipWithDescription,StepTextArea,WizardShell}.test.*`
  - plus Sprint A files already merged.
- [ ] `web/package.json` unchanged (no new deps).
- [ ] Frozen prop surfaces (Sprint C imports these verbatim): `WizardShellProps`, `ChipOption`, `ChipRowProps`, `ChipMultiProps`, `ChipWithDescriptionProps`, `StepTextAreaProps`; frozen reducer contract: `WizardState`, `WizardAction`, `initialWizardState`, `TOTAL_STEPS`, `questionnaireReducer`; frozen storage API: `saveWizardState`, `loadWizardState`, `clearWizardState`, `STORAGE_KEY`.

## Self-review

**Spec coverage:**
- §Wizard chrome (progress, eyebrow, hero, close) → Task 7.
- §State management (reducer + actions) → Task 1.
- §Auto-advance rules → props on `ChipRow` / `ChipWithDescription` (the rule itself is enforced by step components in Sprint C calling them with `autoAdvance`).
- §Mid-wizard resume → Task 2.
- §Validation & input limits (maxLength enforcement, counter threshold) → Task 6 `StepTextArea` + ChipRow/ChipMulti's symmetric `exclusiveValue` rule.
- §Accessibility (radiogroup, aria-pressed, progressbar, heading focus, aria-label on close) → distributed across Tasks 3, 4, 5, 7.
- §B.2 plan-review checklist items: all covered (per-action reducer tests ✓, symmetric ChipMulti ✓, heading focus ✓, ConfirmDialog reused ✓, no step components ✓, no onboarding-service usage ✓, RTL `render`/`screen`/`userEvent` ✓, reducer purity commented at top of file via the "Pure reducer" header comment ✓).

**Placeholder scan:** no `TODO`, `TBD`, `fill in`, or "similar to" in this plan. Every code block is complete.

**Type consistency:** `WizardState`, `WizardAction`, `TOTAL_STEPS`, `questionnaireReducer`, `initialWizardState`, `ChipOption`, `ChipRowProps`, `ChipMultiProps`, `ChipWithDescriptionProps`, `StepTextAreaProps`, `WizardShellProps`, `STORAGE_KEY`, `saveWizardState`, `loadWizardState`, `clearWizardState` are referenced with identical names in every task that mentions them and match the orchestration plan's §11 locked contracts (A-6, A-7).

**Scope discipline:** no route, no screen, no step component, no service import in any task. Every file the plan creates is in scope per orchestration §B.0.

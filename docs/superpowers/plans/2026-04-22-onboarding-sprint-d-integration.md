# Onboarding Questionnaire — Sprint D (Integration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the onboarding pieces into the rest of the app: ship `HandoffScreen` (Stage 1 ↔ Stage 2 state machine), the Today banner + greeting change, the Settings Profile + routine-questionnaire re-entry, and the first-run redirect gate. After Sprint D, a fresh install routes into `/onboarding`, a completed questionnaire round-trips a YAML routine through the GPT, and an existing tester sees the greeting and banner without ever leaving Today.

**Architecture:** One new route + three guard redirects in `App.tsx`. `HandoffScreen` is a local state machine driven by `settings.lastGeneratedPrompt` and a navigation-state flag `justCompleted` passed by `QuestionnaireScreen`'s step-11 Next. Stage 2 reuses the existing `validateAndNormalizeRoutine` + `importAndActivateRoutine` pipeline from `RoutineImportScreen`. Today's banner and Settings' Profile are small presentational components that read `useSettings()` and call the 5 `onboarding-service` functions locked in Sprint A.

**Tech Stack:** React 19 + `react-router` v7 · Dexie 4 via existing hooks · `sonner` toasts · `navigator.clipboard` + `window.open` for the hand-off. Zero new runtime dependencies.

---

## Source-of-truth cross-reference

| Concern | Location |
|---|---|
| Sprint scope / deliverables / exit criteria | `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` §Sprint D (§9) |
| Stage 1 / Stage 2 state machine | spec `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` §Finale Screen State Machine |
| Today banner (visibility, dismissal, copy) | spec §Today banner |
| Settings Profile + Routine restructure | spec §Settings Integration |
| First-run gate + route guards | spec §First-run gate + §Error Handling route-guard rows |
| Clipboard / `window.open` / YAML / active-session error paths | spec §Error Handling |
| `buildPrompt` contract (Sprint A output) | `web/src/features/onboarding/lib/prompt-builder.ts` |
| 5 `onboarding-service` functions (Sprint A output) | `web/src/services/onboarding-service.ts` |
| `GPT_URL` constant (Sprint A output) | `web/src/shared/lib/gpt-url.ts` |
| `loadWizardState` / `clearWizardState` (Sprint B output) | `web/src/features/onboarding/lib/session-storage.ts` |
| `ConfirmDialog` (reuse) | `web/src/shared/components/ConfirmDialog.tsx` — supports 2-button confirm/cancel + `doubleConfirm` + `variant` |
| `YamlErrorList` (reuse) | `web/src/features/settings/YamlErrorList.tsx` |
| `validateAndNormalizeRoutine`, `importAndActivateRoutine` | `web/src/services/routine-service.ts` (Stage-2 YAML pipeline) |
| `useSettings` (returns `Settings \| undefined` during initial load) | `web/src/shared/hooks/useSettings.ts` |
| Current TodayScreen greeting (line 164) | `web/src/features/today/TodayScreen.tsx` |
| Current SettingsScreen layout | `web/src/features/settings/SettingsScreen.tsx` |
| Current AppRoutes + route table | `web/src/app/App.tsx` |
| Toast patterns (sonner) | used throughout `WorkoutScreen`, `SettingsScreen`, `RoutineImportScreen` |

---

## File map

**Create (code):**

| Path | Responsibility |
|---|---|
| `web/src/features/onboarding/HandoffScreen.tsx` | Route `/onboarding/handoff`. Two-stage local state machine. Stage 1: `buildPrompt(answers)` from sessionStorage → `saveGeneratedPrompt` → clipboard → `window.open(GPT_URL)` → toast → flip. Stage 2: paste + validate + `importAndActivateRoutine` → `markOnboardingCompleted` + `clearLastPrompt` + `clearWizardState` + navigate to `/`. Default export (lazy-loaded). |
| `web/src/features/onboarding/components/LastPromptCard.tsx` | Shown in SettingsScreen when `settings.lastGeneratedPrompt !== null`. Actions: Copy, Paste YAML (navigate to handoff Stage 2), Show prompt, Clear. Sage-soft accent. Relative-time label via a tiny inline helper. |
| `web/src/features/today/OnboardingBanner.tsx` | Small `role="status"` banner rendered above Today content when `lastGeneratedPrompt !== null && onboardingBannerDismissedAt === null`. Body taps navigate to `/onboarding/handoff`; `×` calls `dismissOnboardingBanner`. |

**Modify:**

| Path | Change |
|---|---|
| `web/src/app/App.tsx` | Add `/onboarding/handoff` lazy route + first-run redirect + 2 guard redirects in `AppRoutes`. |
| `web/src/features/onboarding/QuestionnaireScreen.tsx` | Step-11 `onNext` passes `{ state: { justCompleted: true } }` when navigating to handoff. One-line change. |
| `web/src/features/settings/SettingsScreen.tsx` | Insert Profile section above the Routine section (Your name row with inline editor). Add "✨ Create a personalized routine" row to the Routine section, rendering `<LastPromptCard>` conditionally. No removal of existing rows. |
| `web/src/features/today/TodayScreen.tsx` | Line-164 greeting → `{settings.userName ? \`Hi, ${settings.userName}.\` : "Hello."}`. Render `<OnboardingBanner />` immediately above the existing `<StreakPill />`. |
| `web/src/features/onboarding/CLAUDE.md` | Append a "Sprint D screens shipped" entry + mark `/onboarding/handoff` row as landed (no longer "pending"). |

**Create (tests):**

| Path | Count |
|---|---|
| `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` | ~8 |
| `web/tests/unit/features/onboarding/LastPromptCard.test.tsx` | ~3 |
| `web/tests/unit/features/today/OnboardingBanner.test.tsx` | ~3 |
| `web/tests/unit/features/today/TodayScreen.test.tsx` (new) | ~3 |
| `web/tests/unit/features/settings/SettingsScreen.test.tsx` (new) | ~3 |
| `web/tests/unit/app/AppRoutes.test.tsx` (new) | ~3 |

Expected delta: ~23 new tests (orchestration estimate ~20). Baseline after Sprint C: 844 → **~867**. Ignore the pre-existing `useRoutineLaunchQueue.test.tsx` interleaving flake when it surfaces in full-suite runs; it passes in isolation.

**Out of scope (explicit — do not touch):**
- Any Playwright E2E file — Sprint E.
- Any accessibility audit pass beyond the baseline `role="status"`, `aria-pressed`, `aria-label` already wired — Sprint E.
- Any GPT custom-GPT admin UI paste — that's a Sprint E release-checklist item.
- Any change to step components (Sprint C), reducer (Sprint B), services (Sprint A), or Dexie schema (Sprint A).
- Any refactor of unrelated screens.

---

## Frozen behaviors (from the spec — all tasks must respect)

- **Stage 1 click handler order** (spec §Stage 1):
  1. `const prompt = buildPrompt(answers)`.
  2. `await saveGeneratedPrompt(db, prompt)` — persists `lastGeneratedPrompt`, `lastGeneratedPromptAt`, and resets `onboardingBannerDismissedAt` to `null` in one Dexie call (Sprint A wiring).
  3. `await navigator.clipboard.writeText(prompt)` — wrap in try/catch; on failure, toast "Clipboard blocked — copy manually." AND auto-expand the "Show prompt" block. Continue in all cases.
  4. `const opened = window.open(GPT_URL, "_blank", "noopener,noreferrer")`. If `opened === null` (popup blocker), toast "Popup blocked — use the inline link." and leave an inline `<a href={GPT_URL}>` visible as fallback.
  5. Toast "Prompt copied · GPT opening in a new tab" (only on the happy path where clipboard + window.open both succeed).
  6. `setStage("handoff-complete")` — flip local stage.
- **Stage 2 success path** (spec §Stage 2):
  1. `const parseResult = await validateAndNormalizeRoutine(yaml, lookup)`.
  2. If errors → set `errors` state and return.
  3. `const activation = await importAndActivateRoutine(db, parseResult.routine)`.
  4. If `activation.ok === false` → `toast.error(activation.message)` and return.
  5. `await db.settings.update("user", { onboardingCompletedAt: nowISO(), lastGeneratedPrompt: null, lastGeneratedPromptAt: null, onboardingBannerDismissedAt: null })` — one atomic-ish update.
  6. `clearWizardState()`.
  7. `toast.success("Routine imported. Time to train.")`.
  8. `navigate("/", { replace: true })`.
- **First-run gate** (spec §First-run gate):
  ```ts
  if (
    location.pathname === "/" &&
    settings.onboardingCompletedAt == null &&
    settings.onboardingSkippedAt == null
  ) {
    return <Navigate to="/onboarding" replace />;
  }
  ```
  Applies only to `/`. Does NOT redirect from `/workout`, `/history`, `/settings`, etc.
- **Post-completion guard on `/onboarding`:** redirect to `/` if `onboardingCompletedAt !== null`. Prevents the wizard from appearing after a user has already completed it.
- **Stage-1 guard on `/onboarding/handoff`:** redirect to `/onboarding/questionnaire` if `lastGeneratedPrompt === null` AND the navigation did NOT pass `state.justCompleted === true`. Without this, deep-linking to `/onboarding/handoff` on a fresh install would show an empty Stage 1.

Chip / button visual tokens (unchanged): `rounded-[var(--radius-pill)]`, `rounded-[var(--radius-card)]`, `bg-sage-soft`, `bg-ink text-paper`, `border-[var(--line)]`, `text-hero-serif`, `text-eyebrow`, `text-meta`. No new tokens.

---

## Task ordering rationale

1. **Route scaffolding + `QuestionnaireScreen` navigation state** (Task 1) — unblocks every subsequent HandoffScreen test; the placeholder file makes the route mountable.
2. **Presentational components** — `OnboardingBanner` (Task 2) and `LastPromptCard` (Task 3) — pure, testable in isolation.
3. **`HandoffScreen` Stage 1** (Task 4) — the complex one; mock `navigator.clipboard`, `window.open`, and `fake-indexeddb` for the settings write.
4. **`HandoffScreen` Stage 2** (Task 5) — paste + validate + import; reuses Stage 2 tests from `RoutineImportScreen` as a reference pattern.
5. **`HandoffScreen` exit + Start over** (Task 6) — the edges; small.
6. **First-run redirect gate + guards** (Task 7) — wire the gate in `AppRoutes` and test.
7. **Today greeting + banner integration** (Task 8).
8. **Settings Profile section** (Task 9).
9. **Settings routine restructure — "Create a personalized routine" + `LastPromptCard`** (Task 10).
10. **`CLAUDE.md` polish + sprint-exit sanity run** (Task 11).

Each task is a single commit. Conventional commits: `feat(onboarding): …`, `feat(settings): …`, `feat(today): …`, `feat(app): …`, `test(...): …`, `docs: …`.

---

## Shared conventions

1. **`useSettings()` returns `Settings | undefined`** during initial load. Every task that reads settings must `if (!settings) return null;` before referencing `settings.userName` / `settings.lastGeneratedPrompt` / etc.
2. **`react-router` v7 import path** — NOT `react-router-dom`. See existing screens.
3. **Toasts** — `import { toast } from "sonner"`. Prefer `toast.success` / `toast.error` variants. Do not mount a new Toaster.
4. **Named exports** for components; **default export** for routed screens (required for `React.lazy`).
5. **`cn(...)` helper** from `@/shared/lib/utils` for conditional class composition.
6. **`nowISO()`** from `@/domain/timestamp`. Services already internalize this; consumers rarely need to call it directly.
7. **Test render convention** — mirror `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx`: `fake-indexeddb/auto` + `MemoryRouter` + `Route`/`Routes` wrapper to exercise real navigation. For components that don't use `useNavigate`, a plain `render(<Component />)` is sufficient.
8. **Clipboard mocking** — patch `navigator.clipboard` via `Object.defineProperty` or `vi.stubGlobal` in `beforeEach`. Restore in `afterEach`.
9. **`window.open` mocking** — `vi.spyOn(window, "open").mockImplementation(() => mockWindowRef)` where `mockWindowRef` is an object shaped like `Window` (only `closed: false` is usually needed).

---

## Task 1: Route scaffolding + QuestionnaireScreen navigation state

**Files:**
- Modify: `web/src/app/App.tsx` — add 1 lazy import + 1 route (no guards yet; guards arrive in Task 7).
- Create: `web/src/features/onboarding/HandoffScreen.tsx` — placeholder default-export; replaced in Task 4.
- Modify: `web/src/features/onboarding/QuestionnaireScreen.tsx:onNext` — step-11 navigation passes `{ state: { justCompleted: true } }`.
- Test: extend `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx` — 1 new assertion that the state is passed.

### Step 1.1 — Create placeholder `HandoffScreen.tsx`

```tsx
export default function HandoffScreen() {
  return <div className="p-6 text-sm text-ink-2">Handoff (placeholder)</div>;
}
```

### Step 1.2 — Update `App.tsx`

Add the lazy import alongside Sprint C's two:

```tsx
const HandoffScreen = lazy(
  () => import("@/features/onboarding/HandoffScreen"),
);
```

Inside the `<Route element={<Shell />}>` block, after the existing `/onboarding/questionnaire` route (Sprint C), add:

```tsx
          <Route path="/onboarding/handoff" element={<HandoffScreen />} />
```

Leave the catch-all `<Route path="*" element={<Navigate to="/" replace />} />` as the last route.

### Step 1.3 — Update `QuestionnaireScreen.tsx:onNext`

Find the `onNext` function (currently dispatches `next` or navigates to handoff at stepIndex 10). Change the navigate call from:

```ts
navigate("/onboarding/handoff");
```

to:

```ts
navigate("/onboarding/handoff", { state: { justCompleted: true } });
```

No other change in that file.

### Step 1.4 — Extend the orchestrator test

Append to `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`'s existing `describe("QuestionnaireScreen", …)` block (after the "step-11 Next navigates" test), a new test that asserts the navigation state is carried:

```tsx
  it("step-11 Next navigates with state.justCompleted === true", async () => {
    sessionStorage.clear();
    const { saveWizardState } = await import(
      "@/features/onboarding/lib/session-storage"
    );
    saveWizardState({ stepIndex: 10, answers: {} });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
        <Routes>
          <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
          <Route
            path="/onboarding/handoff"
            element={<LocationReporter />}
          />
        </Routes>
      </MemoryRouter>
    );
    await user.click(await screen.findByLabelText("Yes"));
    expect(await screen.findByTestId("loc-state")).toHaveTextContent(
      "justCompleted:true"
    );
  });
```

Add this helper component BELOW the existing `WithRouter` function:

```tsx
import { useLocation } from "react-router";
function LocationReporter() {
  const loc = useLocation();
  const state = loc.state as { justCompleted?: boolean } | null;
  return (
    <div data-testid="loc-state">
      justCompleted:{String(state?.justCompleted === true)}
    </div>
  );
}
```

(If `useLocation` is already imported at the top of the test file, skip the duplicate import.)

### Step 1.5 — Run and commit

Run: `cd web && npm test -- --run tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
Expected: all 7 tests pass (6 existing + 1 new).

Full suite: `cd web && npm test -- --run`
Expected: **845** (844 + 1). Ignore the `useRoutineLaunchQueue` flake.

```bash
git add web/src/app/App.tsx web/src/features/onboarding/HandoffScreen.tsx web/src/features/onboarding/QuestionnaireScreen.tsx web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx
git commit -m "feat(onboarding): add /onboarding/handoff route and pass justCompleted state"
```

---

## Task 2: `OnboardingBanner` component

**Files:**
- Create: `web/src/features/today/OnboardingBanner.tsx`
- Create: `web/tests/unit/features/today/OnboardingBanner.test.tsx`

### Behavior

- `role="status"` for assistive tech.
- Tap on the body → `navigate("/onboarding/handoff")`.
- `×` button → calls `onDismiss` prop. The parent (Sprint D Task 8 — TodayScreen) wires `onDismiss` to `dismissOnboardingBanner(db)`.
- Visual: `rounded-[12px]` (12px, not the card 18px), `bg-sage-soft`, `border border-[var(--line)]`, `text-ink-2`, `px-4 py-3`, `flex items-center justify-between gap-3`.
- Body text: `📋 Paste your routine YAML here →`.
- Close button: `aria-label="Dismiss banner"`, `×` visible character.

### Prop surface

```ts
export interface OnboardingBannerProps {
  onDismiss: () => void;
}
```

The banner is pure presentational — parent decides when to render it (based on the visibility rule from the spec).

### Step 2.1 — Write the failing test

Create `web/tests/unit/features/today/OnboardingBanner.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { OnboardingBanner } from "@/features/today/OnboardingBanner";

function WithRouter({ onDismiss }: { onDismiss: () => void }) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<OnboardingBanner onDismiss={onDismiss} />} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingBanner", () => {
  it("renders with role=status and the spec-exact body text", () => {
    render(<WithRouter onDismiss={() => {}} />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent ?? "").toContain("Paste your routine YAML here");
  });

  it("clicking the body navigates to /onboarding/handoff", async () => {
    const user = userEvent.setup();
    render(<WithRouter onDismiss={() => {}} />);
    await user.click(screen.getByRole("button", { name: /paste your routine/i }));
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();
  });

  it("clicking × calls onDismiss and does NOT navigate", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<WithRouter onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("HANDOFF")).not.toBeInTheDocument();
  });
});
```

### Step 2.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/today/OnboardingBanner.test.tsx`
Expected: module-resolution failure.

### Step 2.3 — Implement

Create `web/src/features/today/OnboardingBanner.tsx`:

```tsx
import { useNavigate } from "react-router";

export interface OnboardingBannerProps {
  onDismiss: () => void;
}

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  const navigate = useNavigate();
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--line)] bg-sage-soft px-4 py-3 text-ink-2"
    >
      <button
        type="button"
        onClick={() => navigate("/onboarding/handoff")}
        className="flex-1 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded"
      >
        📋 Paste your routine YAML here →
      </button>
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={onDismiss}
        className="flex size-6 items-center justify-center rounded-full text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
```

### Step 2.4 — Verify green

Run: `cd web && npm test -- --run tests/unit/features/today/OnboardingBanner.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **848** (845 + 3).

### Step 2.5 — Commit

```bash
git add web/src/features/today/OnboardingBanner.tsx web/tests/unit/features/today/OnboardingBanner.test.tsx
git commit -m "feat(today): add OnboardingBanner with dismiss and handoff navigation"
```

---

## Task 3: `LastPromptCard` component

**Files:**
- Create: `web/src/features/onboarding/components/LastPromptCard.tsx`
- Create: `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`

### Behavior

- Hidden (returns `null`) when `settings.lastGeneratedPrompt === null`. Parent can render unconditionally and the component self-gates.
- Shown with:
  - Relative-time label ("just now" / "5 minutes ago" / "2 hours ago" / "3 days ago") derived from `settings.lastGeneratedPromptAt`.
  - Actions as buttons/rows:
    - **Copy** — `navigator.clipboard.writeText(lastGeneratedPrompt)` + toast "Prompt copied" on success, toast "Clipboard blocked — copy manually." on failure.
    - **Paste YAML** — `navigate("/onboarding/handoff")` (lands on Stage 2 because `lastGeneratedPrompt !== null`).
    - **Show prompt** — toggles a collapsed `<pre>` block showing the prompt text, `readOnly` textarea under the fold for select-all-copy fallback.
    - **Clear** — confirms, then `clearLastPrompt(db)`.
- Visual: `rounded-[var(--radius-card)] bg-sage-soft border border-[var(--line)] p-4 space-y-3`.

### Prop surface

```ts
export interface LastPromptCardProps {
  settings: Settings; // caller has already confirmed lastGeneratedPrompt !== null is possible
}
```

### Relative-time helper

Inline the helper at top of the file — no need for a separate module:

```ts
function relativeTime(iso: string | null): string {
  if (iso === null) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
```

### Step 3.1 — Write the failing test

Create `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { LastPromptCard } from "@/features/onboarding/components/LastPromptCard";
import type { Settings } from "@/domain/types";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "user",
    activeRoutineId: null,
    units: "kg",
    userName: null,
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    lastGeneratedPrompt: "SAVED PROMPT",
    lastGeneratedPromptAt: new Date().toISOString(),
    onboardingBannerDismissedAt: null,
    ...overrides,
  };
}

function WithRouter({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={children} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LastPromptCard", () => {
  beforeEach(async () => {
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.settings.clear();
    await db.settings.put(makeSettings());
    await db.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when settings.lastGeneratedPrompt === null", () => {
    const { container } = render(
      <WithRouter>
        <LastPromptCard
          settings={makeSettings({
            lastGeneratedPrompt: null,
            lastGeneratedPromptAt: null,
          })}
        />
      </WithRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the relative time label", () => {
    render(
      <WithRouter>
        <LastPromptCard settings={makeSettings()} />
      </WithRouter>
    );
    // Fresh timestamp → "just now" label.
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it("Paste YAML navigates to /onboarding/handoff", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <LastPromptCard settings={makeSettings()} />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /paste yaml/i }));
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();
  });
});
```

### Step 3.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/onboarding/LastPromptCard.test.tsx`
Expected: module-resolution failure.

### Step 3.3 — Implement

Create `web/src/features/onboarding/components/LastPromptCard.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { db } from "@/db/database";
import { clearLastPrompt } from "@/services/onboarding-service";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import type { Settings } from "@/domain/types";

export interface LastPromptCardProps {
  settings: Settings;
}

function relativeTime(iso: string | null): string {
  if (iso === null) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function LastPromptCard({ settings }: LastPromptCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  if (settings.lastGeneratedPrompt === null) return null;

  const prompt = settings.lastGeneratedPrompt;
  const when = relativeTime(settings.lastGeneratedPromptAt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Clipboard blocked — copy manually.");
      setExpanded(true);
    }
  };

  const handleClear = async () => {
    await clearLastPrompt(db);
    toast.success("Saved prompt cleared");
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-sage-soft border border-[var(--line)] p-4 space-y-3"
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-eyebrow text-sage-deep">Saved prompt</p>
        <p className="text-meta">{when}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-sage-soft/50"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => navigate("/onboarding/handoff")}
          className="rounded-[var(--radius-pill)] bg-ink px-3 py-1.5 text-sm text-paper hover:opacity-90"
        >
          Paste YAML
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-sage-soft/50"
        >
          {expanded ? "Hide prompt" : "Show prompt"}
        </button>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5"
        >
          Clear
        </button>
      </div>
      {expanded && (
        <Textarea
          value={prompt}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-48 font-mono text-xs bg-paper"
        />
      )}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear saved prompt?"
        description="You'll need to re-run the questionnaire to generate a new one."
        confirmText="Clear"
        onConfirm={handleClear}
        variant="destructive"
      />
    </div>
  );
}
```

### Step 3.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/onboarding/LastPromptCard.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **851** (848 + 3).

### Step 3.5 — Commit

```bash
git add web/src/features/onboarding/components/LastPromptCard.tsx web/tests/unit/features/onboarding/LastPromptCard.test.tsx
git commit -m "feat(onboarding): add LastPromptCard with copy/paste/show/clear actions"
```

---

## Task 4: `HandoffScreen` — Stage 1

**Files:**
- Modify: `web/src/features/onboarding/HandoffScreen.tsx` (replace placeholder with Stage 1 implementation)
- Create: `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` (Stage 1 tests only; Tasks 5 and 6 extend)

### Behavior (Stage 1 only — Stage 2 lands in Task 5)

Stage selection logic on mount:

```ts
const location = useLocation();
const justCompleted = (location.state as { justCompleted?: boolean } | null)?.justCompleted === true;

// Stage 1 if: lastGeneratedPrompt is null AND justCompleted (user just finished the wizard).
// Stage 2 if: lastGeneratedPrompt !== null OR local stage === "handoff-complete".
const [localStage, setLocalStage] = useState<"stage1" | "handoff-complete">("stage1");
const stage: "stage1" | "stage2" =
  localStage === "handoff-complete" || settings.lastGeneratedPrompt !== null
    ? "stage2"
    : "stage1";
```

Stage 1 UI:
- Eyebrow `READY`.
- Hero: `"Ready to build your routine?"` (serif italic).
- Subtitle: `"Tap below to copy your prompt and open the routine-maker GPT. Paste it there, then switch back here with the YAML."`
- Primary button `Copy prompt & open GPT →`.
- Secondary button `Show prompt` (expands a `readOnly` Textarea with the prompt that would be copied).
- Tertiary button `Start over` — Task 6.
- `×` close — Task 6.

The Stage-1 primary button reads `state.answers` from sessionStorage via `loadWizardState()`, calls `buildPrompt(answers)`, then runs the spec's 6-step procedure.

Guard: if `settings !== undefined && settings.lastGeneratedPrompt === null && !justCompleted`, the screen should redirect to `/onboarding/questionnaire`. Task 7 lifts this redirect to `AppRoutes`; Task 4 includes a local fallback because it's needed by the tests before Task 7 lands.

### Step 4.1 — Write the failing tests

Create `web/tests/unit/features/onboarding/HandoffScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import HandoffScreen from "@/features/onboarding/HandoffScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Answers } from "@/features/onboarding/lib/types";

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

async function seedSettings(overrides: Partial<Parameters<typeof db.settings.put>[0]> = {}) {
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

describe("HandoffScreen — Stage 1", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects to /onboarding/questionnaire when no prompt saved and not justCompleted", async () => {
    await seedSettings();
    render(<WithRouter />);
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });

  it("renders Stage 1 when justCompleted=true and no saved prompt", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    render(<WithRouter initialState={{ justCompleted: true }} />);
    expect(
      await screen.findByRole("heading", { name: /ready to build your routine/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy prompt & open gpt/i })
    ).toBeInTheDocument();
  });

  it("Stage 1 button: persists prompt, writes clipboard, opens GPT, flips to Stage 2", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false } as Window));

    const user = userEvent.setup();
    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );

    // Stage 2 heading surfaces.
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();

    // Clipboard received the built prompt (spot-check the D10 line).
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]![0] as string;
    expect(copied).toContain("- Distinct training days desired: 3");
    expect(copied).not.toContain("Distinct training days desired: 3 (");

    // window.open was called with the GPT URL.
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0] ?? [];
    expect(url).toContain("chatgpt.com");
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");

    // Settings was updated: prompt + promptAt persisted, banner reset.
    const db2 = new ExerciseLoggerDB();
    await waitFor(async () => {
      const s = await db2.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe(copied);
      expect(s?.lastGeneratedPromptAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
    await db2.close();
  });

  it("Stage 1 button: clipboard failure toasts but still flips to Stage 2", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
      configurable: true,
    });
    vi.spyOn(window, "open").mockImplementation(() => ({ closed: false } as Window));

    const user = userEvent.setup();
    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
  });

  it("Stage 1 button: popup blocker returns null — flips to Stage 2 with inline GPT link", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    vi.spyOn(window, "open").mockImplementation(() => null);

    const user = userEvent.setup();
    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
    // Stage 2 should surface an inline fallback link.
    expect(
      screen.getByRole("link", { name: /open gpt/i })
    ).toBeInTheDocument();
  });

  it("Stage 2 shown directly when settings.lastGeneratedPrompt !== null", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
  });
});
```

### Step 4.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`
Expected: multiple failures — the placeholder has no buttons, no routing.

### Step 4.3 — Implement (Stage 1 only — Stage 2 stub rendered for test 5's heading match)

Replace `web/src/features/onboarding/HandoffScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import { saveGeneratedPrompt } from "@/services/onboarding-service";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import { loadWizardState } from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

type Stage = "stage1" | "handoff-complete";

export default function HandoffScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const justCompleted =
    (location.state as { justCompleted?: boolean } | null)?.justCompleted ===
    true;

  const [localStage, setLocalStage] = useState<Stage>("stage1");
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Guard: redirect when no prompt saved AND no just-completed flag.
  useEffect(() => {
    if (!settings) return;
    if (
      settings.lastGeneratedPrompt === null &&
      !justCompleted &&
      localStage === "stage1"
    ) {
      navigate("/onboarding/questionnaire", { replace: true });
    }
  }, [settings, justCompleted, localStage, navigate]);

  if (!settings) return null;

  const stage: "stage1" | "stage2" =
    localStage === "handoff-complete" || settings.lastGeneratedPrompt !== null
      ? "stage2"
      : "stage1";

  // The prompt shown under "Show prompt": built from sessionStorage on Stage 1,
  // or the saved one on Stage 2.
  let promptPreview = "";
  if (stage === "stage1") {
    const wiz = loadWizardState();
    try {
      if (wiz !== null) promptPreview = buildPrompt(wiz.answers);
    } catch {
      promptPreview = "";
    }
  } else {
    promptPreview = settings.lastGeneratedPrompt ?? "";
  }

  async function handleStage1Button() {
    if (busy) return;
    const wiz = loadWizardState();
    if (wiz === null) {
      toast.error("No answers found. Restart the questionnaire.");
      return;
    }
    let prompt: string;
    try {
      prompt = buildPrompt(wiz.answers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build prompt");
      return;
    }
    setBusy(true);
    try {
      await saveGeneratedPrompt(db, prompt);
      let clipboardOk = true;
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        clipboardOk = false;
        toast.error("Clipboard blocked — copy manually.");
        setShowPrompt(true);
      }
      const opened = window.open(GPT_URL, "_blank", "noopener,noreferrer");
      if (opened === null) {
        setPopupBlocked(true);
        toast.error("Popup blocked — use the inline link.");
      } else if (clipboardOk) {
        toast.success("Prompt copied · GPT opening in a new tab");
      }
      setLocalStage("handoff-complete");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "stage1") {
    return (
      <div className="flex min-h-full flex-col gap-5 px-6 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-ink-3">READY</p>
          <h1 className="text-hero-serif italic text-ink">
            Ready to build your routine?
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Tap below to copy your prompt and open the routine-maker GPT. Paste
            it there, then switch back here with the YAML.
          </p>
        </div>

        <Button onClick={handleStage1Button} disabled={busy}>
          Copy prompt & open GPT →
        </Button>

        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          aria-pressed={showPrompt}
          className="self-start text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </button>

        {showPrompt && (
          <Textarea
            value={promptPreview}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-48 font-mono text-xs bg-paper"
          />
        )}
      </div>
    );
  }

  // Stage 2 — Task 5 replaces this stub.
  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-3">YOUR TURN</p>
        <h1 className="text-hero-serif italic text-ink">
          Paste your routine when you're back.
        </h1>
      </div>
      {popupBlocked && (
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm text-sage-deep underline"
        >
          Open GPT
        </a>
      )}
    </div>
  );
}
```

### Step 4.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`
Expected: all 6 Stage-1 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **857** (851 + 6). Ignore the `useRoutineLaunchQueue` flake.

### Step 4.5 — Commit

```bash
git add web/src/features/onboarding/HandoffScreen.tsx web/tests/unit/features/onboarding/HandoffScreen.test.tsx
git commit -m "feat(onboarding): add HandoffScreen Stage 1 with prompt persist, clipboard, GPT window"
```

---

## Task 5: `HandoffScreen` — Stage 2 (paste / validate / import / complete)

**Files:**
- Modify: `web/src/features/onboarding/HandoffScreen.tsx` — replace the Stage-2 stub with the real paste form.
- Modify: `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` — append Stage-2 tests.

### Behavior

Stage 2 UI:
- Eyebrow `YOUR TURN`.
- Hero: `Paste your routine when you're back.`
- Subtitle: `When the GPT gives you YAML, copy it and paste it below.`
- YAML paste area (`<Textarea>`, monospace, min-h-48).
- `Paste from clipboard` chip — tries `navigator.clipboard.readText()`, fills the textarea on success; toasts `"Couldn't read clipboard. Long-press to paste manually."` on failure.
- Inline errors via `<YamlErrorList>`.
- Primary `Import routine →`. Handler = the spec's 8-step success path.
- If `popupBlocked` was set during Stage 1, render the inline GPT link above the textarea.

### Step 5.1 — Write the failing tests

Append to `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` (at the end, before the closing `});` of the Stage-1 describe OR in a new describe block — use a new `describe("HandoffScreen — Stage 2", …)` block for clarity).

Add these imports at the top of the test file (if not already present):

```tsx
import * as routineSvc from "@/services/routine-service";
```

Append the new describe block:

```tsx
describe("HandoffScreen — Stage 2", () => {
  beforeEach(async () => {
    sessionStorage.clear();
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
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
      onboardingBannerDismissedAt: null,
    });
    await db.close();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("invalid YAML shows errors and does NOT navigate", async () => {
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: false,
      errors: [{ path: "routine.days", message: "must be a map" }],
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "not yaml"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText(/must be a map/i)).toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
  });

  it("valid YAML imports, clears prompt, sets completed, navigates to /", async () => {
    const fakeRoutine = {
      id: "r1",
      schemaVersion: 1,
      name: "Import Me",
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
      "name: Import Me"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();

    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(s?.lastGeneratedPromptAt).toBeNull();
    expect(s?.onboardingCompletedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(s?.onboardingBannerDismissedAt).toBeNull();
    await db2.close();
  });

  it("active-session block toasts the failure message and leaves prompt in place", async () => {
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

    // Still on Stage 2 — no navigation to HOME.
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();

    // Prompt is preserved.
    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    expect(s?.onboardingCompletedAt).toBeNull();
    await db2.close();
  });
});
```

### Step 5.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`
Expected: the new Stage 2 tests fail (no textarea, no Import button, etc.).

### Step 5.3 — Implement Stage 2

Replace the Stage-2 branch at the bottom of `HandoffScreen.tsx`:

```tsx
// Replace the Stage-2 stub (the branch after `if (stage === "stage1") return …`).

  // Stage 2 — paste + validate + import + complete.
  return <Stage2 settings={settings} popupBlocked={popupBlocked} />;
}
```

Then add a new `Stage2` component inside the same file (below `HandoffScreen`):

```tsx
import { nowISO } from "@/domain/timestamp";
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
} from "@/services/routine-service";
import { YamlErrorList } from "@/features/settings/YamlErrorList";
import { clearWizardState } from "@/features/onboarding/lib/session-storage";

interface Stage2Props {
  settings: import("@/domain/types").Settings;
  popupBlocked: boolean;
}

function Stage2({ settings, popupBlocked }: Stage2Props) {
  const navigate = useNavigate();
  const [yaml, setYaml] = useState("");
  const [errors, setErrors] = useState<
    import("@/services/routine-service").ValidationError[]
  >([]);
  const [importing, setImporting] = useState(false);

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setYaml(text);
    } catch {
      toast.error("Couldn't read clipboard. Long-press to paste manually.");
    }
  }

  async function handleImport() {
    if (importing) return;
    if (yaml.trim() === "") {
      setErrors([{ path: "", message: "YAML is empty" }]);
      return;
    }
    setImporting(true);
    setErrors([]);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yaml, lookup);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        toast.error(activation.message);
        return;
      }
      await db.settings.update("user", {
        onboardingCompletedAt: nowISO(),
        lastGeneratedPrompt: null,
        lastGeneratedPromptAt: null,
        onboardingBannerDismissedAt: null,
      });
      clearWizardState();
      toast.success("Routine imported. Time to train.");
      navigate("/", { replace: true });
    } catch (err) {
      setErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-3">YOUR TURN</p>
        <h1 className="text-hero-serif italic text-ink">
          Paste your routine when you're back.
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          When the GPT gives you YAML, copy it and paste it below.
        </p>
      </div>

      {popupBlocked && (
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm text-sage-deep underline"
        >
          Open GPT
        </a>
      )}

      <button
        type="button"
        onClick={handlePasteFromClipboard}
        className="self-start rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-sage-soft/50"
      >
        Paste from clipboard
      </button>

      <Textarea
        aria-label="YAML"
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        placeholder="Paste your YAML here"
        className="min-h-48 font-mono text-xs bg-paper"
      />

      <YamlErrorList errors={errors} />

      <Button onClick={handleImport} disabled={importing}>
        Import routine →
      </Button>
    </div>
  );
}
```

### Step 5.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`
Expected: all 9 tests pass (6 Stage-1 + 3 Stage-2).

Full suite: `cd web && npm test -- --run`
Expected: **860** (857 + 3).

### Step 5.5 — Commit

```bash
git add web/src/features/onboarding/HandoffScreen.tsx web/tests/unit/features/onboarding/HandoffScreen.test.tsx
git commit -m "feat(onboarding): add HandoffScreen Stage 2 with YAML import and completion"
```

---

## Task 6: `HandoffScreen` — exit confirmation + Start over

**Files:**
- Modify: `web/src/features/onboarding/HandoffScreen.tsx` — add a top-right close button (Stage 1 only) and a `Start over` button that confirms, then resets.
- Modify: `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` — add 2 tests.

### Behavior

- Close `×` (Stage 1 only): opens `ConfirmDialog` ("Exit? Your answers won't be saved.") — confirm → `clearWizardState()` + `navigate("/", { replace: true })`.
- `Start over` (Stage 1 AND Stage 2): opens `ConfirmDialog` ("Start over? This clears your current answers.") — confirm → `await clearLastPrompt(db)` (safe on Stage 1 — no prompt to clear yet) + `clearWizardState()` + `navigate("/onboarding/questionnaire", { replace: true })`.
- Stage 2's Start over also clears the saved prompt (idempotent via `clearLastPrompt`).

### Step 6.1 — Write the failing tests

Append to `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` (at the end of the file, as a new describe block):

```tsx
describe("HandoffScreen — exit and Start over", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("Stage 1 close button confirms, clears wizard state, and navigates home", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const user = userEvent.setup();
    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /exit/i, hidden: false })
    );
    // ConfirmDialog opens; click the Exit confirm button.
    await user.click(screen.getByRole("button", { name: /^exit$/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("Start over on Stage 2 clears prompt and routes to the questionnaire", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    await user.click(
      screen.getByRole("button", { name: /^start over$/i })
    );
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();

    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    await db2.close();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

Note the test uses `seedSettings` which is defined once at the top of the file and shared across describe blocks.

### Step 6.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`

### Step 6.3 — Implement

In `HandoffScreen.tsx`:

1. Add at the top of the file (in the import block):

```tsx
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { clearLastPrompt } from "@/services/onboarding-service";
```

2. Inside the `HandoffScreen` component, add before the Stage-1 `return`:

```tsx
  const [exitOpen, setExitOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);

  async function handleExit() {
    clearWizardState();
    navigate("/", { replace: true });
  }

  async function handleStartOver() {
    if (settings.lastGeneratedPrompt !== null) {
      await clearLastPrompt(db);
    }
    clearWizardState();
    navigate("/onboarding/questionnaire", { replace: true });
  }
```

Also import `clearWizardState` at the top if not already (it is imported further down; move it to the top of the import block for clarity).

3. In the Stage-1 return, add a top-right close button and a `Start over` button. Replace the Stage-1 JSX with:

```tsx
  if (stage === "stage1") {
    return (
      <div className="flex min-h-full flex-col gap-5 px-6 py-8">
        <div className="flex items-start justify-between">
          <p className="text-eyebrow text-ink-3">READY</p>
          <button
            type="button"
            aria-label="Exit"
            onClick={() => setExitOpen(true)}
            className="text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-hero-serif italic text-ink">
            Ready to build your routine?
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Tap below to copy your prompt and open the routine-maker GPT. Paste
            it there, then switch back here with the YAML.
          </p>
        </div>

        <Button onClick={handleStage1Button} disabled={busy}>
          Copy prompt & open GPT →
        </Button>

        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          aria-pressed={showPrompt}
          className="self-start text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </button>

        {showPrompt && (
          <Textarea
            value={promptPreview}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-48 font-mono text-xs bg-paper"
          />
        )}

        <button
          type="button"
          onClick={() => setStartOverOpen(true)}
          className="self-start text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          Start over
        </button>

        <ConfirmDialog
          open={exitOpen}
          onOpenChange={setExitOpen}
          title="Exit?"
          description="Your answers won't be saved."
          confirmText="Exit"
          onConfirm={handleExit}
        />
        <ConfirmDialog
          open={startOverOpen}
          onOpenChange={setStartOverOpen}
          title="Start over?"
          description="This clears your current answers."
          confirmText="Start over"
          onConfirm={handleStartOver}
        />
      </div>
    );
  }
```

4. In the Stage-2 component (the nested `Stage2` function), add a Start-over button + ConfirmDialog. Since `Stage2` is a separate component, it needs its own copy of `handleStartOver`. Refactor to pass the handler down — or move the Start-over UI into the parent. Cleanest option: make the Start-over flow a prop on `Stage2`.

Add to `Stage2Props`:

```tsx
interface Stage2Props {
  settings: import("@/domain/types").Settings;
  popupBlocked: boolean;
  onStartOver: () => void;
}
```

Pass `onStartOver={() => setStartOverOpen(true)}` from the parent. Inside `Stage2`, add:

```tsx
      <button
        type="button"
        onClick={onStartOver}
        className="self-start text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
      >
        Start over
      </button>
```

And the ConfirmDialog already lives in the parent, so no duplication.

### Step 6.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/onboarding/HandoffScreen.test.tsx`
Expected: all 11 tests pass (9 prior + 2 new).

Full suite: `cd web && npm test -- --run`
Expected: **862** (860 + 2).

### Step 6.5 — Commit

```bash
git add web/src/features/onboarding/HandoffScreen.tsx web/tests/unit/features/onboarding/HandoffScreen.test.tsx
git commit -m "feat(onboarding): add HandoffScreen exit confirm and Start over"
```

---

## Task 7: First-run gate + route guards in `AppRoutes`

**Files:**
- Modify: `web/src/app/App.tsx` — insert gate logic inside `AppRoutes` (before the `<Routes>` return).
- Create: `web/tests/unit/app/AppRoutes.test.tsx`

The Task-4 local fallback (the `useEffect` redirect in `HandoffScreen`) remains as a defensive net — it's still exercised in the HandoffScreen tests and doesn't conflict with `AppRoutes`' guard because `useEffect` runs AFTER the first render and `AppRoutes`' `Navigate` short-circuits the render.

### Guard rules (spec §First-run gate + §Error Handling)

```ts
// Inside AppRoutes, after `if (!ready) return <LoadingState fullscreen />;`:

if (!settings) return <LoadingState fullscreen />;

// First-run gate: fresh install → welcome.
if (
  location.pathname === "/" &&
  settings.onboardingCompletedAt == null &&
  settings.onboardingSkippedAt == null
) {
  return <Navigate to="/onboarding" replace />;
}

// Post-completion guard on /onboarding.
if (
  location.pathname === "/onboarding" &&
  settings.onboardingCompletedAt !== null
) {
  return <Navigate to="/" replace />;
}

// Handoff guard: no prompt AND no just-completed → back to questionnaire.
if (
  location.pathname === "/onboarding/handoff" &&
  settings.lastGeneratedPrompt === null &&
  (location.state as { justCompleted?: boolean } | null)?.justCompleted !== true
) {
  return <Navigate to="/onboarding/questionnaire" replace />;
}
```

`settings` comes from `useSettings()`. `location` comes from `useLocation()`.

### Step 7.1 — Write the failing test

Create `web/tests/unit/app/AppRoutes.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "@/app/App";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import type { Settings } from "@/domain/types";

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

describe("AppRoutes first-run gate", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("fresh install at / redirects to /onboarding", async () => {
    await seedSettings();
    // App uses BrowserRouter — swap to MemoryRouter via a thin shim would
    // need App to accept router context. Simpler: construct a smaller
    // AppRoutes-equivalent test by importing AppRoutes directly if
    // exported, or assert the effect via DOM content ("Welcome" heading).
    //
    // To keep the test surgically small, we don't import App.tsx's default
    // export (which wraps BrowserRouter). Instead this test lives as a
    // DOM-level sanity check: render the whole App, then let the DB seed
    // drive the routing. Because the BrowserRouter defaults to the current
    // window location ("/" in jsdom), the gate should redirect immediately.

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /what should we call you/i })
    ).toBeInTheDocument();
  });

  it("completed user at / stays on Today", async () => {
    await seedSettings({ onboardingCompletedAt: new Date().toISOString() });
    render(<App />);
    // "Hello." appears on TodayScreen; wait for the initial DB settle.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /what should we call you/i })
      ).not.toBeInTheDocument();
    });
  });

  it("skipped user at / stays on Today", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(<App />);
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /what should we call you/i })
      ).not.toBeInTheDocument();
    });
  });
});
```

**Caveat for this task:** `App.tsx` mounts `BrowserRouter`, which in jsdom uses `window.location` — defaulting to `"/"`. If that assumption doesn't hold, adjust by exporting `AppRoutes` (named export) from `App.tsx` and wrapping with `MemoryRouter` in the test. That's the cleaner approach. Update `App.tsx` to add `export function AppRoutes()` alongside the existing local-only function, and import it in the test:

```tsx
import { AppRoutes } from "@/app/App";
// Wrap with <MemoryRouter initialEntries={["/"]}>...
```

Prefer this cleaner approach. Update `App.tsx` to change `function AppRoutes()` → `export function AppRoutes()`.

### Step 7.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/app/AppRoutes.test.tsx`
Expected: failures — no gate installed yet.

### Step 7.3 — Implement the gate

In `web/src/app/App.tsx`:

1. Add `useSettings` import:

```tsx
import { useSettings } from "@/shared/hooks/useSettings";
```

2. Change `function AppRoutes() {` to `export function AppRoutes() {` (so the test can mount it in `MemoryRouter`).

3. Inside `AppRoutes`, add after `const { ready, error } = useAppInit();`:

```tsx
  const settings = useSettings();
  const location = useLocation();
```

4. After the existing `if (!ready) return <LoadingState fullscreen />;`, add:

```tsx
  if (!settings) return <LoadingState fullscreen />;

  // First-run gate.
  if (
    location.pathname === "/" &&
    settings.onboardingCompletedAt == null &&
    settings.onboardingSkippedAt == null
  ) {
    return <Navigate to="/onboarding" replace />;
  }
  // Post-completion guard on /onboarding.
  if (
    location.pathname === "/onboarding" &&
    settings.onboardingCompletedAt !== null
  ) {
    return <Navigate to="/" replace />;
  }
  // Handoff guard: no prompt AND no just-completed → back to questionnaire.
  if (
    location.pathname === "/onboarding/handoff" &&
    settings.lastGeneratedPrompt === null &&
    (location.state as { justCompleted?: boolean } | null)?.justCompleted !== true
  ) {
    return <Navigate to="/onboarding/questionnaire" replace />;
  }
```

`useLocation` is already imported at the top of `App.tsx` (used by `FadeRoute`).

### Step 7.4 — Verify

Run: `cd web && npm test -- --run tests/unit/app/AppRoutes.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **865** (862 + 3). Watch for cascade failures — the `RoutineImportScreen` test (which mounts via React Router with a seeded DB) may be affected by the new gate. If any existing test breaks, investigate before proceeding.

### Step 7.5 — Commit

```bash
git add web/src/app/App.tsx web/tests/unit/app/AppRoutes.test.tsx
git commit -m "feat(app): add first-run redirect gate and onboarding route guards"
```

---

## Task 8: TodayScreen greeting + banner

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx` — change line-164 greeting; render `<OnboardingBanner>` above `<StreakPill>` when visible.
- Create: `web/tests/unit/features/today/TodayScreen.test.tsx`

### Behavior

Greeting:

```tsx
const greeting = settings.userName ? `Hi, ${settings.userName}.` : "Hello.";
<h1 className="text-hero-serif italic text-foreground">{greeting}</h1>
```

Banner visibility:

```ts
const showBanner =
  settings.lastGeneratedPrompt !== null &&
  settings.onboardingBannerDismissedAt === null;
```

When true, render:

```tsx
<OnboardingBanner onDismiss={() => dismissOnboardingBanner(db)} />
```

immediately ABOVE the existing `<StreakPill>` in the State-B (normal) render path. State C (active session — the "Resume workout" card) is unchanged; no banner. State A (no active routine) is unchanged.

### Step 8.1 — Write the failing test

Create `web/tests/unit/features/today/TodayScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import TodayScreen from "@/features/today/TodayScreen";
import {
  ExerciseLoggerDB,
  initializeSettings,
  DEFAULT_SETTINGS,
} from "@/db/database";
import type { Settings, Exercise, Routine } from "@/domain/types";

async function seed(settings: Partial<Settings> = {}, routine?: Routine) {
  const db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.settings.clear();
  await db.settings.put({ ...DEFAULT_SETTINGS, ...settings });
  if (routine) await db.routines.put(routine);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  } as Exercise);
  await db.close();
}

function makeRoutine(): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Starter",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: { A: { id: "A", label: "Day A", entries: [] } },
    notes: [],
    cardio: null,
    importedAt: "2026-04-22T00:00:00.000Z",
  };
}

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
        <Route path="/settings" element={<div>SETTINGS</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TodayScreen greeting + banner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("greets 'Hello.' when userName is null", async () => {
    await seed({ activeRoutineId: "r1" }, makeRoutine());
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: "Hello." })
    ).toBeInTheDocument();
  });

  it("greets 'Hi, Alvaro.' when userName is set", async () => {
    await seed(
      { activeRoutineId: "r1", userName: "Alvaro" },
      makeRoutine()
    );
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: "Hi, Alvaro." })
    ).toBeInTheDocument();
  });

  it("renders the onboarding banner when a prompt is saved and not dismissed; × persists the dismissal", async () => {
    await seed(
      {
        activeRoutineId: "r1",
        lastGeneratedPrompt: "SAVED",
        lastGeneratedPromptAt: new Date().toISOString(),
        onboardingBannerDismissedAt: null,
      },
      makeRoutine()
    );
    const user = userEvent.setup();
    render(<WithRouter />);
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));
    // The reactive useSettings should hide the banner once dismissal is stored.
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.onboardingBannerDismissedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    await db2.close();
  });
});
```

### Step 8.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/today/TodayScreen.test.tsx`
Expected: multiple failures.

### Step 8.3 — Implement

In `web/src/features/today/TodayScreen.tsx`:

1. Add imports at the top:

```tsx
import { OnboardingBanner } from "./OnboardingBanner";
import { dismissOnboardingBanner } from "@/services/onboarding-service";
```

2. Locate line 164 (the `<h1>Hello.</h1>`). Replace with:

```tsx
        <h1 className="text-hero-serif italic text-foreground">
          {settings.userName ? `Hi, ${settings.userName}.` : "Hello."}
        </h1>
```

3. Immediately below the greeting (above `<StreakPill>`), insert:

```tsx
        {settings.lastGeneratedPrompt !== null &&
          settings.onboardingBannerDismissedAt === null && (
            <OnboardingBanner
              onDismiss={() => {
                void dismissOnboardingBanner(db);
              }}
            />
          )}
```

Do not change any other logic in the file.

### Step 8.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/today/TodayScreen.test.tsx`
Expected: 3 tests pass.

Full suite: `cd web && npm test -- --run`
Expected: **868** (865 + 3).

### Step 8.5 — Commit

```bash
git add web/src/features/today/TodayScreen.tsx web/tests/unit/features/today/TodayScreen.test.tsx
git commit -m "feat(today): add userName greeting and onboarding recovery banner"
```

---

## Task 9: Settings Profile section (name editor)

**Files:**
- Modify: `web/src/features/settings/SettingsScreen.tsx` — insert a Profile section at the top of the screen, above the existing Routine section.
- Create: `web/tests/unit/features/settings/SettingsScreen.test.tsx`

### Behavior

- Section eyebrow: `PROFILE`.
- One `Card` with a single row "Your name" showing `settings.userName` (italic "Not set" when null).
- Tap opens an inline editor: replace the value with a `<Input>` + Save / Cancel buttons. Save calls `setUserName(db, trimmed)`; empty-after-trim calls `setUserName(db, null)` (clears).

Inline-edit state is local to the component — use `useState<{editing:boolean}>()`.

### Step 9.1 — Write the failing test

Create `web/tests/unit/features/settings/SettingsScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import SettingsScreen from "@/features/settings/SettingsScreen";
import {
  ExerciseLoggerDB,
  initializeSettings,
  DEFAULT_SETTINGS,
} from "@/db/database";
import type { Settings } from "@/domain/types";

async function seed(overrides: Partial<Settings> = {}) {
  const db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.settings.clear();
  await db.settings.put({ ...DEFAULT_SETTINGS, ...overrides });
  await db.close();
}

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SettingsScreen Profile section", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows 'Not set' when userName is null", async () => {
    await seed();
    render(<WithRouter />);
    expect(await screen.findByText(/not set/i)).toBeInTheDocument();
  });

  it("editing and saving the name persists via setUserName", async () => {
    await seed();
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(await screen.findByRole("button", { name: /your name/i }));
    const input = await screen.findByRole("textbox", { name: /name editor/i });
    await user.type(input, "Alvaro");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(async () => {
      const db = new ExerciseLoggerDB();
      const s = await db.settings.get("user");
      expect(s?.userName).toBe("Alvaro");
      await db.close();
    });
  });
});
```

### Step 9.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/settings/SettingsScreen.test.tsx`

### Step 9.3 — Implement

In `web/src/features/settings/SettingsScreen.tsx`:

1. Add imports:

```tsx
import { setUserName } from "@/services/settings-service";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
```

2. Add local state near the existing `useState` block:

```tsx
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
```

3. Immediately after the screen header (`<div className="space-y-1">…</div>` containing "Settings"), BEFORE the existing `{/* Routines */}` block, insert:

```tsx
      {/* Profile */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Profile</p>
        <Card className="py-0">
          {!editingName ? (
            <button
              type="button"
              onClick={() => {
                setNameDraft(settings.userName ?? "");
                setEditingName(true);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-sage-soft/40"
            >
              <span className="text-sm font-medium">Your name</span>
              <span
                className={cn(
                  "text-sm",
                  settings.userName === null && "italic text-ink-3"
                )}
              >
                {settings.userName ?? "Not set"}
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-2 px-4 py-3">
              <Input
                aria-label="Name editor"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={40}
                placeholder="Your name"
                className="rounded-[var(--radius-card)] bg-paper"
              />
              <div className="flex gap-2 self-end">
                <Button
                  variant="outline"
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const trimmed = nameDraft.trim();
                    await setUserName(db, trimmed === "" ? null : trimmed);
                    setEditingName(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
```

4. Add `import { cn } from "@/shared/lib/utils";` if not already imported.

### Step 9.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/settings/SettingsScreen.test.tsx`
Expected: 2 tests pass (the "Not set" default + the save path).

Full suite: `cd web && npm test -- --run`
Expected: **870** (868 + 2).

### Step 9.5 — Commit

```bash
git add web/src/features/settings/SettingsScreen.tsx web/tests/unit/features/settings/SettingsScreen.test.tsx
git commit -m "feat(settings): add Profile section with inline name editor"
```

---

## Task 10: Settings routine restructure — "Create a personalized routine" + `LastPromptCard`

**Files:**
- Modify: `web/src/features/settings/SettingsScreen.tsx` — add a RowLink "✨ Create a personalized routine" inside the Routine section, and render `<LastPromptCard>` below it.
- Modify: `web/tests/unit/features/settings/SettingsScreen.test.tsx` — add 1 test.

### Behavior

- New row inside the Routine section, AFTER `<ActiveRoutineCard>` and BEFORE `<RoutineList>`:
  - Label `✨ Create a personalized routine`
  - Sublabel `Answer a short questionnaire.`
  - Tap → `navigate("/onboarding/questionnaire")`.
  - If `settings.lastGeneratedPrompt !== null`, tap opens a 3-option confirm dialog instead:
    - Title: "Unfinished routine prompt"
    - Body: "You have a saved prompt from a previous questionnaire. What would you like to do?"
    - Buttons: "Start over" (clears + navigates to /onboarding/questionnaire) · "Continue with previous prompt" (navigates to /onboarding/handoff) · "Cancel" (closes).
    - Implementation note: `ConfirmDialog` supports 2 buttons. For 3 options, either nest an additional button in the description or inline a small `AlertDialog` directly. Simplest: reuse `ConfirmDialog` with the two primary paths (Start over / Continue) and a Cancel. Map "Cancel" to the dialog's cancel button; map "Start over" (destructive) to `variant="destructive"`; add a secondary inline "Continue" button below the description. Alternative: render a custom inline dialog with `AlertDialog` primitives.
    - For this sprint, keep it simple: reuse `ConfirmDialog` with `confirmText="Start over"` (destructive) and a separate inline "Continue" chip directly below the row when a prompt is saved. The `LastPromptCard` already has "Paste YAML" which does the same thing as "Continue" — the card's presence makes a third button redundant.
  - Final decision: when a prompt exists, this row shows a simple confirm dialog "Start over will discard your saved prompt. Continue?" — a 2-option dialog. The LastPromptCard covers the "continue" path separately. This keeps ConfirmDialog's 2-button semantics and avoids a new dialog variant.
- `<LastPromptCard>` rendered immediately below the create-routine row, only when `settings.lastGeneratedPrompt !== null`. The card self-gates, so unconditional rendering works.

### Step 10.1 — Write the failing test

Append to `web/tests/unit/features/settings/SettingsScreen.test.tsx` (inside the existing `describe` or a new one):

```tsx
  it("'Create a personalized routine' row navigates to the questionnaire", async () => {
    await seed();
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /create a personalized routine/i })
    );
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });
```

### Step 10.2 — Confirm failure

Run: `cd web && npm test -- --run tests/unit/features/settings/SettingsScreen.test.tsx`

### Step 10.3 — Implement

In `web/src/features/settings/SettingsScreen.tsx`:

1. Add imports:

```tsx
import { clearLastPrompt } from "@/services/onboarding-service";
import { LastPromptCard } from "@/features/onboarding/components/LastPromptCard";
```

2. Add local state for the unfinished-prompt dialog:

```tsx
  const [newRoutineConfirmOpen, setNewRoutineConfirmOpen] = useState(false);
```

3. Inside the `{/* Routines */}` block, AFTER `<ActiveRoutineCard ... />` and BEFORE the `{otherRoutines.length > 0 && ...}` fragment, insert:

```tsx
        <Card className="py-0">
          <RowLink
            label="✨ Create a personalized routine"
            sublabel="Answer a short questionnaire."
            onClick={() => {
              if (settings.lastGeneratedPrompt !== null) {
                setNewRoutineConfirmOpen(true);
              } else {
                navigate("/onboarding/questionnaire");
              }
            }}
          />
        </Card>
        {settings.lastGeneratedPrompt !== null && (
          <LastPromptCard settings={settings} />
        )}
```

4. Add the confirm dialog near the existing `<ConfirmDialog>`s:

```tsx
      <ConfirmDialog
        open={newRoutineConfirmOpen}
        onOpenChange={setNewRoutineConfirmOpen}
        title="Start a new routine?"
        description="You have a saved prompt from before. Starting over will discard it. (Tap 'Paste YAML' on the saved-prompt card to continue with the previous prompt.)"
        confirmText="Start over"
        onConfirm={async () => {
          await clearLastPrompt(db);
          navigate("/onboarding/questionnaire");
        }}
        variant="destructive"
      />
```

### Step 10.4 — Verify

Run: `cd web && npm test -- --run tests/unit/features/settings/SettingsScreen.test.tsx`
Expected: all tests in the file pass.

Full suite: `cd web && npm test -- --run`
Expected: **871** (870 + 1).

### Step 10.5 — Commit

```bash
git add web/src/features/settings/SettingsScreen.tsx web/tests/unit/features/settings/SettingsScreen.test.tsx
git commit -m "feat(settings): add Create-routine row and LastPromptCard"
```

---

## Task 11: CLAUDE.md polish + sprint-exit sanity run

**Files:**
- Modify: `web/src/features/onboarding/CLAUDE.md`
- (Optionally) Modify: `web/src/features/today/CLAUDE.md` if the banner needs documentation.

### Step 11.1 — Edit onboarding CLAUDE.md

1. Inside the `## Module shape` code fence, update the `# Sprint D adds:` commented block by removing the comment markers and listing the real files:

```
  HandoffScreen.tsx              # route /onboarding/handoff (Stage 1 / Stage 2 state machine)
  components/LastPromptCard.tsx  # Settings card when lastGeneratedPrompt !== null
```

2. Update the `## Routes owned by this feature` table — change the third row's "Sprint" column from "D (pending)" to "D":

```markdown
| `/onboarding/handoff` | `HandoffScreen` | D |
```

3. Add a new subsection right before `## Design tokens`:

```markdown
## First-run gate

Wired in `@/app/App.tsx:AppRoutes`. Three guards:

1. `/` with `onboardingCompletedAt === null && onboardingSkippedAt === null` → redirect to `/onboarding`.
2. `/onboarding` with `onboardingCompletedAt !== null` → redirect to `/`.
3. `/onboarding/handoff` with `lastGeneratedPrompt === null` AND no `location.state.justCompleted === true` → redirect to `/onboarding/questionnaire`.

The `HandoffScreen` component has a defensive `useEffect` redirect that matches guard 3 — it's a no-op once `AppRoutes` short-circuits first, but keeps the screen correct in isolation (e.g., in component tests).
```

### Step 11.2 — Run the full suite one last time

Run: `cd web && npm test -- --run`
Expected: **871** (or within ±1) green, ignoring the pre-existing `useRoutineLaunchQueue` flake.

### Step 11.3 — Commit

```bash
git add web/src/features/onboarding/CLAUDE.md
git commit -m "docs(onboarding): document Sprint D handoff, routes, and first-run gate"
```

---

## Exit criteria for Sprint D

- [ ] `cd web && npm test -- --run` green at ~871 (spec estimate ~836; we overshoot because TDD-per-behavior expands the test count beyond the plan estimate).
- [ ] Manual walkthrough in `npm run dev` from `/onboarding` to `/onboarding/handoff` to `/` works end-to-end:
  1. Type a name, Start, complete the 11-step wizard, tap Stage-1 button (clipboard + GPT tab + flip to Stage 2), paste a valid YAML, Import → lands on Today with "Hi, {name}." and the active routine.
- [ ] Fresh install auto-redirects to `/onboarding`.
- [ ] Skipped user at `/` sees "Hello." with the bundled starter.
- [ ] User with `lastGeneratedPrompt !== null` sees the banner at `/`; × dismisses persistently; a fresh prompt re-shows the banner on the next Stage-1 button tap.
- [ ] `HandoffScreen` handles clipboard failure, popup-blocker, invalid YAML, and active-session block paths (all covered by unit tests).
- [ ] `git diff --stat main...HEAD` scoped to the paths in the File map.
- [ ] `web/package.json` unchanged (no new deps).

## Self-review

**Spec coverage:**
- §Finale Screen State Machine → Tasks 4, 5, 6.
- §Today banner → Task 2 + Task 8.
- §Settings Integration → Tasks 9, 10.
- §Error Handling (clipboard, popup, invalid YAML, active-session block, route guards) → Tasks 4, 5, 7.
- §First-run gate → Task 7.
- §Finale greeting change → Task 8.

**Placeholder scan:** no `TODO`, `TBD`, `fill in`, or "similar to" in this plan. Every code block is complete. The 3-option dialog decision for Task 10 is resolved inline to a 2-option dialog + parallel `LastPromptCard` coverage rather than deferring.

**Type consistency:** `Settings`, `useSettings`, `nowISO`, `GPT_URL`, `buildPrompt`, `loadWizardState`, `clearWizardState`, `saveGeneratedPrompt`, `clearLastPrompt`, `markOnboardingCompleted`, `markOnboardingSkipped`, `dismissOnboardingBanner`, `setUserName`, `validateAndNormalizeRoutine`, `importAndActivateRoutine`, `ConfirmDialog`, `YamlErrorList`, `Input`, `Textarea`, `Button` — all identifiers match the exports in their respective Sprint-A/B/C source files or shared primitives.

**Scope discipline:** no Sprint-E work (E2E, accessibility audit). No new services beyond Sprint A's five. No schema change. Dexie access stays behind existing services where they exist — the one exception is `HandoffScreen`'s Stage-2 success handler, which does a direct `db.settings.update("user", {...})` matching the spec §Stage 2 script verbatim (a single consolidated write saves an extra round-trip vs. calling two separate service functions).

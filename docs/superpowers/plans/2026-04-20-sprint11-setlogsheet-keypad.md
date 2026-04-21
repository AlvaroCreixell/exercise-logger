# Sprint 11 — SetLogSheet Custom Keypad ("Tap & Log") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native numeric inputs in `SetLogSheet` with a 3×4 custom keypad + `ValueBox` display for **weight and reps only**, preserving every existing behaviour (prefill priority, bodyweight "+ Add weight", Delete this set, auto-advance, sheet save-pulse), adding a manual PR toggle that writes the `LoggedSet.isPersonalRecord` field introduced in Sprint 10, and supporting physical-keyboard input.

**Architecture:** Split the sheet into small, pure primitives — `Keypad` (stateless 3×4 grid taking a string value and emitting key events), `ValueBox` (display tile + ± nudge + unit corner + active/inactive state), a per-field `useKeypadString` reducer (append / backspace / insert `.` rules), plus a wrapper hook that binds a physical-keyboard listener to the active `ValueBox`. `SetLogSheet` composes these with the existing inline-context block, header `SetDots`, Save button, and Delete action. Duration / distance value kinds keep the re-skinned native `<Input>` — per the spec, keypad UX for time / distance is deferred to a future sprint. `isPersonalRecord` rides through `SetLogInput` → `logSet` / `editSet` as an optional boolean so the set-service layer owns persistence.

**Tech Stack:** React 19 + TypeScript 5, Tailwind v4 (warm-paper tokens from Sprint 6), Vitest + RTL, Playwright for the save E2E. No new runtime deps.

---

## Context and scope

### Source-of-truth spec
`docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` → §3 "Sprint 11". Re-read before starting. Key rules:
- Keypad is weight + reps only. **Duration and distance keep native inputs** (see §5 deferred item and §3 Sprint 11 scope bullet).
- Weight nudge is hardcoded **±2.5 kg**. Reps nudge is **±1**. Do not read from `exercise.weightIncrement` (open question answer: start hardcoded).
- PR toggle is **manual**, persists to `LoggedSet.isPersonalRecord`.
- Bodyweight "+ Add weight (permanent for this session)" flow must keep working.
- "Delete this set" must stay available when `existingSet && onDelete`.
- Auto-advance logic (re-open sheet on next empty set without closing) currently lives in `WorkoutScreen.handleSave` — preserve it as-is.
- Physical keyboard: 0–9, `.`, backspace, Tab between fields, Enter to save.
- Matches `docs/claude_design_handoffs/screenshots/7-set-log-sheet.jpg` (set-position dots, last/suggested context line, ValueBoxes, keypad, Save).

### Out of scope (and will be rejected if you feel tempted)
- Keypad for duration / distance — **deferred** (§5 of the spec).
- Automatic PR detection (manual per handoff).
- Exercise Picker / Finish Celebration / Toast styling (all Sprint 12).
- Rest timer UI (permanently deferred).
- Any work outside `web/src/features/workout/` and its tests, **except** `set-service.ts` + its tests + the tiny `WorkoutScreen.tsx` wire-through for `isPersonalRecord`.

### Worktree & branch
Work lives in a new worktree/branch off the current `main` HEAD (`8b42f59`, Sprint 10 merged). Do **not** reuse the main worktree.

- **Worktree path:** `C:/Users/creix/VSC Projects/exercise_logger-sprint11-keypad`
- **Branch:** `sprint-11-keypad`

### Current state snapshot (verify before starting)
- `main` is at `8b42f59`, 664 tests pass (per CLAUDE.md).
- `SetLogSheet.tsx` is **354 lines**, uses shadcn `<Input type="number">` for all four value kinds, autoFocus on first visible field, prefill-on-open-edge via `prevOpenRef`.
- `SetDots.tsx` exists but uses Sprint 5 `bg-cta` / `border-border-strong` tokens — Sprint 11 retokens it to sage.
- `save-pulse` keyframe is already in `App.css:303-311` and bound from `SetLogSheet.tsx:324`. Keep as-is.
- `LoggedSet.isPersonalRecord?: boolean` exists on the type (`web/src/domain/types.ts:248`) but no code writes it — Sprint 11 is the first writer.
- `SetLogInput` in `set-service.ts:14-24` has only 4 fields. Sprint 11 extends it with optional `isPersonalRecord`.

---

## File structure

**Create (new):**
- `web/src/features/workout/Keypad.tsx` — pure stateless 3×4 grid. Renders `1-9`, `.`, `0`, `⌫`. Emits `onKey(key: KeypadKey)` events. No internal state. Size target: ≤80 lines.
- `web/src/features/workout/ValueBox.tsx` — pure display tile. Props: `label`, `value`, `unit?`, `isActive`, `onFocus`, `onNudgeDown`, `onNudgeUp`, optional `unitToggle` slot. No state. Size target: ≤80 lines.
- `web/src/features/workout/lib/keypad-reducer.ts` — pure function `applyKeypadKey(current: string, key: KeypadKey): string`. Handles append, single-`.` rule, backspace. Size target: ≤40 lines.
- `web/src/features/workout/PrToggle.tsx` — tiny button that toggles a `PR` pill. Props: `value`, `onChange`. Size target: ≤30 lines.
- `web/tests/unit/features/workout/Keypad.test.tsx`
- `web/tests/unit/features/workout/ValueBox.test.tsx`
- `web/tests/unit/features/workout/lib/keypad-reducer.test.ts`
- `web/tests/unit/features/workout/PrToggle.test.tsx`

**Modify:**
- `web/src/features/workout/SetLogSheet.tsx` — replace weight + reps `<Input>` blocks with `ValueBox` + `Keypad` (one active at a time, active field receives keypad + physical-keyboard input); keep duration + distance native; re-skin header; pass `isPersonalRecord` through `onSave`; add physical-keyboard handler.
- `web/src/features/workout/SetDots.tsx` — token swap `bg-cta` → `bg-sage-deep`, `border-border-strong` → `border-line`.
- `web/src/services/set-service.ts` — extend `SetLogInput` with optional `isPersonalRecord`; persist on create + edit.
- `web/src/features/workout/WorkoutScreen.tsx` — widen `handleSave`'s input type to include `isPersonalRecord?: boolean`; pass through to `logSet` / `editSet`.
- `web/tests/unit/features/workout/SetLogSheet.test.tsx` — extend existing tests that assert on native `<Input>` to assert on `ValueBox`/`Keypad`; add keypad-input, PR-toggle, physical-keyboard tests.
- `web/tests/unit/services/set-service.test.ts` — add `isPersonalRecord` persistence tests on create + edit + roundtrip.
- `web/tests/e2e/full-workflow.spec.ts` — the "Step 3: Log a set" block currently types into `input[name="weight"]`. Replace with keypad-driven input.
- `CLAUDE.md` — bump Vitest count to the new total.

**Delete:** nothing.

---

## Preflight

- [ ] **Step 0.1: Confirm `main` baseline**

Run from `C:/Users/creix/VSC Projects/exercise_logger`:
```bash
git status && git log --oneline -1
```
Expected: `On branch main`, working tree clean, HEAD at `8b42f59 docs(plans): archive Sprint 9/10 and review-response implementation plans` or later.

- [ ] **Step 0.2: Create the Sprint 11 worktree**

```bash
git worktree add "C:/Users/creix/VSC Projects/exercise_logger-sprint11-keypad" -b sprint-11-keypad main
git worktree list
```
Expected: two worktrees listed (main + sprint-11-keypad).

- [ ] **Step 0.3: Baseline test + lint + build from the new worktree**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint11-keypad/web"
npm install --no-audit --no-fund
npm test -- --run
npm run lint
npm run build
```
Expected: all green, `Tests  664 passed (664)`. Note the exact count — we'll add to it.

---

## Task 1: Extract the pure keypad reducer

Pure logic first so subsequent UI tasks can wire it up without rewriting input rules.

**Files:**
- Create: `web/src/features/workout/lib/keypad-reducer.ts`
- Test: `web/tests/unit/features/workout/lib/keypad-reducer.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `web/tests/unit/features/workout/lib/keypad-reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyKeypadKey } from "@/features/workout/lib/keypad-reducer";

describe("applyKeypadKey", () => {
  it("appends digits in order", () => {
    expect(applyKeypadKey("", "1")).toBe("1");
    expect(applyKeypadKey("1", "2")).toBe("12");
    expect(applyKeypadKey("12", "0")).toBe("120");
  });

  it("drops a leading zero when a real digit follows", () => {
    // Prevents "07" when the user taps 0 then 7 while the field shows "0" by default.
    expect(applyKeypadKey("0", "7")).toBe("7");
  });

  it("keeps a leading zero before a decimal", () => {
    expect(applyKeypadKey("0", ".")).toBe("0.");
    expect(applyKeypadKey("0.", "5")).toBe("0.5");
  });

  it("ignores a second decimal point", () => {
    expect(applyKeypadKey("1.5", ".")).toBe("1.5");
  });

  it("allows a leading decimal", () => {
    expect(applyKeypadKey("", ".")).toBe("0.");
  });

  it("backspace removes the last character", () => {
    expect(applyKeypadKey("125", "back")).toBe("12");
    expect(applyKeypadKey("1.", "back")).toBe("1");
    expect(applyKeypadKey("1", "back")).toBe("");
  });

  it("backspace on empty string is a no-op", () => {
    expect(applyKeypadKey("", "back")).toBe("");
  });
});
```

- [ ] **Step 1.2: Run the tests to confirm they fail**

```bash
cd web && npm test -- --run tests/unit/features/workout/lib/keypad-reducer.test.ts
```
Expected: FAIL — `Cannot find module '@/features/workout/lib/keypad-reducer'`.

- [ ] **Step 1.3: Implement the reducer**

Create `web/src/features/workout/lib/keypad-reducer.ts`:

```ts
export type KeypadKey =
  | "0" | "1" | "2" | "3" | "4"
  | "5" | "6" | "7" | "8" | "9"
  | "." | "back";

/**
 * Pure reducer for one keypad-controlled string field.
 * Rules:
 * - "back" drops the last character (no-op on empty).
 * - "." is ignored if the string already contains one.
 * - "." on empty string becomes "0.".
 * - A digit after a standalone "0" replaces the "0" (prevents "07").
 */
export function applyKeypadKey(current: string, key: KeypadKey): string {
  if (key === "back") {
    return current.length === 0 ? "" : current.slice(0, -1);
  }
  if (key === ".") {
    if (current.includes(".")) return current;
    return current.length === 0 ? "0." : current + ".";
  }
  // digit
  if (current === "0") return key;
  return current + key;
}
```

- [ ] **Step 1.4: Run the tests to confirm they pass**

```bash
cd web && npm test -- --run tests/unit/features/workout/lib/keypad-reducer.test.ts
```
Expected: `Tests  7 passed (7)`.

- [ ] **Step 1.5: Commit**

```bash
git add web/src/features/workout/lib/keypad-reducer.ts web/tests/unit/features/workout/lib/keypad-reducer.test.ts
git commit -m "feat(workout): add pure keypad-reducer for SetLogSheet keypad

Handles append, single-decimal rule, leading-zero replacement, and
backspace. Pure function — the UI layer wires it to state."
```

---

## Task 2: Keypad primitive component

Stateless 3×4 grid. Emits `onKey(KeypadKey)`. Uses the reducer from Task 1 indirectly (parent holds the string, keypad just fires keys).

**Files:**
- Create: `web/src/features/workout/Keypad.tsx`
- Test: `web/tests/unit/features/workout/Keypad.test.tsx`

- [ ] **Step 2.1: Write the failing tests**

Create `web/tests/unit/features/workout/Keypad.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypad } from "@/features/workout/Keypad";

afterEach(cleanup);

describe("Keypad", () => {
  it("renders 12 buttons: 1-9, ., 0, backspace", () => {
    render(<Keypad onKey={() => {}} />);
    for (const d of ["1","2","3","4","5","6","7","8","9","0"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${d}$`) })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: /^\.$/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /backspace/i })).toBeVisible();
  });

  it("fires onKey with the digit string when a number button is tapped", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /^7$/ }));
    expect(spy).toHaveBeenCalledWith("7");
  });

  it("fires onKey with '.' for the decimal button", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /^\.$/ }));
    expect(spy).toHaveBeenCalledWith(".");
  });

  it("fires onKey with 'back' for the backspace button", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    expect(spy).toHaveBeenCalledWith("back");
  });

  it("is disabled when the disabled prop is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} disabled />);
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Run the tests to confirm they fail**

```bash
cd web && npm test -- --run tests/unit/features/workout/Keypad.test.tsx
```
Expected: FAIL — `Cannot find module '@/features/workout/Keypad'`.

- [ ] **Step 2.3: Implement `Keypad`**

Create `web/src/features/workout/Keypad.tsx`:

```tsx
import type { KeypadKey } from "./lib/keypad-reducer";
import { Delete as BackspaceIcon } from "lucide-react";

interface KeypadProps {
  onKey: (key: KeypadKey) => void;
  disabled?: boolean;
}

const ROWS: KeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
];

export function Keypad({ onKey, disabled = false }: KeypadProps) {
  return (
    <div
      role="group"
      aria-label="Numeric keypad"
      className="grid grid-cols-3 gap-2"
    >
      {ROWS.flat().map((key) => {
        const isBack = key === "back";
        const label = isBack ? "Backspace" : key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey(key)}
            aria-label={label}
            className="h-14 rounded-[var(--radius-pill)] bg-line-soft text-xl font-semibold tabular-nums text-foreground transition-colors hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isBack ? (
              <span className="inline-flex items-center justify-center">
                <BackspaceIcon size={20} aria-hidden="true" />
              </span>
            ) : (
              key
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Note: `Delete` from Lucide is the backspace icon. We will swap to a custom icon in Task 9 once the `shared/icons/` set is verified to cover it. For now, Lucide is fine — Sprint 12 finalises the sweep.

- [ ] **Step 2.4: Run the tests to confirm they pass**

```bash
cd web && npm test -- --run tests/unit/features/workout/Keypad.test.tsx
```
Expected: `Tests  5 passed (5)`.

- [ ] **Step 2.5: Commit**

```bash
git add web/src/features/workout/Keypad.tsx web/tests/unit/features/workout/Keypad.test.tsx
git commit -m "feat(workout): add Keypad primitive (3x4 grid)

Stateless. Emits KeypadKey events to parent. Includes disabled state
and ARIA group label. Backspace icon is Lucide for now; swept to
shared/icons/ in Task 9."
```

---

## Task 3: ValueBox primitive component

Display tile for a single value (weight or reps). Shows `label`, big numeric `value`, optional `unit` corner, ± nudge buttons, active/inactive focus state, optional `unitToggle` slot. No keypad inside — that lives above in the sheet and is routed to the active `ValueBox` by the parent.

**Files:**
- Create: `web/src/features/workout/ValueBox.tsx`
- Test: `web/tests/unit/features/workout/ValueBox.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `web/tests/unit/features/workout/ValueBox.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValueBox } from "@/features/workout/ValueBox";

afterEach(cleanup);

describe("ValueBox", () => {
  it("renders label and value", () => {
    render(
      <ValueBox
        label="Weight"
        value="70"
        unit="kg"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    expect(screen.getByText("Weight")).toBeVisible();
    expect(screen.getByText("70")).toBeVisible();
    expect(screen.getByText("kg")).toBeVisible();
  });

  it("renders an em-dash when value is empty", () => {
    render(
      <ValueBox
        label="Reps"
        value=""
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("calls onFocus when the tile is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={false}
        onFocus={spy}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /weight/i }));
    expect(spy).toHaveBeenCalled();
  });

  it("calls onNudgeDown and onNudgeUp with independent clicks", async () => {
    const down = vi.fn();
    const up = vi.fn();
    const user = userEvent.setup();
    render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={down}
        onNudgeUp={up}
      />,
    );
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(down).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it("sets data-active='true' when isActive is true", () => {
    const { container } = render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={true}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    const tile = container.querySelector("[data-active='true']");
    expect(tile).not.toBeNull();
  });

  it("renders the unitToggle slot when provided", () => {
    render(
      <ValueBox
        label="Weight"
        value="70"
        unit="kg"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
        unitToggle={<button type="button">lbs</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "lbs" })).toBeVisible();
  });
});
```

- [ ] **Step 3.2: Run the tests to confirm they fail**

```bash
cd web && npm test -- --run tests/unit/features/workout/ValueBox.test.tsx
```
Expected: FAIL — `Cannot find module '@/features/workout/ValueBox'`.

- [ ] **Step 3.3: Implement `ValueBox`**

Create `web/src/features/workout/ValueBox.tsx`:

```tsx
import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

interface ValueBoxProps {
  /** "Weight", "Reps", etc. Shown as the eyebrow label above the value. */
  label: string;
  /** The current string value. Empty renders as "—". */
  value: string;
  /** Optional unit suffix shown below the value ("kg", "lbs"). */
  unit?: string;
  /** Controls the focused outline (which field the keypad drives). */
  isActive: boolean;
  /** Called when the tile itself is tapped (request focus). */
  onFocus: () => void;
  /** Called when the minus button is tapped. */
  onNudgeDown: () => void;
  /** Called when the plus button is tapped. */
  onNudgeUp: () => void;
  /** Optional corner slot (e.g. kg/lbs toggle). */
  unitToggle?: ReactNode;
}

export function ValueBox({
  label,
  value,
  unit,
  isActive,
  onFocus,
  onNudgeDown,
  onNudgeUp,
  unitToggle,
}: ValueBoxProps) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label={`${label} value`}
        aria-pressed={isActive}
        data-active={isActive ? "true" : "false"}
        onClick={onFocus}
        className="flex-1 rounded-[var(--radius-card)] border px-4 py-3 text-left transition-colors data-[active=true]:border-sage-deep data-[active=true]:bg-sage-soft/30 data-[active=false]:border-line data-[active=false]:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">
            {label}
          </span>
          {unitToggle}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
          <span className="text-3xl font-semibold text-foreground">
            {value === "" ? "—" : value}
          </span>
          {unit && <span className="text-sm text-ink-3">{unit}</span>}
        </div>
      </button>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={onNudgeUp}
          className="flex-1 rounded-[var(--radius-pill)] border border-line bg-background px-2 text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={onNudgeDown}
          className="flex-1 rounded-[var(--radius-pill)] border border-line bg-background px-2 text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Run the tests to confirm they pass**

```bash
cd web && npm test -- --run tests/unit/features/workout/ValueBox.test.tsx
```
Expected: `Tests  6 passed (6)`.

- [ ] **Step 3.5: Commit**

```bash
git add web/src/features/workout/ValueBox.tsx web/tests/unit/features/workout/ValueBox.test.tsx
git commit -m "feat(workout): add ValueBox primitive

Pure display tile with active/inactive outline, label, numeric value,
optional unit, optional unit-toggle slot, and ± nudge buttons. No
internal state — parent drives value and wires callbacks."
```

---

## Task 4: PR toggle primitive

Small pill-style button that reflects a boolean and flips on click. Used in the SetLogSheet footer area.

**Files:**
- Create: `web/src/features/workout/PrToggle.tsx`
- Test: `web/tests/unit/features/workout/PrToggle.test.tsx`

- [ ] **Step 4.1: Write the failing tests**

Create `web/tests/unit/features/workout/PrToggle.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrToggle } from "@/features/workout/PrToggle";

afterEach(cleanup);

describe("PrToggle", () => {
  it("renders 'Mark PR' when value is false", () => {
    render(<PrToggle value={false} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /mark pr/i })).toBeVisible();
  });

  it("renders 'PR ✓' when value is true", () => {
    render(<PrToggle value={true} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^pr/i })).toBeVisible();
  });

  it("calls onChange with the flipped value when clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<PrToggle value={false} onChange={spy} />);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("aria-pressed reflects the current value", () => {
    const { rerender } = render(<PrToggle value={false} onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    rerender(<PrToggle value={true} onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
```

- [ ] **Step 4.2: Run tests to confirm failure**

```bash
cd web && npm test -- --run tests/unit/features/workout/PrToggle.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement `PrToggle`**

Create `web/src/features/workout/PrToggle.tsx`:

```tsx
interface PrToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

export function PrToggle({ value, onChange }: PrToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors aria-pressed:border-sage-deep aria-pressed:bg-sage-soft aria-pressed:text-sage-deep aria-[pressed=false]:border-line aria-[pressed=false]:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
    >
      {value ? "PR ✓" : "Mark PR"}
    </button>
  );
}
```

- [ ] **Step 4.4: Run tests to confirm pass**

```bash
cd web && npm test -- --run tests/unit/features/workout/PrToggle.test.tsx
```
Expected: `Tests  4 passed (4)`.

- [ ] **Step 4.5: Commit**

```bash
git add web/src/features/workout/PrToggle.tsx web/tests/unit/features/workout/PrToggle.test.tsx
git commit -m "feat(workout): add PrToggle pill button

Reflects a boolean via aria-pressed, flips on click. Manual PR flag
for the current set — populates LoggedSet.isPersonalRecord (wired
through SetLogSheet in a later task)."
```

---

## Task 5: Persist `isPersonalRecord` through the set-service layer

Before the UI can write the field, the persistence layer has to accept and store it. Extend `SetLogInput`, update `logSet` and `editSet`, add tests.

**Files:**
- Modify: `web/src/services/set-service.ts` — `SetLogInput` + both write paths.
- Modify: `web/tests/unit/services/set-service.test.ts` — new tests.

- [ ] **Step 5.1: Read the current service code**

Open `web/src/services/set-service.ts:14-24` to confirm the `SetLogInput` shape and `logSet` / `editSet` signatures before editing. The change is additive — every existing caller must keep working without passing the new field.

- [ ] **Step 5.2: Write the failing tests**

Open `web/tests/unit/services/set-service.test.ts` and add a new describe block at the bottom. Adapt the pre-existing helpers (`setupDb`, `makeSessionExercise`, etc.) that the file already uses — do NOT invent new ones. If the helpers aren't named exactly this, use whatever the file uses; consult the top of the file for fixture names.

```ts
describe("set-service — isPersonalRecord persistence", () => {
  it("stores isPersonalRecord=true on a newly logged set", async () => {
    const { db, sessionExerciseId } = await setupLoggableSet();
    const created = await logSet(db, sessionExerciseId, 0, 0, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
      isPersonalRecord: true,
    });
    expect(created.isPersonalRecord).toBe(true);
    const fetched = await db.loggedSets.get(created.id);
    expect(fetched?.isPersonalRecord).toBe(true);
  });

  it("defaults isPersonalRecord to undefined when the field is omitted", async () => {
    const { db, sessionExerciseId } = await setupLoggableSet();
    const created = await logSet(db, sessionExerciseId, 0, 0, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    expect(created.isPersonalRecord).toBeUndefined();
  });

  it("updates isPersonalRecord on editSet", async () => {
    const { db, sessionExerciseId } = await setupLoggableSet();
    const created = await logSet(db, sessionExerciseId, 0, 0, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
      isPersonalRecord: false,
    });
    const updated = await editSet(db, created.id, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
      isPersonalRecord: true,
    });
    expect(updated.isPersonalRecord).toBe(true);
  });

  it("clears isPersonalRecord on editSet when the input sets it to false", async () => {
    const { db, sessionExerciseId } = await setupLoggableSet();
    const created = await logSet(db, sessionExerciseId, 0, 0, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
      isPersonalRecord: true,
    });
    const updated = await editSet(db, created.id, {
      performedWeightKg: 80,
      performedReps: 5,
      performedDurationSec: null,
      performedDistanceM: null,
      isPersonalRecord: false,
    });
    expect(updated.isPersonalRecord).toBe(false);
  });
});
```

You may need to define the `setupLoggableSet()` helper at the top of the new describe if the file doesn't already have one. If it does (look for an existing `async function setup…()` that seeds a session + sessionExercise and returns `{ db, sessionExerciseId }`), reuse it.

**Helper fallback** (only if no existing helper fits — paste inside the new describe):

```ts
async function setupLoggableSet() {
  const { db } = await setupDb(); // whatever the file calls the fake-indexeddb factory
  // …seed minimal session + sessionExercise; copy the pattern from the file's first test…
  // Return: { db, sessionExerciseId: "se-1" } after putting a sessionExercise.
}
```

Do not make up a new factory shape if the file already has one — reuse.

- [ ] **Step 5.3: Run tests to confirm failure**

```bash
cd web && npm test -- --run tests/unit/services/set-service.test.ts
```
Expected: FAIL — type error `isPersonalRecord does not exist on SetLogInput`, plus assertion failures even if the file compiles.

- [ ] **Step 5.4: Extend `SetLogInput`**

In `web/src/services/set-service.ts`, replace the `SetLogInput` interface (around lines 14-24):

```ts
/** Input for logging or editing a set. */
export interface SetLogInput {
  /** Weight in kg (external load only), or null for bodyweight/unweighted. */
  performedWeightKg: number | null;
  /** Reps performed, or null when not applicable. */
  performedReps: number | null;
  /** Duration in seconds, or null when not applicable. */
  performedDurationSec: number | null;
  /** Distance in meters, or null when not applicable. */
  performedDistanceM: number | null;
  /**
   * Manual PR flag. Optional: omitted → undefined on create; explicit
   * true/false on edit overwrites the stored value.
   */
  isPersonalRecord?: boolean;
}
```

- [ ] **Step 5.5: Persist on create (logSet)**

In `logSet`, find the `db.loggedSets.put(...)` or `db.loggedSets.add(...)` call that constructs the new record. Extend the object literal being written with:

```ts
isPersonalRecord: input.isPersonalRecord,
```

If the create path runs inside both a "new row" and an "update existing slot" branch (invariant 9 upsert), apply the same addition to **both** branches so edits through `logSet` also persist the field.

- [ ] **Step 5.6: Persist on edit (editSet)**

In `editSet`, where the existing record is merged and re-put, add:

```ts
isPersonalRecord: input.isPersonalRecord,
```

to the merged object so an explicit `false` overwrites an earlier `true`.

- [ ] **Step 5.7: Run the new tests**

```bash
cd web && npm test -- --run tests/unit/services/set-service.test.ts
```
Expected: all tests pass (including the 4 new ones).

- [ ] **Step 5.8: Run the full unit suite to catch collateral damage**

```bash
cd web && npm test -- --run
```
Expected: all tests pass.

- [ ] **Step 5.9: Commit**

```bash
git add web/src/services/set-service.ts web/tests/unit/services/set-service.test.ts
git commit -m "feat(sets): persist isPersonalRecord on logSet and editSet

Extends SetLogInput with an optional boolean. Stored verbatim on
create; overwrites on edit (explicit false clears a prior true). All
existing callers stay valid — the field is optional."
```

---

## Task 6: Rewrite SetLogSheet body with Keypad + ValueBoxes (weight + reps)

This is the main task. It replaces the two `<Input type="number">` fields for weight and reps with a `ValueBox` pair + one shared `Keypad` below. Duration and distance keep their re-skinned native inputs. Prefill logic is unchanged. The `isPersonalRecord` plumbing and physical-keyboard handler come in Tasks 7 + 8.

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx` — existing tests already assert `getByLabelText(/weight/i)` on an `HTMLInputElement`; these assertions break when weight becomes a `ValueBox`. Tests must be updated to use the `ValueBox` name pattern (`screen.getByRole("button", { name: /weight value/i })` and then `within(...).getByText(value)`), and the "renders tile-style (h-14)" test moves to a Keypad button selector.

- [ ] **Step 6.1: Read the existing test file so you know which assertions will break**

Open `web/tests/unit/features/workout/SetLogSheet.test.tsx`. Note every assertion on `input[name="weight"]`, `input[name="reps"]`, `getByLabelText(/weight/i)`, and `getByLabelText(/reps/i)`. These fields become `ValueBox` buttons after this task. Duration/distance inputs stay as-is.

- [ ] **Step 6.2: Write the new prefill + ValueBox tests (TDD)**

Replace the existing prefill tests (which use `HTMLInputElement.value`) with `ValueBox`-based assertions. Add a small helper at the top of the test file:

```tsx
import { within } from "@testing-library/react";

function weightValueText(): string {
  const tile = screen.getByRole("button", { name: /weight value/i });
  // Primary span = first text node not the "WEIGHT" eyebrow and not the unit.
  const big = within(tile).getByText(/^(—|\d+(\.\d+)?)$/);
  return big.textContent ?? "";
}

function repsValueText(): string {
  const tile = screen.getByRole("button", { name: /reps value/i });
  const big = within(tile).getByText(/^(—|\d+(\.\d+)?)$/);
  return big.textContent ?? "";
}
```

Rewrite each existing prefill assertion that does:

```tsx
const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
expect(weight.value).toBe("0");
```

as:

```tsx
expect(weightValueText()).toBe("0");
```

Do the same for every occurrence of `getByLabelText(/weight/i)` and `getByLabelText(/reps/i)` in `SetLogSheet prefill` and `SetLogSheet — inline context` describe blocks.

**Delete** the `"renders weight and reps fields as tile-style (h-14)"` test in `SetLogSheet — inline context` (lines ~324-330). The `h-14` check is keypad-button-specific now; it's replaced by a new test in this step:

```tsx
describe("SetLogSheet — keypad input (weight + reps)", () => {
  it("renders a keypad when the sheet is open with weight+reps target", () => {
    renderSheet();
    expect(screen.getByRole("group", { name: /numeric keypad/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^5$/ })).toBeVisible();
  });

  it("tapping a digit updates the active ValueBox (defaults to weight on open)", async () => {
    const user = userEvent.setup();
    renderSheet(); // default: new set, no existing, no suggestion → weight=""
    await user.click(screen.getByRole("button", { name: /^8$/ }));
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(weightValueText()).toBe("85");
  });

  it("switches keypad target to reps when the reps ValueBox is tapped", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    await user.click(screen.getByRole("button", { name: /^1$/ }));
    await user.click(screen.getByRole("button", { name: /^2$/ }));
    expect(repsValueText()).toBe("12");
  });

  it("backspace removes the last character of the active value", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /^7$/ }));
    await user.click(screen.getByRole("button", { name: /^0$/ }));
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    expect(weightValueText()).toBe("7");
  });

  it("weight ± nudge steps by 2.5 kg", async () => {
    const user = userEvent.setup();
    renderSheet(); // weight prefilled to "0"
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(weightValueText()).toBe("2.5");
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(weightValueText()).toBe("5");
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    expect(weightValueText()).toBe("2.5");
  });

  it("reps ± nudge steps by 1", async () => {
    const user = userEvent.setup();
    renderSheet(); // reps prefilled to minValue=8
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    await user.click(screen.getByRole("button", { name: /increase reps/i }));
    expect(repsValueText()).toBe("9");
    await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    expect(repsValueText()).toBe("7");
  });

  it("weight nudge clamps at 0 (cannot go negative)", async () => {
    const user = userEvent.setup();
    renderSheet(); // weight="0"
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    expect(weightValueText()).toBe("0");
  });

  it("reps nudge clamps at 0", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    }
    expect(repsValueText()).toBe("0");
  });
});
```

- [ ] **Step 6.3: Run tests to confirm failure**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: many failures — `ValueBox` doesn't exist in the sheet yet, no `numeric keypad` group, etc.

- [ ] **Step 6.4: Rewrite `SetLogSheet.tsx` weight + reps sections**

In `web/src/features/workout/SetLogSheet.tsx`:

1. Add imports at the top:
   ```tsx
   import { Keypad } from "./Keypad";
   import { ValueBox } from "./ValueBox";
   import { applyKeypadKey, type KeypadKey } from "./lib/keypad-reducer";
   ```

2. Add a new `type` alias near the top of the component body, above `useState`:
   ```tsx
   type ActiveField = "weight" | "reps" | "duration" | "distance";
   ```

3. Add state for the active field, defaulting to `weight` when the sheet opens (and `reps` when weight is not applicable):
   ```tsx
   const defaultActive: ActiveField =
     showWeight || (isBodyweight && showWeightForBodyweight)
       ? "weight"
       : targetKind === "reps"
         ? "reps"
         : targetKind === "duration"
           ? "duration"
           : "distance";
   const [activeField, setActiveField] = useState<ActiveField>(defaultActive);
   ```

4. When the sheet opens (inside the existing `useEffect` gated by `prevOpenRef`), reset `activeField` to `defaultActive`. Add after the existing prefill assignments, just before the closing of the effect:
   ```tsx
   setActiveField(defaultActive);
   ```

5. Add a keypad dispatcher:
   ```tsx
   function dispatchKey(key: KeypadKey) {
     if (activeField === "weight") {
       setWeight((w) => applyKeypadKey(w, key));
     } else if (activeField === "reps") {
       setReps((r) => applyKeypadKey(r, key));
     }
     // duration/distance keep native inputs; keypad is hidden for those.
   }
   ```

6. Add nudge helpers:
   ```tsx
   function nudgeWeight(delta: number) {
     const n = weight.trim() ? parseFloat(weight) : 0;
     if (!Number.isFinite(n)) return;
     const next = Math.max(0, n + delta);
     // Strip trailing ".0" so "2.5" stays tidy as a string.
     setWeight(String(Number.isInteger(next) ? next : Math.round(next * 100) / 100));
   }
   function nudgeReps(delta: number) {
     const n = reps.trim() ? parseInt(reps, 10) : 0;
     if (!Number.isFinite(n)) return;
     setReps(String(Math.max(0, n + delta)));
   }
   ```

7. **Replace** the weight-field JSX block (current lines ~230-244) — both the `showWeight` variant and the `isBodyweight && showWeightForBodyweight` variant — with a shared `ValueBox` render. Keep the "+ Add weight" toggle button for the bodyweight-no-weight state exactly as-is (lines ~246-253):

   Replace lines ~230-244 with:
   ```tsx
   {showWeight && (
     <ValueBox
       label="Weight"
       value={weight}
       unit={units}
       isActive={activeField === "weight"}
       onFocus={() => setActiveField("weight")}
       onNudgeDown={() => nudgeWeight(-2.5)}
       onNudgeUp={() => nudgeWeight(2.5)}
     />
   )}
   ```

   Keep the `isBodyweight && !showWeightForBodyweight` "+ Add weight" button unchanged.

   Replace the `isBodyweight && showWeightForBodyweight` block (current lines ~255-271) with:
   ```tsx
   {isBodyweight && showWeightForBodyweight && (
     <>
       <ValueBox
         label="Weight"
         value={weight}
         unit={units}
         isActive={activeField === "weight"}
         onFocus={() => setActiveField("weight")}
         onNudgeDown={() => nudgeWeight(-2.5)}
         onNudgeUp={() => nudgeWeight(2.5)}
       />
       <p className="text-[11px] text-warning">
         Adding weight is permanent for this session.
       </p>
     </>
   )}
   ```

8. Replace the `targetKind === "reps"` block (current lines ~274-288) with:
   ```tsx
   {targetKind === "reps" && (
     <ValueBox
       label="Reps"
       value={reps}
       isActive={activeField === "reps"}
       onFocus={() => setActiveField("reps")}
       onNudgeDown={() => nudgeReps(-1)}
       onNudgeUp={() => nudgeReps(1)}
     />
   )}
   ```

9. **Leave duration and distance blocks (lines ~290-318) untouched for now** — they keep native `<Input>`. The only change needed is a `data-native-active={activeField === "duration"}` (and `"distance"`) data attribute we don't yet need; skip it. Those fields are focused by tapping into them directly.

10. **Insert the Keypad** below the last value tile. Place it just before the Save/Delete footer `<div className="space-y-2 pb-2 shrink-0">` (the existing footer at lines ~321-350). Gate it so it's only rendered when the keypad is relevant (weight or reps):
    ```tsx
    {(showWeight || targetKind === "reps" || (isBodyweight && showWeightForBodyweight)) && (
      <div className="pb-3">
        <Keypad onKey={dispatchKey} disabled={saving} />
      </div>
    )}
    ```

11. **Remove `autoFocus`** from the `duration` and `distance` `<Input>` elements if present (line ~285 had `autoFocus={!showWeight}` on reps — that's now dead since reps is a ValueBox, so ignore; for duration/distance leave behaviour unchanged).

- [ ] **Step 6.5: Run the SetLogSheet tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: all updated prefill tests pass; all new keypad-input tests pass; existing tap-to-save/delete tests still pass.

- [ ] **Step 6.6: Run the full suite**

```bash
cd web && npm test -- --run
```
Expected: all pass.

- [ ] **Step 6.7: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "feat(workout): replace weight+reps inputs with ValueBox + Keypad

SetLogSheet now drives weight and reps via tapping the Keypad grid,
with ValueBox tiles showing the current value and ± 2.5 kg / ± 1 rep
nudges. Duration and distance stay on re-skinned native inputs per
the Sprint 11 spec. Prefill priority (existingSet > carryover >
suggestion > lastTime > default) is unchanged."
```

---

## Task 7: Physical keyboard support

Bind a `keydown` listener on the sheet content while it's open. 0-9 and `.` dispatch through the keypad reducer into the active field. Backspace also routes through the reducer. Tab moves the active field between weight and reps (skipping invisible ones). Enter triggers `handleSave`.

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- [ ] **Step 7.1: Write the failing tests**

Append to the `"SetLogSheet — keypad input"` describe (or add a new `"SetLogSheet — physical keyboard"` describe):

```tsx
describe("SetLogSheet — physical keyboard", () => {
  it("digit keypresses update the active field", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.keyboard("85");
    expect(weightValueText()).toBe("85");
  });

  it("backspace key removes the last character", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.keyboard("85");
    await user.keyboard("{Backspace}");
    expect(weightValueText()).toBe("8");
  });

  it("Tab moves active field from weight to reps", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.keyboard("{Tab}");
    await user.keyboard("12");
    expect(repsValueText()).toBe("12");
  });

  it("Enter triggers onSave with the current values", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    const user = userEvent.setup();
    await user.keyboard("85");
    await user.keyboard("{Tab}");
    await user.keyboard("10");
    await user.keyboard("{Enter}");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        performedWeightKg: 85,
        performedReps: 10,
      }),
    );
  });
});
```

- [ ] **Step 7.2: Run tests to confirm failure**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: FAIL — no keydown handler wired yet.

- [ ] **Step 7.3: Wire the keydown handler**

In `SetLogSheet.tsx`, inside the component body:

```tsx
useEffect(() => {
  if (!open) return;
  function onKeyDown(e: KeyboardEvent) {
    // Ignore when the event originates inside a native input/textarea —
    // that's the duration/distance field, which owns its own key handling.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      dispatchKey(e.key as KeypadKey);
      return;
    }
    if (e.key === ".") {
      e.preventDefault();
      dispatchKey(".");
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      dispatchKey("back");
      return;
    }
    if (e.key === "Tab") {
      // Cycle between weight and reps if both are visible.
      const canReps = targetKind === "reps";
      const canWeight = showWeight || (isBodyweight && showWeightForBodyweight);
      if (canWeight && canReps) {
        e.preventDefault();
        setActiveField((cur) => (cur === "weight" ? "reps" : "weight"));
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
      return;
    }
  }
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, activeField, weight, reps, showWeight, isBodyweight, showWeightForBodyweight, targetKind]);
```

Note: `handleSave` is declared further down in the component. If the ESLint `exhaustive-deps` rule flags it, either move `handleSave` above the effect (preferred) or include it via a ref. Start with the above; adjust if lint complains.

- [ ] **Step 7.4: Run tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: all pass including the four new ones.

- [ ] **Step 7.5: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "feat(workout): physical-keyboard input for SetLogSheet

Digits 0-9 and '.' route through the keypad reducer; Backspace is
'back'; Tab toggles between weight and reps when both visible; Enter
saves. Duration/distance native inputs keep their own key handling."
```

---

## Task 8: Manual PR toggle wired through `onSave`

Add the `PrToggle` under the Keypad (in the fixed footer area above Save). Initialise from `existingSet.isPersonalRecord` or `false`. Include in the `onSave` payload.

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/src/features/workout/WorkoutScreen.tsx` — widen `handleSave`'s input type and pass through.
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- [ ] **Step 8.1: Write the failing tests**

Append to the test file:

```tsx
describe("SetLogSheet — PR toggle", () => {
  it("defaults to false for a new set", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /mark pr/i })).toBeVisible();
  });

  it("defaults from existingSet.isPersonalRecord when editing", () => {
    renderSheet({
      existingSet: makeLoggedSet({ isPersonalRecord: true }),
    });
    expect(screen.getByRole("button", { name: /^pr/i })).toBeVisible();
  });

  it("includes isPersonalRecord=true in onSave payload when toggled on", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    await user.keyboard("85");
    await user.keyboard("{Tab}");
    await user.keyboard("10");
    await user.click(screen.getByRole("button", { name: /mark pr/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isPersonalRecord: true }),
    );
  });

  it("passes isPersonalRecord=false in onSave when untoggled", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    await user.keyboard("85");
    await user.keyboard("{Tab}");
    await user.keyboard("10");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isPersonalRecord: false }),
    );
  });
});
```

- [ ] **Step 8.2: Run tests to confirm failure**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: FAIL — no `PrToggle` mounted; `onSave` payload missing the field.

- [ ] **Step 8.3: Wire the PR toggle into `SetLogSheet`**

In `SetLogSheet.tsx`:

1. Import:
   ```tsx
   import { PrToggle } from "./PrToggle";
   ```

2. Add state:
   ```tsx
   const [isPR, setIsPR] = useState(false);
   ```

3. Prefill inside the existing open-edge `useEffect`, alongside the other `set*` calls:
   ```tsx
   setIsPR(existingSet?.isPersonalRecord === true);
   ```
   (Place this in BOTH the "existingSet" branch and the "no existingSet" branch — the second branch sets it to `false` explicitly.)

   Concretely:
   - Inside the `if (existingSet) { ... return; }` branch, add `setIsPR(existingSet.isPersonalRecord === true);` before the `return`.
   - In the fall-through ("no existingSet") part, add `setIsPR(false);` at the top.

4. Widen the `handleSave` payload. Replace the existing `const input = { … }` in `handleSave`:
   ```tsx
   const input = {
     performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
     performedReps: reps.trim() ? parseInt(reps, 10) : null,
     performedDurationSec: duration.trim()
       ? (durationInMinutes ? Math.round(parseFloat(duration) * 60) : parseInt(duration, 10))
       : null,
     performedDistanceM: distance.trim() ? parseFloat(distance) : null,
     isPersonalRecord: isPR,
   };
   ```

5. Update the `SetLogSheetProps.onSave` signature at the top of the file (line ~36-41) to include `isPersonalRecord`:
   ```tsx
   onSave: (input: {
     performedWeightKg: number | null;
     performedReps: number | null;
     performedDurationSec: number | null;
     performedDistanceM: number | null;
     isPersonalRecord: boolean;
   }) => Promise<void>;
   ```

6. Render `<PrToggle value={isPR} onChange={setIsPR} />` inside the footer `<div className="space-y-2 pb-2 shrink-0">`, above the Save `<Button>`. Wrap both the toggle and the Save button in a row if you want them side-by-side — simplest is a plain `<div className="flex justify-end pb-1">` above the Save button:

   ```tsx
   <div className="flex justify-end pb-1">
     <PrToggle value={isPR} onChange={setIsPR} />
   </div>
   ```

- [ ] **Step 8.4: Widen `WorkoutScreen.handleSave` and forward to service**

In `web/src/features/workout/WorkoutScreen.tsx`:

1. Widen the `handleSave` parameter type (currently lines ~98-102):
   ```tsx
   async function handleSave(input: {
     performedWeightKg: number | null;
     performedReps: number | null;
     performedDurationSec: number | null;
     performedDistanceM: number | null;
     isPersonalRecord: boolean;
   }) {
   ```

2. Pass `input` through to `logSet` / `editSet` unchanged. The service layer already accepts the field (Task 5).

3. Update the `onSave` type on the `SetLogSheetWithHistory` wrapper (lines ~340-345) to match — add `isPersonalRecord: boolean;`.

- [ ] **Step 8.5: Run tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
cd web && npm test -- --run tests/unit/features/workout/WorkoutScreen.test.tsx
```
Expected: all pass.

- [ ] **Step 8.6: Full suite + typecheck (via build)**

```bash
cd web && npm test -- --run && npm run lint && npm run build
```
Expected: all clean. If `tsc --noEmit` (run by the build) complains about a caller passing an input without `isPersonalRecord`, find and widen that caller or default the field at the call-site.

- [ ] **Step 8.7: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/src/features/workout/WorkoutScreen.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "feat(workout): add manual PR toggle to SetLogSheet

Flag rides through onSave into logSet/editSet, persisting to
LoggedSet.isPersonalRecord (which SetRow already renders as a PR tag
per Sprint 10)."
```

---

## Task 9: Re-skin `SetDots` + icon sweep for workout feature

Two small cleanups bundled — both are warm-paper retokens that the spec calls out (Sprint 11 inherits Sprint 6's icon-sweep rule for each screen it touches).

**Files:**
- Modify: `web/src/features/workout/SetDots.tsx`
- Modify: `web/src/features/workout/Keypad.tsx`
- Possibly modify: `web/src/features/workout/ValueBox.tsx` (if `shared/icons/` has Plus/Minus)

- [ ] **Step 9.1: Confirm what's in `shared/icons/`**

```bash
ls web/src/shared/icons/
```
You'll see a directory of per-icon files and an `index.ts` barrel. Grep for the icons Sprint 11 uses — `Plus`, `Minus`, `Delete` (backspace). If present in `shared/icons/`, migrate. If not, leave Lucide — Sprint 12 finishes the sweep.

```bash
grep -i "export" web/src/shared/icons/index.ts
```

- [ ] **Step 9.2: If `shared/icons/` covers them, migrate**

Replace the imports in `Keypad.tsx` and `ValueBox.tsx`. Example for `Keypad.tsx`:

```tsx
import { Delete as BackspaceIcon } from "@/shared/icons";
```

(Whatever the barrel names the icon — adjust to the actual export.) If missing, leave as-is.

- [ ] **Step 9.3: Retoken `SetDots.tsx`**

Open `web/src/features/workout/SetDots.tsx`. Replace the two `className` strings on the dot spans (lines 22-23):

```tsx
className={
  isActive
    ? "h-2.5 w-2.5 rounded-full bg-sage-deep"
    : "h-2 w-2 rounded-full border border-line bg-background"
}
```

(Two swaps: `bg-cta` → `bg-sage-deep`, `border-border-strong` → `border-line`.)

- [ ] **Step 9.4: Verify `SetDots` tests still pass**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
The SetLogSheet suite exercises `SetDots` via its `"shows SetDots in the header with the right current index"` assertion. Expected: still passes (the ARIA label is unchanged).

If there's a dedicated `SetDots.test.tsx`, run it too. Search with:
```bash
ls web/tests/unit/features/workout/ | grep -i setdots
```
If it exists and asserts on the old classnames, fix the assertion to the new ones.

- [ ] **Step 9.5: Commit**

```bash
git add web/src/features/workout/SetDots.tsx web/src/features/workout/Keypad.tsx web/src/features/workout/ValueBox.tsx
git commit -m "refactor(workout): retoken SetDots + icon sweep for keypad UI

SetDots swaps bg-cta → bg-sage-deep, border-border-strong → border-line.
Keypad/ValueBox icons move to shared/icons where available (Sprint 12
handles remaining Lucide stragglers)."
```

---

## Task 10: "Use last" chip + inline context re-skin

Lightweight — the existing inline-context block (`lastTime` + `suggestion`) already renders values. Spec adds:
- A "Use last" chip next to the Last-time line that prefills weight + reps from `lastTime.sets[setIndex]`.
- Token retune to match Sprint 6 palette (the current block uses `text-muted-foreground`, `text-success`, `text-info` — keep semantic tokens; this is a warm-paper coherence check, no mandatory swaps).

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- [ ] **Step 10.1: Write the failing test**

Append to the `"SetLogSheet — inline context"` describe:

```tsx
it("'Use last' chip prefills weight and reps from lastTime[setIndex] when tapped", async () => {
  const user = userEvent.setup();
  renderSheet({
    lastTime: {
      blockIndex: 0,
      blockLabel: "Set block 1",
      tag: null,
      sets: [
        { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
        { weightKg: 95, reps: 7, durationSec: null, distanceM: null },
      ],
    },
    setIndex: 1,
  });
  // Pre-state: weight prefilled from lastTime[1]=95 via the existing prefill path,
  // reps prefilled from block.minValue (8) via the existing path.
  // Simulate the user emptying weight, then tapping Use last.
  await user.click(screen.getByRole("button", { name: /backspace/i }));
  await user.click(screen.getByRole("button", { name: /backspace/i }));
  await user.click(screen.getByRole("button", { name: /use last/i }));
  expect(weightValueText()).toBe("95");
  expect(repsValueText()).toBe("7");
});
```

- [ ] **Step 10.2: Run to confirm failure**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: FAIL — no "Use last" button.

- [ ] **Step 10.3: Add the chip**

In `SetLogSheet.tsx`, inside the existing `lastTime && lastTime.sets.length > 0` block, after the `<span className="text-foreground">` value span, append a chip button:

```tsx
{(() => {
  const s = lastTime.sets[setIndex] ?? lastTime.sets[0];
  if (!s) return null;
  return (
    <button
      type="button"
      className="ml-3 inline-flex items-center rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      onClick={() => {
        if (s.weightKg != null) setWeight(String(toDisplayWeight(s.weightKg, units)));
        if (s.reps != null) setReps(String(s.reps));
      }}
    >
      Use last
    </button>
  );
})()}
```

- [ ] **Step 10.4: Run the test**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetLogSheet.test.tsx
```
Expected: all pass.

- [ ] **Step 10.5: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "feat(workout): add 'Use last' chip to inline context

Tapping the chip prefills weight + reps from the last-time entry for
the current setIndex (falls back to the first set). Small quality-of-
life affordance from the Sprint 11 spec."
```

---

## Task 11: Update the E2E spec to drive the keypad instead of native inputs

The existing E2E at `web/tests/e2e/full-workflow.spec.ts:52-70` types into `input[name="weight"]`. That selector no longer exists after Task 6. Rewrite the "Log a set" block to use the keypad.

**Files:**
- Modify: `web/tests/e2e/full-workflow.spec.ts`

- [ ] **Step 11.1: Read the current spec**

Open `web/tests/e2e/full-workflow.spec.ts`. Find the `"Step 3: Log a set"` comment (around lines 52-70). Note the tightened assertion we landed in T4 (`/^Set 1: (?!empty\b)/`) — keep it.

- [ ] **Step 11.2: Replace the native-input fills with keypad taps**

Current block:

```ts
    // Step 3: Log a set — hard assertions, no .catch guards.
    const firstSetRow = page.getByRole("button", { name: /^Set 1:/ }).first();
    await expect(firstSetRow).toBeVisible({ timeout: 5000 });
    await firstSetRow.click();

    const weightInput = page.locator('input[name="weight"]').first();
    await expect(weightInput).toBeVisible({ timeout: 3000 });
    await weightInput.fill("60");

    const repsInput = page.locator('input[name="reps"]').first();
    await expect(repsInput).toBeVisible();
    await repsInput.fill("10");

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet should close and the Set 1 row should reflect the logged state (no longer "empty").
    await expect(weightInput).toBeHidden({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /^Set 1: (?!empty\b)/ }).first(),
    ).toBeVisible();
```

Replace with:

```ts
    // Step 3: Log a set via the Sprint 11 keypad — weight 60, reps 10.
    const firstSetRow = page.getByRole("button", { name: /^Set 1:/ }).first();
    await expect(firstSetRow).toBeVisible({ timeout: 5000 });
    await firstSetRow.click();

    // Keypad is visible, weight ValueBox is active by default.
    const keypad = page.getByRole("group", { name: /numeric keypad/i });
    await expect(keypad).toBeVisible({ timeout: 3000 });

    // Type "60" for weight.
    await keypad.getByRole("button", { name: /^6$/ }).click();
    await keypad.getByRole("button", { name: /^0$/ }).click();

    // Switch to reps and type "10".
    await page.getByRole("button", { name: /reps value/i }).click();
    await keypad.getByRole("button", { name: /^1$/ }).click();
    await keypad.getByRole("button", { name: /^0$/ }).click();

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet should close and the Set 1 row should reflect the logged state.
    await expect(keypad).toBeHidden({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /^Set 1: (?!empty\b)/ }).first(),
    ).toBeVisible();
```

- [ ] **Step 11.3: Run the E2E suite**

```bash
cd web && npm run test:e2e
```
Expected: 9/9 pass.

- [ ] **Step 11.4: Commit**

```bash
git add web/tests/e2e/full-workflow.spec.ts
git commit -m "test(e2e): drive SetLogSheet via the Sprint 11 keypad

Native weight/reps inputs were replaced by ValueBox + Keypad in
Sprint 11. Step 3 of the happy-path E2E now taps numeric buttons in
the Keypad group and switches the active field via the reps ValueBox."
```

---

## Task 12: Acceptance sweep — CLAUDE.md, lint, build, e2e

- [ ] **Step 12.1: Run the full unit suite and record the count**

```bash
cd web && npm test -- --run 2>&1 | tail -6
```
Note the `Tests  N passed (N)` line. Call that number `NEW_COUNT`.

- [ ] **Step 12.2: Lint + build**

```bash
cd web && npm run lint && npm run build
```
Expected: both clean.

- [ ] **Step 12.3: Update CLAUDE.md**

Open `CLAUDE.md` at the repo root. Find the Commands section (around line 39 on `main`):

```
npm test              # 664 unit+integration tests (Vitest)
```

Replace `664` with `NEW_COUNT` from Step 12.1.

- [ ] **Step 12.4: Final E2E run**

```bash
cd web && npm run test:e2e
```
Expected: 9/9 pass.

- [ ] **Step 12.5: Commit the doc bump**

```bash
git add CLAUDE.md
git commit -m "docs: bump Vitest count for Sprint 11 keypad tests"
```

- [ ] **Step 12.6: Push + open PR**

```bash
git push -u origin sprint-11-keypad
gh pr create --title "Sprint 11: Tap & Log — SetLogSheet custom keypad" --body "$(cat <<'EOF'
## Summary

Implements Sprint 11 of the visual revamp per `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3.

- `Keypad.tsx` — 3×4 grid primitive (1-9, ., 0, backspace) with ARIA group label.
- `ValueBox.tsx` — display tile with active/inactive outline, label, big value, optional unit, optional unit-toggle slot, ± nudge buttons.
- `PrToggle.tsx` — pill button for manual PR flag.
- `lib/keypad-reducer.ts` — pure `applyKeypadKey` (append, single-`.` rule, backspace).
- `SetLogSheet.tsx` — weight + reps switch to ValueBox + Keypad (one active field at a time); duration + distance keep re-skinned native inputs per spec. "Use last" chip in the inline-context block. Manual PR toggle in the footer.
- Physical keyboard: digits, `.`, Backspace, Tab (weight↔reps), Enter.
- `set-service.ts` — `SetLogInput.isPersonalRecord?: boolean`; persisted on create + edit. `WorkoutScreen.handleSave` forwards the field.
- `SetDots.tsx` retoken (`bg-cta` → `bg-sage-deep`, `border-border-strong` → `border-line`).
- `full-workflow.spec.ts` — happy-path step now drives the keypad.

Nudge increments are hardcoded (±2.5 kg weight, ±1 rep) per the spec's open-question resolution.

Preserved from before:
- Prefill priority (existingSet > carryover > suggestion > lastTime > default).
- Bodyweight "+ Add weight (permanent for this session)" flow.
- Delete this set affordance.
- Auto-advance (sheet reopen on next empty set) — lives in `WorkoutScreen.handleSave`.
- `save-pulse` animation.

## Test plan
- [x] `npm test -- --run` — NEW_COUNT tests pass (bumped in CLAUDE.md)
- [x] `npm run lint` — clean
- [x] `npm run build` — clean
- [x] `npm run test:e2e` — 9/9 pass
- [x] Manual phone-viewport walk planned post-review

## Out of scope
Keypad for duration / distance (deferred per §5). Automatic PR detection (manual per handoff). Exercise Picker / Finish Celebration / icon-dep removal (Sprint 12).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `NEW_COUNT` in the PR body with the actual number from Step 12.1 before running `gh pr create` (manual search-and-replace).

---

## Self-review (completed while writing)

**1. Spec coverage** — each Sprint 11 scope bullet maps to a task:

| Spec bullet | Task(s) |
|---|---|
| Replace native inputs with 3×4 keypad for weight + reps | Tasks 1, 2, 6 |
| ValueBox with active/inactive + nudge | Tasks 3, 6 |
| Weight ±2.5 kg / Reps ±1 nudge | Task 6 (Step 6.4 §6) |
| Unit toggle (kg/lbs) in corner | ValueBox has the slot (Task 3); Sprint 11 doesn't add a sheet-level unit toggle — the existing per-exercise unit-toggle on the ExerciseCard header covers this. Flagged as intentional no-op below. |
| Duration/distance keep native inputs | Task 6 (Step 6.4 §9) |
| Bodyweight "+ Add weight" flow preserved | Task 6 (Step 6.4 §7) |
| Delete this set affordance preserved | Unchanged; Task 6 leaves the footer Delete button untouched. |
| Set-position dots | Already in `SetDots.tsx`; retoken in Task 9 |
| Context line (Last / Suggested + "Use last" chip) | Task 10 |
| Manual PR toggle populating `isPersonalRecord` | Tasks 4, 5, 8 |
| Save pulse animation | Preserved (existing `save-pulse` class wire-up in `SetLogSheet.tsx:324`). |
| Preserve auto-advance | Lives in `WorkoutScreen.handleSave`; no plan task needed — sheet behavior unchanged. |
| Physical keyboard 0-9 / `.` / Backspace / Tab / Enter | Task 7 |
| ARIA labels on all custom controls | Tasks 2, 3, 4 each include `aria-label` / `aria-pressed` / `role="group"` |
| Retoken + icon swaps | Task 9 |
| E2E update | Task 11 |
| CLAUDE.md count + final sweep | Task 12 |

**Intentional no-op:** the Sprint 11 spec mentions "unit toggle (kg/lb) in corner" on the Weight ValueBox. Today the per-exercise unit override already lives on `ExerciseCard`'s header (`onUnitToggle` in `WorkoutScreen.tsx:310-312`). Duplicating a toggle inside the sheet would either (a) conflict with the per-exercise override's scope or (b) introduce a third override layer (per-set). Neither is a scope bullet in Sprint 11 — the prototype shows the corner slot, but the behavioural rules belong to a future design pass. `ValueBox` exposes a `unitToggle` prop for when Sprint 12+ decides; Sprint 11 doesn't pass one. Leaving as a conscious omission with the hook in place.

**2. Placeholder scan** — no "TBD", "similar to task", or "add error handling" phrases. Every code block is complete. The one fallback paragraph in Task 5 Step 5.2 explicitly instructs the engineer to reuse existing helpers if they exist and only write a new helper if none fit — that's a branching instruction, not a placeholder.

**3. Type consistency** —
- `KeypadKey` type defined in Task 1, reused in Tasks 2, 6, 7.
- `ValueBoxProps` signature (`label, value, unit, isActive, onFocus, onNudgeDown, onNudgeUp, unitToggle`) used identically in Tasks 3 and 6.
- `ActiveField` type (`"weight" | "reps" | "duration" | "distance"`) defined in Task 6 Step 6.4 §2, reused in Step 7.3.
- `SetLogInput.isPersonalRecord?: boolean` type extension in Task 5 matches the exact field Tasks 7 and 8 write into.
- `onSave` payload: all tests from Task 8 onward use `isPersonalRecord: boolean` (required after widening); the older tests (pre-Task 8) use `isPersonalRecord: false` implicitly, which matches the new signature.
- `handleSave` in `WorkoutScreen.tsx` and `onSave` in `SetLogSheetProps` are kept in sync by Task 8 Step 8.4.

All identifiers check out.

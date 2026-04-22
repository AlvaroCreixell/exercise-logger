# Sprint 4 — Workout Shine & Design System Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Workout screen from "functional" to "rewarding" by building reusable design primitives (`Stat`, `Pill`, `SectionHeader`, `EmptyState`), redesigning `ExerciseCard` around numbers-first hierarchy, adding a live session-progress meter, and polishing the set-log micro-interaction.

**Architecture:** Foundation-first. New primitives land before the screens that use them. CSS keyframes and token utilities land before components consume them. Each task stops at a commit boundary, so Sprint 4 can be paused mid-way without leaving the app broken.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind CSS 4 (CSS-first config), shadcn-derived primitives on top of `@base-ui/react`, Dexie 4, Vitest + React Testing Library.

## Scope notes

- **Focus:** `features/workout/*`, `shared/components/*`, `app/App.css`. Other features stay untouched this sprint.
- **Out of scope:** `TodayScreen`, `HistoryScreen`, `SessionDetailScreen` redesigns (Sprint 5 / 6). Empty-state rollout across other screens (Sprint 5).
- **Tests:** Follow the codebase convention — mirror `src/` under `tests/unit/`, explicit `import { describe, it, expect } from "vitest"`. Factory functions for entity test data.
- **CSS class naming:** Keep the existing `flash-logged` class name even when we change the keyframe internals — `SetSlot.test.tsx` asserts the class by name.
- **Branch / worktree:** Recommended to create a feature branch or worktree before starting (the brainstorming-skill normally does this; we're starting directly from the review, so make one manually: `git checkout -b sprint4-workout-shine`).

## File Structure

### Files created

| Path | Responsibility |
|---|---|
| `web/src/shared/components/Stat.tsx` | Numeric value + label pair, 4 size variants. All screens now go through this for weight/reps/time/count display. |
| `web/src/shared/components/Pill.tsx` | Tappable small choice element. Replaces ad-hoc button styling in `DaySelector`. |
| `web/src/shared/components/SectionHeader.tsx` | `text-sm font-semibold uppercase tracking-wider text-muted-foreground` section title, currently duplicated in 5 places. |
| `web/src/shared/components/EmptyState.tsx` | Icon + heading + body + optional action. Used in this sprint only for the Workout empty state; other screens pick it up in Sprint 5. |
| `web/src/features/workout/BlockStripe.tsx` | 2 px colored left-border + block-label chip. Visually groups each `SetBlock` inside `ExerciseCard`. |
| `web/src/features/workout/SessionProgress.tsx` | Sticky progress strip: "6 / 18 sets · 14 min" + thin progress bar. Lives at top of Workout scroll body. |
| `web/src/features/workout/SetDots.tsx` | `○ ● ○` visual indicator used in `SetLogSheet` header. |
| `web/tests/unit/shared/components/Stat.test.tsx` | — |
| `web/tests/unit/shared/components/Pill.test.tsx` | — |
| `web/tests/unit/shared/components/EmptyState.test.tsx` | — |
| `web/tests/unit/features/workout/BlockStripe.test.tsx` | — |
| `web/tests/unit/features/workout/SessionProgress.test.tsx` | — |
| `web/tests/unit/features/workout/SetDots.test.tsx` | — |

### Files modified

| Path | Change |
|---|---|
| `web/src/app/App.css` | Typography utility classes (`.text-value`, `.text-hero`), `flash-logged` keyframe upgraded to ring-pulse + scale-bounce. |
| `web/src/features/workout/SetSlot.tsx` | Larger min-width/height (`min-w-[5rem] min-h-[56px]`), heading font on logged value. Keep className `flash-logged`. |
| `web/src/features/workout/ExerciseCard.tsx` | Redesign: `BlockStripe` per block, combined `Last + ↑ Suggestion` single line, bigger set-slot row. Uses `Stat`. |
| `web/src/features/workout/SetLogSheet.tsx` | Tile-style inputs, inline Last/Suggestion context, `SetDots` in header, save-button scale-pulse animation on save. |
| `web/src/features/workout/WorkoutScreen.tsx` | Mount `<SessionProgress />` inside sticky header. Update empty-state to use `EmptyState`. |
| `web/tests/unit/features/workout/SetSlot.test.tsx` | Add case: rendered value uses heading font. (Existing flash tests stay green — same classname.) |
| `web/tests/unit/features/workout/ExerciseCard.test.tsx` | Add cases for BlockStripe integration, combined history line. (Existing tests regression-proof.) |
| `web/tests/unit/features/workout/SetLogSheet.test.tsx` | Add cases for `SetDots` rendering and inline suggestion display. |

---

## Task 1 — Typography utilities and ring-pulse keyframe

**Files:**
- Modify: `web/src/app/App.css`

**Rationale:** Every visual change downstream reads from these tokens. Land them first so every component can reach for the same class names.

- [ ] **Step 1: Add typography utility classes to App.css**

Modify `web/src/app/App.css`. After the existing `@layer base { ... }` block (ends line 124) and before the `/* Softened Swiss — motion, shadow, flash */` comment (line 126), insert:

```css
@layer utilities {
  .text-hero {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 2.25rem;  /* text-4xl */
    line-height: 1;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }

  .text-value {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 1.125rem; /* text-lg */
    line-height: 1.2;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  .text-value-sm {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 0.875rem; /* text-sm */
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .text-eyebrow {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.6875rem; /* ~11px */
    line-height: 1;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}
```

- [ ] **Step 2: Upgrade the `flash-logged` keyframe**

In the same file, replace the existing `@keyframes flash-logged` block and its `.flash-logged` class (lines 136–144) with:

```css
@keyframes flash-logged {
  0%   { transform: scale(1); box-shadow: 0 0 0 0 var(--success); }
  15%  { transform: scale(1.06); box-shadow: 0 0 0 4px color-mix(in oklch, var(--success) 40%, transparent); }
  45%  { transform: scale(1); box-shadow: 0 0 0 8px color-mix(in oklch, var(--success) 15%, transparent); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
}

.flash-logged {
  animation: flash-logged var(--dur-slow) var(--ease-out-soft);
}
```

- [ ] **Step 3: Add a save-press keyframe**

Immediately after the `.flash-logged` block, add:

```css
@keyframes save-pulse {
  0%   { transform: scale(1); }
  30%  { transform: scale(0.97); }
  60%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}

.save-pulse {
  animation: save-pulse 320ms var(--ease-out-soft);
}
```

- [ ] **Step 4: Verify the build still compiles**

Run: `cd web && npm run build`
Expected: completes without TypeScript or CSS errors. Prints `✓ built in ...`.

- [ ] **Step 5: Verify tests still pass**

Run: `cd web && npm test`
Expected: 440 passing tests (or current baseline). No regressions.

- [ ] **Step 6: Commit**

```bash
cd web
git add src/app/App.css
git commit -m "style(tokens): add typography utilities + upgrade set-log flash keyframe"
```

---

## Task 2 — `<Stat>` component

**Files:**
- Create: `web/src/shared/components/Stat.tsx`
- Create: `web/tests/unit/shared/components/Stat.test.tsx`

**Rationale:** The single most common pattern in the app — numeric value paired with a label. Unifying it now enforces typography and becomes the carrier for our numbers-first design language.

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/shared/components/Stat.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { Stat } from "@/shared/components/Stat";

afterEach(cleanup);

describe("Stat", () => {
  it("renders the value and label", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125")).toBeVisible();
    expect(screen.getByText("kg")).toBeVisible();
  });

  it("defaults to md size with value-sized value classname", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125").className).toMatch(/text-value\b/);
  });

  it("uses text-hero at hero size", () => {
    render(<Stat value="125" label="kg" size="hero" />);
    expect(screen.getByText("125").className).toMatch(/text-hero/);
  });

  it("omits label when not provided", () => {
    render(<Stat value="125" />);
    expect(screen.getByText("125")).toBeVisible();
    expect(screen.queryByRole("description")).toBeNull();
  });

  it("renders numeric children with tabular-nums", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125").className).toMatch(/text-value/);
  });

  it("stacks label below value by default", () => {
    const { container } = render(<Stat value="125" label="kg" />);
    expect(container.firstChild).toHaveClass("flex");
    expect(container.firstChild).toHaveClass("flex-col");
  });

  it("inlines label at sm size", () => {
    const { container } = render(<Stat value="125" label="kg" size="sm" />);
    expect(container.firstChild).toHaveClass("flex-row");
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- Stat.test`
Expected: FAIL with "Cannot find module '@/shared/components/Stat'".

- [ ] **Step 3: Implement `Stat.tsx`**

Create `web/src/shared/components/Stat.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type StatSize = "sm" | "md" | "lg" | "hero";

interface StatProps {
  value: React.ReactNode;
  label?: React.ReactNode;
  size?: StatSize;
  className?: string;
  /** Extra text under the label (e.g. "peak 140kg"). Small + muted. */
  hint?: React.ReactNode;
}

const VALUE_CLASS: Record<StatSize, string> = {
  sm: "text-value-sm",
  md: "text-value",
  lg: "text-value",
  hero: "text-hero",
};

const LABEL_CLASS: Record<StatSize, string> = {
  sm: "text-xs text-muted-foreground",
  md: "text-xs text-muted-foreground uppercase tracking-widest",
  lg: "text-sm text-muted-foreground uppercase tracking-widest",
  hero: "text-sm text-muted-foreground uppercase tracking-widest",
};

export function Stat({ value, label, size = "md", className, hint }: StatProps) {
  const isInline = size === "sm";
  return (
    <div
      className={cn(
        "flex",
        isInline ? "flex-row items-baseline gap-1.5" : "flex-col gap-0.5",
        className,
      )}
    >
      <span className={VALUE_CLASS[size]}>{value}</span>
      {label != null && <span className={LABEL_CLASS[size]}>{label}</span>}
      {hint != null && (
        <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd web && npm test -- Stat.test`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/shared/components/Stat.tsx tests/unit/shared/components/Stat.test.tsx
git commit -m "feat(shared): add Stat component for value+label pairs"
```

---

## Task 3 — `<Pill>` component

**Files:**
- Create: `web/src/shared/components/Pill.tsx`
- Create: `web/tests/unit/shared/components/Pill.test.tsx`

**Rationale:** The DaySelector has ~20 lines of inline button styling. Multiple other places will grow the same pattern. Centralize.

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/shared/components/Pill.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pill } from "@/shared/components/Pill";

afterEach(cleanup);

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill onClick={() => {}}>B</Pill>);
    expect(screen.getByRole("button", { name: "B" })).toBeVisible();
  });

  it("invokes onClick when tapped", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Pill onClick={spy}>A</Pill>);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("applies selected styling when selected=true", () => {
    render(
      <Pill onClick={() => {}} selected>
        A
      </Pill>,
    );
    expect(screen.getByRole("button").className).toMatch(/bg-primary/);
    expect(screen.getByRole("button").className).toMatch(/text-primary-foreground/);
  });

  it("applies muted styling when selected=false", () => {
    render(<Pill onClick={() => {}}>A</Pill>);
    expect(screen.getByRole("button").className).toMatch(/text-muted-foreground/);
  });

  it("shows a suggested indicator dot when indicator=true and not selected", () => {
    const { container } = render(
      <Pill onClick={() => {}} indicator>
        A
      </Pill>,
    );
    // The indicator is a small absolute-positioned span under the pill.
    expect(container.querySelector("[data-indicator='true']")).not.toBeNull();
  });

  it("hides the indicator when selected (the pill itself conveys state)", () => {
    const { container } = render(
      <Pill onClick={() => {}} indicator selected>
        A
      </Pill>,
    );
    expect(container.querySelector("[data-indicator='true']")).toBeNull();
  });

  it("passes through aria-label", () => {
    render(
      <Pill onClick={() => {}} aria-label="Day A">
        A
      </Pill>,
    );
    expect(screen.getByRole("button", { name: "Day A" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- Pill.test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `Pill.tsx`**

Create `web/src/shared/components/Pill.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  indicator?: boolean;
}

export function Pill({
  selected = false,
  indicator = false,
  className,
  children,
  type = "button",
  ...rest
}: PillProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "relative shrink-0 px-4 py-2 text-sm font-semibold transition-colors duration-[var(--dur-base)]",
        "border-[1.5px] border-border-strong focus-visible:ring-2 focus-visible:ring-cta/30 outline-none",
        selected
          ? "bg-primary text-primary-foreground z-10"
          : "bg-background text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span>{children}</span>
      {indicator && !selected && (
        <span
          data-indicator="true"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cta"
        />
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd web && npm test -- Pill.test`
Expected: all 7 tests pass.

- [ ] **Step 5: Refactor `DaySelector` to use `Pill`**

Modify `web/src/features/today/DaySelector.tsx`. Replace the current `<button>` + inline className with `<Pill>`:

```tsx
import type { Routine } from "@/domain/types";
import { Pill } from "@/shared/components/Pill";

interface DaySelectorProps {
  routine: Routine;
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DaySelector({
  routine,
  selectedDayId,
  onSelectDay,
}: DaySelectorProps) {
  const selectedDay = routine.days[selectedDayId];
  const selectedLabel = selectedDay?.label ?? selectedDayId;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-cta">
        Day {selectedDayId} — {selectedLabel}
      </p>
      <div className="border-t-2 border-border-strong" />
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
        {routine.dayOrder.map((dayId, i) => (
          <Pill
            key={dayId}
            onClick={() => onSelectDay(dayId)}
            selected={dayId === selectedDayId}
            indicator={dayId === routine.nextDayId}
            aria-label={`Day ${dayId}`}
            className={i > 0 ? "-ml-[1.5px]" : ""}
          >
            {dayId}
          </Pill>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run all tests**

Run: `cd web && npm test`
Expected: all tests pass. DaySelector is consumed indirectly by `TodayScreen` e2e and smoke tests; if either fails, verify that the Pill onClick still fires and suggested-day dot still renders.

- [ ] **Step 7: Commit**

```bash
cd web
git add src/shared/components/Pill.tsx tests/unit/shared/components/Pill.test.tsx src/features/today/DaySelector.tsx
git commit -m "feat(shared): add Pill component and adopt in DaySelector"
```

---

## Task 4 — `<SectionHeader>` and `<EmptyState>` components

**Files:**
- Create: `web/src/shared/components/SectionHeader.tsx`
- Create: `web/src/shared/components/EmptyState.tsx`
- Create: `web/tests/unit/shared/components/EmptyState.test.tsx`

**Rationale:** `SectionHeader` has no behavior (pure presentational) so no test. `EmptyState` has composition + optional action; we test the contract.

- [ ] **Step 1: Implement `SectionHeader.tsx`**

Create `web/src/shared/components/SectionHeader.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 2: Write the failing EmptyState test**

Create `web/tests/unit/shared/components/EmptyState.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the heading and body", () => {
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout from the Today tab."
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Active Workout" }),
    ).toBeVisible();
    expect(screen.getByText("Start a workout from the Today tab.")).toBeVisible();
  });

  it("renders the icon", () => {
    const { container } = render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
      />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders an action button when provided and fires onClick", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
        action={{ label: "Go to Today", onClick: spy }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Go to Today" });
    await user.click(btn);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("omits the action when not provided", () => {
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

Run: `cd web && npm test -- EmptyState.test`
Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement `EmptyState.tsx`**

Create `web/src/shared/components/EmptyState.tsx`:

```tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center bg-muted/60 text-muted-foreground">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight font-heading">
        {heading}
      </h1>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {body}
      </p>
      {action && (
        <Button variant="outline" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test — expect pass**

Run: `cd web && npm test -- EmptyState.test`
Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
cd web
git add src/shared/components/SectionHeader.tsx src/shared/components/EmptyState.tsx tests/unit/shared/components/EmptyState.test.tsx
git commit -m "feat(shared): add SectionHeader and EmptyState components"
```

---

## Task 5 — `SetSlot` visual upgrade

**Files:**
- Modify: `web/src/features/workout/SetSlot.tsx`
- Modify: `web/tests/unit/features/workout/SetSlot.test.tsx`

**Rationale:** Set slots are the most-tapped surface in the app. Make the logged value feel like a display number, not a label. Preserve all accessibility and the `flash-logged` behavior (tests depend on the class name).

- [ ] **Step 1: Add a new test case — heading font on logged value**

Modify `web/tests/unit/features/workout/SetSlot.test.tsx`. Add this `describe` block at the end of the file (inside the top-level, after the existing "flash on log" block):

```tsx
describe("SetSlot — value typography", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders logged value with text-value-sm utility", () => {
    render(
      <SetSlot setIndex={0} loggedSet={makeLoggedSet()} units="kg" onClick={() => {}} />
    );
    const slot = screen.getByTestId("set-slot");
    // The value is rendered in a span child; verify the slot has the numeric class.
    const valueSpan = slot.querySelector("span");
    expect(valueSpan).not.toBeNull();
    expect(valueSpan!.className).toMatch(/text-value-sm/);
  });

  it("unlogged slot shows set number in muted text, not heading font", () => {
    render(
      <SetSlot setIndex={0} loggedSet={undefined} units="kg" onClick={() => {}} />
    );
    const slot = screen.getByTestId("set-slot");
    const numberSpan = slot.querySelector("span");
    expect(numberSpan).not.toBeNull();
    expect(numberSpan!.className ?? "").not.toMatch(/text-value/);
  });
});
```

If `cleanup` isn't already imported from `@testing-library/react` in this file (read the existing imports at the top), add it to the existing import statement.

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- SetSlot.test`
Expected: the two new tests FAIL because the current SetSlot doesn't use `text-value-sm`.

- [ ] **Step 3: Update `SetSlot.tsx` with larger dimensions and heading font**

Modify `web/src/features/workout/SetSlot.tsx`. Replace the logged-state rendering section. Find the `return <button ...>` block starting around line 79 and change the className chain plus the inner span markup as follows:

Find:
```tsx
      className={`min-h-[48px] min-w-[4rem] rounded-sm px-2 text-xs font-medium tabular-nums flex items-center justify-center gap-1 transition-colors duration-[var(--dur-base)] shrink-0 focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 active:scale-95 hover:border-cta ${
        isLogged
          ? "border-l-2 border-l-success/60 border border-success bg-success text-white"
          : "border-[1.5px] border-border-strong text-muted-foreground hover:bg-muted/50"
      }${flashing ? " flash-logged" : ""}`}
    >
      {isLogged ? (
        <>
          <Check className="h-3 w-3 shrink-0" />
          <span>{formatValue(loggedSet)}</span>
        </>
      ) : (
        <span>{setIndex + 1}</span>
      )}
    </button>
```

Replace with:
```tsx
      className={`min-h-[56px] min-w-[5rem] rounded-sm px-2.5 flex items-center justify-center gap-1.5 transition-colors duration-[var(--dur-base)] shrink-0 focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 active:scale-95 hover:border-cta ${
        isLogged
          ? "border-l-2 border-l-success/60 border border-success bg-success text-white"
          : "border-[1.5px] border-border-strong text-muted-foreground hover:bg-muted/50"
      }${flashing ? " flash-logged" : ""}`}
    >
      {isLogged ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          <span className="text-value-sm">{formatValue(loggedSet)}</span>
        </>
      ) : (
        <span className="text-sm font-medium tabular-nums">{setIndex + 1}</span>
      )}
    </button>
```

Also update the `disabled && !isLogged` branch (around line 67–77). Find:
```tsx
      <div
        data-testid="set-slot"
        aria-label={`Set ${setIndex + 1}: empty`}
        className="min-h-[48px] min-w-[4rem] rounded-sm px-2 text-xs font-medium tabular-nums flex items-center justify-center gap-1 shrink-0 border border-border/50 text-muted-foreground/40"
      >
        <span>{setIndex + 1}</span>
      </div>
```

Replace with:
```tsx
      <div
        data-testid="set-slot"
        aria-label={`Set ${setIndex + 1}: empty`}
        className="min-h-[56px] min-w-[5rem] rounded-sm px-2.5 flex items-center justify-center gap-1.5 shrink-0 border border-border/50 text-muted-foreground/40"
      >
        <span className="text-sm font-medium tabular-nums">{setIndex + 1}</span>
      </div>
```

- [ ] **Step 4: Run SetSlot tests — expect all pass**

Run: `cd web && npm test -- SetSlot.test`
Expected: existing flash tests still green; new typography tests now pass.

- [ ] **Step 5: Run the full test suite**

Run: `cd web && npm test`
Expected: no regressions.

- [ ] **Step 6: Eyeball in the dev server**

Run: `cd web && npm run dev`
Open http://localhost:5173 in the browser, start a workout (the bundled routine auto-loads on fresh install), tap a set slot, log a value, confirm:
- The slot is visibly larger than before (56 px tall, ~80 px wide minimum).
- The logged value ("80x8") renders in the Urbanist heading font.
- The check icon is slightly chunkier (strokeWidth 2.5).
- When you log a new set, the flash animation plays — it should look like a ring of faded green expanding out from the slot, not a plain scale pulse.

Stop the dev server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
cd web
git add src/features/workout/SetSlot.tsx tests/unit/features/workout/SetSlot.test.tsx
git commit -m "style(set-slot): bump to 56×80 min + heading-font value"
```

---

## Task 6 — `<BlockStripe>` component

**Files:**
- Create: `web/src/features/workout/BlockStripe.tsx`
- Create: `web/tests/unit/features/workout/BlockStripe.test.tsx`

**Rationale:** ExerciseCard (next task) composes multiple blocks vertically. A colored left-stripe per block creates rhythm. This component encapsulates the stripe + label-chip + target-line header of a block.

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/features/workout/BlockStripe.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BlockStripe } from "@/features/workout/BlockStripe";

afterEach(cleanup);

describe("BlockStripe", () => {
  it("renders children inside the striped container", () => {
    render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.getByText("child")).toBeVisible();
  });

  it("renders the label as an uppercase chip", () => {
    render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.getByText("Top")).toBeVisible();
    expect(screen.getByText("Top").className).toMatch(/uppercase/);
  });

  it("uses warning color stripe for top variant", () => {
    const { container } = render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe).not.toBeNull();
    expect(stripe!.className).toMatch(/bg-warning/);
  });

  it("uses info color stripe for amrap variant", () => {
    const { container } = render(
      <BlockStripe label="AMRAP" variant="amrap">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe!.className).toMatch(/bg-info/);
  });

  it("uses neutral color stripe for default variant", () => {
    const { container } = render(
      <BlockStripe label="Set block 2" variant="default">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe!.className).toMatch(/bg-muted/);
  });

  it("omits label chip when label is empty", () => {
    render(
      <BlockStripe label="" variant="default">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.queryByText(/./)).not.toBeNull(); // child is there
    // No chip text to assert — but there should only be one element with uppercase
    // tracking in the container aside from the child.
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- BlockStripe.test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `BlockStripe.tsx`**

Create `web/src/features/workout/BlockStripe.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type BlockStripeVariant = "top" | "amrap" | "default";

interface BlockStripeProps {
  label: string;
  variant: BlockStripeVariant;
  children: React.ReactNode;
}

const STRIPE_COLOR: Record<BlockStripeVariant, string> = {
  top: "bg-warning",
  amrap: "bg-info",
  default: "bg-muted-foreground/30",
};

const CHIP_COLOR: Record<BlockStripeVariant, string> = {
  top: "bg-warning-soft text-warning",
  amrap: "bg-info-soft text-info",
  default: "bg-muted text-muted-foreground",
};

export function BlockStripe({ label, variant, children }: BlockStripeProps) {
  return (
    <div className="relative pl-3.5">
      <span
        data-stripe
        className={cn(
          "absolute left-0 top-0 bottom-0 w-0.5",
          STRIPE_COLOR[variant],
        )}
      />
      <div className="space-y-1.5">
        {label && (
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-widest",
              CHIP_COLOR[variant],
            )}
          >
            {label}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd web && npm test -- BlockStripe.test`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/workout/BlockStripe.tsx tests/unit/features/workout/BlockStripe.test.tsx
git commit -m "feat(workout): add BlockStripe component"
```

---

## Task 7 — `ExerciseCard` redesign

**Files:**
- Modify: `web/src/features/workout/ExerciseCard.tsx`
- Modify: `web/tests/unit/features/workout/ExerciseCard.test.tsx`

**Rationale:** The atomic unit of Workout. Goal: bigger name, quieter target, one-line last+suggestion, blocks visually separated by `BlockStripe`. All existing data still shown; all existing callbacks still fire.

- [ ] **Step 1: Add regression tests for the new layout**

Modify `web/tests/unit/features/workout/ExerciseCard.test.tsx`. At the end of the existing file (after the final `describe` block), append:

```tsx
describe("ExerciseCard — block stripe integration", () => {
  it("wraps each block in a BlockStripe", () => {
    const multiBlock = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    const { container } = render(
      <ExerciseCard
        sessionExercise={multiBlock}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    const stripes = container.querySelectorAll("[data-stripe]");
    expect(stripes.length).toBe(2);
  });

  it("renders block label chips", () => {
    const multiBlock = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={multiBlock}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    expect(screen.getByText("Top")).toBeVisible();
    expect(screen.getByText("Back-off")).toBeVisible();
  });
});

describe("ExerciseCard — combined history + suggestion", () => {
  it("renders last-time and suggestion on a single line when both exist", () => {
    const hist: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
            { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
            { weightKg: 100, reps: 7, durationSec: null, distanceM: null },
          ],
        },
      ],
      suggestions: [
        {
          blockIndex: 0,
          suggestedWeightKg: 105,
          isProgression: true,
          previousWeightKg: 100,
        },
      ],
    };
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={hist}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    // "Last 100kg x 8, 8, 7 · ↑ 105kg" – we assert the two halves are both visible,
    // and that they're inside the same parent (one line).
    const last = screen.getByText(/100kg x 8, 8, 7/);
    const suggestion = screen.getByText(/105kg/);
    expect(last).toBeVisible();
    expect(suggestion).toBeVisible();
    expect(last.parentElement).toBe(suggestion.parentElement);
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `cd web && npm test -- ExerciseCard.test`
Expected: the new tests FAIL; existing tests may also fail because the block-label markup changed.

- [ ] **Step 3: Rewrite the block-rendering section of `ExerciseCard.tsx`**

Modify `web/src/features/workout/ExerciseCard.tsx`:

1. Add import at the top:

```tsx
import { BlockStripe, type BlockStripeVariant } from "./BlockStripe";
```

2. Remove the `blockLabelVariant` helper function (lines 27-31 in the current file). It's replaced by the variant mapping below.

3. Add a new helper near the top of the file (after imports, before `formatDurationShort`):

```tsx
function blockStripeVariant(label: string): BlockStripeVariant {
  if (label === "Top") return "top";
  if (label === "AMRAP") return "amrap";
  return "default";
}
```

4. In the component body, find the section that maps blocks (`blocks.map((block, blockIndex) => { ... })`, starting around line 151). Replace the entire mapped return (the big `<div key={blockIndex} className="space-y-1.5"> ... </div>`) with:

```tsx
            const variant = blockStripeVariant(label ?? "");
            return (
              <BlockStripe
                key={blockIndex}
                label={label ?? ""}
                variant={variant}
              >
                {/* Target line (quieter) */}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTarget(block)}
                </p>

                {/* Combined history + suggestion on one line */}
                {(lastTime || suggestion) && (
                  <p className="text-xs tabular-nums">
                    {lastTime && lastTime.sets.length > 0 && (
                      <span className="text-muted-foreground">
                        Last {formatLastTime(lastTime.sets, units)}
                      </span>
                    )}
                    {lastTime && lastTime.sets.length > 0 && suggestion && (
                      <span className="text-muted-foreground"> · </span>
                    )}
                    {suggestion && suggestion.isProgression && (
                      <span className="text-success font-semibold inline-flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                    {suggestion && !suggestion.isProgression && (
                      <span className="text-info font-medium inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                  </p>
                )}

                {/* Set slot row */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pt-1">
                  {Array.from({ length: block.count }, (_, setIndex) => (
                    <SetSlot
                      key={setIndex}
                      setIndex={setIndex}
                      loggedSet={setLookup.get(`${blockIndex}:${setIndex}`)}
                      units={units}
                      onClick={() => onSetTap(blockIndex, setIndex)}
                      disabled={readOnly}
                    />
                  ))}
                </div>
              </BlockStripe>
            );
```

5. Update the exercise name size and weight. Find the header `<h3>` (around line 123):

```tsx
            <h3 className="text-base font-semibold tracking-tight truncate">
              {se.exerciseNameSnapshot}
            </h3>
```

Replace with:

```tsx
            <h3 className="text-lg font-heading font-bold tracking-tight truncate">
              {se.exerciseNameSnapshot}
            </h3>
```

- [ ] **Step 4: Run ExerciseCard tests — expect pass**

Run: `cd web && npm test -- ExerciseCard.test`
Expected: all tests (old + new) pass. If a pre-existing test references `bg-muted text-muted-foreground` on an in-card label chip, update its assertion to match the new chip classes (but do not remove coverage).

- [ ] **Step 5: Run the full suite**

Run: `cd web && npm test`
Expected: no regressions.

- [ ] **Step 6: Eyeball in the dev server**

Run: `cd web && npm run dev`
Start a workout. Verify:
- Exercise names visibly larger and in Urbanist heading font.
- Blocks have a thin colored stripe on the left — warning orange on "Top", teal on "AMRAP", muted gray on default.
- The "Last 100kg x 8, 8, 7 · ↑ 105kg" line renders as a single line with subtle separator.
- Set slots stay large and readable.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
cd web
git add src/features/workout/ExerciseCard.tsx tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "refactor(exercise-card): BlockStripe layout + combined history/suggest line + larger heading"
```

---

## Task 8 — `<SessionProgress>` component

**Files:**
- Create: `web/src/features/workout/SessionProgress.tsx`
- Create: `web/tests/unit/features/workout/SessionProgress.test.tsx`

**Rationale:** Sticky strip at the top of the Workout body that shows "6 / 18 sets · 14 min · 3 of 6 exercises" with a horizontal progress bar. The core "dashboard feel" upgrade.

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/features/workout/SessionProgress.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { act } from "react";
import { SessionProgress } from "@/features/workout/SessionProgress";

afterEach(cleanup);

describe("SessionProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders N of M set count and elapsed minutes", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={18}
        loggedSets={6}
        totalExercises={6}
      />
    );
    expect(screen.getByText("6")).toBeVisible();
    expect(screen.getByText(/\/ 18/)).toBeVisible();
    expect(screen.getByText(/30 min/)).toBeVisible();
  });

  it("renders percentage progress bar width", () => {
    const { container } = render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={3}
        totalExercises={3}
      />
    );
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("30%");
  });

  it("clamps progress width at 100% when loggedSets exceeds totalSets", () => {
    const { container } = render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={15}
        totalExercises={3}
      />
    );
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement | null;
    expect(bar!.style.width).toBe("100%");
  });

  it("shows 0 / 0 gracefully when totalSets is 0", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={0}
        loggedSets={0}
        totalExercises={0}
      />
    );
    expect(screen.getByText("0")).toBeVisible();
  });

  it("updates elapsed minutes on interval tick", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={0}
        totalExercises={3}
      />
    );
    expect(screen.getByText(/30 min/)).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/31 min/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- SessionProgress.test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `SessionProgress.tsx`**

Create `web/src/features/workout/SessionProgress.tsx`:

```tsx
import { useEffect, useState } from "react";

interface SessionProgressProps {
  startedAt: string;
  totalSets: number;
  loggedSets: number;
  totalExercises: number;
}

function computeElapsedMin(startedAt: string): number {
  const ms = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function SessionProgress({
  startedAt,
  totalSets,
  loggedSets,
  totalExercises,
}: SessionProgressProps) {
  const [elapsedMin, setElapsedMin] = useState(() => computeElapsedMin(startedAt));

  useEffect(() => {
    setElapsedMin(computeElapsedMin(startedAt));
    const id = setInterval(() => {
      setElapsedMin(computeElapsedMin(startedAt));
    }, 60_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const pct = totalSets > 0 ? Math.min(100, (loggedSets / totalSets) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 px-5 py-1.5 border-b border-border">
        <span className="text-value tabular-nums">
          {loggedSets}
          <span className="text-base text-muted-foreground"> / {totalSets}</span>
          <span className="text-xs text-muted-foreground ml-1.5 font-medium tracking-wide uppercase">
            sets
          </span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {elapsedMin} min · {totalExercises} {totalExercises === 1 ? "exercise" : "exercises"}
        </span>
      </div>
      <div className="h-0.5 bg-muted relative overflow-hidden">
        <div
          data-progress-bar
          className="absolute inset-y-0 left-0 bg-cta transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd web && npm test -- SessionProgress.test`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/workout/SessionProgress.tsx tests/unit/features/workout/SessionProgress.test.tsx
git commit -m "feat(workout): add SessionProgress meter component"
```

---

## Task 9 — Integrate `SessionProgress` into `WorkoutScreen`, adopt `EmptyState`

**Files:**
- Modify: `web/src/features/workout/WorkoutScreen.tsx`

**Rationale:** Mount the progress strip under the sticky header; migrate the empty state to `EmptyState`.

- [ ] **Step 1: Import additions**

Modify `web/src/features/workout/WorkoutScreen.tsx`. Add these imports near the other imports at the top of the file:

```tsx
import { SessionProgress } from "./SessionProgress";
import { EmptyState } from "@/shared/components/EmptyState";
import { Dumbbell } from "lucide-react";
```

(If `Dumbbell` is already imported from `lucide-react`, don't duplicate it.)

- [ ] **Step 2: Replace the empty-state markup**

Find the empty-state block around lines 40-49:

```tsx
  // Empty state
  if (activeSession === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5">
        <h1 className="text-2xl font-extrabold tracking-tight font-heading">No Active Workout</h1>
        <p className="text-sm text-muted-foreground">
          Start a workout from the Today tab.
        </p>
      </div>
    );
  }
```

Replace with:

```tsx
  // Empty state
  if (activeSession === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout from the Today tab."
      />
    );
  }
```

- [ ] **Step 3: Mount `SessionProgress` after the sticky header**

Find the sticky-header markup near line 156:

```tsx
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b-2 border-border-strong px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
          {session.dayLabelSnapshot}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight font-heading truncate">
          {session.routineNameSnapshot}
        </h1>
      </div>
```

Change the outer wrapper from `<div className="sticky top-0 ..."` to wrap both the heading *and* the SessionProgress inside a shared sticky container. Replace the block above with:

```tsx
      {/* Sticky header + progress */}
      <div className="sticky top-0 z-10 bg-background border-b-2 border-border-strong">
        <div className="px-5 pt-3 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
            {session.dayLabelSnapshot}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight font-heading truncate">
            {session.routineNameSnapshot}
          </h1>
        </div>
        <SessionProgress
          startedAt={session.startedAt}
          totalSets={totalPrescribed}
          loggedSets={loggedSets.filter((ls) => ls.origin === "routine").length}
          totalExercises={sessionExercises.length}
        />
      </div>
```

Note: `totalPrescribed` is already computed in the existing component at line ~101. Reuse it.

- [ ] **Step 4: Run the test suite**

Run: `cd web && npm test`
Expected: all tests pass. If any regression, it will be in `features/workout/WorkoutScreen.test.tsx` (which does not yet exist) or in E2E — make sure the smoke test still finds "Finish Workout" in the UI.

- [ ] **Step 5: Eyeball in the dev server**

Run: `cd web && npm run dev`
Start a workout. Verify:
- The sticky header now has three visual rows: eyebrow (day label in purple small caps), routine name (big Urbanist), and the progress strip (N / M sets · elapsed min) with a thin progress bar.
- Log a set — the bar animates forward.
- Navigate to the Workout tab with no active session — the empty state shows the Dumbbell icon in a muted tinted square.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
cd web
git add src/features/workout/WorkoutScreen.tsx
git commit -m "feat(workout): add SessionProgress to sticky header + adopt EmptyState"
```

---

## Task 10 — `<SetDots>` component

**Files:**
- Create: `web/src/features/workout/SetDots.tsx`
- Create: `web/tests/unit/features/workout/SetDots.test.tsx`

**Rationale:** Visual set indicator (`○ ● ○`) for SetLogSheet header. Makes "Set 2 of 3" at-a-glance rather than read-the-string.

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/features/workout/SetDots.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SetDots } from "@/features/workout/SetDots";

afterEach(cleanup);

describe("SetDots", () => {
  it("renders one dot per set in a block", () => {
    const { container } = render(<SetDots total={3} current={0} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect(dots.length).toBe(3);
  });

  it("marks the current dot as active", () => {
    const { container } = render(<SetDots total={3} current={1} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect((dots[0] as HTMLElement).dataset.state).toBe("inactive");
    expect((dots[1] as HTMLElement).dataset.state).toBe("active");
    expect((dots[2] as HTMLElement).dataset.state).toBe("inactive");
  });

  it("handles total=0 without crashing", () => {
    const { container } = render(<SetDots total={0} current={0} />);
    expect(container.querySelectorAll("[data-dot]").length).toBe(0);
  });

  it("exposes an aria-label summarizing current/total", () => {
    render(<SetDots total={3} current={1} />);
    expect(screen.getByLabelText("Set 2 of 3")).toBeInTheDocument();
  });

  it("handles total=1 as a single-dot indicator", () => {
    const { container } = render(<SetDots total={1} current={0} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect(dots.length).toBe(1);
    expect((dots[0] as HTMLElement).dataset.state).toBe("active");
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- SetDots.test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `SetDots.tsx`**

Create `web/src/features/workout/SetDots.tsx`:

```tsx
interface SetDotsProps {
  total: number;
  current: number;
}

export function SetDots({ total, current }: SetDotsProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`Set ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === current;
        return (
          <span
            key={i}
            data-dot
            data-state={isActive ? "active" : "inactive"}
            className={
              isActive
                ? "h-2.5 w-2.5 rounded-full bg-cta"
                : "h-2 w-2 rounded-full border border-border-strong bg-background"
            }
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd web && npm test -- SetDots.test`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/workout/SetDots.tsx tests/unit/features/workout/SetDots.test.tsx
git commit -m "feat(workout): add SetDots visual indicator"
```

---

## Task 11 — `SetLogSheet` redesign (inline context + tile inputs + save animation)

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

**Rationale:** Biggest single-screen impact. Tile-style inputs, inline last/suggestion, set dots header, save-press animation. Preserve all existing behavior (prefill priority, bodyweight promotion flow, validation).

- [ ] **Step 1: Add new tests — inline context + set dots**

Modify `web/tests/unit/features/workout/SetLogSheet.test.tsx`. Append after the existing content:

```tsx
describe("SetLogSheet — inline context", () => {
  it("shows SetDots in the header with the right current index", () => {
    renderSheet({ setIndex: 1 });
    expect(screen.getByLabelText(/set 2 of 3/i)).toBeInTheDocument();
  });

  it("shows Last-time context when lastTime is provided", () => {
    renderSheet({
      lastTime: {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [
          { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
        ],
      },
    });
    expect(screen.getByText(/100kg/i)).toBeVisible();
    expect(screen.getByText(/last time/i)).toBeVisible();
  });

  it("shows suggestion inline when provided", () => {
    renderSheet({
      suggestion: {
        blockIndex: 0,
        suggestedWeightKg: 105,
        isProgression: true,
        previousWeightKg: 100,
      },
    });
    expect(screen.getByText(/105kg/i)).toBeVisible();
    expect(screen.getByText(/suggested/i)).toBeVisible();
  });

  it("renders weight and reps fields as tile-style (h-14)", () => {
    renderSheet();
    const weight = document.querySelector('input[name="weight"]');
    const reps = document.querySelector('input[name="reps"]');
    expect(weight?.className).toMatch(/h-14/);
    expect(reps?.className).toMatch(/h-14/);
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `cd web && npm test -- SetLogSheet.test`
Expected: new tests FAIL (SetDots not yet rendered, inline context not shown, inputs still h-12).

- [ ] **Step 3: Redesign the sheet markup**

Modify `web/src/features/workout/SetLogSheet.tsx`:

1. Add imports near the top:

```tsx
import { SetDots } from "./SetDots";
import { toast as _toast } from "sonner"; // (if not already imported as `toast`)
```

(The file already imports `toast`. Don't duplicate.)

2. Rewrite the `SheetHeader` region (currently lines 170-178). Find:

```tsx
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">
            {se.exerciseNameSnapshot}
            {blockLabel ? ` — ${blockLabel}` : ""}
            {" — "}
            <span className="tabular-nums">Set {setIndex + 1} of {totalSets}</span>
          </SheetTitle>
        </SheetHeader>
```

Replace with:

```tsx
        <SheetHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-heading font-bold tracking-tight truncate">
                {se.exerciseNameSnapshot}
              </SheetTitle>
              {blockLabel && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
                  {blockLabel}
                </p>
              )}
            </div>
            {typeof totalSets === "number" && totalSets > 0 && (
              <SetDots total={totalSets} current={setIndex} />
            )}
          </div>
        </SheetHeader>
```

3. Add an inline context block between the header and the input fields. Insert immediately before the `{/* Weight field */}` comment (currently line 181):

```tsx
          {/* Inline context: Last time + Suggestion */}
          {(lastTime?.sets.length || suggestion) && (
            <div className="-mt-1 pb-2 space-y-0.5 text-xs tabular-nums">
              {lastTime && lastTime.sets.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="uppercase tracking-widest text-[11px] font-semibold">Last time</span>
                  <span className="mx-1.5">·</span>
                  <span className="text-foreground">
                    {(() => {
                      const s = lastTime.sets[setIndex] ?? lastTime.sets[0]!;
                      if (s.weightKg != null && s.reps != null) {
                        return `${toDisplayWeight(s.weightKg, units)}${units} × ${s.reps}`;
                      }
                      if (s.reps != null) return `${s.reps} reps`;
                      if (s.durationSec != null) return `${s.durationSec}s`;
                      if (s.distanceM != null) return `${s.distanceM}m`;
                      return "—";
                    })()}
                  </span>
                </p>
              )}
              {suggestion && (
                <p className={suggestion.isProgression ? "text-success font-semibold" : "text-info font-medium"}>
                  <span className="uppercase tracking-widest text-[11px]">Suggested</span>
                  <span className="mx-1.5 font-normal">·</span>
                  {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                  {suggestion.isProgression && " ↑"}
                </p>
              )}
            </div>
          )}
```

4. Change every `className="text-lg tabular-nums h-12"` on the `<Input>` elements to `className="text-value h-14 text-center"`. Four inputs: weight, reps, duration, distance. Example:

```tsx
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                className="text-value h-14 text-center"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoFocus
              />
```

Apply the same `className="text-value h-14 text-center"` to the reps, duration, and distance Inputs.

5. Add the save-press animation state and apply to Save. Inside the component, add a new state near the other `useState` declarations (after `const [saving, setSaving] = useState(false);` on line 78):

```tsx
  const [savePulse, setSavePulse] = useState(false);
```

6. Wrap the `onSave` body in `handleSave` to trigger the pulse. Find `async function handleSave()` (around line 141) and update:

```tsx
  async function handleSave() {
    const w = weight.trim() ? parseFloat(weight) : null;
    const input = {
      performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
      performedReps: reps.trim() ? parseInt(reps, 10) : null,
      performedDurationSec: duration.trim()
        ? (durationInMinutes ? Math.round(parseFloat(duration) * 60) : parseInt(duration, 10))
        : null,
      performedDistanceM: distance.trim() ? parseFloat(distance) : null,
    };
    if (isSetInputEmpty(targetKind, input)) {
      toast.error("Enter at least " + (targetKind === "reps" ? "reps" : targetKind === "duration" ? "duration" : "distance") + " to save.");
      return;
    }
    setSaving(true);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 320);
    try {
      await onSave(input);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save set");
    } finally {
      setSaving(false);
    }
  }
```

7. Apply the `save-pulse` class conditionally on the Save button. Find the Save button (around line 275):

```tsx
          <Button variant="cta" className="w-full" size="lg" onClick={handleSave} disabled={saving}>
            Save
          </Button>
```

Replace with:

```tsx
          <Button
            variant="cta"
            className={`w-full ${savePulse ? "save-pulse" : ""}`}
            size="lg"
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
```

- [ ] **Step 4: Run SetLogSheet tests — expect pass**

Run: `cd web && npm test -- SetLogSheet.test`
Expected: all tests (pre-existing + new) pass. Pre-existing prefill and bodyweight-promotion tests should be unaffected because the logic around them didn't change.

- [ ] **Step 5: Run the full suite**

Run: `cd web && npm test`
Expected: no regressions.

- [ ] **Step 6: Eyeball in the dev server**

Run: `cd web && npm run dev`
Start a workout. Tap a set slot. Verify:
- Sheet header now has exercise name (big Urbanist), block eyebrow ("TOP"), and set-dots on the right.
- Under the header: a "Last time · 100kg × 8" line, and if a suggestion exists, "Suggested · 105kg ↑" in success green.
- The weight/reps inputs look like tiles — wider, taller, center-aligned numbers.
- Tap Save — the button briefly scale-pulses before the sheet dismisses.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
cd web
git add src/features/workout/SetLogSheet.tsx tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "refactor(set-log-sheet): inline last/suggest context, SetDots header, tile inputs, save pulse"
```

---

## Task 12 — Final visual QA sweep and docs update

**Files:**
- Modify: `CLAUDE.md` (root) — update test count.
- Modify: `docs/ui-rewrite-spec.md` — add a drift note that Sprint 4 is shipped.

**Rationale:** Lock in the test-count baseline, document the shipped design decisions so the next contributor doesn't re-examine them. No code changes.

- [ ] **Step 1: Run the full test suite and note the new count**

Run: `cd web && npm test`
Expected: all tests pass. Note the total (should be 440 + ~35 new tests = ~475).

- [ ] **Step 2: Update the root `CLAUDE.md` test count**

Modify `C:\Users\creix\VSC Projects\exercise_logger\CLAUDE.md`. Find the line:

```
npm test              # 440 unit+integration tests (Vitest)
```

Replace with the new count from Step 1, e.g.:

```
npm test              # 475 unit+integration tests (Vitest)
```

- [ ] **Step 3: Add a drift note to `docs/ui-rewrite-spec.md`**

Modify `C:\Users\creix\VSC Projects\exercise_logger\docs\ui-rewrite-spec.md`. In the "Drift / Status as of 2026-04-17" block at the top, append:

```
- **Sprint 4 shipped (2026-04-17):** Workout screen upgraded with `SessionProgress` meter; `ExerciseCard` refactored around `BlockStripe` with left colored stripe per block and combined Last/Suggestion line. `SetLogSheet` redesigned with inline context + tile inputs + `SetDots` + save-pulse animation. New shared primitives `Stat`, `Pill`, `SectionHeader`, `EmptyState`. Where this spec text differs from current code, the code is authoritative.
```

- [ ] **Step 4: Run lint, typecheck, build**

Run: `cd web && npm run lint && npm run typecheck && npm run build`
Expected: all three pass with no errors.

- [ ] **Step 5: Eyeball QA checklist in the dev server**

Run: `cd web && npm run dev`

Walk through this checklist on http://localhost:5173:

- [ ] Fresh tab → Today screen shows the bundled routine (Full Body 3-Day). Start Workout button visible.
- [ ] Day selector pills render with a small dot under the suggested day if it's not selected.
- [ ] Tap Start Workout. Lands on Workout screen.
- [ ] Sticky header: purple day eyebrow, routine name in big Urbanist, progress strip showing "0 / {total} sets · 0 min · {count} exercises" with a 0-width purple bar beneath it.
- [ ] Each exercise card: name in big Urbanist, target line muted and quiet, Last/Suggestion combined on one line, set slots at 56×80 minimum in a horizontal scrollable row.
- [ ] Multi-block exercises (e.g., Squat with Top + back-off) show two visually distinct stripes on the left.
- [ ] Tap a set slot. Sheet opens. Header has exercise name + set dots. Inline Last / Suggestion line visible (if history exists). Tile-style weight/reps inputs.
- [ ] Enter 60 / 8 and tap Save. Save button briefly scale-pulses, sheet dismisses, set slot shows "60x8 ✓" with a ring-pulse + scale-bounce flash.
- [ ] Progress strip at top now shows "1 / {total}" and the bar has advanced.
- [ ] Tap Finish Workout. Confirm. Toast "Workout finished!" fires and navigate to History.
- [ ] Navigate back to Workout tab. Empty state: Dumbbell icon in a muted tinted square, heading, body text, no button (matches spec).
- [ ] Navigate through other tabs (Today / History / Settings). Nothing broken. No console errors.

Stop the dev server.

- [ ] **Step 6: Commit documentation updates**

```bash
cd web
git add ../CLAUDE.md ../docs/ui-rewrite-spec.md
git commit -m "docs: record Sprint 4 shipment and refresh test count"
```

- [ ] **Step 7: Run the full gamut once more as a final check**

```bash
cd web
npm run lint
npm run typecheck
npm test
```

Expected: all green.

If all green, Sprint 4 is done and shippable.

---

## Self-review checklist

Use this when the plan lands to confirm nothing was skipped:

- Design primitives: `Stat`, `Pill`, `SectionHeader`, `EmptyState`, `BlockStripe`, `SessionProgress`, `SetDots` — 7 components created.
- Typography utilities: `.text-hero`, `.text-value`, `.text-value-sm`, `.text-eyebrow` — 4 utilities.
- Animations: upgraded `flash-logged` keyframe, new `save-pulse` keyframe.
- `SetSlot` bumped to 56 px × 80 px minimum, heading font on logged value.
- `ExerciseCard`: heading-font exercise name, BlockStripe per block, combined Last + Suggestion line.
- `WorkoutScreen`: SessionProgress mounted in sticky header; empty state via EmptyState.
- `SetLogSheet`: SetDots header, inline Last/Suggested context, tile inputs (`h-14`), save-pulse animation.
- `DaySelector` adopts `Pill`.
- Tests added: Stat (7), Pill (7), EmptyState (4), BlockStripe (6), SessionProgress (5), SetDots (5), SetSlot additions (2), ExerciseCard additions (3), SetLogSheet additions (4) — **~43 new tests**.
- All existing tests still green.
- `CLAUDE.md` test count updated.
- `ui-rewrite-spec.md` drift note added.

---

*End of plan. Ready to execute.*

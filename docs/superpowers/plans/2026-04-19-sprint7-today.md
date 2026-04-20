# Sprint 7 — AppShell + Today ("First Light") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Today screen + AppShell bottom tab bar to the warm-paper visual system. Replace the pre-Sprint-6 inverse-CTA hero card with the handoff's cream-filled hero (eyebrow + serif-italic greeting + streak pill + hero card with muscle chips + Start CTA + day switcher + last-session card). Swap Lucide tab icons for the custom SVG set, add the sage active-indicator pill, and move route transitions from `fade-in-soft` to `fadeInUp`.

**Architecture:** The current `TodayScreen.tsx` (225 lines) composes the hero inline as a raw `<div>` with hardcoded inverse-CTA tokens. Sprint 7 extracts the hero into `TodayHeroCard.tsx`, adds a `StreakPill.tsx` component + two small utility modules (muscle-group derivation, date formatting), deletes `DayPreview.tsx` (role absorbed by the new hero), and rewrites `TodayScreen.tsx` to compose the four sections (eyebrow + greeting / streak pill / hero card + day switcher / last-session) in scroll order. Active session preserves the existing early-return "Resume" card but re-skinned. AppShell tab bar swaps Lucide → custom SVG, uses sage-soft pill as the active indicator.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind 4 (CSS-first), `@base-ui/react`, Vitest + React Testing Library, Playwright, Sprint 6 foundation (warm-paper tokens + `@/shared/icons/*` + reskinned primitives).

**Source spec:** `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 7.

**Baseline:** 532 tests passing on `main` (Sprint 6 merged as `e2985c4`). Sprint 7 forks `sprint-7-today` off `main`.

---

## Resolved open questions (pre-decided for this plan)

Three open questions existed from the spec; pre-decided here to avoid planning-session churn:

1. **Muscle-group chip derivation:** from `Exercise.muscleGroups` (the `string[]` field on the catalog Exercise type, already populated for every shipped exercise). Chips = unique union across every exercise in the selected day's `RoutineDay.entries`, preserved in order-of-first-appearance, capped at 6 for layout safety.
2. **Day-switcher preview:** replace the hero card in place. Tapping A/B/C simply changes which day the hero card renders. No separate preview surface.
3. **Greeting positioning:** order from top is **eyebrow → greeting → streak pill → hero card**. Matches the handoff screenshot layout and puts the decorative serif greeting between the utilitarian eyebrow and the meaningful hero.

Also pre-decided:
- Static greeting string is `"Hello."` (period included, serif italic per spec §6 item 3).
- Day title in hero card is **sans bold** (not serif) — matches `screenshots/1-today.jpg`, confirmed by the "Handoff doc vs. prototype" note in spec §4.
- Active session state keeps the existing simplified Resume-Workout card (early return), just re-skinned — don't fold it into the new full Today layout.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `web/src/features/today/lib/muscleGroups.ts` | Pure function: `deriveDayMuscleGroups(day, exercisesById)` returns `string[]` deduplicated in first-appearance order, capped at 6 |
| `web/src/features/today/lib/formatDate.ts` | Pure function: `formatTodayEyebrow(date)` returns `"SUNDAY · APR 19"` via `Intl.DateTimeFormat` |
| `web/src/features/today/StreakPill.tsx` | Sage-soft pill: Flame icon + `{n} sessions this week`. Returns `null` when `n === 0` |
| `web/src/features/today/TodayHeroCard.tsx` | The main hero `<Card>`: eyebrow + serif-optional day title + muscle chips + exercise line + Start/Resume CTA |
| `web/tests/unit/features/today/lib/muscleGroups.test.ts` | Unit tests for muscle-group derivation |
| `web/tests/unit/features/today/lib/formatDate.test.ts` | Unit tests for date formatting |
| `web/tests/unit/features/today/StreakPill.test.tsx` | Component tests for StreakPill (renders when n > 0, hides when 0, renders count + icon) |
| `web/tests/unit/features/today/TodayHeroCard.test.tsx` | Component tests: renders eyebrow, title, chips, CTA; calls `onStart` on click |

### Modified files

| Path | Change |
|---|---|
| `web/src/features/today/TodayScreen.tsx` | Rewrite: compose eyebrow/greeting/StreakPill/TodayHeroCard/DaySelector/LastSessionCard. Remove inline hero `<div>`. Keep early-return `Resume Workout` card (re-skinned). Remove `DayPreview` import and usage |
| `web/src/features/today/DaySelector.tsx` | Confirm uses Sprint-6 Pill primitive; adjust only if classnames don't match the handoff A/B/C row |
| `web/src/features/today/LastSessionCard.tsx` | Confirm re-tokenises cleanly post-Sprint-6; tweak only if obvious visual debt |
| `web/src/app/App.tsx` | Tab bar reskin: swap Lucide imports → `@/shared/icons` (CalendarDays→Grid, Dumbbell→Dumbbell, History→Graph, Settings→use Grid fallback or keep Lucide for one more sprint). Active indicator → sage-soft pill w/ sage dot. Focus ring `ring-cta/30` → `ring-sage/30`. Nav border `border-t-2 border-border-strong` → `border-t border-line`. `FadeRoute` animation `fade-in-soft` → `fadeInUp` via arbitrary utility. Toaster className modernised |
| `web/src/features/today/DayPreview.tsx` | **Delete** — role absorbed by new hero card |
| `web/tests/unit/features/today/*.test.*` | Update or remove any tests referencing `DayPreview` |

### Out of scope (spec §3 Sprint 7 "Out of scope")

- Starting workouts from a non-today day — day switcher previews only, Start CTA always targets `routine.nextDayId`.
- `displayName` in Settings — no name personalisation.
- `targetTimeMin` in routine YAML — no target-time display on the hero.
- AppShell tab-bar migration to replace every Lucide icon — the custom icon set only covers some of the tabs well (Today → Grid, Workout → Dumbbell, History → Graph). Settings has no clean custom equivalent today, so keep Lucide `Settings` there and swap when a proper cog glyph lands. Sprint 12 does the final Lucide sweep regardless.

---

## Task 0: Branch setup + baseline check

**Files:** none

- [ ] **Step 1: Confirm `main` is at Sprint 6's merge commit**

Run:
```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -2
```
Expected: top commit is `e2985c4 Sprint 6: Warm Paper foundation — tokens, fonts, icons, primitives (#10)` (or its successor if hotfixes landed since).

- [ ] **Step 2: Create the Sprint 7 worktree**

```bash
git worktree add "../exercise_logger-sprint7-today" -b sprint-7-today main
```

Expected: worktree created at `C:/Users/creix/VSC Projects/exercise_logger-sprint7-today` on branch `sprint-7-today`.

- [ ] **Step 3: Install deps in the worktree**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint7-today/web"
npm install --no-audit --no-fund
```

Expected: `added N packages` (≈820). No errors.

- [ ] **Step 4: Run the baseline test suite**

```bash
npx vitest run --reporter=default 2>&1 | tail -6
```
Expected: `Tests  532 passed (532)`. If not, stop and investigate before proceeding — every subsequent task uses 532 as the reference.

- [ ] **Step 5: No commit** — this is orientation.

---

## Task 1: Muscle-group derivation utility

**Files:**
- Create: `web/src/features/today/lib/muscleGroups.ts`
- Create: `web/tests/unit/features/today/lib/muscleGroups.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `web/tests/unit/features/today/lib/muscleGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveDayMuscleGroups } from "@/features/today/lib/muscleGroups";
import type { RoutineDay, Exercise } from "@/domain/types";

function makeExercise(id: string, muscleGroups: string[]): Exercise {
  return {
    id,
    name: id,
    type: "weight",
    equipment: "barbell",
    muscleGroups,
  };
}

function makeDay(entries: RoutineDay["entries"]): RoutineDay {
  return { id: "day-a", label: "Day A", entries };
}

describe("deriveDayMuscleGroups", () => {
  it("returns unique muscle groups in first-appearance order", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", makeExercise("squat", ["Quads", "Glutes"])],
      ["bench", makeExercise("bench", ["Chest", "Triceps"])],
      ["row",   makeExercise("row",   ["Back", "Biceps"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "squat", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "bench", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "3", exerciseId: "row",   instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual([
      "Quads", "Glutes", "Chest", "Triceps", "Back", "Biceps",
    ]);
  });

  it("deduplicates across exercises", () => {
    const exercises = new Map<string, Exercise>([
      ["squat",    makeExercise("squat",    ["Quads", "Glutes"])],
      ["leg-ext",  makeExercise("leg-ext",  ["Quads"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "squat",   instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "leg-ext", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Quads", "Glutes"]);
  });

  it("walks into superset items", () => {
    const exercises = new Map<string, Exercise>([
      ["curl",  makeExercise("curl",  ["Biceps"])],
      ["pushd", makeExercise("pushd", ["Triceps"])],
    ]);
    const day = makeDay([
      {
        kind: "superset",
        groupId: "g1",
        items: [
          { entryId: "1", exerciseId: "curl",  instanceLabel: "", setBlocks: [] },
          { entryId: "2", exerciseId: "pushd", instanceLabel: "", setBlocks: [] },
        ],
      },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Biceps", "Triceps"]);
  });

  it("caps at 6 groups", () => {
    const exercises = new Map<string, Exercise>([
      ["a", makeExercise("a", ["G1", "G2", "G3", "G4"])],
      ["b", makeExercise("b", ["G5", "G6", "G7", "G8"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "a", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "b", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6"]);
  });

  it("skips unknown exercises gracefully", () => {
    const exercises = new Map<string, Exercise>([
      ["known", makeExercise("known", ["Legs"])],
    ]);
    const day = makeDay([
      { kind: "exercise", entryId: "1", exerciseId: "ghost", instanceLabel: "", setBlocks: [] },
      { kind: "exercise", entryId: "2", exerciseId: "known", instanceLabel: "", setBlocks: [] },
    ]);

    expect(deriveDayMuscleGroups(day, exercises)).toEqual(["Legs"]);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
npx vitest run tests/unit/features/today/lib/muscleGroups.test.ts
```
Expected: `FAIL` with `Cannot find module '@/features/today/lib/muscleGroups'`.

- [ ] **Step 3: Implement the function**

Create `web/src/features/today/lib/muscleGroups.ts`:

```ts
import type { Exercise, RoutineDay } from "@/domain/types";

const MAX_CHIPS = 6;

export function deriveDayMuscleGroups(
  day: RoutineDay,
  exercisesById: Map<string, Exercise>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const visit = (exerciseId: string) => {
    const ex = exercisesById.get(exerciseId);
    if (!ex) return;
    for (const group of ex.muscleGroups) {
      if (seen.has(group)) continue;
      seen.add(group);
      ordered.push(group);
      if (ordered.length === MAX_CHIPS) return;
    }
  };

  for (const entry of day.entries) {
    if (ordered.length === MAX_CHIPS) break;
    if (entry.kind === "exercise") {
      visit(entry.exerciseId);
    } else {
      for (const item of entry.items) {
        visit(item.exerciseId);
        if (ordered.length === MAX_CHIPS) break;
      }
    }
  }

  return ordered;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/today/lib/muscleGroups.test.ts
```
Expected: 5 passing.

- [ ] **Step 5: Run full suite to confirm no regression**

```bash
npm test
```
Expected: `Tests  537 passed (537)` (532 baseline + 5 new).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/lib/muscleGroups.ts \
        web/tests/unit/features/today/lib/muscleGroups.test.ts
git commit -m "feat(today): add muscle-group derivation util for hero card chips"
```

---

## Task 2: Today eyebrow date formatter

**Files:**
- Create: `web/src/features/today/lib/formatDate.ts`
- Create: `web/tests/unit/features/today/lib/formatDate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/today/lib/formatDate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatTodayEyebrow } from "@/features/today/lib/formatDate";

describe("formatTodayEyebrow", () => {
  it("formats a Sunday in April as 'SUNDAY · APR 19'", () => {
    const date = new Date(2026, 3, 19); // April is month 3 (0-indexed)
    expect(formatTodayEyebrow(date)).toBe("SUNDAY · APR 19");
  });

  it("formats a Monday in January as 'MONDAY · JAN 5'", () => {
    const date = new Date(2026, 0, 5);
    expect(formatTodayEyebrow(date)).toBe("MONDAY · JAN 5");
  });

  it("formats a Friday in December as 'FRIDAY · DEC 31'", () => {
    const date = new Date(2027, 11, 31);
    expect(formatTodayEyebrow(date)).toBe("FRIDAY · DEC 31");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/today/lib/formatDate.test.ts
```
Expected: `FAIL` with `Cannot find module '@/features/today/lib/formatDate'`.

- [ ] **Step 3: Implement**

Create `web/src/features/today/lib/formatDate.ts`:

```ts
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

export function formatTodayEyebrow(date: Date): string {
  const weekday = WEEKDAY.format(date).toUpperCase();
  const month = MONTH.format(date).toUpperCase();
  const day = date.getDate();
  return `${weekday} · ${month} ${day}`;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/today/lib/formatDate.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 540 pass (537 + 3).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/lib/formatDate.ts \
        web/tests/unit/features/today/lib/formatDate.test.ts
git commit -m "feat(today): add SUNDAY · APR 19 eyebrow date formatter"
```

---

## Task 3: StreakPill component

**Files:**
- Create: `web/src/features/today/StreakPill.tsx`
- Create: `web/tests/unit/features/today/StreakPill.test.tsx`

Signature:

```tsx
<StreakPill count={3} />
```

Renders: `🔥 3 sessions this week` styled as sage-soft pill (background `bg-sage-soft`, text `text-sage-deep`, 999px radius). Uses the `Flame` icon from `@/shared/icons`. Returns `null` when `count` is `0` or negative.

- [ ] **Step 1: Write failing tests**

Create `web/tests/unit/features/today/StreakPill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakPill } from "@/features/today/StreakPill";

describe("StreakPill", () => {
  it("renders session count and copy when count > 0", () => {
    render(<StreakPill count={3} />);
    expect(screen.getByText(/3 sessions this week/i)).not.toBeNull();
  });

  it("renders nothing when count is 0", () => {
    const { container } = render(<StreakPill count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative", () => {
    const { container } = render(<StreakPill count={-1} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies sage-soft palette classes", () => {
    const { container } = render(<StreakPill count={2} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-sage-soft/);
    expect(el.className).toMatch(/text-sage-deep/);
    expect(el.className).toMatch(/rounded-\[var\(--radius-pill\)\]/);
  });

  it("renders the Flame icon", () => {
    const { container } = render(<StreakPill count={1} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/today/StreakPill.test.tsx
```
Expected: `FAIL` with `Cannot find module '@/features/today/StreakPill'`.

- [ ] **Step 3: Implement**

Create `web/src/features/today/StreakPill.tsx`:

```tsx
import { Flame } from "@/shared/icons";

interface StreakPillProps {
  count: number;
}

export function StreakPill({ count }: StreakPillProps) {
  if (count <= 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-sage-soft text-sage-deep px-3 py-1 text-xs font-medium"
      role="status"
      aria-label={`${count} ${count === 1 ? "session" : "sessions"} this week`}
    >
      <Flame size={13} />
      <span>
        {count} {count === 1 ? "session" : "sessions"} this week
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/today/StreakPill.test.tsx
```
Expected: 5 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 545 pass (540 + 5).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/StreakPill.tsx \
        web/tests/unit/features/today/StreakPill.test.tsx
git commit -m "feat(today): add StreakPill component (sage-soft flame + session count)"
```

---

## Task 4: TodayHeroCard component

**Files:**
- Create: `web/src/features/today/TodayHeroCard.tsx`
- Create: `web/tests/unit/features/today/TodayHeroCard.test.tsx`

Signature:

```tsx
<TodayHeroCard
  dayLabelEyebrow="TODAY · DAY A"
  dayTitle="Heavy Squat + Horizontal Push/Pull"
  muscleGroups={["Quads", "Chest", "Back"]}
  exerciseCount={7}
  setCount={18}
  firstExerciseName="Barbell Back Squat"
  ctaLabel="▶ Start workout"
  onCtaClick={() => ...}
  ctaDisabled={false}
  resumeMeta={null /* or { elapsedMin: 34 } for resume state */}
/>
```

The component is a skin-only container — it renders the passed props. All state lives in `TodayScreen`, which decides eyebrow text, CTA label, and whether to show resume meta.

- [ ] **Step 1: Write failing tests**

Create `web/tests/unit/features/today/TodayHeroCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayHeroCard } from "@/features/today/TodayHeroCard";

const baseProps = {
  dayLabelEyebrow: "TODAY · DAY A",
  dayTitle: "Heavy Squat + Horizontal Push/Pull",
  muscleGroups: ["Quads", "Chest", "Back"],
  exerciseCount: 7,
  setCount: 18,
  firstExerciseName: "Barbell Back Squat",
  ctaLabel: "▶ Start workout",
  onCtaClick: vi.fn(),
  ctaDisabled: false,
  resumeMeta: null,
};

describe("TodayHeroCard", () => {
  it("renders eyebrow, title, muscle chips, exercise line, CTA", () => {
    render(<TodayHeroCard {...baseProps} />);
    expect(screen.getByText("TODAY · DAY A")).not.toBeNull();
    expect(screen.getByText(/Heavy Squat/)).not.toBeNull();
    expect(screen.getByText("Quads")).not.toBeNull();
    expect(screen.getByText("Chest")).not.toBeNull();
    expect(screen.getByText(/7 exercises · 18 sets · first up: Barbell Back Squat/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Start workout/i })).not.toBeNull();
  });

  it("calls onCtaClick when the CTA is clicked", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<TodayHeroCard {...baseProps} onCtaClick={spy} />);
    await user.click(screen.getByRole("button", { name: /Start workout/i }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("renders resume meta when resumeMeta is provided", () => {
    render(<TodayHeroCard {...baseProps} ctaLabel="Resume workout" resumeMeta={{ elapsedMin: 34 }} />);
    expect(screen.getByText(/34 min/)).not.toBeNull();
  });

  it("does not render resume meta when resumeMeta is null", () => {
    render(<TodayHeroCard {...baseProps} resumeMeta={null} />);
    expect(screen.queryByText(/min/)).toBeNull();
  });

  it("renders no muscle-chip row when muscleGroups is empty", () => {
    render(<TodayHeroCard {...baseProps} muscleGroups={[]} />);
    expect(screen.queryByText("Quads")).toBeNull();
  });

  it("omits the `first up` segment when firstExerciseName is null", () => {
    render(<TodayHeroCard {...baseProps} firstExerciseName={null} />);
    expect(screen.getByText(/7 exercises · 18 sets/)).not.toBeNull();
    expect(screen.queryByText(/first up/)).toBeNull();
  });

  it("disables the CTA when ctaDisabled is true", () => {
    render(<TodayHeroCard {...baseProps} ctaDisabled={true} />);
    const btn = screen.getByRole("button", { name: /Start workout/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/today/TodayHeroCard.test.tsx
```
Expected: `FAIL` with `Cannot find module '@/features/today/TodayHeroCard'`.

- [ ] **Step 3: Implement**

Create `web/src/features/today/TodayHeroCard.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

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
  resumeMeta: { elapsedMin: number } | null;
}

export function TodayHeroCard({
  dayLabelEyebrow,
  dayTitle,
  muscleGroups,
  exerciseCount,
  setCount,
  firstExerciseName,
  ctaLabel,
  onCtaClick,
  ctaDisabled,
  resumeMeta,
}: TodayHeroCardProps) {
  const exerciseCopy = [
    `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${setCount} ${setCount === 1 ? "set" : "sets"}`,
    firstExerciseName ? `first up: ${firstExerciseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardContent className="space-y-4 px-5 pb-5 pt-4">
        <p className="text-eyebrow text-ink-3">{dayLabelEyebrow}</p>

        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {dayTitle}
        </h2>

        {muscleGroups.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Muscle groups">
            {muscleGroups.map((group) => (
              <li
                key={group}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {group}
              </li>
            ))}
          </ul>
        )}

        <p className="text-meta">{exerciseCopy}</p>

        <Button
          variant="default"
          size="lg"
          className="w-full"
          onClick={onCtaClick}
          disabled={ctaDisabled}
        >
          {ctaLabel}
        </Button>

        {resumeMeta && (
          <p className="flex items-center justify-center gap-1.5 text-meta">
            <span
              aria-hidden="true"
              className="inline-block size-1.5 rounded-full bg-sage"
            />
            {resumeMeta.elapsedMin} min elapsed
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/today/TodayHeroCard.test.tsx
```
Expected: 7 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 552 pass (545 + 7).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/TodayHeroCard.tsx \
        web/tests/unit/features/today/TodayHeroCard.test.tsx
git commit -m "feat(today): add TodayHeroCard component (eyebrow + title + chips + CTA)"
```

---

## Task 5: Rewrite TodayScreen to the new layout

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`
- **Delete:** `web/src/features/today/DayPreview.tsx`
- Any test file that imports `DayPreview` — adjust or delete

- [ ] **Step 1: Check for existing DayPreview test coverage**

```bash
grep -rn "DayPreview" web/tests web/src --include="*.tsx" --include="*.ts"
```

If any test imports `DayPreview`, record the file paths. They'll need updating or deletion in this task.

- [ ] **Step 2: Rewrite `TodayScreen.tsx`**

Open `web/src/features/today/TodayScreen.tsx` and replace the entire file contents with:

```tsx
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck } from "lucide-react";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { useTrainingCadence } from "@/shared/hooks/useTrainingCadence";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/components/EmptyState";
import { StreakPill } from "./StreakPill";
import { TodayHeroCard } from "./TodayHeroCard";
import { DaySelector } from "./DaySelector";
import { LastSessionCard } from "./LastSessionCard";
import { deriveDayMuscleGroups } from "./lib/muscleGroups";
import { formatTodayEyebrow } from "./lib/formatDate";
import type { RoutineDay } from "@/domain/types";

function firstExerciseFromDay(
  day: RoutineDay,
  exerciseNames: Map<string, string>,
): string | null {
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      return exerciseNames.get(entry.exerciseId) ?? entry.exerciseId;
    }
    const first = entry.items[0];
    if (first) return exerciseNames.get(first.exerciseId) ?? first.exerciseId;
  }
  return null;
}

function countSets(day: RoutineDay): number {
  let total = 0;
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      total += entry.setBlocks.reduce((s, b) => s + b.count, 0);
    } else {
      for (const item of entry.items) {
        total += item.setBlocks.reduce((s, b) => s + b.count, 0);
      }
    }
  }
  return total;
}

function countExercises(day: RoutineDay): number {
  return day.entries.reduce(
    (n, e) => n + (e.kind === "exercise" ? 1 : e.items.length),
    0,
  );
}

export default function TodayScreen() {
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const lastSession = useLastSession(settings?.activeRoutineId);
  const cadence = useTrainingCadence();
  const navigate = useNavigate();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exercisesById = useMemo(() => {
    const m = new Map<string, import("@/domain/types").Exercise>();
    if (exercises) for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);
  const exerciseNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, ex] of exercisesById) m.set(id, ex.name);
    return m;
  }, [exercisesById]);

  // Live elapsed time for active session
  const [elapsed, setElapsed] = useState(() =>
    activeSession
      ? Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000)
      : 0,
  );
  useEffect(() => {
    if (!activeSession) return;
    setElapsed(Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000));
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000));
    }, 60_000);
    return () => clearInterval(id);
  }, [activeSession]);

  if (!settings) return null;

  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <EmptyState
        icon={CalendarCheck}
        heading="No active routine"
        body="Import a routine in Settings to get started."
        action={{ label: "Go to Settings", onClick: () => navigate("/settings") }}
      />
    );
  }

  if (routine === undefined) return null;

  // State C: Active session — minimal Resume card.
  if (activeSession) {
    return (
      <div className="p-5 space-y-5">
        <Link to="/workout" className="block">
          <Card className="border border-sage bg-sage-soft/50 hover:bg-sage-soft transition-colors">
            <CardContent className="space-y-1 p-5">
              <p className="text-eyebrow text-sage-deep">In progress</p>
              <h2 className="font-heading text-xl font-bold tracking-tight">
                Resume workout
              </h2>
              <p className="text-meta flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 rounded-full bg-sage"
                />
                {elapsed} min · {activeSession.session.dayLabelSnapshot}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  }

  // State B: Normal — routine active, no session.
  const selectedId = selectedDayId ?? routine.nextDayId ?? routine.dayOrder[0]!;
  const selectedDay = routine.days[selectedId];
  const isToday = selectedId === (routine.nextDayId ?? routine.dayOrder[0]!);

  async function handleStart() {
    if (!isToday) return; // Day switcher previews only — Start targets nextDayId.
    setStarting(true);
    try {
      await startSessionWithCatalog(db, routine!, selectedId);
      navigate("/workout");
    } finally {
      setStarting(false);
    }
  }

  const muscleGroups = selectedDay ? deriveDayMuscleGroups(selectedDay, exercisesById) : [];
  const exerciseCount = selectedDay ? countExercises(selectedDay) : 0;
  const setCount = selectedDay ? countSets(selectedDay) : 0;
  const firstExerciseName = selectedDay ? firstExerciseFromDay(selectedDay, exerciseNames) : null;
  const dayTitle = selectedDay?.label ?? selectedId;
  const eyebrow = isToday ? `TODAY · DAY ${selectedId.toUpperCase()}` : `DAY ${selectedId.toUpperCase()} · PREVIEW`;
  const streakCount = cadence?.sessionsLast7Days ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <p className="text-eyebrow text-ink-3">{formatTodayEyebrow(new Date())}</p>

        <h1 className="text-hero-serif italic text-foreground">Hello.</h1>

        <StreakPill count={streakCount} />

        <TodayHeroCard
          dayLabelEyebrow={eyebrow}
          dayTitle={dayTitle}
          muscleGroups={muscleGroups}
          exerciseCount={exerciseCount}
          setCount={setCount}
          firstExerciseName={firstExerciseName}
          ctaLabel={isToday ? "▶ Start workout" : "Switch to today to start"}
          onCtaClick={handleStart}
          ctaDisabled={starting || !isToday}
          resumeMeta={null}
        />

        <div className="space-y-3 pt-2">
          <p className="text-eyebrow text-ink-3">Switch day</p>
          <DaySelector
            routine={routine}
            selectedDayId={selectedId}
            onSelectDay={setSelectedDayId}
          />
        </div>

        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}
      </div>
    </div>
  );
}
```

> **Hook behaviour preserved.** The `useTrainingCadence` hook still drives the streak; the `useActiveSession` hook still gates the Resume state; the `useRoutine` / `useSettings` / `useLastSession` hooks are unchanged. Day selection state still lives in `useState`, and `selectedDayId` still falls back to `routine.nextDayId`.

- [ ] **Step 3: Delete `DayPreview.tsx` + any test that imports it**

```bash
rm web/src/features/today/DayPreview.tsx
```

If Step 1's grep found any `DayPreview` tests, delete those files too. (If the grep returned only the import from `TodayScreen.tsx`, which we've already removed, no test cleanup is needed.)

- [ ] **Step 4: Typecheck**

```bash
npx tsc -b
```
Expected: clean. If not, the `import type { Exercise }` inline in `TodayScreen.tsx` or any import path may be wrong — fix in place.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 552 pass (no new tests; no old tests affected unless the DayPreview test file was removed, in which case the count drops by whatever the deleted suite had). Update test assertions if any feature/today test referenced the old inline hero `<div className="border-2 border-border-strong bg-primary ...">`.

- [ ] **Step 6: Visual smoke**

```bash
npm run dev
```
Open `http://localhost:5173/exercise-logger/`. Confirm for the three Today states:
- No routine → EmptyState (serif heading, "Go to Settings" button).
- No active session → eyebrow "SUNDAY · APR …", italic serif "Hello.", streak pill (if any sessions), hero card with eyebrow + sans bold title + muscle chips + exercise line + Start button.
- Active session → minimal resume card with sage ring + sage dot + elapsed minutes.

Close the dev server.

- [ ] **Step 7: Commit**

```bash
git add web/src/features/today/TodayScreen.tsx
git rm web/src/features/today/DayPreview.tsx
# plus any test files touched
git commit -m "feat(today): rewrite TodayScreen to warm-paper layout; delete DayPreview"
```

---

## Task 6: Reskin AppShell bottom tab bar

**Files:** Modify: `web/src/app/App.tsx`

- [ ] **Step 1: Swap Lucide imports for custom icons where we have equivalents**

At the top of `web/src/app/App.tsx`:

```tsx
// Before
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";

// After
import { Settings } from "lucide-react";
import { Grid, Dumbbell, Graph } from "@/shared/icons";
```

Then adjust the `tabs` array (around line 28):

```tsx
const tabs = [
  { to: "/", label: "Today", icon: Grid },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: Graph },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
```

> **Settings keeps Lucide.** Our custom set doesn't ship a cog glyph. Sprint 12's final Lucide sweep can add one; for now, `Settings` from Lucide is fine.

- [ ] **Step 2: Reskin the `<nav>` border + the NavLink active state**

In `web/src/app/App.tsx`, replace the `<nav>` element inside `Shell()` with:

```tsx
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
                    {...("strokeWidth" in Icon ? {} : { strokeWidth: isActive ? 2.5 : 2 })}
                  />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
```

Key changes:
- `border-t-2 border-border-strong` → `border-t border-line` (hairline).
- Active fill `bg-primary` → `bg-sage-soft` pill (inset-x-1 inset-y-0.5) for a softer indicator.
- Active text `text-primary-foreground` → `text-sage-deep`.
- Focus ring `ring-cta/30` → `ring-sage/40`.
- Idle text `text-muted-foreground` → `text-ink-3`.

The `strokeWidth` conditional handles the mixed icon-library shape: custom `@/shared/icons` icons already handle their own stroke widths, while Lucide's `Settings` accepts `strokeWidth`. The conditional spread avoids passing `strokeWidth` to the custom icons that would ignore it.

> **Simpler alternative:** just always pass `strokeWidth={isActive ? 2.5 : 2}`. Custom icons accept the prop (per Task 5's `IconSvg` hardening in Sprint 6) but the default is what the icon already specifies; passing `2.5` when active will override it globally. If that over-thickens custom icons, revert to the conditional spread.

Use the always-pass version for consistency:

```tsx
                  <Icon
                    className="relative z-10 h-5 w-5"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```
Expected: clean.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 552 pass. If any test asserts tab-bar classNames, update for the new tokens.

- [ ] **Step 5: Visual smoke**

```bash
npm run dev
```
Walk through all 4 tabs. Verify:
- Border between content and tab bar is a thin hairline, not a thick accent.
- Active tab has a sage-soft pill behind the icon+label, sage-deep text.
- Inactive tabs are ink-3 color; hover lifts to foreground ink.
- Focus ring is sage on keyboard Tab.
- Icons: Today = grid, Workout = dumbbell, History = clock+arrow (Graph), Settings = cog (Lucide).

- [ ] **Step 6: Commit**

```bash
git add web/src/app/App.tsx
git commit -m "feat(shell): reskin bottom tab bar — custom icons, sage-soft active pill, hairline border"
```

---

## Task 7: Route transitions + Toaster cleanup

**Files:** Modify: `web/src/app/App.tsx` (same file, separate concern)

- [ ] **Step 1: Swap the route transition animation**

In `App.tsx`, find the `FadeRoute` component (around line 47):

```tsx
// Before
function FadeRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="fade-in-soft h-full">
      {children}
    </div>
  );
}

// After
function FadeRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      className="h-full animate-[fadeInUp_var(--dur-fadeInUp)_var(--ease-handoff)]"
    >
      {children}
    </div>
  );
}
```

The `@keyframes fadeInUp` (added in Sprint 6 Task 4) plays opacity 0→1 + translateY 8px→0 over `--dur-fadeInUp` (300ms). Reduced-motion override in App.css collapses it to fade-only.

- [ ] **Step 2: Clean up the Toaster className**

In `App()` (around line 150):

```tsx
// Before
<Toaster
  position="top-center"
  richColors
  closeButton
  duration={3000}
  toastOptions={{
    className: "!rounded !border-[1.5px] !border-border-strong !shadow-sm font-sans",
  }}
/>

// After
<Toaster
  position="top-center"
  richColors
  closeButton
  duration={3000}
  toastOptions={{
    className: "!rounded-[var(--radius-card)] !border !border-line font-sans",
  }}
/>
```

Drops the thick border + shadow + sharp radius. Matches the rest of the reskinned primitives.

- [ ] **Step 3: Typecheck + tests + lint**

```bash
npx tsc -b && npm test && npm run lint
```
Expected: clean, 552 pass.

- [ ] **Step 4: Visual smoke**

```bash
npm run dev
```
Navigate between Today / Workout / History / Settings — each transition should be a 300ms fade+slide-up of 8px, not the previous 2px micro-lift. Trigger a toast (e.g. an invalid YAML import) — the toast should render with 18px radius and hairline border.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/App.tsx
git commit -m "feat(shell): route fadeInUp transition + toaster warm-paper tokens"
```

---

## Task 8: DaySelector + LastSessionCard verification pass

**Files:**
- Modify (only if needed): `web/src/features/today/DaySelector.tsx`
- Modify (only if needed): `web/src/features/today/LastSessionCard.tsx`

These components exist and should already inherit most of the Sprint-6 warm-paper palette via the legacy token re-points. This task is a quick verification + minor adjustment if either looks visually out of place on Today.

- [ ] **Step 1: Visual check**

With `npm run dev` running, look at:
- `DaySelector` (A/B/C pill row on Today). Expect: `Pill` primitive renders at 999px radius, selected has sage-soft fill + sage-deep text (per Sprint 6 reskin).
- `LastSessionCard` (below day switcher on Today, renders when `lastSession` exists). Expect: warm-paper `<Card>` with 18px radius, hairline border, ink text.

- [ ] **Step 2: If DaySelector renders correctly**

No changes. If it uses a custom inline div (not `Pill`), patch it to use `@/shared/components/Pill`. Otherwise skip.

- [ ] **Step 3: If LastSessionCard renders correctly**

No changes. If it still has `border-t-2 border-border-strong` or other Sprint-4 legacy tokens, swap them for `border border-line` and `bg-card` as appropriate.

- [ ] **Step 4: Run tests + build**

```bash
npm test && npm run build
```
Expected: 552 pass, build clean.

- [ ] **Step 5: Commit (only if any change was made)**

```bash
git add web/src/features/today/DaySelector.tsx web/src/features/today/LastSessionCard.tsx
git commit -m "refactor(today): align DaySelector / LastSessionCard with warm-paper tokens"
```

If both components already rendered correctly, skip the commit — no empty commits.

---

## Task 9: Full verification + PR

**Files:** none — verification only.

- [ ] **Step 1: Full unit test suite**

```bash
npm test
```
Expected: `Tests  552 passed (552)` (532 baseline + 5 muscleGroups + 3 formatDate + 5 StreakPill + 7 TodayHeroCard = 552).

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: clean, bundle includes Inter + Instrument Serif (unchanged from Sprint 6).

- [ ] **Step 4: E2E**

```bash
npm run test:e2e
```
Expected: clean. If the handoff-layout change moves any e2e selector (e.g. the test clicks "Start Workout" on Today), update the test to match the new CTA label `▶ Start workout` (note the leading play glyph) in the same commit.

- [ ] **Step 5: Manual smoke on preview**

```bash
npm run preview
```

DevTools → Device toolbar → iPhone 14. Confirm:

| Screen | Expected |
|---|---|
| Today (empty routine) | EmptyState serif heading "No active routine", Go to Settings button |
| Today (normal) | "SUNDAY · APR 20" eyebrow, italic serif "Hello.", streak pill (if sessions), hero card with sans-bold day title, muscle chips, exercise line, Start button, day switcher, last-session card |
| Today (non-today switcher tap) | Hero card eyebrow changes to "DAY B · PREVIEW", CTA disables to "Switch to today to start" |
| Today (active session) | Resume card only — sage-ring border, sage dot + elapsed time |
| Workout / History / Settings | Transition from Today plays 8px fadeInUp, not 2px micro-lift |
| Tab bar | Hairline top border, sage-soft pill under active tab with sage-deep text, other tabs ink-3 |

- [ ] **Step 6: Diff the branch**

```bash
git log --oneline main..HEAD
git diff main --stat
```
Expected: ~9 commits, ~12 files touched (4 new components/utils + their tests, 1 deleted DayPreview, modified TodayScreen + App.tsx, possibly DaySelector/LastSessionCard).

- [ ] **Step 7: Push the branch**

```bash
git push -u origin sprint-7-today
```

- [ ] **Step 8: Open the PR**

```bash
gh pr create --title "Sprint 7: First Light — Today screen + AppShell tab bar" --body "$(cat <<'EOF'
## Summary
Port the Today screen and AppShell tab bar to the warm-paper visual system per spec §3 Sprint 7. Replaces the pre-Sprint-6 inverse-CTA hero with the handoff's cream hero card (eyebrow + serif-italic greeting + streak pill + muscle chips + Start CTA). Adds sage-soft active indicator on the tab bar and `fadeInUp` route transitions.

- **Today** — `TodayScreen.tsx` rewrite: eyebrow ("SUNDAY · APR 20") + italic serif "Hello." + `StreakPill` + `TodayHeroCard` + day switcher + `LastSessionCard`. Active-session state keeps the simplified Resume card (reskinned sage). Day switcher previews non-today days in place; Start is scoped to `routine.nextDayId`.
- **New components** — `TodayHeroCard`, `StreakPill`. New utility modules — `lib/muscleGroups.ts` (derive chips from `Exercise.muscleGroups`) and `lib/formatDate.ts` (`Intl.DateTimeFormat` eyebrow).
- **Deleted** — `DayPreview.tsx` (role absorbed by the hero card).
- **AppShell** — tab bar swaps Lucide → custom `@/shared/icons` where equivalents exist (Today/Workout/History); Settings retains Lucide until Sprint 12. Active indicator is a sage-soft pill; hairline `border-t border-line` replaces the thick accent; focus ring is sage.
- **Route transitions** — `FadeRoute` swaps `.fade-in-soft` (2px, 180ms) for `@keyframes fadeInUp` (8px, 300ms) matching the handoff motion spec.
- **Toaster** — className modernised to `rounded-[var(--radius-card)] border border-line`.

See `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 7 and the pre-decided answers at the top of `docs/superpowers/plans/2026-04-19-sprint7-today.md`.

## Test plan
- [x] `npm test` — 552 pass (532 baseline + 20 new unit tests across muscleGroups/formatDate/StreakPill/TodayHeroCard)
- [x] `npm run lint` — clean
- [x] `npm run build` — clean
- [x] `npm run test:e2e` — clean (or note baseline updates)
- [ ] Manual phone-viewport walk: Today (empty / normal / non-today preview / active session), tab transitions, tab bar active indicator
- [ ] Screen-reader: streak pill announces "{n} sessions this week" via aria-label; hero card CTA labelled correctly

## Notes
- Static greeting is "Hello." — no name personalisation (spec §6 item 3). Can be tuned live.
- Day title is sans bold, NOT serif — matches the handoff screenshots; the prose in `Design Handoff.md` §2.1 that says "serif day title" is superseded by the screenshots (see spec §4 "Handoff doc vs. prototype").
- Muscle chips are capped at 6 to keep the row on one or two lines at 390px.
- Non-today day switcher previews the hero card but disables Start — aligns with spec's "Out of scope: starting workouts from a non-today day".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL in output. Report it back to the user.

---

## Self-Review

**1. Spec coverage.** Sprint 7 spec §3 scope bullets mapped to tasks:

| Spec bullet | Covered by |
|---|---|
| AppShell polish: safe-area padding | Already in App.tsx via `pb-[env(safe-area-inset-bottom)]` — unchanged |
| Bottom tab bar: new icon set, active indicator (sage dot + pill), press feedback | Task 6 |
| Route transitions → fadeInUp 300ms | Task 7 |
| Today: warm eyebrow | Task 2 util + Task 5 integration |
| Today: serif-italic static greeting ("Hello") | Task 5 (`<h1 class="text-hero-serif italic">Hello.</h1>`) |
| Today: streak pill (conditional) | Tasks 3, 5 |
| Today: hero card (eyebrow, no target time, day title, muscle chips, exercise count + first up, ink Start CTA) | Tasks 1, 4, 5 |
| Today: resume state CTA swap + sage dot + elapsed | Task 5 (simplified resume card, preserved semantics) |
| Today: day switcher A/B/C, tap = preview, not start | Task 5 (selectedDayId state + disabled CTA on non-today) |
| Today: last-session summary card | Task 5 retains `LastSessionCard` |
| Out of scope: starting non-today day, displayName, targetTimeMin | Enforced by Task 5 (ctaDisabled + no YAML/Settings changes) |

All covered.

**2. Placeholder scan.** No "TBD", "implement later", "add validation", "similar to Task N" etc. Every code block has the actual code. One conditional section in Task 8 ("if DaySelector renders correctly") is not a placeholder — it's an explicit "verify first, skip if OK" instruction with a concrete no-change outcome.

**3. Type consistency.** `TodayHeroCard` props interface defined in Task 4 is consumed verbatim in Task 5. `deriveDayMuscleGroups(day, exercisesById)` signature matches between Task 1 definition and Task 5 usage. `formatTodayEyebrow(date)` same. The `resumeMeta: { elapsedMin: number } | null` shape appears only in `TodayHeroCard` — Task 5 never passes `resumeMeta`, so the prop is effectively unused for the normal layout (it's there for future unification of the active-session path, which Task 5 currently handles via the early-return Resume card).

One intentional note: Task 5 keeps the Resume state as an early-return `<Link>` with a simple `<Card>` rather than routing through `TodayHeroCard` with `resumeMeta`. This is simpler than the alternative (reuse TodayHeroCard + pass custom CTA props for Resume), and matches the spec's description that "Resume state swaps the CTA". The `resumeMeta` prop on `TodayHeroCard` is scaffolded for a later sprint that might unify the two paths; it stays untested beyond the one "renders resume meta" case in Task 4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-sprint7-today.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for the 9-task length of this plan where each task is self-contained.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

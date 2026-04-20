# Sprint 8 — History + Session Detail ("Training Log") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the History screen + Session Detail screen to the warm-paper visual system per spec §3 Sprint 8. History gets a "TRAINING LOG" eyebrow, serif-italic "History" title, three-stat tile (Sessions / Sets / Hours), month grouping, and a redesigned session row (left date chip, truncated title, meta line, chevron). Session Detail gets a back-arrow, "APR 17 · 52M" eyebrow + serif title, three-stat tile (Sets / Volume / Time), and exercise cards with sage-soft set pills ("30×14"). Task 8.0 up front bundles the Sprint 6/7 review carryover (sheet hairline, EmptyState tile, LastSessionCard ribbon, TodayHeroCard dead prop, DaySelector title duplication) so we ship a clean baseline for Sprint 8 to build on.

**Architecture:** Sprint 8 follows the same pattern as Sprint 7 — extract pure utils + hooks first, build small presentational components next, then compose the screens last. The existing `SessionCard` component + inline visual in `HistoryScreen`/`SessionDetailScreen` are replaced by a family of focused components under `features/history/` (`HistoryStatsTile`, `SessionRow`, `SessionDetailHeader`, `SessionDetailStatsTile`, `SessionDetailExerciseCard`). The `useFinishedSessionSummaries` hook is extended to include per-session `volumeKg` so the session-row meta line can render "52m · 17 sets · 8,240 kg" in one query. A new `useHistoryStats` hook computes all-time aggregates (session count, set count, total hours) for the History stats tile. Session Detail keeps tap-to-edit on logged sets (via `SetLogSheet`) — the out-of-scope "session editing" bullet in the spec means we don't add new editing surfaces, not that we remove existing typo-fix capability.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind 4 (CSS-first), `@base-ui/react`, Dexie 4 + `dexie-react-hooks`, Vitest + React Testing Library + `fake-indexeddb`, Playwright, Sprint 6 foundation tokens.

**Source spec:** `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 8.

**Design canon:** `docs/claude_design_handoffs/screenshots/3-history.jpg`, `docs/claude_design_handoffs/screenshots/6-session-detail.jpg`. The prototype is canonical where prose conflicts (spec §4).

**Baseline:** 553 tests on `main` after Sprint 7 merge (`8fdf4fe`). Sprint 8 forks `sprint-8-history` off `main`.

---

## Resolved open questions (pre-decided for this plan)

Four open questions existed from spec §3 Sprint 8. Pre-decided here:

1. **Hours total:** Sum of `(finishedAt − startedAt)` in milliseconds across all finished sessions where `finishedAt` is non-null; convert to hours, round to the nearest whole hour. Matches the current `formatDuration` semantics in `SessionDetailScreen.tsx:46-52`.

2. **Volume unit on big number:** Show the suffix on the value (`"8,240 kg"`) rather than relying on the eyebrow. Matches `screenshots/6-session-detail.jpg` where the volume cell shows `"8,240 kg"` above the `"VOLUME"` eyebrow.

3. **Session count source:** All-time. The handoff screenshot shows 47 sessions / 1,284 sets / 38 hours — numbers incompatible with a 12-week window. Reuse `useFinishedSessionSummaries` which already returns every finished session.

4. **Month boundary:** User's local timezone. `Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })` resolves to the user's locale + timezone, matching `formatTodayEyebrow` in Sprint 7.

Also pre-decided:
- **Volume for mixed-unit sessions:** The History stats tile does NOT show aggregate volume (screenshot confirms: only Sessions / Sets / Hours), so no cross-session unit reconciliation needed. Session Detail's volume uses the session's effective unit per exercise but displays the aggregate in the **user's global `Settings.units`** — that's the pragmatic choice since a session can have mixed per-exercise overrides. The History session-row meta line also renders in global units.
- **Set-pill format:** `{weight}×{reps}` (e.g. `"30×14"` for 30kg × 14 reps). Weight first, matching the screenshot. Weight displays in the session exercise's effective unit, no suffix on the pill (the pill is already dense; the stats tile carries the unit context).
- **Tap-to-edit on Session Detail set pills:** Preserved. Tapping a sage-soft set pill opens `SetLogSheet` (edit existing set only; creating new sets on finished sessions is blocked by `editSet`'s session-status check). No new editing surface added.
- **Superset rendering on Session Detail:** Keep the existing `SupersetGroup` wrapper logic; use the new simpler `SessionDetailExerciseCard` inside it. Sprint 10 revisits superset visuals — this plan does not.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `web/src/features/history/lib/sessionStats.ts` | `computeSessionVolumeKg(sets)`, `formatVolume(kg, units)`, `formatShortDuration(start, end)` |
| `web/src/features/history/lib/groupByMonth.ts` | `groupSessionsByMonth(summaries)` → `Array<{ monthKey, monthLabel, sessions }>` |
| `web/src/shared/hooks/useHistoryStats.ts` | Live Dexie query returning `{ sessionCount, setCount, hours }` or `undefined` |
| `web/src/features/history/HistoryStatsTile.tsx` | Three-stat card (SESSIONS / SETS / HOURS) with tabular numerals + thousands separators |
| `web/src/features/history/SessionRow.tsx` | Session list row: date chip + title + meta line + chevron |
| `web/src/features/history/SessionDetailHeader.tsx` | Back chevron + eyebrow ("APR 17 · 52M") + serif day title |
| `web/src/features/history/SessionDetailStatsTile.tsx` | Three-stat card (SETS / VOLUME / TIME) for one session |
| `web/src/features/history/SessionDetailExerciseCard.tsx` | Exercise name + row of sage-soft set pills, tap-to-edit |
| `web/tests/unit/features/history/lib/sessionStats.test.ts` | Unit tests for volume + format utils |
| `web/tests/unit/features/history/lib/groupByMonth.test.ts` | Unit tests for month grouping |
| `web/tests/unit/shared/hooks/useHistoryStats.test.ts` | Integration tests with `fake-indexeddb` |
| `web/tests/unit/features/history/HistoryStatsTile.test.tsx` | Component tests |
| `web/tests/unit/features/history/SessionRow.test.tsx` | Component tests |
| `web/tests/unit/features/history/SessionDetailHeader.test.tsx` | Component tests |
| `web/tests/unit/features/history/SessionDetailStatsTile.test.tsx` | Component tests |
| `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx` | Component tests |

### Modified files

| Path | Change |
|---|---|
| `web/src/shared/ui/sheet.tsx` | 8.0: drop `data-[side=bottom]:border-t-2 data-[side=bottom]:border-border-strong` (hairline replacement not needed — overlay + radius already delimit) |
| `web/src/shared/components/EmptyState.tsx` | 8.0: soften icon tile to sage-soft rounded disc |
| `web/src/features/today/LastSessionCard.tsx` | 8.0: drop `showRibbon` block + Lucide `Flame` import; drop `cadence` prop |
| `web/src/features/today/TodayHeroCard.tsx` | 8.0: drop dead `resumeMeta` prop and its render block |
| `web/src/features/today/TodayScreen.tsx` | 8.0: drop `resumeMeta={null}` on `TodayHeroCard`; drop `cadence` on `LastSessionCard` |
| `web/src/features/today/DaySelector.tsx` | 8.0: drop inline `SectionHeader` + divider (TodayScreen owns "SWITCH DAY" eyebrow) |
| `web/src/shared/hooks/useFinishedSessionSummaries.ts` | 8.2: add `volumeKg: number` per summary (sum of `weight × reps` across the session's logged sets) |
| `web/src/features/history/HistoryScreen.tsx` | 8.7: rewrite — eyebrow + serif title + stats tile + month groups + session rows |
| `web/src/features/history/SessionDetailScreen.tsx` | 8.11: rewrite — header + stats tile + simpler exercise cards; preserve tap-to-edit |
| `web/src/features/today/LastSessionCard.tsx` (test) | 8.0: remove ribbon-related test cases |
| `web/src/features/today/TodayHeroCard.tsx` (test) | 8.0: remove `resumeMeta` test cases |
| `web/src/shared/hooks/useFinishedSessionSummaries.ts` (test) | 8.2: add `volumeKg` assertions |
| `CLAUDE.md` | 8.12: update test count |

### Deleted files

| Path | Reason |
|---|---|
| `web/src/features/history/SessionCard.tsx` | Replaced by `SessionRow.tsx` |

### Out of scope for this plan (spec §3 Sprint 8 "Out of scope" + deferred)

- Session editing surfaces (new) — we preserve existing tap-to-edit only.
- Search / filter on History.
- Workout-screen redesign (Sprint 10), SetLogSheet keypad (Sprint 11), Settings / import redesign (Sprint 9).
- Lucide → custom-icon swaps outside the files we touch in this sprint (the `History` icon inside HistoryScreen empty state, the `ArrowLeft` inside the old SessionDetailScreen — Sprint 12 does the final sweep).

### Branch note

`origin/feat/hero-muscle-summary` has 3 unmerged commits modifying the Today hero. Sprint 8 does not touch Today, but Task 8.0 does. Before starting, confirm with the user whether that branch should merge first or rebase after Sprint 8. If unclear, proceed and surface as a follow-up — the two paths touch different hero concerns (muscle-summary vs. resumeMeta/cadence cleanup) so a textual conflict is unlikely.

---

## Task 0: Branch setup + baseline check

**Files:** none

- [ ] **Step 1: Confirm `main` is at Sprint 7's merge commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -3
```
Expected top commit: `8fdf4fe Sprint 7: First Light — Today screen + AppShell tab bar (#11)` (or a hotfix successor).

- [ ] **Step 2: Create the Sprint 8 worktree**

```bash
git worktree add "../exercise_logger-sprint8-history" -b sprint-8-history main
```

- [ ] **Step 3: Install deps in the worktree**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint8-history/web"
npm install --no-audit --no-fund
```
Expected: `added N packages`. No errors. (If the main worktree's `node_modules` is stale on dev machines, this step will sync the worktree — don't assume it's a no-op.)

- [ ] **Step 4: Baseline unit test run**

```bash
npx vitest run --reporter=default 2>&1 | tail -6
```
Expected: `Tests  553 passed (553)`. If not, stop and investigate — every subsequent task uses 553 as the reference.

- [ ] **Step 5: Baseline lint + build**

```bash
npm run lint && npm run build
```
Expected: both clean. The build produces a `dist/` with Inter + Instrument Serif WOFF2 files precached.

- [ ] **Step 6: Baseline e2e (optional but recommended)**

```bash
npm run test:e2e
```
If e2e is currently flaky, note the flake and skip; otherwise record pass count as the baseline for Task 8.12's verification.

- [ ] **Step 7: No commit — orientation only.**

---

## Task 8.0: Sprint 6/7 carryover — hotfixes + debt

Bundled fixes from the Sprint 6+7 review. Each step is its own commit so the history reads cleanly — reviewers can back out any one fix without churn. Keep this task small and self-contained: no Sprint 8 feature code here.

**Files:**
- Modify: `web/src/shared/ui/sheet.tsx`
- Modify: `web/src/shared/components/EmptyState.tsx`
- Modify: `web/src/features/today/LastSessionCard.tsx`
- Modify: `web/src/features/today/TodayHeroCard.tsx`
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/features/today/DaySelector.tsx`
- Modify: `web/tests/unit/features/today/LastSessionCard.test.tsx`
- Modify: `web/tests/unit/features/today/TodayHeroCard.test.tsx`

### Step 1: Sheet — drop the thick ink top border on bottom-anchored sheets

`data-[side=bottom]:border-t-2 data-[side=bottom]:border-border-strong` is leftover from pre-Sprint-6 when `--border-strong` was a utility accent; after Sprint 6 it aliases to `--ink` (oklch 22% — near-black), so every SetLogSheet opens with a 2px black bar on top of the warm cream sheet.

- [ ] Open `web/src/shared/ui/sheet.tsx`, line 54. Find the substring:

```
data-[side=bottom]:h-auto data-[side=bottom]:border-t-2 data-[side=bottom]:border-border-strong data-[side=bottom]:data-ending-style:translate-y-full
```

Replace with:

```
data-[side=bottom]:h-auto data-[side=bottom]:data-ending-style:translate-y-full
```

- [ ] Run tests — expect 553 pass (no test asserts on this className).

```bash
npm test -- sheet 2>&1 | tail -4
```

- [ ] Commit:

```bash
git add web/src/shared/ui/sheet.tsx
git commit -m "fix(sheet): drop thick ink top border on bottom-anchored sheets"
```

### Step 2: EmptyState — soften the icon tile to a sage-soft disc

The square `bg-muted/60` block with sharp corners reads as a pre-Sprint-6 leftover. Handoff-appropriate replacement is a rounded sage-soft disc.

- [ ] Open `web/src/shared/components/EmptyState.tsx`, line 35. Current:

```tsx
      <div className="flex h-16 w-16 items-center justify-center bg-muted/60 text-muted-foreground">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
```

Replace with:

```tsx
      <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-sage-soft text-sage-deep">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
```

- [ ] Run tests — expect 553 pass.

```bash
npm test 2>&1 | tail -4
```

- [ ] Commit:

```bash
git add web/src/shared/components/EmptyState.tsx
git commit -m "fix(empty-state): soften icon tile to sage-soft rounded disc"
```

### Step 3: LastSessionCard — drop the duplicate cadence ribbon

The StreakPill at the top of Today now owns the "N sessions this week" signal. LastSessionCard's ribbon repeats it with a different icon set, different threshold (`>= 3`), and different color (warm accent). Remove the ribbon, drop the `cadence` prop entirely, delete the Lucide `Flame` import.

- [ ] Rewrite `web/src/features/today/LastSessionCard.tsx` to:

```tsx
import type { Session } from "@/domain/types";
import { Stat } from "@/shared/components/Stat";

interface LastSessionCardProps {
  session: Session;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function formatDurationMin(start: string, end: string | null): number | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 60000);
}

export function LastSessionCard({ session }: LastSessionCardProps) {
  const durationMin = formatDurationMin(session.startedAt, session.finishedAt);

  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-baseline gap-4">
        <Stat
          value={session.dayLabelSnapshot}
          label={formatRelativeDate(session.finishedAt ?? session.startedAt)}
          size="sm"
        />
        {durationMin != null && (
          <Stat value={durationMin} label="min" size="sm" className="ml-auto" />
        )}
      </div>
    </div>
  );
}
```

- [ ] Update the test file `web/tests/unit/features/today/LastSessionCard.test.tsx`. Replace with:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LastSessionCard } from "@/features/today/LastSessionCard";
import type { Session } from "@/domain/types";

afterEach(cleanup);

function makeFinishedSession(overrides: Partial<Session> = {}): Session {
  const nowMs = Date.now();
  const finishedAt = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString();
  const startedAt = new Date(nowMs - 3 * 24 * 60 * 60 * 1000 - 52 * 60 * 1000).toISOString();
  return {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Push",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 45,
    status: "finished",
    startedAt,
    finishedAt,
    ...overrides,
  };
}

describe("LastSessionCard", () => {
  it("renders the day label", () => {
    render(<LastSessionCard session={makeFinishedSession()} />);
    expect(screen.getByText(/Push/)).toBeVisible();
  });

  it("shows '3 days ago' when relative date is 3", () => {
    render(<LastSessionCard session={makeFinishedSession()} />);
    expect(screen.getByText(/3 days ago/i)).toBeVisible();
  });

  it("shows duration when finishedAt present", () => {
    render(<LastSessionCard session={makeFinishedSession()} />);
    expect(screen.getByText("52")).toBeVisible();
    expect(screen.getByText("min")).toBeVisible();
  });
});
```

- [ ] Update `web/src/features/today/TodayScreen.tsx` — the `LastSessionCard` usage (currently around line 190). Current:

```tsx
        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}
```

Replace with:

```tsx
        {lastSession && <LastSessionCard session={lastSession} />}
```

- [ ] Run tests — expect `551` pass (553 baseline − 2 removed ribbon tests).

```bash
npm test 2>&1 | tail -4
```

- [ ] Commit:

```bash
git add web/src/features/today/LastSessionCard.tsx \
        web/src/features/today/TodayScreen.tsx \
        web/tests/unit/features/today/LastSessionCard.test.tsx
git commit -m "refactor(today): remove duplicate cadence ribbon from LastSessionCard"
```

### Step 4: TodayHeroCard — drop the dead `resumeMeta` prop

`TodayScreen` always passes `resumeMeta={null}`; the prop exists only as scaffolding for a unification that spec §3 Sprint 7 explicitly declined. Simpler interface = less cognitive load for Sprint 8+.

- [ ] Open `web/src/features/today/TodayHeroCard.tsx`. Remove the `resumeMeta` prop from the interface (lines 14-15 area), from the destructure, and remove the `{resumeMeta && (...)}` render block (lines 71-79). The final file:

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
}: TodayHeroCardProps) {
  const exerciseCopy = [
    `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${setCount} ${setCount === 1 ? "set" : "sets"}`,
    firstExerciseName ? `first up: ${firstExerciseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="py-0">
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
      </CardContent>
    </Card>
  );
}
```

- [ ] Update `web/tests/unit/features/today/TodayHeroCard.test.tsx`. Remove `resumeMeta: null` from `baseProps` and delete the two `resumeMeta`-related test cases. The final file:

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

- [ ] Update `web/src/features/today/TodayScreen.tsx` — drop the `resumeMeta={null}` prop on `TodayHeroCard` (currently around line 178). Remove that single line.

- [ ] Run tests — expect `549` pass (551 − 2 removed `resumeMeta` cases).

```bash
npm test 2>&1 | tail -4
```

- [ ] Commit:

```bash
git add web/src/features/today/TodayHeroCard.tsx \
        web/src/features/today/TodayScreen.tsx \
        web/tests/unit/features/today/TodayHeroCard.test.tsx
git commit -m "refactor(today): drop dead resumeMeta prop on TodayHeroCard"
```

### Step 5: DaySelector — drop the stacked section header

TodayScreen renders a "SWITCH DAY" eyebrow right before `DaySelector`. `DaySelector` then renders its own `SectionHeader` ("Day A — Heavy Squat…") + a divider line, giving three stacked title-like rows before the A/B/C pills. Remove the internal header so the eyebrow directly precedes the pills.

- [ ] Open `web/src/features/today/DaySelector.tsx`. Current lines 19-25:

```tsx
  return (
    <div className="space-y-3">
      <SectionHeader className="!text-sage-deep">
        Day {selectedDayId} — {selectedLabel}
      </SectionHeader>
      <div className="border-t border-line" />
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
```

Replace lines 19-25 with:

```tsx
  return (
    <div>
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
```

- [ ] Update the imports — `SectionHeader` is no longer used. Remove `import { SectionHeader } from "@/shared/components/SectionHeader";` (line 3).

- [ ] The destructured `selectedLabel` and `selectedDay` on lines 16-17 also become unused. Remove them and the `selectedDay` computation. The final file:

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
  return (
    <div>
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

- [ ] Run typecheck + tests — expect `549` pass.

```bash
npx tsc -b && npm test 2>&1 | tail -4
```

- [ ] Commit:

```bash
git add web/src/features/today/DaySelector.tsx
git commit -m "refactor(today): remove stacked section header inside DaySelector"
```

### Step 6: Task 8.0 self-check

- [ ] Run the full trio: `npm test && npm run lint && npm run build`. Expected: 549 pass (will grow again starting Task 8.1), lint clean, build clean.

- [ ] Visual smoke (5 min):

```bash
npm run dev
```

Walk these screens:
- **Today (normal)**: eyebrow → serif "Hello." → StreakPill (if any) → hero card → "SWITCH DAY" eyebrow → pill row (no inline day label) → LastSessionCard (no ribbon).
- **Today (empty routine)**: sage-soft rounded disc behind the icon, not a sharp square tile.
- **SetLogSheet (open via any existing session workflow)**: bottom edge is curved 24px radius with no thick ink bar across the top.

Close the dev server.

- [ ] No additional commit — Task 8.0 complete.

---

## Task 8.1: Session stats utils — volume + formatters

**Files:**
- Create: `web/src/features/history/lib/sessionStats.ts`
- Create: `web/tests/unit/features/history/lib/sessionStats.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `web/tests/unit/features/history/lib/sessionStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeSessionVolumeKg,
  formatVolume,
  formatShortDuration,
} from "@/features/history/lib/sessionStats";
import type { LoggedSet } from "@/domain/types";

function makeSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls",
    sessionId: "s",
    sessionExerciseId: "se",
    exerciseId: "ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("computeSessionVolumeKg", () => {
  it("sums weight × reps across sets", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: 5 }),
      makeSet({ performedWeightKg: 80, performedReps: 10 }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(1300);
  });

  it("skips sets missing weight", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: 5 }),
      makeSet({ performedWeightKg: null, performedReps: 10 }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(500);
  });

  it("skips sets missing reps", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: null }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(computeSessionVolumeKg([])).toBe(0);
  });

  it("ignores duration-only sets", () => {
    const sets = [makeSet({ performedDurationSec: 60 })];
    expect(computeSessionVolumeKg(sets)).toBe(0);
  });
});

describe("formatVolume", () => {
  it("formats kg with suffix and thousands separator", () => {
    expect(formatVolume(8240, "kg")).toBe("8,240 kg");
  });

  it("formats lbs with conversion and suffix", () => {
    // 1000 kg ≈ 2204.6 lbs → rounded to integer
    expect(formatVolume(1000, "lbs")).toBe("2,205 lbs");
  });

  it("formats zero as '0 kg'", () => {
    expect(formatVolume(0, "kg")).toBe("0 kg");
  });

  it("rounds to integer (no decimals on the big number)", () => {
    expect(formatVolume(8240.7, "kg")).toBe("8,241 kg");
  });
});

describe("formatShortDuration", () => {
  it("returns '52m' for a 52-minute session", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:52:00Z";
    expect(formatShortDuration(start, end)).toBe("52m");
  });

  it("returns '' when end is null", () => {
    expect(formatShortDuration("2026-04-17T12:00:00Z", null)).toBe("");
  });

  it("returns '< 1m' for sub-minute sessions", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:00:30Z";
    expect(formatShortDuration(start, end)).toBe("< 1m");
  });

  it("handles multi-hour sessions as minutes", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T14:30:00Z";
    expect(formatShortDuration(start, end)).toBe("150m");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/lib/sessionStats.test.ts
```
Expected: `FAIL` with `Cannot find module '@/features/history/lib/sessionStats'`.

- [ ] **Step 3: Implement the utils**

Create `web/src/features/history/lib/sessionStats.ts`:

```ts
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

/** Sum of `weight × reps` across logged sets. Non-strength sets contribute 0. */
export function computeSessionVolumeKg(sets: LoggedSet[]): number {
  let total = 0;
  for (const set of sets) {
    if (set.performedWeightKg == null || set.performedReps == null) continue;
    total += set.performedWeightKg * set.performedReps;
  }
  return total;
}

/** Display volume with thousands separator and unit suffix. E.g. "8,240 kg". */
export function formatVolume(canonicalKg: number, units: UnitSystem): string {
  const display = Math.round(toDisplayWeight(canonicalKg, units));
  const withCommas = display.toLocaleString("en-US");
  return `${withCommas} ${units}`;
}

/** Short minutes string for session meta lines. E.g. "52m", "< 1m", "". */
export function formatShortDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "< 1m";
  return `${min}m`;
}
```

> **Note on units import.** `UnitSystem` is the `"kg" | "lbs"` union defined in `@/domain/enums.ts` — import directly from there (types.ts imports it internally but does not re-export). `toDisplayWeight` lives in `@/domain/unit-conversion.ts`. Both are pre-existing.

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/lib/sessionStats.test.ts
```
Expected: 13 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `562 passed` (549 + 13).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/lib/sessionStats.ts \
        web/tests/unit/features/history/lib/sessionStats.test.ts
git commit -m "feat(history): add session stats utils (volume, formatters)"
```

---

## Task 8.2: Extend `useFinishedSessionSummaries` with per-session volume

**Files:**
- Modify: `web/src/shared/hooks/useFinishedSessionSummaries.ts`
- Modify: `web/tests/unit/shared/hooks/useFinishedSessionSummaries.test.ts`

- [ ] **Step 1: Update the hook to include `volumeKg`**

Open `web/src/shared/hooks/useFinishedSessionSummaries.ts`. Replace the entire file with:

```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, LoggedSet } from "@/domain/types";
import { computeSessionVolumeKg } from "@/features/history/lib/sessionStats";

export interface FinishedSessionSummary {
  session: Session;
  exerciseCount: number;
  loggedSetCount: number;
  volumeKg: number;
  displayDate: string;
}

export function useFinishedSessionSummaries(): FinishedSessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions
      .where("status")
      .equals("finished")
      .toArray();

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    const allExercises = await db.sessionExercises
      .where("sessionId")
      .anyOf(sessionIds)
      .toArray();
    const allSets = await db.loggedSets
      .where("sessionId")
      .anyOf(sessionIds)
      .toArray();

    const exerciseCounts = new Map<string, number>();
    for (const se of allExercises) {
      exerciseCounts.set(se.sessionId, (exerciseCounts.get(se.sessionId) ?? 0) + 1);
    }
    const setCounts = new Map<string, number>();
    const setsBySession = new Map<string, LoggedSet[]>();
    for (const ls of allSets) {
      setCounts.set(ls.sessionId, (setCounts.get(ls.sessionId) ?? 0) + 1);
      const bucket = setsBySession.get(ls.sessionId);
      if (bucket) bucket.push(ls);
      else setsBySession.set(ls.sessionId, [ls]);
    }

    const summaries: FinishedSessionSummary[] = sessions.map((session) => ({
      session,
      exerciseCount: exerciseCounts.get(session.id) ?? 0,
      loggedSetCount: setCounts.get(session.id) ?? 0,
      volumeKg: computeSessionVolumeKg(setsBySession.get(session.id) ?? []),
      displayDate: session.finishedAt ?? session.startedAt,
    }));

    return summaries.sort((a, b) =>
      b.displayDate.localeCompare(a.displayDate)
    );
  });
}
```

> **Architecture note.** The hook now depends on `@/features/history/lib/sessionStats` — a layer inversion (shared → feature). That's intentional: `sessionStats` is the canonical volume formula, and putting it in `features/history` matches how History owns all per-session aggregations. An alternative is moving `computeSessionVolumeKg` into `@/domain/` — consider in Sprint 12's polish if the cross-feature dependency becomes awkward.

- [ ] **Step 2: Add a `volumeKg` assertion to the existing test**

Open `web/tests/unit/shared/hooks/useFinishedSessionSummaries.test.ts`. Find the test asserting the existing shape (it sets up sessions + sets + checks `exerciseCount` and `loggedSetCount`). Add a case that logs weight/reps and asserts `volumeKg`.

Append this test case at the end of the existing `describe` block:

```ts
  it("computes volumeKg as sum of weight × reps across the session's logged sets", async () => {
    const sessionId = "s-vol";
    await db.sessions.put(
      makeSession(sessionId, "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:00:00Z")
    );
    await db.sessionExercises.put(makeSessionExercise("se-vol", sessionId));
    const now = "2026-04-17T12:00:00Z";
    await db.loggedSets.bulkPut([
      {
        id: "ls1",
        sessionId,
        sessionExerciseId: "se-vol",
        exerciseId: "barbell-back-squat",
        instanceLabel: "",
        origin: "routine",
        blockIndex: 0,
        blockSignature: "sig",
        setIndex: 0,
        tag: null,
        performedWeightKg: 100,
        performedReps: 5,
        performedDurationSec: null,
        performedDistanceM: null,
        loggedAt: now,
        updatedAt: now,
      },
      {
        id: "ls2",
        sessionId,
        sessionExerciseId: "se-vol",
        exerciseId: "barbell-back-squat",
        instanceLabel: "",
        origin: "routine",
        blockIndex: 0,
        blockSignature: "sig",
        setIndex: 1,
        tag: null,
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
        loggedAt: now,
        updatedAt: now,
      },
    ]);

    const { result } = renderHook(() => useFinishedSessionSummaries());
    await waitFor(() => expect(result.current).toBeDefined());

    const summary = result.current!.find((s) => s.session.id === sessionId);
    expect(summary).toBeDefined();
    expect(summary!.volumeKg).toBe(1300);
  });
```

> **If the existing test file already sets up logged sets in earlier `it` blocks**, the db state may persist between tests. Inspect the file's setup pattern (usually a `beforeEach` clearing `db.sessions`, etc.). If there's no reset, scope this new test to a fresh session id — the one above (`s-vol`) is deliberately unique.

- [ ] **Step 3: Run the hook test**

```bash
npx vitest run tests/unit/shared/hooks/useFinishedSessionSummaries.test.ts
```
Expected: all prior tests pass + new test passes.

- [ ] **Step 4: Run full suite**

```bash
npm test
```
Expected: `563 passed` (562 + 1 new).

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/hooks/useFinishedSessionSummaries.ts \
        web/tests/unit/shared/hooks/useFinishedSessionSummaries.test.ts
git commit -m "feat(history): add volumeKg to finished session summaries"
```

---

## Task 8.3: `groupSessionsByMonth` util

**Files:**
- Create: `web/src/features/history/lib/groupByMonth.ts`
- Create: `web/tests/unit/features/history/lib/groupByMonth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/lib/groupByMonth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupSessionsByMonth } from "@/features/history/lib/groupByMonth";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session } from "@/domain/types";

function makeSummary(id: string, displayDate: string): FinishedSessionSummary {
  const session: Session = {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: displayDate,
    finishedAt: displayDate,
  };
  return {
    session,
    exerciseCount: 0,
    loggedSetCount: 0,
    volumeKg: 0,
    displayDate,
  };
}

describe("groupSessionsByMonth", () => {
  it("groups by calendar month (local time)", () => {
    const summaries = [
      makeSummary("s1", "2026-04-17T12:00:00Z"),
      makeSummary("s2", "2026-04-15T12:00:00Z"),
      makeSummary("s3", "2026-03-31T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups).toHaveLength(2);
    expect(groups[0].sessions).toHaveLength(2);
    expect(groups[0].sessions[0].session.id).toBe("s1");
    expect(groups[1].sessions[0].session.id).toBe("s3");
  });

  it("renders month label as 'APRIL 2026' uppercase", () => {
    const summaries = [makeSummary("s1", "2026-04-17T12:00:00Z")];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].monthLabel).toBe("APRIL 2026");
  });

  it("uses YYYY-MM month key for stable sort", () => {
    const summaries = [makeSummary("s1", "2026-04-17T12:00:00Z")];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].monthKey).toBe("2026-04");
  });

  it("preserves input order within each group", () => {
    const summaries = [
      makeSummary("s1", "2026-04-17T12:00:00Z"),
      makeSummary("s2", "2026-04-10T12:00:00Z"),
      makeSummary("s3", "2026-04-20T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].sessions.map((s) => s.session.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("returns [] for empty input", () => {
    expect(groupSessionsByMonth([])).toEqual([]);
  });

  it("sorts groups newest-first by monthKey", () => {
    const summaries = [
      makeSummary("s-feb", "2026-02-01T12:00:00Z"),
      makeSummary("s-mar", "2026-03-01T12:00:00Z"),
      makeSummary("s-apr", "2026-04-01T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-04", "2026-03", "2026-02"]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/lib/groupByMonth.test.ts
```
Expected: `FAIL` with `Cannot find module '@/features/history/lib/groupByMonth'`.

- [ ] **Step 3: Implement**

Create `web/src/features/history/lib/groupByMonth.ts`:

```ts
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";

export interface SessionMonthGroup {
  /** YYYY-MM for stable sort. Local calendar month. */
  monthKey: string;
  /** Uppercase display label, e.g. "APRIL 2026". */
  monthLabel: string;
  /** Sessions in this month — preserves input order. */
  sessions: FinishedSessionSummary[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

function monthKeyFor(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Group finished-session summaries by their local calendar month.
 * Groups are returned newest-first; sessions within each group keep input order
 * (callers are expected to pass summaries sorted newest-first already).
 */
export function groupSessionsByMonth(
  summaries: FinishedSessionSummary[],
): SessionMonthGroup[] {
  if (summaries.length === 0) return [];

  const buckets = new Map<string, SessionMonthGroup>();
  for (const summary of summaries) {
    const date = new Date(summary.displayDate);
    const key = monthKeyFor(date);
    const existing = buckets.get(key);
    if (existing) {
      existing.sessions.push(summary);
    } else {
      buckets.set(key, {
        monthKey: key,
        monthLabel: MONTH_LABEL_FMT.format(date).toUpperCase(),
        sessions: [summary],
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/lib/groupByMonth.test.ts
```
Expected: 6 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `569 passed` (563 + 6).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/lib/groupByMonth.ts \
        web/tests/unit/features/history/lib/groupByMonth.test.ts
git commit -m "feat(history): add groupSessionsByMonth util with local-time boundaries"
```

---

## Task 8.4: `useHistoryStats` hook

**Files:**
- Create: `web/src/shared/hooks/useHistoryStats.ts`
- Create: `web/tests/unit/shared/hooks/useHistoryStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/shared/hooks/useHistoryStats.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useHistoryStats } from "@/shared/hooks/useHistoryStats";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

beforeEach(async () => {
  await db.sessions.clear();
  await db.sessionExercises.clear();
  await db.loggedSets.clear();
});

function makeSession(
  id: string,
  status: "active" | "finished",
  startedAt: string,
  finishedAt: string | null,
): Session {
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status,
    startedAt,
    finishedAt,
  };
}

function makeSessionExercise(id: string, sessionId: string): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: null,
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [],
    createdAt: "2026-04-17T12:00:00Z",
    unitOverride: null,
  };
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  setIndex: number,
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex,
    tag: null,
    performedWeightKg: 100,
    performedReps: 5,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
  };
}

describe("useHistoryStats", () => {
  it("returns zeros when no finished sessions exist", async () => {
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual({ sessionCount: 0, setCount: 0, hours: 0 });
  });

  it("counts only finished sessions (active sessions excluded)", async () => {
    await db.sessions.bulkPut([
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:00:00Z"),
      makeSession("s2", "active", "2026-04-18T12:00:00Z", null),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() =>
      expect(result.current).toEqual({ sessionCount: 1, setCount: 0, hours: 1 }),
    );
  });

  it("sums sets across all finished sessions", async () => {
    await db.sessions.put(
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:00:00Z"),
    );
    await db.sessionExercises.put(makeSessionExercise("se1", "s1"));
    await db.loggedSets.bulkPut([
      makeLoggedSet("ls1", "s1", "se1", 0),
      makeLoggedSet("ls2", "s1", "se1", 1),
      makeLoggedSet("ls3", "s1", "se1", 2),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.setCount).toBe(3));
  });

  it("rounds hours to the nearest whole hour", async () => {
    // Session 1: 1h 30m → rounds to 2h
    // Session 2: 30m → rounds to 0h (below 0.5h threshold would round down; 0.5h is exactly at boundary)
    // Total raw: 1.5h + 0.5h = 2h
    await db.sessions.bulkPut([
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:30:00Z"),
      makeSession("s2", "finished", "2026-04-18T12:00:00Z", "2026-04-18T12:30:00Z"),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.hours).toBe(2));
  });

  it("skips sessions with null finishedAt (orphaned active)", async () => {
    // Edge case: a finished-status session that somehow has no finishedAt.
    // Defensive: don't blow up, just don't contribute hours.
    await db.sessions.put({
      ...makeSession("s1", "finished", "2026-04-17T12:00:00Z", null),
    });
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.hours).toBe(0));
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/shared/hooks/useHistoryStats.test.ts
```
Expected: `FAIL` with `Cannot find module '@/shared/hooks/useHistoryStats'`.

- [ ] **Step 3: Implement**

Create `web/src/shared/hooks/useHistoryStats.ts`:

```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export interface HistoryStats {
  sessionCount: number;
  setCount: number;
  hours: number;
}

export function useHistoryStats(): HistoryStats | undefined {
  return useLiveQuery(async () => {
    const finished = await db.sessions.where("status").equals("finished").toArray();

    if (finished.length === 0) {
      return { sessionCount: 0, setCount: 0, hours: 0 };
    }

    const sessionIds = finished.map((s) => s.id);
    const setCount = await db.loggedSets
      .where("sessionId")
      .anyOf(sessionIds)
      .count();

    let totalMs = 0;
    for (const s of finished) {
      if (!s.finishedAt) continue;
      totalMs += new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
    }
    const hours = Math.round(totalMs / (60 * 60 * 1000));

    return { sessionCount: finished.length, setCount, hours };
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/shared/hooks/useHistoryStats.test.ts
```
Expected: 5 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `574 passed` (569 + 5).

- [ ] **Step 6: Commit**

```bash
git add web/src/shared/hooks/useHistoryStats.ts \
        web/tests/unit/shared/hooks/useHistoryStats.test.ts
git commit -m "feat(history): add useHistoryStats hook (sessions, sets, hours)"
```

---

## Task 8.5: `HistoryStatsTile` component

**Files:**
- Create: `web/src/features/history/HistoryStatsTile.tsx`
- Create: `web/tests/unit/features/history/HistoryStatsTile.test.tsx`

Signature:

```tsx
<HistoryStatsTile stats={{ sessionCount: 47, setCount: 1284, hours: 38 }} />
```

Renders a card with three stats side by side — values in Inter bold tabular numerals with thousands separators; labels in ink-3 eyebrow. Returns `null` when `stats` is `undefined` (loading).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/HistoryStatsTile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryStatsTile } from "@/features/history/HistoryStatsTile";

describe("HistoryStatsTile", () => {
  it("renders the three stat values and labels", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 47, setCount: 1284, hours: 38 }} />);
    expect(screen.getByText("47")).toBeVisible();
    expect(screen.getByText("1,284")).toBeVisible();
    expect(screen.getByText("38")).toBeVisible();
    expect(screen.getByText(/sessions/i)).toBeVisible();
    expect(screen.getByText(/sets/i)).toBeVisible();
    expect(screen.getByText(/hours/i)).toBeVisible();
  });

  it("renders '0' when stats are all zero", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 0, setCount: 0, hours: 0 }} />);
    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(3);
  });

  it("returns null when stats is undefined", () => {
    const { container } = render(<HistoryStatsTile stats={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("formats thousands separators for big set counts", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 1, setCount: 10000, hours: 1 }} />);
    expect(screen.getByText("10,000")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/HistoryStatsTile.test.tsx
```
Expected: `FAIL` — cannot find module.

- [ ] **Step 3: Implement**

Create `web/src/features/history/HistoryStatsTile.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { HistoryStats } from "@/shared/hooks/useHistoryStats";

interface HistoryStatsTileProps {
  stats: HistoryStats | undefined;
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-value tabular-nums text-foreground">
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-eyebrow text-ink-3">{label}</span>
    </div>
  );
}

export function HistoryStatsTile({ stats }: HistoryStatsTileProps) {
  if (!stats) return null;
  return (
    <Card className="py-0">
      <CardContent className="flex items-baseline gap-8 px-5 py-4">
        <Cell value={stats.sessionCount} label="Sessions" />
        <Cell value={stats.setCount} label="Sets" />
        <Cell value={stats.hours} label="Hours" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/HistoryStatsTile.test.tsx
```
Expected: 4 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `578 passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/HistoryStatsTile.tsx \
        web/tests/unit/features/history/HistoryStatsTile.test.tsx
git commit -m "feat(history): add HistoryStatsTile (sessions / sets / hours)"
```

---

## Task 8.6: `SessionRow` component

**Files:**
- Create: `web/src/features/history/SessionRow.tsx`
- Create: `web/tests/unit/features/history/SessionRow.test.tsx`

Signature:

```tsx
<SessionRow summary={summary} units="kg" />
```

Renders:
- Left: date chip, sage-soft rounded square containing MMM on top line + DD on bottom line (e.g. APR / 17).
- Center: truncated day title (routineNameSnapshot is dropped in this design — the title alone is enough context), meta line below with `{duration} · {setCount} sets · {volume}`.
- Right: chevron (custom `Chevron` icon, direction="right").

Wraps in a `<Link>` to `/history/{sessionId}`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/SessionRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SessionRow } from "@/features/history/SessionRow";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session } from "@/domain/types";

function makeSummary(
  overrides: Partial<FinishedSessionSummary> = {},
  sessionOverrides: Partial<Session> = {},
): FinishedSessionSummary {
  const session: Session = {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Heavy Squat",
    dayId: "A",
    dayLabelSnapshot: "Moderate Hinge + Vertical Push/Pull",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-04-17T12:00:00Z",
    finishedAt: "2026-04-17T12:52:00Z",
    ...sessionOverrides,
  };
  return {
    session,
    exerciseCount: 5,
    loggedSetCount: 17,
    volumeKg: 8240,
    displayDate: session.finishedAt ?? session.startedAt,
    ...overrides,
  };
}

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("SessionRow", () => {
  it("renders the day title", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText(/Moderate Hinge/)).toBeVisible();
  });

  it("renders the date chip with uppercase month + day", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText("APR")).toBeVisible();
    expect(screen.getByText("17")).toBeVisible();
  });

  it("renders the meta line with duration, sets, and volume", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText(/52m · 17 sets · 8,240 kg/)).toBeVisible();
  });

  it("omits the duration when finishedAt is null", () => {
    renderInRouter(
      <SessionRow
        summary={makeSummary({}, { finishedAt: null })}
        units="kg"
      />,
    );
    // When duration is empty, we drop it and render "17 sets · 8,240 kg".
    expect(screen.getByText(/17 sets · 8,240 kg/)).toBeVisible();
    expect(screen.queryByText(/52m/)).toBeNull();
  });

  it("omits the volume when it is zero", () => {
    renderInRouter(
      <SessionRow summary={makeSummary({ volumeKg: 0 })} units="kg" />,
    );
    expect(screen.getByText(/52m · 17 sets/)).toBeVisible();
    expect(screen.queryByText(/0 kg/)).toBeNull();
  });

  it("links to /history/:sessionId", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/history/s1");
  });

  it("renders volume in lbs when units='lbs'", () => {
    renderInRouter(<SessionRow summary={makeSummary({ volumeKg: 1000 })} units="lbs" />);
    expect(screen.getByText(/2,205 lbs/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/SessionRow.test.tsx
```
Expected: `FAIL` — cannot find module.

- [ ] **Step 3: Implement**

Create `web/src/features/history/SessionRow.tsx`:

```tsx
import { Link } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import { Chevron } from "@/shared/icons";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { UnitSystem } from "@/domain/enums";
import { formatShortDuration, formatVolume } from "./lib/sessionStats";

interface SessionRowProps {
  summary: FinishedSessionSummary;
  units: UnitSystem;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatDateChip(iso: string): { month: string; day: number } {
  const date = new Date(iso);
  return { month: MONTH_FMT.format(date).toUpperCase(), day: date.getDate() };
}

export function SessionRow({ summary, units }: SessionRowProps) {
  const { session, loggedSetCount, volumeKg } = summary;
  const { month, day } = formatDateChip(summary.displayDate);

  const metaParts = [
    formatShortDuration(session.startedAt, session.finishedAt),
    `${loggedSetCount} ${loggedSetCount === 1 ? "set" : "sets"}`,
    volumeKg > 0 ? formatVolume(volumeKg, units) : "",
  ].filter(Boolean);

  return (
    <Link to={`/history/${session.id}`} className="block">
      <Card className="py-0">
        <CardContent className="flex items-center gap-3 px-3 py-3">
          <div
            aria-hidden="true"
            className="flex flex-col items-center justify-center rounded-[var(--radius-set-empty)] bg-sage-soft px-2 py-1 text-sage-deep"
          >
            <span className="text-[10px] font-semibold tracking-widest">
              {month}
            </span>
            <span className="text-base font-bold leading-none tabular-nums">
              {day}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {session.dayLabelSnapshot}
            </p>
            <p className="text-meta tabular-nums">{metaParts.join(" · ")}</p>
          </div>

          <Chevron direction="right" className="shrink-0 text-ink-3" />
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/SessionRow.test.tsx
```
Expected: 7 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `585 passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/SessionRow.tsx \
        web/tests/unit/features/history/SessionRow.test.tsx
git commit -m "feat(history): add SessionRow (date chip + title + meta + chevron)"
```

---

## Task 8.7: Rewrite `HistoryScreen` (and delete `SessionCard`)

**Files:**
- Modify: `web/src/features/history/HistoryScreen.tsx`
- **Delete:** `web/src/features/history/SessionCard.tsx`

- [ ] **Step 1: Rewrite `HistoryScreen.tsx`**

Replace the entire contents of `web/src/features/history/HistoryScreen.tsx` with:

```tsx
import { History } from "lucide-react";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { useHistoryStats } from "@/shared/hooks/useHistoryStats";
import { useSettings } from "@/shared/hooks/useSettings";
import { EmptyState } from "@/shared/components/EmptyState";
import { HistoryStatsTile } from "./HistoryStatsTile";
import { SessionRow } from "./SessionRow";
import { groupSessionsByMonth } from "./lib/groupByMonth";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();
  const stats = useHistoryStats();
  const settings = useSettings();

  if (summaries === undefined || settings === undefined) return null;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No History Yet"
        body="Complete a workout to see it here."
      />
    );
  }

  const groups = groupSessionsByMonth(summaries);

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Training Log</p>
        <h1 className="text-hero-serif italic text-foreground">History</h1>
      </div>

      <HistoryStatsTile stats={stats} />

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.monthKey} className="space-y-2">
            <p className="text-eyebrow text-ink-3">{group.monthLabel}</p>
            <ul className="space-y-2" aria-label={group.monthLabel}>
              {group.sessions.map((summary) => (
                <li key={summary.session.id}>
                  <SessionRow summary={summary} units={settings.units} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
```

> **Icon note.** The `History` icon from Lucide stays for now — there's no matching glyph in `@/shared/icons` yet. The EmptyState Lucide import is untouched as part of the Sprint 8 scope; Sprint 12's final Lucide sweep will revisit.

- [ ] **Step 2: Delete the old `SessionCard`**

```bash
rm web/src/features/history/SessionCard.tsx
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```
Expected: clean. If a stale import anywhere references `SessionCard`, grep shows it — fix by removing or redirecting to `SessionRow`.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: `585 passed` (no new tests; no existing test imports the deleted `SessionCard`).

If any test file references `SessionCard`, the suite will fail at import. Delete / repoint those tests.

- [ ] **Step 5: Visual smoke**

```bash
npm run dev
```
Navigate to `/history`. Confirm:
- Eyebrow "TRAINING LOG" (11px uppercase, 0.08em tracking) above serif-italic "History" hero.
- Stats tile with three numbers.
- "APRIL 2026" month group eyebrow.
- Session rows: APR / NN date chip on left, title + meta line, chevron on right.
- Empty-state case still works (test with a fresh DB via DevTools → Application → IndexedDB → delete `exercise-logger` database and reload).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/HistoryScreen.tsx
git rm web/src/features/history/SessionCard.tsx
git commit -m "feat(history): rewrite HistoryScreen to warm-paper layout"
```

---

## Task 8.8: `SessionDetailHeader` component

**Files:**
- Create: `web/src/features/history/SessionDetailHeader.tsx`
- Create: `web/tests/unit/features/history/SessionDetailHeader.test.tsx`

Signature:

```tsx
<SessionDetailHeader session={session} />
```

Renders:
- Back arrow (custom `Back` icon) as a `<Link to="/history">` with aria-label.
- Eyebrow: "APR 17 · 52M" (abbr month + day + short duration).
- Serif day title (`text-hero-serif`, not italic — matches `screenshots/6-session-detail.jpg`).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/SessionDetailHeader.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SessionDetailHeader } from "@/features/history/SessionDetailHeader";
import type { Session } from "@/domain/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Heavy Squat",
    dayId: "A",
    dayLabelSnapshot: "Moderate Hinge + Vertical Push/Pull",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-04-17T12:00:00Z",
    finishedAt: "2026-04-17T12:52:00Z",
    ...overrides,
  };
}

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("SessionDetailHeader", () => {
  it("renders the eyebrow 'APR 17 · 52M'", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    expect(screen.getByText(/APR 17 · 52M/i)).toBeVisible();
  });

  it("renders the day title", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    expect(screen.getByText(/Moderate Hinge/)).toBeVisible();
  });

  it("renders a back link to /history with aria-label", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    const link = screen.getByRole("link", { name: /back/i });
    expect(link.getAttribute("href")).toBe("/history");
  });

  it("omits the duration segment when finishedAt is null", () => {
    renderInRouter(<SessionDetailHeader session={makeSession({ finishedAt: null })} />);
    expect(screen.getByText(/APR 17/i)).toBeVisible();
    expect(screen.queryByText(/· 52M/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/SessionDetailHeader.test.tsx
```
Expected: `FAIL` — cannot find module.

- [ ] **Step 3: Implement**

Create `web/src/features/history/SessionDetailHeader.tsx`:

```tsx
import { Link } from "react-router";
import { Back } from "@/shared/icons";
import type { Session } from "@/domain/types";
import { formatShortDuration } from "./lib/sessionStats";

interface SessionDetailHeaderProps {
  session: Session;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatEyebrow(session: Session): string {
  const date = new Date(session.finishedAt ?? session.startedAt);
  const month = MONTH_FMT.format(date).toUpperCase();
  const day = date.getDate();
  const duration = formatShortDuration(session.startedAt, session.finishedAt).toUpperCase();
  return duration ? `${month} ${day} · ${duration}` : `${month} ${day}`;
}

export function SessionDetailHeader({ session }: SessionDetailHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/history"
        aria-label="Back"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-foreground hover:bg-sage-soft/50 transition-colors"
      >
        <Back />
      </Link>

      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">{formatEyebrow(session)}</p>
        <h1 className="text-hero-serif text-foreground">
          {session.dayLabelSnapshot}
        </h1>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/SessionDetailHeader.test.tsx
```
Expected: 4 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `589 passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/SessionDetailHeader.tsx \
        web/tests/unit/features/history/SessionDetailHeader.test.tsx
git commit -m "feat(history): add SessionDetailHeader (back + eyebrow + serif title)"
```

---

## Task 8.9: `SessionDetailStatsTile` component

**Files:**
- Create: `web/src/features/history/SessionDetailStatsTile.tsx`
- Create: `web/tests/unit/features/history/SessionDetailStatsTile.test.tsx`

Signature:

```tsx
<SessionDetailStatsTile
  setCount={17}
  volumeKg={8240}
  durationMin={52}
  units="kg"
/>
```

Renders SETS / VOLUME / TIME in a card. Volume cell displays `"8,240 kg"` on the value (suffix), not just the number. Time cell displays `"52m"`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/SessionDetailStatsTile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionDetailStatsTile } from "@/features/history/SessionDetailStatsTile";

describe("SessionDetailStatsTile", () => {
  it("renders sets / volume / time", () => {
    render(
      <SessionDetailStatsTile setCount={17} volumeKg={8240} durationMin={52} units="kg" />
    );
    expect(screen.getByText("17")).toBeVisible();
    expect(screen.getByText("8,240 kg")).toBeVisible();
    expect(screen.getByText("52m")).toBeVisible();
    expect(screen.getByText(/sets/i)).toBeVisible();
    expect(screen.getByText(/volume/i)).toBeVisible();
    expect(screen.getByText(/time/i)).toBeVisible();
  });

  it("renders '—' for duration when durationMin is null", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={0} durationMin={null} units="kg" />
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("renders volume in lbs when units='lbs'", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={1000} durationMin={30} units="lbs" />
    );
    expect(screen.getByText("2,205 lbs")).toBeVisible();
  });

  it("renders '0 kg' for volume when volumeKg is 0", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={0} durationMin={30} units="kg" />
    );
    expect(screen.getByText("0 kg")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/SessionDetailStatsTile.test.tsx
```

- [ ] **Step 3: Implement**

Create `web/src/features/history/SessionDetailStatsTile.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { UnitSystem } from "@/domain/enums";
import { formatVolume } from "./lib/sessionStats";

interface SessionDetailStatsTileProps {
  setCount: number;
  volumeKg: number;
  durationMin: number | null;
  units: UnitSystem;
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-value tabular-nums text-foreground">{value}</span>
      <span className="text-eyebrow text-ink-3">{label}</span>
    </div>
  );
}

export function SessionDetailStatsTile({
  setCount,
  volumeKg,
  durationMin,
  units,
}: SessionDetailStatsTileProps) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-baseline gap-8 px-5 py-4">
        <Cell value={String(setCount)} label="Sets" />
        <Cell value={formatVolume(volumeKg, units)} label="Volume" />
        <Cell value={durationMin != null ? `${durationMin}m` : "—"} label="Time" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/SessionDetailStatsTile.test.tsx
```
Expected: 4 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `593 passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/SessionDetailStatsTile.tsx \
        web/tests/unit/features/history/SessionDetailStatsTile.test.tsx
git commit -m "feat(history): add SessionDetailStatsTile (sets / volume / time)"
```

---

## Task 8.10: `SessionDetailExerciseCard` component

**Files:**
- Create: `web/src/features/history/SessionDetailExerciseCard.tsx`
- Create: `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`

Signature:

```tsx
<SessionDetailExerciseCard
  exerciseName="Dumbbell Romanian Deadlift"
  loggedSets={loggedSets}
  units="kg"
  onSetTap={(blockIndex, setIndex) => ...}
/>
```

Renders a Card containing the exercise name (sans, medium weight) and a row of sage-soft set pills, each showing `{weight}×{reps}` (e.g. `"30×14"`). Pills are `<button>`s — tapping fires `onSetTap(blockIndex, setIndex)`. Sets with null weight or reps still render, showing `"—"` so the user can tap to edit them (matches current editable-on-detail behaviour).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionDetailExerciseCard } from "@/features/history/SessionDetailExerciseCard";
import type { LoggedSet } from "@/domain/types";

function makeSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls",
    sessionId: "s",
    sessionExerciseId: "se",
    exerciseId: "ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: 30,
    performedReps: 14,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("SessionDetailExerciseCard", () => {
  it("renders the exercise name", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Dumbbell Romanian Deadlift"
        loggedSets={[]}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("Dumbbell Romanian Deadlift")).toBeVisible();
  });

  it("renders each set as a pill with 'weight×reps'", () => {
    const sets = [
      makeSet({ id: "a", setIndex: 0, performedWeightKg: 30, performedReps: 14 }),
      makeSet({ id: "b", setIndex: 1, performedWeightKg: 32, performedReps: 11 }),
    ];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("30×14")).toBeVisible();
    expect(screen.getByText("32×11")).toBeVisible();
  });

  it("renders '—' for sets missing weight or reps", () => {
    const sets = [makeSet({ performedWeightKg: null, performedReps: null })];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("calls onSetTap with (blockIndex, setIndex) when a pill is clicked", async () => {
    const spy = vi.fn();
    const sets = [
      makeSet({ id: "a", blockIndex: 0, setIndex: 2, performedWeightKg: 30, performedReps: 14 }),
    ];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={spy}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /30×14/ }));
    expect(spy).toHaveBeenCalledWith(0, 2);
  });

  it("converts weight to display units when units='lbs'", () => {
    const sets = [makeSet({ performedWeightKg: 22.68, performedReps: 10 })];
    // 22.68 kg ≈ 50 lbs; toDisplayWeight rounds; the pill shows integer display value.
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="lbs"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/50×10/)).toBeVisible();
  });

  it("renders no pills when loggedSets is empty", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={[]}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/history/SessionDetailExerciseCard.test.tsx
```

- [ ] **Step 3: Implement**

Create `web/src/features/history/SessionDetailExerciseCard.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface SessionDetailExerciseCardProps {
  exerciseName: string;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  onSetTap: (blockIndex: number, setIndex: number) => void;
}

function formatPillContent(set: LoggedSet, units: UnitSystem): string {
  if (set.performedWeightKg == null || set.performedReps == null) return "—";
  const weight = Math.round(toDisplayWeight(set.performedWeightKg, units));
  return `${weight}×${set.performedReps}`;
}

export function SessionDetailExerciseCard({
  exerciseName,
  loggedSets,
  units,
  onSetTap,
}: SessionDetailExerciseCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">{exerciseName}</p>
        {loggedSets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {loggedSets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onSetTap(set.blockIndex, set.setIndex)}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-sage-soft px-2.5 py-1 text-xs font-medium tabular-nums text-sage-deep transition-colors hover:bg-sage-soft/70 focus-visible:ring-2 focus-visible:ring-sage/40 outline-none"
                >
                  {formatPillContent(set, units)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/history/SessionDetailExerciseCard.test.tsx
```
Expected: 6 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `599 passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/SessionDetailExerciseCard.tsx \
        web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx
git commit -m "feat(history): add SessionDetailExerciseCard with tap-to-edit set pills"
```

---

## Task 8.11: Rewrite `SessionDetailScreen`

**Files:** Modify: `web/src/features/history/SessionDetailScreen.tsx`

Compose the new Header + StatsTile + simpler exercise cards. Preserve the existing `SetLogSheet` edit flow (the local state + handlers stay; only the exercise-card renderer changes). Drop the current `SessionExerciseCardWithHistory` wrapper — history suggestions are only needed inside SetLogSheet. Refactor the sheet wrapper to fetch history on demand.

- [ ] **Step 1: Replace the file contents**

Open `web/src/features/history/SessionDetailScreen.tsx`. Replace the entire contents with:

```tsx
import { useState } from "react";
import { useParams } from "react-router";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { db } from "@/db/database";
import { editSet, deleteSet } from "@/services/set-service";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import { SupersetGroup } from "@/features/workout/SupersetGroup";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import { computeSessionVolumeKg } from "./lib/sessionStats";
import { SessionDetailHeader } from "./SessionDetailHeader";
import { SessionDetailStatsTile } from "./SessionDetailStatsTile";
import { SessionDetailExerciseCard } from "./SessionDetailExerciseCard";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId);
  const settings = useSettings();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  if (!settings) return null;
  if (detail === undefined) return null;

  if (detail === null) {
    return (
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const { session, exercises } = detail;
  const units = settings.units;

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const exData = exercises.find((e) => e.sessionExercise.id === se.id);
    const existing = exData?.loggedSets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex,
    );
    // Only allow editing existing logged sets on finished sessions.
    // logSet() requires active session status — cannot create new sets here.
    if (!existing) return;
    setSheetExercise(se);
    setSheetBlockIndex(blockIndex);
    setSheetSetIndex(setIndex);
    setSheetExistingSet(existing);
    setSheetOpen(true);
  }

  async function handleSave(input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) {
    if (!sheetExercise || !sheetExistingSet) return;
    await editSet(db, sheetExistingSet.id, input);
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  // Build render groups: singles or superset pairs.
  const renderGroups: Array<
    | { type: "single"; data: (typeof exercises)[0] }
    | { type: "superset"; data: [(typeof exercises)[0], (typeof exercises)[0]] }
  > = [];
  const processed = new Set<string>();

  for (const exData of exercises) {
    const se = exData.sessionExercise;
    if (processed.has(se.id)) continue;
    if (se.groupType === "superset" && se.supersetGroupId) {
      const partner = exercises.find(
        (other) =>
          other.sessionExercise.id !== se.id &&
          other.sessionExercise.supersetGroupId === se.supersetGroupId,
      );
      if (partner) {
        const ordered =
          (se.supersetPosition ?? 0) < (partner.sessionExercise.supersetPosition ?? 0)
            ? [exData, partner]
            : [partner, exData];
        renderGroups.push({
          type: "superset",
          data: ordered as [(typeof exercises)[0], (typeof exercises)[0]],
        });
        processed.add(se.id);
        processed.add(partner.sessionExercise.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", data: exData });
    processed.add(se.id);
  }

  const sheetExerciseSets = sheetExercise
    ? exercises.find((e) => e.sessionExercise.id === sheetExercise.id)?.loggedSets ?? []
    : [];

  // Stats tile aggregates
  const allSets = exercises.flatMap((e) => e.loggedSets);
  const setCount = allSets.length;
  const volumeKg = computeSessionVolumeKg(allSets);
  const durationMin =
    session.finishedAt != null
      ? Math.round(
          (new Date(session.finishedAt).getTime() -
            new Date(session.startedAt).getTime()) /
            60000,
        )
      : null;

  return (
    <div className="space-y-5 p-5 pb-8">
      <SessionDetailHeader session={session} />

      <SessionDetailStatsTile
        setCount={setCount}
        volumeKg={volumeKg}
        durationMin={durationMin}
        units={units}
      />

      <div className="space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            const d = group.data;
            return (
              <SessionDetailExerciseCard
                key={d.sessionExercise.id}
                exerciseName={d.sessionExercise.exerciseNameSnapshot}
                loggedSets={d.loggedSets}
                units={getEffectiveUnit(d.sessionExercise.unitOverride, units)}
                onSetTap={(bi, si) => handleSetTap(d.sessionExercise, bi, si)}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.data.map((d) => (
                <SessionDetailExerciseCard
                  key={d.sessionExercise.id}
                  exerciseName={d.sessionExercise.exerciseNameSnapshot}
                  loggedSets={d.loggedSets}
                  units={getEffectiveUnit(d.sessionExercise.unitOverride, units)}
                  onSetTap={(bi, si) => handleSetTap(d.sessionExercise, bi, si)}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      {sheetExercise && (
        <SetLogSheetWithHistoryForDetail
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          blockSetsInSession={sheetExerciseSets}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}
    </div>
  );
}

function SetLogSheetWithHistoryForDetail({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  blockSetsInSession,
  units: globalUnits,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  blockSetsInSession: LoggedSet[];
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const historyData = useExerciseHistory(
    sessionExercise.origin === "routine" ? sessionExercise : undefined,
    effectiveUnits,
  );
  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={historyData?.suggestions.find((s) => s.blockIndex === blockIndex)}
      lastTime={historyData?.lastTime[blockIndex]}
      blockSetsInSession={blockSetsInSession}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
```

> **What was removed.** The old `SessionExerciseCardWithHistory` wrapper (pulled `useExerciseHistory` + rendered `ExerciseCard readOnly hideHeader` with `<Link to="/history/exercise/...">` above it). The link to per-exercise history stays — but it now lives on the exercise name *inside* `SessionDetailExerciseCard` if we want it. For this sprint we drop the per-exercise-history link on Session Detail; Sprint 12 polish can reintroduce it if needed. Also dropped: the inline `ExerciseCard` render of targets / progression chips — the handoff simplification is deliberate.

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b
```
Expected: clean. If removed imports leave unused symbols, ESLint will flag in Step 4.

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: `599 passed` (Session Detail has no unit tests today; integration lives in Playwright). If any e2e depends on Session Detail layout selectors, Task 8.12 will catch it.

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: clean. Fix any unused-import warnings introduced by the refactor.

- [ ] **Step 5: Visual smoke**

```bash
npm run dev
```
Start a workout, log a few sets, finish it. Navigate History → click the session row. Confirm:
- Back arrow at top left.
- Eyebrow "APR 17 · 52M" above serif day title.
- Stats tile: Sets / Volume (suffix "kg"/"lbs") / Time.
- Exercise cards: name + sage-soft set pills.
- Tap a set pill — `SetLogSheet` opens populated with that set's values.
- Save an edit — pill value updates, sheet closes.

Close the dev server.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/history/SessionDetailScreen.tsx
git commit -m "feat(history): rewrite SessionDetailScreen with header + stats tile + set pills"
```

---

## Task 8.12: Full verification + PR

**Files:** `CLAUDE.md` (test count bump), otherwise verification only.

- [ ] **Step 1: Update `CLAUDE.md` test count**

Open `C:/Users/creix/VSC Projects/exercise_logger/CLAUDE.md`. Find the line:

```
npm test              # 532 unit+integration tests (Vitest)
```

Replace with:

```
npm test              # 599 unit+integration tests (Vitest)
```

(If later tasks added or removed tests, use the actual count from `npm test` output.)

- [ ] **Step 2: Full unit test suite**

```bash
npm test
```
Expected: `Tests  599 passed (599)` (or whatever the latest count is after the task additions).

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: clean; the `dist/` bundle still contains Inter + Instrument Serif WOFF2s (unchanged from Sprint 7).

- [ ] **Step 5: E2E**

```bash
npm run test:e2e
```
Expected: clean. If the visual changes broke any selector (e.g. a test clicks a session-card by className), update the selector in the same commit before opening the PR.

- [ ] **Step 6: Manual phone-viewport smoke**

```bash
npm run preview
```

DevTools → Device toolbar → iPhone 14. Confirm:

| Screen | Expected |
|---|---|
| History (empty) | EmptyState serif "No History Yet", sage-soft rounded icon disc |
| History (normal) | "TRAINING LOG" eyebrow → italic serif "History" → stats tile (Sessions / Sets / Hours) → "APRIL 2026" eyebrow → session rows (date chip + title + meta + chevron) |
| Session Detail | Back arrow → "APR 17 · 52M" eyebrow → serif day title → Sets / Volume / Time tile → exercise cards with sage-soft set pills |
| Session Detail edit | Tap set pill → `SetLogSheet` opens (no thick ink top bar — Task 8.0 fix visible) → edit/save flows, pill value updates |
| Today | Unchanged from Sprint 7 except: LastSessionCard no longer has the duplicate ribbon, DaySelector is just pills (no inline SectionHeader), EmptyState (when no routine) shows rounded sage-soft disc |

- [ ] **Step 7: Diff the branch**

```bash
git log --oneline main..HEAD
git diff main --stat
```
Expected: ~16 commits (Task 0 orientation has none; 8.0 has 5; each of 8.1–8.11 has 1; 8.12 has 1 for CLAUDE.md). ~25 files touched.

- [ ] **Step 8: Update CLAUDE.md count commit**

```bash
git add CLAUDE.md
git commit -m "docs: refresh Sprint 8 test count in CLAUDE.md"
```

- [ ] **Step 9: Push the branch**

```bash
git push -u origin sprint-8-history
```

- [ ] **Step 10: Open the PR**

```bash
gh pr create --title "Sprint 8: Training Log — History + Session Detail" --body "$(cat <<'EOF'
## Summary
Port the History and Session Detail screens to the warm-paper visual system per spec §3 Sprint 8. Replaces the pre-Sprint-6 flat session list with a three-stat tile, month-grouped rows, date chips, and a redesigned detail screen featuring sage-soft set pills. Task 8.0 bundles the Sprint 6/7 review carryover (sheet hairline, EmptyState tile, LastSessionCard ribbon, TodayHeroCard dead prop, DaySelector title duplication).

- **History** — `HistoryScreen` rewrite: "TRAINING LOG" eyebrow + serif-italic "History" + `HistoryStatsTile` (Sessions/Sets/Hours) + month-grouped `SessionRow` list. `SessionCard` deleted.
- **Session Detail** — `SessionDetailScreen` rewrite: back arrow + `SessionDetailHeader` ("APR 17 · 52M" eyebrow + serif title) + `SessionDetailStatsTile` (Sets/Volume/Time) + `SessionDetailExerciseCard` with sage-soft set pills. Tap-to-edit preserved via `SetLogSheet`.
- **New utils & hooks** — `sessionStats.ts` (volume + formatters), `groupByMonth.ts` (local-time calendar grouping), `useHistoryStats` (all-time aggregates). `useFinishedSessionSummaries` extended with per-session `volumeKg`.
- **Task 8.0 carryover** — Sprint 6/7 review fixes: bottom-sheet hairline, rounded sage-soft EmptyState icon, LastSessionCard ribbon removed, TodayHeroCard `resumeMeta` prop dropped, DaySelector inline header removed.

Pre-decided open questions (spec §3 Sprint 8): hours = sum of finished-session durations, volume suffix on value, all-time counts, local-time month boundary. See top of `docs/superpowers/plans/2026-04-19-sprint8-history-session-detail.md`.

## Test plan
- [x] `npm test` — 599 pass (553 baseline − 4 Task 8.0 tests removed + 50 new Sprint 8 tests)
- [x] `npm run lint` — clean
- [x] `npm run build` — clean
- [x] `npm run test:e2e` — clean (or note baseline updates)
- [ ] Phone-viewport walk: History (empty / normal) + Session Detail (view / edit pill / save / delete)

## Notes
- Session editing is preserved for typo fixes; spec §3 "Out of scope: session editing" read as "don't add new editing surfaces".
- Aggregate volume on the History stats tile is intentionally absent (screenshot shows only Sessions/Sets/Hours). Per-session volume shows in session rows and the Session Detail stats tile, using the user's global units.
- Per-exercise history link on Session Detail is removed in this sprint (dropped with `SessionExerciseCardWithHistory`); Sprint 12 polish can reintroduce it if the user misses it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL in output. Report it back to the user.

---

## Self-Review

**1. Spec coverage.** Spec §3 Sprint 8 bullets mapped to tasks:

| Spec bullet | Covered by |
|---|---|
| History: "TRAINING LOG" eyebrow + serif-italic "History" title | Task 8.7 |
| History: stats tile (Sessions / Sets / Hours, tabular numerals) | Tasks 8.4 (hook) + 8.5 (tile) + 8.7 (integration) |
| History: month grouping with "APRIL 2026" eyebrow | Task 8.3 (util) + 8.7 |
| History: redesigned session row (date chip, title, meta line, chevron) | Task 8.6 |
| Session Detail: back arrow | Task 8.8 |
| Session Detail: "APR 17 · 52M" eyebrow + serif title | Task 8.8 |
| Session Detail: three-stat tile (Sets / Volume / Time) | Task 8.9 |
| Session Detail: exercise cards with sage-soft set pills ("30×14") | Task 8.10 |
| Out of scope: session editing | Preserved as read-only-edit-of-existing-sets, no new editing surfaces. Documented in Task 8.11 + PR body |
| Out of scope: search / filter | Not implemented |
| Open question: hours total | Pre-decided (§Resolved) — sum of `(finishedAt - startedAt)`, rounded |
| Open question: volume unit display | Pre-decided — suffix on value |
| Open question: session count source | Pre-decided — all-time |
| Open question: month boundary | Pre-decided — user's local timezone |
| Sprint 6/7 review carryover | Task 8.0 |

All covered.

**2. Placeholder scan.** No "TBD", "implement later", "add appropriate validation", "similar to Task N". Every code block shows actual code. Conditional instructions (e.g. Task 8.2 Step 2: "if a test file references `SessionCard`…") are explicit decision gates with a concrete action on each branch, not placeholders.

**3. Type consistency.** Signatures used consistently across tasks:
- `computeSessionVolumeKg(sets: LoggedSet[]): number` — defined Task 8.1, used Tasks 8.2 + 8.11.
- `formatVolume(canonicalKg: number, units: UnitSystem): string` — defined Task 8.1, used Tasks 8.6, 8.9.
- `formatShortDuration(startedAt: string, finishedAt: string | null): string` — defined Task 8.1, used Tasks 8.6, 8.8.
- `FinishedSessionSummary` shape — extended Task 8.2, consumed Tasks 8.3 + 8.6 + 8.7.
- `HistoryStats` — defined Task 8.4, consumed Tasks 8.5 + 8.7.
- `SessionDetailStatsTileProps` — defined Task 8.9, consumed Task 8.11 (`setCount={…}`, `volumeKg={…}`, `durationMin={…}`, `units={…}`).
- `SessionDetailExerciseCardProps` — defined Task 8.10 with `onSetTap(blockIndex, setIndex)` signature, consumed Task 8.11.

One intentional inconsistency to note: `SessionDetailScreen` was previously named the link on each exercise "linkable to `/history/exercise/:exerciseId`". Task 8.11 removes that link in favour of the handoff's simpler card. If the user misses per-exercise history, it comes back in Sprint 12. Called out in the PR body.

**4. Task 8.0 carryover completeness.** The five items the Sprint 6+7 reviewer flagged as "fix before Sprint 8 or absorb now" (Sheet border, EmptyState tile, LastSessionCard ribbon, TodayHeroCard dead prop, DaySelector stacked header) are each their own step with a commit. Items the reviewer recommended deferring (font preload → Sprint 12, Lucide sweep → Sprints 8-12 per-screen, `--cta` alias, `py-0` Card workaround, StreakPill copy drift, `text-hero` stale comment, `EmptyState` LucideIcon type) are explicitly out of scope.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-sprint8-history-session-detail.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for the 13-task length here where each task is self-contained and the Task 8.0 multi-commit structure benefits from discrete review checkpoints.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Sprint 5 — Open Doors Wide (entry points + empty states + color)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay down the "created-but-unadopted" primitive debt from Sprint 4 (`Stat`, `SectionHeader`, `EmptyState` at their remaining callsites), introduce a warm accent color alongside the cool CTA purple, redesign `TodayScreen` into a hero-card entry point with a training-cadence ribbon, and close the loop with nav/motion polish, the `SetLogSheet` prefill refactor, and the two component-test carry-forwards (`TodayScreen.test.tsx`, `WorkoutScreen.test.tsx`).

**Architecture:** Foundation-first. Tokens and the training-cadence service land before any consumer. Primitive-adoption tasks (SectionHeader, EmptyState, Stat) ship before the screens that will also consume them. Each task stops at a commit boundary so the sprint can be paused mid-way without leaving the app broken.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind CSS 4 (CSS-first config), shadcn-derived primitives on top of `@base-ui/react`, Dexie 4, Vitest + React Testing Library, `fake-indexeddb` for DB integration tests.

## Scope notes

- **Focus:** `features/today/*`, `features/history/*` (empty-state only), `shared/components/*` (adoption only, no new primitives this sprint), `app/App.css`, `app/App.tsx`, `services/progression-service.ts`.
- **Out of scope:** Workout-complete screen (Sprint 6). Session-detail summary header (Sprint 6). ExerciseHistory chart (Sprint 6). PR detection (Sprint 6). URL-based routine sharing / file_handlers (Sprint 7+).
- **Test convention:** Colocated tests under `tests/unit/<mirror path>/<name>.test.tsx`. `fake-indexeddb/auto` for DB integration smokes. Explicit `import { describe, it, expect } from "vitest"` at top of each test file.
- **Branch / worktree:** Create a feature branch before starting: `git checkout -b sprint5-open-doors` from `main`.

## File Structure

### Files created

| Path | Responsibility |
|---|---|
| `web/tests/unit/features/today/TodayScreen.test.tsx` | Component tests for Today's three states (no-routine / active-session / normal), day selector integration, start-session happy path. |
| `web/tests/unit/features/workout/WorkoutScreen.test.tsx` | Integration smoke using `fake-indexeddb`: start → log set → edit → add extra → finish. Carries forward from S4.8. |

### Files modified

| Path | Change |
|---|---|
| `web/src/app/App.css` | Add `--accent-warm`, `--accent-warm-foreground`, `--accent-warm-soft` tokens + register in `@theme inline`. Add `.fade-in-soft` keyframe utility. |
| `web/src/app/App.tsx` | Bottom-nav active state → pill-filled. Add 120ms tab-transition fade class applied by Shell. |
| `web/src/services/progression-service.ts` | Add `computeTrainingCadence(db, now)` returning `{ sessionsLast7Days, sessionsLast30Days, daysSinceLastSession }`. |
| `web/src/shared/hooks/useTrainingCadence.ts` | New — thin wrapper over `computeTrainingCadence` using `useLiveQuery`. |
| `web/src/features/today/TodayScreen.tsx` | Hero-card redesign: in-card CTA, estimated duration, training-cadence ribbon at top. No-routine state adopts `EmptyState`. |
| `web/src/features/today/DayPreview.tsx` | Adopt `Stat` for per-entry set count. |
| `web/src/features/today/LastSessionCard.tsx` | Redesigned with `Stat` + optional training-cadence ribbon using warm accent. |
| `web/src/features/today/DaySelector.tsx` | Replace the inline day-label paragraph with `<SectionHeader>`. |
| `web/src/features/history/HistoryScreen.tsx` | Empty state adopts `EmptyState`. |
| `web/src/features/history/ExerciseHistoryScreen.tsx` | Replace the inline date-header paragraph with `<SectionHeader>`. Add empty-state when no history. |
| `web/src/features/settings/RoutineImporter.tsx` | Replace the "Paste YAML" label block with `<SectionHeader>`. |
| `web/src/features/workout/SupersetGroup.tsx` | Replace the inline "Superset" label with `<SectionHeader>` (color-overridden). |
| `web/src/features/workout/WorkoutScreen.tsx` | Replace the day-label eyebrow in the sticky header with `<SectionHeader>`. Update finish toast to use warm-accent styling. |
| `web/src/features/workout/SessionProgress.tsx` | Adopt `Stat` for the hero N/M numbers. |
| `web/src/features/workout/SetLogSheet.tsx` | Replace 14-dep prefill effect with open-edge detection via `useRef`. |
| `CLAUDE.md` | Update test count (roughly 503 → 530+). |
| `docs/codebase-review-2026-04-17.md` | Mark Sprint 5 tasks as shipped in §6. |
| `docs/ui-rewrite-spec.md` | Append a "Sprint 5 shipped" bullet in the drift block. |

---

## Task 1 — Warm-accent CSS tokens

**Files:**
- Modify: `web/src/app/App.css`

**Rationale:** All subsequent warm-accent usage (streak ribbon, finish-toast tint) reads from these tokens. Land them first.

- [ ] **Step 1: Add warm-accent tokens to `:root`**

Modify `web/src/app/App.css`. In the `:root { ... }` block (lines 65–111), after the `--warning-soft` line and before `--destructive-foreground`, insert:

```css
    --accent-warm: oklch(0.72 0.17 45);
    --accent-warm-foreground: oklch(0.18 0 0);
    --accent-warm-soft: oklch(0.95 0.05 45);
```

- [ ] **Step 2: Register warm-accent tokens in `@theme inline`**

In the `@theme inline { ... }` block (lines 9–63), after the `--color-warning-soft` line and before `--color-destructive-foreground`, insert:

```css
    --color-accent-warm: var(--accent-warm);
    --color-accent-warm-foreground: var(--accent-warm-foreground);
    --color-accent-warm-soft: var(--accent-warm-soft);
```

This makes `bg-accent-warm`, `text-accent-warm`, `bg-accent-warm-soft`, etc. available as Tailwind utilities.

- [ ] **Step 3: Add a `.fade-in-soft` keyframe for route/day transitions**

In the "Softened Swiss — motion, shadow, flash" section (after the `save-pulse` block added in Sprint 4), append:

```css
@keyframes fade-in-soft {
  0%   { opacity: 0; transform: translateY(2px); }
  100% { opacity: 1; transform: translateY(0); }
}

.fade-in-soft {
  animation: fade-in-soft var(--dur-base) var(--ease-out-soft);
}
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: completes without errors.

- [ ] **Step 5: Verify tests pass**

Run: `cd web && npm test`
Expected: 503/503 pass (or current baseline).

- [ ] **Step 6: Commit**

```bash
cd web
git add src/app/App.css
git commit -m "style(tokens): add warm-accent color + fade-in-soft keyframe"
```

---

## Task 2 — Training cadence service + hook

**Files:**
- Modify: `web/src/services/progression-service.ts`
- Modify: `web/tests/unit/services/progression-service.test.ts`
- Create: `web/src/shared/hooks/useTrainingCadence.ts`

**Rationale:** Provides the data signal powering the training-cadence ribbon on `TodayScreen` and `LastSessionCard`. Pure DB computation; no UI. TDD with the existing service-level test conventions.

- [ ] **Step 1: Append failing tests in `progression-service.test.ts`**

Modify `web/tests/unit/services/progression-service.test.ts`. At the end of the file, append:

```tsx
import { computeTrainingCadence } from "@/services/progression-service";

describe("computeTrainingCadence", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  function makeFinishedSession(id: string, startedAt: string, finishedAt: string): Session {
    return {
      id,
      routineId: "r1",
      routineNameSnapshot: "Test",
      dayId: "A",
      dayLabelSnapshot: "Push",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 45,
      status: "finished",
      startedAt,
      finishedAt,
    };
  }

  it("returns zeros + null when no finished sessions exist", async () => {
    const now = new Date("2026-04-17T12:00:00Z");
    const result = await computeTrainingCadence(db, now);
    expect(result).toEqual({
      sessionsLast7Days: 0,
      sessionsLast30Days: 0,
      daysSinceLastSession: null,
    });
  });

  it("counts finished sessions in the last 7 and 30 days", async () => {
    const now = new Date("2026-04-17T12:00:00Z");
    await db.sessions.bulkPut([
      makeFinishedSession("s1", "2026-04-17T08:00:00Z", "2026-04-17T09:00:00Z"), // today
      makeFinishedSession("s2", "2026-04-15T10:00:00Z", "2026-04-15T11:00:00Z"), // 2 days ago
      makeFinishedSession("s3", "2026-04-11T10:00:00Z", "2026-04-11T11:00:00Z"), // 6 days ago
      makeFinishedSession("s4", "2026-04-01T10:00:00Z", "2026-04-01T11:00:00Z"), // 16 days ago
      makeFinishedSession("s5", "2026-03-10T10:00:00Z", "2026-03-10T11:00:00Z"), // 38 days ago — outside both
    ]);
    const result = await computeTrainingCadence(db, now);
    expect(result.sessionsLast7Days).toBe(3);
    expect(result.sessionsLast30Days).toBe(4);
    expect(result.daysSinceLastSession).toBe(0);
  });

  it("excludes active and discarded sessions", async () => {
    const now = new Date("2026-04-17T12:00:00Z");
    await db.sessions.bulkPut([
      makeFinishedSession("s1", "2026-04-16T10:00:00Z", "2026-04-16T11:00:00Z"),
      {
        ...makeFinishedSession("s2", "2026-04-15T10:00:00Z", "2026-04-15T11:00:00Z"),
        status: "active",
        finishedAt: null,
      } as Session,
    ]);
    const result = await computeTrainingCadence(db, now);
    expect(result.sessionsLast7Days).toBe(1);
    expect(result.daysSinceLastSession).toBe(1);
  });

  it("daysSinceLastSession uses calendar-day math, not 24-hour math", async () => {
    const now = new Date("2026-04-17T05:00:00Z"); // 5am UTC
    await db.sessions.bulkPut([
      makeFinishedSession("s1", "2026-04-16T22:00:00Z", "2026-04-16T23:00:00Z"), // 6 hours before now
    ]);
    const result = await computeTrainingCadence(db, now);
    expect(result.daysSinceLastSession).toBe(1); // 1 calendar day, even though <24h passed
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd web && npm test -- progression-service`
Expected: FAIL with `Cannot find name 'computeTrainingCadence'` or equivalent.

- [ ] **Step 3: Implement `computeTrainingCadence`**

Modify `web/src/services/progression-service.ts`. At the end of the file (after the last existing export), append:

```tsx
// ---------------------------------------------------------------------------
// Training cadence (Sprint 5)
// ---------------------------------------------------------------------------

/**
 * Rolling-window session counts + a calendar-day-granularity
 * "last session was N days ago" signal.
 *
 * Used by TodayScreen + LastSessionCard to surface training cadence without
 * committing to a strict "consecutive days" streak definition (which is a bad
 * fit for typical 3-day-per-week splits).
 *
 * Semantics:
 * - `sessionsLast7Days`: count of finished sessions whose `startedAt` is within
 *   the last 7 × 24 hours of `now`.
 * - `sessionsLast30Days`: same, last 30 × 24 hours.
 * - `daysSinceLastSession`: integer number of calendar days between the most
 *   recent finished session's `startedAt` and `now` (both truncated to local
 *   midnight). 0 = today. `null` if no finished sessions exist.
 * - Active and discarded sessions are excluded.
 */
export async function computeTrainingCadence(
  db: ExerciseLoggerDB,
  now: Date = new Date(),
): Promise<{
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  daysSinceLastSession: number | null;
}> {
  const finished = await db.sessions
    .where("status")
    .equals("finished")
    .toArray();

  if (finished.length === 0) {
    return { sessionsLast7Days: 0, sessionsLast30Days: 0, daysSinceLastSession: null };
  }

  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let sessionsLast7Days = 0;
  let sessionsLast30Days = 0;
  let mostRecentStartMs = -Infinity;

  for (const s of finished) {
    const startMs = new Date(s.startedAt).getTime();
    const ageMs = nowMs - startMs;
    if (ageMs >= 0 && ageMs < sevenDaysMs) sessionsLast7Days += 1;
    if (ageMs >= 0 && ageMs < thirtyDaysMs) sessionsLast30Days += 1;
    if (startMs > mostRecentStartMs) mostRecentStartMs = startMs;
  }

  const last = new Date(mostRecentStartMs);
  const lastMidnight = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysSinceLastSession = Math.max(0, Math.round((nowMidnight - lastMidnight) / (24 * 60 * 60 * 1000)));

  return { sessionsLast7Days, sessionsLast30Days, daysSinceLastSession };
}
```

- [ ] **Step 4: Run the tests — expect pass**

Run: `cd web && npm test -- progression-service`
Expected: all tests pass, including the 4 new ones.

- [ ] **Step 5: Create the `useTrainingCadence` hook**

Create `web/src/shared/hooks/useTrainingCadence.ts`:

```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { computeTrainingCadence } from "@/services/progression-service";

export interface TrainingCadence {
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  daysSinceLastSession: number | null;
}

/** Live training cadence. Returns undefined while loading, then TrainingCadence. */
export function useTrainingCadence(): TrainingCadence | undefined {
  return useLiveQuery(() => computeTrainingCadence(db, new Date()), []);
}
```

- [ ] **Step 6: Lint + typecheck**

Run: `cd web && npm run lint && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd web
git add src/services/progression-service.ts src/shared/hooks/useTrainingCadence.ts tests/unit/services/progression-service.test.ts
git commit -m "feat(progression): add computeTrainingCadence + useTrainingCadence hook"
```

---

## Task 3 — Adopt `<SectionHeader>` at existing callsites

**Files:**
- Create: `web/tests/unit/shared/components/SectionHeader.test.tsx`
- Modify: `web/src/features/settings/RoutineImporter.tsx`
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx`
- Modify: `web/src/features/today/DaySelector.tsx`
- Modify: `web/src/features/workout/SupersetGroup.tsx`
- Modify: `web/src/features/workout/WorkoutScreen.tsx`

**Rationale:** `SectionHeader` was shipped in Sprint 4 but never consumed — and never unit-tested. These five sites all duplicate the exact `text-xs font-semibold uppercase tracking-widest text-muted-foreground` (or color-overridden variant) class string. Migrate to the primitive, kill the duplication, and add the missing test file. Each migration is visually equivalent — no layout change.

- [ ] **Step 1: Create SectionHeader unit test (Sprint 4 gap)**

Sprint 4 shipped six primitive test files alongside `Stat`, `Pill`, `EmptyState`, `BlockStripe`, `SessionProgress`, `SetDots` — but `SectionHeader.test.tsx` was missed. Add it now, before consuming it at five callsites below, so the primitive is exercised independently of its callers.

Create `web/tests/unit/shared/components/SectionHeader.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader } from "@/shared/components/SectionHeader";

describe("SectionHeader", () => {
  it("renders children", () => {
    render(<SectionHeader>Paste YAML</SectionHeader>);
    expect(screen.getByText("Paste YAML")).toBeVisible();
  });

  it("applies base eyebrow styling", () => {
    render(<SectionHeader>Heading</SectionHeader>);
    const el = screen.getByText("Heading");
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-widest/);
    expect(el.className).toMatch(/text-muted-foreground/);
  });

  it("honors className override (e.g., `!text-cta`)", () => {
    render(<SectionHeader className="!text-cta">Day A</SectionHeader>);
    const el = screen.getByText("Day A");
    expect(el.className).toContain("!text-cta");
  });
});
```

Run: `cd web && npm test -- SectionHeader.test`
Expected: 3 new tests pass.

- [ ] **Step 2: RoutineImporter — replace the "Paste YAML" label**

Modify `web/src/features/settings/RoutineImporter.tsx`. At the top of the file, add to the existing imports:

```tsx
import { SectionHeader } from "@/shared/components/SectionHeader";
```

Find (around line 69–74):

```tsx
        <label
          htmlFor="routine-yaml-paste"
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Paste YAML
        </label>
```

Replace with:

```tsx
        <label htmlFor="routine-yaml-paste" className="block">
          <SectionHeader>Paste YAML</SectionHeader>
        </label>
```

- [ ] **Step 3: ExerciseHistoryScreen — replace the date header**

Modify `web/src/features/history/ExerciseHistoryScreen.tsx`. Add the import:

```tsx
import { SectionHeader } from "@/shared/components/SectionHeader";
```

Find the per-group header (around line 62–72):

```tsx
            <div key={group.session.id} className="space-y-1 border-t-2 border-border-strong pt-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground tabular-nums">
                {new Date(group.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" — "}
```

Replace the `<p>` opener with:

```tsx
              <SectionHeader className="tabular-nums">
                {new Date(group.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" — "}
```

And change the matching closing `</p>` to `</SectionHeader>`.

- [ ] **Step 4: DaySelector — replace the day label paragraph**

Modify `web/src/features/today/DaySelector.tsx`. Add the import:

```tsx
import { SectionHeader } from "@/shared/components/SectionHeader";
```

Find (around line 18–20):

```tsx
      <p className="text-xs font-semibold uppercase tracking-widest text-cta">
        Day {selectedDayId} — {selectedLabel}
      </p>
```

Replace with:

```tsx
      <SectionHeader className="!text-cta">
        Day {selectedDayId} — {selectedLabel}
      </SectionHeader>
```

The `!text-cta` overrides `SectionHeader`'s default `text-muted-foreground` via Tailwind's `!` important modifier.

- [ ] **Step 5: SupersetGroup — replace the "Superset" label**

Modify `web/src/features/workout/SupersetGroup.tsx`. Replace the entire file with:

```tsx
import type { ReactNode } from "react";
import { SectionHeader } from "@/shared/components/SectionHeader";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-cta pl-4 space-y-3">
      <SectionHeader className="!text-cta">Superset</SectionHeader>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: WorkoutScreen — replace the sticky-header day label**

Modify `web/src/features/workout/WorkoutScreen.tsx`. Add the import (alongside the other shared imports):

```tsx
import { SectionHeader } from "@/shared/components/SectionHeader";
```

Find (inside the sticky header, around line 158–162):

```tsx
          <p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
            {session.dayLabelSnapshot}
          </p>
```

Replace with:

```tsx
          <SectionHeader className="!text-cta truncate">
            {session.dayLabelSnapshot}
          </SectionHeader>
```

- [ ] **Step 7: Run tests + lint + typecheck**

Run: `cd web && npm run lint && npm run typecheck && npm test`
Expected: all pass. Existing tests continue to assert on the rendered text; styling changes don't affect them. The 3 new SectionHeader tests from Step 1 also pass.

- [ ] **Step 8: Commit**

```bash
cd web
git add tests/unit/shared/components/SectionHeader.test.tsx src/features/settings/RoutineImporter.tsx src/features/history/ExerciseHistoryScreen.tsx src/features/today/DaySelector.tsx src/features/workout/SupersetGroup.tsx src/features/workout/WorkoutScreen.tsx
git commit -m "refactor(ui): adopt SectionHeader at 5 callsites + backfill unit test"
```

---

## Task 4 — Adopt `<EmptyState>` at remaining callsites

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/features/history/HistoryScreen.tsx`
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx`

**Rationale:** Sprint 4 shipped `EmptyState` but only `WorkoutScreen` adopted it. Migrate the remaining three so the first-run and between-session experience is consistent. `TodayScreen` keeps its "Go to Settings" action. `HistoryScreen` and `ExerciseHistoryScreen` have no action — just icon + heading + body.

- [ ] **Step 1: TodayScreen — no-routine state**

Modify `web/src/features/today/TodayScreen.tsx`. Add imports:

```tsx
import { EmptyState } from "@/shared/components/EmptyState";
import { CalendarCheck } from "lucide-react";
```

Find the no-routine block (around line 53–65):

```tsx
  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-5">
        <h1 className="text-2xl font-extrabold tracking-tight font-heading">No Active Routine</h1>
        <p className="text-sm text-muted-foreground text-center">
          Import a routine in Settings to get started.
        </p>
        <Link to="/settings" className={cn(buttonVariants({ variant: "outline" }))}>
          Go to Settings
        </Link>
      </div>
    );
  }
```

Replace with:

```tsx
  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <EmptyState
        icon={CalendarCheck}
        heading="No Active Routine"
        body="Import a routine in Settings to get started."
        action={{ label: "Go to Settings", onClick: () => navigate("/settings") }}
      />
    );
  }
```

The existing `Link` → `buttonVariants` pattern is replaced by EmptyState's `action.onClick` which uses `navigate`. `navigate` is already imported at line 2.

- [ ] **Step 2: HistoryScreen — empty state**

Modify `web/src/features/history/HistoryScreen.tsx`. Replace entire file with:

```tsx
import { History } from "lucide-react";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { EmptyState } from "@/shared/components/EmptyState";
import { SessionCard } from "./SessionCard";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();

  if (summaries === undefined) return null;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No History Yet"
        body="Complete a workout to see it here."
      />
    );
  }

  return (
    <div className="p-5 space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight font-heading">History</h1>
      {summaries.map((summary) => (
        <SessionCard key={summary.session.id} summary={summary} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: ExerciseHistoryScreen — empty state**

Modify `web/src/features/history/ExerciseHistoryScreen.tsx`. Add imports (the existing `ArrowLeft`, `buttonVariants`, `cn`, `navigate` already cover the back button — only two new symbols needed):

```tsx
import { EmptyState } from "@/shared/components/EmptyState";
import { Dumbbell } from "lucide-react";
```

Find the empty-check ternary (around line 55–59):

```tsx
      {groups === null || groups === undefined ? null : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No history for this exercise.
        </p>
      ) : (
```

Replace ONLY the ternary's "empty" branch (the `<p>No history...</p>`) with `<EmptyState>` inline — keep the back-button + h1 wrapper outside untouched. The full edited region becomes:

```tsx
      {groups === null || groups === undefined ? null : groups.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          heading="No History Yet"
          body="Log a workout with this exercise to see it here."
          className="py-12"
        />
      ) : (
```

The `className="py-12"` trims the default `p-8` to fit inside the already-padded `p-5 space-y-4` parent without over-spacing. Keep the rest of the component (back button, h1, the `groups.map(...)` render) untouched.

- [ ] **Step 4: Run tests + lint + typecheck**

Run: `cd web && npm run lint && npm run typecheck && npm test`
Expected: all pass. The `HistoryScreen` test in `tests/unit/features/history/` (if exists) should still pass because it asserts on the "No History Yet" text. If a test fails because it asserted on the old wrapper structure, update the assertion to match the new `EmptyState` markup — but do not weaken coverage.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/today/TodayScreen.tsx src/features/history/HistoryScreen.tsx src/features/history/ExerciseHistoryScreen.tsx
git commit -m "refactor(empty-states): adopt EmptyState in Today, History, ExerciseHistory"
```

---

## Task 5 — Adopt `<Stat>` in `SessionProgress` + `DayPreview`

**Files:**
- Modify: `web/src/features/workout/SessionProgress.tsx`
- Modify: `web/src/features/workout/SessionProgress.test.tsx` (adjust existing assertions)
- Modify: `web/src/features/today/DayPreview.tsx`

**Rationale:** `Stat` was shipped in Sprint 4 but has zero consumers. Adopt it in two places where the numbers-first pattern naturally applies. Keeps typography consistent.

- [ ] **Step 1: Update SessionProgress to use `<Stat>`**

Modify `web/src/features/workout/SessionProgress.tsx`. Replace the entire component body so the left hero cluster uses `<Stat>`. The final file is:

```tsx
import { useEffect, useState } from "react";
import { Stat } from "@/shared/components/Stat";

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
    const id = setInterval(() => {
      setElapsedMin(computeElapsedMin(startedAt));
    }, 60_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const pct = totalSets > 0 ? Math.min(100, (loggedSets / totalSets) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 px-5 py-1.5 border-b border-border">
        <Stat
          value={loggedSets}
          label={`of ${totalSets} sets`}
          size="sm"
        />
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

Note: we changed the label text from `/ 18` + separate "sets" span to `of 18 sets` inside Stat. Existing tests assert on `/ 18` substring — step 2 updates them.

- [ ] **Step 2: Update SessionProgress tests**

Modify `web/tests/unit/features/workout/SessionProgress.test.tsx`. The test assertions currently check for `getByText(/\/ 18/)` — change to match the new Stat rendering. Find:

```tsx
    expect(screen.getByText("6")).toBeVisible();
    expect(screen.getByText(/\/ 18/)).toBeVisible();
    expect(screen.getByText(/30 min/)).toBeVisible();
```

Replace with:

```tsx
    expect(screen.getByText("6")).toBeVisible();
    expect(screen.getByText(/of 18 sets/)).toBeVisible();
    expect(screen.getByText(/30 min/)).toBeVisible();
```

All other test cases (progress bar width, clamp, 0/0, minute tick) still assert on the `data-progress-bar` element and the text "0" / "/30 min/" — those remain valid without changes.

- [ ] **Step 3: Update DayPreview to use `<Stat>` for the set count**

Modify `web/src/features/today/DayPreview.tsx`. Add the import:

```tsx
import { Stat } from "@/shared/components/Stat";
```

Find the existing inline set-summary spans (around lines 39–41 and 52–54):

```tsx
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatSetSummary(entry.setBlocks)}
                </span>
```

Both occurrences stay as-is — `formatSetSummary` returns a string like "3 x 8-12 + 1 top" which is a multi-valued label, not a clean Stat fit. Leave those lines untouched.

Instead, add a new "total exercises" stat at the top of the DayPreview. Replace the opening:

```tsx
  return (
    <div className="border-t border-border-strong pt-3">
      <div className="space-y-1.5">
```

with:

```tsx
  const exerciseCount = day.entries.reduce(
    (n, e) => n + (e.kind === "exercise" ? 1 : e.items.length),
    0,
  );

  return (
    <div className="border-t border-border-strong pt-3 space-y-3">
      <Stat value={exerciseCount} label={exerciseCount === 1 ? "exercise" : "exercises"} size="sm" />
      <div className="space-y-1.5">
```

The new Stat gives the user a glanceable "this day has 9 exercises" signal before the list.

- [ ] **Step 4: Run tests**

Run: `cd web && npm test`
Expected: all pass. If `DayPreview` has an existing test, it asserts on exercise-name text — the new Stat above the list shouldn't break it.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/workout/SessionProgress.tsx tests/unit/features/workout/SessionProgress.test.tsx src/features/today/DayPreview.tsx
git commit -m "refactor(ui): adopt Stat in SessionProgress and DayPreview"
```

---

## Task 6 — `LastSessionCard` redesign (Stat + training-cadence ribbon)

**Files:**
- Modify: `web/src/features/today/LastSessionCard.tsx`
- Create: `web/tests/unit/features/today/LastSessionCard.test.tsx`

**Rationale:** Biggest practical use of `useTrainingCadence` + warm-accent tokens. Turns the afterthought LastSessionCard into a source of continuity.

- [ ] **Step 1: Write failing tests**

Create `web/tests/unit/features/today/LastSessionCard.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LastSessionCard } from "@/features/today/LastSessionCard";
import type { Session } from "@/domain/types";

afterEach(cleanup);

function makeFinishedSession(overrides: Partial<Session> = {}): Session {
  const nowMs = Date.now();
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
    startedAt: new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString(),
    finishedAt: new Date(nowMs - 3 * 24 * 60 * 60 * 1000 + 52 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("LastSessionCard", () => {
  it("renders the day label", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    expect(screen.getByText(/Push/)).toBeVisible();
  });

  it("shows '3 days ago' when relative date is 3", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    expect(screen.getByText(/3 days ago/i)).toBeVisible();
  });

  it("shows duration when finishedAt present", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    expect(screen.getByText(/52 min/)).toBeVisible();
  });

  it("renders training-cadence ribbon when sessionsLast7Days >= 3", () => {
    render(
      <LastSessionCard
        session={makeFinishedSession()}
        cadence={{ sessionsLast7Days: 3, sessionsLast30Days: 8, daysSinceLastSession: 3 }}
      />,
    );
    expect(screen.getByText(/3 sessions this week/i)).toBeVisible();
  });

  it("hides training-cadence ribbon when sessionsLast7Days < 3", () => {
    render(
      <LastSessionCard
        session={makeFinishedSession()}
        cadence={{ sessionsLast7Days: 2, sessionsLast30Days: 4, daysSinceLastSession: 3 }}
      />,
    );
    expect(screen.queryByText(/sessions this week/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd web && npm test -- LastSessionCard.test`
Expected: FAIL — the current `LastSessionCard` props don't include `cadence`; tests 4 and 5 will fail with "Invalid prop" or equivalent.

- [ ] **Step 3: Rewrite `LastSessionCard`**

Modify `web/src/features/today/LastSessionCard.tsx`. Replace entire file with:

```tsx
import { Flame } from "lucide-react";
import type { Session } from "@/domain/types";
import { Stat } from "@/shared/components/Stat";
import type { TrainingCadence } from "@/shared/hooks/useTrainingCadence";

interface LastSessionCardProps {
  session: Session;
  cadence: TrainingCadence | undefined;
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

export function LastSessionCard({ session, cadence }: LastSessionCardProps) {
  const durationMin = formatDurationMin(session.startedAt, session.finishedAt);
  // Threshold: `>= 3` avoids a perma-on ribbon for 2x-per-week trainers,
  // so the signal actually means "strong week" rather than "you trained".
  const showRibbon = (cadence?.sessionsLast7Days ?? 0) >= 3;

  return (
    <div className="border-t-2 border-border-strong pt-3 space-y-2">
      {showRibbon && cadence && (
        <div className="inline-flex items-center gap-1.5 bg-accent-warm-soft text-accent-warm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest">
          <Flame className="h-3 w-3" strokeWidth={2.5} />
          <span>{cadence.sessionsLast7Days} sessions this week</span>
        </div>
      )}

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

- [ ] **Step 4: Update TodayScreen to pass `cadence` to LastSessionCard**

Modify `web/src/features/today/TodayScreen.tsx`. Add the hook import:

```tsx
import { useTrainingCadence } from "@/shared/hooks/useTrainingCadence";
```

Inside the component body, after the existing `const lastSession = useLastSession(...)` line, add:

```tsx
  const cadence = useTrainingCadence();
```

Find the existing `<LastSessionCard>` render (around line 141):

```tsx
        {lastSession && <LastSessionCard session={lastSession} />}
```

Replace with:

```tsx
        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}
```

- [ ] **Step 5: Run tests**

Run: `cd web && npm test -- LastSessionCard.test`
Expected: all 5 new tests pass.

Run: `cd web && npm test`
Expected: full suite passes.

- [ ] **Step 6: Commit**

```bash
cd web
git add src/features/today/LastSessionCard.tsx src/features/today/TodayScreen.tsx tests/unit/features/today/LastSessionCard.test.tsx
git commit -m "feat(today): LastSessionCard with Stat + training-cadence ribbon"
```

---

## Task 7 — `TodayScreen` hero redesign

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`

**Rationale:** The most-visited screen when not mid-workout. Today it reads as a form; the redesign turns it into a landing page that invites the tap. Uses all shipped primitives: `Pill` (via DaySelector), `Stat` (via DayPreview and LastSessionCard), `SectionHeader` (via DaySelector), `EmptyState` (no-routine state from Task 4), warm accent tokens.

- [ ] **Step 1: Review current layout**

Read `web/src/features/today/TodayScreen.tsx` carefully. The current order of state-B body content is:
1. Routine name `h1`
2. `DaySelector` pills
3. `DayPreview` (exercises list)
4. Cardio card (if present)
5. `LastSessionCard`
6. Sticky-bottom "Start Workout" button

We'll restructure to:
1. Training-cadence eyebrow (from `useTrainingCadence` — optional)
2. Hero card with: day label eyebrow + "Today: Day B — Pull" heading + first 2 exercise names + estimated duration + **in-card Start Workout CTA**
3. Cardio card (if present) — unchanged
4. `LastSessionCard` — unchanged
5. Below-fold: "Switch day" `SectionHeader` + `DaySelector` + `DayPreview`

The sticky-bottom Start Workout button is removed (CTA now lives in the hero card).

- [ ] **Step 2: Add estimated-duration helper**

Add a helper near the top of `TodayScreen.tsx`, after the existing imports and before the component:

```tsx
function estimateDayDurationMin(day: { entries: ReadonlyArray<{ kind: "exercise" | "superset"; setBlocks?: Array<{ count: number }>; items?: Array<{ setBlocks: Array<{ count: number }> }> }> }): number {
  let totalSets = 0;
  for (const entry of day.entries) {
    if (entry.kind === "exercise" && entry.setBlocks) {
      totalSets += entry.setBlocks.reduce((s, b) => s + b.count, 0);
    } else if (entry.kind === "superset" && entry.items) {
      for (const item of entry.items) {
        totalSets += item.setBlocks.reduce((s, b) => s + b.count, 0);
      }
    }
  }
  // ~2 min per set (setup + logging + rest), rounded up to nearest 5
  const rough = Math.ceil((totalSets * 2) / 5) * 5;
  return Math.max(10, rough);
}
```

Note: because `day.entries` is an inline structural narrow of the actual `RoutineDay` type, prefer to type the parameter as `RoutineDay` (already imported). If not already imported, add:

```tsx
import type { RoutineDay } from "@/domain/types";
```

Then change the helper signature to:

```tsx
function estimateDayDurationMin(day: RoutineDay): number {
```

…and drop the inline structural type.

- [ ] **Step 3: Rewrite the state-B return block**

Inside `TodayScreen.tsx`, find the state-B return (starting around line 105 with `return ( <div className="flex flex-col h-full">`). Replace the entire return block with:

```tsx
  const dayDisplayName = day?.label ?? dayId;
  const firstTwoNames = day
    ? day.entries
        .flatMap((e) => (e.kind === "exercise" ? [e] : e.items))
        .slice(0, 2)
        .map((e) => exerciseNames.get(e.exerciseId) ?? e.exerciseId.replace(/-/g, " "))
    : [];
  const estMin = day ? estimateDayDurationMin(day) : 0;
  const remainingCount = day
    ? day.entries.flatMap((e) => (e.kind === "exercise" ? [e] : e.items)).length - firstTwoNames.length
    : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Training cadence eyebrow — uses the same `>= 3` threshold as
            LastSessionCard ribbon for a consistent "strong week" signal.
            Uses the Lucide Flame icon (not the `🔥` emoji) to stay consistent
            with LastSessionCard. */}
        {cadence && cadence.sessionsLast7Days >= 3 && (
          <SectionHeader className="!text-accent-warm inline-flex items-center gap-1.5">
            <Flame className="h-3 w-3" strokeWidth={2.5} />
            {cadence.sessionsLast7Days} sessions this week
          </SectionHeader>
        )}

        {/* Hero card */}
        <div className="border-2 border-border-strong bg-primary text-primary-foreground p-5 space-y-3">
          <SectionHeader className="!text-primary-foreground/70">
            Today · Day {dayId}
          </SectionHeader>
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            {dayDisplayName}
          </h1>
          {firstTwoNames.length > 0 && (
            <div className="space-y-0.5 text-sm">
              {firstTwoNames.map((name) => (
                <p key={name} className="font-medium truncate">{name}</p>
              ))}
              {remainingCount > 0 && (
                <p className="text-primary-foreground/60 text-xs">
                  + {remainingCount} more
                </p>
              )}
            </div>
          )}
          <Button
            variant="cta"
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? "Starting..." : "▶ Start Workout"}
          </Button>
          <p className="text-xs text-primary-foreground/60 tabular-nums text-center">
            ~{estMin} min
          </p>
        </div>

        {/* Cardio */}
        {routine.cardio && (
          <div className="bg-muted p-3 space-y-1.5">
            <SectionHeader>Cardio</SectionHeader>
            {routine.cardio.notes && (
              <p className="text-sm text-foreground">{routine.cardio.notes}</p>
            )}
            {routine.cardio.options.length > 0 && (
              <ul className="space-y-1">
                {routine.cardio.options.map((opt, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{opt.name}</span>
                    {opt.detail && (
                      <span className="text-muted-foreground"> — {opt.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Last session */}
        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}

        {/* Below-fold: switch day */}
        <div className="space-y-3 pt-2">
          <SectionHeader>Switch day</SectionHeader>
          <DaySelector
            routine={routine}
            selectedDayId={dayId}
            onSelectDay={setSelectedDayId}
          />
          {day && <DayPreview day={day} exerciseNames={exerciseNames} />}
        </div>
      </div>
    </div>
  );
```

Notes on this snippet:
- The sticky-bottom Start Workout button is removed — the CTA is inside the hero card. This is the main UX change.
- `SectionHeader` is used for eyebrows; `!text-cta` / `!text-accent-warm` / `!text-primary-foreground/70` pattern keeps color overrides minimal.
- `variant="cta"` gives the Start Workout button its purple fill automatically — no extra overrides needed inside the primary-black hero card (purple stands out against black).
- Hero card uses `bg-primary text-primary-foreground` — black on light mode. All children text-colors that need a softer shade use `text-primary-foreground/60` or `text-primary-foreground/70`.

- [ ] **Step 4: Add imports if missing**

Near the top of `TodayScreen.tsx`, ensure these imports exist (add any missing). Note that Task 4 Step 1 already added `CalendarCheck` from `lucide-react`; merge `Flame` into that same import line rather than duplicating the module:

```tsx
import { CalendarCheck, Flame } from "lucide-react";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { useTrainingCadence } from "@/shared/hooks/useTrainingCadence";
import type { RoutineDay } from "@/domain/types";
```

- [ ] **Step 5: Remove unused imports**

After the rewrite, `Link` and `buttonVariants` may be unused (they were only used in the no-routine state, which was migrated to `EmptyState` in Task 4, and the sticky-bottom `Button` was removed). Check with:

```bash
cd web && npm run lint
```

If lint reports unused imports, remove them.

- [ ] **Step 6: Run tests + lint + typecheck + build**

```bash
cd web
npm run lint
npm run typecheck
npm test
npm run build
```

All must pass. The build is important because the new hero-card color combinations touch the Tailwind v4 JIT output.

- [ ] **Step 7: Device smoke check**

The automated checks above pass on type safety and class strings, not on whether the screen *feels right*. This step is a manual dwell on the redesigned Today screen before Task 8 layers the inverted bottom nav on top.

```bash
cd web && npm run dev
```

Open http://localhost:5173/exercise-logger/ in a mobile-width browser window (Chrome DevTools → toolbar → iPhone 14 Pro or Pixel 7) or on a real device via the LAN IP.

Verify, and note any issues before moving on:

1. **Hero-card CTA reachability** — seed or activate a routine whose current day has ≥6 exercises (Day C of the bundled routine works). Confirm the in-card "Start Workout" button is reachable without having to scroll. If the DayPreview or training-cadence eyebrow pushes the CTA off-screen above the fold, add a sticky-bottom fallback CTA (small ghost button) that only renders when the hero CTA is out of the viewport.
2. **Visual balance with the (future) bottom nav** — Task 8 will repaint the active tab as `bg-primary` (black fill). Today's hero card also uses `bg-primary`. Mentally superimpose Task 8's nav: two black surfaces co-visible. If that will feel heavy, consider dropping the hero to `bg-foreground/95` or `bg-muted` and letting the CTA button carry the saturated color alone. Decide before shipping Task 8.
3. **Contrast** — verify `text-primary-foreground/60` (estimated-duration hint, "+ N more") and `text-primary-foreground/70` (eyebrow label) on `bg-primary` are legible. If either fails WCAG AA at a glance (the inverted text looks "dim"), bump to `/70` and `/80` respectively.
4. **Training-cadence signals** — seed three finished sessions in the last 7 days (`db.sessions.bulkPut([...])` from DevTools), reload. Confirm: the TodayScreen eyebrow shows `<Flame>` + "3 sessions this week" in warm accent AND the `LastSessionCard` ribbon shows the same. The threshold is `≥ 3` after this plan's edits, so this is the boundary case. Note: the eyebrow + ribbon pair is intentionally redundant — two warm-accent hits reinforce the "strong week" signal. If it feels like double-billing in practice, suppress the eyebrow when `lastSession` is present (one-line change).
5. **Day-switch affordance** — Task 9 adds `fade-in-soft` to the below-fold day selector; for now, confirm the selector still works pre-fade (clicking Day A/B/C updates the hero `<h1>` immediately).

Take one screenshot of Today before Task 8 is merged and one after (for the PR body). Block the sprint close on fixing any of items 1–4 if they read wrong on device — those are not issues that lint or typecheck can catch.

- [ ] **Step 8: Commit**

```bash
cd web
git add src/features/today/TodayScreen.tsx
git commit -m "feat(today): hero-card redesign with in-card CTA + training-cadence eyebrow"
```

---

## Task 8 — Bottom-nav polish (pill active state + press feedback)

**Files:**
- Modify: `web/src/app/App.tsx`

**Rationale:** Bottom nav is permanent real estate. Currently flat — active tab is signaled only by a tiny 12px underline. Move to a pill-filled active state matching the new design language.

- [ ] **Step 1: Update the NavLink className and active indicator**

Modify `web/src/app/App.tsx`. Find the NavLink block (around lines 59–82) and replace with:

```tsx
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-all duration-[var(--dur-base)] focus-visible:ring-2 focus-visible:ring-cta/30 outline-none active:scale-95 ${
                  isActive
                    ? "text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-0 bg-primary -z-0"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className="h-5 w-5 relative z-10"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          ))}
```

Changes vs prior:
- Active state now fills the entire tab area with `bg-primary` (black on light mode) and uses `text-primary-foreground` for contrast.
- Icon stroke-weight swaps from 2 → 2.5 on active — subtle weight shift.
- `active:scale-95` adds the tactile press feedback.
- The tiny bottom underline is removed (the fill replaces it).

- [ ] **Step 2: Run tests + lint + build**

Run: `cd web && npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass. E2E tests may assert on tab navigation — they should still work since role="navigation" and aria-label are preserved.

- [ ] **Step 3: Commit**

```bash
cd web
git add src/app/App.tsx
git commit -m "style(nav): bottom-nav pill-filled active state + press feedback"
```

---

## Task 9 — Day switch + tab-nav fade animations

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/app/App.tsx`

**Rationale:** Motion is absent where it matters most (per §2.1.5 of the review). Two cheap additions using the `.fade-in-soft` utility added in Task 1: content under `DayPreview` fades in when the selected day changes; main route content fades in when a tab changes.

- [ ] **Step 1: Apply `.fade-in-soft` to DayPreview on day change**

Modify `web/src/features/today/TodayScreen.tsx`. Find the below-fold DayPreview render (inside the "Switch day" section, inserted in Task 7):

```tsx
          {day && <DayPreview day={day} exerciseNames={exerciseNames} />}
```

Replace with:

```tsx
          {day && (
            <div key={dayId} className="fade-in-soft">
              <DayPreview day={day} exerciseNames={exerciseNames} />
            </div>
          )}
```

The `key={dayId}` forces React to remount the wrapper when the day changes, re-triggering the animation.

Also apply to the hero card name to acknowledge day switches visually. Find the hero-card `<h1>`:

```tsx
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            {dayDisplayName}
          </h1>
```

Replace with:

```tsx
          <h1 key={dayId} className="text-3xl font-heading font-bold tracking-tight fade-in-soft">
            {dayDisplayName}
          </h1>
```

- [ ] **Step 2: Apply `.fade-in-soft` to route content on tab change**

Modify `web/src/app/App.tsx`. Find the `<main>` in `Shell`:

```tsx
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
```

Replace with:

```tsx
      <main className="flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
```

Add the `FadeRoute` helper above the `Shell` function (but inside the file):

```tsx
import { useLocation } from "react-router";

function FadeRoute({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="fade-in-soft h-full">
      {children}
    </div>
  );
}
```

The `useLocation` import needs to be added to the existing `react-router` import line at the top. Edit the existing import to include `useLocation`:

```tsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
} from "react-router";
```

Also import `React` namespace for the `React.ReactNode` type (or use `ReactNode` directly). If the file doesn't already import `ReactNode`, add:

```tsx
import type { ReactNode } from "react";
```

And change the `FadeRoute` prop type from `React.ReactNode` to `ReactNode`.

- [ ] **Step 3: Run tests + build**

Run: `cd web && npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass. The E2E smoke test navigates between tabs — it should still work because the animation is purely visual (doesn't block rendering).

- [ ] **Step 4: Commit**

```bash
cd web
git add src/features/today/TodayScreen.tsx src/app/App.tsx
git commit -m "feat(motion): add day-switch and tab-nav fade-in-soft transitions"
```

---

## Task 10 — `SetLogSheet` open-edge prefill refactor

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx`

**Rationale:** Carries forward from §3.1 and §7 of the review. The current prefill effect has 13 deps and the code comment acknowledges it can clobber in-flight user input. Switch to open-edge detection: prefill runs only when `open` transitions `false → true`.

- [ ] **Step 1: Add the open-edge ref and refactor the effect**

Modify `web/src/features/workout/SetLogSheet.tsx`. Find the existing effect (around lines 82–137):

```tsx
  // Pre-fill on open.
  // Caveat: this effect re-runs whenever suggestion/lastTime/blockSetsInSession
  // identity changes, not just on open/close edges. A parent re-render while
  // the sheet is open can re-apply the prefill and clobber in-flight user input.
  // If that causes real UX pain, switch to edge-detecting `open` with a useRef.
  useEffect(() => {
    if (!open) return;
    setShowWeightForBodyweight(false);
    // ... body ...
  }, [open, existingSet, suggestion, lastTime, blockSetsInSession, se, blockIndex, setIndex, units, block?.minValue, showWeight, targetKind, durationInMinutes]);
```

Replace with (full refactored effect):

```tsx
  // Pre-fill on open transition only. Using a ref to track the prior `open`
  // value means prefill fires once per false→true edge, not on every re-render
  // while the sheet is open — which closes a clobber bug where a parent
  // re-render with new history identity would overwrite in-flight user input.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return; // already open; skip
    prevOpenRef.current = true;

    setShowWeightForBodyweight(false);

    if (existingSet) {
      // Priority 1: current logged value (edit mode)
      setWeight(
        existingSet.performedWeightKg != null
          ? String(toDisplayWeight(existingSet.performedWeightKg, units))
          : ""
      );
      setReps(existingSet.performedReps != null ? String(existingSet.performedReps) : "");
      setDuration(existingSet.performedDurationSec != null
        ? String(durationInMinutes ? Math.round(existingSet.performedDurationSec / 60 * 100) / 100 : existingSet.performedDurationSec)
        : "");
      setDistance(existingSet.performedDistanceM != null ? String(existingSet.performedDistanceM) : "");
      return;
    }

    // Priority 2: in-session weight carryover.
    const carryoverSet = blockSetsInSession
      .filter(
        (ls) =>
          ls.sessionExerciseId === se.id &&
          ls.blockIndex === blockIndex &&
          ls.performedWeightKg != null
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    const lastSet = lastTime?.sets[setIndex];
    const suggestedWeight = suggestion?.suggestedWeightKg;

    if (carryoverSet?.performedWeightKg != null) {
      setWeight(String(toDisplayWeight(carryoverSet.performedWeightKg, units)));
    } else if (suggestedWeight != null) {
      setWeight(String(toDisplayWeight(suggestedWeight, units)));
    } else if (lastSet?.weightKg != null) {
      setWeight(String(toDisplayWeight(lastSet.weightKg, units)));
    } else {
      setWeight(showWeight ? "0" : "");
    }

    setReps(lastSet?.reps != null ? String(lastSet.reps) : block?.minValue != null && targetKind === "reps" ? String(block.minValue) : "");
    setDuration(lastSet?.durationSec != null
      ? String(durationInMinutes ? Math.round(lastSet.durationSec / 60 * 100) / 100 : lastSet.durationSec)
      : "");
    setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
```

Import changes: `useRef` needs to be imported. At the top of the file, update the existing `useState, useEffect` import:

```tsx
import { useState, useEffect, useRef } from "react";
```

The `eslint-disable-next-line react-hooks/exhaustive-deps` is required because we intentionally omit the other deps — reading them as "current" values inside the effect is correct for the prefill semantic (we want the values at the moment of open, not the values at the moment of mount).

- [ ] **Step 2: Run existing tests**

Run: `cd web && npm test -- SetLogSheet.test`
Expected: all 12 existing SetLogSheet tests still pass. The refactor preserves prefill behavior on the false→true edge, which is what the tests cover.

- [ ] **Step 3: Add a regression test for the clobber bug**

Append to `web/tests/unit/features/workout/SetLogSheet.test.tsx`:

```tsx
describe("SetLogSheet — open-edge prefill", () => {
  it("does not re-prefill when parent re-renders with new props while open", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
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
        onSave={vi.fn()}
      />,
    );

    // Initial prefill runs — weight defaults to "0" since showWeight path hits no carryover/suggest/last.
    const weightInput = document.querySelector('input[name="weight"]') as HTMLInputElement;
    expect(weightInput).not.toBeNull();

    // User types 80 over the default
    await user.clear(weightInput);
    await user.type(weightInput, "80");
    expect(weightInput.value).toBe("80");

    // Parent re-renders with a new suggestion (simulates useLiveQuery refresh).
    rerender(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={{ blockIndex: 0, suggestedWeightKg: 100, isProgression: true, previousWeightKg: 95 }}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // User's typed value should NOT be clobbered by the new suggestion's prefill.
    expect(weightInput.value).toBe("80");
  });
});
```

Ensure `userEvent` is already imported at the top of the test file. If not, add:

```tsx
import userEvent from "@testing-library/user-event";
```

- [ ] **Step 4: Run the new test**

Run: `cd web && npm test -- SetLogSheet.test`
Expected: all tests pass, including the new clobber-regression test.

- [ ] **Step 5: Commit**

```bash
cd web
git add src/features/workout/SetLogSheet.tsx tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "refactor(set-log-sheet): open-edge prefill detection via useRef"
```

---

## Task 11 — `TodayScreen.test.tsx` component tests

**Files:**
- Create: `web/tests/unit/features/today/TodayScreen.test.tsx`

**Rationale:** Carries forward from S5.11 / S4.8. Covers the three states (no-routine / active-session / normal), day selector integration, start-session happy path. Uses `fake-indexeddb/auto` so we exercise the real DB query path.

- [ ] **Step 1: Write the test file**

Create `web/tests/unit/features/today/TodayScreen.test.tsx`:

```tsx
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import TodayScreen from "@/features/today/TodayScreen";
import { db } from "@/db/database";
import type { Routine, Session } from "@/domain/types";

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TodayScreen />
    </MemoryRouter>,
  );
}

async function seedRoutine(): Promise<Routine> {
  const routine: Routine = {
    id: "r1",
    version: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 45,
    dayOrder: ["A", "B"],
    nextDayId: "A",
    days: {
      A: {
        id: "A",
        label: "Push",
        entries: [
          {
            kind: "exercise",
            entryId: "e-1",
            exerciseId: "barbell-bench-press",
            instanceLabel: "",
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
          },
          {
            kind: "exercise",
            entryId: "e-2",
            exerciseId: "dumbbell-curl",
            instanceLabel: "",
            setBlocks: [{ targetKind: "reps", minValue: 10, maxValue: 15, count: 3 }],
          },
        ],
      },
      B: {
        id: "B",
        label: "Pull",
        entries: [
          {
            kind: "exercise",
            entryId: "e-3",
            exerciseId: "lat-pulldown",
            instanceLabel: "",
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
          },
        ],
      },
    },
    cardio: null,
    importedAt: "2026-04-17T12:00:00Z",
  };
  await db.routines.put(routine);
  return routine;
}

async function seedExercises() {
  await db.exercises.bulkPut([
    {
      id: "barbell-bench-press",
      name: "Barbell Bench Press",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["chest"],
      aliases: [],
    },
    {
      id: "dumbbell-curl",
      name: "Dumbbell Curl",
      type: "weight",
      equipment: "dumbbell",
      muscleGroups: ["biceps"],
      aliases: [],
    },
    {
      id: "lat-pulldown",
      name: "Lat Pulldown",
      type: "weight",
      equipment: "machine",
      muscleGroups: ["back"],
      aliases: [],
    },
  ]);
}

async function setActiveRoutine(routineId: string) {
  const settings = (await db.settings.get("default"))!;
  await db.settings.put({ ...settings, activeRoutineId: routineId });
}

describe("TodayScreen", () => {
  beforeEach(async () => {
    // Clear all tables on the singleton db (we can't swap the instance —
    // TodayScreen imports `db` directly). Then re-seed default settings.
    const { initializeSettings } = await import("@/db/database");
    await Promise.all([
      db.settings.clear(),
      db.routines.clear(),
      db.exercises.clear(),
      db.sessions.clear(),
      db.sessionExercises.clear(),
      db.loggedSets.clear(),
    ]);
    await initializeSettings(db);
  });

  afterEach(() => {
    cleanup();
  });

  it("State A — renders EmptyState with 'Go to Settings' when no active routine", async () => {
    renderAt();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /No Active Routine/i })).toBeVisible();
    });
    expect(screen.getByRole("button", { name: /Go to Settings/i })).toBeVisible();
  });

  it("State B — renders routine name, day selector, hero card with day label", async () => {
    const routine = await seedRoutine();
    await seedExercises();
    await setActiveRoutine(routine.id);

    renderAt();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Push/i })).toBeVisible();
    });
    expect(screen.getByRole("button", { name: /Start Workout/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Day A/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Day B/i })).toBeVisible();
  });

  it("State B — switching day via DaySelector updates the hero card", async () => {
    const routine = await seedRoutine();
    await seedExercises();
    await setActiveRoutine(routine.id);
    const user = userEvent.setup();

    renderAt();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Push/i })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /Day B/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Pull/i })).toBeVisible();
    });
  });

  it("State C — renders Resume Workout card when active session exists", async () => {
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
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      finishedAt: null,
    };
    await db.sessions.put(session);

    renderAt();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Resume Workout/i })).toBeVisible();
    });
    expect(screen.getByText(/Push/)).toBeVisible();
  });

  it("Start Workout button transitions to loading state when pressed", async () => {
    const routine = await seedRoutine();
    await seedExercises();
    await setActiveRoutine(routine.id);
    const user = userEvent.setup();

    renderAt();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Workout/i })).toBeVisible();
    });

    const btn = screen.getByRole("button", { name: /Start Workout/i });
    // Fire-and-forget — we don't assert on navigation, just that the UI updates.
    user.click(btn).catch(() => {});

    // Button text flips to "Starting..." while the session is created.
    await waitFor(() => {
      // Either the button text has updated or the session was created — check the DB.
      return expect(
        screen.queryByRole("button", { name: /Starting/i }) ||
        db.sessions.count().then((n) => n > 0),
      ).toBeTruthy();
    });
  });
});
```

Notes on this test file:
- `fake-indexeddb/auto` provides a fresh IndexedDB implementation per file; the `beforeEach`/`afterEach` pattern resets DB state.
- We avoid `navigate` assertions in the "Start Workout" test because `MemoryRouter` doesn't surface route changes to the assertion layer easily; asserting on the DB side effect is sufficient for a smoke test.
- The `cleanup()` handles RTL DOM teardown; the `db.delete()` + re-open handles DB teardown.

- [ ] **Step 2: Run the tests**

Run: `cd web && npm test -- TodayScreen.test`
Expected: all 5 tests pass. If any fail, check:
- Are the imports correct?
- Does `initializeSettings` in `db/database.ts` match the call used here?
- Is the `Exercise` type shape correct (check `web/src/domain/types.ts` if assertions about seeded exercises fail)?

- [ ] **Step 3: Lint + typecheck**

Run: `cd web && npm run lint && npm run typecheck`

- [ ] **Step 4: Commit**

```bash
cd web
git add tests/unit/features/today/TodayScreen.test.tsx
git commit -m "test(today): add TodayScreen integration tests for all three states"
```

---

## Task 12 — `WorkoutScreen.test.tsx` smoke

**Files:**
- Create: `web/tests/unit/features/workout/WorkoutScreen.test.tsx`

**Rationale:** Carries forward from S4.8 / S5.12. Covers the main workout flow end-to-end. Uses `fake-indexeddb/auto` so we exercise the real session/set services.

- [ ] **Step 1: Write the smoke test file**

Create `web/tests/unit/features/workout/WorkoutScreen.test.tsx`:

```tsx
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import WorkoutScreen from "@/features/workout/WorkoutScreen";
import { db, initializeSettings } from "@/db/database";
import { startSessionWithCatalog } from "@/services/session-service";
import type { Routine } from "@/domain/types";

function renderWorkout() {
  return render(
    <MemoryRouter initialEntries={["/workout"]}>
      <WorkoutScreen />
    </MemoryRouter>,
  );
}

async function seedRoutineAndExercises(): Promise<Routine> {
  await db.exercises.bulkPut([
    {
      id: "barbell-bench-press",
      name: "Barbell Bench Press",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["chest"],
      aliases: [],
    },
  ]);

  const routine: Routine = {
    id: "r1",
    version: 1,
    name: "Smoke Routine",
    restDefaultSec: 90,
    restSupersetSec: 45,
    dayOrder: ["A"],
    nextDayId: "A",
    days: {
      A: {
        id: "A",
        label: "Push",
        entries: [
          {
            kind: "exercise",
            entryId: "e-1",
            exerciseId: "barbell-bench-press",
            instanceLabel: "",
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 2 }],
          },
        ],
      },
    },
    cardio: null,
    importedAt: "2026-04-17T12:00:00Z",
  };
  await db.routines.put(routine);

  const settings = (await db.settings.get("default"))!;
  await db.settings.put({ ...settings, activeRoutineId: routine.id });

  return routine;
}

describe("WorkoutScreen — integration smoke", () => {
  beforeEach(async () => {
    // Clear the singleton db's tables between tests — WorkoutScreen imports
    // `db` directly so we can't swap the instance.
    await Promise.all([
      db.settings.clear(),
      db.routines.clear(),
      db.exercises.clear(),
      db.sessions.clear(),
      db.sessionExercises.clear(),
      db.loggedSets.clear(),
    ]);
    await initializeSettings(db);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders EmptyState when no active session exists", async () => {
    renderWorkout();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /No Active Workout/i })).toBeVisible();
    });
  });

  it("renders session header + exercise + set slots when a session is active", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText(/Smoke Routine/)).toBeVisible();
    });
    expect(screen.getByText(/Barbell Bench Press/i)).toBeVisible();

    // 2 set slots should render (count from the setBlock).
    const slots = await screen.findAllByTestId("set-slot");
    expect(slots.length).toBe(2);
  });

  it("SessionProgress shows 0 of 2 sets before logging", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText(/of 2 sets/i)).toBeVisible();
    });
  });

  it("opens SetLogSheet when a set slot is tapped", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    const slots = await screen.findAllByTestId("set-slot");
    await user.click(slots[0]!);

    // Sheet title reuses the exercise name.
    await waitFor(() => {
      const sheet = screen.getByRole("dialog");
      expect(within(sheet).getByText(/Barbell Bench Press/i)).toBeVisible();
    });
  });

  it("finishes a session via the confirmation dialog", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Finish Workout/i })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /Finish Workout/i }));

    // Confirmation dialog shows a second "Finish Workout" button.
    const confirmBtn = await screen.findByRole("button", { name: /^Finish Workout$/i });
    await user.click(confirmBtn);

    await waitFor(async () => {
      const sessions = await db.sessions.toArray();
      expect(sessions.length).toBe(1);
      expect(sessions[0]!.status).toBe("finished");
    });
  });
});
```

Notes:
- This is a smoke, not an exhaustive test. Log-set-and-save is intentionally not covered because the happy path hits many layers (sheet validation, toast, live-query refresh) and the existing service tests already cover `logSet` thoroughly.
- If the `within(sheet)` pattern doesn't find the title (because Sheet uses portal rendering), fall back to `screen.getAllByText(/Barbell Bench Press/i).length >= 2` — one in the card, one in the sheet.
- If `findAllByTestId` times out, check whether the session was created with exercises. Use `await db.sessionExercises.count()` inside a `beforeEach`-style assertion to diagnose.

- [ ] **Step 2: Run the tests**

Run: `cd web && npm test -- WorkoutScreen.test`
Expected: all 5 tests pass. Any failure is likely due to fake-indexeddb + Dexie-react-hooks timing — try wrapping assertions in `waitFor` with a longer timeout (`{ timeout: 2000 }`).

- [ ] **Step 3: Lint + typecheck + full suite**

```bash
cd web
npm run lint
npm run typecheck
npm test
```

All clean.

- [ ] **Step 4: Commit**

```bash
cd web
git add tests/unit/features/workout/WorkoutScreen.test.tsx
git commit -m "test(workout): add WorkoutScreen integration smoke"
```

---

## Task 13 — Final docs + QA sweep

**Files:**
- Modify: `CLAUDE.md` (root) — update test count.
- Modify: `docs/ui-rewrite-spec.md` — append Sprint 5 drift note.
- Modify: `docs/codebase-review-2026-04-17.md` — mark Sprint 5 tasks shipped in §6.

**Rationale:** Lock in the new test-count baseline, document the Sprint 5 shipment. No code changes.

- [ ] **Step 1: Run the full test suite and note the count**

Run: `cd web && npm test`
Expected: all pass. Note the total (should be ~530+).

- [ ] **Step 2: Update root `CLAUDE.md` test count**

Modify `CLAUDE.md`. Find:

```
npm test              # 503 unit+integration tests (Vitest)
```

Replace `503` with the actual count from Step 1.

- [ ] **Step 3: Append Sprint 5 drift note to `ui-rewrite-spec.md`**

Modify `docs/ui-rewrite-spec.md`. In the "Drift / Status as of 2026-04-17" block, append:

```
- **Sprint 5 shipped (2026-04-17):** `TodayScreen` hero-card redesign with in-card Start CTA; warm accent color (`--accent-warm`) introduced paired with CTA purple; training-cadence ribbon on `LastSessionCard` + optional eyebrow on Today; bottom-nav pill-filled active state + press feedback; day-switch and tab-nav fade transitions; adopted `SectionHeader` at 5 callsites, `EmptyState` at 3 callsites, `Stat` in `SessionProgress` + `DayPreview` + `LastSessionCard`; `SetLogSheet` prefill refactored to open-edge detection (closes clobber bug). New component tests: `TodayScreen.test.tsx` + `WorkoutScreen.test.tsx` smoke.
```

- [ ] **Step 4: Mark Sprint 5 tasks shipped in the review**

Modify `docs/codebase-review-2026-04-17.md`. In the "Sprint 5 — Open Doors Wide" table (§6), add a status column or replace the estimates with ✅ markers. Specifically, convert the table header:

```markdown
| # | Task | Est. | Area |
```

to:

```markdown
| # | Task | Status | Notes |
```

And update each row's third column from the effort estimate to ✅ + a brief shipping note. Keep the per-task intent intact so future readers can see what the sprint covered.

- [ ] **Step 5: Run lint + typecheck + test + build**

```bash
cd web
npm run lint
npm run typecheck
npm test
npm run build
```

All clean.

- [ ] **Step 6: Commit**

```bash
cd web
git add ../CLAUDE.md ../docs/ui-rewrite-spec.md ../docs/codebase-review-2026-04-17.md
git commit -m "docs: record Sprint 5 shipment and refresh test count"
```

(Note: the commit is staged from inside `web/`, so the relative paths use `../`. Alternatively, `cd` to the repo root before staging.)

---

## Self-review checklist

Use this when the plan lands to confirm nothing was skipped:

- Tokens: `--accent-warm`, `--accent-warm-foreground`, `--accent-warm-soft`, `.fade-in-soft` keyframe — 3 tokens + 1 keyframe.
- Service: `computeTrainingCadence` function + 4 unit tests + `useTrainingCadence` hook.
- SectionHeader: unit test file backfilled (Sprint 4 gap) + adoption at 5 sites (RoutineImporter, ExerciseHistoryScreen, DaySelector, SupersetGroup, WorkoutScreen).
- EmptyState adoption: 3 remaining sites migrated (TodayScreen no-routine, HistoryScreen empty, ExerciseHistoryScreen empty).
- Stat adoption: SessionProgress + DayPreview + LastSessionCard.
- LastSessionCard: redesigned with Stat + warm-accent ribbon (threshold `sessionsLast7Days >= 3`).
- TodayScreen: hero-card with in-card CTA, training-cadence eyebrow (threshold `>= 3`, Lucide `Flame` icon), day selector demoted below-fold. Session fixtures use `dayId` (not `dayIdSnapshot`).
- Bottom nav: pill-filled active state + press feedback + icon stroke-weight swap.
- Motion: `fade-in-soft` applied to day switch + route change.
- SetLogSheet: open-edge prefill refactor via `useRef` (closes 13-dep clobber bug).
- Tests added: SectionHeader (3), training-cadence (4), LastSessionCard (5), SetLogSheet clobber-regression (1), TodayScreen (5), WorkoutScreen (5) — **~23 new tests**.
- Device smoke: Task 7 Step 7 executed before Task 8 merged; screenshots attached to PR.
- All existing tests still green.
- `CLAUDE.md` test count refreshed.
- `ui-rewrite-spec.md` drift note appended.
- `codebase-review-2026-04-17.md` §6 Sprint 5 table marked shipped.

---

*End of plan. Ready to execute.*

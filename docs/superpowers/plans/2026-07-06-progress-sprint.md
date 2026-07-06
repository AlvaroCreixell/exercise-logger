# Progress Sprint — trend chart, best-lift summary, best-ever auto-PR

**Owner decision (2026-07-06):** PR definition is **best ever** (all-time), not windowed.
**Goal:** make logged data visible — pillar (c) of the product goal. One chart, no dashboard.

## Scope

### 1. Auto-PR detection (Worker A)
- Pure helper `web/src/domain/personal-records.ts` (domain = no React, no DB):
  - `computePersonalBests(sets: LoggedSet[]): PersonalBests`
  - `isNewPersonalBest(input, bests): boolean`
- Rules (per set shape, compared against ALL previously logged sets for the exerciseId —
  any session status, extras included; invariant 7 is about progression suggestions, not PRs):
  - weight+reps: PR iff `weight > max(weight of prior sets with reps >= input.reps)`.
  - reps-only: PR iff `reps > max prior reps` (among reps-only sets).
  - duration-only: PR iff longer. distance-only: PR iff farther.
  - duration+distance (cardio): never auto-PR — manual toggle only.
  - **No prior comparable sets → NOT a PR** (day-one sets don't all light up).
- Hook `web/src/shared/hooks/useExercisePersonalBests.ts` — live query via the
  `[exerciseId+loggedAt]` compound index, returns `PersonalBests | undefined`.
- `SetLogSheet` integration: **create mode only** — as the user types, effective
  PR state = `manualOverride ?? isNewPersonalBest(currentInput)`. Tapping PrToggle
  sets the override (sticks until sheet closes). Edit mode keeps today's behavior
  (prefill from `existingSet.isPersonalRecord`, no auto). Input parsed to canonical
  kg the same way `handleSave` does. Show "auto" affordance on the toggle when the
  auto state is on and not overridden.

### 2. Trend spark-line + best-lift summary (Worker B)
- Pure helpers `web/src/features/history/lib/trendPoints.ts`:
  - `buildTrendPoints(groups: ExerciseHistoryGroup[], limit = 12)` — per session,
    the top-set value. Measure priority across all groups: weight → reps →
    duration → distance; sessions lacking the chosen measure are skipped.
    Ascending by date, last `limit` sessions. Values canonical (kg/m/sec).
  - `bestLiftSummary(groups)` — all-time best set, best-this-month set (local time),
    last-session top set (same measure priority; each is a LoggedSet or null).
- `TrendSparkline.tsx` — inline SVG (no new deps): polyline + end dot, min/max
  labels, `role="img"` with a sentence aria-label. Warm-paper/sage tokens.
- `ExerciseHistoryScreen`: spark-line + three summary stats ("All-time best /
  This month / Last session", formatted via `formatLoggedSet` with unit conversion)
  above the session list; chart renders only with >= 2 points.
- PR visibility in history: sets with `isPersonalRecord` get a small "PR" marker
  in `ExerciseHistoryScreen` set values (SetRow in the live workout already has one).

## Non-goals
Volume/frequency charts, per-muscle dashboards, PR notifications/celebrations,
retroactive PR back-fill on historical data, cardio PRs, schema changes.

## Ownership (parallel workers, disjoint files)
- **A:** `domain/personal-records.ts`, `shared/hooks/useExercisePersonalBests.ts`,
  `features/workout/SetLogSheet.tsx`, `features/workout/PrToggle.tsx` + their tests.
- **B:** `features/history/lib/trendPoints.ts`, `features/history/TrendSparkline.tsx`,
  `features/history/ExerciseHistoryScreen.tsx` + their tests (create
  `ExerciseHistoryScreen.test.tsx`).
- **Lead:** integration, CLAUDE.md updates, full gate, PR.

## Gate
`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, full Playwright E2E.
No new E2E spec: the flows are unit/integration-covered; seeding multi-session
history through the UI in Playwright is disproportionate. Revisit if a regression slips.

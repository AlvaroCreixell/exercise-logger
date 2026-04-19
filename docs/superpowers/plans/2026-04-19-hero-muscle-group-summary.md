# Hero Card Muscle-Group Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hero card's "first two exercise names + X more" preview with a count-by-muscle-group summary (e.g. `3 Legs · 3 Back · 2 Arms`).

**Architecture:** Extract a pure helper `summarizeMuscleGroups(entries, exercisesById)` in `web/src/features/today/` that returns an ordered `[{ group, count }]` array, each entry counted once against its **primary** (first) muscle group. `TodayScreen.tsx` replaces its current `firstTwoNames`/`remainingCount` block with a single inline middot-joined line rendered from the helper output.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library.

---

## Design decisions (locked in from brainstorm)

- **Counting rule (Option B):** Each routine entry contributes +1 to its exercise's **first** `muscleGroups` entry. Totals always equal exercise count.
- **Display format (Option 1):** Inline, middot-separated, single line. Example: `3 Legs · 3 Back · 2 Arms`.
- **Ordering:** Count descending; ties broken by a canonical order `["Legs", "Back", "Chest", "Shoulders", "Arms", "Core", "Full Body", "Cardio"]`; groups outside that list come last alphabetically.
- **Missing catalog entry:** If an entry's `exerciseId` isn't in `exercisesById` or its `muscleGroups` is empty, bucket as `"Other"` (placed at the very end).
- **Supersets:** Flatten supersets into their items first (same as current `flatEntries`).
- **Empty day:** Render nothing (match current behavior when `firstTwoNames.length === 0`).

---

## File Structure

**Create:**
- `web/src/features/today/muscle-summary.ts` — pure helper + type.
- `web/tests/unit/features/today/muscle-summary.test.ts` — unit tests for the helper.

**Modify:**
- `web/src/features/today/TodayScreen.tsx` — replace the name-list block with the summary line; remove now-unused `firstTwoNames`/`remainingCount` locals.
- `web/tests/unit/features/today/TodayScreen.test.tsx` — add an assertion that the summary line renders; (no other existing assertions regress).

---

## Task 1: Pure helper + unit tests

**Files:**
- Create: `web/src/features/today/muscle-summary.ts`
- Create: `web/tests/unit/features/today/muscle-summary.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/today/muscle-summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { summarizeMuscleGroups } from "@/features/today/muscle-summary";
import type { RoutineEntry, Exercise } from "@/domain/types";

function ex(id: string, name: string, groups: string[]): Exercise {
  return { id, name, type: "weight", equipment: "barbell", muscleGroups: groups };
}

function flat(exerciseId: string): RoutineEntry {
  return {
    kind: "exercise",
    entryId: `e-${exerciseId}`,
    exerciseId,
    setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
  };
}

describe("summarizeMuscleGroups", () => {
  it("counts each entry once against its primary (first) muscle group", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", ex("squat", "Squat", ["Legs"])],
      ["deadlift", ex("deadlift", "Deadlift", ["Back", "Legs"])], // primary = Back
      ["bench", ex("bench", "Bench", ["Chest"])],
    ]);

    const result = summarizeMuscleGroups(
      [flat("squat"), flat("deadlift"), flat("bench")],
      exercises,
    );

    expect(result).toEqual([
      { group: "Legs", count: 1 },
      { group: "Back", count: 1 },
      { group: "Chest", count: 1 },
    ]);
    // Totals equal exercise count.
    expect(result.reduce((s, r) => s + r.count, 0)).toBe(3);
  });

  it("orders by count desc, with canonical tiebreak (Legs > Back > Chest > Shoulders > Arms > Core)", () => {
    const exercises = new Map<string, Exercise>([
      ["e1", ex("e1", "A", ["Arms"])],
      ["e2", ex("e2", "B", ["Chest"])],
      ["e3", ex("e3", "C", ["Legs"])],
      ["e4", ex("e4", "D", ["Chest"])],
      ["e5", ex("e5", "E", ["Legs"])],
      ["e6", ex("e6", "F", ["Legs"])],
    ]);

    const result = summarizeMuscleGroups(
      ["e1", "e2", "e3", "e4", "e5", "e6"].map(flat),
      exercises,
    );

    // Legs 3 (count winner), then Chest 2 vs Arms 1 — Chest next by count.
    expect(result).toEqual([
      { group: "Legs", count: 3 },
      { group: "Chest", count: 2 },
      { group: "Arms", count: 1 },
    ]);
  });

  it("breaks count ties using the canonical order", () => {
    const exercises = new Map<string, Exercise>([
      ["e1", ex("e1", "A", ["Arms"])],
      ["e2", ex("e2", "B", ["Legs"])],
      ["e3", ex("e3", "C", ["Chest"])],
    ]);

    const result = summarizeMuscleGroups(
      ["e1", "e2", "e3"].map(flat),
      exercises,
    );

    // All count=1: Legs first, then Chest, then Arms.
    expect(result.map((r) => r.group)).toEqual(["Legs", "Chest", "Arms"]);
  });

  it("buckets missing catalog entries as 'Other' and places them last", () => {
    const exercises = new Map<string, Exercise>([
      ["squat", ex("squat", "Squat", ["Legs"])],
    ]);

    const result = summarizeMuscleGroups(
      [flat("squat"), flat("unknown-exercise")],
      exercises,
    );

    expect(result).toEqual([
      { group: "Legs", count: 1 },
      { group: "Other", count: 1 },
    ]);
  });

  it("buckets exercises with empty muscleGroups as 'Other'", () => {
    const exercises = new Map<string, Exercise>([
      ["mystery", ex("mystery", "Mystery", [])],
    ]);

    const result = summarizeMuscleGroups([flat("mystery")], exercises);

    expect(result).toEqual([{ group: "Other", count: 1 }]);
  });

  it("flattens supersets into their items before counting", () => {
    const exercises = new Map<string, Exercise>([
      ["curl", ex("curl", "Curl", ["Arms"])],
      ["push", ex("push", "Pushdown", ["Arms"])],
    ]);

    const superset: RoutineEntry = {
      kind: "superset",
      groupId: "g1",
      items: [
        {
          entryId: "e-1",
          exerciseId: "curl",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
        {
          entryId: "e-2",
          exerciseId: "push",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    };

    const result = summarizeMuscleGroups([superset], exercises);

    expect(result).toEqual([{ group: "Arms", count: 2 }]);
  });

  it("returns an empty array when there are no entries", () => {
    expect(summarizeMuscleGroups([], new Map())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run tests/unit/features/today/muscle-summary.test.ts`
Expected: FAIL with module-not-found for `@/features/today/muscle-summary`.

- [ ] **Step 3: Implement the helper**

Create `web/src/features/today/muscle-summary.ts`:

```ts
import type { Exercise, RoutineEntry } from "@/domain/types";

export interface MuscleGroupCount {
  group: string;
  count: number;
}

/**
 * Canonical sort order for tiebreaks and for placing well-known groups
 * ahead of unusual ones. Groups not in this list sort alphabetically
 * after all listed groups. "Other" is forced to the very end.
 */
const CANONICAL_ORDER: readonly string[] = [
  "Legs",
  "Back",
  "Chest",
  "Shoulders",
  "Arms",
  "Core",
  "Full Body",
  "Cardio",
];

const OTHER = "Other";

function canonicalRank(group: string): number {
  if (group === OTHER) return Number.MAX_SAFE_INTEGER;
  const idx = CANONICAL_ORDER.indexOf(group);
  return idx === -1 ? CANONICAL_ORDER.length : idx;
}

/**
 * Count each entry once against its exercise's PRIMARY (first) muscle group.
 * Supersets are flattened into their items. Missing catalog entries and
 * exercises with an empty `muscleGroups` array bucket into "Other".
 *
 * Output is ordered by count descending, with ties broken by `CANONICAL_ORDER`;
 * unknown groups sort alphabetically after the canonical list; "Other" is last.
 */
export function summarizeMuscleGroups(
  entries: RoutineEntry[],
  exercisesById: Map<string, Exercise>,
): MuscleGroupCount[] {
  const flat = entries.flatMap((e) => (e.kind === "exercise" ? [e] : e.items));
  const counts = new Map<string, number>();

  for (const item of flat) {
    const exercise = exercisesById.get(item.exerciseId);
    const primary = exercise?.muscleGroups[0] ?? OTHER;
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      const rankA = canonicalRank(a.group);
      const rankB = canonicalRank(b.group);
      if (rankA !== rankB) return rankA - rankB;
      return a.group.localeCompare(b.group);
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run tests/unit/features/today/muscle-summary.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/today/muscle-summary.ts web/tests/unit/features/today/muscle-summary.test.ts
git commit -m "feat(today): add summarizeMuscleGroups helper for Hero card"
```

---

## Task 2: Wire helper into TodayScreen

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx` (lines 124–165)

- [ ] **Step 1: Update imports and replace the preview block**

In `web/src/features/today/TodayScreen.tsx`:

Add this import next to the other `@/features/today/*` imports near the top:

```ts
import { summarizeMuscleGroups } from "./muscle-summary";
```

Replace the current block (approximately lines 123–131):

```tsx
  const dayDisplayName = day?.label ?? dayId;
  const flatEntries = day
    ? day.entries.flatMap((e) => (e.kind === "exercise" ? [e] : e.items))
    : [];
  const firstTwoNames = flatEntries
    .slice(0, 2)
    .map((e) => exerciseNames.get(e.exerciseId) ?? e.exerciseId.replace(/-/g, " "));
  const estMin = day ? estimateDayDurationMin(day) : 0;
  const remainingCount = flatEntries.length - firstTwoNames.length;
```

with:

```tsx
  const dayDisplayName = day?.label ?? dayId;
  const exercisesById = new Map((exercises ?? []).map((ex) => [ex.id, ex]));
  const muscleSummary = day ? summarizeMuscleGroups(day.entries, exercisesById) : [];
  const summaryLine = muscleSummary
    .map((g) => `${g.count} ${g.group}`)
    .join(" · ");
  const estMin = day ? estimateDayDurationMin(day) : 0;
```

Replace the JSX preview block (approximately lines 155–166):

```tsx
          {firstTwoNames.length > 0 && (
            <div className="space-y-0.5 text-sm">
              {firstTwoNames.map((name) => (
                <p key={name} className="font-medium truncate">{name}</p>
              ))}
              {remainingCount > 0 && (
                <p className="text-primary-foreground/70 text-xs">
                  + {remainingCount} more
                </p>
              )}
            </div>
          )}
```

with:

```tsx
          {summaryLine && (
            <p className="text-sm font-medium text-primary-foreground/90">
              {summaryLine}
            </p>
          )}
```

Also remove the now-unused `exerciseNames` Map construction if it is no longer referenced elsewhere in the file — **BUT** check first: `exerciseNames` is still passed to `<DayPreview>` at line 216, so keep it.

- [ ] **Step 2: Type-check and lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS — no type errors, no lint errors. If ESLint flags an unused local, remove it.

- [ ] **Step 3: Update the existing TodayScreen test to assert the new summary**

In `web/tests/unit/features/today/TodayScreen.test.tsx`:

Update the exercise seeding in `seedExercises()` so the `muscleGroups` use the canonical capitalized names used by the real catalog (so the assertion matches what users see):

Replace the `seedExercises()` body (lines 67–91):

```ts
async function seedExercises() {
  await db.exercises.bulkPut([
    {
      id: "barbell-bench-press",
      name: "Barbell Bench Press",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Chest"],
    },
    {
      id: "dumbbell-curl",
      name: "Dumbbell Curl",
      type: "weight",
      equipment: "dumbbell",
      muscleGroups: ["Arms"],
    },
    {
      id: "lat-pulldown",
      name: "Lat Pulldown",
      type: "weight",
      equipment: "machine",
      muscleGroups: ["Back"],
    },
  ]);
}
```

Add the following assertion inside the existing `"State B — renders routine name, day selector, hero card with day label"` test, **after** the existing `expect(screen.getByRole("button", { name: /Start Workout/i })).toBeVisible();` line (≈ line 134):

```ts
    // Hero card shows the muscle-group summary (1 Chest · 1 Arms) —
    // Day A has Bench (Chest) + Curl (Arms).
    await waitFor(() => {
      expect(screen.getByText(/1 Chest.*1 Arms/)).toBeVisible();
    });
```

- [ ] **Step 4: Run TodayScreen tests**

Run: `cd web && npx vitest run tests/unit/features/today/TodayScreen.test.tsx`
Expected: PASS — all 5 existing tests + the new assertion pass.

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `cd web && npm test -- --run`
Expected: PASS — all tests green (this project currently has ~530 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/TodayScreen.tsx web/tests/unit/features/today/TodayScreen.test.tsx
git commit -m "feat(today): replace Hero exercise names with muscle-group summary"
```

---

## Task 3: Manual visual verification (CLAUDE.md requires this for UI changes)

**Files:** none — human-in-the-loop smoke test.

- [ ] **Step 1: Start the dev server**

Run: `cd web && npm run dev`
Expected: server listening on `http://localhost:5173/exercise-logger/`.

- [ ] **Step 2: Load the app with a seeded routine**

Open the app in a browser. Ensure a routine with multiple muscle groups across a day is active (import one from Settings if needed). Navigate to Today.

**Verify on the Hero card:**
- The block under the day title reads like `3 Legs · 3 Back · 2 Arms` (exact groups depend on the day's exercises).
- Counts sum to the day's exercise count.
- The line sits between the day title and the `▶ Start Workout` button.
- Switching day via the DaySelector re-renders the summary line for the new day.
- Empty/missing-catalog edge cases don't throw — the line either shows `N Other` (if the active day has orphaned exercises) or disappears (if the day has no entries at all).

- [ ] **Step 3: Stop the dev server.**

No commit — this is verification only.

---

## Self-Review

**1. Spec coverage** — Requirements from brainstorm:
- ✅ Count by muscle group: Task 1 (helper) + Task 2 (wiring).
- ✅ Option B (primary muscle only): Task 1 test "counts each entry once against its primary".
- ✅ Inline middot format: Task 2 Step 1 uses `" · "` as the join separator.
- ✅ Replaces existing "first two + X more" block: Task 2 Step 1 removes `firstTwoNames`/`remainingCount`.

**2. Placeholder scan** — No "TBD", "TODO", "implement later", or hand-waved error handling. Every code step shows full code.

**3. Type consistency** — `MuscleGroupCount` shape (`{ group, count }`) is the same in the tests and the implementation. `summarizeMuscleGroups(entries, exercisesById)` signature matches across tasks. `RoutineEntry` import comes from `@/domain/types`, which is where it's actually exported (verified during brainstorming).

**4. Ambiguity check** — `"Full Body"` is kept as a single unsplit bucket because the CSV parser already splits on `/` and `"Full Body"` has no slash. `"Other"` bucket is explicit in both the helper and tests. Count ordering with ties is fully specified by the canonical list + alphabetical fallback.

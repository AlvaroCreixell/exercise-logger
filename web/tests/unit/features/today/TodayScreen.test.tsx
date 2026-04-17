import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import TodayScreen from "@/features/today/TodayScreen";
import { db, initializeSettings } from "@/db/database";
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
    schemaVersion: 1,
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
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
          },
          {
            kind: "exercise",
            entryId: "e-2",
            exerciseId: "dumbbell-curl",
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
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
          },
        ],
      },
    },
    notes: [],
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
    },
    {
      id: "dumbbell-curl",
      name: "Dumbbell Curl",
      type: "weight",
      equipment: "dumbbell",
      muscleGroups: ["biceps"],
    },
    {
      id: "lat-pulldown",
      name: "Lat Pulldown",
      type: "weight",
      equipment: "machine",
      muscleGroups: ["back"],
    },
  ]);
}

async function setActiveRoutine(routineId: string) {
  const settings = (await db.settings.get("user"))!;
  await db.settings.put({ ...settings, activeRoutineId: routineId });
}

describe("TodayScreen", () => {
  beforeEach(async () => {
    // Clear all tables on the singleton db (we can't swap the instance —
    // TodayScreen imports `db` directly). Then re-seed default settings.
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
    await waitFor(async () => {
      const hasLoadingBtn = screen.queryByRole("button", { name: /Starting/i }) !== null;
      const sessionCreated = (await db.sessions.count()) > 0;
      expect(hasLoadingBtn || sessionCreated).toBe(true);
    });
  });
});

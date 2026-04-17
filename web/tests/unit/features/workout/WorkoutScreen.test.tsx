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
    },
  ]);

  const routine: Routine = {
    id: "r1",
    schemaVersion: 1,
    name: "Smoke Routine",
    notes: [],
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
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 2 }],
          },
        ],
      },
    },
    cardio: null,
    importedAt: "2026-04-17T12:00:00Z",
  };
  await db.routines.put(routine);

  const settings = (await db.settings.get("user"))!;
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
      const dialogs = screen.getAllByRole("dialog");
      const sheet = dialogs[dialogs.length - 1]!;
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

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
      expect(screen.getByRole("heading", { name: /No active workout/i })).toBeVisible();
    });
  });

  it("renders session header + exercise + set slots when a session is active", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Push/i })).toBeVisible();
    });
    expect(screen.getByText(/Barbell Bench Press/i)).toBeVisible();

    // 2 set slots should render (count from the setBlock).
    const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
    expect(rows.length).toBe(2);
  });

  it("SessionProgress shows 0/2 counter + labelled aria text before logging", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");

    renderWorkout();

    await waitFor(() => {
      // Both SessionProgress (header) and ExerciseCard render the 0/2
      // counter with the same accessible label — verify at least one exists.
      expect(screen.getAllByText("0/2").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByLabelText(/0 of 2 sets logged/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens SetLogSheet when a set slot is tapped", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
    await user.click(rows[0]!);

    // Sheet title reuses the exercise name.
    await waitFor(() => {
      const dialogs = screen.getAllByRole("dialog");
      const sheet = dialogs[dialogs.length - 1]!;
      expect(within(sheet).getByText(/Barbell Bench Press/i)).toBeVisible();
    });
  });

  it("finishes a session and shows the celebration overlay, then navigates to Today", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Finish workout/i })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /Finish workout/i }));

    // Confirmation dialog shows a second "Finish workout" button.
    const confirmBtn = await screen.findByRole("button", { name: /^Finish workout$/i });
    await user.click(confirmBtn);

    // Session must be finished in DB.
    await waitFor(async () => {
      const sessions = await db.sessions.toArray();
      expect(sessions.length).toBe(1);
      expect(sessions[0]!.status).toBe("finished");
    });

    // Celebration overlay renders — does NOT navigate immediately.
    await screen.findByText(/Well done/i);

    // Auto-dismiss fires after ~1800 ms. MemoryRouter's navigate() call changes
    // the route; we observe that the celebration is no longer visible.
    await waitFor(
      () => {
        expect(screen.queryByText(/Well done/i)).toBeNull();
      },
      { timeout: 4000 },
    );
  });
});

describe("WorkoutScreen — elapsed timer sync", () => {
  beforeEach(async () => {
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

  it("shows non-zero elapsed immediately after the active session loads", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, routine.nextDayId);
    // Back-date startedAt so the elapsed value is reliably non-zero regardless of scheduler.
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    const active = await db.sessions.where("status").equals("active").first();
    if (!active) throw new Error("expected an active session to seed");
    await db.sessions.update(active.id, { startedAt: thirtySecondsAgo });

    renderWorkout();

    // SessionHeader renders "MM:SS elapsed". Before the fix, this sat at "0:00 elapsed"
    // for up to ~1s after activeSession resolved. With the fix, the first render that
    // has a startedAt must compute elapsed immediately.
    await waitFor(() => {
      const elapsed = screen.getByText(/\bELAPSED\b/i);
      expect(elapsed.textContent).not.toMatch(/\b0:0?0\b/);
    });
  });
});

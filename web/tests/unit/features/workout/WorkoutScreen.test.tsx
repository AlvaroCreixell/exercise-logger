import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import WorkoutScreen from "@/features/workout/WorkoutScreen";
import { db, initializeSettings } from "@/db/database";
import { startSessionWithCatalog } from "@/services/session-service";
import { logSet } from "@/services/set-service";
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

// ---------------------------------------------------------------------------
// Rest timer (Sprint 2 workout rhythm)
// ---------------------------------------------------------------------------

async function seedSupersetRoutine(): Promise<Routine> {
  await db.exercises.bulkPut([
    {
      id: "barbell-bench-press",
      name: "Barbell Bench Press",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["chest"],
    },
    {
      id: "barbell-row",
      name: "Barbell Row",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["back"],
    },
  ]);

  const routine: Routine = {
    id: "r-ss",
    schemaVersion: 1,
    name: "Superset Routine",
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
            kind: "superset",
            groupId: "g-1",
            items: [
              {
                kind: "exercise",
                entryId: "e-a",
                exerciseId: "barbell-bench-press",
                setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 2 }],
              },
              {
                kind: "exercise",
                entryId: "e-b",
                exerciseId: "barbell-row",
                setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 2 }],
              },
            ],
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

/** Opens the set sheet for the given slot row and saves it with the prefilled values. */
async function logSetViaSheet(user: ReturnType<typeof userEvent.setup>, rowIndex = 0) {
  const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
  await user.click(rows[rowIndex]!);
  const save = await screen.findByRole("button", { name: /^save$/i });
  await user.click(save);
}

describe("WorkoutScreen — rest timer", () => {
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
    vi.restoreAllMocks();
  });

  it("starts a rest timer from restDefaultSecSnapshot after a new set is saved", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);

    await waitFor(() => {
      expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
    });
    // restDefaultSec is 90 — remaining shows 1:30 (or 1:29 if a tick elapsed).
    expect(screen.getByText(/^1:(29|30)$/)).toBeVisible();
  });

  it("clears the timer when Skip is tapped", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(() => {
      expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(screen.queryByText("Rest — Barbell Bench Press")).toBeNull();
  });

  it("extends the remaining time by 30 seconds when +30s is tapped", async () => {
    const t0 = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(t0);

    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(() => {
      expect(screen.getByText("1:30")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /add 30 seconds/i }));
    expect(screen.getByText("2:00")).toBeVisible();
  });

  it("reaches the done state when the duration elapses and can be dismissed", async () => {
    const t0 = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);

    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(() => {
      expect(screen.getByText("1:30")).toBeVisible();
    });

    // Jump past the 90s duration; the 1s re-render tick picks it up.
    nowSpy.mockReturnValue(t0 + 91_000);
    await waitFor(
      () => {
        expect(screen.getByText(/rest complete/i)).toBeVisible();
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/rest complete/i)).toBeNull();
  });

  it("does not start a timer when editing an already-logged set", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(() => {
      expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
    });
    await user.click(screen.getByRole("button", { name: /skip/i }));

    // Re-open the (now logged) slot and save again — edit path, no timer.
    await logSetViaSheet(user, 0);
    await waitFor(async () => {
      const sets = await db.loggedSets.toArray();
      expect(sets.length).toBe(1);
    });
    expect(screen.queryByText("Rest — Barbell Bench Press")).toBeNull();
  });

  it("does not start a timer when saving a stale sheet over a slot logged elsewhere", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    // Open the sheet for the first (empty) slot.
    const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
    await user.click(rows[0]!);
    await screen.findByRole("button", { name: /^save$/i });

    // Meanwhile the same slot gets logged outside the sheet (stale-sheet race).
    const se = (await db.sessionExercises.toArray())[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 50,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    // Wait for the live query to deliver the external set to the screen.
    await waitFor(() => {
      expect(screen.getAllByText("1/2").length).toBeGreaterThanOrEqual(1);
    });

    // Saving the stale sheet is an update — it must NOT start a rest timer.
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
    });
    expect(screen.queryByText("Rest — Barbell Bench Press")).toBeNull();
  });

  it("does not clear a running timer when a set is deleted", async () => {
    const routine = await seedRoutineAndExercises();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(() => {
      expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
    });

    // Open the logged slot and delete it — the timer must keep running.
    const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
    await user.click(rows[0]!);
    await user.click(await screen.findByRole("button", { name: /delete this set/i }));
    await waitFor(async () => {
      const sets = await db.loggedSets.toArray();
      expect(sets.length).toBe(0);
    });

    expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
  });

  it("does not start any rest timer after A1 alone in a superset", async () => {
    const routine = await seedSupersetRoutine();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await waitFor(async () => {
      const sets = await db.loggedSets.toArray();
      expect(sets.length).toBe(1);
    });

    // Superset members never get the single-exercise default rest; the
    // superset timer waits for the B-side to complete the round.
    expect(screen.queryByText(/^Rest — /)).toBeNull();
  });
});

describe("WorkoutScreen — auto-PR wiring", () => {
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
    vi.restoreAllMocks();
  });

  it("auto-flags a record-beating set and persists isPersonalRecord", async () => {
    const routine = await seedRoutineAndExercises();
    // Prior best for bench: 60kg × 10, logged in some earlier session.
    await db.loggedSets.put({
      id: "prior-1",
      sessionId: "old-session",
      sessionExerciseId: "old-se",
      exerciseId: "barbell-bench-press",
      instanceLabel: "",
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:8-12:count2:tagnormal",
      setIndex: 0,
      tag: null,
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    });
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    const rows = await screen.findAllByRole("button", { name: /^Set \d+:/ });
    await user.click(rows[0]!);
    await screen.findByRole("button", { name: /^save$/i });

    // Reps prefill to the block minimum ("8"); type 100 (kg) into Weight.
    await user.click(screen.getByRole("button", { name: "Weight value" }));
    const keypad = screen.getByRole("group", { name: /numeric keypad/i });
    await user.click(within(keypad).getByRole("button", { name: "1" }));
    await user.click(within(keypad).getByRole("button", { name: "0" }));
    await user.click(within(keypad).getByRole("button", { name: "0" }));

    // The auto hint proves personalBests reached the sheet.
    await waitFor(() => {
      expect(screen.getByText("auto")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(async () => {
      const sets = await db.loggedSets.toArray();
      const saved = sets.find((s) => s.performedWeightKg === 100);
      expect(saved?.isPersonalRecord).toBe(true);
    });
  });
});

describe("WorkoutScreen — superset rhythm integration", () => {
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
    vi.restoreAllMocks();
  });

  it("renders the round rail with A1 as the current step before any logging", async () => {
    const routine = await seedSupersetRoutine();
    await startSessionWithCatalog(db, routine, "A");

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText(/alternate a then b before resting/i)).toBeVisible();
    });
    const current = screen.getByText("A1", { selector: "[aria-current='step']" });
    expect(current).toBeVisible();
  });

  it("starts the superset rest timer only when B1 completes round 1", async () => {
    const routine = await seedSupersetRoutine();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();

    // A1 — bench set 1 (rows render bench 0,1 then row 2,3).
    await logSetViaSheet(user, 0);
    await waitFor(async () => {
      const sets = await db.loggedSets.toArray();
      expect(sets.length).toBe(1);
    });
    expect(screen.queryByText(/^Rest — /)).toBeNull();

    // B1 — barbell row set 1 completes the round.
    await logSetViaSheet(user, 2);
    await waitFor(() => {
      expect(screen.getByText("Rest — Superset round 1")).toBeVisible();
    });
    // restSupersetSec is 45 — remaining shows 0:45 (or 0:44 if a tick elapsed).
    expect(screen.getByText(/^0:4(4|5)$/)).toBeVisible();
  });

  it("marks A1 and B1 complete and points at A2 after round 1", async () => {
    const routine = await seedSupersetRoutine();
    await startSessionWithCatalog(db, routine, "A");
    const user = userEvent.setup();

    renderWorkout();
    await logSetViaSheet(user, 0);
    await logSetViaSheet(user, 2);

    await waitFor(() => {
      expect(
        screen.getByText("A2", { selector: "[aria-current='step']" }),
      ).toBeVisible();
    });
    expect(screen.getByText("A1").closest("[data-status]")).toHaveAttribute(
      "data-status",
      "complete",
    );
    expect(screen.getByText("B1").closest("[data-status]")).toHaveAttribute(
      "data-status",
      "complete",
    );
  });
});

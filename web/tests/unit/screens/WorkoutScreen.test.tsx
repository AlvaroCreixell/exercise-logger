import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WorkoutScreen from "@/screens/WorkoutScreen";

vi.mock("@/db/database", async () => {
  const { ExerciseLoggerDB: RealDB } = await vi.importActual<
    typeof import("@/db/database")
  >("@/db/database");

  const testDb = new RealDB();
  return {
    ExerciseLoggerDB: RealDB,
    db: testDb,
    initializeSettings: vi.fn(),
    DEFAULT_SETTINGS: {
      id: "user",
      activeRoutineId: null,
      units: "kg",
      theme: "system",
    },
  };
});

const { db } = await import("@/db/database");
import { ExerciseLoggerDB } from "@/db/database";

describe("WorkoutScreen", () => {
  beforeEach(async () => {
    const typedDb = db as ExerciseLoggerDB;
    await typedDb.settings.put({
      id: "user",
      activeRoutineId: null,
      units: "kg",
      theme: "system",
    });
  });

  afterEach(async () => {
    const typedDb = db as ExerciseLoggerDB;
    await typedDb.settings.clear();
    await typedDb.sessions.clear();
    await typedDb.sessionExercises.clear();
    await typedDb.loggedSets.clear();
  });

  it("shows empty state when no active session", async () => {
    render(
      <MemoryRouter>
        <WorkoutScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No Active Workout")).toBeInTheDocument();
    });
    expect(screen.getByText("Start one from Today.")).toBeInTheDocument();
  });

  it("shows session header when active session exists", async () => {
    const typedDb = db as ExerciseLoggerDB;
    await typedDb.sessions.add({
      id: "s1",
      routineId: "r1",
      routineNameSnapshot: "Full Body",
      dayId: "A",
      dayLabelSnapshot: "Heavy Squat",
      dayOrderSnapshot: ["A", "B"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "active",
      startedAt: "2026-03-28T14:00:00.000Z",
      finishedAt: null,
    });

    render(
      <MemoryRouter>
        <WorkoutScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Full Body")).toBeInTheDocument();
    });
    expect(screen.getByText(/Day A.*Heavy Squat/)).toBeInTheDocument();
    expect(screen.getByText(/finish workout/i)).toBeInTheDocument();
  });
});

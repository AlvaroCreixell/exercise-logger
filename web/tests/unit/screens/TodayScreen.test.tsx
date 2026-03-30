import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TodayScreen from "@/screens/TodayScreen";

// Mock the db module
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

describe("TodayScreen", () => {
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
    await typedDb.routines.clear();
    await typedDb.sessions.clear();
    await typedDb.sessionExercises.clear();
    await typedDb.loggedSets.clear();
  });

  it("shows empty state when no active routine", async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No Active Routine")).toBeInTheDocument();
    });
    expect(screen.getByText(/import a routine/i)).toBeInTheDocument();
  });

  it("shows routine name and suggested day when routine is active", async () => {
    const typedDb = db as ExerciseLoggerDB;
    const routine = {
      id: "r1",
      schemaVersion: 1,
      name: "Test Routine",
      restDefaultSec: 90,
      restSupersetSec: 60,
      dayOrder: ["A", "B"],
      nextDayId: "A",
      days: {
        A: { id: "A", label: "Day A", entries: [] },
        B: { id: "B", label: "Day B", entries: [] },
      },
      notes: [],
      cardio: null,
      importedAt: "2026-03-28T12:00:00.000Z",
    };
    await typedDb.routines.add(routine);
    await typedDb.settings.update("user", { activeRoutineId: "r1" });

    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Routine")).toBeInTheDocument();
    });
    expect(screen.getByText(/start workout/i)).toBeInTheDocument();
  });
});

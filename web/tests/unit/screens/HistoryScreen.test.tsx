import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, afterEach } from "vitest";
import HistoryScreen from "@/screens/HistoryScreen";

vi.mock("@/db/database", async () => {
  const { ExerciseLoggerDB: RealDB } = await vi.importActual<
    typeof import("@/db/database")
  >("@/db/database");

  const testDb = new RealDB();
  return {
    ExerciseLoggerDB: RealDB,
    db: testDb,
    initializeSettings: vi.fn(),
  };
});

const { db } = await import("@/db/database");
import { ExerciseLoggerDB } from "@/db/database";

describe("HistoryScreen", () => {
  afterEach(async () => {
    const typedDb = db as ExerciseLoggerDB;
    await typedDb.sessions.clear();
    await typedDb.sessionExercises.clear();
    await typedDb.loggedSets.clear();
  });

  it("shows empty state when no finished sessions", async () => {
    render(
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No History Yet")).toBeInTheDocument();
    });
  });

  it("lists finished sessions", async () => {
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
      status: "finished",
      startedAt: "2026-03-28T14:00:00.000Z",
      finishedAt: "2026-03-28T15:30:00.000Z",
    });

    render(
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Day A.*Heavy Squat/)).toBeInTheDocument();
    });
    expect(screen.getByText("Full Body")).toBeInTheDocument();
  });
});

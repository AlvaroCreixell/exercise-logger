import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SettingsScreen from "@/screens/SettingsScreen";

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

describe("SettingsScreen", () => {
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
  });

  it("renders all setting sections", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Routines")).toBeInTheDocument();
    });
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
  });

  it("shows empty routines message when no routines loaded", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no routines loaded/i)
      ).toBeInTheDocument();
    });
  });

  it("shows routine import button", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/import routine/i)
      ).toBeInTheDocument();
    });
  });

  it("shows units toggle with kg selected by default", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("kg")).toBeInTheDocument();
      expect(screen.getByText("lbs")).toBeInTheDocument();
    });
  });

  it("shows theme toggle options", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Light")).toBeInTheDocument();
      expect(screen.getByText("Dark")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  it("shows data management buttons", async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/export data/i)).toBeInTheDocument();
      expect(screen.getByText(/import data/i)).toBeInTheDocument();
      expect(screen.getByText(/clear all data/i)).toBeInTheDocument();
    });
  });
});

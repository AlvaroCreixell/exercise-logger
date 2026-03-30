import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import App from "@/App";

// Mock the catalog service to avoid needing the embedded CSV
vi.mock("@/services/catalog-service", () => ({
  loadEmbeddedCatalog: () => [],
  seedCatalog: async () => {},
  parseExerciseCatalog: () => [],
}));

// Mock the db with a test instance
vi.mock("@/db/database", async () => {
  const { ExerciseLoggerDB: RealDB } = await vi.importActual<
    typeof import("@/db/database")
  >("@/db/database");

  const testDb = new RealDB();
  return {
    ExerciseLoggerDB: RealDB,
    db: testDb,
    initializeSettings: async (db: InstanceType<typeof RealDB>) => {
      const existing = await db.settings.get("user");
      if (!existing) {
        await db.settings.put({
          id: "user",
          activeRoutineId: null,
          units: "kg",
          theme: "system",
        });
      }
    },
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

// Mock matchMedia for SettingsScreen
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("App", () => {
  afterEach(async () => {
    const typedDb = db as ExerciseLoggerDB;
    await typedDb.settings.clear();
    await typedDb.routines.clear();
    await typedDb.sessions.clear();
    await typedDb.sessionExercises.clear();
    await typedDb.loggedSets.clear();
    await typedDb.exercises.clear();
  });

  it("renders the Today screen by default", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);

    // Wait for initialization and content to appear
    await waitFor(() => {
      expect(screen.getByText("No Active Routine")).toBeInTheDocument();
    });
  });

  it("navigates to Workout screen when Workout tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Workout" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "Workout" }));

    await waitFor(() => {
      expect(screen.getByText("No Active Workout")).toBeInTheDocument();
    });
  });

  it("navigates to History screen when History tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("No History Yet")).toBeInTheDocument();
    });
  });

  it("navigates to Settings screen when Settings tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByText("Routines")).toBeInTheDocument();
    });
  });

  it("renders all four tab links in the navigation bar", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Workout" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    });
  });
});

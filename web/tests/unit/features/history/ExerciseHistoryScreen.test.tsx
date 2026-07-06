import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import ExerciseHistoryScreen from "@/features/history/ExerciseHistoryScreen";
import { db, initializeSettings } from "@/db/database";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

const EXERCISE_ID = "barbell-bench-press";

function makeSession(id: string, day: number): Session {
  const dd = String(day).padStart(2, "0");
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Routine",
    dayId: "A",
    dayLabelSnapshot: "A Day",
    dayOrderSnapshot: ["A", "B"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: `2026-06-${dd}T10:00:00.000Z`,
    finishedAt: `2026-06-${dd}T11:00:00.000Z`,
  };
}

function makeSE(id: string, sessionId: string): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: "re-1",
    exerciseId: EXERCISE_ID,
    exerciseNameSnapshot: "Barbell Bench Press",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [],
    createdAt: "2026-06-01T10:00:00.000Z",
    unitOverride: null,
  };
}

function makeSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  weightKg: number,
  reps: number,
  overrides: Partial<LoggedSet> = {}
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId: EXERCISE_ID,
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: weightKg,
    performedReps: reps,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-06-01T10:05:00.000Z",
    updatedAt: "2026-06-01T10:05:00.000Z",
    ...overrides,
  };
}

async function clearDb() {
  await Promise.all([
    db.settings.clear(),
    db.sessions.clear(),
    db.sessionExercises.clear(),
    db.loggedSets.clear(),
  ]);
  await initializeSettings(db);
}

/** Three finished sessions, top sets 60 → 70 → 80 kg; the 80kg set is a PR. */
async function seedThreeSessions() {
  await clearDb();
  await db.sessions.bulkPut([
    makeSession("s1", 1),
    makeSession("s2", 3),
    makeSession("s3", 5),
  ]);
  await db.sessionExercises.bulkPut([
    makeSE("se1", "s1"),
    makeSE("se2", "s2"),
    makeSE("se3", "s3"),
  ]);
  await db.loggedSets.bulkPut([
    makeSet("ls1", "s1", "se1", 60, 8, {
      loggedAt: "2026-06-01T10:05:00.000Z",
    }),
    makeSet("ls2", "s2", "se2", 70, 8, {
      loggedAt: "2026-06-03T10:05:00.000Z",
    }),
    makeSet("ls3", "s3", "se3", 80, 8, {
      loggedAt: "2026-06-05T10:05:00.000Z",
      isPersonalRecord: true,
    }),
    makeSet("ls4", "s3", "se3", 72.5, 10, {
      setIndex: 1,
      loggedAt: "2026-06-05T10:10:00.000Z",
    }),
  ]);
}

async function seedSingleSession() {
  await clearDb();
  await db.sessions.put(makeSession("s1", 1));
  await db.sessionExercises.put(makeSE("se1", "s1"));
  await db.loggedSets.put(
    makeSet("ls1", "s1", "se1", 60, 8, {
      loggedAt: "2026-06-01T10:05:00.000Z",
    })
  );
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/history/exercise/${EXERCISE_ID}`]}>
      <Routes>
        <Route
          path="/history/exercise/:exerciseId"
          element={<ExerciseHistoryScreen />}
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

describe("ExerciseHistoryScreen — trend + summary", () => {
  beforeEach(async () => {
    await seedThreeSessions();
  });

  it("renders the spark-line above the session list", async () => {
    renderScreen();
    const img = await screen.findByRole("img");
    expect(img).toHaveAccessibleName(
      "Top set trend across 3 sessions: 60kg to 80kg"
    );
  });

  it("renders the three-stat best-lift row", async () => {
    renderScreen();
    expect(await screen.findByText("All-time best")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByText("Last session")).toBeInTheDocument();
    // All-time best and last-session top set are both the 80kg × 8 set.
    expect(screen.getAllByText("80kg × 8").length).toBeGreaterThanOrEqual(2);
  });

  it("marks PR sets with a small PR marker in the session set lists", async () => {
    renderScreen();
    await screen.findByText("All-time best");
    // Exactly one set is flagged isPersonalRecord.
    expect(screen.getAllByText("PR")).toHaveLength(1);
  });

  it("still renders the session groups below the summary", async () => {
    renderScreen();
    const headers = await screen.findAllByText(/A Day — Routine/);
    expect(headers).toHaveLength(3);
    expect(screen.getByText("60kg × 8")).toBeInTheDocument();
    expect(screen.getByText("70kg × 8")).toBeInTheDocument();
  });
});

describe("ExerciseHistoryScreen — single session", () => {
  beforeEach(async () => {
    await seedSingleSession();
  });

  it("renders no chart or stats but still shows the session list", async () => {
    renderScreen();
    expect(await screen.findByText("60kg × 8")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("All-time best")).toBeNull();
  });
});

describe("ExerciseHistoryScreen — existing behavior", () => {
  it("shows the empty state when the exercise has no history", async () => {
    await clearDb();
    renderScreen();
    expect(await screen.findByText(/no history yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps the back button", async () => {
    await seedThreeSessions();
    renderScreen();
    expect(
      await screen.findByRole("button", { name: /back/i })
    ).toBeInTheDocument();
  });
});

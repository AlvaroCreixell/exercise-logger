import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import HistoryScreen from "@/features/history/HistoryScreen";
import { db, initializeSettings } from "@/db/database";
import type { Session, SessionExercise } from "@/domain/types";

function makeSession(id: string, dayId: string, day: number): Session {
  const dd = String(day).padStart(2, "0");
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Routine",
    dayId,
    dayLabelSnapshot: `${dayId} Day`,
    dayOrderSnapshot: ["A", "B"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: `2026-06-${dd}T10:00:00.000Z`,
    finishedAt: `2026-06-${dd}T11:00:00.000Z`,
  };
}

function makeSE(id: string, sessionId: string, name: string): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: "re-1",
    exerciseId: name.toLowerCase().replace(/ /g, "-"),
    exerciseNameSnapshot: name,
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

async function seed(sessionCount: number) {
  await Promise.all([
    db.settings.clear(),
    db.sessions.clear(),
    db.sessionExercises.clear(),
    db.loggedSets.clear(),
  ]);
  await initializeSettings(db);
  const sessions: Session[] = [];
  for (let i = 0; i < sessionCount; i++) {
    // Alternate A/B days.
    sessions.push(makeSession(`s${i}`, i % 2 === 0 ? "A" : "B", i + 1));
  }
  await db.sessions.bulkPut(sessions);
  // s0 gets a bench press so exercise search can find it.
  await db.sessionExercises.bulkPut([
    makeSE("se0", "s0", "Barbell Bench Press"),
    makeSE("se1", "s1", "Barbell Back Squat"),
  ]);
}

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <HistoryScreen />
    </MemoryRouter>,
  );
}

describe("HistoryScreen — filters", () => {
  beforeEach(async () => {
    await seed(6);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows day chips and search once enough sessions exist", async () => {
    renderHistory();
    expect(
      await screen.findByRole("button", { name: "Day A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search by exercise/i }),
    ).toBeInTheDocument();
  });

  it("day chip filters the list to that day's sessions", async () => {
    const user = userEvent.setup();
    renderHistory();
    // 6 sessions render as links; 3 are day A, 3 are day B.
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(6);
    });
    await user.click(screen.getByRole("button", { name: "Day A" }));
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(3);
    });
    // All rows shown are A-day rows.
    for (const label of screen.getAllByText(/ Day$/)) {
      expect(label.textContent).toBe("A Day");
    }
  });

  it("search narrows to sessions containing the exercise", async () => {
    const user = userEvent.setup();
    renderHistory();
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(6);
    });
    await user.type(
      screen.getByRole("searchbox", { name: /search by exercise/i }),
      "bench",
    );
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(1);
    });
  });

  it("shows an inline no-match message instead of the global empty state", async () => {
    const user = userEvent.setup();
    renderHistory();
    await user.type(
      await screen.findByRole("searchbox", { name: /search by exercise/i }),
      "zzz-not-an-exercise",
    );
    expect(await screen.findByText(/no sessions match/i)).toBeInTheDocument();
    expect(screen.queryByText(/no history yet/i)).toBeNull();
  });
});

describe("HistoryScreen — filters hidden for small histories", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders no filter bar below the session threshold", async () => {
    await seed(3);
    renderHistory();
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBe(3);
    });
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Day A" })).toBeNull();
  });
});

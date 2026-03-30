import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ExerciseCard from "@/components/ExerciseCard";
import type { SessionExercise, LoggedSet } from "@/domain/types";

function makeSessionExercise(
  overrides: Partial<SessionExercise> = {}
): SessionExercise {
  return {
    id: "se1",
    sessionId: "s1",
    routineEntryId: "re1",
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: null,
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: "Warm up with 2 lighter sets",
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" },
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
    ],
    createdAt: "2026-03-28T12:00:00.000Z",
    ...overrides,
  };
}

describe("ExerciseCard", () => {
  const defaultProps = {
    loggedSets: [] as LoggedSet[],
    historyData: { lastTime: [], suggestions: [] },
    extraHistory: null,
    units: "kg" as const,
    isActiveSession: true,
    onLogSet: vi.fn(),
    onDeleteSet: vi.fn(),
  };

  it("renders exercise name", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
  });

  it("renders notes", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        {...defaultProps}
      />
    );
    expect(
      screen.getByText("Warm up with 2 lighter sets")
    ).toBeInTheDocument();
  });

  it("renders prescription text for each block", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("1 x 6-8 (top)")).toBeInTheDocument();
    expect(screen.getByText("3 x 8-12")).toBeInTheDocument();
  });

  it("renders set slots for each block", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        {...defaultProps}
      />
    );
    // Block 0: 1 set, Block 1: 3 sets = 4 set slots total
    const setButtons = screen.getAllByRole("button", { name: /set \d/i });
    expect(setButtons.length).toBe(4);
  });

  it("shows Extra badge for extra exercises", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise({
          origin: "extra",
          setBlocksSnapshot: [],
        })}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Extra")).toBeInTheDocument();
  });

  it("shows add set button for extras in active session", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise({
          origin: "extra",
          setBlocksSnapshot: [],
        })}
        {...defaultProps}
      />
    );
    expect(screen.getByRole("button", { name: /add set/i })).toBeInTheDocument();
  });

  it("shows 'No previous data' when no history", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        {...defaultProps}
        historyData={{ lastTime: [], suggestions: [] }}
      />
    );
    expect(screen.getByText("No previous data")).toBeInTheDocument();
  });
});

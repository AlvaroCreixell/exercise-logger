import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionDetailExerciseCard } from "@/features/history/SessionDetailExerciseCard";
import type { LoggedSet } from "@/domain/types";

function makeSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls",
    sessionId: "s",
    sessionExerciseId: "se",
    exerciseId: "ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: 30,
    performedReps: 14,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("SessionDetailExerciseCard", () => {
  it("renders the exercise name", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="Dumbbell Romanian Deadlift"
        loggedSets={[]}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("Dumbbell Romanian Deadlift")).toBeVisible();
  });

  it("renders each set as a pill with 'weight×reps'", () => {
    const sets = [
      makeSet({ id: "a", setIndex: 0, performedWeightKg: 30, performedReps: 14 }),
      makeSet({ id: "b", setIndex: 1, performedWeightKg: 32, performedReps: 11 }),
    ];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("30×14")).toBeVisible();
    expect(screen.getByText("32×11")).toBeVisible();
  });

  it("renders '—' for sets missing weight or reps", () => {
    const sets = [makeSet({ performedWeightKg: null, performedReps: null })];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("calls onSetTap with (blockIndex, setIndex) when a pill is clicked", async () => {
    const spy = vi.fn();
    const sets = [
      makeSet({ id: "a", blockIndex: 0, setIndex: 2, performedWeightKg: 30, performedReps: 14 }),
    ];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={spy}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /30×14/ }));
    expect(spy).toHaveBeenCalledWith(0, 2);
  });

  it("converts weight to display units when units='lbs'", () => {
    const sets = [makeSet({ performedWeightKg: 22.68, performedReps: 10 })];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="lbs"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/50×10/)).toBeVisible();
  });

  it("preserves fractional kg without rounding (82.5×5, not 83×5)", () => {
    const sets = [makeSet({ performedWeightKg: 82.5, performedReps: 5 })];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("82.5×5")).toBeVisible();
    expect(screen.queryByText("83×5")).toBeNull();
  });

  it("preserves fractional lbs conversion without rounding", () => {
    // 82.5 kg ≈ 181.88 lbs; toDisplayWeight clips to 2 decimals
    const sets = [makeSet({ performedWeightKg: 82.5, performedReps: 5 })];
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={sets}
        units="lbs"
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/^181\.\d+×5$/)).toBeVisible();
    expect(screen.queryByText("182×5")).toBeNull();
  });

  it("renders no pills when loggedSets is empty", () => {
    render(
      <SessionDetailExerciseCard
        exerciseName="RDL"
        loggedSets={[]}
        units="kg"
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
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
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Dumbbell Romanian Deadlift"
          exerciseId="dumbbell-romanian-deadlift"
          loggedSets={[]}
          units="kg"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Dumbbell Romanian Deadlift")).toBeVisible();
  });

  it("renders each set as a pill with 'weight kg × reps'", () => {
    const sets = [
      makeSet({ id: "a", setIndex: 0, performedWeightKg: 30, performedReps: 14 }),
      makeSet({ id: "b", setIndex: 1, performedWeightKg: 32, performedReps: 11 }),
    ];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="kg"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("30kg × 14")).toBeVisible();
    expect(screen.getByText("32kg × 11")).toBeVisible();
  });

  it("renders '—' for a truly empty set (all four performance fields null)", () => {
    const sets = [makeSet({ performedWeightKg: null, performedReps: null })];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="kg"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("calls onSetTap with (blockIndex, setIndex) when a pill is clicked", async () => {
    const spy = vi.fn();
    const sets = [
      makeSet({ id: "a", blockIndex: 0, setIndex: 2, performedWeightKg: 30, performedReps: 14 }),
    ];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="kg"
          onSetTap={spy}
        />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /30kg × 14/ }));
    expect(spy).toHaveBeenCalledWith(0, 2);
  });

  it("converts weight to display units when units='lbs'", () => {
    const sets = [makeSet({ performedWeightKg: 22.68, performedReps: 10 })];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="lbs"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/50lbs × 10/)).toBeVisible();
  });

  it("preserves fractional kg without rounding (82.5×5, not 83×5)", () => {
    const sets = [makeSet({ performedWeightKg: 82.5, performedReps: 5 })];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="kg"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("82.5kg × 5")).toBeVisible();
    expect(screen.queryByText("83kg × 5")).toBeNull();
  });

  it("preserves fractional lbs conversion without rounding", () => {
    // 82.5 kg ≈ 181.88 lbs; toDisplayWeight clips to 2 decimals
    const sets = [makeSet({ performedWeightKg: 82.5, performedReps: 5 })];
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={sets}
          units="lbs"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/^181\.\d+lbs × 5$/)).toBeVisible();
    expect(screen.queryByText("182lbs × 5")).toBeNull();
  });

  it("renders no pills when loggedSets is empty", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="RDL"
          exerciseId="rdl"
          loggedSets={[]}
          units="kg"
          onSetTap={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// New tests covering all 5 value combinations via formatLoggedSet (Task 4 fix)
// ---------------------------------------------------------------------------

function makeLoggedSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls-test",
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "test-ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-23T10:00:00.000Z",
    updatedAt: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("SessionDetailExerciseCard — formatLoggedSet migration (Task 4)", () => {
  it("renders weight + reps as 'Wkg × R'", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Squat"
          exerciseId="squat"
          loggedSets={[makeLoggedSet({ performedWeightKg: 80, performedReps: 10 })]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /80kg × 10/ })).toBeInTheDocument();
  });

  it("renders reps-only as 'R reps' (was '—' pre-fix)", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Push-up"
          exerciseId="push-up"
          loggedSets={[makeLoggedSet({ performedReps: 12 })]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /12 reps/ })).toBeInTheDocument();
  });

  it("renders duration-only as 'Ds' (was '—' pre-fix)", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Plank"
          exerciseId="plank"
          loggedSets={[makeLoggedSet({ performedDurationSec: 60 })]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /60s/ })).toBeInTheDocument();
  });

  it("renders distance-only as 'Dm' (was '—' pre-fix)", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Run"
          exerciseId="run"
          loggedSets={[makeLoggedSet({ performedDistanceM: 500 })]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /500m/ })).toBeInTheDocument();
  });

  it("renders the dash for a truly empty set", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Empty"
          exerciseId="empty"
          loggedSets={[makeLoggedSet({})]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /—/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Navigation link test (Task 2 — F7 closure)
// ---------------------------------------------------------------------------

describe("SessionDetailExerciseCard exercise-history link", () => {
  it("renders the exercise name as a link to /history/exercise/:exerciseId", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Barbell Squat"
          exerciseId="barbell-back-squat"
          loggedSets={[]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /barbell squat/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/history/exercise/barbell-back-squat");
  });
});

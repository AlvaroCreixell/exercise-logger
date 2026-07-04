// web/tests/unit/features/workout/SupersetGroup.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { SupersetGroup } from "@/features/workout/SupersetGroup";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";

afterEach(cleanup);

function makeSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: "se-a",
    sessionId: "s-1",
    routineEntryId: "re-1",
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "superset",
    supersetGroupId: "sg-1",
    supersetPosition: 0,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
    ],
    createdAt: "2026-07-04T12:00:00.000Z",
    unitOverride: null,
    ...overrides,
  };
}

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls-1",
    sessionId: "s-1",
    sessionExerciseId: "se-a",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count2:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 70,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-07-04T12:00:00.000Z",
    updatedAt: "2026-07-04T12:00:00.000Z",
    ...overrides,
  };
}

function makePair(): [SessionExercise, SessionExercise] {
  return [
    makeSessionExercise({ id: "se-a" }),
    makeSessionExercise({
      id: "se-b",
      exerciseId: "romanian-deadlift",
      exerciseNameSnapshot: "Romanian Deadlift",
      supersetPosition: 1,
    }),
  ];
}

describe("SupersetGroup — legacy children-only API", () => {
  it("renders the Superset header and children unchanged", () => {
    render(
      <SupersetGroup>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    expect(screen.getByText("Superset")).toBeVisible();
    expect(screen.getByText("Child One")).toBeVisible();
    expect(screen.getByText("Child Two")).toBeVisible();
  });

  it("does not render the rhythm sub-label, rail, or A/B labels without data props", () => {
    render(
      <SupersetGroup>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    expect(screen.queryByText("Alternate A then B before resting")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Superset rounds" })).not.toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });
});

describe("SupersetGroup — with rhythm data", () => {
  it("renders the sub-label under the Superset header", () => {
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={new Map()}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    expect(screen.getByText("Superset")).toBeVisible();
    expect(screen.getByText("Alternate A then B before resting")).toBeVisible();
  });

  it("renders the round rail with interleaved chips", () => {
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={new Map()}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    const rail = screen.getByRole("list", { name: "Superset rounds" });
    const chips = within(rail).queryAllByText(/^[AB]\d+$/);
    expect(chips.map((c) => c.textContent)).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("derives chip states from logged sets (A1 complete, B1 current)", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ sessionExerciseId: "se-a", setIndex: 0 })]],
    ]);
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={setsByExercise}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    const a1 = screen.getByText("A1").closest("[data-status]");
    const b1 = screen.getByText("B1").closest("[data-status]");
    expect(a1).toHaveAttribute("data-status", "complete");
    expect(b1).toHaveAttribute("data-status", "current");
    expect(b1).toHaveAttribute("aria-current", "step");
  });

  it("labels the two children sections A and B in order", () => {
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={new Map()}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    const sectionA = screen.getByText("Child One").closest("[data-superset-side]");
    const sectionB = screen.getByText("Child Two").closest("[data-superset-side]");
    expect(sectionA).toHaveAttribute("data-superset-side", "A");
    expect(sectionB).toHaveAttribute("data-superset-side", "B");
    expect(within(sectionA as HTMLElement).getByText("A")).toBeVisible();
    expect(within(sectionB as HTMLElement).getByText("B")).toBeVisible();
  });

  it("still renders both children with rhythm props", () => {
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={new Map()}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    expect(screen.getByText("Child One")).toBeVisible();
    expect(screen.getByText("Child Two")).toBeVisible();
  });

  it("does not crash on mismatched set structures (A has 3, B has 2)", () => {
    const pair: [SessionExercise, SessionExercise] = [
      makeSessionExercise({
        id: "se-a",
        setBlocksSnapshot: [
          { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
        ],
      }),
      makeSessionExercise({ id: "se-b", supersetPosition: 1 }),
    ];
    render(
      <SupersetGroup exercises={pair} setsByExercise={new Map()}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    const rail = screen.getByRole("list", { name: "Superset rounds" });
    expect(within(rail).queryAllByText(/^[AB]\d+$/)).toHaveLength(6); // A1..B3
  });

  it("renders overrun rounds logged past the prescription", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      [
        "se-a",
        [
          makeLoggedSet({ id: "ls-1", sessionExerciseId: "se-a", setIndex: 0 }),
          makeLoggedSet({ id: "ls-2", sessionExerciseId: "se-a", setIndex: 1 }),
          makeLoggedSet({ id: "ls-3", sessionExerciseId: "se-a", setIndex: 2 }),
        ],
      ],
    ]);
    render(
      <SupersetGroup exercises={makePair()} setsByExercise={setsByExercise}>
        <div>Child One</div>
        <div>Child Two</div>
      </SupersetGroup>,
    );
    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(screen.getByText("B3")).toBeInTheDocument();
  });
});

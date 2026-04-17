// web/tests/unit/features/workout/ExerciseCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";

function makeSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: "se-1",
    sessionId: "s-1",
    routineEntryId: "re-1",
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
    ],
    createdAt: "2026-04-16T12:00:00.000Z",
    unitOverride: null,
    ...overrides,
  };
}

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls-1",
    sessionId: "s-1",
    sessionExerciseId: "se-1",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 80,
    performedReps: 8,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("ExerciseCard", () => {
  it("renders the exercise name", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    expect(screen.getByText("Barbell Back Squat")).toBeVisible();
  });

  it("renders distance-only history under 'Last' for routine blocks", () => {
    const distanceBlock: SetBlock = {
      targetKind: "distance",
      exactValue: 2000,
      count: 2,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Rowing 2K Sprint",
      setBlocksSnapshot: [distanceBlock],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: null, reps: null, durationSec: null, distanceM: 2000 },
            { weightKg: null, reps: null, durationSec: null, distanceM: 2050 },
          ],
        },
      ],
      suggestions: [],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Last\s+2000m,\s*2050m/)).toBeVisible();
  });

  it("renders distance-only history under 'Recent:' for extra exercises", () => {
    const se = makeSessionExercise({
      origin: "extra",
      setBlocksSnapshot: [],
    });
    const extraHistory: ExtraExerciseHistory = {
      sessionDate: "2026-04-16T12:00:00.000Z",
      sets: [
        { weightKg: null, reps: null, durationSec: null, distanceM: 1500 },
      ],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={extraHistory}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Recent:\s*1500m/)).toBeVisible();
  });

  it("extras pass the stored loggedSet.setIndex to onSetTap (not the render index)", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();

    // Simulates the state after logging extras at setIndex 0, 1, 2 and then
    // deleting the one at setIndex 1. The remaining stored indices are 0 and 2.
    const loggedSets: LoggedSet[] = [
      makeLoggedSet({
        id: "ls-a",
        setIndex: 0,
        loggedAt: "2026-04-16T12:00:00.000Z",
      }),
      makeLoggedSet({
        id: "ls-c",
        setIndex: 2,
        loggedAt: "2026-04-16T12:02:00.000Z",
      }),
    ];
    const se = makeSessionExercise({
      origin: "extra",
      setBlocksSnapshot: [],
    });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={loggedSets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />
    );

    // The two logged slots render in chronological order; the third (empty)
    // slot is the "add another extra" affordance. Find all set-slot elements
    // and click the SECOND logged one (index 1 in render order, but stored
    // setIndex is 2).
    const slots = screen.getAllByTestId("set-slot");
    // slots[0] = logged setIndex 0, slots[1] = logged setIndex 2,
    // slots[2] = empty new-set slot at nextSetIndex (= 3, since max stored
    // setIndex is 2). The next test exercises that slot specifically.
    expect(slots).toHaveLength(3);

    await user.click(slots[1]!);

    expect(onSetTap).toHaveBeenCalledWith(0, 2);
  });

  it("the empty 'add extra' slot uses max(setIndex)+1, not loggedSets.length", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();

    // Two surviving extras at stored indices 0 and 2 (middle one deleted).
    // loggedSets.length = 2, but setIndex 2 is taken — the new slot must
    // open at setIndex 3.
    const loggedSets: LoggedSet[] = [
      makeLoggedSet({ id: "ls-a", setIndex: 0, loggedAt: "2026-04-16T12:00:00.000Z" }),
      makeLoggedSet({ id: "ls-c", setIndex: 2, loggedAt: "2026-04-16T12:02:00.000Z" }),
    ];
    const se = makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={loggedSets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />
    );

    const slots = screen.getAllByTestId("set-slot");
    // slots[2] is the empty add-new affordance.
    await user.click(slots[2]!);

    expect(onSetTap).toHaveBeenCalledWith(0, 3);
  });

  it("renders duration+distance history as combined 'min' + 'm' under 'Last'", () => {
    // Running workout: one "set" that captures both a 30min duration AND a 5K distance.
    const runBlock: SetBlock = {
      targetKind: "duration",
      exactValue: 1800,
      count: 1,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Outdoor Run",
      setBlocksSnapshot: [runBlock],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [{ weightKg: null, reps: null, durationSec: 1800, distanceM: 5000 }],
        },
      ],
      suggestions: [],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Last\s+30min\s+5000m/)).toBeVisible();
  });

  it("renders duration-only history in minutes when divisible by 60", () => {
    const durationBlock: SetBlock = {
      targetKind: "duration",
      exactValue: 1800,
      count: 1,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Plank Hold",
      setBlocksSnapshot: [durationBlock],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [{ weightKg: null, reps: null, durationSec: 1800, distanceM: null }],
        },
      ],
      suggestions: [],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Last\s+30min/)).toBeVisible();
  });

  it("renders a duration target as minutes when exactValue is divisible by 60", () => {
    const runBlock: SetBlock = {
      targetKind: "duration",
      exactValue: 1800,
      count: 1,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Outdoor Run",
      setBlocksSnapshot: [runBlock],
    });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText("1 x 30min")).toBeVisible();
  });

  it("renders a duration range target in minutes when both endpoints are clean minutes", () => {
    const runRangeBlock: SetBlock = {
      targetKind: "duration",
      minValue: 1800,
      maxValue: 3600,
      count: 1,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Outdoor Run",
      setBlocksSnapshot: [runRangeBlock],
    });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText("1 x 30-60min")).toBeVisible();
  });

  it("keeps a sub-minute duration range target in seconds", () => {
    const plankBlock: SetBlock = {
      targetKind: "duration",
      minValue: 30,
      maxValue: 60,
      count: 2,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Plank",
      setBlocksSnapshot: [plankBlock],
    });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText("2 x 30-60s")).toBeVisible();
  });

  it("keeps seconds format for sub-minute durations", () => {
    const durationBlock: SetBlock = {
      targetKind: "duration",
      exactValue: 45,
      count: 1,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Short Plank",
      setBlocksSnapshot: [durationBlock],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [{ weightKg: null, reps: null, durationSec: 45, distanceM: null }],
        },
      ],
      suggestions: [],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Last\s+45s/)).toBeVisible();
  });
});

describe("ExerciseCard — block stripe integration", () => {
  it("wraps each block in a BlockStripe", () => {
    const multiBlock = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    const { container } = render(
      <ExerciseCard
        sessionExercise={multiBlock}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    const stripes = container.querySelectorAll("[data-stripe]");
    expect(stripes.length).toBe(2);
  });

  it("renders block label chips", () => {
    const multiBlock = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={multiBlock}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    expect(screen.getByText("Top")).toBeVisible();
    expect(screen.getByText("Back-off")).toBeVisible();
  });
});

describe("ExerciseCard — combined history + suggestion", () => {
  it("renders last-time and suggestion on a single line when both exist", () => {
    const hist: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
            { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
            { weightKg: 100, reps: 7, durationSec: null, distanceM: null },
          ],
        },
      ],
      suggestions: [
        {
          blockIndex: 0,
          suggestedWeightKg: 105,
          isProgression: true,
          previousWeightKg: 100,
        },
      ],
    };
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={hist}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    const last = screen.getByText(/100kg x 8, 8, 7/);
    const suggestion = screen.getByText(/105kg/);
    expect(last).toBeVisible();
    expect(suggestion).toBeVisible();
    expect(last.parentElement).toBe(suggestion.parentElement);
  });
});

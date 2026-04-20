// web/tests/unit/features/workout/ExerciseCard.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";

afterEach(cleanup);

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
    performedWeightKg: 70,
    performedReps: 14,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("ExerciseCard — header", () => {
  it("renders the exercise name", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("Barbell Back Squat")).toBeVisible();
  });

  it("renders the consolidated target line for a single block", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("3 × 8–12")).toBeVisible();
  });

  it("joins multi-block target with ' · ' and lowercase tag suffix", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("3 × 8–12 · 1 × 12–16 top")).toBeVisible();
  });

  it("renders the progress chip N/M", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[makeLoggedSet({ setIndex: 0 }), makeLoggedSet({ id: "ls-2", setIndex: 1 })]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("2/3")).toBeVisible();
  });

  it("shows the unit toggle when onUnitToggle is provided and fires it", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
        onUnitToggle={spy}
      />,
    );
    await user.click(screen.getByRole("button", { name: /kg/i }));
    expect(spy).toHaveBeenCalledWith("lbs");
  });

  it("does not render the N/M chip for extra exercises (no prescribed blocks)", () => {
    const extraSe = makeSessionExercise({
      id: "se-extra",
      origin: "extra",
      setBlocksSnapshot: [],
    });
    const extraLogged = makeLoggedSet({
      id: "ls-extra-1",
      sessionExerciseId: "se-extra",
      origin: "extra",
      blockIndex: 0,
      setIndex: 0,
    });
    render(
      <ExerciseCard
        sessionExercise={extraSe}
        loggedSets={[extraLogged]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/of \d+ sets logged/i)).toBeNull();
    expect(screen.queryByText("0/0")).toBeNull();
    expect(screen.queryByText("1/0")).toBeNull();
  });

  it("still renders the chip for routine exercises with prescribed blocks", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("0/3")).toBeVisible();
  });
});

describe("ExerciseCard — set rows", () => {
  it("renders one row per prescribed set across blocks, with continuous numbering", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    // 4 SetRow buttons; accessible names follow SetRow's "Set {n}: empty, …" pattern.
    expect(screen.getByRole("button", { name: /^Set 1:/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Set 2:/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Set 3:/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Set 4:/ })).toBeVisible();
  });

  it("routes onSetTap with the block + set indices (not the display number)", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={spy}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Set 3:/ }));
    expect(spy).toHaveBeenCalledWith(1, 0); // block 1 (the top block), set 0 inside it
  });

  it("logged sets from a top-tagged block receive the TOP tag", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
      ],
    });
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[makeLoggedSet({ blockIndex: 0, setIndex: 0, performedWeightKg: 70, performedReps: 14 })]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/^TOP$/)).toBeVisible();
  });
});

describe("ExerciseCard — LAST strip", () => {
  it("renders 'LAST {set} · {set} · {set}' when historyData.lastTime has sets across blocks", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: 85, reps: 10, durationSec: null, distanceM: null },
            { weightKg: 85, reps: 9, durationSec: null, distanceM: null },
            { weightKg: 85, reps: 8, durationSec: null, distanceM: null },
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
      />,
    );
    expect(screen.getByText(/LAST 85×10 · 85×9 · 85×8/)).toBeVisible();
  });

  it("does not render LAST strip when historyData is undefined", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByText(/^LAST\s/)).toBeNull();
  });

  it("empty set rows surface per-block last hint as 'Tap to log · last {hint}'", () => {
    const se = makeSessionExercise();
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [{ weightKg: 85, reps: 9, durationSec: null, distanceM: null }],
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
      />,
    );
    expect(screen.getAllByText(/Tap to log · last 85×9/).length).toBeGreaterThan(0);
  });
});

describe("ExerciseCard — LAST strip / hint formatting", () => {
  it("renders fractional LAST weight without rounding (70.5, not 71)", () => {
    const se = makeSessionExercise();
    const historyData = {
      lastTime: [
        {
          sets: [
            { weightKg: 70.5, reps: 5, durationSec: null, distanceM: null },
          ],
        },
      ],
    } as unknown as ExerciseHistoryData;
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/LAST 70\.5×5/)).toBeVisible();
    expect(screen.queryByText(/LAST 71×5/)).toBeNull();
  });
});

describe("ExerciseCard — extras", () => {
  it("renders an add-row for extras with no blocks", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    const se = makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] });
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={spy}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Set 1:/ }));
    expect(spy).toHaveBeenCalledWith(0, 0);
  });

  it("extras pass the stored loggedSet.setIndex to onSetTap (not the render index)", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    const se = makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] });
    const loggedSets = [
      makeLoggedSet({ id: "ls-a", setIndex: 2, loggedAt: "2026-04-16T12:00:00Z" }),
      makeLoggedSet({ id: "ls-b", setIndex: 3, loggedAt: "2026-04-16T12:01:00Z" }),
    ];
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={loggedSets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={spy}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Set 1:/ }));
    expect(spy).toHaveBeenCalledWith(0, 2);
  });

  it("extras surface extra-history first-set hint on the add row", () => {
    const se = makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] });
    const extraHistory: ExtraExerciseHistory = {
      sessionDate: "2026-04-16T12:00:00Z",
      sets: [{ weightKg: 85, reps: 9, durationSec: null, distanceM: null }],
    };
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={extraHistory}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/Tap to log · last 85×9/)).toBeVisible();
  });
});

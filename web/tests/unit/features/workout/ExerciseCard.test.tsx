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
  it("renders 'LAST {set} · {set} · {set}' across blocks on multi-block exercises", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
      ],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Top",
          tag: "top",
          sets: [{ weightKg: 85, reps: 10, durationSec: null, distanceM: null }],
        },
        {
          blockIndex: 1,
          blockLabel: "Back-off",
          tag: null,
          sets: [
            { weightKg: 80, reps: 9, durationSec: null, distanceM: null },
            { weightKg: 80, reps: 8, durationSec: null, distanceM: null },
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
    expect(screen.getByText(/LAST 85×10 · 80×9 · 80×8/)).toBeVisible();
  });

  it("omits the LAST strip on single-block exercises (row hints already carry it)", () => {
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
          sets: [{ weightKg: 85, reps: 10, durationSec: null, distanceM: null }],
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
    expect(screen.queryByText(/^LAST\s/)).toBeNull();
    // The information still reaches the user through the per-row hints.
    expect(screen.getAllByText(/last 85×10/).length).toBeGreaterThan(0);
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
    // Multi-block: the LAST strip only renders when blocks.length > 1.
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 12, maxValue: 16, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
      ],
    });
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

/** Logged sets covering every prescribed slot of a block (default: block 0, 3 sets). */
function makeCompletedBlockSets(count = 3, blockIndex = 0): LoggedSet[] {
  return Array.from({ length: count }, (_, si) =>
    makeLoggedSet({ id: `ls-b${blockIndex}-s${si}`, blockIndex, setIndex: si }),
  );
}

describe("ExerciseCard — Add extra set (Sprint 4 D3b)", () => {
  it("renders the extra-set button once the block's prescribed sets are complete", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets()}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /add extra set/i });
    expect(buttons).toHaveLength(1); // single-block exercise
  });

  it("does NOT render the button for an extras-origin exercise (origin=extra has no blocks)", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] })}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={null}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add extra set/i })).toBeNull();
  });

  it("tapping the extra-set button renders an additional empty SetRow below the prescribed rows", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets()}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    // Block prescribes 3 sets → 3 SetRows initially.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: /add extra set/i }));
    // Now 4 SetRows (3 prescribed + 1 extra)
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(4);
  });

  it("rehydrates extras from loggedSets — a logged set at setIndex=block.count renders as the 4th SetRow without tapping", () => {
    const se = makeSessionExercise(); // block.count = 3
    const logged = [makeLoggedSet({ id: "ls-extra", blockIndex: 0, setIndex: 3 })]; // setIndex=3 → overrun=1
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={logged}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    // Should render 4 SetRows (3 prescribed + 1 logged extra) without any tap.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(4);
  });

  it("clicking an extra row calls onSetTap with (blockIndex=0, setIndex=block.count)", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets()}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />,
    );
    await user.click(screen.getByRole("button", { name: /add extra set/i }));
    // The new 4th set row: blockIndex=0, setIndex=3 (block.count=3).
    await user.click(screen.getByRole("button", { name: /^Set 4/ }));
    expect(onSetTap).toHaveBeenCalledWith(0, 3);
  });

  it("tapping the extra-set button twice adds two extras (counter is per-block, additive)", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets()}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /add extra set/i });
    await user.click(button);
    await user.click(button);
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(5);
  });

  it("two-block exercise gets two independent extra-set buttons with disambiguating aria-labels", () => {
    const blockA: SetBlock = { targetKind: "reps", minValue: 6, maxValue: 8, count: 2, tag: "top" };
    const blockB: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise({ setBlocksSnapshot: [blockA, blockB] })}
        loggedSets={[
          ...makeCompletedBlockSets(2, 0),
          ...makeCompletedBlockSets(3, 1),
        ]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /add extra set/i })).toHaveLength(2);
    // Per-block aria-labels disambiguate the two buttons for screen readers.
    expect(screen.getByRole("button", { name: "Add extra set to set block 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add extra set to set block 2" })).toBeInTheDocument();
  });

  it("single-block exercise uses the unscoped aria-label (no disambiguation needed)", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets()}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add extra set" })).toBeInTheDocument();
  });

  it("progress badge counts only prescribed-slot completion (extras don't push past denominator)", () => {
    // 3-prescribed block, all 3 prescribed slots logged + 1 extra at setIndex=3.
    const se = makeSessionExercise();
    const sets = [
      makeLoggedSet({ id: "l0", setIndex: 0 }),
      makeLoggedSet({ id: "l1", setIndex: 1 }),
      makeLoggedSet({ id: "l2", setIndex: 2 }),
      makeLoggedSet({ id: "l3", setIndex: 3 }), // extra
    ];
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={sets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    // Badge label should read "3/3", not "4/3".
    expect(screen.getByLabelText("3 of 3 sets logged")).toBeInTheDocument();
  });

  it("extra rows inside a top-tagged block do NOT carry the TOP badge", () => {
    const topBlock: SetBlock = { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" };
    const se = makeSessionExercise({ setBlocksSnapshot: [topBlock] });
    const sets = [
      makeLoggedSet({ id: "l0", setIndex: 0, tag: "top" }), // prescribed top set, logged
      makeLoggedSet({ id: "l1", setIndex: 1, tag: null }),  // extra, not top
    ];
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={sets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    // The prescribed (Set 1) row should show TOP. The extra (Set 2) row should not.
    const setRows = screen.getAllByRole("button", { name: /^Set \d+/ });
    expect(setRows).toHaveLength(2);
    // Set 1 carries TOP somewhere in its descendants.
    const topMarkers = screen.getAllByText("TOP");
    expect(topMarkers).toHaveLength(1); // only one TOP across both rows
  });
});

describe("ExerciseCard — contextual extra-set visibility (Sprint 2 delta 3)", () => {
  it("hides the extra-set control on an untouched incomplete block", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add extra set/i })).toBeNull();
  });

  it("hides the control while the block is only partially complete", () => {
    // 3 prescribed, only 2 logged.
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets(2)}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add extra set/i })).toBeNull();
  });

  it("shows the control when every prescribed slot in the block is logged", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets(3)}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add extra set" })).toBeVisible();
  });

  it("uses the quieter visible copy 'Extra set' (aria-label unchanged)", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={makeCompletedBlockSets(3)}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    const control = screen.getByRole("button", { name: "Add extra set" });
    expect(control).toHaveTextContent(/^Extra set$/);
    expect(screen.queryByText("+ Add extra set")).toBeNull();
  });

  it("shows the control when persisted extra rows exist even if prescribed slots are incomplete", () => {
    // Only an overrun set at setIndex=3 (block.count=3) — prescribed slots empty.
    const logged = [makeLoggedSet({ id: "ls-extra", blockIndex: 0, setIndex: 3 })];
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={logged}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add extra set" })).toBeVisible();
  });

  it("keeps the control visible after a local tap even if the block later becomes incomplete", async () => {
    const user = userEvent.setup();
    const complete = makeCompletedBlockSets(3);
    const { rerender } = render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={complete}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add extra set" }));
    // A prescribed set gets deleted → block no longer complete, but the
    // pending extra tap keeps the control (and the extra row) visible.
    rerender(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={complete.slice(0, 2)}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add extra set" })).toBeVisible();
    // 3 prescribed rows + 1 pending extra row still render.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(4);
  });

  it("multi-block: only the complete block shows its control", () => {
    const blockA: SetBlock = { targetKind: "reps", minValue: 6, maxValue: 8, count: 2, tag: "top" };
    const blockB: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise({ setBlocksSnapshot: [blockA, blockB] })}
        loggedSets={makeCompletedBlockSets(2, 0)} // block 0 complete, block 1 untouched
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /add extra set/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add extra set to set block 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add extra set to set block 2" })).toBeNull();
  });

  it("extra rows still never count toward routine progress (badge stays 3/3)", () => {
    const sets = [...makeCompletedBlockSets(3), makeLoggedSet({ id: "l-extra", setIndex: 3 })];
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={sets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("3 of 3 sets logged")).toBeInTheDocument();
  });

  it("extra-origin exercise behavior is unchanged: no control, next empty row still renders", () => {
    const se = makeSessionExercise({ id: "se-extra", origin: "extra", setBlocksSnapshot: [] });
    const logged = [
      makeLoggedSet({ id: "ls-x", sessionExerciseId: "se-extra", origin: "extra", setIndex: 0 }),
    ];
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={logged}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add extra set/i })).toBeNull();
    expect(screen.queryByText(/extra set/i)).toBeNull();
    // Logged row + next empty add-row.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(2);
  });
});

describe("ExerciseCard — primed quick-log row (guided logging)", () => {
  const progressionSuggestion = {
    blockIndex: 0,
    suggestedWeightKg: 52.5,
    isProgression: true,
    previousWeightKg: 50,
  };
  const squatLastTime: ExerciseHistoryData = {
    lastTime: [
      {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [
          { weightKg: 50, reps: 12, durationSec: null, distanceM: null },
          { weightKg: 50, reps: 12, durationSec: null, distanceM: null },
          { weightKg: 50, reps: 12, durationSec: null, distanceM: null },
        ],
      },
    ],
    suggestions: [progressionSuggestion],
  };

  it("primes the first empty prescribed slot and one tap logs the target", async () => {
    const user = userEvent.setup();
    const onQuickLog = vi.fn().mockResolvedValue(undefined);
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={squatLastTime}
        extraHistory={undefined}
        onSetTap={() => {}}
        onQuickLog={onQuickLog}
      />,
    );
    // Progression: suggested weight, range-floor reps.
    const primed = screen.getByRole("button", { name: "Set 1: log 52.5 kg × 8" });
    expect(primed).toBeVisible();
    await user.click(primed);
    expect(onQuickLog).toHaveBeenCalledWith(0, 0, {
      performedWeightKg: 52.5,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });
  });

  it("exactly one row is primed; later empty rows keep tap-to-log → sheet", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={squatLastTime}
        extraHistory={undefined}
        onSetTap={onSetTap}
        onQuickLog={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getAllByRole("button", { name: /: log / })).toHaveLength(1);
    const laterRow = screen.getByRole("button", { name: /^Set 2: empty/ });
    await user.click(laterRow);
    expect(onSetTap).toHaveBeenCalledWith(0, 1);
  });

  it("the ✎ affordance opens the sheet instead of logging", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();
    const onQuickLog = vi.fn().mockResolvedValue(undefined);
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={squatLastTime}
        extraHistory={undefined}
        onSetTap={onSetTap}
        onQuickLog={onQuickLog}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Set 1: adjust before logging/ }));
    expect(onSetTap).toHaveBeenCalledWith(0, 0);
    expect(onQuickLog).not.toHaveBeenCalled();
  });

  it("does not prime anything on day one; empty rows hint the prescription", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={{ lastTime: [], suggestions: [] }}
        extraHistory={undefined}
        onSetTap={() => {}}
        onQuickLog={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.queryByRole("button", { name: /: log / })).toBeNull();
    expect(screen.getAllByText(/Tap to log · last 8–12 reps/).length).toBe(3);
  });

  it("never primes extra-origin exercises (invariant 7)", () => {
    const extraSe = makeSessionExercise({
      id: "se-extra",
      origin: "extra",
      setBlocksSnapshot: [],
    });
    render(
      <ExerciseCard
        sessionExercise={extraSe}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={{ sets: [{ weightKg: 20, reps: 12, durationSec: null, distanceM: null }], sessionDate: "2026-07-01T10:00:00.000Z" }}
        onSetTap={() => {}}
        onQuickLog={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.queryByRole("button", { name: /: log / })).toBeNull();
  });

  it("in-session carryover reprimes the next slot without the progression tone", () => {
    // Set 1 was logged at 47.5 (a deviation below the 52.5 suggestion): the
    // next primed row must offer 47.5 and drop the ↑ claim.
    const deviated = makeLoggedSet({
      id: "ls-dev",
      setIndex: 0,
      performedWeightKg: 47.5,
      performedReps: 8,
    });
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[deviated]}
        units="kg"
        historyData={squatLastTime}
        extraHistory={undefined}
        onSetTap={() => {}}
        onQuickLog={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const primed = screen.getByRole("button", { name: "Set 2: log 47.5 kg × 8" });
    expect(primed).toBeVisible();
    expect(primed.textContent).not.toContain("↑");
  });

  it("no primed rows at all without onQuickLog (history view)", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={squatLastTime}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /: log / })).toBeNull();
  });
});

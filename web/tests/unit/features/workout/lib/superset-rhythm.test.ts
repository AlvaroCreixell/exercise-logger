// web/tests/unit/features/workout/lib/superset-rhythm.test.ts
import { describe, it, expect } from "vitest";
import {
  flattenPrescribedSlots,
  getSlotOrdinal,
  isRoundComplete,
  buildSupersetRail,
} from "@/features/workout/lib/superset-rhythm";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";

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
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
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
    blockSignature: "reps:8-12:count3:tagnormal",
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

describe("flattenPrescribedSlots", () => {
  it("flattens a single block into 1-based ordinals", () => {
    const se = makeSessionExercise(); // one block, count 3
    expect(flattenPrescribedSlots(se)).toEqual([
      { ordinal: 1, blockIndex: 0, setIndex: 0 },
      { ordinal: 2, blockIndex: 0, setIndex: 1 },
      { ordinal: 3, blockIndex: 0, setIndex: 2 },
    ]);
  });

  it("flattens multi-block exercises block by block, setIndex resetting per block", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", exactValue: 15, count: 2, tag: "top" } as SetBlock,
      ],
    });
    expect(flattenPrescribedSlots(se)).toEqual([
      { ordinal: 1, blockIndex: 0, setIndex: 0 },
      { ordinal: 2, blockIndex: 0, setIndex: 1 },
      { ordinal: 3, blockIndex: 1, setIndex: 0 },
      { ordinal: 4, blockIndex: 1, setIndex: 1 },
    ]);
  });

  it("returns an empty array for extra-origin exercises with no blocks", () => {
    const se = makeSessionExercise({ setBlocksSnapshot: [], origin: "extra" });
    expect(flattenPrescribedSlots(se)).toEqual([]);
  });
});

describe("getSlotOrdinal", () => {
  it("matches the flattened ordinal for prescribed slots", () => {
    const se = makeSessionExercise(); // one block, count 3
    expect(getSlotOrdinal(se, 0, 0)).toBe(1);
    expect(getSlotOrdinal(se, 0, 2)).toBe(3);
  });

  it("computes ordinals across multiple blocks (never raw setIndex)", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", exactValue: 15, count: 1 } as SetBlock,
      ],
    });
    // Block 1 setIndex 0 is the THIRD slot overall, not the first.
    expect(getSlotOrdinal(se, 1, 0)).toBe(3);
  });

  it("continues ordinals past prescribed for overrun extra sets", () => {
    const se = makeSessionExercise(); // one block, count 3
    expect(getSlotOrdinal(se, 0, 3)).toBe(4); // first overrun
    expect(getSlotOrdinal(se, 0, 4)).toBe(5); // second overrun
  });

  it("places multi-block overruns after ALL prescribed slots", () => {
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", exactValue: 15, count: 1 } as SetBlock,
      ],
    });
    // 3 prescribed total; overrun of block 1 (setIndex 1) is ordinal 4.
    expect(getSlotOrdinal(se, 1, 1)).toBe(4);
  });

  it("handles blockless (extra-origin) exercises gracefully", () => {
    const se = makeSessionExercise({ setBlocksSnapshot: [], origin: "extra" });
    expect(getSlotOrdinal(se, 0, 0)).toBe(1);
    expect(getSlotOrdinal(se, 0, 2)).toBe(3);
  });
});

describe("isRoundComplete", () => {
  const a = makeSessionExercise({ id: "se-a" });
  const b = makeSessionExercise({ id: "se-b", supersetPosition: 1 });

  it("returns false when no sets are logged", () => {
    expect(
      isRoundComplete({
        exercises: [a, b],
        setsByExercise: new Map(),
        ordinal: 1,
      }),
    ).toBe(false);
  });

  it("returns false when only exercise A has logged the ordinal", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ sessionExerciseId: "se-a", setIndex: 0 })]],
    ]);
    expect(isRoundComplete({ exercises: [a, b], setsByExercise, ordinal: 1 })).toBe(false);
  });

  it("returns true when both exercises have logged the ordinal", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ id: "ls-a", sessionExerciseId: "se-a", setIndex: 0 })]],
      ["se-b", [makeLoggedSet({ id: "ls-b", sessionExerciseId: "se-b", setIndex: 0 })]],
    ]);
    expect(isRoundComplete({ exercises: [a, b], setsByExercise, ordinal: 1 })).toBe(true);
  });

  it("matches by flattened ordinal across mismatched block structures", () => {
    // A: two blocks (2 + 1). Its third slot is blockIndex 1, setIndex 0.
    const multiA = makeSessionExercise({
      id: "se-a",
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", exactValue: 15, count: 1 } as SetBlock,
      ],
    });
    // B: one block of 3. Its third slot is blockIndex 0, setIndex 2.
    const singleB = makeSessionExercise({ id: "se-b", supersetPosition: 1 });
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ id: "ls-a", sessionExerciseId: "se-a", blockIndex: 1, setIndex: 0 })]],
      ["se-b", [makeLoggedSet({ id: "ls-b", sessionExerciseId: "se-b", blockIndex: 0, setIndex: 2 })]],
    ]);
    // Round 3 is complete even though raw [blockIndex, setIndex] differ.
    expect(
      isRoundComplete({ exercises: [multiA, singleB], setsByExercise, ordinal: 3 }),
    ).toBe(true);
    // Round 1 is NOT complete — neither logged ordinal 1.
    expect(
      isRoundComplete({ exercises: [multiA, singleB], setsByExercise, ordinal: 1 }),
    ).toBe(false);
  });

  it("supports overrun ordinals", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ id: "ls-a", sessionExerciseId: "se-a", setIndex: 3 })]],
      ["se-b", [makeLoggedSet({ id: "ls-b", sessionExerciseId: "se-b", setIndex: 3 })]],
    ]);
    expect(isRoundComplete({ exercises: [a, b], setsByExercise, ordinal: 4 })).toBe(true);
  });
});

describe("buildSupersetRail", () => {
  const twoSetBlock = [
    { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
  ];
  const a = makeSessionExercise({ id: "se-a", setBlocksSnapshot: twoSetBlock });
  const b = makeSessionExercise({
    id: "se-b",
    supersetPosition: 1,
    setBlocksSnapshot: twoSetBlock,
  });

  it("interleaves A1,B1,A2,B2 for two 2-set exercises", () => {
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise: new Map() });
    expect(rail.map((i) => i.label)).toEqual(["A1", "B1", "A2", "B2"]);
    expect(rail.map((i) => i.side)).toEqual(["A", "B", "A", "B"]);
    expect(rail.map((i) => i.ordinal)).toEqual([1, 1, 2, 2]);
    // Keys are unique.
    expect(new Set(rail.map((i) => i.key)).size).toBe(4);
  });

  it("marks A1 current and everything else upcoming with no logged sets", () => {
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise: new Map() });
    expect(rail.map((i) => i.status)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
  });

  it("marks A1 complete and B1 current after logging A1 only", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ sessionExerciseId: "se-a", setIndex: 0 })]],
    ]);
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise });
    expect(rail.map((i) => i.status)).toEqual(["complete", "current", "upcoming", "upcoming"]);
  });

  it("marks A1+B1 complete and A2 current after logging both", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ id: "ls-a", sessionExerciseId: "se-a", setIndex: 0 })]],
      ["se-b", [makeLoggedSet({ id: "ls-b", sessionExerciseId: "se-b", setIndex: 0 })]],
    ]);
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise });
    expect(rail.map((i) => i.status)).toEqual(["complete", "complete", "current", "upcoming"]);
  });

  it("marks a skipped-ahead slot complete without moving current past earlier gaps", () => {
    // User logged A2 but not A1: the first incomplete slot (A1) is still current.
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ sessionExerciseId: "se-a", setIndex: 1 })]],
    ]);
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise });
    expect(rail.map((i) => i.status)).toEqual(["current", "upcoming", "complete", "upcoming"]);
  });

  it("covers max(prescribed A, prescribed B) for mismatched structures", () => {
    const threeSetA = makeSessionExercise({
      id: "se-a",
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
    const rail = buildSupersetRail({
      exercises: [threeSetA, b], // A has 3 prescribed, B has 2
      setsByExercise: new Map(),
    });
    expect(rail.map((i) => i.label)).toEqual(["A1", "B1", "A2", "B2", "A3", "B3"]);
  });

  it("flattens multi-block prescriptions into rounds", () => {
    const multiA = makeSessionExercise({
      id: "se-a",
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 2 } as SetBlock,
        { targetKind: "reps", exactValue: 15, count: 1 } as SetBlock,
      ],
    });
    // A logged its block-1 slot (ordinal 3); B logged its plain third set.
    const setsByExercise = new Map<string, LoggedSet[]>([
      ["se-a", [makeLoggedSet({ id: "ls-a", sessionExerciseId: "se-a", blockIndex: 1, setIndex: 0 })]],
      ["se-b", [makeLoggedSet({ id: "ls-b", sessionExerciseId: "se-b", blockIndex: 0, setIndex: 2 })]],
    ]);
    const threeSetB = makeSessionExercise({ id: "se-b", supersetPosition: 1 });
    const rail = buildSupersetRail({ exercises: [multiA, threeSetB], setsByExercise });
    expect(rail.map((i) => i.label)).toEqual(["A1", "B1", "A2", "B2", "A3", "B3"]);
    const a3 = rail.find((i) => i.label === "A3");
    const b3 = rail.find((i) => i.label === "B3");
    expect(a3?.status).toBe("complete");
    expect(b3?.status).toBe("complete");
  });

  it("extends the rail with logged overrun rounds", () => {
    // Both prescribed 2; A logged an overrun 3rd set (setIndex 2 = ordinal 3).
    const setsByExercise = new Map<string, LoggedSet[]>([
      [
        "se-a",
        [
          makeLoggedSet({ id: "ls-1", sessionExerciseId: "se-a", setIndex: 0 }),
          makeLoggedSet({ id: "ls-2", sessionExerciseId: "se-a", setIndex: 1 }),
          makeLoggedSet({ id: "ls-3", sessionExerciseId: "se-a", setIndex: 2 }),
        ],
      ],
      [
        "se-b",
        [
          makeLoggedSet({ id: "ls-4", sessionExerciseId: "se-b", setIndex: 0 }),
          makeLoggedSet({ id: "ls-5", sessionExerciseId: "se-b", setIndex: 1 }),
        ],
      ],
    ]);
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise });
    expect(rail.map((i) => i.label)).toEqual(["A1", "B1", "A2", "B2", "A3", "B3"]);
    expect(rail.find((i) => i.label === "A3")?.status).toBe("complete");
    // B3 is the first incomplete slot in sequence.
    expect(rail.find((i) => i.label === "B3")?.status).toBe("current");
  });

  it("has no current item when every slot is complete", () => {
    const setsByExercise = new Map<string, LoggedSet[]>([
      [
        "se-a",
        [
          makeLoggedSet({ id: "ls-1", sessionExerciseId: "se-a", setIndex: 0 }),
          makeLoggedSet({ id: "ls-2", sessionExerciseId: "se-a", setIndex: 1 }),
        ],
      ],
      [
        "se-b",
        [
          makeLoggedSet({ id: "ls-3", sessionExerciseId: "se-b", setIndex: 0 }),
          makeLoggedSet({ id: "ls-4", sessionExerciseId: "se-b", setIndex: 1 }),
        ],
      ],
    ]);
    const rail = buildSupersetRail({ exercises: [a, b], setsByExercise });
    expect(rail.every((i) => i.status === "complete")).toBe(true);
  });

  it("returns an empty rail when both exercises have no prescribed or logged sets", () => {
    const emptyA = makeSessionExercise({ id: "se-a", setBlocksSnapshot: [] });
    const emptyB = makeSessionExercise({ id: "se-b", supersetPosition: 1, setBlocksSnapshot: [] });
    const rail = buildSupersetRail({
      exercises: [emptyA, emptyB],
      setsByExercise: new Map(),
    });
    expect(rail).toEqual([]);
  });
});

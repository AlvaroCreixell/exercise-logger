import { describe, it, expect } from "vitest";
import {
  resolveQuickTarget,
  resolvePrimedSlot,
  formatQuickTarget,
  formatBlockTargetHint,
} from "@/features/workout/lib/quick-target";
import type { LoggedSet, SetBlock } from "@/domain/types";
import type {
  BlockSuggestion,
  BlockLastTime,
} from "@/services/progression-service";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<SetBlock> = {}): SetBlock {
  return { targetKind: "reps", minValue: 8, maxValue: 12, count: 3, ...overrides };
}

function makeSuggestion(overrides: Partial<BlockSuggestion> = {}): BlockSuggestion {
  return {
    blockIndex: 0,
    suggestedWeightKg: 52.5,
    isProgression: true,
    previousWeightKg: 50,
    ...overrides,
  };
}

function makeLastTime(
  sets: Array<{ weightKg?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null }>,
  overrides: Partial<BlockLastTime> = {},
): BlockLastTime {
  return {
    blockIndex: 0,
    blockLabel: "",
    tag: null,
    sets: sets.map((s) => ({
      weightKg: s.weightKg ?? null,
      reps: s.reps ?? null,
      durationSec: s.durationSec ?? null,
      distanceM: s.distanceM ?? null,
    })),
    ...overrides,
  };
}

let setSeq = 0;
function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  setSeq += 1;
  return {
    id: `set-${setSeq}`,
    sessionId: "session-1",
    sessionExerciseId: "se-1",
    exerciseId: "barbell-back-squat",
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
    loggedAt: "2026-07-06T10:00:00.000Z",
    updatedAt: "2026-07-06T10:00:00.000Z",
    ...overrides,
  };
}

const base = {
  block: makeBlock(),
  setIndex: 0,
  suggestion: undefined as BlockSuggestion | undefined,
  lastTime: undefined as BlockLastTime | undefined,
  blockSetsInSession: [] as LoggedSet[],
  effectiveType: "weight" as const,
};

// ---------------------------------------------------------------------------
// resolveQuickTarget — weight × reps blocks
// ---------------------------------------------------------------------------

describe("resolveQuickTarget: weight × reps", () => {
  it("uses the suggestion weight and range floor reps on a progression", () => {
    const target = resolveQuickTarget({
      ...base,
      suggestion: makeSuggestion({ suggestedWeightKg: 52.5, isProgression: true }),
      lastTime: makeLastTime([{ weightKg: 50, reps: 12 }]),
    });
    expect(target).toEqual({
      performedWeightKg: 52.5,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });
  });

  it("uses last time's per-set reps on a repeat (no progression)", () => {
    const target = resolveQuickTarget({
      ...base,
      setIndex: 1,
      suggestion: makeSuggestion({ suggestedWeightKg: 50, isProgression: false }),
      lastTime: makeLastTime([
        { weightKg: 50, reps: 12 },
        { weightKg: 50, reps: 10 },
      ]),
    });
    expect(target?.performedWeightKg).toBe(50);
    expect(target?.performedReps).toBe(10);
  });

  it("falls back to the range floor when the repeat set index has no history", () => {
    const target = resolveQuickTarget({
      ...base,
      setIndex: 2,
      suggestion: makeSuggestion({ isProgression: false, suggestedWeightKg: 50 }),
      lastTime: makeLastTime([{ weightKg: 50, reps: 12 }]),
    });
    expect(target?.performedReps).toBe(8);
  });

  it("uses the exact value for exact-rep blocks", () => {
    const target = resolveQuickTarget({
      ...base,
      block: makeBlock({ minValue: undefined, maxValue: undefined, exactValue: 8 }),
      suggestion: makeSuggestion({ isProgression: false, suggestedWeightKg: 40 }),
      lastTime: makeLastTime([{ weightKg: 40, reps: 8 }]),
    });
    expect(target?.performedReps).toBe(8);
  });

  it("in-session carryover weight outranks the suggestion", () => {
    const target = resolveQuickTarget({
      ...base,
      suggestion: makeSuggestion({ suggestedWeightKg: 52.5, isProgression: true }),
      lastTime: makeLastTime([{ weightKg: 50, reps: 12 }]),
      blockSetsInSession: [
        makeLoggedSet({ performedWeightKg: 50, updatedAt: "2026-07-06T10:01:00.000Z" }),
        makeLoggedSet({ performedWeightKg: 47.5, updatedAt: "2026-07-06T10:05:00.000Z" }),
      ],
    });
    // latest updatedAt wins (mid-block weight change: 47.5 carries forward)
    expect(target?.performedWeightKg).toBe(47.5);
  });

  it("returns null when there is no weight source (day one)", () => {
    expect(resolveQuickTarget({ ...base })).toBeNull();
  });

  it("carryover alone completes the target on day one", () => {
    const target = resolveQuickTarget({
      ...base,
      blockSetsInSession: [makeLoggedSet({ performedWeightKg: 60 })],
    });
    expect(target?.performedWeightKg).toBe(60);
    expect(target?.performedReps).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// resolveQuickTarget — non-weight blocks
// ---------------------------------------------------------------------------

describe("resolveQuickTarget: reps-only / duration / distance", () => {
  it("reps-only uses last time's per-set reps and never a weight", () => {
    const target = resolveQuickTarget({
      ...base,
      effectiveType: "bodyweight",
      lastTime: makeLastTime([{ reps: 11 }]),
    });
    expect(target).toEqual({
      performedWeightKg: null,
      performedReps: 11,
      performedDurationSec: null,
      performedDistanceM: null,
    });
  });

  it("reps-only returns null with no history (day one never invents numbers)", () => {
    expect(
      resolveQuickTarget({ ...base, effectiveType: "bodyweight" }),
    ).toBeNull();
  });

  it("duration uses last time's per-set duration, falling back to the floor", () => {
    const block = makeBlock({ targetKind: "duration", minValue: 30, maxValue: 60 });
    const withHistory = resolveQuickTarget({
      ...base,
      block,
      effectiveType: "isometric",
      lastTime: makeLastTime([{ durationSec: 45 }]),
    });
    expect(withHistory?.performedDurationSec).toBe(45);

    const missingIndex = resolveQuickTarget({
      ...base,
      block,
      setIndex: 1,
      effectiveType: "isometric",
      lastTime: makeLastTime([{ durationSec: 45 }]),
    });
    expect(missingIndex?.performedDurationSec).toBe(30);
  });

  it("duration returns null with no history", () => {
    const block = makeBlock({ targetKind: "duration", minValue: 30, maxValue: 60 });
    expect(
      resolveQuickTarget({ ...base, block, effectiveType: "isometric" }),
    ).toBeNull();
  });

  it("distance uses last time's per-set distance", () => {
    const block = makeBlock({
      targetKind: "distance",
      minValue: undefined,
      maxValue: undefined,
      exactValue: 2000,
    });
    const target = resolveQuickTarget({
      ...base,
      block,
      effectiveType: "cardio",
      lastTime: makeLastTime([{ distanceM: 2200 }]),
    });
    expect(target?.performedDistanceM).toBe(2200);
    expect(target?.performedWeightKg).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolvePrimedSlot
// ---------------------------------------------------------------------------

describe("resolvePrimedSlot", () => {
  const blocks = [makeBlock({ count: 1, tag: "top" }), makeBlock({ count: 3 })];

  it("returns the first empty prescribed slot across blocks", () => {
    expect(resolvePrimedSlot(blocks, [])).toEqual({ blockIndex: 0, setIndex: 0 });
    expect(
      resolvePrimedSlot(blocks, [makeLoggedSet({ blockIndex: 0, setIndex: 0 })]),
    ).toEqual({ blockIndex: 1, setIndex: 0 });
    expect(
      resolvePrimedSlot(blocks, [
        makeLoggedSet({ blockIndex: 0, setIndex: 0 }),
        makeLoggedSet({ blockIndex: 1, setIndex: 0 }),
        makeLoggedSet({ blockIndex: 1, setIndex: 1 }),
      ]),
    ).toEqual({ blockIndex: 1, setIndex: 2 });
  });

  it("returns null when every prescribed slot is logged", () => {
    const logged = [
      makeLoggedSet({ blockIndex: 0, setIndex: 0 }),
      makeLoggedSet({ blockIndex: 1, setIndex: 0 }),
      makeLoggedSet({ blockIndex: 1, setIndex: 1 }),
      makeLoggedSet({ blockIndex: 1, setIndex: 2 }),
    ];
    expect(resolvePrimedSlot(blocks, logged)).toBeNull();
  });

  it("ignores extra-set overruns beyond the prescribed count", () => {
    // Slot [1,1] is empty even though an overrun [1,3] exists.
    const logged = [
      makeLoggedSet({ blockIndex: 0, setIndex: 0 }),
      makeLoggedSet({ blockIndex: 1, setIndex: 0 }),
      makeLoggedSet({ blockIndex: 1, setIndex: 3 }),
    ];
    expect(resolvePrimedSlot(blocks, logged)).toEqual({ blockIndex: 1, setIndex: 1 });
  });

  it("returns null for empty block lists (extras)", () => {
    expect(resolvePrimedSlot([], [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatQuickTarget / formatBlockTargetHint
// ---------------------------------------------------------------------------

describe("formatQuickTarget", () => {
  it("formats weight × reps in display units", () => {
    const t = {
      performedWeightKg: 52.5,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    };
    expect(formatQuickTarget(t, "kg")).toBe("52.5 kg × 8");
    expect(formatQuickTarget(t, "lbs")).toBe("115.74 lbs × 8");
  });

  it("formats reps-only, duration, and distance", () => {
    expect(
      formatQuickTarget(
        { performedWeightKg: null, performedReps: 12, performedDurationSec: null, performedDistanceM: null },
        "kg",
      ),
    ).toBe("12 reps");
    expect(
      formatQuickTarget(
        { performedWeightKg: null, performedReps: null, performedDurationSec: 45, performedDistanceM: null },
        "kg",
      ),
    ).toBe("45s");
    expect(
      formatQuickTarget(
        { performedWeightKg: null, performedReps: null, performedDurationSec: 120, performedDistanceM: null },
        "kg",
      ),
    ).toBe("2min");
    expect(
      formatQuickTarget(
        { performedWeightKg: null, performedReps: null, performedDurationSec: null, performedDistanceM: 2000 },
        "kg",
      ),
    ).toBe("2000m");
  });
});

describe("formatBlockTargetHint", () => {
  it("renders per-set prescriptions", () => {
    expect(formatBlockTargetHint(makeBlock())).toBe("8–12 reps");
    expect(
      formatBlockTargetHint(makeBlock({ minValue: undefined, maxValue: undefined, exactValue: 8 })),
    ).toBe("8 reps");
    expect(
      formatBlockTargetHint(makeBlock({ targetKind: "duration", minValue: 30, maxValue: 60 })),
    ).toBe("30–60s");
    expect(
      formatBlockTargetHint(
        makeBlock({ targetKind: "distance", minValue: undefined, maxValue: undefined, exactValue: 2000 }),
      ),
    ).toBe("2000m");
  });
});

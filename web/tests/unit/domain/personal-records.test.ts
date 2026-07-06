import { describe, it, expect } from "vitest";
import {
  computePersonalBests,
  isNewPersonalBest,
  type SetInputShape,
} from "@/domain/personal-records";
import type { LoggedSet } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  idCounter += 1;
  return {
    id: `ls-${idCounter}`,
    sessionId: "s-1",
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
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

function makeInput(overrides: Partial<SetInputShape> = {}): SetInputShape {
  return {
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computePersonalBests
// ---------------------------------------------------------------------------

describe("computePersonalBests", () => {
  it("returns all-null bests for an empty history", () => {
    const bests = computePersonalBests([]);
    expect(bests.bestWeightKgAtReps(10)).toBeNull();
    expect(bests.maxReps).toBeNull();
    expect(bests.maxDurationSec).toBeNull();
    expect(bests.maxDistanceM).toBeNull();
  });

  describe("bestWeightKgAtReps", () => {
    it("returns the max weight among prior weight+reps sets with reps >= the queried reps", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 100, performedReps: 10 }),
        makeLoggedSet({ performedWeightKg: 80, performedReps: 12 }),
        makeLoggedSet({ performedWeightKg: 110, performedReps: 5 }),
      ]);
      // reps >= 10 → 100kg×10 and 80kg×12 qualify; 110kg×5 does not.
      expect(bests.bestWeightKgAtReps(10)).toBe(100);
      // reps >= 12 → only 80kg×12.
      expect(bests.bestWeightKgAtReps(12)).toBe(80);
      // reps >= 5 → all three qualify; max weight is 110.
      expect(bests.bestWeightKgAtReps(5)).toBe(110);
    });

    it("returns null when no prior set has enough reps", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 100, performedReps: 10 }),
      ]);
      expect(bests.bestWeightKgAtReps(11)).toBeNull();
    });

    it("ignores reps-only and cardio sets", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedReps: 20 }), // reps-only
        makeLoggedSet({ performedDurationSec: 600, performedDistanceM: 2000 }), // cardio
      ]);
      expect(bests.bestWeightKgAtReps(5)).toBeNull();
    });

    it("includes 0kg weight+reps sets (bodyweight logged as 0 on a weight-type exercise)", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 0, performedReps: 10 }),
      ]);
      expect(bests.bestWeightKgAtReps(10)).toBe(0);
    });
  });

  describe("maxReps", () => {
    it("is the max reps among reps-only sets", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedReps: 12 }),
        makeLoggedSet({ performedReps: 15 }),
        makeLoggedSet({ performedReps: 8 }),
      ]);
      expect(bests.maxReps).toBe(15);
    });

    it("ignores weight+reps sets (weighted reps don't set the reps-only record)", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 100, performedReps: 30 }),
        makeLoggedSet({ performedReps: 12 }),
      ]);
      expect(bests.maxReps).toBe(12);
    });

    it("is null when no reps-only sets exist", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 100, performedReps: 10 }),
      ]);
      expect(bests.maxReps).toBeNull();
    });
  });

  describe("maxDurationSec", () => {
    it("is the max duration among duration-only sets", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedDurationSec: 45 }),
        makeLoggedSet({ performedDurationSec: 60 }),
      ]);
      expect(bests.maxDurationSec).toBe(60);
    });

    it("ignores cardio sets (duration+distance together)", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedDurationSec: 1800, performedDistanceM: 5000 }),
        makeLoggedSet({ performedDurationSec: 60 }),
      ]);
      expect(bests.maxDurationSec).toBe(60);
    });

    it("is null when no duration-only sets exist", () => {
      expect(computePersonalBests([]).maxDurationSec).toBeNull();
    });
  });

  describe("maxDistanceM", () => {
    it("is the max distance among distance-only sets", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedDistanceM: 400 }),
        makeLoggedSet({ performedDistanceM: 800 }),
      ]);
      expect(bests.maxDistanceM).toBe(800);
    });

    it("ignores cardio sets (duration+distance together)", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedDurationSec: 1800, performedDistanceM: 5000 }),
      ]);
      expect(bests.maxDistanceM).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// isNewPersonalBest
// ---------------------------------------------------------------------------

describe("isNewPersonalBest", () => {
  describe("weight+reps", () => {
    const bests = computePersonalBests([
      makeLoggedSet({ performedWeightKg: 100, performedReps: 10 }),
      makeLoggedSet({ performedWeightKg: 80, performedReps: 12 }),
    ]);

    it("is a PR when weight beats the best at the input rep count", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 102.5, performedReps: 10 }), bests)
      ).toBe(true);
    });

    it("is NOT a PR when weight equals the best at the same reps (boundary)", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 100, performedReps: 10 }), bests)
      ).toBe(false);
    });

    it("is NOT a PR when weight is below the best at the input rep count", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 95, performedReps: 10 }), bests)
      ).toBe(false);
    });

    it("IS a PR at a higher rep count where the best is lower, even if a heavier lower-rep set exists", () => {
      // best at 12 reps is 80kg (the 100kg set was only 10 reps) → 90×12 is a PR.
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 90, performedReps: 12 }), bests)
      ).toBe(true);
    });

    it("is blocked by a prior set with MORE reps and higher weight", () => {
      const blocked = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 100, performedReps: 12 }),
      ]);
      // 95×10: the 100kg×12 set counts (12 >= 10) → 95 does not beat 100.
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 95, performedReps: 10 }), blocked)
      ).toBe(false);
    });

    it("is NOT a PR when there is no prior comparable set (day one stays quiet)", () => {
      const empty = computePersonalBests([]);
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 100, performedReps: 10 }), empty)
      ).toBe(false);
    });

    it("is NOT a PR when no prior set has enough reps (null best)", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 200, performedReps: 15 }), bests)
      ).toBe(false);
    });

    it("weight 0 with reps never beats anything (bodyweight logged as 0kg)", () => {
      const zeroPriors = computePersonalBests([
        makeLoggedSet({ performedWeightKg: 0, performedReps: 10 }),
      ]);
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 0, performedReps: 10 }), zeroPriors)
      ).toBe(false);
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 0, performedReps: 8 }), bests)
      ).toBe(false);
    });

    it("zero or negative reps are never a PR", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 200, performedReps: 0 }), bests)
      ).toBe(false);
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: 200, performedReps: -1 }), bests)
      ).toBe(false);
    });

    it("negative weight is never a PR", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: -5, performedReps: 10 }), bests)
      ).toBe(false);
    });
  });

  describe("reps-only", () => {
    const bests = computePersonalBests([makeLoggedSet({ performedReps: 12 })]);

    it("is a PR when reps beat the prior max", () => {
      expect(isNewPersonalBest(makeInput({ performedReps: 13 }), bests)).toBe(true);
    });

    it("is NOT a PR on equal reps (boundary)", () => {
      expect(isNewPersonalBest(makeInput({ performedReps: 12 }), bests)).toBe(false);
    });

    it("is NOT a PR when there is no prior reps-only set", () => {
      const empty = computePersonalBests([]);
      expect(isNewPersonalBest(makeInput({ performedReps: 100 }), empty)).toBe(false);
    });

    it("zero or negative reps are never a PR", () => {
      expect(isNewPersonalBest(makeInput({ performedReps: 0 }), bests)).toBe(false);
      expect(isNewPersonalBest(makeInput({ performedReps: -3 }), bests)).toBe(false);
    });
  });

  describe("duration-only", () => {
    const bests = computePersonalBests([makeLoggedSet({ performedDurationSec: 60 })]);

    it("is a PR when longer than the prior max", () => {
      expect(isNewPersonalBest(makeInput({ performedDurationSec: 61 }), bests)).toBe(true);
    });

    it("is NOT a PR on equal duration (boundary)", () => {
      expect(isNewPersonalBest(makeInput({ performedDurationSec: 60 }), bests)).toBe(false);
    });

    it("is NOT a PR when there is no prior duration-only set", () => {
      const empty = computePersonalBests([]);
      expect(isNewPersonalBest(makeInput({ performedDurationSec: 600 }), empty)).toBe(false);
    });

    it("zero duration is never a PR", () => {
      expect(isNewPersonalBest(makeInput({ performedDurationSec: 0 }), bests)).toBe(false);
    });
  });

  describe("distance-only", () => {
    const bests = computePersonalBests([makeLoggedSet({ performedDistanceM: 1000 })]);

    it("is a PR when farther than the prior max", () => {
      expect(isNewPersonalBest(makeInput({ performedDistanceM: 1001 }), bests)).toBe(true);
    });

    it("is NOT a PR on equal distance (boundary)", () => {
      expect(isNewPersonalBest(makeInput({ performedDistanceM: 1000 }), bests)).toBe(false);
    });

    it("is NOT a PR when there is no prior distance-only set", () => {
      const empty = computePersonalBests([]);
      expect(isNewPersonalBest(makeInput({ performedDistanceM: 5000 }), empty)).toBe(false);
    });

    it("zero distance is never a PR", () => {
      expect(isNewPersonalBest(makeInput({ performedDistanceM: 0 }), bests)).toBe(false);
    });
  });

  describe("cardio (duration + distance together)", () => {
    it("is never an auto PR, even when both values beat the standalone maxima", () => {
      const bests = computePersonalBests([
        makeLoggedSet({ performedDurationSec: 60 }),
        makeLoggedSet({ performedDistanceM: 1000 }),
      ]);
      expect(
        isNewPersonalBest(
          makeInput({ performedDurationSec: 3600, performedDistanceM: 10000 }),
          bests
        )
      ).toBe(false);
    });
  });

  describe("degenerate inputs", () => {
    const bests = computePersonalBests([
      makeLoggedSet({ performedWeightKg: 100, performedReps: 10 }),
      makeLoggedSet({ performedReps: 12 }),
      makeLoggedSet({ performedDurationSec: 60 }),
      makeLoggedSet({ performedDistanceM: 1000 }),
    ]);

    it("all-null input is never a PR", () => {
      expect(isNewPersonalBest(makeInput(), bests)).toBe(false);
    });

    it("weight without reps is never a PR (no comparable category)", () => {
      expect(isNewPersonalBest(makeInput({ performedWeightKg: 500 }), bests)).toBe(false);
    });

    it("NaN values are never a PR", () => {
      expect(
        isNewPersonalBest(makeInput({ performedWeightKg: NaN, performedReps: 10 }), bests)
      ).toBe(false);
      expect(isNewPersonalBest(makeInput({ performedReps: NaN }), bests)).toBe(false);
    });
  });
});

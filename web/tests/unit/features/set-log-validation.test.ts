import { describe, it, expect } from "vitest";
import { isSetInputEmpty } from "@/features/workout/set-log-validation";

describe("isSetInputEmpty", () => {
  it("returns true when all fields are null", () => {
    expect(
      isSetInputEmpty("reps", {
        performedWeightKg: null,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(true);
  });

  it("returns true for reps target when only weight is provided", () => {
    expect(
      isSetInputEmpty("reps", {
        performedWeightKg: 60,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(true);
  });

  it("returns false for reps target when reps is provided", () => {
    expect(
      isSetInputEmpty("reps", {
        performedWeightKg: null,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(false);
  });

  it("returns false for reps target when weight and reps are provided", () => {
    expect(
      isSetInputEmpty("reps", {
        performedWeightKg: 60,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(false);
  });

  it("returns true for duration target when only weight is provided", () => {
    expect(
      isSetInputEmpty("duration", {
        performedWeightKg: 10,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(true);
  });

  it("returns false for duration target when duration is provided", () => {
    expect(
      isSetInputEmpty("duration", {
        performedWeightKg: null,
        performedReps: null,
        performedDurationSec: 45,
        performedDistanceM: null,
      })
    ).toBe(false);
  });

  it("returns true for distance target when only weight is provided", () => {
    expect(
      isSetInputEmpty("distance", {
        performedWeightKg: 10,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: null,
      })
    ).toBe(true);
  });

  it("returns false for distance target when distance is provided", () => {
    expect(
      isSetInputEmpty("distance", {
        performedWeightKg: null,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: 1000,
      })
    ).toBe(false);
  });
});

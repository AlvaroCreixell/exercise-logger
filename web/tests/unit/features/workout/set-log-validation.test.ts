import { describe, it, expect } from "vitest";
import { isSetInputEmpty } from "@/features/workout/set-log-validation";

const baseInput = {
  performedWeightKg: null,
  performedReps: null,
  performedDurationSec: null,
  performedDistanceM: null,
};

describe("isSetInputEmpty — standard mode", () => {
  it("reps target needs reps", () => {
    expect(isSetInputEmpty("reps", baseInput)).toBe(true);
    expect(isSetInputEmpty("reps", { ...baseInput, performedReps: 10 })).toBe(false);
  });

  it("duration target needs duration", () => {
    expect(isSetInputEmpty("duration", baseInput)).toBe(true);
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30 })).toBe(false);
  });

  it("distance target needs distance", () => {
    expect(isSetInputEmpty("distance", baseInput)).toBe(true);
    expect(isSetInputEmpty("distance", { ...baseInput, performedDistanceM: 1000 })).toBe(false);
  });

  it("non-cardio-extra duration target rejects distance-only input", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDistanceM: 1000 })).toBe(true);
  });
});

describe("isSetInputEmpty — cardio extra mode", () => {
  it("accepts duration-only", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30 }, { cardioExtra: true })).toBe(false);
  });

  it("accepts distance-only (closes F5)", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDistanceM: 1000 }, { cardioExtra: true })).toBe(false);
  });

  it("accepts both duration and distance", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedDurationSec: 30, performedDistanceM: 1000 }, { cardioExtra: true })).toBe(false);
  });

  it("rejects neither (truly empty)", () => {
    expect(isSetInputEmpty("duration", baseInput, { cardioExtra: true })).toBe(true);
  });

  it("does not accept reps-only as a fallback for cardio extras", () => {
    expect(isSetInputEmpty("duration", { ...baseInput, performedReps: 10 }, { cardioExtra: true })).toBe(true);
  });
});

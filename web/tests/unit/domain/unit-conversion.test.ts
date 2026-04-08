import { describe, it, expect } from "vitest";
import {
  kgToLbs,
  lbsToKg,
  getIncrement,
  roundToIncrement,
  toDisplayWeight,
  toCanonicalKg,
} from "@/domain/unit-conversion";

describe("kgToLbs", () => {
  it("converts 0 kg to 0 lbs", () => {
    expect(kgToLbs(0)).toBe(0);
  });

  it("converts 100 kg to approximately 220.46 lbs", () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 2);
  });

  it("converts 1 kg to approximately 2.205 lbs", () => {
    expect(kgToLbs(1)).toBeCloseTo(2.205, 2);
  });
});

describe("lbsToKg", () => {
  it("converts 0 lbs to 0 kg", () => {
    expect(lbsToKg(0)).toBe(0);
  });

  it("converts 220 lbs to approximately 99.79 kg", () => {
    expect(lbsToKg(220)).toBeCloseTo(99.79, 1);
  });

  it("converts 1 lb to approximately 0.454 kg", () => {
    expect(lbsToKg(1)).toBeCloseTo(0.454, 2);
  });

  it("round-trips: lbsToKg(kgToLbs(x)) ≈ x", () => {
    const original = 80;
    expect(lbsToKg(kgToLbs(original))).toBeCloseTo(original, 10);
  });
});

describe("getIncrement", () => {
  it("returns 2.5 kg for barbell", () => {
    expect(getIncrement("barbell", "kg")).toBe(2.5);
  });

  it("returns 5 lbs for barbell", () => {
    expect(getIncrement("barbell", "lbs")).toBe(5);
  });

  it("returns 2 kg for dumbbell", () => {
    expect(getIncrement("dumbbell", "kg")).toBe(2);
  });

  it("returns 5 lbs for dumbbell", () => {
    expect(getIncrement("dumbbell", "lbs")).toBe(5);
  });

  it("returns 5 kg for machine", () => {
    expect(getIncrement("machine", "kg")).toBe(5);
  });

  it("returns 10 lbs for machine", () => {
    expect(getIncrement("machine", "lbs")).toBe(10);
  });

  it("returns 5 kg for cable", () => {
    expect(getIncrement("cable", "kg")).toBe(5);
  });

  it("returns 10 lbs for cable", () => {
    expect(getIncrement("cable", "lbs")).toBe(10);
  });

  it("returns 2 kg for kettlebell", () => {
    expect(getIncrement("kettlebell", "kg")).toBe(2);
  });

  it("returns 5 lbs for kettlebell", () => {
    expect(getIncrement("kettlebell", "lbs")).toBe(5);
  });

  it("returns 2.5 kg for bodyweight", () => {
    expect(getIncrement("bodyweight", "kg")).toBe(2.5);
  });

  it("returns 5 lbs for bodyweight", () => {
    expect(getIncrement("bodyweight", "lbs")).toBe(5);
  });

  it("returns 2 kg for medicine-ball", () => {
    expect(getIncrement("medicine-ball", "kg")).toBe(2);
  });

  it("returns 5 lbs for medicine-ball", () => {
    expect(getIncrement("medicine-ball", "lbs")).toBe(5);
  });

  it("returns 2 kg for other", () => {
    expect(getIncrement("other", "kg")).toBe(2);
  });

  it("returns 5 lbs for other", () => {
    expect(getIncrement("other", "lbs")).toBe(5);
  });
});

describe("roundToIncrement", () => {
  it("rounds barbell kg to nearest 2.5", () => {
    expect(roundToIncrement(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("rounds barbell kg down when closer to lower step", () => {
    expect(roundToIncrement(81.0, "barbell", "kg")).toBe(80);
  });

  it("rounds barbell lbs to nearest 5", () => {
    expect(roundToIncrement(177, "barbell", "lbs")).toBe(175);
  });

  it("rounds machine kg to nearest 5", () => {
    expect(roundToIncrement(37, "machine", "kg")).toBe(35);
  });

  it("rounds machine lbs to nearest 10", () => {
    expect(roundToIncrement(94, "machine", "lbs")).toBe(90);
  });

  it("rounds dumbbell kg to nearest 2", () => {
    expect(roundToIncrement(21.5, "dumbbell", "kg")).toBe(22);
  });

  it("rounds exactly on step boundary to the step itself", () => {
    expect(roundToIncrement(80, "barbell", "kg")).toBe(80);
  });

  it("rounds 0 to 0", () => {
    expect(roundToIncrement(0, "barbell", "kg")).toBe(0);
  });
});

describe("toDisplayWeight", () => {
  it("returns kg value with floating-point cleanup when units is kg", () => {
    expect(toDisplayWeight(7.5, "kg")).toBe(7.5);
  });

  it("converts kg to lbs with floating-point cleanup when units is lbs", () => {
    expect(toDisplayWeight(lbsToKg(7.5), "lbs")).toBeCloseTo(7.5, 2);
  });

  it("cleans floating-point noise to 2 decimal places", () => {
    expect(toDisplayWeight(0.30000000000000004, "kg")).toBe(0.3);
  });

  it("does not round to equipment increments", () => {
    const canonical = lbsToKg(7.5);
    expect(toDisplayWeight(canonical, "lbs")).toBeCloseTo(7.5, 1);
  });

  it("round-trips: toDisplayWeight(toCanonicalKg(x, units), units) ≈ x", () => {
    const input = 7.5;
    const canonical = toCanonicalKg(input, "lbs");
    const display = toDisplayWeight(canonical, "lbs");
    expect(display).toBeCloseTo(input, 1);
  });
});

describe("toCanonicalKg", () => {
  it("returns kg value unchanged when displayUnits is kg", () => {
    expect(toCanonicalKg(7.5, "kg")).toBe(7.5);
  });

  it("converts lbs to kg without rounding when displayUnits is lbs", () => {
    expect(toCanonicalKg(7.5, "lbs")).toBeCloseTo(3.40194, 4);
  });

  it("preserves fractional kg values", () => {
    expect(toCanonicalKg(2.25, "kg")).toBe(2.25);
  });

  it("preserves fractional lbs values through conversion", () => {
    expect(toCanonicalKg(12.5, "lbs")).toBeCloseTo(5.66990, 4);
  });

  it("handles zero", () => {
    expect(toCanonicalKg(0, "kg")).toBe(0);
    expect(toCanonicalKg(0, "lbs")).toBe(0);
  });
});

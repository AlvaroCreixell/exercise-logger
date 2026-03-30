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
  it("returns kg rounded to barbell increment when units is kg", () => {
    expect(toDisplayWeight(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("converts kg to lbs and rounds to barbell lbs increment", () => {
    // 100 kg = ~220.46 lbs -> rounds to 220 lbs (nearest 5)
    expect(toDisplayWeight(100, "barbell", "lbs")).toBe(220);
  });

  it("converts kg to lbs for dumbbell (nearest 5 lbs)", () => {
    // 20 kg = ~44.09 lbs -> rounds to 45 lbs (nearest 5)
    expect(toDisplayWeight(20, "dumbbell", "lbs")).toBe(45);
  });

  it("converts kg to lbs for machine (nearest 10 lbs)", () => {
    // 50 kg = ~110.23 lbs -> rounds to 110 lbs (nearest 10)
    expect(toDisplayWeight(50, "machine", "lbs")).toBe(110);
  });
});

describe("toCanonicalKg", () => {
  it("returns kg rounded to barbell increment when displayUnits is kg", () => {
    expect(toCanonicalKg(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("converts lbs to kg and rounds to barbell kg increment", () => {
    // 225 lbs = ~102.06 kg -> rounds to 102.5 kg (nearest 2.5)
    expect(toCanonicalKg(225, "barbell", "lbs")).toBe(102.5);
  });

  it("converts lbs to kg for dumbbell (nearest 2 kg)", () => {
    // 45 lbs = ~20.41 kg -> rounds to 20 kg (nearest 2)
    expect(toCanonicalKg(45, "dumbbell", "lbs")).toBe(20);
  });

  it("converts lbs to kg for machine (nearest 5 kg)", () => {
    // 110 lbs = ~49.9 kg -> rounds to 50 kg (nearest 5)
    expect(toCanonicalKg(110, "machine", "lbs")).toBe(50);
  });

  it("round-trips display -> canonical -> display", () => {
    const canonicalKg = 80;
    const displayLbs = toDisplayWeight(canonicalKg, "barbell", "lbs");
    const backToKg = toCanonicalKg(displayLbs, "barbell", "lbs");
    // Should be close to original, within one increment
    expect(Math.abs(backToKg - canonicalKg)).toBeLessThanOrEqual(2.5);
  });
});

import { describe, it, expect } from "vitest";
import {
  formatLoggedSet,
  formatLoggedSetParts,
} from "@/shared/lib/formatLoggedSet";

const baseSet = {
  performedWeightKg: null,
  performedReps: null,
  performedDurationSec: null,
  performedDistanceM: null,
};

describe("formatLoggedSet (compact)", () => {
  it("formats weight + reps with kg unit", () => {
    expect(formatLoggedSet({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "kg"))
      .toBe("80kg × 10");
  });

  it("formats weight + reps with lbs unit (display conversion)", () => {
    // 80kg ≈ 176.37lbs at canonical conversion. toDisplayWeight applies floating-
    // point cleanup but no equipment rounding, so the output is "176.37lbs × 10".
    const out = formatLoggedSet({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "lbs");
    expect(out).toMatch(/^176(\.\d+)?lbs × 10$/);
  });

  it("formats reps only (bodyweight)", () => {
    expect(formatLoggedSet({ ...baseSet, performedReps: 12 }, "kg"))
      .toBe("12 reps");
  });

  it("formats duration only (isometric)", () => {
    expect(formatLoggedSet({ ...baseSet, performedDurationSec: 30 }, "kg"))
      .toBe("30s");
  });

  it("formats distance only (cardio extra distance-only)", () => {
    expect(formatLoggedSet({ ...baseSet, performedDistanceM: 1000 }, "kg"))
      .toBe("1000m");
  });

  it("prefers reps over duration when both present (matches SetRow precedence)", () => {
    expect(formatLoggedSet({ ...baseSet, performedReps: 12, performedDurationSec: 30 }, "kg"))
      .toBe("12 reps");
  });

  it("renders both duration and distance joined with ' · ' for cardio combined sets", () => {
    const out = formatLoggedSet(
      { ...baseSet, performedDurationSec: 600, performedDistanceM: 1500 },
      "kg",
    );
    expect(out).toBe("600s · 1500m");
  });

  it("returns the default fallback for an empty set", () => {
    expect(formatLoggedSet(baseSet, "kg")).toBe("—");
  });

  it("returns a custom fallback when provided", () => {
    expect(formatLoggedSet(baseSet, "kg", { fallback: "✓" })).toBe("✓");
  });
});

describe("formatLoggedSetParts (structured for custom layouts)", () => {
  it("returns weight+reps parts with kg unit", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedWeightKg: 80, performedReps: 10 }, "kg"))
      .toEqual({ primary: "80", unit: "kg", secondary: "10" });
  });

  it("returns reps-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedReps: 12 }, "kg"))
      .toEqual({ primary: "12", unit: "reps", secondary: null });
  });

  it("returns duration-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedDurationSec: 30 }, "kg"))
      .toEqual({ primary: "30", unit: "s", secondary: null });
  });

  it("returns distance-only parts", () => {
    expect(formatLoggedSetParts({ ...baseSet, performedDistanceM: 500 }, "kg"))
      .toEqual({ primary: "500", unit: "m", secondary: null });
  });

  it("returns null for an empty set (caller handles fallback)", () => {
    expect(formatLoggedSetParts(baseSet, "kg")).toBeNull();
  });

  it("returns tertiary for combined duration+distance cardio sets", () => {
    expect(
      formatLoggedSetParts(
        { ...baseSet, performedDurationSec: 600, performedDistanceM: 1500 },
        "kg",
      ),
    ).toEqual({
      primary: "600",
      unit: "s",
      secondary: null,
      tertiary: { value: "1500", unit: "m" },
    });
  });
});

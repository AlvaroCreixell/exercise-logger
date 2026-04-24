import { describe, it, expect } from "vitest";
import {
  computeSessionVolumeKg,
  formatVolume,
  formatShortDuration,
} from "@/shared/lib/sessionStats";
import type { LoggedSet } from "@/domain/types";

function makeSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: "ls",
    sessionId: "s",
    sessionExerciseId: "se",
    exerciseId: "ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("computeSessionVolumeKg", () => {
  it("sums weight × reps across sets", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: 5 }),
      makeSet({ performedWeightKg: 80, performedReps: 10 }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(1300);
  });

  it("skips sets missing weight", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: 5 }),
      makeSet({ performedWeightKg: null, performedReps: 10 }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(500);
  });

  it("skips sets missing reps", () => {
    const sets = [
      makeSet({ performedWeightKg: 100, performedReps: null }),
    ];
    expect(computeSessionVolumeKg(sets)).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(computeSessionVolumeKg([])).toBe(0);
  });

  it("ignores duration-only sets", () => {
    const sets = [makeSet({ performedDurationSec: 60 })];
    expect(computeSessionVolumeKg(sets)).toBe(0);
  });
});

describe("formatVolume", () => {
  it("formats kg with suffix and thousands separator", () => {
    expect(formatVolume(8240, "kg")).toBe("8,240 kg");
  });

  it("formats lbs with conversion and suffix", () => {
    expect(formatVolume(1000, "lbs")).toBe("2,205 lbs");
  });

  it("formats zero as '0 kg'", () => {
    expect(formatVolume(0, "kg")).toBe("0 kg");
  });

  it("rounds to integer (no decimals on the big number)", () => {
    expect(formatVolume(8240.7, "kg")).toBe("8,241 kg");
  });
});

describe("formatShortDuration", () => {
  it("returns '52m' for a 52-minute session", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:52:00Z";
    expect(formatShortDuration(start, end)).toBe("52m");
  });

  it("returns '' when end is null", () => {
    expect(formatShortDuration("2026-04-17T12:00:00Z", null)).toBe("");
  });

  it("returns '< 1m' for sub-minute sessions", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:00:30Z";
    expect(formatShortDuration(start, end)).toBe("< 1m");
  });

  it("handles multi-hour sessions as minutes", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T14:30:00Z";
    expect(formatShortDuration(start, end)).toBe("150m");
  });

  it("rounds to nearest minute (52m31s → 53m, matching SessionDetailStatsTile)", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:52:31Z";
    expect(formatShortDuration(start, end)).toBe("53m");
  });

  it("rounds down for sub-30-second remainders (52m20s → 52m)", () => {
    const start = "2026-04-17T12:00:00Z";
    const end = "2026-04-17T12:52:20Z";
    expect(formatShortDuration(start, end)).toBe("52m");
  });
});

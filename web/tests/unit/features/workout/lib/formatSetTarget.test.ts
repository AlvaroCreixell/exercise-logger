import { describe, it, expect } from "vitest";
import {
  formatSetTarget,
  formatExerciseTargetLine,
} from "@/features/workout/lib/formatSetTarget";
import type { SetBlock } from "@/domain/types";

function makeBlock(overrides: Partial<SetBlock> = {}): SetBlock {
  return {
    targetKind: "reps",
    minValue: 8,
    maxValue: 12,
    count: 3,
    ...overrides,
  };
}

describe("formatSetTarget — reps", () => {
  it("formats a reps range as '{count} × {min}–{max}'", () => {
    expect(formatSetTarget(makeBlock({ count: 3, minValue: 8, maxValue: 12 }))).toBe(
      "3 × 8–12",
    );
  });

  it("formats an exact reps target as '{count} × {exact}'", () => {
    expect(
      formatSetTarget(makeBlock({ count: 3, exactValue: 10, minValue: undefined, maxValue: undefined })),
    ).toBe("3 × 10");
  });

  it("appends lowercase tag suffix when block has tag='top'", () => {
    expect(
      formatSetTarget(makeBlock({ count: 1, minValue: 12, maxValue: 16, tag: "top" })),
    ).toBe("1 × 12–16 top");
  });

  it("appends lowercase tag suffix when block has tag='amrap'", () => {
    expect(
      formatSetTarget(makeBlock({ count: 1, minValue: 8, maxValue: 15, tag: "amrap" })),
    ).toBe("1 × 8–15 amrap");
  });
});

describe("formatSetTarget — duration (minute conversion preserved from legacy)", () => {
  it("converts exactValue to minutes when divisible by 60: 1800 → '30min'", () => {
    expect(
      formatSetTarget(
        makeBlock({ targetKind: "duration", count: 1, exactValue: 1800, minValue: undefined, maxValue: undefined }),
      ),
    ).toBe("1 × 30min");
  });

  it("keeps exactValue in seconds when not divisible by 60: 45 → '45s'", () => {
    expect(
      formatSetTarget(
        makeBlock({ targetKind: "duration", count: 1, exactValue: 45, minValue: undefined, maxValue: undefined }),
      ),
    ).toBe("1 × 45s");
  });

  it("converts range to minutes when BOTH endpoints are divisible by 60: 1800–3600 → '30–60min'", () => {
    expect(
      formatSetTarget(
        makeBlock({ targetKind: "duration", count: 1, minValue: 1800, maxValue: 3600 }),
      ),
    ).toBe("1 × 30–60min");
  });

  it("keeps range in seconds when endpoints are not both divisible by 60: 30–60 → '30–60s'", () => {
    expect(
      formatSetTarget(
        makeBlock({ targetKind: "duration", count: 4, minValue: 30, maxValue: 60 }),
      ),
    ).toBe("4 × 30–60s");
  });
});

describe("formatSetTarget — distance", () => {
  it("formats distance exactValue as '{count} × {m}m'", () => {
    expect(
      formatSetTarget(
        makeBlock({ targetKind: "distance", count: 2, exactValue: 2000, minValue: undefined, maxValue: undefined }),
      ),
    ).toBe("2 × 2000m");
  });
});

describe("formatExerciseTargetLine (joined)", () => {
  it("joins blocks with ' · '", () => {
    const blocks: SetBlock[] = [
      makeBlock({ count: 3, minValue: 8, maxValue: 12 }),
      makeBlock({ count: 1, minValue: 12, maxValue: 16, tag: "top" }),
    ];
    expect(formatExerciseTargetLine(blocks)).toBe(
      "3 × 8–12 · 1 × 12–16 top",
    );
  });

  it("returns empty string for no blocks", () => {
    expect(formatExerciseTargetLine([])).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { generateBlockSignature } from "@/domain/block-signature";
import type { SetBlock } from "@/domain/types";

describe("generateBlockSignature", () => {
  it("generates signature for reps range with top tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 8,
      count: 1,
      tag: "top",
    };
    expect(generateBlockSignature(block)).toBe("reps:6-8:count1:tagtop");
  });

  it("generates signature for reps range without tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    expect(generateBlockSignature(block)).toBe("reps:8-12:count3:tagnormal");
  });

  it("generates signature for duration range without tag", () => {
    const block: SetBlock = {
      targetKind: "duration",
      minValue: 30,
      maxValue: 60,
      count: 2,
    };
    expect(generateBlockSignature(block)).toBe("duration:30-60:count2:tagnormal");
  });

  it("generates signature for exact reps", () => {
    const block: SetBlock = {
      targetKind: "reps",
      exactValue: 8,
      count: 3,
    };
    expect(generateBlockSignature(block)).toBe("reps:8:count3:tagnormal");
  });

  it("generates signature for exact distance", () => {
    const block: SetBlock = {
      targetKind: "distance",
      exactValue: 2000,
      count: 1,
    };
    expect(generateBlockSignature(block)).toBe("distance:2000:count1:tagnormal");
  });

  it("generates signature with amrap tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 10,
      count: 1,
      tag: "amrap",
    };
    expect(generateBlockSignature(block)).toBe("reps:6-10:count1:tagamrap");
  });

  it("generates signature for reps range with large count", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 12,
      maxValue: 15,
      count: 5,
    };
    expect(generateBlockSignature(block)).toBe("reps:12-15:count5:tagnormal");
  });

  it("produces deterministic output for the same input", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    const sig1 = generateBlockSignature(block);
    const sig2 = generateBlockSignature(block);
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different blocks", () => {
    const blockA: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 8,
      count: 1,
      tag: "top",
    };
    const blockB: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    expect(generateBlockSignature(blockA)).not.toBe(
      generateBlockSignature(blockB)
    );
  });

  it("falls back to '0' for a block missing both range and exact value", () => {
    const block: SetBlock = {
      targetKind: "reps",
      count: 1,
    };
    expect(generateBlockSignature(block)).toBe("reps:0:count1:tagnormal");
  });
});

import { describe, it, expect } from "vitest";
import { slugify } from "@/domain/slug";

describe("slugify", () => {
  it("converts a simple name to a slug", () => {
    expect(slugify("Barbell Back Squat")).toBe("barbell-back-squat");
  });

  it("preserves existing hyphens", () => {
    expect(slugify("Single-Leg Romanian Deadlift")).toBe(
      "single-leg-romanian-deadlift"
    );
  });

  it("handles multiple spaces", () => {
    expect(slugify("Medicine Ball  Rotational  Slam")).toBe(
      "medicine-ball-rotational-slam"
    );
  });

  it("removes special characters", () => {
    expect(slugify("Dumbbell Curl (Seated)")).toBe("dumbbell-curl-seated");
  });

  it("handles underscores", () => {
    expect(slugify("leg_extension")).toBe("leg-extension");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-Bench Press-")).toBe("bench-press");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(slugify("@#$%")).toBe("");
  });

  it("collapses multiple hyphens from mixed separators", () => {
    expect(slugify("cable - woodchop")).toBe("cable-woodchop");
  });

  it("handles numbers in the name", () => {
    expect(slugify("2K Row Sprint")).toBe("2k-row-sprint");
  });
});

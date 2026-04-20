import { describe, it, expect } from "vitest";
import { formatErrorPath } from "@/features/settings/lib/formatErrorPath";

describe("formatErrorPath", () => {
  it("returns 'Root' for empty path (top-level error)", () => {
    expect(formatErrorPath("")).toBe("Root");
  });

  it("returns a top-level field name capitalized", () => {
    expect(formatErrorPath("name")).toBe("Name");
    expect(formatErrorPath("version")).toBe("Version");
  });

  it("formats a day entry path as 'Day A · Entry N · field'", () => {
    expect(formatErrorPath("days.A.entries[0].sets")).toBe("Day A · Entry 1 · sets");
  });

  it("1-indexes entries (entries[2] renders as 'Entry 3')", () => {
    expect(formatErrorPath("days.B.entries[2].exercise")).toBe("Day B · Entry 3 · exercise");
  });

  it("formats superset item paths", () => {
    expect(formatErrorPath("days.A.entries[1].items[0].exercise")).toBe(
      "Day A · Entry 2 · Item 1 · exercise"
    );
  });

  it("formats set-block paths", () => {
    expect(formatErrorPath("days.A.entries[0].set_blocks[1].count")).toBe(
      "Day A · Entry 1 · set block 2 · count"
    );
  });

  it("formats cardio section paths", () => {
    expect(formatErrorPath("cardio.options[0].name")).toBe("Cardio · Option 1 · name");
  });

  it("formats day_order paths", () => {
    expect(formatErrorPath("day_order")).toBe("Day order");
  });

  it("falls back gracefully for unrecognised paths", () => {
    expect(formatErrorPath("foo.bar.baz")).toBe("foo · bar · baz");
  });

  it("handles bracket-only paths like 'entries[0]' stripped of parent", () => {
    // Defensive: if validation ever emits a partial path, we don't crash.
    expect(formatErrorPath("entries[0]")).toBe("Entry 1");
  });
});

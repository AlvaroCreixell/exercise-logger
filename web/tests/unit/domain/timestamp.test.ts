import { describe, it, expect, vi, afterEach } from "vitest";
import { nowISO } from "@/domain/timestamp";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("nowISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a valid ISO 8601 UTC string", () => {
    const result = nowISO();
    expect(result).toMatch(ISO_REGEX);
  });

  it("ends with Z (UTC indicator)", () => {
    const result = nowISO();
    expect(result.endsWith("Z")).toBe(true);
  });

  it("returns the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T14:30:00.000Z"));

    const result = nowISO();
    expect(result).toBe("2026-03-28T14:30:00.000Z");
  });

  it("returns different values at different times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T14:00:00.000Z"));
    const t1 = nowISO();

    vi.setSystemTime(new Date("2026-03-28T14:00:01.000Z"));
    const t2 = nowISO();

    expect(t1).not.toBe(t2);
  });
});

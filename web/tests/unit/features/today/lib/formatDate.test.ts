import { describe, it, expect } from "vitest";
import { formatTodayEyebrow } from "@/features/today/lib/formatDate";

describe("formatTodayEyebrow", () => {
  it("formats a Sunday in April as 'SUNDAY · APR 19'", () => {
    const date = new Date(2026, 3, 19); // April is month 3 (0-indexed)
    expect(formatTodayEyebrow(date)).toBe("SUNDAY · APR 19");
  });

  it("formats a Monday in January as 'MONDAY · JAN 5'", () => {
    const date = new Date(2026, 0, 5);
    expect(formatTodayEyebrow(date)).toBe("MONDAY · JAN 5");
  });

  it("formats a Friday in December as 'FRIDAY · DEC 31'", () => {
    const date = new Date(2027, 11, 31);
    expect(formatTodayEyebrow(date)).toBe("FRIDAY · DEC 31");
  });
});

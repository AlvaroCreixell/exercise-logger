import { describe, it, expect } from "vitest";
import { groupSessionsByMonth } from "@/features/history/lib/groupByMonth";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session } from "@/domain/types";

function makeSummary(id: string, displayDate: string): FinishedSessionSummary {
  const session: Session = {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: displayDate,
    finishedAt: displayDate,
  };
  return {
    session,
    exerciseCount: 0,
    loggedSetCount: 0,
    volumeKg: 0,
    displayDate,
  };
}

describe("groupSessionsByMonth", () => {
  it("groups by calendar month (local time)", () => {
    const summaries = [
      makeSummary("s1", "2026-04-17T12:00:00Z"),
      makeSummary("s2", "2026-04-15T12:00:00Z"),
      makeSummary("s3", "2026-03-31T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups).toHaveLength(2);
    expect(groups[0].sessions).toHaveLength(2);
    expect(groups[0].sessions[0].session.id).toBe("s1");
    expect(groups[1].sessions[0].session.id).toBe("s3");
  });

  it("renders month label as 'APRIL 2026' uppercase", () => {
    const summaries = [makeSummary("s1", "2026-04-17T12:00:00Z")];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].monthLabel).toBe("APRIL 2026");
  });

  it("uses YYYY-MM month key for stable sort", () => {
    const summaries = [makeSummary("s1", "2026-04-17T12:00:00Z")];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].monthKey).toBe("2026-04");
  });

  it("preserves input order within each group", () => {
    const summaries = [
      makeSummary("s1", "2026-04-17T12:00:00Z"),
      makeSummary("s2", "2026-04-10T12:00:00Z"),
      makeSummary("s3", "2026-04-20T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups[0].sessions.map((s) => s.session.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("returns [] for empty input", () => {
    expect(groupSessionsByMonth([])).toEqual([]);
  });

  it("sorts groups newest-first by monthKey", () => {
    const summaries = [
      makeSummary("s-feb", "2026-02-01T12:00:00Z"),
      makeSummary("s-mar", "2026-03-01T12:00:00Z"),
      makeSummary("s-apr", "2026-04-01T12:00:00Z"),
    ];
    const groups = groupSessionsByMonth(summaries);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-04", "2026-03", "2026-02"]);
  });
});

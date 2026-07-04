import { describe, it, expect } from "vitest";
import {
  filterSummaries,
  distinctDayIds,
} from "@/features/history/lib/filterSessions";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session } from "@/domain/types";

function makeSummary(id: string, dayId: string): FinishedSessionSummary {
  const session: Session = {
    id,
    routineId: "r1",
    routineNameSnapshot: "Routine",
    dayId,
    dayLabelSnapshot: `Day ${dayId}`,
    dayOrderSnapshot: ["A", "B"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-07-01T10:00:00.000Z",
    finishedAt: "2026-07-01T11:00:00.000Z",
  };
  return {
    session,
    exerciseCount: 3,
    loggedSetCount: 9,
    volumeKg: 1000,
    displayDate: session.finishedAt!,
  };
}

const summaries = [
  makeSummary("s1", "A"),
  makeSummary("s2", "B"),
  makeSummary("s3", "A"),
];

describe("filterSummaries", () => {
  it("passes everything through with null filters", () => {
    expect(
      filterSummaries(summaries, { day: null, matchingSessionIds: null }),
    ).toHaveLength(3);
  });

  it("filters by day id", () => {
    const out = filterSummaries(summaries, {
      day: "A",
      matchingSessionIds: null,
    });
    expect(out.map((s) => s.session.id)).toEqual(["s1", "s3"]);
  });

  it("filters by matching session ids", () => {
    const out = filterSummaries(summaries, {
      day: null,
      matchingSessionIds: new Set(["s2"]),
    });
    expect(out.map((s) => s.session.id)).toEqual(["s2"]);
  });

  it("combines both filters", () => {
    const out = filterSummaries(summaries, {
      day: "A",
      matchingSessionIds: new Set(["s1", "s2"]),
    });
    expect(out.map((s) => s.session.id)).toEqual(["s1"]);
  });

  it("empty matching set filters everything out", () => {
    expect(
      filterSummaries(summaries, { day: null, matchingSessionIds: new Set() }),
    ).toHaveLength(0);
  });
});

describe("distinctDayIds", () => {
  it("returns sorted unique day ids", () => {
    expect(distinctDayIds(summaries)).toEqual(["A", "B"]);
  });

  it("returns empty for no summaries", () => {
    expect(distinctDayIds([])).toEqual([]);
  });
});

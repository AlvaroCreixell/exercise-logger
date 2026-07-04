import { describe, it, expect } from "vitest";
import {
  getRestTimerStartAfterNewSet,
  getRestRemainingSec,
  formatRestClock,
} from "@/features/workout/lib/rest-timer";
import type { Session } from "@/domain/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s-1",
    routineId: "r-1",
    routineNameSnapshot: "Push Pull Legs",
    dayId: "A",
    dayLabelSnapshot: "Push",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 45,
    status: "active",
    startedAt: "2026-07-04T10:00:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}

describe("getRestTimerStartAfterNewSet — single exercises", () => {
  it("returns default rest with an exercise-name label for a non-superset save", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession(),
      exerciseName: "Barbell Bench Press",
      isSupersetMember: false,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start).toEqual({
      kind: "single",
      durationSec: 90,
      label: "Rest — Barbell Bench Press",
      roundOrdinal: null,
    });
  });

  it("returns default rest for extra exercises (caller passes isSupersetMember=false)", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession(),
      exerciseName: "Cable Fly",
      isSupersetMember: false,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start?.kind).toBe("single");
    expect(start?.durationSec).toBe(90);
    expect(start?.label).toBe("Rest — Cable Fly");
  });

  it("returns null when restDefaultSecSnapshot is 0", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession({ restDefaultSecSnapshot: 0 }),
      exerciseName: "Barbell Bench Press",
      isSupersetMember: false,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start).toBeNull();
  });

  it("returns null when restDefaultSecSnapshot is negative", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession({ restDefaultSecSnapshot: -5 }),
      exerciseName: "Barbell Bench Press",
      isSupersetMember: false,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start).toBeNull();
  });
});

describe("getRestTimerStartAfterNewSet — superset members", () => {
  it("returns null when the superset round is not yet complete", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession(),
      exerciseName: "Barbell Bench Press",
      isSupersetMember: true,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start).toBeNull();
  });

  it("returns superset rest with a round label when the round just completed", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession(),
      exerciseName: "Barbell Row",
      isSupersetMember: true,
      supersetRoundJustCompleted: true,
      supersetRoundOrdinal: 2,
    });
    expect(start).toEqual({
      kind: "superset",
      durationSec: 45,
      label: "Rest — Superset round 2",
      roundOrdinal: 2,
    });
  });

  it("returns null when restSupersetSecSnapshot is 0 even if the round completed", () => {
    const start = getRestTimerStartAfterNewSet({
      session: makeSession({ restSupersetSecSnapshot: 0 }),
      exerciseName: "Barbell Row",
      isSupersetMember: true,
      supersetRoundJustCompleted: true,
      supersetRoundOrdinal: 1,
    });
    expect(start).toBeNull();
  });

  it("never falls back to default rest for a superset member mid-round", () => {
    // Even with a long default rest configured, an incomplete round yields no timer.
    const start = getRestTimerStartAfterNewSet({
      session: makeSession({ restDefaultSecSnapshot: 300 }),
      exerciseName: "Barbell Bench Press",
      isSupersetMember: true,
      supersetRoundJustCompleted: false,
      supersetRoundOrdinal: null,
    });
    expect(start).toBeNull();
  });
});

describe("getRestRemainingSec", () => {
  const timer = { durationSec: 90, startedAtMs: 100_000 };

  it("returns the full duration at the starting instant", () => {
    expect(getRestRemainingSec(timer, 100_000)).toBe(90);
  });

  it("floors sub-second elapsed time", () => {
    expect(getRestRemainingSec(timer, 101_500)).toBe(89);
  });

  it("counts down whole seconds", () => {
    expect(getRestRemainingSec(timer, 130_000)).toBe(60);
  });

  it("goes negative after the duration elapses (caller derives done from <= 0)", () => {
    expect(getRestRemainingSec(timer, 195_000)).toBe(-5);
  });
});

describe("formatRestClock", () => {
  it("formats zero as 0:00", () => {
    expect(formatRestClock(0)).toBe("0:00");
  });

  it("formats 90 seconds as 1:30", () => {
    expect(formatRestClock(90)).toBe("1:30");
  });

  it("pads single-digit seconds", () => {
    expect(formatRestClock(605)).toBe("10:05");
  });

  it("clamps negative values to 0:00", () => {
    expect(formatRestClock(-12)).toBe("0:00");
  });
});

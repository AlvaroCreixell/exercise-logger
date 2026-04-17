import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LastSessionCard } from "@/features/today/LastSessionCard";
import type { Session } from "@/domain/types";

afterEach(cleanup);

function makeFinishedSession(overrides: Partial<Session> = {}): Session {
  const nowMs = Date.now();
  // finishedAt is exactly 3 days ago; startedAt is 52 min earlier.
  // This ensures formatRelativeDate(finishedAt) returns "3 days ago"
  // and the duration is 52 min.
  const finishedAt = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString();
  const startedAt = new Date(nowMs - 3 * 24 * 60 * 60 * 1000 - 52 * 60 * 1000).toISOString();
  return {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Push",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 45,
    status: "finished",
    startedAt,
    finishedAt,
    ...overrides,
  };
}

describe("LastSessionCard", () => {
  it("renders the day label", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    expect(screen.getByText(/Push/)).toBeVisible();
  });

  it("shows '3 days ago' when relative date is 3", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    expect(screen.getByText(/3 days ago/i)).toBeVisible();
  });

  it("shows duration when finishedAt present", () => {
    render(<LastSessionCard session={makeFinishedSession()} cadence={undefined} />);
    // Stat renders value and label as separate spans: "52" + "min"
    expect(screen.getByText("52")).toBeVisible();
    expect(screen.getByText("min")).toBeVisible();
  });

  it("renders training-cadence ribbon when sessionsLast7Days >= 3", () => {
    render(
      <LastSessionCard
        session={makeFinishedSession()}
        cadence={{ sessionsLast7Days: 3, sessionsLast30Days: 8, daysSinceLastSession: 3 }}
      />,
    );
    expect(screen.getByText(/3 sessions this week/i)).toBeVisible();
  });

  it("hides training-cadence ribbon when sessionsLast7Days < 3", () => {
    render(
      <LastSessionCard
        session={makeFinishedSession()}
        cadence={{ sessionsLast7Days: 2, sessionsLast30Days: 4, daysSinceLastSession: 3 }}
      />,
    );
    expect(screen.queryByText(/sessions this week/i)).toBeNull();
  });
});

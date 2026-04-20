import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SessionRow } from "@/features/history/SessionRow";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session } from "@/domain/types";

function makeSummary(
  overrides: Partial<FinishedSessionSummary> = {},
  sessionOverrides: Partial<Session> = {},
): FinishedSessionSummary {
  const session: Session = {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Heavy Squat",
    dayId: "A",
    dayLabelSnapshot: "Moderate Hinge + Vertical Push/Pull",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-04-17T12:00:00Z",
    finishedAt: "2026-04-17T12:52:00Z",
    ...sessionOverrides,
  };
  return {
    session,
    exerciseCount: 5,
    loggedSetCount: 17,
    volumeKg: 8240,
    displayDate: session.finishedAt ?? session.startedAt,
    ...overrides,
  };
}

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("SessionRow", () => {
  it("renders the day title", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText(/Moderate Hinge/)).toBeVisible();
  });

  it("renders the date chip with uppercase month + day", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText("APR")).toBeVisible();
    expect(screen.getByText("17")).toBeVisible();
  });

  it("renders the meta line with duration, sets, and volume", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    expect(screen.getByText(/52m · 17 sets · 8,240 kg/)).toBeVisible();
  });

  it("omits the duration when finishedAt is null", () => {
    renderInRouter(
      <SessionRow
        summary={makeSummary({}, { finishedAt: null })}
        units="kg"
      />,
    );
    expect(screen.getByText(/17 sets · 8,240 kg/)).toBeVisible();
    expect(screen.queryByText(/52m/)).toBeNull();
  });

  it("omits the volume when it is zero", () => {
    renderInRouter(
      <SessionRow summary={makeSummary({ volumeKg: 0 })} units="kg" />,
    );
    expect(screen.getByText(/52m · 17 sets/)).toBeVisible();
    expect(screen.queryByText(/0 kg/)).toBeNull();
  });

  it("links to /history/:sessionId", () => {
    renderInRouter(<SessionRow summary={makeSummary()} units="kg" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/history/s1");
  });

  it("renders volume in lbs when units='lbs'", () => {
    renderInRouter(<SessionRow summary={makeSummary({ volumeKg: 1000 })} units="lbs" />);
    expect(screen.getByText(/2,205 lbs/)).toBeVisible();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SessionDetailHeader } from "@/features/history/SessionDetailHeader";
import type { Session } from "@/domain/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
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
    ...overrides,
  };
}

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("SessionDetailHeader", () => {
  it("renders the eyebrow 'APR 17 · 52M'", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    expect(screen.getByText(/APR 17 · 52M/i)).toBeVisible();
  });

  it("renders the day title", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    expect(screen.getByText(/Moderate Hinge/)).toBeVisible();
  });

  it("renders a back link to /history with aria-label", () => {
    renderInRouter(<SessionDetailHeader session={makeSession()} />);
    const link = screen.getByRole("link", { name: /back/i });
    expect(link.getAttribute("href")).toBe("/history");
  });

  it("omits the duration segment when finishedAt is null", () => {
    renderInRouter(<SessionDetailHeader session={makeSession({ finishedAt: null })} />);
    expect(screen.getByText(/APR 17/i)).toBeVisible();
    expect(screen.queryByText(/· 52M/i)).toBeNull();
  });
});

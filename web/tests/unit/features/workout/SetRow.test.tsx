import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetRow } from "@/features/workout/SetRow";
import type { LoggedSet } from "@/domain/types";

afterEach(cleanup);

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls",
    sessionId: "s",
    sessionExerciseId: "se",
    exerciseId: "ex",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: 70,
    performedReps: 14,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-20T12:00:00Z",
    updatedAt: "2026-04-20T12:00:00Z",
    ...overrides,
  };
}

describe("SetRow — logged state", () => {
  it("renders the weight/reps pair with units suffix", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ performedWeightKg: 70, performedReps: 14 })}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/70/)).toBeVisible();
    expect(screen.getByText(/kg/i)).toBeVisible();
    expect(screen.getByText(/14/)).toBeVisible();
  });

  it("renders a TOP tag when isTopBlock is true", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet()}
        units="kg"
        isTopBlock={true}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/^TOP$/)).toBeVisible();
  });

  it("renders a '↑ PR' tag when loggedSet.isPersonalRecord is true", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ isPersonalRecord: true })}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/PR/)).toBeVisible();
  });

  it("does not render a PR tag when isPersonalRecord is undefined", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet()}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByText(/PR/)).toBeNull();
  });

  it("renders fractional kg without rounding (70.5, not 71)", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ performedWeightKg: 70.5, performedReps: 5 })}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("70.5")).toBeVisible();
    expect(screen.queryByText("71")).toBeNull();
  });

  it("renders fractional lbs conversion without rounding", () => {
    // 45 kg = 99.2075… lbs → must not become "99"
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ performedWeightKg: 45, performedReps: 5 })}
        units="lbs"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    const primary = screen.getByText(/^99(\.\d+)?$/);
    expect(primary.textContent).toContain(".");
  });

  it("calls onClick when the row is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet()}
        units="kg"
        isTopBlock={false}
        onClick={spy}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("SetRow — empty state", () => {
  it("renders the dim set number", () => {
    render(
      <SetRow
        setNumber={3}
        loggedSet={undefined}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("3")).toBeVisible();
  });

  it("shows 'Tap to log · last {last}' when lastHint is provided", () => {
    render(
      <SetRow
        setNumber={3}
        loggedSet={undefined}
        units="kg"
        isTopBlock={false}
        lastHint="85×9"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/Tap to log · last 85×9/)).toBeVisible();
  });
});

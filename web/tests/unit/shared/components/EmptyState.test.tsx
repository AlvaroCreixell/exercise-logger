import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the heading and body", () => {
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout from the Today tab."
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Active Workout" }),
    ).toBeVisible();
    expect(screen.getByText("Start a workout from the Today tab.")).toBeVisible();
  });

  it("renders the icon", () => {
    const { container } = render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
      />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders an action button when provided and fires onClick", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
        action={{ label: "Go to Today", onClick: spy }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Go to Today" });
    await user.click(btn);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("omits the action when not provided", () => {
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No Active Workout"
        body="Start a workout."
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders heading at the specified level when headingLevel is provided", () => {
    render(
      <EmptyState
        icon={Dumbbell}
        heading="No History Yet"
        body="Log a workout to see it here."
        headingLevel="h2"
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "No History Yet" }),
    ).toBeVisible();
  });
});

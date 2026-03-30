import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RestTimer from "@/components/RestTimer";
import { useTimerStore } from "@/stores/timer-store";

describe("RestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimerStore.getState().dismiss();
  });

  afterEach(() => {
    useTimerStore.getState().dismiss();
    vi.useRealTimers();
  });

  it("renders nothing when timer is not running", () => {
    const { container } = render(<RestTimer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders countdown when timer is running", () => {
    useTimerStore.getState().start(90);
    render(<RestTimer />);
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("dismiss button stops the timer", async () => {
    vi.useRealTimers();
    useTimerStore.setState({ isRunning: true, secondsRemaining: 90, baseDuration: 90, intervalId: null });
    const user = userEvent.setup();
    render(<RestTimer />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(useTimerStore.getState().isRunning).toBe(false);
    vi.useFakeTimers();
  });

  it("add 30s button extends the countdown", async () => {
    vi.useRealTimers();
    useTimerStore.setState({ isRunning: true, secondsRemaining: 60, baseDuration: 60, intervalId: null });
    const user = userEvent.setup();
    render(<RestTimer />);

    await user.click(screen.getByRole("button", { name: /add 30/i }));

    expect(useTimerStore.getState().secondsRemaining).toBe(90);
    vi.useFakeTimers();
  });

  it("shows destructive color when 10 seconds or less remain", () => {
    useTimerStore.getState().start(8);
    render(<RestTimer />);
    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("bg-destructive");
  });
});

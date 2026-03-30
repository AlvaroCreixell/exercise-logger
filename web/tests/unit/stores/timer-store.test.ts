import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTimerStore } from "@/stores/timer-store";

describe("timer-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the store between tests
    useTimerStore.getState().dismiss();
  });

  afterEach(() => {
    useTimerStore.getState().dismiss();
    vi.useRealTimers();
  });

  it("starts a countdown with the given duration", () => {
    useTimerStore.getState().start(90);
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.secondsRemaining).toBe(90);
    expect(state.baseDuration).toBe(90);
  });

  it("decrements every second", () => {
    useTimerStore.getState().start(5);

    vi.advanceTimersByTime(1000);
    expect(useTimerStore.getState().secondsRemaining).toBe(4);

    vi.advanceTimersByTime(1000);
    expect(useTimerStore.getState().secondsRemaining).toBe(3);
  });

  it("stops and resets when countdown reaches zero", () => {
    useTimerStore.getState().start(3);

    vi.advanceTimersByTime(3000);

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.secondsRemaining).toBe(0);
  });

  it("dismiss stops the timer", () => {
    useTimerStore.getState().start(60);
    useTimerStore.getState().dismiss();

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.secondsRemaining).toBe(0);
  });

  it("addThirty extends the countdown by 30 seconds", () => {
    useTimerStore.getState().start(60);

    vi.advanceTimersByTime(10_000); // 50 remaining

    useTimerStore.getState().addThirty();
    expect(useTimerStore.getState().secondsRemaining).toBe(80);
  });

  it("addThirty does nothing when timer is not running", () => {
    useTimerStore.getState().addThirty();
    expect(useTimerStore.getState().secondsRemaining).toBe(0);
  });

  it("restart resets to baseDuration", () => {
    useTimerStore.getState().start(90);
    vi.advanceTimersByTime(30_000); // 60 remaining

    useTimerStore.getState().restart();
    expect(useTimerStore.getState().secondsRemaining).toBe(90);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });

  it("starting a new timer cancels the previous one", () => {
    useTimerStore.getState().start(90);
    useTimerStore.getState().start(60);

    const state = useTimerStore.getState();
    expect(state.secondsRemaining).toBe(60);
    expect(state.baseDuration).toBe(60);
  });
});

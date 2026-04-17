import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { act } from "react";
import { SetSlot } from "@/features/workout/SetSlot";
import type { LoggedSet } from "@/domain/types";

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls1",
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "bench-press",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex: 0,
    tag: null,
    performedWeightKg: 80,
    performedReps: 8,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T20:00:00.000Z",
    updatedAt: "2026-04-16T20:00:00.000Z",
    ...overrides,
  };
}

describe("SetSlot — flash on log", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not flash on initial mount with pre-existing logged set", () => {
    render(
      <SetSlot setIndex={0} loggedSet={makeLoggedSet()} units="kg" onClick={() => {}} />
    );
    expect(screen.getByTestId("set-slot").className).not.toMatch(/flash-logged/);
  });

  it("flashes when loggedSet transitions from undefined to defined", () => {
    const { rerender } = render(
      <SetSlot setIndex={0} loggedSet={undefined} units="kg" onClick={() => {}} />
    );
    rerender(
      <SetSlot setIndex={0} loggedSet={makeLoggedSet()} units="kg" onClick={() => {}} />
    );
    expect(screen.getByTestId("set-slot").className).toMatch(/flash-logged/);
  });

  it("flashes when updatedAt changes (edit case)", () => {
    const initial = makeLoggedSet({ updatedAt: "2026-04-16T20:00:00.000Z" });
    const edited = makeLoggedSet({ updatedAt: "2026-04-16T20:05:00.000Z" });
    const { rerender } = render(
      <SetSlot setIndex={0} loggedSet={initial} units="kg" onClick={() => {}} />
    );
    rerender(
      <SetSlot setIndex={0} loggedSet={edited} units="kg" onClick={() => {}} />
    );
    expect(screen.getByTestId("set-slot").className).toMatch(/flash-logged/);
  });

  it("removes flash class after 600ms", () => {
    const { rerender } = render(
      <SetSlot setIndex={0} loggedSet={undefined} units="kg" onClick={() => {}} />
    );
    rerender(
      <SetSlot setIndex={0} loggedSet={makeLoggedSet()} units="kg" onClick={() => {}} />
    );
    expect(screen.getByTestId("set-slot").className).toMatch(/flash-logged/);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByTestId("set-slot").className).not.toMatch(/flash-logged/);
  });
});

describe("SetSlot — value typography", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders logged value with text-value-sm utility", () => {
    render(
      <SetSlot setIndex={0} loggedSet={makeLoggedSet()} units="kg" onClick={() => {}} />
    );
    const slot = screen.getByTestId("set-slot");
    const valueSpan = slot.querySelector("span");
    expect(valueSpan).not.toBeNull();
    expect(valueSpan!.className).toMatch(/text-value-sm/);
  });

  it("unlogged slot shows set number in muted text, not heading font", () => {
    render(
      <SetSlot setIndex={0} loggedSet={undefined} units="kg" onClick={() => {}} />
    );
    const slot = screen.getByTestId("set-slot");
    const numberSpan = slot.querySelector("span");
    expect(numberSpan).not.toBeNull();
    expect(numberSpan!.className ?? "").not.toMatch(/text-value/);
  });
});

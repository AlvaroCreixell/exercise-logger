import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { act } from "react";
import { SessionProgress } from "@/features/workout/SessionProgress";

afterEach(cleanup);

describe("SessionProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders N of M set count and elapsed minutes", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={18}
        loggedSets={6}
        totalExercises={6}
      />
    );
    expect(screen.getByText("6")).toBeVisible();
    expect(screen.getByText(/\/ 18/)).toBeVisible();
    expect(screen.getByText(/30 min/)).toBeVisible();
  });

  it("renders percentage progress bar width", () => {
    const { container } = render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={3}
        totalExercises={3}
      />
    );
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("30%");
  });

  it("clamps progress width at 100% when loggedSets exceeds totalSets", () => {
    const { container } = render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={15}
        totalExercises={3}
      />
    );
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement | null;
    expect(bar!.style.width).toBe("100%");
  });

  it("shows 0 / 0 gracefully when totalSets is 0", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={0}
        loggedSets={0}
        totalExercises={0}
      />
    );
    expect(screen.getByText("0")).toBeVisible();
  });

  it("updates elapsed minutes on interval tick", () => {
    render(
      <SessionProgress
        startedAt="2026-04-17T12:00:00Z"
        totalSets={10}
        loggedSets={0}
        totalExercises={3}
      />
    );
    expect(screen.getByText(/30 min/)).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/31 min/)).toBeVisible();
  });
});

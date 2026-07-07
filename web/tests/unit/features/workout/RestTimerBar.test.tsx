import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestTimerBar } from "@/features/workout/RestTimerBar";
import type { ActiveRestTimer } from "@/features/workout/lib/rest-timer";

afterEach(cleanup);

function makeTimer(overrides: Partial<ActiveRestTimer> = {}): ActiveRestTimer {
  return {
    status: "running",
    kind: "single",
    durationSec: 90,
    startedAtMs: 0,
    label: "Rest — Barbell Bench Press",
    roundOrdinal: null,
    loggedSetId: null,
    ...overrides,
  };
}

interface RenderOpts {
  timer?: ActiveRestTimer;
  remainingSec?: number;
  onSkip?: ReturnType<typeof vi.fn>;
  onAddSeconds?: ReturnType<typeof vi.fn>;
}

function renderBar(opts: RenderOpts = {}) {
  return render(
    <RestTimerBar
      timer={opts.timer ?? makeTimer()}
      remainingSec={opts.remainingSec ?? 90}
      onSkip={opts.onSkip ?? vi.fn()}
      onAddSeconds={opts.onAddSeconds ?? vi.fn()}
    />,
  );
}

describe("RestTimerBar — running state", () => {
  it("renders the label and the remaining time as m:ss", () => {
    renderBar({ remainingSec: 90 });
    expect(screen.getByText("Rest — Barbell Bench Press")).toBeVisible();
    expect(screen.getByText("1:30")).toBeVisible();
  });

  it("renders remaining time with tabular numerals", () => {
    renderBar({ remainingSec: 65 });
    expect(screen.getByText("1:05")).toHaveClass("tabular-nums");
  });

  it("clamps a negative remainingSec to 0:00", () => {
    renderBar({ remainingSec: -3 });
    expect(screen.getByText("0:00")).toBeVisible();
  });

  it("renders a progress treatment proportional to remaining time", () => {
    const { container } = renderBar({ remainingSec: 45 }); // half of 90
    const bar = container.querySelector("[data-rest-progress]") as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe("50%");
  });

  it("calls onSkip when Skip is tapped", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    renderBar({ onSkip });
    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onAddSeconds(30) when +30s is tapped", async () => {
    const user = userEvent.setup();
    const onAddSeconds = vi.fn();
    renderBar({ onAddSeconds });
    await user.click(screen.getByRole("button", { name: /add 30 seconds/i }));
    expect(onAddSeconds).toHaveBeenCalledWith(30);
  });

  it("does not put the live countdown in an aria-live region", () => {
    const { container } = renderBar({ remainingSec: 90 });
    expect(container.querySelectorAll("[aria-live]").length).toBe(0);
  });
});

describe("RestTimerBar — next-target line", () => {
  it("shows the next primed target while running", () => {
    render(
      <RestTimerBar
        timer={makeTimer()}
        remainingSec={72}
        nextLabel="52.5 kg × 8"
        onSkip={vi.fn()}
        onAddSeconds={vi.fn()}
      />,
    );
    expect(screen.getByText(/next:/)).toBeVisible();
    expect(screen.getByText(/52\.5 kg × 8/)).toBeVisible();
  });

  it("shows the next target in the done state too", () => {
    render(
      <RestTimerBar
        timer={makeTimer({ status: "done" })}
        remainingSec={0}
        nextLabel="12 reps"
        onSkip={vi.fn()}
        onAddSeconds={vi.fn()}
      />,
    );
    expect(screen.getByText(/rest complete/i)).toBeVisible();
    expect(screen.getByText(/12 reps/)).toBeVisible();
  });

  it("omits the line when nextLabel is null", () => {
    renderBar({ remainingSec: 30 });
    expect(screen.queryByText(/next:/)).toBeNull();
  });
});

describe("RestTimerBar — done state", () => {
  it("renders 'Rest complete' inside a polite live region", () => {
    renderBar({ timer: makeTimer({ status: "done" }), remainingSec: 0 });
    const doneText = screen.getByText(/rest complete/i);
    expect(doneText).toBeVisible();
    expect(doneText.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("hides the countdown and the +30s control", () => {
    renderBar({ timer: makeTimer({ status: "done" }), remainingSec: 0 });
    expect(screen.queryByText("0:00")).toBeNull();
    expect(screen.queryByRole("button", { name: /add 30 seconds/i })).toBeNull();
  });

  it("calls onSkip when Dismiss is tapped", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    renderBar({ timer: makeTimer({ status: "done" }), remainingSec: 0, onSkip });
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

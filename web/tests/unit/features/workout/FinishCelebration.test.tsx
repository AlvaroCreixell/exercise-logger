import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinishCelebration } from "@/features/workout/FinishCelebration";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("FinishCelebration", () => {
  const baseStats = { sets: 18, volumeKg: 4250, durationMin: 52 };

  it("renders nothing when open=false", () => {
    render(
      <FinishCelebration
        open={false}
        stats={baseStats}
        units="kg"
        onDismiss={() => {}}
      />
    );
    expect(screen.queryByText(/Well done/i)).toBeNull();
  });

  it("renders headline, subtitle, and three stat cells when open", () => {
    render(
      <FinishCelebration
        open={true}
        stats={baseStats}
        units="kg"
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText(/Well done/i)).toBeVisible();
    expect(screen.getByText(/Another session in the log/i)).toBeVisible();
    expect(screen.getByText(/^18$/)).toBeVisible();
    // Volume format depends on formatVolume — match "4,250 kg" or "4250 kg"
    expect(screen.getByText(/4,?250\s*kg/i)).toBeVisible();
    expect(screen.getByText(/^52m$/)).toBeVisible();
    expect(screen.getByText(/sets/i)).toBeVisible();
    expect(screen.getByText(/volume/i)).toBeVisible();
    expect(screen.getByText(/time/i)).toBeVisible();
  });

  it("shows an em-dash when durationMin is null", () => {
    render(
      <FinishCelebration
        open={true}
        stats={{ sets: 18, volumeKg: 4250, durationMin: null }}
        units="kg"
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText(/—/)).toBeVisible();
  });

  it("calls onDismiss after 1800ms", () => {
    const onDismiss = vi.fn();
    render(
      <FinishCelebration
        open={true}
        stats={baseStats}
        units="kg"
        onDismiss={onDismiss}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1799);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss immediately when the user taps", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <FinishCelebration
        open={true}
        stats={baseStats}
        units="kg"
        onDismiss={onDismiss}
      />
    );
    await user.click(screen.getByRole("button", { name: /dismiss celebration/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the auto-dismiss timer if unmounted before it fires", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <FinishCelebration
        open={true}
        stats={baseStats}
        units="kg"
        onDismiss={onDismiss}
      />
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

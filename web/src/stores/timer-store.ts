import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimerState {
  /** Whether the timer is currently running. */
  isRunning: boolean;
  /** Seconds remaining in the countdown. */
  secondsRemaining: number;
  /** The base duration for this timer instance, in seconds. */
  baseDuration: number;
  /** The interval ID for the countdown, or null when stopped. */
  intervalId: ReturnType<typeof setInterval> | null;

  // Actions
  /** Start a new countdown from the given duration in seconds. */
  start: (durationSec: number) => void;
  /** Dismiss (stop and hide) the timer. */
  dismiss: () => void;
  /** Add 30 seconds to the current countdown. */
  addThirty: () => void;
  /** Restart the timer from the base duration. */
  restart: () => void;
}

// ---------------------------------------------------------------------------
// Vibrate helper
// ---------------------------------------------------------------------------

function vibrate(): void {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Fail silently if vibration is unsupported
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerState>((set, get) => ({
  isRunning: false,
  secondsRemaining: 0,
  baseDuration: 0,
  intervalId: null,

  start: (durationSec: number) => {
    // Clear any existing timer
    const existing = get().intervalId;
    if (existing !== null) {
      clearInterval(existing);
    }

    const id = setInterval(() => {
      const current = get().secondsRemaining;
      if (current <= 1) {
        // Timer complete
        clearInterval(get().intervalId!);
        vibrate();
        set({ isRunning: false, secondsRemaining: 0, intervalId: null });
      } else {
        set({ secondsRemaining: current - 1 });
      }
    }, 1000);

    set({
      isRunning: true,
      secondsRemaining: durationSec,
      baseDuration: durationSec,
      intervalId: id,
    });
  },

  dismiss: () => {
    const id = get().intervalId;
    if (id !== null) {
      clearInterval(id);
    }
    set({ isRunning: false, secondsRemaining: 0, intervalId: null });
  },

  addThirty: () => {
    if (get().isRunning) {
      set((state) => ({ secondsRemaining: state.secondsRemaining + 30 }));
    }
  },

  restart: () => {
    const base = get().baseDuration;
    if (base > 0) {
      get().start(base);
    }
  },
}));

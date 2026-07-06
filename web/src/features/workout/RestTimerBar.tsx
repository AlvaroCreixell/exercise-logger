import { Button } from "@/shared/ui/button";
import { formatRestClock, type ActiveRestTimer } from "./lib/rest-timer";

interface RestTimerBarProps {
  timer: ActiveRestTimer;
  /** Derived by the parent from the shared render tick; may be negative. */
  remainingSec: number;
  /** Clears the timer (Skip while running, Dismiss when done). */
  onSkip: () => void;
  onAddSeconds: (seconds: number) => void;
}

/**
 * Compact rest countdown bar rendered between SessionProgress and the
 * exercise list. No modal, no overlay — only the countdown text and the
 * progress fill change second to second, so the layout stays stable.
 *
 * A11y: the ticking countdown is intentionally NOT in a live region; only the
 * done-state "Rest complete" announces politely.
 */
export function RestTimerBar({
  timer,
  remainingSec,
  onSkip,
  onAddSeconds,
}: RestTimerBarProps) {
  if (timer.status === "done") {
    return (
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-accent-cli-soft px-3 py-1.5">
          <p aria-live="polite" className="text-eyebrow text-accent-cli-bright">
            Rest complete
          </p>
          <Button variant="ghost" size="xs" onClick={onSkip}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  const clampedSec = Math.max(0, remainingSec);
  const pct =
    timer.durationSec > 0
      ? Math.max(0, Math.min(100, (clampedSec / timer.durationSec) * 100))
      : 0;

  return (
    <div className="px-5 pb-3">
      <div className="rounded-[var(--radius-card)] border border-line bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-eyebrow text-accent-cli-bright">
            {timer.label}
          </p>
          <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
            {formatRestClock(clampedSec)}
          </span>
          <Button
            variant="outline"
            size="xs"
            aria-label="Add 30 seconds"
            onClick={() => onAddSeconds(30)}
          >
            +30s
          </Button>
          <Button variant="ghost" size="xs" onClick={onSkip}>
            Skip
          </Button>
        </div>
        <div className="relative mt-1.5 h-1 overflow-hidden rounded-[2px] bg-line-soft">
          <div
            data-rest-progress
            className="absolute inset-y-0 left-0 bg-accent-cli transition-all duration-[var(--dur-base)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

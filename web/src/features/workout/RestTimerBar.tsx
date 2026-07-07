import { Button } from "@/shared/ui/button";
import { formatRestClock, type ActiveRestTimer } from "./lib/rest-timer";

interface RestTimerBarProps {
  timer: ActiveRestTimer;
  /** Derived by the parent from the shared render tick; may be negative. */
  remainingSec: number;
  /**
   * The next primed target (or exercise name) — the "what's next" glance
   * anchor during rest (spec §4.3). Null hides the line.
   */
  nextLabel?: string | null;
  /** Clears the timer (Skip while running, Dismiss when done). */
  onSkip: () => void;
  onAddSeconds: (seconds: number) => void;
}

/**
 * Compact rest countdown bar docked directly above the WorkoutFooter — the
 * thumb zone — so Skip/+30s are reachable one-handed (spec §4.3; they used to
 * sit at the top of the screen). Controls keep a ≥44 px hit area.
 *
 * A11y: the ticking countdown is intentionally NOT in a live region; only the
 * done-state "Rest complete" announces politely.
 */
export function RestTimerBar({
  timer,
  remainingSec,
  nextLabel,
  onSkip,
  onAddSeconds,
}: RestTimerBarProps) {
  if (timer.status === "done") {
    return (
      <div className="px-5 pb-2">
        <div className="rounded-[var(--radius-card)] bg-accent-cli-soft px-3 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-eyebrow text-accent-cli-bright">
              Rest complete
            </p>
            <Button variant="ghost" size="xs" className="min-h-11" onClick={onSkip}>
              Dismiss
            </Button>
          </div>
          {nextLabel && (
            <p className="pb-1 text-base font-semibold text-foreground tabular-nums">
              <span className="text-ink-3 font-normal">next:</span> {nextLabel}
            </p>
          )}
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
    <div className="px-5 pb-2">
      <div className="rounded-[var(--radius-card)] border border-line bg-card px-3 py-1.5">
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
            className="min-h-11 px-3"
            aria-label="Add 30 seconds"
            onClick={() => onAddSeconds(30)}
          >
            +30s
          </Button>
          <Button variant="ghost" size="xs" className="min-h-11 px-3" onClick={onSkip}>
            Skip
          </Button>
        </div>
        {nextLabel && (
          <p className="text-base font-semibold text-foreground tabular-nums">
            <span className="text-ink-3 font-normal">next:</span> {nextLabel}
          </p>
        )}
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

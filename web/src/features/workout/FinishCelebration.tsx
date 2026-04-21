import { useEffect } from "react";
import type { UnitSystem } from "@/domain/enums";
import { formatVolume } from "@/features/history/lib/sessionStats";
import { Sparkle } from "@/shared/icons";

interface FinishCelebrationStats {
  sets: number;
  volumeKg: number;
  durationMin: number | null;
}

interface FinishCelebrationProps {
  open: boolean;
  stats: FinishCelebrationStats;
  units: UnitSystem;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Defaults to 1800 per the handoff prototype. */
  autoDismissMs?: number;
}

const AUTO_DISMISS_MS_DEFAULT = 1800;

export function FinishCelebration({
  open,
  stats,
  units,
  onDismiss,
  autoDismissMs = AUTO_DISMISS_MS_DEFAULT,
}: FinishCelebrationProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [open, onDismiss, autoDismissMs]);

  if (!open) return null;

  const cells: Array<{ v: string; l: string }> = [
    { v: String(stats.sets), l: "Sets" },
    { v: formatVolume(stats.volumeKg, units), l: "Volume" },
    { v: stats.durationMin != null ? `${stats.durationMin}m` : "—", l: "Time" },
  ];

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss celebration"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-sage p-8 text-background animate-[fadeIn_var(--dur-fadeIn)_var(--ease-handoff)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-background/40"
    >
      <Sparkle size={28} aria-hidden />
      <h2 className="text-hero-serif text-center text-[2.4rem] leading-none">
        Well done.
      </h2>
      <p className="text-sm opacity-85">Another session in the log.</p>
      <div className="mt-4 flex items-baseline gap-7 animate-[popIn_var(--dur-popIn)_var(--ease-handoff)]">
        {cells.map((c) => (
          <div key={c.l} className="flex flex-col items-center gap-1">
            <span className="text-hero-serif text-[2rem] leading-none tabular-nums">
              {c.v}
            </span>
            <span className="text-eyebrow opacity-85">{c.l}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

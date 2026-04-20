import { Close } from "@/shared/icons";

interface SessionHeaderProps {
  dayId: string;
  dayLabel: string;
  elapsedSec: number;
  onClose: () => void;
}

function formatElapsed(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}:${rem.toString().padStart(2, "0")}`;
}

export function SessionHeader({
  dayId,
  dayLabel,
  elapsedSec,
  onClose,
}: SessionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-background">
      <div className="flex items-start gap-3 px-5 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow text-sage-deep tabular-nums">
            Day {dayId.toUpperCase()} · {formatElapsed(elapsedSec)} elapsed
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground truncate">
            {dayLabel}
          </h1>
        </div>
        <button
          type="button"
          aria-label="Close workout"
          onClick={onClose}
          className="shrink-0 -mr-1 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] text-ink-3 hover:bg-sage-soft/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <Close size={18} />
        </button>
      </div>
    </div>
  );
}

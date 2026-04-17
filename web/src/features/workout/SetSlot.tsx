import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface SetSlotProps {
  setIndex: number;
  loggedSet: LoggedSet | undefined;
  units: UnitSystem;
  onClick: () => void;
  /** When true, unlogged slots render as inert, non-interactive elements */
  disabled?: boolean;
}

export function SetSlot({
  setIndex,
  loggedSet,
  units,
  onClick,
  disabled = false,
}: SetSlotProps) {
  const [flashing, setFlashing] = useState(false);
  const prevUpdatedAtRef = useRef<string | undefined>(loggedSet?.updatedAt);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const current = loggedSet?.updatedAt;
    const prev = prevUpdatedAtRef.current;

    // Skip initial mount — don't flash pre-existing state.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevUpdatedAtRef.current = current;
      return;
    }

    // Flash only when updatedAt actually changed and we now have a logged set.
    // The setState calls here are intentional: the effect synchronizes a
    // transient CSS animation class with a prop-driven event (new/edited set).
    // Suppressing react-hooks/set-state-in-effect for this pattern.
    if (current && current !== prev) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFlashing(true);
      const t = window.setTimeout(() => setFlashing(false), 600);
      /* eslint-enable react-hooks/set-state-in-effect */
      prevUpdatedAtRef.current = current;
      return () => window.clearTimeout(t);
    }

    prevUpdatedAtRef.current = current;
  }, [loggedSet?.updatedAt]);

  const isLogged = loggedSet !== undefined;

  function formatValue(ls: LoggedSet): string {
    if (ls.performedWeightKg != null && ls.performedReps != null) {
      const w = toDisplayWeight(ls.performedWeightKg, units);
      return `${w}x${ls.performedReps}`;
    }
    if (ls.performedReps != null) return `${ls.performedReps}r`;
    if (ls.performedDurationSec != null) return `${ls.performedDurationSec}s`;
    if (ls.performedDistanceM != null) return `${ls.performedDistanceM}m`;
    return "\u2713";
  }

  if (disabled && !isLogged) {
    return (
      <div
        data-testid="set-slot"
        aria-label={`Set ${setIndex + 1}: empty`}
        className="min-h-[56px] min-w-[5rem] rounded-sm px-2.5 flex items-center justify-center gap-1.5 shrink-0 border border-border/50 text-muted-foreground/40"
      >
        <span className="text-sm font-medium tabular-nums">{setIndex + 1}</span>
      </div>
    );
  }

  return (
    <button
      data-testid="set-slot"
      onClick={onClick}
      aria-label={isLogged ? `Set ${setIndex + 1}: ${formatValue(loggedSet)}` : `Set ${setIndex + 1}: empty`}
      className={`min-h-[56px] min-w-[5rem] rounded-sm px-2.5 flex items-center justify-center gap-1.5 transition-colors duration-[var(--dur-base)] shrink-0 focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 active:scale-95 hover:border-cta ${
        isLogged
          ? "border-l-2 border-l-success/60 border border-success bg-success text-white"
          : "border-[1.5px] border-border-strong text-muted-foreground hover:bg-muted/50"
      }${flashing ? " flash-logged" : ""}`}
    >
      {isLogged ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          <span className="text-value-sm">{formatValue(loggedSet)}</span>
        </>
      ) : (
        <span className="text-sm font-medium tabular-nums">{setIndex + 1}</span>
      )}
    </button>
  );
}

import type { KeypadKey } from "@/features/workout/lib/keypad-reducer";
import { Backspace as BackspaceIcon } from "@/shared/icons";

interface KeypadProps {
  onKey: (key: KeypadKey) => void;
  disabled?: boolean;
}

const ROWS: KeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
];

export function Keypad({ onKey, disabled = false }: KeypadProps) {
  return (
    <div
      role="group"
      aria-label="Numeric keypad"
      className="grid grid-cols-3 gap-2"
    >
      {ROWS.flat().map((key) => {
        const isBack = key === "back";
        const label = isBack ? "Backspace" : key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey(key)}
            aria-label={label}
            className="h-14 rounded-[var(--radius-pill)] bg-line-soft text-xl font-semibold tabular-nums text-foreground transition-colors hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isBack ? (
              <span className="inline-flex items-center justify-center">
                <BackspaceIcon size={20} aria-hidden="true" />
              </span>
            ) : (
              key
            )}
          </button>
        );
      })}
    </div>
  );
}

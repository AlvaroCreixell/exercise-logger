import type { UnitSystem } from "@/domain/enums";

interface UnitsToggleProps {
  value: UnitSystem;
  onChange: (next: UnitSystem) => void;
}

const OPTIONS: readonly UnitSystem[] = ["kg", "lbs"];

export function UnitsToggle({ value, onChange }: UnitsToggleProps) {
  return (
    <div
      role="group"
      aria-label="Units"
      className="inline-flex items-center rounded-[var(--radius-pill)] bg-card p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onChange(option);
            }}
            className={
              "inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 " +
              (selected
                ? "bg-primary text-primary-foreground"
                : "text-ink-3 hover:text-foreground")
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

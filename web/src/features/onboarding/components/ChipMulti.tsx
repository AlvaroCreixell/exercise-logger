import { cn } from "@/shared/lib/utils";
import type { ChipOption } from "./ChipRow";

export interface ChipMultiProps {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  exclusiveValue?: string;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40";
const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-accent-cli-soft";

export function ChipMulti({
  options,
  selected,
  onChange,
  exclusiveValue,
  ariaLabel,
}: ChipMultiProps) {
  const nextFor = (clicked: string): string[] => {
    const isExclusiveClicked =
      exclusiveValue !== undefined && clicked === exclusiveValue;

    if (isExclusiveClicked) {
      // Clicking the exclusive chip. If already selected, deselect;
      // otherwise replace all selections with just the exclusive.
      return selected.includes(clicked) ? [] : [clicked];
    }

    const exclusiveIsActive =
      exclusiveValue !== undefined && selected.includes(exclusiveValue);

    if (exclusiveIsActive) {
      // Clicking any non-exclusive while the exclusive is on: clear exclusive,
      // start a fresh non-exclusive selection.
      return [clicked];
    }

    // Plain toggle: add if absent, remove if present.
    return selected.includes(clicked)
      ? selected.filter((v) => v !== clicked)
      : [...selected, clicked];
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(nextFor(opt.value))}
            className={cn(chipBase, isSelected ? chipSelected : chipUnselected)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

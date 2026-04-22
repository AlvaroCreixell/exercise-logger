import { cn } from "@/shared/lib/utils";
import type { ChipOption } from "./ChipRow";

export interface ChipWithDescriptionProps {
  name: string;
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;
}

const cardBase =
  "flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-paper p-4 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";
const cardSelected = "bg-ink text-paper border-ink";
const titleCls = "text-sm font-medium";
const descSelected = "text-xs text-paper/75";
const descUnselected = "text-xs text-ink-2";

export function ChipWithDescription({
  name,
  options,
  selected,
  onSelect,
  autoAdvance = false,
  onAdvance,
  ariaLabel,
}: ChipWithDescriptionProps) {
  const handle = (value: string) => {
    onSelect(value);
    if (autoAdvance && onAdvance) {
      queueMicrotask(onAdvance);
    }
  };

  return (
    <fieldset
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 border-0 p-0"
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        const id = `${name}-${opt.value}`;
        return (
          <div key={opt.value}>
            <input
              type="radio"
              id={id}
              name={name}
              value={opt.value}
              checked={isSelected}
              // See ChipRow: onClick (fires on every click) rather than
              // onChange (fires only on value change). Re-clicking an
              // already-selected chip must still auto-advance.
              onChange={() => { /* see onClick */ }}
              onClick={() => handle(opt.value)}
              className="sr-only"
            />
            <label
              htmlFor={id}
              className={cn(cardBase, isSelected && cardSelected)}
            >
              <span className={titleCls}>{opt.label}</span>
              {opt.description && (
                <span className={isSelected ? descSelected : descUnselected}>
                  {opt.description}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

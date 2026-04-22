import { cn } from "@/shared/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChipRowProps {
  name: string;
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  autoAdvance?: boolean;
  onAdvance?: () => void;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";

const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft";

export function ChipRow({
  name,
  options,
  selected,
  onSelect,
  autoAdvance = false,
  onAdvance,
  ariaLabel,
}: ChipRowProps) {
  const handle = (value: string) => {
    onSelect(value);
    if (autoAdvance && onAdvance) {
      queueMicrotask(onAdvance);
    }
  };

  if (options.length <= 5) {
    return (
      <fieldset
        role="radiogroup"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-2 border-0 p-0"
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
                onChange={() => handle(opt.value)}
                className="sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  chipBase,
                  "cursor-pointer",
                  isSelected ? chipSelected : chipUnselected
                )}
              >
                {opt.label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => handle(opt.value)}
            className={cn(
              chipBase,
              isSelected ? chipSelected : chipUnselected
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

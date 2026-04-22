import { cn } from "@/shared/lib/utils";
import { Textarea } from "@/shared/ui/textarea";

export interface StepTextAreaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength: number;
  showCounterAt?: number;
  skipChipLabel?: string;
  onSkip?: () => void;
  skipped?: boolean;
  ariaLabel: string;
}

const chipBase =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40";
const chipSelected = "bg-ink text-paper";
const chipUnselected =
  "border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft";

export function StepTextArea({
  value,
  onChange,
  placeholder,
  maxLength,
  showCounterAt,
  skipChipLabel,
  onSkip,
  skipped = false,
  ariaLabel,
}: StepTextAreaProps) {
  const showCounter =
    showCounterAt !== undefined && value.length >= showCounterAt;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={skipped}
        className={cn(
          "min-h-24 rounded-[var(--radius-card)] border-[var(--line)] bg-paper",
          skipped && "opacity-50"
        )}
      />
      {showCounter && (
        <div className="self-end text-meta text-ink-3">
          {value.length} / {maxLength}
        </div>
      )}
      {skipChipLabel && onSkip && (
        <button
          type="button"
          aria-pressed={skipped}
          onClick={onSkip}
          className={cn(
            chipBase,
            "self-start",
            skipped ? chipSelected : chipUnselected
          )}
        >
          {skipChipLabel}
        </button>
      )}
    </div>
  );
}

interface PrToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

export function PrToggle({ value, onChange }: PrToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors aria-pressed:border-sage-deep aria-pressed:bg-sage-soft aria-pressed:text-sage-deep aria-[pressed=false]:border-line aria-[pressed=false]:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
    >
      {value ? "PR ✓" : "Mark PR"}
    </button>
  );
}

interface PrToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /**
   * When true (and the toggle is on), shows a quiet "auto" hint indicating
   * the PR state came from best-ever auto-detection, not a manual tap.
   */
  auto?: boolean;
}

export function PrToggle({ value, onChange, auto = false }: PrToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors aria-pressed:border-sage-deep aria-pressed:bg-sage-soft aria-pressed:text-sage-deep aria-[pressed=false]:border-line aria-[pressed=false]:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
    >
      {value ? "PR ✓" : "Mark PR"}
      {value && auto && (
        <span className="text-[10px] font-medium lowercase tracking-normal text-sage-deep/70">
          auto
        </span>
      )}
    </button>
  );
}

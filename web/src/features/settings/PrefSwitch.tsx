interface PrefSwitchProps {
  /** Accessible name for the switch (the row label repeats it visually). */
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Boolean preference switch in the terminal vocabulary: an `[on]`/`[off]`
 * bracket tag. Semantics live in role="switch" + aria-checked; the brackets
 * are decorative. Hit area ≥44 px (themed, not literal).
 */
export function PrefSwitch({ label, checked, onChange }: PrefSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "inline-flex min-h-11 min-w-14 items-center justify-center rounded-[var(--radius-pill)] px-3 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 " +
        (checked
          ? "text-accent-cli-bright"
          : "text-ink-3 hover:text-foreground")
      }
    >
      <span aria-hidden="true">[</span>
      {checked ? "on" : "off"}
      <span aria-hidden="true">]</span>
    </button>
  );
}

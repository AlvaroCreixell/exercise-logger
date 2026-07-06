import { Check } from "@/shared/icons";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { formatLoggedSetParts } from "@/shared/lib/formatLoggedSet";

interface SetRowProps {
  /** Continuous-across-blocks 1-based index shown in the empty-state row. */
  setNumber: number;
  /** The logged set record, or undefined when the row is empty. */
  loggedSet: LoggedSet | undefined;
  /** User's effective unit for the parent exercise. */
  units: UnitSystem;
  /** True when the parent block has `tag === "top"` — drives the TOP badge. */
  isTopBlock: boolean;
  /** Optional "Tap to log · last …" hint text for empty rows. */
  lastHint?: string;
  /**
   * Day-one fallback hint: the block's per-set prescription ("8–12 reps").
   * Rendered WITHOUT the "last" prefix — it's a target, not history. Only
   * used when `lastHint` is absent.
   */
  prescriptionHint?: string;
  /**
   * Primed quick-log state (guided logging, spec §3.2). When set on an empty
   * row, the row renders `❯ <target> [LOG]` and its tap LOGS the target;
   * the trailing ✎ button (onEditTap) opens the sheet instead.
   */
  primed?: {
    /** Display target, e.g. "52.5 kg × 8". */
    display: string;
    /** True renders the success ↑ treatment; false the repeat (info) tone. */
    isProgression: boolean;
    /** Disables the row while a quick-log save is in flight. */
    saving: boolean;
  };
  /** Triggered on click (primed rows: quick-log; otherwise opens SetLogSheet). */
  onClick: () => void;
  /** The primed row's ✎ affordance — opens the sheet for deviations. */
  onEditTap?: () => void;
}

export function SetRow({
  setNumber,
  loggedSet,
  units,
  isTopBlock,
  lastHint,
  prescriptionHint,
  primed,
  onClick,
  onEditTap,
}: SetRowProps) {
  const isLogged = loggedSet !== undefined;

  if (!isLogged && primed) {
    return (
      <div className="flex w-full items-stretch gap-1.5">
        <button
          type="button"
          onClick={onClick}
          disabled={primed.saving}
          data-primed-row
          aria-label={`Set ${setNumber}: log ${primed.display}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-set-empty)] border border-accent-cli/70 bg-accent-cli-soft/20 px-3 py-2.5 text-left transition-colors hover:border-accent-cli-bright hover:bg-accent-cli-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span aria-hidden="true" className="shrink-0 text-accent-cli select-none">
            ❯
          </span>
          <span
            className={`min-w-0 truncate text-value tabular-nums ${
              primed.isProgression ? "text-success font-semibold" : "text-info font-medium"
            }`}
          >
            {primed.display}
            {primed.isProgression && <span aria-hidden="true"> ↑</span>}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
            {isTopBlock && <span className="text-warm">TOP</span>}
            <span aria-hidden="true" className="text-accent-cli-bright">
              [LOG]
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onEditTap}
          aria-label={`Set ${setNumber}: adjust before logging`}
          className="flex w-11 shrink-0 items-center justify-center rounded-[var(--radius-set-empty)] border border-line text-ink-3 transition-colors hover:border-accent-cli hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
        >
          <span aria-hidden="true">✎</span>
        </button>
      </div>
    );
  }

  if (isLogged) {
    const parts = formatLoggedSetParts(loggedSet, units);
    const primary = parts?.primary ?? "✓";
    const unit = parts?.unit ?? null;
    const secondary = parts?.secondary ?? null;
    const tertiary = parts?.tertiary ?? null;
    const showTop = isTopBlock;
    const showPR = loggedSet.isPersonalRecord === true;

    const ariaSecondary = secondary ? ` × ${secondary}` : "";
    const ariaTertiary = tertiary ? ` and ${tertiary.value}${tertiary.unit}` : "";

    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Set ${setNumber}: ${primary}${unit ?? ""}${ariaSecondary}${ariaTertiary}`}
        className="flex w-full items-center gap-3 rounded-[var(--radius-set-logged)] bg-accent-cli-soft px-3 py-2.5 text-left transition-colors hover:bg-accent-cli-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-accent-cli-bright text-paper"
        >
          <Check size={14} />
        </span>
        <span className="flex items-baseline gap-1 text-foreground tabular-nums">
          <span className="text-value">{primary}</span>
          {unit && <span className="text-xs text-ink-3">{unit}</span>}
          {secondary && (
            <>
              <span className="text-xs text-ink-3">×</span>
              <span className="text-value">{secondary}</span>
            </>
          )}
          {tertiary && (
            <>
              <span className="text-xs text-ink-3">·</span>
              <span className="text-value">{tertiary.value}</span>
              <span className="text-xs text-ink-3">{tertiary.unit}</span>
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          {showTop && <span className="text-warm">TOP</span>}
          {showPR && <span className="text-accent-cli-bright">↑ PR</span>}
        </span>
      </button>
    );
  }

  const hintSuffix = lastHint
    ? ` · last ${lastHint}`
    : prescriptionHint
      ? ` · ${prescriptionHint}`
      : "";
  const ariaHint = lastHint
    ? `, last ${lastHint}`
    : prescriptionHint
      ? `, ${prescriptionHint}`
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Set ${setNumber}: empty, tap to log${ariaHint}`}
      className="flex w-full items-center gap-3 rounded-[var(--radius-set-empty)] border border-line bg-background px-3 py-2.5 text-left transition-colors hover:border-accent-cli hover:bg-accent-cli-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-line text-ink-3 text-xs font-semibold tabular-nums"
      >
        {setNumber}
      </span>
      <span className="text-sm text-ink-3">
        Tap to log{hintSuffix}
      </span>
    </button>
  );
}

import { Check } from "@/shared/icons";
import { cn } from "@/shared/lib/utils";
import type { SupersetRailItem } from "./lib/superset-rhythm";

interface SupersetRoundRailProps {
  items: SupersetRailItem[];
}

/**
 * Compact round-context rail for a superset group: A1 B1 A2 B2…
 * Pure context — chips are not interactive; logging still happens on the
 * exercise cards' set rows.
 */
export function SupersetRoundRail({ items }: SupersetRoundRailProps) {
  if (items.length === 0) return null;

  return (
    <ol aria-label="Superset rounds" className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        const isComplete = item.status === "complete";
        const isCurrent = item.status === "current";
        return (
          <li key={item.key} className="flex">
            <span
              data-status={item.status}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={
                isComplete
                  ? `${item.label} complete`
                  : isCurrent
                    ? `${item.label} up next`
                    : undefined
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                isComplete && "bg-accent-cli-bright text-paper",
                isCurrent && "border border-accent-cli-bright bg-accent-cli-soft text-accent-cli-bright",
                !isComplete && !isCurrent && "border border-line bg-background text-ink-3",
              )}
            >
              {isComplete && <Check size={10} aria-hidden="true" />}
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

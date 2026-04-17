import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type StatSize = "sm" | "md" | "lg" | "hero";

interface StatProps {
  value: React.ReactNode;
  label?: React.ReactNode;
  size?: StatSize;
  className?: string;
  /** Extra text under the label (e.g. "peak 140kg"). Small + muted. */
  hint?: React.ReactNode;
}

const VALUE_CLASS: Record<StatSize, string> = {
  sm: "text-value-sm",
  md: "text-value",
  lg: "text-value",
  hero: "text-hero",
};

const LABEL_CLASS: Record<StatSize, string> = {
  sm: "text-xs text-muted-foreground",
  md: "text-xs text-muted-foreground uppercase tracking-widest",
  lg: "text-sm text-muted-foreground uppercase tracking-widest",
  hero: "text-sm text-muted-foreground uppercase tracking-widest",
};

export function Stat({ value, label, size = "md", className, hint }: StatProps) {
  const isInline = size === "sm";
  return (
    <div
      className={cn(
        "flex",
        isInline ? "flex-row items-baseline gap-1.5" : "flex-col gap-0.5",
        className,
      )}
    >
      <span className={VALUE_CLASS[size]}>{value}</span>
      {label != null && <span className={LABEL_CLASS[size]}>{label}</span>}
      {hint != null && (
        <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>
      )}
    </div>
  );
}

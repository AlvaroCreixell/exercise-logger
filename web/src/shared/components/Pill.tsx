import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  indicator?: boolean;
}

export function Pill({
  selected = false,
  indicator = false,
  className,
  children,
  type = "button",
  ...rest
}: PillProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "relative inline-flex items-center gap-1 shrink-0 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium transition-colors duration-[var(--dur-base)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/30",
        selected
          ? "bg-sage-soft text-sage-deep z-10"
          : "border border-line bg-background text-foreground hover:bg-sage-soft/50",
        className,
      )}
    >
      <span>{children}</span>
      {indicator && !selected && (
        <span
          data-indicator="true"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cta"
        />
      )}
    </button>
  );
}

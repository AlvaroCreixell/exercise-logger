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
        "relative shrink-0 px-4 py-2 text-sm font-semibold transition-colors duration-[var(--dur-base)]",
        "border-[1.5px] border-border-strong focus-visible:ring-2 focus-visible:ring-cta/30 outline-none",
        selected
          ? "bg-primary text-primary-foreground z-10"
          : "bg-background text-muted-foreground hover:text-foreground",
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

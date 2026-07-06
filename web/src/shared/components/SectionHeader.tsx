import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  variant?: "default" | "serif";
}

export function SectionHeader({ children, className, id, variant = "default" }: SectionHeaderProps) {
  return (
    <p
      id={id}
      className={cn(
        variant === "serif"
          ? "text-title-serif text-foreground"
          : "text-eyebrow text-ink-3",
        className,
      )}
    >
      {variant === "default" && (
        <span aria-hidden="true" className="mr-1.5 text-accent-cli/70 select-none">
          #
        </span>
      )}
      {children}
    </p>
  );
}

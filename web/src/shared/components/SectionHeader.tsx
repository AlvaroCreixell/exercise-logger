import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function SectionHeader({ children, className, id }: SectionHeaderProps) {
  return (
    <p
      id={id}
      className={cn(
        "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

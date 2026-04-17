import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type BlockStripeVariant = "top" | "amrap" | "default";

interface BlockStripeProps {
  label: string;
  variant: BlockStripeVariant;
  children: React.ReactNode;
}

const STRIPE_COLOR: Record<BlockStripeVariant, string> = {
  top: "bg-warning",
  amrap: "bg-info",
  default: "bg-muted-foreground/30",
};

const CHIP_COLOR: Record<BlockStripeVariant, string> = {
  top: "bg-warning-soft text-warning",
  amrap: "bg-info-soft text-info",
  default: "bg-muted text-muted-foreground",
};

export function BlockStripe({ label, variant, children }: BlockStripeProps) {
  return (
    <div className="relative pl-3.5">
      <span
        data-stripe
        className={cn(
          "absolute left-0 top-0 bottom-0 w-0.5",
          STRIPE_COLOR[variant],
        )}
      />
      <div className="space-y-1.5">
        {label && (
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-widest",
              CHIP_COLOR[variant],
            )}
          >
            {label}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

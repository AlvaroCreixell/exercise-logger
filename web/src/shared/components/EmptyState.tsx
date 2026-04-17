import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center bg-muted/60 text-muted-foreground">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight font-heading">
        {heading}
      </h1>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {body}
      </p>
      {action && (
        <Button variant="outline" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

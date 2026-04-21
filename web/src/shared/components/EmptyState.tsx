import type { ComponentType } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/** Structural icon-component type — accepts any component that renders an
 *  `<svg>` and takes `className` and optional `strokeWidth`. Our custom
 *  `shared/icons/*` components all satisfy this. */
type IconComponent = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  /** Button variant. Defaults to "outline" (hairline) for existing empty-state CTAs. Pass "default" for filled primary per screenshots/2-workout.jpg (WorkoutScreen does this). */
  variant?: "default" | "outline";
}

interface EmptyStateProps {
  icon: IconComponent;
  heading: string;
  body: string;
  action?: EmptyStateAction;
  className?: string;
  headingLevel?: "h1" | "h2" | "h3";
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
  className,
  headingLevel = "h1",
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-sage-soft text-sage-deep">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <Heading className="text-title-serif">
        {heading}
      </Heading>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {body}
      </p>
      {action && (
        <Button variant={action.variant ?? "outline"} className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

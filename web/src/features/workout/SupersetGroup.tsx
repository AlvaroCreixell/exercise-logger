import { Children, type ReactNode } from "react";
import { SectionHeader } from "@/shared/components/SectionHeader";
import type { SessionExercise, LoggedSet } from "@/domain/types";
import { buildSupersetRail } from "./lib/superset-rhythm";
import { SupersetRoundRail } from "./SupersetRoundRail";

const SIDE_LABELS = ["A", "B"] as const;

interface SupersetGroupProps {
  children: ReactNode;
  /**
   * The paired exercises, in render order (A first). Optional: without it
   * (and setsByExercise) the group renders the legacy children-only layout.
   */
  exercises?: [SessionExercise, SessionExercise];
  /** Logged sets grouped by sessionExerciseId (WorkoutScreen's map). */
  setsByExercise?: Map<string, LoggedSet[]>;
}

export function SupersetGroup({ children, exercises, setsByExercise }: SupersetGroupProps) {
  const hasRhythmData = exercises !== undefined && setsByExercise !== undefined;
  const railItems = hasRhythmData
    ? buildSupersetRail({ exercises, setsByExercise })
    : null;

  return (
    <div className="border-l-2 border-accent-cli-bright pl-4 space-y-3">
      <div className="space-y-0.5">
        <SectionHeader className="!text-accent-cli-bright">Superset</SectionHeader>
        {hasRhythmData && (
          <p className="text-meta">Alternate A then B before resting</p>
        )}
      </div>
      {railItems && <SupersetRoundRail items={railItems} />}
      {hasRhythmData
        ? Children.toArray(children).map((child, i) => {
            const side = SIDE_LABELS[i];
            if (!side) return child;
            return (
              <div key={side} data-superset-side={side} className="space-y-1">
                <p className="text-eyebrow text-accent-cli-bright">{side}</p>
                {child}
              </div>
            );
          })
        : children}
    </div>
  );
}

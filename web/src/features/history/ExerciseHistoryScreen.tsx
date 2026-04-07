import { useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useExerciseHistoryGroups } from "@/shared/hooks/useExerciseHistoryGroups";
import { useSettings } from "@/shared/hooks/useSettings";
import { toDisplayWeight } from "@/domain/unit-conversion";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export default function ExerciseHistoryScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const groups = useExerciseHistoryGroups(exerciseId);
  const settings = useSettings();
  const navigate = useNavigate();
  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId]
  );

  if (!settings) return null;

  const units = settings.units;
  const name = exercise?.name ?? exerciseId ?? "Exercise";

  return (
    <div className="p-4 space-y-4 pb-8">
      <button
        onClick={() => navigate(-1)}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </button>

      <h1 className="text-xl font-bold">{name}</h1>

      {groups === null || groups === undefined ? null : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No history for this exercise.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.session.id} className="space-y-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                {new Date(group.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" — "}
                {group.session.dayLabelSnapshot}
                {" — "}
                {group.session.routineNameSnapshot}
              </p>
              {group.entries.map((entry, ei) => (
                <div key={ei} className="pl-2">
                  {entry.instanceLabel && (
                    <p className="text-xs text-muted-foreground italic">
                      {entry.instanceLabel}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {entry.sets.map((ls, si) => {
                      let text = "";
                      if (ls.performedWeightKg != null && ls.performedReps != null) {
                        const w = toDisplayWeight(
                          ls.performedWeightKg,
                          entry.effectiveEquipment,
                          units
                        );
                        text = `${w}${units} x ${ls.performedReps}`;
                      } else if (ls.performedReps != null) {
                        text = `${ls.performedReps} reps`;
                      } else if (ls.performedDurationSec != null) {
                        text = `${ls.performedDurationSec}s`;
                      } else if (ls.performedDistanceM != null) {
                        text = `${ls.performedDistanceM}m`;
                      }
                      const tagLabel = ls.tag === "top" ? "Top" : ls.tag === "amrap" ? "AMRAP" : null;
                      return (
                        <span
                          key={si}
                          className="text-sm tabular-nums font-medium"
                        >
                          {tagLabel && (
                            <span className="text-[10px] text-muted-foreground font-normal mr-0.5">
                              {tagLabel}
                            </span>
                          )}
                          {text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

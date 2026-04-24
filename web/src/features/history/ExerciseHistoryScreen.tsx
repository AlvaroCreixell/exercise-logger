import { useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useExerciseHistoryGroups } from "@/shared/hooks/useExerciseHistoryGroups";
import { useSettings } from "@/shared/hooks/useSettings";
import { formatLoggedSet } from "@/shared/lib/formatLoggedSet";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import type { LoggedSet } from "@/domain/types";
import type { SetTag } from "@/domain/enums";
import { Back, Dumbbell } from "@/shared/icons";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/components/EmptyState";
import { SectionHeader } from "@/shared/components/SectionHeader";

/** Group a sorted list of logged sets into blocks by blockIndex. */
function groupSetsByBlock(sets: LoggedSet[]): Array<{ tag: SetTag | null; sets: LoggedSet[] }> {
  const blocks: Array<{ tag: SetTag | null; sets: LoggedSet[] }> = [];
  let current: { tag: SetTag | null; sets: LoggedSet[] } | null = null;
  for (const ls of sets) {
    if (!current || ls.blockIndex !== current.sets[0]!.blockIndex) {
      current = { tag: ls.tag, sets: [ls] };
      blocks.push(current);
    } else {
      current.sets.push(ls);
    }
  }
  return blocks;
}

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
    <div className="p-5 space-y-4 pb-8">
      <button
        onClick={() => navigate(-1)}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <Back size={16} className="mr-1" />Back
      </button>

      <h1 className="text-2xl font-extrabold tracking-tight font-heading">{name}</h1>

      {groups === null || groups === undefined ? null : groups.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          heading="No History Yet"
          body="Log a workout with this exercise to see it here."
          className="py-12"
          headingLevel="h2"
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.session.id} className="space-y-1 border-t-2 border-border-strong pt-2">
              <SectionHeader className="tabular-nums">
                {new Date(group.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" — "}
                {group.session.dayLabelSnapshot}
                {" — "}
                {group.session.routineNameSnapshot}
              </SectionHeader>
              {group.entries.map((entry, ei) => {
                const entryUnits = getEffectiveUnit(entry.unitOverride, units);
                return (
                  <div key={ei} className="pl-2">
                    {entry.instanceLabel && (
                      <p className="text-xs text-muted-foreground italic">
                        {entry.instanceLabel}
                      </p>
                    )}
                    <div className="space-y-0">
                      {groupSetsByBlock(entry.sets).map((block, bi) => {
                        const tagLabel = block.tag === "top" ? "Top" : block.tag === "amrap" ? "AMRAP" : null;
                        return (
                          <div key={bi} className={bi > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
                            {tagLabel && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                {tagLabel}
                              </span>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {block.sets.map((ls, si) => (
                                <span key={si} className="text-sm tabular-nums font-medium">
                                  {formatLoggedSet(ls, entryUnits, { fallback: "" })}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

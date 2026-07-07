import type { Routine, Exercise, SetBlock, RoutineExerciseEntry } from "@/domain/types";
import { Card } from "@/shared/ui/card";

function formatBlock(b: SetBlock): string {
  const target =
    b.exactValue !== undefined
      ? `${b.exactValue}`
      : `${b.minValue}–${b.maxValue}`;
  const unit = b.targetKind === "duration" ? "s" : b.targetKind === "distance" ? "m" : "";
  const tag = b.tag === "top" ? " · top" : b.tag === "amrap" ? " · AMRAP" : "";
  return `${b.count} × ${target}${unit}${tag}`;
}

function ExerciseLine({
  item,
  exercisesById,
}: {
  item: Pick<RoutineExerciseEntry, "exerciseId" | "instanceLabel" | "setBlocks">;
  exercisesById: Map<string, Exercise>;
}) {
  const name = exercisesById.get(item.exerciseId)?.name ?? item.exerciseId;
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm">
        {name}
        {item.instanceLabel && (
          <span className="ml-1 text-meta">({item.instanceLabel})</span>
        )}
      </span>
      <span className="flex flex-col items-end font-mono text-xs text-ink-2">
        {item.setBlocks.map((b, i) => (
          <span key={i}>{formatBlock(b)}</span>
        ))}
      </span>
    </div>
  );
}

export function RoutinePreview({
  routine,
  exercisesById,
}: {
  routine: Routine;
  exercisesById: Map<string, Exercise>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-hero-serif text-ink">{routine.name}</h2>
      <p className="text-meta">
        Rest {routine.restDefaultSec}s · recovery {routine.restSupersetSec}s
      </p>
      {routine.dayOrder.map((dayId) => {
        const day = routine.days[dayId];
        if (!day) return null;
        return (
          <Card key={dayId} className="px-4 py-3">
            <p className="text-eyebrow text-ink-2">
              DAY {dayId} — {day.label}
            </p>
            <div className="mt-1 divide-y divide-line-soft">
              {day.entries.map((entry) =>
                entry.kind === "exercise" ? (
                  <ExerciseLine
                    key={entry.entryId}
                    item={entry}
                    exercisesById={exercisesById}
                  />
                ) : (
                  <div key={entry.groupId} className="py-1">
                    <p className="text-meta">superset</p>
                    <div className="border-l-2 border-line pl-2">
                      {entry.items.map((item) => (
                        <ExerciseLine
                          key={item.entryId}
                          item={item}
                          exercisesById={exercisesById}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        );
      })}
      {routine.cardio && (
        <Card className="px-4 py-3">
          <p className="text-eyebrow text-ink-2">CARDIO</p>
          <p className="mt-1 text-sm text-ink-2">{routine.cardio.notes}</p>
          {routine.cardio.options.map((opt) => (
            <p key={opt.name} className="text-sm">
              {opt.name} — <span className="text-ink-2">{opt.detail}</span>
            </p>
          ))}
        </Card>
      )}
      {routine.notes.length > 0 && (
        <Card className="px-4 py-3">
          <p className="text-eyebrow text-ink-2">NOTES</p>
          {routine.notes.map((n, i) => (
            <p key={i} className="mt-1 text-sm text-ink-2">
              {n}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}

import { Card, CardContent } from "@/shared/ui/card";
import { summarizeRoutineDay } from "@/features/today/lib/routineSummary";
import type { Exercise, Routine } from "@/domain/types";

export interface StarterRoutineSummaryProps {
  routine: Routine | null | undefined;
  exercisesById: Map<string, Exercise>;
}

export function StarterRoutineSummary({
  routine,
  exercisesById,
}: StarterRoutineSummaryProps) {
  if (routine === null) return null;
  if (routine === undefined) {
    return (
      <Card className="py-0" aria-label="Loading starter routine">
        <CardContent className="space-y-2 px-5 py-4">
          <p className="text-eyebrow text-ink-3">ACTIVE ROUTINE</p>
          <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--line-soft)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--line-soft)]" />
        </CardContent>
      </Card>
    );
  }

  const nextDayId = routine.nextDayId ?? routine.dayOrder[0]!;
  const day = routine.days[nextDayId];
  const summary = day
    ? summarizeRoutineDay(day, exercisesById)
    : { exerciseCount: 0, setCount: 0, firstExerciseName: null, dayLabel: nextDayId };

  const exerciseLabel = `${summary.exerciseCount} ${
    summary.exerciseCount === 1 ? "exercise" : "exercises"
  }`;
  const setLabel = `${summary.setCount} ${
    summary.setCount === 1 ? "set" : "sets"
  }`;
  const firstUpLabel = summary.firstExerciseName
    ? `first up: ${summary.firstExerciseName}`
    : null;
  const meta = [exerciseLabel, setLabel, firstUpLabel].filter(Boolean).join(" · ");

  return (
    <Card className="py-0">
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-eyebrow text-ink-3">ACTIVE ROUTINE</p>
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {routine.name}
        </h2>
        <p className="text-meta">{summary.dayLabel}</p>
        <p className="text-meta">{meta}</p>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

interface TodayHeroCardProps {
  dayLabelEyebrow: string;
  dayTitle: string;
  muscleGroups: string[];
  exerciseCount: number;
  setCount: number;
  firstExerciseName: string | null;
  ctaLabel: string;
  onCtaClick: () => void;
  ctaDisabled: boolean;
  resumeMeta: { elapsedMin: number } | null;
}

export function TodayHeroCard({
  dayLabelEyebrow,
  dayTitle,
  muscleGroups,
  exerciseCount,
  setCount,
  firstExerciseName,
  ctaLabel,
  onCtaClick,
  ctaDisabled,
  resumeMeta,
}: TodayHeroCardProps) {
  const exerciseCopy = [
    `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${setCount} ${setCount === 1 ? "set" : "sets"}`,
    firstExerciseName ? `first up: ${firstExerciseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardContent className="space-y-4 px-5 pb-5 pt-4">
        <p className="text-eyebrow text-ink-3">{dayLabelEyebrow}</p>

        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {dayTitle}
        </h2>

        {muscleGroups.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Muscle groups">
            {muscleGroups.map((group) => (
              <li
                key={group}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {group}
              </li>
            ))}
          </ul>
        )}

        <p className="text-meta">{exerciseCopy}</p>

        <Button
          variant="default"
          size="lg"
          className="w-full"
          onClick={onCtaClick}
          disabled={ctaDisabled}
        >
          {ctaLabel}
        </Button>

        {resumeMeta && (
          <p className="flex items-center justify-center gap-1.5 text-meta">
            <span
              aria-hidden="true"
              className="inline-block size-1.5 rounded-full bg-sage"
            />
            {resumeMeta.elapsedMin} min elapsed
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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
  /** Optional. Renders a small "Active routine: X" caption above the day eyebrow. */
  routineName?: string;
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
  routineName,
}: TodayHeroCardProps) {
  const exerciseCopy = [
    `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${setCount} ${setCount === 1 ? "set" : "sets"}`,
    firstExerciseName ? `first up: ${firstExerciseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="py-0">
      <CardContent className="space-y-4 px-5 pb-5 pt-4">
        {routineName && (
          <p className="text-meta text-ink-3">
            Active routine: {routineName}
          </p>
        )}
        <p className="text-eyebrow text-ink-3">{dayLabelEyebrow}</p>

        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {dayTitle}
        </h2>

        {muscleGroups.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Muscle groups">
            {muscleGroups.map((group) => (
              <li
                key={group}
                className="inline-flex items-center text-eyebrow text-ink-2"
              >
                <span aria-hidden="true" className="text-ink-3 select-none">[</span>
                {group}
                <span aria-hidden="true" className="text-ink-3 select-none">]</span>
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
      </CardContent>
    </Card>
  );
}

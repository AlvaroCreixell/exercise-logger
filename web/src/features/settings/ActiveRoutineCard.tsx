import { Card, CardContent } from "@/shared/ui/card";
import type { Routine } from "@/domain/types";

interface ActiveRoutineCardProps {
  routine: Routine | null | undefined;
}

export function ActiveRoutineCard({ routine }: ActiveRoutineCardProps) {
  if (!routine) return null;

  const dayCount = routine.dayOrder.length;
  const dayPart = `${dayCount} ${dayCount === 1 ? "day" : "days"}`;
  const dayList = routine.dayOrder.join(" · ");
  const meta = `${dayPart} · ${dayList} · rest ${routine.restDefaultSec}s`;

  return (
    <Card className="py-0">
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-eyebrow text-ink-3">Active Routine</p>
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {routine.name}
        </h2>
        <p className="text-meta tabular-nums">{meta}</p>
      </CardContent>
    </Card>
  );
}

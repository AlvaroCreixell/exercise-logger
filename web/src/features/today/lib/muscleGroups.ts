import type { Exercise, RoutineDay } from "@/domain/types";

const MAX_CHIPS = 6;

export function deriveDayMuscleGroups(
  day: RoutineDay,
  exercisesById: Map<string, Exercise>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const visit = (exerciseId: string) => {
    const ex = exercisesById.get(exerciseId);
    if (!ex) return;
    for (const group of ex.muscleGroups) {
      if (seen.has(group)) continue;
      seen.add(group);
      ordered.push(group);
      if (ordered.length === MAX_CHIPS) return;
    }
  };

  for (const entry of day.entries) {
    if (ordered.length === MAX_CHIPS) break;
    if (entry.kind === "exercise") {
      visit(entry.exerciseId);
    } else {
      for (const item of entry.items) {
        visit(item.exerciseId);
        if (ordered.length === MAX_CHIPS) break;
      }
    }
  }

  return ordered;
}

import type { Exercise, RoutineEntry } from "@/domain/types";

export interface MuscleGroupCount {
  group: string;
  count: number;
}

/**
 * Canonical sort order for tiebreaks and for placing well-known groups
 * ahead of unusual ones. Groups not in this list sort alphabetically
 * after all listed groups. "Other" is forced to the very end.
 */
const CANONICAL_ORDER: readonly string[] = [
  "Legs",
  "Back",
  "Chest",
  "Shoulders",
  "Arms",
  "Core",
  "Full Body",
  "Cardio",
];

const OTHER = "Other";

function canonicalRank(group: string): number {
  if (group === OTHER) return Number.MAX_SAFE_INTEGER;
  const idx = CANONICAL_ORDER.indexOf(group);
  return idx === -1 ? CANONICAL_ORDER.length : idx;
}

/**
 * Count each entry once against its exercise's PRIMARY (first) muscle group.
 * Supersets are flattened into their items. Missing catalog entries and
 * exercises with an empty `muscleGroups` array bucket into "Other".
 *
 * Output is ordered by count descending, with ties broken by `CANONICAL_ORDER`;
 * unknown groups sort alphabetically after the canonical list; "Other" is last.
 */
export function summarizeMuscleGroups(
  entries: RoutineEntry[],
  exercisesById: Map<string, Exercise>,
): MuscleGroupCount[] {
  const flatEntries = entries.flatMap((e) => (e.kind === "exercise" ? [e] : e.items));
  const counts = new Map<string, number>();

  for (const item of flatEntries) {
    const exercise = exercisesById.get(item.exerciseId);
    const primary = exercise?.muscleGroups[0] ?? OTHER;
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      const rankA = canonicalRank(a.group);
      const rankB = canonicalRank(b.group);
      if (rankA !== rankB) return rankA - rankB;
      return a.group.localeCompare(b.group);
    });
}

import type { BlockLastTime, BlockSuggestion, LastTimeSet } from "@/services/progression-service";
import type { UnitSystem, ExerciseEquipment } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

interface LastTimeDisplayProps {
  lastTime: BlockLastTime[];
  suggestions: BlockSuggestion[];
  units: UnitSystem;
  equipment: ExerciseEquipment;
}

function formatSet(s: LastTimeSet, units: UnitSystem, equipment: ExerciseEquipment): string {
  const parts: string[] = [];

  if (s.weightKg !== null) {
    const display = toDisplayWeight(s.weightKg, equipment, units);
    parts.push(`${display}${units}`);
  }

  if (s.reps !== null) {
    parts.push(`${s.reps} reps`);
  }

  if (s.durationSec !== null) {
    if (s.durationSec >= 60) {
      const mins = Math.floor(s.durationSec / 60);
      const secs = s.durationSec % 60;
      parts.push(secs > 0 ? `${mins}m ${secs}s` : `${mins}m`);
    } else {
      parts.push(`${s.durationSec}s`);
    }
  }

  if (s.distanceM !== null) {
    if (s.distanceM >= 1000) {
      parts.push(`${(s.distanceM / 1000).toFixed(1)}km`);
    } else {
      parts.push(`${s.distanceM}m`);
    }
  }

  return parts.join(" x ") || "-";
}

function formatSetsInline(
  sets: LastTimeSet[],
  units: UnitSystem,
  equipment: ExerciseEquipment
): string {
  // If all sets have the same weight, show "80kg x 12, 11, 10" format
  const allSameWeight =
    sets.length > 1 &&
    sets.every((s) => s.weightKg !== null && s.weightKg === sets[0]!.weightKg);

  if (allSameWeight && sets[0]!.weightKg !== null) {
    const display = toDisplayWeight(sets[0]!.weightKg!, equipment, units);
    const repsList = sets
      .map((s) => {
        if (s.reps !== null) return `${s.reps}`;
        if (s.durationSec !== null) return `${s.durationSec}s`;
        return "-";
      })
      .join(", ");
    return `${display}${units} x ${repsList}`;
  }

  return sets.map((s) => formatSet(s, units, equipment)).join(", ");
}

export default function LastTimeDisplay({
  lastTime,
  suggestions,
  units,
  equipment,
}: LastTimeDisplayProps) {
  if (lastTime.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No previous data</p>
    );
  }

  // Build a map of blockIndex -> suggestion for quick lookup
  const suggestionMap = new Map<number, BlockSuggestion>();
  for (const s of suggestions) {
    suggestionMap.set(s.blockIndex, s);
  }

  return (
    <div className="space-y-1">
      {lastTime.map((block, idx) => (
        <div key={idx} className="text-xs text-muted-foreground">
          {block.blockLabel && (
            <span className="font-medium text-foreground/70">
              {block.blockLabel}:{" "}
            </span>
          )}
          <span>{formatSetsInline(block.sets, units, equipment)}</span>
          {suggestionMap.has(idx) && (
            <span
              className={`ml-1 font-medium ${
                suggestionMap.get(idx)!.isProgression
                  ? "text-green-600 dark:text-green-400"
                  : "text-foreground/70"
              }`}
            >
              {suggestionMap.get(idx)!.isProgression ? " ↑" : ""}{" "}
              {toDisplayWeight(
                suggestionMap.get(idx)!.suggestedWeightKg,
                equipment,
                units
              )}
              {units} suggested
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

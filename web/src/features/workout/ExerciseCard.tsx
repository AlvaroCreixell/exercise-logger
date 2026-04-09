import type { SessionExercise, LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";
import { getBlockLabel } from "@/services/progression-service";
import { toDisplayWeight } from "@/domain/unit-conversion";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { SetSlot } from "./SetSlot";
import { ArrowUp, Repeat } from "lucide-react";
import type { SetBlock } from "@/domain/types";

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  historyData: ExerciseHistoryData | undefined;
  extraHistory: ExtraExerciseHistory | null | undefined;
  onSetTap: (blockIndex: number, setIndex: number) => void;
  /** Read-only mode for history view: show subdued unlogged slots */
  readOnly?: boolean;
  /** Hide the exercise name header (when rendered externally, e.g. as a link) */
  hideHeader?: boolean;
  /** Callback when unit toggle is tapped. Undefined = no toggle shown (history view). */
  onUnitToggle?: (newUnit: UnitSystem) => void;
}

function blockLabelVariant(label: string) {
  if (label === "Top") return "bg-warning-soft text-warning";
  if (label === "AMRAP") return "bg-info-soft text-info";
  return "bg-muted text-muted-foreground";
}

function formatLastTime(
  sets: Array<{ weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null }>,
  units: UnitSystem
): string {
  if (sets.length === 0) return "";
  const first = sets[0]!;
  if (first.weightKg != null) {
    const w = toDisplayWeight(first.weightKg, units);
    const allSameWeight = sets.every((s) => s.weightKg === first.weightKg);
    if (allSameWeight) {
      const reps = sets.map((s) => s.reps ?? "?").join(", ");
      return `${w}${units} x ${reps}`;
    }
    return sets.map((s) => {
      const sw = s.weightKg != null ? toDisplayWeight(s.weightKg, units) : "?";
      return `${sw}x${s.reps ?? "?"}`;
    }).join(", ");
  }
  if (first.reps != null) return sets.map((s) => `${s.reps ?? "?"}r`).join(", ");
  if (first.durationSec != null) return sets.map((s) => `${s.durationSec ?? "?"}s`).join(", ");
  return "";
}

function formatTarget(block: SetBlock): string {
  const value =
    block.exactValue != null
      ? `${block.exactValue}`
      : block.minValue != null && block.maxValue != null
      ? `${block.minValue}-${block.maxValue}`
      : "?";
  if (block.targetKind === "reps") return `${block.count} x ${value} reps`;
  if (block.targetKind === "duration") return `${block.count} x ${value}s`;
  if (block.targetKind === "distance") return `${block.count} x ${value}m`;
  return `${block.count} x ${value}`;
}

export function ExerciseCard({
  sessionExercise,
  loggedSets,
  units,
  historyData,
  extraHistory,
  onSetTap,
  readOnly = false,
  hideHeader = false,
  onUnitToggle,
}: ExerciseCardProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const isExtra = se.origin === "extra";

  // Build set lookup: [blockIndex][setIndex] -> LoggedSet
  const setLookup = new Map<string, LoggedSet>();
  for (const ls of loggedSets) {
    setLookup.set(`${ls.blockIndex}:${ls.setIndex}`, ls);
  }

  return (
    <Card className={readOnly ? "border-t border-border bg-transparent" : undefined}>
      <CardContent className={`${readOnly ? "px-0" : ""} py-3 space-y-3`}>
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide truncate">
              {se.exerciseNameSnapshot}
            </h3>
            {isExtra && (
              <Badge variant="secondary" className="shrink-0 text-[11px]">Extra</Badge>
            )}
            {onUnitToggle && (
              <button
                className="ml-auto shrink-0 border border-border-strong px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnitToggle(units === "kg" ? "lbs" : "kg");
                }}
              >
                {units}
              </button>
            )}
          </div>
        )}

        {se.notesSnapshot && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {se.notesSnapshot}
          </p>
        )}

        {/* Blocks */}
        {blocks.length > 0 ? (
          blocks.map((block, blockIndex) => {
            const label = getBlockLabel(block, blockIndex, blocks.length, blocks);
            const lastTime = historyData?.lastTime[blockIndex];
            const suggestion = historyData?.suggestions.find((s) => s.blockIndex === blockIndex);

            return (
              <div key={blockIndex} className="space-y-1.5">
                {/* Block label + target */}
                <div className="flex items-center gap-2 flex-wrap">
                  {label && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium ${blockLabelVariant(label)}`}>
                      {label}
                    </span>
                  )}
                  <span className="text-xs font-medium tabular-nums">
                    {formatTarget(block)}
                  </span>
                </div>

                {/* History + suggestion */}
                {(lastTime || suggestion) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {lastTime && lastTime.sets.length > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Last: {formatLastTime(lastTime.sets, units)}
                      </span>
                    )}
                    {suggestion && suggestion.isProgression && (
                      <span className="text-xs text-success tabular-nums font-medium inline-flex items-center gap-0.5">
                        <ArrowUp className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                    {suggestion && !suggestion.isProgression && (
                      <span className="text-xs text-info tabular-nums font-medium inline-flex items-center gap-0.5">
                        <Repeat className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                  </div>
                )}

                {/* Set slots */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {Array.from({ length: block.count }, (_, setIndex) => (
                    <SetSlot
                      key={setIndex}
                      setIndex={setIndex}
                      loggedSet={setLookup.get(`${blockIndex}:${setIndex}`)}
                      units={units}
                      onClick={() => onSetTap(blockIndex, setIndex)}
                      disabled={readOnly}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : isExtra && extraHistory ? (
          /* Extra exercise: show recent history as reference */
          <p className="text-xs text-muted-foreground tabular-nums">
            Recent: {formatLastTime(extraHistory.sets, units)}
          </p>
        ) : null}

        {/* Extra exercise: single unstructured slot row */}
        {isExtra && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {[...loggedSets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)).map((ls, i) => (
              <SetSlot
                key={ls.id}
                setIndex={i}
                loggedSet={ls}
                units={units}
                onClick={() => onSetTap(0, i)}
              />
            ))}
            {!readOnly && (
              <SetSlot
                setIndex={loggedSets.length}
                loggedSet={undefined}
                units={units}
                onClick={() => onSetTap(0, loggedSets.length)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

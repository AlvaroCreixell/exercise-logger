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
import { BlockStripe, type BlockStripeVariant } from "./BlockStripe";

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

function blockStripeVariant(label: string): BlockStripeVariant {
  if (label === "Top") return "top";
  if (label === "AMRAP") return "amrap";
  return "default";
}

function formatDurationShort(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem === 0 ? `${mins}min` : `${mins}min ${rem}s`;
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
  if (first.durationSec != null || first.distanceM != null) {
    return sets.map((s) => {
      const parts: string[] = [];
      if (s.durationSec != null) parts.push(formatDurationShort(s.durationSec));
      if (s.distanceM != null) parts.push(`${s.distanceM}m`);
      return parts.length ? parts.join(" ") : "?";
    }).join(", ");
  }
  return "";
}

function formatDurationTarget(block: SetBlock): string {
  if (block.exactValue != null) return formatDurationShort(block.exactValue);
  if (block.minValue != null && block.maxValue != null) {
    const min = block.minValue;
    const max = block.maxValue;
    const cleanMinutes = min >= 60 && max >= 60 && min % 60 === 0 && max % 60 === 0;
    return cleanMinutes ? `${min / 60}-${max / 60}min` : `${min}-${max}s`;
  }
  return "?";
}

function formatTarget(block: SetBlock): string {
  if (block.targetKind === "duration") {
    return `${block.count} x ${formatDurationTarget(block)}`;
  }
  const value =
    block.exactValue != null
      ? `${block.exactValue}`
      : block.minValue != null && block.maxValue != null
      ? `${block.minValue}-${block.maxValue}`
      : "?";
  if (block.targetKind === "reps") return `${block.count} x ${value} reps`;
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
    <Card className={readOnly ? "border-t border-border bg-transparent shadow-none rounded-none" : undefined}>
      <CardContent className={`${readOnly ? "px-0" : ""} py-4 space-y-3`}>
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-heading font-bold tracking-tight truncate">
              {se.exerciseNameSnapshot}
            </h3>
            {isExtra && (
              <Badge variant="secondary" className="shrink-0 text-[11px]">Extra</Badge>
            )}
            {onUnitToggle && (
              <button
                className="ml-auto shrink-0 rounded-sm border border-border-strong px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors duration-[var(--dur-base)] hover:bg-muted/50 hover:border-cta focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30"
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

            const variant = blockStripeVariant(label ?? "");
            return (
              <BlockStripe
                key={blockIndex}
                label={label ?? ""}
                variant={variant}
              >
                {/* Target line (quieter) */}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTarget(block)}
                </p>

                {/* Combined history + suggestion on one line */}
                {(lastTime || suggestion) && (
                  <p className="text-xs tabular-nums">
                    {lastTime && lastTime.sets.length > 0 && (
                      <span className="text-muted-foreground">
                        Last {formatLastTime(lastTime.sets, units)}
                      </span>
                    )}
                    {lastTime && lastTime.sets.length > 0 && suggestion && (
                      <span className="text-muted-foreground"> · </span>
                    )}
                    {suggestion && suggestion.isProgression && (
                      <span className="text-success font-semibold inline-flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                    {suggestion && !suggestion.isProgression && (
                      <span className="text-info font-medium inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                      </span>
                    )}
                  </p>
                )}

                {/* Set slot row */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pt-1">
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
              </BlockStripe>
            );
          })
        ) : isExtra && extraHistory ? (
          /* Extra exercise: show recent history as reference */
          <p className="text-xs text-muted-foreground tabular-nums">
            Recent: {formatLastTime(extraHistory.sets, units)}
          </p>
        ) : null}

        {/* Extra exercise: single unstructured slot row.
            Display index `i` is used only for the visible "1, 2, 3" label;
            the stored `ls.setIndex` is what the click handler must use so
            taps after a middle-set delete still address the right row. */}
        {isExtra && (() => {
          const sorted = [...loggedSets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
          const nextSetIndex = loggedSets.reduce((max, ls) => Math.max(max, ls.setIndex + 1), 0);
          return (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {sorted.map((ls, i) => (
                <SetSlot
                  key={ls.id}
                  setIndex={i}
                  loggedSet={ls}
                  units={units}
                  onClick={() => onSetTap(0, ls.setIndex)}
                />
              ))}
              {!readOnly && (
                <SetSlot
                  setIndex={sorted.length}
                  loggedSet={undefined}
                  units={units}
                  onClick={() => onSetTap(0, nextSetIndex)}
                />
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

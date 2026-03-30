import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { UnitSystem, SetTag, TargetKind } from "@/domain/enums";
import type {
  ExerciseHistoryData,
  BlockSuggestion,
  ExtraExerciseHistory,
} from "@/services/progression-service";
import SetSlot from "@/components/SetSlot";
import SetLogForm from "@/components/SetLogForm";
import LastTimeDisplay from "@/components/LastTimeDisplay";
import type { SetLogInput } from "@/services/set-service";

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  historyData: ExerciseHistoryData | undefined;
  extraHistory: ExtraExerciseHistory | null | undefined;
  units: UnitSystem;
  isActiveSession: boolean;
  onLogSet: (
    sessionExerciseId: string,
    blockIndex: number,
    setIndex: number,
    input: SetLogInput
  ) => void;
  onDeleteSet: (loggedSetId: string) => void;
}

function formatPrescription(block: SetBlock): string {
  let target: string;
  if (block.exactValue !== undefined) {
    if (block.targetKind === "reps") target = `${block.exactValue}`;
    else if (block.targetKind === "duration") target = `${block.exactValue}s`;
    else target = `${block.exactValue}m`;
  } else {
    if (block.targetKind === "reps") target = `${block.minValue}-${block.maxValue}`;
    else if (block.targetKind === "duration") target = `${block.minValue}-${block.maxValue}s`;
    else target = `${block.minValue}-${block.maxValue}m`;
  }

  const tag = block.tag === "top" ? " (top)" : block.tag === "amrap" ? " (AMRAP)" : "";
  return `${block.count} x ${target}${tag}`;
}

function getTagLabel(tag?: SetTag): string | undefined {
  if (tag === "top") return "Top";
  if (tag === "amrap") return "AMRAP";
  return undefined;
}

export default function ExerciseCard({
  sessionExercise,
  loggedSets,
  historyData,
  extraHistory,
  units,
  isActiveSession,
  onLogSet,
  onDeleteSet,
}: ExerciseCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{
    blockIndex: number;
    setIndex: number;
    prefill: SetLogInput | null;
    label: string;
    tag?: string;
    targetKind?: TargetKind;
  } | null>(null);

  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const isExtra = se.origin === "extra";

  // Build logged set lookup: key = `${blockIndex}-${setIndex}`
  const loggedSetMap = new Map<string, LoggedSet>();
  for (const ls of loggedSets) {
    loggedSetMap.set(`${ls.blockIndex}-${ls.setIndex}`, ls);
  }

  // Build suggestion lookup
  const suggestionMap = new Map<number, BlockSuggestion>();
  if (historyData) {
    for (const s of historyData.suggestions) {
      suggestionMap.set(s.blockIndex, s);
    }
  }

  const handleSlotTap = useCallback(
    (blockIndex: number, setIndex: number) => {
      const key = `${blockIndex}-${setIndex}`;
      const existing = loggedSetMap.get(key);

      let prefill: SetLogInput | null = null;

      if (existing) {
        // Pre-fill from current value
        prefill = {
          performedWeightKg: existing.performedWeightKg,
          performedReps: existing.performedReps,
          performedDurationSec: existing.performedDurationSec,
          performedDistanceM: existing.performedDistanceM,
        };
      } else {
        // ERRATA P6-C: Pre-fill from suggestion (weight) AND last-time (reps/duration/distance)
        const suggestion = suggestionMap.get(blockIndex);
        const lastTimeBlock = historyData?.lastTime[blockIndex];

        prefill = {
          performedWeightKg: suggestion?.suggestedWeightKg ?? null,
          performedReps: null,
          performedDurationSec: null,
          performedDistanceM: null,
        };

        // Pre-fill reps/duration/distance from last-time data
        if (lastTimeBlock && lastTimeBlock.sets.length > 0) {
          // Use the set at the same index if available, else the last set
          const ltSet = lastTimeBlock.sets[setIndex] ?? lastTimeBlock.sets[lastTimeBlock.sets.length - 1];
          if (ltSet) {
            if (prefill.performedReps === null && ltSet.reps !== null) {
              prefill.performedReps = ltSet.reps;
            }
            if (prefill.performedDurationSec === null && ltSet.durationSec !== null) {
              prefill.performedDurationSec = ltSet.durationSec;
            }
            if (prefill.performedDistanceM === null && ltSet.distanceM !== null) {
              prefill.performedDistanceM = ltSet.distanceM;
            }
            // Also fill weight from last-time if no suggestion
            if (prefill.performedWeightKg === null && ltSet.weightKg !== null) {
              prefill.performedWeightKg = ltSet.weightKg;
            }
          }
        }

        // If all values are null, set prefill to null to indicate no data
        if (
          prefill.performedWeightKg === null &&
          prefill.performedReps === null &&
          prefill.performedDurationSec === null &&
          prefill.performedDistanceM === null
        ) {
          prefill = null;
        }
      }

      const block = blocks[blockIndex];
      const tagLabel = block ? getTagLabel(block.tag) : undefined;

      setActiveSlot({
        blockIndex,
        setIndex,
        prefill,
        label: `${se.exerciseNameSnapshot} - Set ${setIndex + 1}`,
        tag: tagLabel,
        // ERRATA S2: Pass targetKind from block for field selection
        targetKind: block?.targetKind,
      });
      setFormOpen(true);
    },
    [loggedSetMap, blocks, se.exerciseNameSnapshot, suggestionMap, historyData]
  );

  const handleLogSubmit = useCallback(
    (input: SetLogInput) => {
      if (activeSlot) {
        onLogSet(se.id, activeSlot.blockIndex, activeSlot.setIndex, input);
      }
    },
    [activeSlot, onLogSet, se.id]
  );

  const handleDelete = useCallback(() => {
    if (activeSlot) {
      const key = `${activeSlot.blockIndex}-${activeSlot.setIndex}`;
      const existing = loggedSetMap.get(key);
      if (existing) {
        onDeleteSet(existing.id);
        setFormOpen(false);
      }
    }
  }, [activeSlot, loggedSetMap, onDeleteSet]);

  // For extras: count logged sets to enable adding more
  const extraSetCount = isExtra
    ? loggedSets.filter((ls) => ls.blockIndex === 0).length
    : 0;

  return (
    <>
      <Card className="mb-3">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-semibold">
              {se.exerciseNameSnapshot}
              {se.instanceLabel && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({se.instanceLabel})
                </span>
              )}
            </CardTitle>
            {isExtra && (
              <Badge variant="outline" className="text-xs">
                Extra
              </Badge>
            )}
          </div>
          {se.notesSnapshot && (
            <p className="text-xs text-muted-foreground">{se.notesSnapshot}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          {/* Routine exercises: render per block */}
          {!isExtra &&
            blocks.map((block, blockIndex) => (
              <div key={blockIndex} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {formatPrescription(block)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: block.count }, (_, setIndex) => (
                    <SetSlot
                      key={`${blockIndex}-${setIndex}`}
                      setIndex={setIndex}
                      loggedSet={loggedSetMap.get(`${blockIndex}-${setIndex}`) ?? null}
                      targetKind={block.targetKind}
                      units={units}
                      equipment={se.effectiveEquipment}
                      onTap={() => {
                        if (isActiveSession) {
                          handleSlotTap(blockIndex, setIndex);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}

          {/* Extra exercises: free-form set slots */}
          {isExtra && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: extraSetCount }, (_, setIndex) => (
                  <SetSlot
                    key={`0-${setIndex}`}
                    setIndex={setIndex}
                    loggedSet={loggedSetMap.get(`0-${setIndex}`) ?? null}
                    targetKind="reps"
                    units={units}
                    equipment={se.effectiveEquipment}
                    onTap={() => {
                      if (isActiveSession) {
                        handleSlotTap(0, setIndex);
                      }
                    }}
                  />
                ))}
                {/* "+" slot to add a new set */}
                {isActiveSession && (
                  <button
                    onClick={() => handleSlotTap(0, extraSetCount)}
                    className="inline-flex min-w-[4rem] items-center justify-center rounded-md border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                    aria-label="Add set"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )}

          {/* History / last-time display */}
          {!isExtra && historyData && (
            <LastTimeDisplay
              lastTime={historyData.lastTime}
              suggestions={historyData.suggestions}
              units={units}
              equipment={se.effectiveEquipment}
            />
          )}

          {/* Extra exercise history */}
          {isExtra && extraHistory && extraHistory.sets.length > 0 && (
            <div className="text-xs text-muted-foreground italic">
              Last:{" "}
              {extraHistory.sets
                .map((s) => {
                  const parts: string[] = [];
                  if (s.weightKg !== null) parts.push(`${s.weightKg}kg`);
                  if (s.reps !== null) parts.push(`${s.reps}`);
                  if (s.durationSec !== null) parts.push(`${s.durationSec}s`);
                  return parts.join("x") || "-";
                })
                .join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set log form dialog - ERRATA S2: pass targetKind */}
      <SetLogForm
        open={formOpen}
        onOpenChange={setFormOpen}
        effectiveType={se.effectiveType}
        effectiveEquipment={se.effectiveEquipment}
        units={units}
        prefill={activeSlot?.prefill ?? null}
        label={activeSlot?.label ?? ""}
        tag={activeSlot?.tag}
        targetKind={activeSlot?.targetKind}
        onSubmit={handleLogSubmit}
        onDelete={
          activeSlot &&
          loggedSetMap.has(`${activeSlot.blockIndex}-${activeSlot.setIndex}`)
            ? handleDelete
            : undefined
        }
      />
    </>
  );
}

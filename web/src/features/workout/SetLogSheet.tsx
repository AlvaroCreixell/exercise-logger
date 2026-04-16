import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { BlockSuggestion, BlockLastTime } from "@/services/progression-service";
import { getBlockLabel } from "@/services/progression-service";
import { toDisplayWeight, toCanonicalKg } from "@/domain/unit-conversion";
import { toast } from "sonner";
import { isSetInputEmpty } from "./set-log-validation";

interface SetLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  suggestion: BlockSuggestion | undefined;
  lastTime: BlockLastTime | undefined;
  /**
   * All sets already logged for this (sessionExercise, blockIndex) in the
   * current session, including the one being edited. Used for in-session
   * weight carryover on new slots. Default [] = carryover disabled.
   */
  blockSetsInSession?: LoggedSet[];
  units: UnitSystem;
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function SetLogSheet({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  suggestion,
  lastTime,
  blockSetsInSession = [],
  units,
  onSave,
  onDelete,
}: SetLogSheetProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const block: SetBlock | undefined = blocks[blockIndex];
  // For extras (no set blocks), infer targetKind from exercise type
  const defaultTargetKind =
    se.effectiveType === "isometric" ? "duration" as const
    : se.effectiveType === "cardio" ? "duration" as const
    : "reps" as const;
  const targetKind = block?.targetKind ?? defaultTargetKind;
  const showWeight = se.effectiveType === "weight";
  const isBodyweight = se.effectiveType === "bodyweight";
  const isCardioExtra = se.effectiveType === "cardio" && !block;
  // Cardio extras show duration in minutes; everything else in seconds
  const durationInMinutes = isCardioExtra;

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [showWeightForBodyweight, setShowWeightForBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill on open.
  // Caveat: this effect re-runs whenever suggestion/lastTime/blockSetsInSession
  // identity changes, not just on open/close edges. A parent re-render while
  // the sheet is open can re-apply the prefill and clobber in-flight user input.
  // If that causes real UX pain, switch to edge-detecting `open` with a useRef.
  useEffect(() => {
    if (!open) return;
    setShowWeightForBodyweight(false);

    if (existingSet) {
      // Priority 1: current logged value (edit mode)
      setWeight(
        existingSet.performedWeightKg != null
          ? String(toDisplayWeight(existingSet.performedWeightKg, units))
          : ""
      );
      setReps(existingSet.performedReps != null ? String(existingSet.performedReps) : "");
      setDuration(existingSet.performedDurationSec != null
        ? String(durationInMinutes ? Math.round(existingSet.performedDurationSec / 60 * 100) / 100 : existingSet.performedDurationSec)
        : "");
      setDistance(existingSet.performedDistanceM != null ? String(existingSet.performedDistanceM) : "");
      return;
    }

    // Priority 2: in-session weight carryover. Look for the most recent set
    // logged in this session for the same block with a non-null weight.
    // Weight only — reps/duration/distance still follow the suggestion /
    // last-time path below so range targets stay visible.
    const carryoverSet = blockSetsInSession
      .filter(
        (ls) =>
          ls.sessionExerciseId === se.id &&
          ls.blockIndex === blockIndex &&
          ls.performedWeightKg != null
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    const lastSet = lastTime?.sets[setIndex];
    const suggestedWeight = suggestion?.suggestedWeightKg;

    if (carryoverSet?.performedWeightKg != null) {
      setWeight(String(toDisplayWeight(carryoverSet.performedWeightKg, units)));
    } else if (suggestedWeight != null) {
      setWeight(String(toDisplayWeight(suggestedWeight, units)));
    } else if (lastSet?.weightKg != null) {
      setWeight(String(toDisplayWeight(lastSet.weightKg, units)));
    } else {
      setWeight(showWeight ? "0" : "");
    }

    setReps(lastSet?.reps != null ? String(lastSet.reps) : block?.minValue != null && targetKind === "reps" ? String(block.minValue) : "");
    setDuration(lastSet?.durationSec != null
      ? String(durationInMinutes ? Math.round(lastSet.durationSec / 60 * 100) / 100 : lastSet.durationSec)
      : "");
    setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
  }, [open, existingSet, suggestion, lastTime, blockSetsInSession, se, blockIndex, setIndex, units, block?.minValue, showWeight, targetKind, durationInMinutes]);

  const blockLabel = block
    ? getBlockLabel(block, blockIndex, blocks.length, blocks)
    : "";

  async function handleSave() {
    const w = weight.trim() ? parseFloat(weight) : null;
    const input = {
      performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
      performedReps: reps.trim() ? parseInt(reps, 10) : null,
      performedDurationSec: duration.trim()
        ? (durationInMinutes ? Math.round(parseFloat(duration) * 60) : parseInt(duration, 10))
        : null,
      performedDistanceM: distance.trim() ? parseFloat(distance) : null,
    };
    if (isSetInputEmpty(targetKind, input)) {
      toast.error("Enter at least " + (targetKind === "reps" ? "reps" : targetKind === "duration" ? "duration" : "distance") + " to save.");
      return;
    }
    setSaving(true);
    try {
      await onSave(input);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save set");
    } finally {
      setSaving(false);
    }
  }

  const totalSets = block?.count ?? "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh]" showCloseButton={false}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">
            {se.exerciseNameSnapshot}
            {blockLabel ? ` — ${blockLabel}` : ""}
            {" — "}
            <span className="tabular-nums">Set {setIndex + 1} of {totalSets}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-4 overflow-y-auto flex-1 min-h-0">
          {/* Weight field */}
          {showWeight && (
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight ({units})</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {isBodyweight && !showWeightForBodyweight && (
            <button
              className="text-xs text-info hover:underline"
              onClick={() => setShowWeightForBodyweight(true)}
            >
              + Add weight (permanent for this session)
            </button>
          )}

          {isBodyweight && showWeightForBodyweight && (
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight ({units})</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <p className="text-[11px] text-warning">
                Adding weight is permanent for this session.
              </p>
            </div>
          )}

          {/* Target field */}
          {targetKind === "reps" && (
            <div className="space-y-1.5">
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                name="reps"
                type="number"
                inputMode="numeric"
                className="text-lg tabular-nums h-12"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                autoFocus={!showWeight}
              />
            </div>
          )}

          {targetKind === "duration" && (
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration ({durationInMinutes ? "minutes" : "seconds"})</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                inputMode={durationInMinutes ? "decimal" : "numeric"}
                className="text-lg tabular-nums h-12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          )}

          {(targetKind === "distance" || isCardioExtra) && (
            <div className="space-y-1.5">
              <Label htmlFor="distance">Distance (meters)</Label>
              <Input
                id="distance"
                name="distance"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2 pb-2 shrink-0">
          <Button variant="cta" className="w-full" size="lg" onClick={handleSave} disabled={saving}>
            Save
          </Button>
          {existingSet && onDelete && (
            <button
              className="w-full text-center text-xs text-destructive hover:underline py-1"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onDelete();
                  onOpenChange(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete set");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete this set
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

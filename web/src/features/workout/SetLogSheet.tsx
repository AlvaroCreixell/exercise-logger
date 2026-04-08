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
  units,
  onSave,
  onDelete,
}: SetLogSheetProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const block: SetBlock | undefined = blocks[blockIndex];
  const targetKind = block?.targetKind ?? "reps";
  const showWeight = se.effectiveType === "weight";
  const isBodyweight = se.effectiveType === "bodyweight";

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [showWeightForBodyweight, setShowWeightForBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill on open
  useEffect(() => {
    if (!open) return;
    setShowWeightForBodyweight(false);

    if (existingSet) {
      // Priority 1: current logged value
      setWeight(
        existingSet.performedWeightKg != null
          ? String(toDisplayWeight(existingSet.performedWeightKg, se.effectiveEquipment, units))
          : ""
      );
      setReps(existingSet.performedReps != null ? String(existingSet.performedReps) : "");
      setDuration(existingSet.performedDurationSec != null ? String(existingSet.performedDurationSec) : "");
      setDistance(existingSet.performedDistanceM != null ? String(existingSet.performedDistanceM) : "");
    } else if (suggestion || lastTime) {
      // Priority 2: suggestion weight + last-time reps
      const suggestedWeight = suggestion?.suggestedWeightKg;
      const lastSet = lastTime?.sets[setIndex];

      if (suggestedWeight != null) {
        setWeight(String(toDisplayWeight(suggestedWeight, se.effectiveEquipment, units)));
      } else if (lastSet?.weightKg != null) {
        setWeight(String(toDisplayWeight(lastSet.weightKg, se.effectiveEquipment, units)));
      } else {
        setWeight(showWeight ? "0" : "");
      }

      setReps(lastSet?.reps != null ? String(lastSet.reps) : block?.minValue != null ? String(block.minValue) : "");
      setDuration(lastSet?.durationSec != null ? String(lastSet.durationSec) : "");
      setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
    } else {
      // Priority 3: default weight to 0 for weighted, reps to lower bound of range
      setWeight(showWeight ? "0" : "");
      setReps(block?.minValue != null && targetKind === "reps" ? String(block.minValue) : "");
      setDuration("");
      setDistance("");
    }
  }, [open, existingSet, suggestion, lastTime, se, setIndex, units, block?.minValue, showWeight, targetKind]);

  const blockLabel = block
    ? getBlockLabel(block, blockIndex, blocks.length, blocks)
    : "";

  async function handleSave() {
    const w = weight.trim() ? parseFloat(weight) : null;
    const input = {
      performedWeightKg: w != null ? toCanonicalKg(w, se.effectiveEquipment, units) : null,
      performedReps: reps.trim() ? parseInt(reps, 10) : null,
      performedDurationSec: duration.trim() ? parseInt(duration, 10) : null,
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
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                inputMode="numeric"
                className="text-lg tabular-nums h-12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          )}

          {targetKind === "distance" && (
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
          <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
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

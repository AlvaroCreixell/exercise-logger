import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExerciseType, ExerciseEquipment, UnitSystem, TargetKind } from "@/domain/enums";
import type { SetLogInput } from "@/services/set-service";
import { toDisplayWeight, toCanonicalKg } from "@/domain/unit-conversion";

interface SetLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveType: ExerciseType;
  effectiveEquipment: ExerciseEquipment;
  units: UnitSystem;
  /** Pre-fill values (current logged value or last-time data). */
  prefill: SetLogInput | null;
  /** Label for context, e.g. "Barbell Back Squat - Set 1" */
  label: string;
  /** Optional tag like "Top" or "AMRAP" */
  tag?: string;
  /**
   * ERRATA S2/P6-E: targetKind from the set block drives which fields are shown.
   * For extra exercises (no set blocks), this is undefined and we fall back to
   * effectiveType-driven field selection.
   */
  targetKind?: TargetKind;
  onSubmit: (input: SetLogInput) => void;
  /** If provided, shows a delete button. */
  onDelete?: () => void;
}

export default function SetLogForm({
  open,
  onOpenChange,
  effectiveType,
  effectiveEquipment,
  units,
  prefill,
  label,
  tag,
  targetKind,
  onSubmit,
  onDelete,
}: SetLogFormProps) {
  const [weightDisplay, setWeightDisplay] = useState("");
  const [reps, setReps] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [distanceM, setDistanceM] = useState("");
  const [optionalWeightExpanded, setOptionalWeightExpanded] = useState(false);

  // ERRATA S2/P6-E: Field visibility driven by targetKind when available,
  // falling back to effectiveType for extra exercises (no set blocks).
  let showWeight: boolean;
  let showReps: boolean;
  let showDuration: boolean;
  let showDistance: boolean;
  let showOptionalWeight: boolean;

  if (targetKind) {
    // targetKind-driven (routine exercises with set blocks)
    showReps = targetKind === "reps";
    showDuration = targetKind === "duration";
    showDistance = targetKind === "distance";
    showWeight = effectiveType === "weight";
    showOptionalWeight = effectiveType === "bodyweight" && !showWeight;
  } else {
    // Fallback for extra exercises: effectiveType-driven
    showWeight = effectiveType === "weight";
    showReps = effectiveType === "weight" || effectiveType === "bodyweight";
    showDuration = effectiveType === "isometric" || effectiveType === "cardio";
    showDistance = effectiveType === "cardio";
    showOptionalWeight = effectiveType === "bodyweight" && !showWeight;
  }

  // ERRATA P6-G: Reset optionalWeightExpanded when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (prefill) {
        if (prefill.performedWeightKg !== null) {
          const display = toDisplayWeight(
            prefill.performedWeightKg,
            effectiveEquipment,
            units
          );
          setWeightDisplay(String(display));
        } else {
          setWeightDisplay("");
        }
        setReps(prefill.performedReps !== null ? String(prefill.performedReps) : "");
        setDurationSec(
          prefill.performedDurationSec !== null
            ? String(prefill.performedDurationSec)
            : ""
        );
        setDistanceM(
          prefill.performedDistanceM !== null
            ? String(prefill.performedDistanceM)
            : ""
        );
        // Auto-expand if there is a pre-filled weight
        setOptionalWeightExpanded(prefill.performedWeightKg != null);
      } else {
        setWeightDisplay("");
        setReps("");
        setDurationSec("");
        setDistanceM("");
        setOptionalWeightExpanded(false);
      }
    }
  }, [open, prefill, effectiveEquipment, units]);

  function handleSubmit() {
    const input: SetLogInput = {
      performedWeightKg: null,
      performedReps: null,
      performedDurationSec: null,
      performedDistanceM: null,
    };

    if ((showWeight || (showOptionalWeight && optionalWeightExpanded)) && weightDisplay.trim()) {
      const parsed = parseFloat(weightDisplay);
      if (!isNaN(parsed)) {
        input.performedWeightKg = toCanonicalKg(parsed, effectiveEquipment, units);
      }
    }

    if (showReps && reps.trim()) {
      const parsed = parseInt(reps, 10);
      if (!isNaN(parsed)) {
        input.performedReps = parsed;
      }
    }

    if (showDuration && durationSec.trim()) {
      const parsed = parseInt(durationSec, 10);
      if (!isNaN(parsed)) {
        input.performedDurationSec = parsed;
      }
    }

    if (showDistance && distanceM.trim()) {
      const parsed = parseFloat(distanceM);
      if (!isNaN(parsed)) {
        input.performedDistanceM = parsed;
      }
    }

    onSubmit(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {label}
            {tag && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({tag})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {showWeight && (
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight ({units})</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="any"
                value={weightDisplay}
                onChange={(e) => setWeightDisplay(e.target.value)}
                placeholder={`0 ${units}`}
                autoFocus
              />
            </div>
          )}

          {/* Optional weight for bodyweight exercises (weighted bodyweight) */}
          {showOptionalWeight && (
            <div className="space-y-1.5">
              {!optionalWeightExpanded ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setOptionalWeightExpanded(true)}
                >
                  + Add weight (weighted bodyweight)
                </button>
              ) : (
                <>
                  <Label htmlFor="weight">Added Weight ({units})</Label>
                  <Input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={weightDisplay}
                    onChange={(e) => setWeightDisplay(e.target.value)}
                    placeholder={`0 ${units}`}
                  />
                </>
              )}
            </div>
          )}

          {showReps && (
            <div className="space-y-1.5">
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
                autoFocus={!showWeight}
              />
            </div>
          )}

          {showDuration && (
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                inputMode="numeric"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                placeholder="0"
                autoFocus={!showWeight && !showReps}
              />
            </div>
          )}

          {showDistance && (
            <div className="space-y-1.5">
              <Label htmlFor="distance">Distance (meters)</Label>
              <Input
                id="distance"
                type="number"
                inputMode="decimal"
                step="any"
                value={distanceM}
                onChange={(e) => setDistanceM(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {onDelete && (
            <Button variant="destructive" onClick={onDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

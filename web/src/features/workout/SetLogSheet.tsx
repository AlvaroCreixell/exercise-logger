import { useState, useEffect, useRef } from "react";
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
import { SetDots } from "./SetDots";
import { Keypad } from "@/features/workout/Keypad";
import { ValueBox } from "@/features/workout/ValueBox";
import { PrToggle } from "@/features/workout/PrToggle";
import { applyKeypadKey, type KeypadKey } from "@/features/workout/lib/keypad-reducer";
import type { TargetKind } from "@/domain/enums";

function deriveActiveField(
  visWeight: boolean,
  visBwWeight: boolean,
  isBw: boolean,
  kind: TargetKind,
): ActiveField {
  if (visWeight || (isBw && visBwWeight)) return "weight";
  if (kind === "reps") return "reps";
  if (kind === "duration") return "duration";
  return "distance";
}

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
    isPersonalRecord: boolean;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

type ActiveField = "weight" | "reps" | "duration" | "distance";

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
  const [isPR, setIsPR] = useState(false);
  const [showWeightForBodyweight, setShowWeightForBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savePulse, setSavePulse] = useState(false);

  const [activeField, setActiveField] = useState<ActiveField>(
    deriveActiveField(showWeight, false, isBodyweight, targetKind),
  );

  // Pre-fill on open transition only. Using a ref to track the prior `open`
  // value means prefill fires once per false→true edge, not on every re-render
  // while the sheet is open — which closes a clobber bug where a parent
  // re-render with new history identity would overwrite in-flight user input.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return; // already open; skip
    prevOpenRef.current = true;

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
      setIsPR(existingSet.isPersonalRecord === true);
      setActiveField(deriveActiveField(showWeight, false, isBodyweight, targetKind));
      return;
    }

    // Priority 2: in-session weight carryover.
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
    setIsPR(false);
    setActiveField(deriveActiveField(showWeight, false, isBodyweight, targetKind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const blockLabel = block
    ? getBlockLabel(block, blockIndex, blocks.length, blocks)
    : "";

  function dispatchKey(key: KeypadKey) {
    if (activeField === "weight") {
      setWeight((w) => applyKeypadKey(w, key));
    } else if (activeField === "reps") {
      // Reps are integer-only. Reject the decimal key so users can't type
      // "10.5" and have parseInt silently truncate it to 10 on save.
      if (key === ".") return;
      setReps((r) => applyKeypadKey(r, key));
    }
    // duration/distance keep native inputs; keypad is hidden for those.
  }

  function nudgeWeight(delta: number) {
    const n = weight.trim() ? parseFloat(weight) : 0;
    if (!Number.isFinite(n)) return;
    const next = Math.max(0, n + delta);
    setWeight(String(Number.isInteger(next) ? next : Math.round(next * 100) / 100));
  }

  function nudgeReps(delta: number) {
    const n = reps.trim() ? parseInt(reps, 10) : 0;
    if (!Number.isFinite(n)) return;
    setReps(String(Math.max(0, n + delta)));
  }

  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  async function handleSave() {
    const w = weight.trim() ? parseFloat(weight) : null;
    const input = {
      performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
      performedReps: reps.trim() ? parseInt(reps, 10) : null,
      performedDurationSec: duration.trim()
        ? (durationInMinutes ? Math.round(parseFloat(duration) * 60) : parseInt(duration, 10))
        : null,
      performedDistanceM: distance.trim() ? parseFloat(distance) : null,
      isPersonalRecord: isPR,
    };
    if (isSetInputEmpty(targetKind, input)) {
      toast.error("Enter at least " + (targetKind === "reps" ? "reps" : targetKind === "duration" ? "duration" : "distance") + " to save.");
      return;
    }
    setSaving(true);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 320);
    try {
      await onSave(input);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save set");
    } finally {
      setSaving(false);
    }
  }

  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        // Don't hijack Enter on focused interactive controls — Mark PR,
        // Use last, Delete set, close-button all expect Enter to activate
        // them, not to trigger the sheet-level save.
        if (e.key === "Enter" && (tag === "BUTTON" || target.getAttribute("role") === "button")) {
          return;
        }
      }
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        dispatchKey(e.key as KeypadKey);
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        dispatchKey(".");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        dispatchKey("back");
        return;
      }
      if (e.key === "Tab") {
        const canReps = targetKind === "reps";
        const canWeight = showWeight || (isBodyweight && showWeightForBodyweight);
        if (canWeight && canReps) {
          e.preventDefault();
          setActiveField((cur) => (cur === "weight" ? "reps" : "weight"));
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSaveRef.current();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeField, weight, reps, showWeight, isBodyweight, showWeightForBodyweight, targetKind]);

  const totalSets = block?.count ?? "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh]" showCloseButton={false}>
        <SheetHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-heading font-bold tracking-tight truncate">
                {se.exerciseNameSnapshot}
              </SheetTitle>
              {blockLabel && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
                  {blockLabel}
                </p>
              )}
            </div>
            {typeof totalSets === "number" && totalSets > 0 && (
              <SetDots total={totalSets} current={setIndex} />
            )}
          </div>
        </SheetHeader>

        <div className="space-y-4 pb-4 overflow-y-auto flex-1 min-h-0">
          {/* Inline context: Last time + Suggestion */}
          {(lastTime?.sets.length || suggestion) && (
            <div className="-mt-1 pb-2 space-y-0.5 text-xs tabular-nums">
              {lastTime && lastTime.sets.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="uppercase tracking-widest text-[11px] font-semibold">Last time</span>
                  <span className="mx-1.5">·</span>
                  <span className="text-foreground">
                    {(() => {
                      const s = lastTime.sets[setIndex] ?? lastTime.sets[0]!;
                      if (s.weightKg != null && s.reps != null) {
                        return `${toDisplayWeight(s.weightKg, units)}${units} × ${s.reps}`;
                      }
                      if (s.reps != null) return `${s.reps} reps`;
                      if (s.durationSec != null) return `${s.durationSec}s`;
                      if (s.distanceM != null) return `${s.distanceM}m`;
                      return "—";
                    })()}
                  </span>
                  {(() => {
                    const s = lastTime.sets[setIndex] ?? lastTime.sets[0];
                    if (!s) return null;
                    return (
                      <button
                        type="button"
                        className="ml-3 inline-flex items-center rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
                        onClick={() => {
                          if (s.weightKg != null) setWeight(String(toDisplayWeight(s.weightKg, units)));
                          if (s.reps != null) setReps(String(s.reps));
                        }}
                      >
                        Use last
                      </button>
                    );
                  })()}
                </p>
              )}
              {suggestion && (
                <p className={suggestion.isProgression ? "text-success font-semibold" : "text-info font-medium"}>
                  <span className="uppercase tracking-widest text-[11px]">Suggested</span>
                  <span className="mx-1.5 font-normal">·</span>
                  {toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
                  {suggestion.isProgression && " ↑"}
                </p>
              )}
            </div>
          )}

          {/* Weight field */}
          {showWeight && (
            <ValueBox
              label="Weight"
              value={weight}
              unit={units}
              isActive={activeField === "weight"}
              onFocus={() => setActiveField("weight")}
              onNudgeDown={() => nudgeWeight(-2.5)}
              onNudgeUp={() => nudgeWeight(2.5)}
            />
          )}

          {isBodyweight && !showWeightForBodyweight && (
            <button
              className="text-xs text-info hover:underline"
              onClick={() => {
                setShowWeightForBodyweight(true);
                setActiveField("weight");
              }}
            >
              + Add weight (permanent for this session)
            </button>
          )}

          {isBodyweight && showWeightForBodyweight && (
            <>
              <ValueBox
                label="Weight"
                value={weight}
                unit={units}
                isActive={activeField === "weight"}
                onFocus={() => setActiveField("weight")}
                onNudgeDown={() => nudgeWeight(-2.5)}
                onNudgeUp={() => nudgeWeight(2.5)}
              />
              <p className="text-[11px] text-warning">
                Adding weight is permanent for this session.
              </p>
            </>
          )}

          {/* Target field */}
          {targetKind === "reps" && (
            <ValueBox
              label="Reps"
              value={reps}
              isActive={activeField === "reps"}
              onFocus={() => setActiveField("reps")}
              onNudgeDown={() => nudgeReps(-1)}
              onNudgeUp={() => nudgeReps(1)}
            />
          )}

          {targetKind === "duration" && (
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration ({durationInMinutes ? "minutes" : "seconds"})</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                inputMode={durationInMinutes ? "decimal" : "numeric"}
                className="text-value h-14 text-center"
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
                className="text-value h-14 text-center"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          )}

          {(showWeight || targetKind === "reps" || (isBodyweight && showWeightForBodyweight)) && (
            <div className="pt-1">
              <Keypad onKey={dispatchKey} disabled={saving} />
            </div>
          )}
        </div>

        <div className="space-y-2 pb-2 shrink-0">
          <div className="flex justify-end pb-1">
            <PrToggle value={isPR} onChange={setIsPR} />
          </div>
          <Button
            variant="default"
            className={`w-full ${savePulse ? "save-pulse" : ""}`}
            size="lg"
            onClick={handleSave}
            disabled={saving}
          >
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

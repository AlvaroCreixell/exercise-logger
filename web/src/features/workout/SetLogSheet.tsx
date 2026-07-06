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
import { toDisplayWeight, toCanonicalKg, getIncrement } from "@/domain/unit-conversion";
import { isNewPersonalBest, type PersonalBests } from "@/domain/personal-records";
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
  /**
   * All-time bests for this exercise (from useExercisePersonalBests). When
   * present, CREATE mode auto-defaults the PR toggle on record-beating input.
   * Absent = today's behavior (plain manual toggle).
   */
  personalBests?: PersonalBests;
  /**
   * False while the parent's history query for THIS exercise is still
   * resolving. Create-mode prefill waits for it — prefilling from a stale
   * or absent history is how the cross-exercise poisoning bug happened.
   * Edit mode ignores it (existingSet needs no history). Default true.
   */
  historyLoaded?: boolean;
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
  personalBests,
  historyLoaded = true,
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
  // Create-mode manual PR override: null = follow auto detection; a boolean
  // means the user tapped the toggle and their choice sticks until the sheet
  // closes. Edit mode ignores this entirely (plain isPR toggle).
  const [prOverride, setPrOverride] = useState<boolean | null>(null);
  const [showWeightForBodyweight, setShowWeightForBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savePulse, setSavePulse] = useState(false);

  const [activeField, setActiveField] = useState<ActiveField>(
    deriveActiveField(showWeight, false, isBodyweight, targetKind),
  );

  // Pristine keypad fields: a prefilled (or freshly focused) value the user
  // hasn't typed into yet. The first digit REPLACES a pristine value instead
  // of appending (see keypad-reducer) — correcting a prefill costs one
  // keystroke, not backspaces + retype. Backspace and nudges drop to append.
  const [pristine, setPristine] = useState({ weight: true, reps: true });

  /** Switch the keypad target and re-arm pristine-replace for that field. */
  function focusField(field: ActiveField) {
    setActiveField(field);
    if (field === "weight" || field === "reps") {
      setPristine((p) => ({ ...p, [field]: true }));
    }
  }

  // Pre-fill once per open. The ref means prefill never re-fires on parent
  // re-renders while open — that would clobber in-flight user input. Create
  // mode additionally waits for `historyLoaded`: prefilling before this
  // exercise's history query resolves is how the sheet used to inherit the
  // PREVIOUS exercise's suggestion/last-time values (and silently save them
  // on cardio extras). Edit mode prefills from existingSet immediately.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!open) {
      prefilledRef.current = false;
      return;
    }
    if (prefilledRef.current) return; // already prefilled this open
    if (!existingSet && !historyLoaded) return; // create mode: wait for history
    prefilledRef.current = true;

    setShowWeightForBodyweight(false);
    setPrOverride(null);
    setPristine({ weight: true, reps: true });

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
      // Day one: leave the field genuinely empty ("—"), never a
      // committed-looking "0" that saves as a 0 kg lift.
      setWeight("");
    }

    // Reps: a progression restarts at the range floor — last time's reps were
    // hit at a LIGHTER weight, so prefilling them invites logging fake reps.
    // Repeats keep matching last time's per-set reps.
    setReps(
      suggestion?.isProgression && block?.minValue != null && targetKind === "reps"
        ? String(block.minValue)
        : lastSet?.reps != null
          ? String(lastSet.reps)
          : block?.minValue != null && targetKind === "reps"
            ? String(block.minValue)
            : "",
    );
    setDuration(lastSet?.durationSec != null
      ? String(durationInMinutes ? Math.round(lastSet.durationSec / 60 * 100) / 100 : lastSet.durationSec)
      : "");
    setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
    setIsPR(false);
    setActiveField(deriveActiveField(showWeight, false, isBodyweight, targetKind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyLoaded]);

  const blockLabel = block
    ? getBlockLabel(block, blockIndex, blocks.length, blocks)
    : "";

  function dispatchKey(key: KeypadKey) {
    // Any user input claims this open: a prefill that hasn't run yet (history
    // still loading) must never overwrite what the user has typed.
    prefilledRef.current = true;
    if (activeField === "weight") {
      const wasPristine = pristine.weight;
      setWeight((w) => applyKeypadKey(w, key, wasPristine));
      if (wasPristine) setPristine((p) => ({ ...p, weight: false }));
    } else if (activeField === "reps") {
      // Reps are integer-only. Reject the decimal key so users can't type
      // "10.5" and have parseInt silently truncate it to 10 on save.
      if (key === ".") return;
      const wasPristine = pristine.reps;
      setReps((r) => applyKeypadKey(r, key, wasPristine));
      if (wasPristine) setPristine((p) => ({ ...p, reps: false }));
    }
    // duration/distance keep native inputs; keypad is hidden for those.
  }

  // Weight nudges step by the equipment's practical increment (barbell 2.5 kg
  // / 5 lbs, machine 5 kg / 10 lbs, …) — never a hardcoded 2.5.
  const weightStep = getIncrement(se.effectiveEquipment, units);

  function nudgeWeight(delta: number) {
    prefilledRef.current = true;
    const n = weight.trim() ? parseFloat(weight) : 0;
    if (!Number.isFinite(n)) return;
    const next = Math.max(0, n + delta);
    setWeight(String(Number.isInteger(next) ? next : Math.round(next * 100) / 100));
    setPristine((p) => ({ ...p, weight: false }));
  }

  function nudgeReps(delta: number) {
    prefilledRef.current = true;
    const n = reps.trim() ? parseInt(reps, 10) : 0;
    if (!Number.isFinite(n)) return;
    setReps(String(Math.max(0, n + delta)));
    setPristine((p) => ({ ...p, reps: false }));
  }

  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Which measures have a rendered input right now. Anything invisible saves
  // as null — field state left over from prefill or a prior configuration
  // must never reach the database (this is what let a cardio extra silently
  // store the previous exercise's weight × reps).
  const weightFieldVisible = showWeight || (isBodyweight && showWeightForBodyweight);
  const repsFieldVisible = targetKind === "reps";
  const durationFieldVisible = targetKind === "duration";
  const distanceFieldVisible = targetKind === "distance" || isCardioExtra;

  /**
   * Parse the current field strings to canonical values — the single source
   * of truth for both saving and live auto-PR detection, so the toggle can
   * never disagree with what actually gets saved.
   */
  function parseCurrentInput() {
    const w = weightFieldVisible && weight.trim() ? parseFloat(weight) : null;
    return {
      performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
      performedReps: repsFieldVisible && reps.trim() ? parseInt(reps, 10) : null,
      performedDurationSec: durationFieldVisible && duration.trim()
        ? (durationInMinutes ? Math.round(parseFloat(duration) * 60) : parseInt(duration, 10))
        : null,
      performedDistanceM: distanceFieldVisible && distance.trim() ? parseFloat(distance) : null,
    };
  }

  // Effective PR state. CREATE mode: manual override wins; otherwise auto
  // best-ever detection on the in-flight input (off when no personalBests
  // provided). EDIT mode: today's behavior — plain manual toggle prefilled
  // from existingSet.isPersonalRecord, no auto. Cardio never auto-PRs —
  // a cardio set with only duration or only distance filled would otherwise
  // slip past the helper's duration+distance rule as a single-measure shape.
  const isCreateMode = existingSet === undefined;
  const autoPR =
    isCreateMode && personalBests !== undefined && se.effectiveType !== "cardio"
      ? isNewPersonalBest(parseCurrentInput(), personalBests)
      : false;
  const effectivePR = isCreateMode ? (prOverride ?? autoPR) : isPR;
  const isAutoPR = isCreateMode && prOverride === null && autoPR;

  async function handleSave() {
    const input = {
      ...parseCurrentInput(),
      isPersonalRecord: effectivePR,
    };
    if (isSetInputEmpty(targetKind, input, { cardioExtra: isCardioExtra })) {
      const requiredField = isCardioExtra
        ? "duration or distance"
        : targetKind === "reps"
          ? "reps"
          : targetKind === "duration"
            ? "duration"
            : "distance";
      toast.error(`Enter at least ${requiredField} to save.`);
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
        // Don't hijack Enter or Tab on focused interactive controls — Mark PR,
        // Use last, Delete set, close-button all expect Enter to activate them
        // and Tab to move focus to the next control. Without this, keyboard
        // users can't navigate between the sheet's footer buttons.
        const isButton = tag === "BUTTON" || target.getAttribute("role") === "button";
        if (isButton && (e.key === "Enter" || e.key === "Tab")) {
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
          focusField(activeField === "weight" ? "reps" : "weight");
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
  }, [open, activeField, weight, reps, pristine, showWeight, isBodyweight, showWeightForBodyweight, targetKind]);

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
            <div className="flex shrink-0 items-center gap-3">
              {typeof totalSets === "number" && totalSets > 0 && (
                <SetDots total={totalSets} current={setIndex} />
              )}
              <button
                type="button"
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3 transition-colors hover:border-accent-cli hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
            </div>
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
                      // Combined cardio: render both fields to match formatLoggedSet output.
                      // NOTE: this formatter uses LastTimeSet field names (weightKg, reps,
                      // durationSec, distanceM) which differ from LoggedSetSubset
                      // (performedWeightKg, etc.), so formatLoggedSet cannot be called
                      // directly here.
                      if (s.durationSec != null && s.distanceM != null) return `${s.durationSec}s · ${s.distanceM}m`;
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
                        className="ml-3 inline-flex items-center rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 transition-colors hover:border-accent-cli hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
                        onClick={() => {
                          prefilledRef.current = true;
                          if (s.weightKg != null) setWeight(String(toDisplayWeight(s.weightKg, units)));
                          if (s.reps != null) setReps(String(s.reps));
                          if (s.durationSec != null) {
                            setDuration(
                              String(
                                durationInMinutes
                                  ? Math.round((s.durationSec / 60) * 100) / 100
                                  : s.durationSec,
                              ),
                            );
                          }
                          if (s.distanceM != null) setDistance(String(s.distanceM));
                          // Restored values are "seen" values — re-arm replace.
                          setPristine({ weight: true, reps: true });
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
              onFocus={() => focusField("weight")}
              onNudgeDown={() => nudgeWeight(-weightStep)}
              onNudgeUp={() => nudgeWeight(weightStep)}
            />
          )}

          {isBodyweight && !showWeightForBodyweight && (
            <button
              className="text-xs text-info hover:underline"
              onClick={() => {
                setShowWeightForBodyweight(true);
                focusField("weight");
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
                onFocus={() => focusField("weight")}
                onNudgeDown={() => nudgeWeight(-weightStep)}
                onNudgeUp={() => nudgeWeight(weightStep)}
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
              onFocus={() => focusField("reps")}
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
                onChange={(e) => {
                  prefilledRef.current = true;
                  setDuration(e.target.value);
                }}
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
                onChange={(e) => {
                  prefilledRef.current = true;
                  setDistance(e.target.value);
                }}
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
            <PrToggle
              value={effectivePR}
              auto={isAutoPR}
              onChange={(next) => {
                if (isCreateMode) {
                  // Tap = negate the current effective value; sticks until close.
                  setPrOverride(next);
                } else {
                  setIsPR(next);
                }
              }}
            />
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

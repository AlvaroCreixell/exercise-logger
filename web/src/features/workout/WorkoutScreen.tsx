import { useState } from "react";
import { useNavigate } from "react-router";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { useExtraHistory } from "@/shared/hooks/useExtraHistory";
import { db } from "@/db/database";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import { addExtraExercise, finishSession, discardSession } from "@/services/session-service";
import { setUnitOverride } from "@/services/settings-service";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ExerciseCard } from "./ExerciseCard";
import { SetLogSheet } from "./SetLogSheet";
import { SupersetGroup } from "./SupersetGroup";
import { ExercisePicker } from "./ExercisePicker";
import { WorkoutFooter } from "./WorkoutFooter";
import { toast } from "sonner";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function WorkoutScreen() {
  const activeSession = useActiveSession();
  const settings = useSettings();
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  if (!settings) return null;

  // Empty state
  if (activeSession === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5">
        <h1 className="text-2xl font-extrabold tracking-tight font-heading">No Active Workout</h1>
        <p className="text-sm text-muted-foreground">
          Start a workout from the Today tab.
        </p>
      </div>
    );
  }

  if (activeSession === undefined) return null;

  const { session, sessionExercises, loggedSets } = activeSession;
  const units = settings.units;

  // Group sets by sessionExerciseId
  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const arr = setsByExercise.get(ls.sessionExerciseId) ?? [];
    arr.push(ls);
    setsByExercise.set(ls.sessionExerciseId, arr);
  }

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const sets = setsByExercise.get(se.id) ?? [];
    const existing = sets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex
    );
    setSheetExercise(se);
    setSheetBlockIndex(blockIndex);
    setSheetSetIndex(setIndex);
    setSheetExistingSet(existing);
    setSheetOpen(true);
  }

  async function handleSave(input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) {
    if (!sheetExercise) return;
    if (sheetExistingSet) {
      await editSet(db, sheetExistingSet.id, input);
    } else {
      await logSet(db, sheetExercise.id, sheetBlockIndex, sheetSetIndex, input);
    }
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  async function handleAddExercise(exerciseId: string) {
    await addExtraExercise(db, session.id, exerciseId);
  }

  // Count unlogged sets
  const totalPrescribed = sessionExercises.reduce(
    (sum, se) => sum + se.setBlocksSnapshot.reduce((s, b) => s + b.count, 0),
    0
  );
  const unloggedCount = totalPrescribed - loggedSets.filter((ls) => ls.origin === "routine").length;

  async function handleFinish() {
    await finishSession(db, session.id);
    toast.success("Workout finished!");
    navigate("/history");
  }

  async function handleDiscard() {
    await discardSession(db, session.id);
    toast.success("Workout discarded");
    navigate("/");
  }

  // Build render groups (singles and supersets)
  const renderGroups: Array<
    | { type: "single"; exercise: SessionExercise }
    | { type: "superset"; exercises: [SessionExercise, SessionExercise] }
  > = [];

  const processed = new Set<string>();
  for (const se of sessionExercises) {
    if (processed.has(se.id)) continue;
    if (se.groupType === "superset" && se.supersetGroupId) {
      const partner = sessionExercises.find(
        (other) =>
          other.id !== se.id && other.supersetGroupId === se.supersetGroupId
      );
      if (partner) {
        const ordered =
          (se.supersetPosition ?? 0) < (partner.supersetPosition ?? 0)
            ? [se, partner]
            : [partner, se];
        renderGroups.push({
          type: "superset",
          exercises: ordered as [SessionExercise, SessionExercise],
        });
        processed.add(se.id);
        processed.add(partner.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", exercise: se });
    processed.add(se.id);
  }

  const existingExerciseIds = new Set(sessionExercises.map((se) => se.exerciseId));

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b-2 border-border-strong px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
          {session.dayLabelSnapshot}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight font-heading truncate">
          {session.routineNameSnapshot}
        </h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            const se = group.exercise;
            return (
              <ExerciseCardWithHistory
                key={se.id}
                sessionExercise={se}
                loggedSets={setsByExercise.get(se.id) ?? []}
                globalUnits={units}
                onSetTap={(bi, si) => handleSetTap(se, bi, si)}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.exercises.map((se) => (
                <ExerciseCardWithHistory
                  key={se.id}
                  sessionExercise={se}
                  loggedSets={setsByExercise.get(se.id) ?? []}
                  globalUnits={units}
                  onSetTap={(bi, si) => handleSetTap(se, bi, si)}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      <WorkoutFooter
        onAddExercise={() => setPickerOpen(true)}
        onFinish={() => setFinishOpen(true)}
        onDiscard={() => setDiscardOpen(true)}
      />

      {/* Set Log Sheet */}
      {sheetExercise && (
        <SetLogSheetWithHistory
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}

      {/* Exercise Picker */}
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingExerciseIds={existingExerciseIds}
        onPick={handleAddExercise}
      />

      {/* Finish Dialog */}
      <ConfirmDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="Finish Workout?"
        description={
          unloggedCount > 0
            ? `${unloggedCount} sets not logged — they will remain empty.`
            : "All sets logged. Ready to finish?"
        }
        confirmText="Finish Workout"
        onConfirm={handleFinish}
      />

      {/* Discard Dialog */}
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard Workout?"
        description="This will permanently delete this workout and all logged sets."
        confirmText="Discard"
        onConfirm={handleDiscard}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    </div>
  );
}

/**
 * Wrapper that provides history data to ExerciseCard via hooks.
 * Hooks must be called at the top level, so this wrapper isolates them per exercise.
 */
function ExerciseCardWithHistory({
  sessionExercise,
  loggedSets,
  globalUnits,
  onSetTap,
}: {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  globalUnits: "kg" | "lbs";
  onSetTap: (blockIndex: number, setIndex: number) => void;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits
  );
  const extraHistory = useExtraHistory(
    !isRoutine ? sessionExercise.exerciseId : undefined
  );

  return (
    <ExerciseCard
      sessionExercise={sessionExercise}
      loggedSets={loggedSets}
      units={effectiveUnits}
      historyData={historyData}
      extraHistory={extraHistory}
      onSetTap={onSetTap}
      onUnitToggle={async (newUnit) => {
        await setUnitOverride(db, sessionExercise.id, newUnit);
      }}
    />
  );
}

/**
 * Wrapper that provides history data to SetLogSheet via hooks.
 */
function SetLogSheetWithHistory({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  units: globalUnits,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits
  );

  const suggestion = historyData?.suggestions.find(
    (s) => s.blockIndex === blockIndex
  );
  const lastTime = historyData?.lastTime[blockIndex];

  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={suggestion}
      lastTime={lastTime}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

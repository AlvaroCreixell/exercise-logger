import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { db } from "@/db/database";
import { editSet, deleteSet } from "@/services/set-service";
import { deleteSession } from "@/services/session-service";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import { SupersetGroup } from "@/features/workout/SupersetGroup";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Button } from "@/shared/ui/button";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import { computeSessionVolumeKg } from "@/shared/lib/sessionStats";
import { SessionDetailHeader } from "./SessionDetailHeader";
import { SessionDetailStatsTile } from "./SessionDetailStatsTile";
import { SessionDetailExerciseCard } from "./SessionDetailExerciseCard";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId);
  const settings = useSettings();
  const navigate = useNavigate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!settings) return null;
  if (detail === undefined) return null;

  if (detail === null) {
    return (
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const { session, exercises } = detail;
  const units = settings.units;

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const exData = exercises.find((e) => e.sessionExercise.id === se.id);
    const existing = exData?.loggedSets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex,
    );
    // Only allow editing existing logged sets on finished sessions.
    // logSet() requires active session status — cannot create new sets here.
    if (!existing) return;
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
    if (!sheetExercise || !sheetExistingSet) return;
    await editSet(db, sheetExistingSet.id, input);
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  async function handleDeleteSession() {
    if (!sessionId) return;
    try {
      await deleteSession(db, sessionId);
      toast.success("Workout deleted");
      navigate("/history", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete workout"
      );
    }
  }

  // Build render groups: singles or superset pairs.
  const renderGroups: Array<
    | { type: "single"; data: (typeof exercises)[0] }
    | { type: "superset"; data: [(typeof exercises)[0], (typeof exercises)[0]] }
  > = [];
  const processed = new Set<string>();

  for (const exData of exercises) {
    const se = exData.sessionExercise;
    if (processed.has(se.id)) continue;
    if (se.groupType === "superset" && se.supersetGroupId) {
      const partner = exercises.find(
        (other) =>
          other.sessionExercise.id !== se.id &&
          other.sessionExercise.supersetGroupId === se.supersetGroupId,
      );
      if (partner) {
        const ordered =
          (se.supersetPosition ?? 0) < (partner.sessionExercise.supersetPosition ?? 0)
            ? [exData, partner]
            : [partner, exData];
        renderGroups.push({
          type: "superset",
          data: ordered as [(typeof exercises)[0], (typeof exercises)[0]],
        });
        processed.add(se.id);
        processed.add(partner.sessionExercise.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", data: exData });
    processed.add(se.id);
  }

  const sheetExerciseSets = sheetExercise
    ? exercises.find((e) => e.sessionExercise.id === sheetExercise.id)?.loggedSets ?? []
    : [];

  // Stats tile aggregates
  const allSets = exercises.flatMap((e) => e.loggedSets);
  const setCount = allSets.length;
  const volumeKg = computeSessionVolumeKg(allSets);
  const durationMin =
    session.finishedAt != null
      ? Math.round(
          (new Date(session.finishedAt).getTime() -
            new Date(session.startedAt).getTime()) /
            60000,
        )
      : null;

  return (
    <div className="space-y-5 p-5 pb-8">
      <SessionDetailHeader session={session} />

      <SessionDetailStatsTile
        setCount={setCount}
        volumeKg={volumeKg}
        durationMin={durationMin}
        units={units}
      />

      <div className="space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            const d = group.data;
            return (
              <SessionDetailExerciseCard
                key={d.sessionExercise.id}
                exerciseName={d.sessionExercise.exerciseNameSnapshot}
                exerciseId={d.sessionExercise.exerciseId}
                loggedSets={d.loggedSets}
                units={getEffectiveUnit(d.sessionExercise.unitOverride, units)}
                onSetTap={(bi, si) => handleSetTap(d.sessionExercise, bi, si)}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.data.map((d) => (
                <SessionDetailExerciseCard
                  key={d.sessionExercise.id}
                  exerciseName={d.sessionExercise.exerciseNameSnapshot}
                  exerciseId={d.sessionExercise.exerciseId}
                  loggedSets={d.loggedSets}
                  units={getEffectiveUnit(d.sessionExercise.unitOverride, units)}
                  onSetTap={(bi, si) => handleSetTap(d.sessionExercise, bi, si)}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      <div className="pt-4">
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          Delete workout
        </Button>
      </div>

      {sheetExercise && (
        <SetLogSheetWithHistoryForDetail
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          blockSetsInSession={sheetExerciseSets}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this workout?"
        description="All sets logged in this session will be permanently erased. History totals will update. This can't be undone."
        confirmText="Delete"
        onConfirm={handleDeleteSession}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    </div>
  );
}

function SetLogSheetWithHistoryForDetail({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  blockSetsInSession,
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
  blockSetsInSession: LoggedSet[];
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
  const historyData = useExerciseHistory(
    sessionExercise.origin === "routine" ? sessionExercise : undefined,
    effectiveUnits,
  );
  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={historyData?.suggestions.find((s) => s.blockIndex === blockIndex)}
      lastTime={historyData?.lastTime[blockIndex]}
      blockSetsInSession={blockSetsInSession}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

import { useState } from "react";
import { useParams, Link } from "react-router";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { db } from "@/db/database";
import { editSet, deleteSet } from "@/services/set-service";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import { SupersetGroup } from "@/features/workout/SupersetGroup";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId);
  const settings = useSettings();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  if (!settings) return null;

  if (detail === null) {
    return (
      <div className="p-4">
        <Link to="/history" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Link>
        <p className="text-sm text-muted-foreground mt-4">Session not found.</p>
      </div>
    );
  }

  if (detail === undefined) return null;

  const { session, exercises } = detail;
  const units = settings.units;

  function formatDuration(start: string, end: string | null): string {
    if (!end) return "";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.round(ms / 60000);
    if (min < 1) return "< 1 min";
    return `${min} min`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const exData = exercises.find((e) => e.sessionExercise.id === se.id);
    const existing = exData?.loggedSets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex
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
    // Only editSet is valid on finished sessions
    await editSet(db, sheetExistingSet.id, input);
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  // Build render groups
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
        (other) => other.sessionExercise.id !== se.id && other.sessionExercise.supersetGroupId === se.supersetGroupId
      );
      if (partner) {
        const ordered = (se.supersetPosition ?? 0) < (partner.sessionExercise.supersetPosition ?? 0)
          ? [exData, partner]
          : [partner, exData];
        renderGroups.push({ type: "superset", data: ordered as [(typeof exercises)[0], (typeof exercises)[0]] });
        processed.add(se.id);
        processed.add(partner.sessionExercise.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", data: exData });
    processed.add(se.id);
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <Link to="/history" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Link>

      <div>
        <h1 className="text-xl font-bold">{session.dayLabelSnapshot}</h1>
        <p className="text-sm text-muted-foreground">
          {session.routineNameSnapshot}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums mt-1">
          {formatDate(session.finishedAt ?? session.startedAt)}
          {session.finishedAt && (
            <> &middot; {formatDuration(session.startedAt, session.finishedAt)}</>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            return (
              <SessionExerciseCardWithHistory
                key={group.data.sessionExercise.id}
                exData={group.data}
                units={units}
                onSetTap={handleSetTap}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.data.map((d) => (
                <SessionExerciseCardWithHistory
                  key={d.sessionExercise.id}
                  exData={d}
                  units={units}
                  onSetTap={handleSetTap}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      {sheetExercise && (
        <SetLogSheetWithHistoryForDetail
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
    </div>
  );
}

function SessionExerciseCardWithHistory({
  exData,
  units: globalUnits,
  onSetTap,
}: {
  exData: { sessionExercise: SessionExercise; loggedSets: LoggedSet[] };
  units: "kg" | "lbs";
  onSetTap: (se: SessionExercise, blockIndex: number, setIndex: number) => void;
}) {
  const se = exData.sessionExercise;
  const effectiveUnits = getEffectiveUnit(se.unitOverride, globalUnits);
  const historyData = useExerciseHistory(
    se.origin === "routine" ? se : undefined,
    effectiveUnits
  );

  return (
    <div>
      <Link
        to={`/history/exercise/${se.exerciseId}`}
        className="text-base font-semibold hover:underline"
      >
        {se.exerciseNameSnapshot}
      </Link>
      <ExerciseCard
        sessionExercise={se}
        loggedSets={exData.loggedSets}
        units={effectiveUnits}
        historyData={historyData}
        extraHistory={null}
        onSetTap={(bi, si) => onSetTap(se, bi, si)}
        readOnly
        hideHeader
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
  const historyData = useExerciseHistory(
    sessionExercise.origin === "routine" ? sessionExercise : undefined,
    effectiveUnits
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
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { useExtraHistory } from "@/shared/hooks/useExtraHistory";
import { db } from "@/db/database";
import { logSet, editSet, deleteSet, type SetLogInput } from "@/services/set-service";
import { addExtraExercise, finishSession, discardSession } from "@/services/session-service";
import { setUnitOverride } from "@/services/settings-service";
import { getEffectiveUnit } from "@/domain/unit-helpers";
import { useExercisePersonalBests } from "@/shared/hooks/useExercisePersonalBests";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ExerciseCard } from "./ExerciseCard";
import { SetLogSheet } from "./SetLogSheet";
import { SupersetGroup } from "./SupersetGroup";
import { ExercisePicker } from "./ExercisePicker";
import { WorkoutFooter } from "./WorkoutFooter";
import { SessionHeader } from "./SessionHeader";
import { SessionProgress } from "./SessionProgress";
import { FinishCelebration } from "./FinishCelebration";
import { RestTimerBar } from "./RestTimerBar";
import {
  getRestTimerStartAfterNewSet,
  getRestRemainingSec,
  type ActiveRestTimer,
  type RestTimerStart,
} from "./lib/rest-timer";
import { getSlotOrdinal, isRoundComplete } from "./lib/superset-rhythm";
import { formatQuickTarget, type QuickTarget } from "./lib/quick-target";
import { isNewPersonalBest } from "@/domain/personal-records";
import { EmptyState } from "@/shared/components/EmptyState";
import { Dumbbell } from "@/shared/icons";
import { toast } from "sonner";
import { computeSessionVolumeKg } from "@/shared/lib/sessionStats";
import type { SessionExercise, LoggedSet } from "@/domain/types";

function computeElapsedSec(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function computeRestRemainingSec(timer: ActiveRestTimer): number {
  return getRestRemainingSec(timer, Date.now());
}

function makeRunningTimer(start: RestTimerStart, loggedSetId: string | null): ActiveRestTimer {
  return { status: "running", startedAtMs: Date.now(), loggedSetId, ...start };
}

export default function WorkoutScreen() {
  const activeSession = useActiveSession();
  const settings = useSettings();
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  type CelebrationStats = {
    sets: number;
    volumeKg: number;
    durationMin: number | null;
  };
  const [celebration, setCelebration] = useState<{
    open: boolean;
    stats: CelebrationStats | null;
  }>({ open: false, stats: null });

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  // Rest timer — ephemeral UI state (never persisted, resets on reload).
  // Stored as "running"; the effective status is derived at render time from
  // the shared 1-second tick below, flipping to "done" when remaining <= 0.
  const [restTimer, setRestTimer] = useState<ActiveRestTimer | null>(null);

  // Ticking elapsed seconds for the header. `tick` exists solely to drive
  // re-renders every second; `elapsedSec` is derived from `startedAt` at render
  // time so it's always accurate the moment the session arrives.
  const startedAt = activeSession?.session.startedAt;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const elapsedSec = startedAt ? computeElapsedSec(startedAt) : 0;

  // Derived rest timer state — same tick, same derive-at-render pattern as
  // elapsedSec. Once remaining hits zero the timer renders as "done" until
  // dismissed or replaced by the next new-set save.
  const restRemainingSec = restTimer ? computeRestRemainingSec(restTimer) : 0;
  const restTimerForRender: ActiveRestTimer | null =
    restTimer && restRemainingSec <= 0 ? { ...restTimer, status: "done" } : restTimer;

  function handleRestSkip() {
    setRestTimer(null);
  }

  function handleRestAddSeconds(seconds: number) {
    setRestTimer((t) => (t ? { ...t, durationSec: t.durationSec + seconds } : t));
  }

  function handleCelebrationDismiss() {
    setCelebration({ open: false, stats: null });
    navigate("/");
  }

  if (!settings) return null;

  // While the celebration is open, render it in place of the workout screen
  // (session is already finished so activeSession will be null).
  if (celebration.open && celebration.stats) {
    return (
      <FinishCelebration
        open={celebration.open}
        stats={celebration.stats}
        units={settings.units}
        onDismiss={handleCelebrationDismiss}
      />
    );
  }

  // Empty state
  if (activeSession === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        heading="No active workout"
        body="Start one from Today to begin logging."
        action={{ label: "Go to Today", onClick: () => navigate("/"), variant: "default" }}
      />
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
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex,
    );
    setSheetExercise(se);
    setSheetBlockIndex(blockIndex);
    setSheetSetIndex(setIndex);
    setSheetExistingSet(existing);
    setSheetOpen(true);
  }

  /**
   * Shared create path for BOTH the sheet and quick-log: upsert-aware save
   * plus the rest-timer start rules. Timers start ONLY here (never from
   * effects observing loggedSets) so live-query re-renders, edits, and
   * deletes can never restart one.
   */
  async function saveNewSet(
    se: SessionExercise,
    blockIndex: number,
    setIndex: number,
    input: SetLogInput,
  ): Promise<{ savedSet: LoggedSet; created: boolean }> {
    // Stale-slot guard: the slot may have been logged elsewhere since this
    // interaction started (logSet upserts). If it already exists in the
    // current loggedSets snapshot, this save is really an update — no timer.
    const slotAlreadyLogged = (setsByExercise.get(se.id) ?? []).some(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex,
    );

    const savedSet = await logSet(db, se.id, blockIndex, setIndex, input);
    if (slotAlreadyLogged) return { savedSet, created: false };

    const partner =
      se.groupType === "superset" && se.supersetGroupId !== null
        ? sessionExercises.find(
            (other) =>
              other.id !== se.id &&
              other.supersetGroupId === se.supersetGroupId,
          )
        : undefined;

    let supersetRoundJustCompleted = false;
    let supersetRoundOrdinal: number | null = null;
    if (partner) {
      // The loggedSets snapshot predates this save — include the saved set so
      // the round check sees our side of the pair.
      const augmented = new Map(setsByExercise);
      augmented.set(se.id, [...(setsByExercise.get(se.id) ?? []), savedSet]);
      const ordinal = getSlotOrdinal(se, blockIndex, setIndex);
      supersetRoundOrdinal = ordinal;
      supersetRoundJustCompleted = isRoundComplete({
        exercises: [se, partner],
        setsByExercise: augmented,
        ordinal,
      });
    }

    const start = getRestTimerStartAfterNewSet({
      session,
      exerciseName: se.exerciseNameSnapshot,
      isSupersetMember: partner !== undefined,
      supersetRoundJustCompleted,
      supersetRoundOrdinal,
    });
    if (start) {
      setRestTimer(makeRunningTimer(start, savedSet.id));
    }
    return { savedSet, created: true };
  }

  async function handleSave(input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
    isPersonalRecord: boolean;
  }) {
    if (!sheetExercise) return;
    if (sheetExistingSet) {
      // Edit path — never starts or restarts the rest timer.
      await editSet(db, sheetExistingSet.id, input);
      return;
    }
    await saveNewSet(sheetExercise, sheetBlockIndex, sheetSetIndex, input);
  }

  /**
   * One-tap accept from a primed row. Routes through the same create path as
   * the sheet (identical timer/superset/upsert semantics — invariant 9), then
   * offers an 8 s undo that deletes the set and cancels only the rest timer
   * that this very save started.
   */
  async function handleQuickLog(
    se: SessionExercise,
    blockIndex: number,
    setIndex: number,
    input: SetLogInput,
  ) {
    try {
      const { savedSet, created } = await saveNewSet(se, blockIndex, setIndex, input);
      if (!created) return;
      const display = formatQuickTarget(input, getEffectiveUnit(se.unitOverride, units));
      toast(`⏺ Logged ${display}`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              await deleteSet(db, savedSet.id);
              setRestTimer((t) => (t && t.loggedSetId === savedSet.id ? null : t));
            })();
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log set");
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

  // Count prescribed + unlogged
  const totalPrescribed = sessionExercises.reduce(
    (sum, se) => sum + se.setBlocksSnapshot.reduce((s, b) => s + b.count, 0),
    0,
  );
  const loggedRoutine = loggedSets.filter((ls) => ls.origin === "routine").length;
  const unloggedCount = totalPrescribed - loggedRoutine;

  async function handleFinish() {
    const startedAt = session.startedAt;
    const setsCount = loggedSets.length;
    const volumeKg = computeSessionVolumeKg(loggedSets);

    await finishSession(db, session.id);

    const freshSession = await db.sessions.get(session.id);
    const finishedAt = freshSession?.finishedAt ?? new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const durationMin = durationMs >= 60_000 ? Math.round(durationMs / 60_000) : null;

    setCelebration({
      open: true,
      stats: { sets: setsCount, volumeKg, durationMin },
    });
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
          other.id !== se.id && other.supersetGroupId === se.supersetGroupId,
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
    <div className="flex h-full flex-col">
      <SessionHeader
        dayId={session.dayId}
        dayLabel={session.dayLabelSnapshot}
        elapsedSec={elapsedSec}
        onClose={() => navigate("/")}
      />
      <SessionProgress totalSets={totalPrescribed} loggedSets={loggedRoutine} />

      {restTimerForRender && (
        <RestTimerBar
          timer={restTimerForRender}
          remainingSec={restRemainingSec}
          onSkip={handleRestSkip}
          onAddSeconds={handleRestAddSeconds}
        />
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
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
                onQuickLog={handleQuickLog}
              />
            );
          }
          return (
            <SupersetGroup
              key={i}
              exercises={group.exercises}
              setsByExercise={setsByExercise}
            >
              {group.exercises.map((se) => (
                <ExerciseCardWithHistory
                  key={se.id}
                  sessionExercise={se}
                  loggedSets={setsByExercise.get(se.id) ?? []}
                  globalUnits={units}
                  onSetTap={(bi, si) => handleSetTap(se, bi, si)}
                  onQuickLog={handleQuickLog}
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
        allLogged={totalPrescribed > 0 && unloggedCount === 0}
      />

      {/* Set Log Sheet — keyed by exercise so field state and history queries
          can never leak from one exercise's sheet into the next (the
          cross-exercise prefill/poisoning bug). */}
      {sheetExercise && (
        <SetLogSheetWithHistory
          key={sheetExercise.id}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          blockSetsInSession={setsByExercise.get(sheetExercise.id) ?? []}
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
        title="Finish workout?"
        description={
          unloggedCount > 0
            ? `${unloggedCount} sets not logged — they will remain empty.`
            : "All sets logged. Ready to finish?"
        }
        confirmText="Finish workout"
        onConfirm={handleFinish}
      />

      {/* Discard Dialog */}
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard workout?"
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
  onQuickLog,
}: {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  globalUnits: "kg" | "lbs";
  onSetTap: (blockIndex: number, setIndex: number) => void;
  onQuickLog?: (
    se: SessionExercise,
    blockIndex: number,
    setIndex: number,
    input: SetLogInput,
  ) => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits,
  );
  const extraHistory = useExtraHistory(
    !isRoutine ? sessionExercise.exerciseId : undefined,
  );
  // Best-ever baselines for auto-PR on quick-logged sets — same rule as the
  // sheet's live detection. Extras never quick-log, so skip their query.
  const personalBests = useExercisePersonalBests(
    isRoutine && onQuickLog ? sessionExercise.exerciseId : undefined,
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
      onQuickLog={
        onQuickLog && isRoutine
          ? async (blockIndex, setIndex, target: QuickTarget) => {
              // Cardio never auto-PRs (mirrors the sheet's rule); otherwise a
              // quick-logged set gets the exact isNewPersonalBest verdict a
              // sheet save would.
              const isPR =
                sessionExercise.effectiveType !== "cardio" &&
                personalBests !== undefined
                  ? isNewPersonalBest(target, personalBests)
                  : false;
              await onQuickLog(sessionExercise, blockIndex, setIndex, {
                ...target,
                isPersonalRecord: isPR,
              });
            }
          : undefined
      }
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
    isPersonalRecord: boolean;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits,
  );
  const personalBests = useExercisePersonalBests(sessionExercise.exerciseId);

  const suggestion = historyData?.suggestions.find(
    (s) => s.blockIndex === blockIndex,
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
      blockSetsInSession={blockSetsInSession}
      personalBests={personalBests}
      historyLoaded={historyData !== undefined}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

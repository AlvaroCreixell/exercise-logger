import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, Trash2 } from "lucide-react";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useSettings } from "@/hooks/useSettings";
import ExerciseCard from "@/components/ExerciseCard";
import SupersetGroup from "@/components/SupersetGroup";
import ExercisePicker from "@/components/ExercisePicker";
// ERRATA P6-D: RestTimer removed from WorkoutScreen -- it's in AppShell
import ConfirmDialog from "@/components/ConfirmDialog";
import { db } from "@/db/database";
import { logSet, deleteSet } from "@/services/set-service";
import {
  finishSession,
  discardSession,
  addExtraExercise,
} from "@/services/session-service";
import { useTimerStore } from "@/stores/timer-store";
import { useLiveQuery } from "dexie-react-hooks";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { SetLogInput } from "@/services/set-service";
import type { ExerciseHistoryData } from "@/services/progression-service";
import {
  getExerciseHistoryData,
  getExtraExerciseHistory,
} from "@/services/progression-service";

// ERRATA P6-A: Compute flat round index for superset timer
function flatRoundIndex(blockIndex: number, setIndex: number, blocks: SetBlock[]): number {
  let idx = 0;
  for (let b = 0; b < blockIndex; b++) idx += blocks[b]!.count;
  return idx + setIndex;
}

/** Group exercises by superset groupId for rendering. */
interface RenderGroup {
  type: "single" | "superset";
  exercises: Array<{
    sessionExercise: SessionExercise;
    loggedSets: LoggedSet[];
  }>;
}

function buildRenderGroups(
  sessionExercises: SessionExercise[],
  loggedSets: LoggedSet[]
): RenderGroup[] {
  // Group logged sets by sessionExerciseId
  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const existing = setsByExercise.get(ls.sessionExerciseId);
    if (existing) {
      existing.push(ls);
    } else {
      setsByExercise.set(ls.sessionExerciseId, [ls]);
    }
  }

  const groups: RenderGroup[] = [];
  const processed = new Set<string>();

  for (const se of sessionExercises) {
    if (processed.has(se.id)) continue;

    if (se.groupType === "superset" && se.supersetGroupId) {
      // Find both members of the superset
      const members = sessionExercises.filter(
        (other) => other.supersetGroupId === se.supersetGroupId
      );
      for (const m of members) processed.add(m.id);

      groups.push({
        type: "superset",
        exercises: members
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((m) => ({
            sessionExercise: m,
            loggedSets: (setsByExercise.get(m.id) ?? []).sort(
              (a, b) => {
                if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
                return a.setIndex - b.setIndex;
              }
            ),
          })),
      });
    } else {
      processed.add(se.id);
      groups.push({
        type: "single",
        exercises: [
          {
            sessionExercise: se,
            loggedSets: (setsByExercise.get(se.id) ?? []).sort(
              (a, b) => {
                if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
                return a.setIndex - b.setIndex;
              }
            ),
          },
        ],
      });
    }
  }

  return groups;
}

export default function WorkoutScreen() {
  const activeSession = useActiveSession();
  const settings = useSettings();
  const navigate = useNavigate();
  const timerStart = useTimerStore((s) => s.start);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const units = settings?.units ?? "kg";

  // Load history data for all session exercises
  const historyMap = useLiveQuery(
    async () => {
      if (!activeSession) return new Map<string, ExerciseHistoryData>();
      const map = new Map<string, ExerciseHistoryData>();
      for (const se of activeSession.sessionExercises) {
        if (se.origin === "routine") {
          const data = await getExerciseHistoryData(db, se, units);
          map.set(se.id, data);
        }
      }
      return map;
    },
    [activeSession?.session?.id, units]
  );

  // Load extra history for extra exercises
  const extraHistoryMap = useLiveQuery(
    async () => {
      if (!activeSession) return new Map<string, Awaited<ReturnType<typeof getExtraExerciseHistory>>>();
      const map = new Map<string, Awaited<ReturnType<typeof getExtraExerciseHistory>>>();
      for (const se of activeSession.sessionExercises) {
        if (se.origin === "extra") {
          const data = await getExtraExerciseHistory(db, se.exerciseId);
          map.set(se.id, data);
        }
      }
      return map;
    },
    [activeSession?.session?.id]
  );

  // Render groups
  const renderGroups = useMemo(() => {
    if (!activeSession) return [];
    return buildRenderGroups(
      activeSession.sessionExercises,
      activeSession.loggedSets
    );
  }, [activeSession]);

  // Existing exercise IDs (for picker "already added" state)
  const existingExerciseIds = useMemo(() => {
    if (!activeSession) return new Set<string>();
    return new Set(activeSession.sessionExercises.map((se) => se.exerciseId));
  }, [activeSession]);

  const handleLogSet = useCallback(
    async (
      sessionExerciseId: string,
      blockIndex: number,
      setIndex: number,
      input: SetLogInput
    ) => {
      try {
        setError(null);
        if (!activeSession) return;

        // ERRATA P6-I: Check if this is a create (new set) vs update (editing existing)
        const existingSet = activeSession.loggedSets.find(
          (ls) =>
            ls.sessionExerciseId === sessionExerciseId &&
            ls.blockIndex === blockIndex &&
            ls.setIndex === setIndex
        );
        const isCreate = !existingSet;

        await logSet(db, sessionExerciseId, blockIndex, setIndex, input);

        // Only start timer on create, not on edit (spec: "editing does not affect timer")
        if (!isCreate) return;

        const se = activeSession.sessionExercises.find(
          (s) => s.id === sessionExerciseId
        );
        if (!se) return;

        if (se.groupType === "single") {
          // Single exercise: start timer after every newly logged set
          const duration = activeSession.session.restDefaultSecSnapshot;
          if (duration > 0) {
            timerStart(duration);
          }
          return;
        }

        // ERRATA P6-A: Superset round detection using flat round index
        if (se.supersetGroupId) {
          const partner = activeSession.sessionExercises.find(
            (s) =>
              s.supersetGroupId === se.supersetGroupId && s.id !== se.id
          );
          if (!partner) return;

          // ERRATA P6-F: Re-query logged sets after logSet to avoid stale data
          const freshSets = await db.loggedSets
            .where("sessionId")
            .equals(activeSession.session.id)
            .toArray();

          // Compute flat round index for the current set
          const currentFlatIdx = flatRoundIndex(blockIndex, setIndex, se.setBlocksSnapshot);

          // Check if partner has a set at the same flat round index
          const partnerHasRound = freshSets.some((ls) => {
            if (ls.sessionExerciseId !== partner.id) return false;
            const partnerFlatIdx = flatRoundIndex(ls.blockIndex, ls.setIndex, partner.setBlocksSnapshot);
            return partnerFlatIdx === currentFlatIdx;
          });

          if (partnerHasRound) {
            // Both sides now have this round logged
            const duration = activeSession.session.restSupersetSecSnapshot;
            if (duration > 0) {
              timerStart(duration);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to log set";
        setError(message);
      }
    },
    [activeSession, timerStart]
  );

  const handleDeleteSet = useCallback(async (loggedSetId: string) => {
    try {
      setError(null);
      await deleteSet(db, loggedSetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete set";
      setError(message);
    }
  }, []);

  const handleFinish = useCallback(async () => {
    if (!activeSession) return;
    try {
      setError(null);
      await finishSession(db, activeSession.session.id);
      useTimerStore.getState().dismiss();
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to finish workout";
      setError(message);
    }
  }, [activeSession, navigate]);

  const handleDiscard = useCallback(async () => {
    if (!activeSession) return;
    try {
      setError(null);
      await discardSession(db, activeSession.session.id);
      useTimerStore.getState().dismiss();
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to discard workout";
      setError(message);
    }
  }, [activeSession, navigate]);

  const handleAddExercise = useCallback(
    async (exercise: { id: string }) => {
      if (!activeSession) return;
      try {
        setError(null);
        await addExtraExercise(db, activeSession.session.id, exercise.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to add exercise";
        setError(message);
      }
    },
    [activeSession]
  );

  // Loading state
  if (activeSession === undefined || settings === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // No active session
  if (activeSession === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">No Active Workout</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start one from Today.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/")}
          >
            Go to Today
          </Button>
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="flex flex-1 flex-col pb-4">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background px-4 py-3 border-b border-border">
        <h1 className="text-base font-semibold">
          {activeSession.session.routineNameSnapshot}
        </h1>
        <p className="text-xs text-muted-foreground">
          Day {activeSession.session.dayId}:{" "}
          {activeSession.session.dayLabelSnapshot}
        </p>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}

        {renderGroups.map((group, idx) => {
          if (group.type === "superset") {
            return (
              <SupersetGroup
                key={idx}
                exercises={group.exercises.map((e) => ({
                  ...e,
                  historyData: historyMap?.get(e.sessionExercise.id),
                }))}
                units={units}
                isActiveSession={true}
                onLogSet={handleLogSet}
                onDeleteSet={handleDeleteSet}
              />
            );
          }

          const { sessionExercise, loggedSets } = group.exercises[0]!;
          return (
            <ExerciseCard
              key={sessionExercise.id}
              sessionExercise={sessionExercise}
              loggedSets={loggedSets}
              historyData={historyMap?.get(sessionExercise.id)}
              extraHistory={extraHistoryMap?.get(sessionExercise.id)}
              units={units}
              isActiveSession={true}
              onLogSet={handleLogSet}
              onDeleteSet={handleDeleteSet}
            />
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="space-y-2 px-4 pt-3 border-t border-border">
        <Button
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Exercise
        </Button>

        <div className="flex gap-2">
          <Button onClick={() => setFinishDialogOpen(true)} className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" />
            Finish Workout
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDiscardDialogOpen(true)}
            className="flex-1"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
        </div>
      </div>

      {/* Exercise picker */}
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddExercise}
        existingExerciseIds={existingExerciseIds}
      />

      {/* Finish confirmation */}
      <ConfirmDialog
        open={finishDialogOpen}
        onOpenChange={setFinishDialogOpen}
        title="Finish Workout?"
        description="Unlogged sets will remain empty. Your rotation will advance to the next day."
        confirmLabel="Finish"
        onConfirm={handleFinish}
      />

      {/* Discard confirmation */}
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard Workout?"
        description="All logged sets from this session will be permanently deleted. Your rotation will not advance."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={handleDiscard}
      />
    </div>
  );
}

import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/database";
import { useSettings } from "@/hooks/useSettings";
import SetLogForm from "@/components/SetLogForm";
import type { SessionExercise, LoggedSet } from "@/domain/types";
import type { SetLogInput } from "@/services/set-service";
import { editSet, deleteSet } from "@/services/set-service";
import { toDisplayWeight } from "@/domain/unit-conversion";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  const mins = Math.round((end - start) / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hrs}h ${remaining}m`;
}

export default function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const settings = useSettings();
  const units = settings?.units ?? "kg";

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<{
    loggedSet: LoggedSet;
    sessionExercise: SessionExercise;
  } | null>(null);

  const sessionData = useLiveQuery(async () => {
    if (!sessionId) return null;

    const session = await db.sessions.get(sessionId);
    if (!session) return null;

    const sessionExercises = await db.sessionExercises
      .where("sessionId")
      .equals(sessionId)
      .sortBy("orderIndex");

    const loggedSets = await db.loggedSets
      .where("sessionId")
      .equals(sessionId)
      .toArray();

    return { session, sessionExercises, loggedSets };
  }, [sessionId]);

  const handleEditSet = useCallback(async (input: SetLogInput) => {
    if (!editingSet) return;
    try {
      await editSet(db, editingSet.loggedSet.id, input);
    } catch (err: unknown) {
      console.error("Failed to edit set:", err);
    }
  }, [editingSet]);

  const handleDeleteSet = useCallback(async () => {
    if (!editingSet) return;
    try {
      await deleteSet(db, editingSet.loggedSet.id);
      setEditFormOpen(false);
    } catch (err: unknown) {
      console.error("Failed to delete set:", err);
    }
  }, [editingSet]);

  if (!sessionData || settings === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const { session, sessionExercises, loggedSets } = sessionData;

  // Group logged sets by sessionExerciseId
  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const existing = setsByExercise.get(ls.sessionExerciseId);
    if (existing) existing.push(ls);
    else setsByExercise.set(ls.sessionExerciseId, [ls]);
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/history")}
        className="mb-3 self-start"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>

      {/* Session header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold">
          Day {session.dayId}: {session.dayLabelSnapshot}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.routineNameSnapshot}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(session.startedAt)} &middot;{" "}
          {formatDuration(session.startedAt, session.finishedAt)}
        </p>
      </div>

      {/* Exercise cards with logged sets */}
      <div className="space-y-3">
        {sessionExercises.map((se) => {
          const sets = (setsByExercise.get(se.id) ?? []).sort((a, b) => {
            if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
            return a.setIndex - b.setIndex;
          });

          return (
            <Card key={se.id}>
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() =>
                    navigate(`/history/exercise/${se.exerciseId}`)
                  }
                >
                  {se.exerciseNameSnapshot}
                  {se.instanceLabel && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({se.instanceLabel})
                    </span>
                  )}
                </CardTitle>
                {se.notesSnapshot && (
                  <p className="text-xs text-muted-foreground">
                    {se.notesSnapshot}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                {sets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No sets logged
                  </p>
                ) : (
                  <div className="space-y-1">
                    {sets.map((ls) => (
                      <button
                        key={ls.id}
                        onClick={() => {
                          setEditingSet({
                            loggedSet: ls,
                            sessionExercise: se,
                          });
                          setEditFormOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-5">
                          {ls.setIndex + 1}
                        </span>
                        <span>
                          {ls.performedWeightKg !== null && (
                            <>
                              {toDisplayWeight(
                                ls.performedWeightKg,
                                se.effectiveEquipment,
                                units
                              )}
                              {units}{" "}
                            </>
                          )}
                          {ls.performedReps !== null && (
                            <>{ls.performedReps} reps</>
                          )}
                          {ls.performedDurationSec !== null && (
                            <>{ls.performedDurationSec}s</>
                          )}
                          {ls.performedDistanceM !== null && (
                            <> {ls.performedDistanceM}m</>
                          )}
                        </span>
                        {ls.tag && (
                          <span className="text-xs text-muted-foreground">
                            ({ls.tag})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit set form */}
      {editingSet && (
        <SetLogForm
          open={editFormOpen}
          onOpenChange={setEditFormOpen}
          effectiveType={editingSet.sessionExercise.effectiveType}
          effectiveEquipment={editingSet.sessionExercise.effectiveEquipment}
          units={units}
          prefill={{
            performedWeightKg: editingSet.loggedSet.performedWeightKg,
            performedReps: editingSet.loggedSet.performedReps,
            performedDurationSec: editingSet.loggedSet.performedDurationSec,
            performedDistanceM: editingSet.loggedSet.performedDistanceM,
          }}
          label={`${editingSet.sessionExercise.exerciseNameSnapshot} - Set ${editingSet.loggedSet.setIndex + 1}`}
          tag={editingSet.loggedSet.tag === "top" ? "Top" : editingSet.loggedSet.tag === "amrap" ? "AMRAP" : undefined}
          onSubmit={handleEditSet}
          onDelete={handleDeleteSet}
        />
      )}
    </div>
  );
}

import { useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/database";
import { useSettings } from "@/hooks/useSettings";
import { toDisplayWeight } from "@/domain/unit-conversion";
import type { LoggedSet, Session } from "@/domain/types";
import type { ExerciseEquipment } from "@/domain/enums";
import Dexie from "dexie";

interface SessionGroup {
  session: Session;
  sets: LoggedSet[];
  /** ERRATA P6-B: actual effectiveEquipment from the sessionExercise */
  effectiveEquipment: ExerciseEquipment;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ExerciseHistoryScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const settings = useSettings();
  const units = settings?.units ?? "kg";

  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId]
  );

  const sessionGroups = useLiveQuery(async () => {
    if (!exerciseId) return [];

    // Get all logged sets for this exercise
    const allSets = await db.loggedSets
      .where("[exerciseId+loggedAt]")
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .toArray();

    if (allSets.length === 0) return [];

    // Group by sessionId
    const bySession = new Map<string, LoggedSet[]>();
    for (const ls of allSets) {
      const existing = bySession.get(ls.sessionId);
      if (existing) existing.push(ls);
      else bySession.set(ls.sessionId, [ls]);
    }

    // Load sessions and filter to finished only
    const groups: SessionGroup[] = [];
    for (const [sessionId, sets] of bySession) {
      const session = await db.sessions.get(sessionId);
      if (session && session.status === "finished") {
        // ERRATA P6-B: Look up the actual effectiveEquipment from sessionExercises
        const sessionExercises = await db.sessionExercises
          .where("sessionId")
          .equals(sessionId)
          .toArray();
        const se = sessionExercises.find((s) => s.exerciseId === exerciseId);
        const effectiveEquipment: ExerciseEquipment = se?.effectiveEquipment ?? "barbell";

        groups.push({
          session,
          sets: sets.sort((a, b) => {
            if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
            return a.setIndex - b.setIndex;
          }),
          effectiveEquipment,
        });
      }
    }

    // Sort by session date descending
    groups.sort((a, b) => {
      const aTime = a.session.finishedAt ?? a.session.startedAt;
      const bTime = b.session.finishedAt ?? b.session.startedAt;
      return bTime.localeCompare(aTime);
    });

    return groups;
  }, [exerciseId]);

  if (sessionGroups === undefined || settings === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-3 self-start"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>

      <h1 className="mb-4 text-lg font-semibold">
        {exercise?.name ?? exerciseId}
      </h1>

      {sessionGroups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No history for this exercise.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessionGroups.map((group) => (
            <Card key={group.session.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {formatDate(group.session.startedAt)} &mdash; Day{" "}
                  {group.session.dayId}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-0.5">
                  {group.sets.map((ls) => (
                    <p key={ls.id} className="text-sm">
                      <span className="text-xs text-muted-foreground mr-2">
                        {ls.setIndex + 1}.
                      </span>
                      {ls.performedWeightKg !== null && (
                        <>
                          {/* ERRATA P6-B: use actual effectiveEquipment */}
                          {toDisplayWeight(ls.performedWeightKg, group.effectiveEquipment, units)}
                          {units}{" "}
                        </>
                      )}
                      {ls.performedReps !== null && (
                        <>x {ls.performedReps}</>
                      )}
                      {ls.performedDurationSec !== null && (
                        <>{ls.performedDurationSec}s</>
                      )}
                      {ls.performedDistanceM !== null && (
                        <> {ls.performedDistanceM}m</>
                      )}
                      {ls.tag && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({ls.tag})
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

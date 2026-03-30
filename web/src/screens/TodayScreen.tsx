import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Play, RotateCcw } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useRoutine } from "@/hooks/useRoutine";
import { useActiveSession } from "@/hooks/useActiveSession";
import DaySelector from "@/components/DaySelector";
import { db } from "@/db/database";
import {
  startSessionWithCatalog,
} from "@/services/session-service";
import type { RoutineEntry } from "@/domain/types";
import type { Exercise } from "@/domain/types";
import { useLiveQuery } from "dexie-react-hooks";

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "In progress";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  const mins = Math.round((end - start) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hrs}h ${remaining}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function countExercises(entries: RoutineEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.kind === "exercise") count++;
    else if (entry.kind === "superset") count += entry.items.length;
  }
  return count;
}

// ERRATA P6-H: Look up exercise names from catalog instead of slug-splitting
function getExerciseName(exerciseId: string, catalog: Map<string, Exercise>): string {
  const exercise = catalog.get(exerciseId);
  if (exercise) return exercise.name;
  // Fallback: slug to name
  return exerciseId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TodayScreen() {
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const navigate = useNavigate();

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ERRATA P6-H: Load exercise catalog for name lookups
  const exerciseCatalog = useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    const map = new Map<string, Exercise>();
    for (const ex of all) {
      map.set(ex.id, ex);
    }
    return map;
  }, []);

  // Load last finished session for this routine
  const lastSession = useLiveQuery(async () => {
    if (!settings?.activeRoutineId) return null;
    const sessions = await db.sessions
      .where("[routineId+startedAt]")
      .between(
        [settings.activeRoutineId, ""],
        [settings.activeRoutineId, "\uffff"]
      )
      .toArray();

    const finished = sessions.filter((s) => s.status === "finished");
    if (finished.length === 0) return null;

    finished.sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt));
    const session = finished[0]!;

    // Count exercises and sets
    const exercises = await db.sessionExercises
      .where("sessionId")
      .equals(session.id)
      .count();
    const sets = await db.loggedSets
      .where("sessionId")
      .equals(session.id)
      .count();

    return { session, exerciseCount: exercises, setCount: sets };
  }, [settings?.activeRoutineId]);

  // Loading state
  if (settings === undefined || activeSession === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // State 1: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">No Active Routine</h1>
        <p className="text-center text-sm text-muted-foreground">
          Import a routine YAML file and set it as active to start tracking
          workouts.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/settings")}>Import Routine</Button>
          <Button variant="outline" onClick={() => navigate("/settings")}>
            Set Active Routine
          </Button>
        </div>
      </div>
    );
  }

  // Still loading routine
  if (routine === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading routine...</p>
      </div>
    );
  }

  // State 3: Active session exists (invariant 2)
  if (activeSession !== null) {
    return (
      <div className="flex flex-1 flex-col p-4">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Resume Workout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {activeSession.session.routineNameSnapshot} &mdash; Day{" "}
              {activeSession.session.dayId}:{" "}
              {activeSession.session.dayLabelSnapshot}
            </p>
            <p className="text-xs text-muted-foreground">
              Started {formatDate(activeSession.session.startedAt)} &middot;{" "}
              {activeSession.loggedSets.length} sets logged
            </p>
            <Button
              onClick={() => navigate("/workout")}
              className="w-full mt-2"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Resume Workout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 2: Active routine, no active session
  const suggestedDayId = routine.nextDayId;
  const effectiveDayId = selectedDayId ?? suggestedDayId;
  const day = routine.days[effectiveDayId];
  const catalog = exerciseCatalog ?? new Map<string, Exercise>();

  async function handleStartWorkout() {
    if (!routine || starting) return;
    setStarting(true);
    setError(null);

    try {
      await startSessionWithCatalog(db, routine, effectiveDayId);
      navigate("/workout");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start workout";
      setError(message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Routine name */}
      <div>
        <h1 className="text-lg font-semibold">{routine.name}</h1>
      </div>

      {/* Day selector with override */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Select workout day:</p>
        <DaySelector
          days={routine.days}
          dayOrder={routine.dayOrder}
          suggestedDayId={suggestedDayId}
          selectedDayId={effectiveDayId}
          onSelect={setSelectedDayId}
        />
      </div>

      {/* Day preview */}
      {day && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Day {effectiveDayId}: {day.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              {countExercises(day.entries)} exercises
            </p>
            <ul className="space-y-0.5 text-sm">
              {day.entries.map((entry, idx) => {
                if (entry.kind === "exercise") {
                  return (
                    <li key={idx} className="text-muted-foreground">
                      {getExerciseName(entry.exerciseId, catalog)}
                    </li>
                  );
                }
                return (
                  <li key={idx} className="text-muted-foreground">
                    <span className="text-xs font-medium text-foreground/60">
                      SS:{" "}
                    </span>
                    {entry.items
                      .map((item) => getExerciseName(item.exerciseId, catalog))
                      .join(" / ")}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Start button */}
      <Button
        onClick={handleStartWorkout}
        disabled={starting}
        className="w-full"
        size="lg"
      >
        <Play className="mr-2 h-4 w-4" />
        {starting ? "Starting..." : "Start Workout"}
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Separator />

      {/* Last session summary */}
      {lastSession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Last Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Day {lastSession.session.dayId}:{" "}
              {lastSession.session.dayLabelSnapshot}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(lastSession.session.startedAt)} &middot;{" "}
              {formatDuration(
                lastSession.session.startedAt,
                lastSession.session.finishedAt
              )}{" "}
              &middot; {lastSession.exerciseCount} exercises &middot;{" "}
              {lastSession.setCount} sets
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cardio notes */}
      {routine.cardio && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Cardio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {routine.cardio.notes && (
              <p className="text-xs text-muted-foreground">
                {routine.cardio.notes}
              </p>
            )}
            {routine.cardio.options.map((opt, idx) => (
              <p key={idx} className="text-sm">
                <span className="font-medium">{opt.name}:</span>{" "}
                <span className="text-muted-foreground">{opt.detail}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

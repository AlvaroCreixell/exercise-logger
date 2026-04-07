import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DaySelector } from "./DaySelector";
import { DayPreview } from "./DayPreview";
import { LastSessionCard } from "./LastSessionCard";

export default function TodayScreen() {
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const lastSession = useLastSession(settings?.activeRoutineId);
  const navigate = useNavigate();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  if (!settings) return null;

  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-bold">No Active Routine</h1>
        <p className="text-sm text-muted-foreground text-center">
          Import a routine in Settings to get started.
        </p>
        <Link to="/settings">
          <Button variant="outline">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  if (routine === undefined) return null;

  // State C: Active session exists
  if (activeSession) {
    const elapsed = Math.round(
      (Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000
    );
    return (
      <div className="p-4">
        <Card
          className="border-info bg-info-soft cursor-pointer"
          onClick={() => navigate("/workout")}
        >
          <CardContent className="py-4">
            <h2 className="text-base font-semibold">Resume Workout</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSession.session.dayLabelSnapshot} &middot;{" "}
              {activeSession.session.routineNameSnapshot}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {elapsed} min &middot; {activeSession.sessionExercises.length} exercises
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State B: Routine active, no session
  const dayId = selectedDayId ?? routine.nextDayId ?? routine.dayOrder[0]!;
  const day = routine.days[dayId];

  async function handleStart() {
    setStarting(true);
    try {
      await startSessionWithCatalog(db, routine!, dayId);
      navigate("/workout");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h1 className="text-xl font-bold">{routine.name}</h1>

        <DaySelector
          routine={routine}
          selectedDayId={dayId}
          onSelectDay={setSelectedDayId}
        />

        {day && <DayPreview day={day} />}

        {routine.cardio && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Cardio
            </p>
            {routine.cardio.notes && (
              <p className="text-xs text-muted-foreground">{routine.cardio.notes}</p>
            )}
          </div>
        )}

        {lastSession && <LastSessionCard session={lastSession} />}
      </div>

      <div className="sticky bottom-0 border-t bg-background p-4 pb-[env(safe-area-inset-bottom)]">
        <Button className="w-full" size="lg" onClick={handleStart} disabled={starting}>
          {starting ? "Starting..." : "Start Workout"}
        </Button>
      </div>
    </div>
  );
}

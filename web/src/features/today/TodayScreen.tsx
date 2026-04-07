import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
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

  // Live elapsed time for active session
  const [elapsed, setElapsed] = useState(() =>
    activeSession
      ? Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000)
      : 0
  );

  useEffect(() => {
    if (!activeSession) return;
    setElapsed(Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000));
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000));
    }, 60_000);
    return () => clearInterval(id);
  }, [activeSession]);

  if (!settings) return null;

  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-bold">No Active Routine</h1>
        <p className="text-sm text-muted-foreground text-center">
          Import a routine in Settings to get started.
        </p>
        <Link to="/settings" className={cn(buttonVariants({ variant: "outline" }))}>
          Go to Settings
        </Link>
      </div>
    );
  }

  if (routine === undefined) return null;

  // State C: Active session exists
  if (activeSession) {
    return (
      <div className="p-4">
        <Link to="/workout" className="block">
          <Card className="border-info bg-info-soft hover:bg-info-soft/80 transition-colors">
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
        </Link>
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
          <div className="rounded-lg bg-muted p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Cardio
            </p>
            {routine.cardio.notes && (
              <p className="text-sm text-foreground">{routine.cardio.notes}</p>
            )}
            {routine.cardio.options.length > 0 && (
              <ul className="space-y-1">
                {routine.cardio.options.map((opt, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{opt.name}</span>
                    {opt.detail && (
                      <span className="text-muted-foreground"> — {opt.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
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

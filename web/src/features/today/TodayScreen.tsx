import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck, Flame } from "lucide-react";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { useTrainingCadence } from "@/shared/hooks/useTrainingCadence";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/components/EmptyState";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { DaySelector } from "./DaySelector";
import { DayPreview } from "./DayPreview";
import { LastSessionCard } from "./LastSessionCard";
import type { RoutineDay } from "@/domain/types";

function estimateDayDurationMin(day: RoutineDay): number {
  let totalSets = 0;
  for (const entry of day.entries) {
    if (entry.kind === "exercise" && entry.setBlocks) {
      totalSets += entry.setBlocks.reduce((s, b) => s + b.count, 0);
    } else if (entry.kind === "superset" && entry.items) {
      for (const item of entry.items) {
        totalSets += item.setBlocks.reduce((s, b) => s + b.count, 0);
      }
    }
  }
  // ~2 min per set (setup + logging + rest), rounded up to nearest 5
  const rough = Math.ceil((totalSets * 2) / 5) * 5;
  return Math.max(10, rough);
}

export default function TodayScreen() {
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const lastSession = useLastSession(settings?.activeRoutineId);
  const cadence = useTrainingCadence();
  const navigate = useNavigate();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exerciseNames = new Map<string, string>();
  if (exercises) {
    for (const ex of exercises) {
      exerciseNames.set(ex.id, ex.name);
    }
  }

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
      <EmptyState
        icon={CalendarCheck}
        heading="No Active Routine"
        body="Import a routine in Settings to get started."
        action={{ label: "Go to Settings", onClick: () => navigate("/settings") }}
      />
    );
  }

  if (routine === undefined) return null;

  // State C: Active session exists
  if (activeSession) {
    return (
      <div className="p-5">
        <Link to="/workout" className="block">
          <Card className="border border-info bg-info-soft hover:bg-info-soft/80 transition-colors">
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

  const dayDisplayName = day?.label ?? dayId;
  const firstTwoNames = day
    ? day.entries
        .flatMap((e) => (e.kind === "exercise" ? [e] : e.items))
        .slice(0, 2)
        .map((e) => exerciseNames.get(e.exerciseId) ?? e.exerciseId.replace(/-/g, " "))
    : [];
  const estMin = day ? estimateDayDurationMin(day) : 0;
  const remainingCount = day
    ? day.entries.flatMap((e) => (e.kind === "exercise" ? [e] : e.items)).length - firstTwoNames.length
    : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Training cadence eyebrow — uses the same `>= 3` threshold as
            LastSessionCard ribbon for a consistent "strong week" signal.
            Uses the Lucide Flame icon (not the `🔥` emoji) to stay consistent
            with LastSessionCard. */}
        {cadence && cadence.sessionsLast7Days >= 3 && (
          <SectionHeader className="!text-accent-warm inline-flex items-center gap-1.5">
            <Flame className="h-3 w-3" strokeWidth={2.5} />
            {cadence.sessionsLast7Days} sessions this week
          </SectionHeader>
        )}

        {/* Hero card */}
        <div className="border-2 border-border-strong bg-primary text-primary-foreground p-5 space-y-3">
          <SectionHeader className="!text-primary-foreground/70">
            Today · Day {dayId}
          </SectionHeader>
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            {dayDisplayName}
          </h1>
          {firstTwoNames.length > 0 && (
            <div className="space-y-0.5 text-sm">
              {firstTwoNames.map((name) => (
                <p key={name} className="font-medium truncate">{name}</p>
              ))}
              {remainingCount > 0 && (
                <p className="text-primary-foreground/60 text-xs">
                  + {remainingCount} more
                </p>
              )}
            </div>
          )}
          <Button
            variant="cta"
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? "Starting..." : "▶ Start Workout"}
          </Button>
          <p className="text-xs text-primary-foreground/60 tabular-nums text-center">
            ~{estMin} min
          </p>
        </div>

        {/* Cardio */}
        {routine.cardio && (
          <div className="bg-muted p-3 space-y-1.5">
            <SectionHeader>Cardio</SectionHeader>
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

        {/* Last session */}
        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}

        {/* Below-fold: switch day */}
        <div className="space-y-3 pt-2">
          <SectionHeader>Switch day</SectionHeader>
          <DaySelector
            routine={routine}
            selectedDayId={dayId}
            onSelectDay={setSelectedDayId}
          />
          {day && <DayPreview day={day} exerciseNames={exerciseNames} />}
        </div>
      </div>
    </div>
  );
}

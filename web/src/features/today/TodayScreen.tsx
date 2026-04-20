import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck } from "lucide-react";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { useTrainingCadence } from "@/shared/hooks/useTrainingCadence";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/components/EmptyState";
import { StreakPill } from "./StreakPill";
import { TodayHeroCard } from "./TodayHeroCard";
import { DaySelector } from "./DaySelector";
import { LastSessionCard } from "./LastSessionCard";
import { deriveDayMuscleGroups } from "./lib/muscleGroups";
import { formatTodayEyebrow } from "./lib/formatDate";
import type { Exercise, RoutineDay } from "@/domain/types";

function firstExerciseFromDay(
  day: RoutineDay,
  exerciseNames: Map<string, string>,
): string | null {
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      return exerciseNames.get(entry.exerciseId) ?? entry.exerciseId;
    }
    const first = entry.items[0];
    if (first) return exerciseNames.get(first.exerciseId) ?? first.exerciseId;
  }
  return null;
}

function countSets(day: RoutineDay): number {
  let total = 0;
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      total += entry.setBlocks.reduce((s, b) => s + b.count, 0);
    } else {
      for (const item of entry.items) {
        total += item.setBlocks.reduce((s, b) => s + b.count, 0);
      }
    }
  }
  return total;
}

function countExercises(day: RoutineDay): number {
  return day.entries.reduce(
    (n, e) => n + (e.kind === "exercise" ? 1 : e.items.length),
    0,
  );
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
  const exercisesById = useMemo(() => {
    const m = new Map<string, Exercise>();
    if (exercises) for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);
  const exerciseNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, ex] of exercisesById) m.set(id, ex.name);
    return m;
  }, [exercisesById]);

  // Live elapsed time for active session
  const [elapsed, setElapsed] = useState(() =>
    activeSession
      ? Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000)
      : 0,
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
        heading="No active routine"
        body="Import a routine in Settings to get started."
        action={{ label: "Go to Settings", onClick: () => navigate("/settings") }}
      />
    );
  }

  if (routine === undefined) return null;

  // State C: Active session — minimal Resume card.
  if (activeSession) {
    return (
      <div className="p-5 space-y-5">
        <Link to="/workout" className="block">
          <Card className="border border-sage bg-sage-soft/50 hover:bg-sage-soft transition-colors">
            <CardContent className="space-y-1 p-5">
              <p className="text-eyebrow text-sage-deep">In progress</p>
              <h2 className="font-heading text-xl font-bold tracking-tight">
                Resume workout
              </h2>
              <p className="text-meta flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 rounded-full bg-sage"
                />
                {elapsed} min · {activeSession.session.dayLabelSnapshot}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  }

  // State B: Normal — routine active, no session.
  const todayId = routine.nextDayId ?? routine.dayOrder[0]!;
  const selectedId = selectedDayId ?? todayId;
  const selectedDay = routine.days[selectedId];
  const isToday = selectedId === todayId;

  async function handleStart() {
    if (!isToday) return; // Day switcher previews only — Start targets nextDayId.
    setStarting(true);
    try {
      await startSessionWithCatalog(db, routine!, selectedId);
      navigate("/workout");
    } finally {
      setStarting(false);
    }
  }

  const muscleGroups = selectedDay ? deriveDayMuscleGroups(selectedDay, exercisesById) : [];
  const exerciseCount = selectedDay ? countExercises(selectedDay) : 0;
  const setCount = selectedDay ? countSets(selectedDay) : 0;
  const firstExerciseName = selectedDay ? firstExerciseFromDay(selectedDay, exerciseNames) : null;
  const dayTitle = selectedDay?.label ?? selectedId;
  const eyebrow = isToday ? `TODAY · DAY ${selectedId.toUpperCase()}` : `DAY ${selectedId.toUpperCase()} · PREVIEW`;
  const streakCount = cadence?.sessionsLast7Days ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <p className="text-eyebrow text-ink-3">{formatTodayEyebrow(new Date())}</p>

        <h1 className="text-hero-serif italic text-foreground">Hello.</h1>

        <StreakPill count={streakCount} />

        <TodayHeroCard
          dayLabelEyebrow={eyebrow}
          dayTitle={dayTitle}
          muscleGroups={muscleGroups}
          exerciseCount={exerciseCount}
          setCount={setCount}
          firstExerciseName={firstExerciseName}
          ctaLabel={isToday ? "▶ Start workout" : "Switch to today to start"}
          onCtaClick={handleStart}
          ctaDisabled={starting || !isToday}
          resumeMeta={null}
        />

        <div className="space-y-3 pt-2">
          <p className="text-eyebrow text-ink-3">Switch day</p>
          <DaySelector
            routine={routine}
            selectedDayId={selectedId}
            onSelectDay={setSelectedDayId}
          />
        </div>

        {lastSession && <LastSessionCard session={lastSession} cadence={cadence} />}
      </div>
    </div>
  );
}

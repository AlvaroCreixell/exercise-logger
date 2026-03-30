import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  const mins = Math.round((end - start) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hrs}h ${remaining}m`;
}

interface SessionSummary {
  id: string;
  routineNameSnapshot: string;
  dayId: string;
  dayLabelSnapshot: string;
  startedAt: string;
  finishedAt: string | null;
  exerciseCount: number;
  setCount: number;
}

export default function HistoryScreen() {
  const navigate = useNavigate();

  const sessions = useLiveQuery(async () => {
    const allSessions = await db.sessions.toArray();
    const finished = allSessions.filter((s) => s.status === "finished");

    // Sort by finishedAt descending
    finished.sort((a, b) => {
      const aTime = a.finishedAt ?? a.startedAt;
      const bTime = b.finishedAt ?? b.startedAt;
      return bTime.localeCompare(aTime);
    });

    // Load counts for each session
    const summaries: SessionSummary[] = [];
    for (const session of finished) {
      const exerciseCount = await db.sessionExercises
        .where("sessionId")
        .equals(session.id)
        .count();
      const setCount = await db.loggedSets
        .where("sessionId")
        .equals(session.id)
        .count();
      summaries.push({
        id: session.id,
        routineNameSnapshot: session.routineNameSnapshot,
        dayId: session.dayId,
        dayLabelSnapshot: session.dayLabelSnapshot,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        exerciseCount,
        setCount,
      });
    }

    return summaries;
  });

  if (sessions === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">No History Yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete a workout to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <h1 className="mb-4 text-lg font-semibold">History</h1>

      <div className="space-y-2">
        {sessions.map((session) => (
          <Card
            key={session.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/history/${session.id}`)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Day {session.dayId}: {session.dayLabelSnapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.routineNameSnapshot}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(session.startedAt)}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDuration(session.startedAt, session.finishedAt)} &middot;{" "}
                {session.exerciseCount} exercises &middot; {session.setCount}{" "}
                sets
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

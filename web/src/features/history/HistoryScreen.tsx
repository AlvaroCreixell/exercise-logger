import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { SessionCard } from "./SessionCard";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();

  if (summaries === undefined) return null;

  if (summaries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <h1 className="text-xl font-bold">No History Yet</h1>
        <p className="text-sm text-muted-foreground">
          Complete a workout to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-bold">History</h1>
      {summaries.map((summary) => (
        <SessionCard key={summary.session.id} summary={summary} />
      ))}
    </div>
  );
}

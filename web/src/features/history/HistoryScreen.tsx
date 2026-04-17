import { History } from "lucide-react";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { EmptyState } from "@/shared/components/EmptyState";
import { SessionCard } from "./SessionCard";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();

  if (summaries === undefined) return null;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No History Yet"
        body="Complete a workout to see it here."
      />
    );
  }

  return (
    <div className="p-5 space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight font-heading">History</h1>
      {summaries.map((summary) => (
        <SessionCard key={summary.session.id} summary={summary} />
      ))}
    </div>
  );
}

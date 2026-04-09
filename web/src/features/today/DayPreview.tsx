import type { RoutineDay, SetBlock } from "@/domain/types";

interface DayPreviewProps {
  day: RoutineDay;
  exerciseNames: Map<string, string>;
}

function formatSetSummary(setBlocks: SetBlock[]): string {
  if (setBlocks.length === 0) return "";
  return setBlocks
    .map((b) => {
      const tag = b.tag === "top" ? "top" : b.tag === "amrap" ? "AMRAP" : "";
      const range = b.exactValue != null
        ? `${b.exactValue}`
        : b.minValue != null && b.maxValue != null
        ? `${b.minValue}-${b.maxValue}`
        : "";
      return tag ? `${b.count} ${tag}` : `${b.count} x ${range}`;
    })
    .join(" + ");
}

function displayName(exerciseId: string, lookup: Map<string, string>): string {
  return lookup.get(exerciseId) ?? exerciseId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DayPreview({ day, exerciseNames }: DayPreviewProps) {
  return (
    <div className="border-t border-border-strong pt-3">
      <div className="space-y-1.5">
        {day.entries.map((entry) => {
          if (entry.kind === "exercise") {
            return (
              <div key={entry.entryId} className="flex items-baseline justify-between gap-2 border-b border-border py-1">
                <span className="text-sm font-semibold uppercase tracking-wide truncate">
                  {displayName(entry.exerciseId, exerciseNames)}
                  {entry.instanceLabel ? ` (${entry.instanceLabel})` : ""}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatSetSummary(entry.setBlocks)}
                </span>
              </div>
            );
          }
          return (
            <div key={entry.groupId} className="border-l-2 border-cta pl-4 space-y-1">
              {entry.items.map((item) => (
                <div key={item.entryId} className="flex items-baseline justify-between gap-2 border-b border-border py-1">
                  <span className="text-sm font-semibold uppercase tracking-wide truncate">
                    {displayName(item.exerciseId, exerciseNames)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatSetSummary(item.setBlocks)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

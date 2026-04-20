import { Card, CardContent } from "@/shared/ui/card";
import type { HistoryStats } from "@/shared/hooks/useHistoryStats";

interface HistoryStatsTileProps {
  stats: HistoryStats | undefined;
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-value tabular-nums text-foreground">
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-eyebrow text-ink-3">{label}</span>
    </div>
  );
}

export function HistoryStatsTile({ stats }: HistoryStatsTileProps) {
  if (!stats) return null;
  return (
    <Card className="py-0">
      <CardContent className="flex items-baseline gap-8 px-5 py-4">
        <Cell value={stats.sessionCount} label="Sessions" />
        <Cell value={stats.setCount} label="Sets" />
        <Cell value={stats.hours} label="Hours" />
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/shared/ui/card";
import type { UnitSystem } from "@/domain/enums";
import { formatVolume } from "@/shared/lib/sessionStats";

interface SessionDetailStatsTileProps {
  setCount: number;
  volumeKg: number;
  durationMin: number | null;
  units: UnitSystem;
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-value tabular-nums text-foreground">{value}</span>
      <span className="text-eyebrow text-ink-3">{label}</span>
    </div>
  );
}

export function SessionDetailStatsTile({
  setCount,
  volumeKg,
  durationMin,
  units,
}: SessionDetailStatsTileProps) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-baseline gap-8 px-5 py-4">
        <Cell value={String(setCount)} label="Sets" />
        <Cell value={formatVolume(volumeKg, units)} label="Volume" />
        <Cell value={durationMin != null ? `${durationMin}m` : "—"} label="Time" />
      </CardContent>
    </Card>
  );
}

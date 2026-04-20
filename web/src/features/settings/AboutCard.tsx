import { Card, CardContent } from "@/shared/ui/card";

export function AboutCard() {
  return (
    <Card className="py-0">
      <CardContent className="space-y-2 px-5 py-4">
        <p className="font-heading text-base font-bold text-foreground">
          Exercise Logger
        </p>
        <p className="text-sm italic text-ink-2">Offline-first gym logger</p>
        <p className="text-meta">
          Your workouts stay on this device. No account, no sync, no tracking.
        </p>
        <p className="text-meta tabular-nums">Version {__APP_VERSION__}</p>
      </CardContent>
    </Card>
  );
}

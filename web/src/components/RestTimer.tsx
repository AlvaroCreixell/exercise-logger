import { useTimerStore } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { X, Plus, RotateCcw } from "lucide-react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function RestTimer() {
  const { isRunning, secondsRemaining, dismiss, addThirty, restart } =
    useTimerStore();

  if (!isRunning) return null;

  const isLow = secondsRemaining <= 10;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 shadow-md transition-colors ${
        isLow
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary text-primary-foreground"
      }`}
      role="timer"
      aria-label={`Rest timer: ${formatTime(secondsRemaining)} remaining`}
    >
      <span className="text-lg font-bold tabular-nums">
        {formatTime(secondsRemaining)}
      </span>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={addThirty}
          className="text-inherit hover:bg-white/20"
          aria-label="Add 30 seconds"
        >
          <Plus className="mr-1 h-4 w-4" />
          30s
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={restart}
          className="text-inherit hover:bg-white/20"
          aria-label="Restart timer"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="text-inherit hover:bg-white/20"
          aria-label="Dismiss timer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

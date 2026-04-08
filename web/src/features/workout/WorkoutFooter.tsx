import { Button } from "@/shared/ui/button";

interface WorkoutFooterProps {
  onAddExercise: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}

export function WorkoutFooter({
  onAddExercise,
  onFinish,
  onDiscard,
}: WorkoutFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 border-t bg-background p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAddExercise}>
          Add Exercise
        </Button>
        <Button className="flex-1" onClick={onFinish}>
          Finish Workout
        </Button>
      </div>
      <button
        className="w-full mt-2 text-xs text-destructive hover:underline py-1"
        onClick={onDiscard}
      >
        Discard workout
      </button>
    </div>
  );
}

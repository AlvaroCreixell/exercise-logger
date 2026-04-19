import { Check } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface WorkoutFooterProps {
  onAddExercise: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  /** True when every prescribed set has been logged. Swaps the CTA into a
   *  success-tinted "Finish" state to give the user a clear terminal signal. */
  allLogged?: boolean;
}

export function WorkoutFooter({
  onAddExercise,
  onFinish,
  onDiscard,
  allLogged = false,
}: WorkoutFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 border-t-2 border-border-strong bg-background p-5 pb-[env(safe-area-inset-bottom)]">
      {allLogged && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-success-soft text-success text-xs font-semibold uppercase tracking-widest">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          All sets logged
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAddExercise}>
          Add Exercise
        </Button>
        <Button
          variant="cta"
          className={`flex-1 ${allLogged ? "!bg-success hover:!bg-success/90" : ""}`}
          onClick={onFinish}
        >
          {allLogged ? "Finish Workout ✓" : "Finish Workout"}
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

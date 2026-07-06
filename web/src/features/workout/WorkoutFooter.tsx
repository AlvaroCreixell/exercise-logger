import { Check } from "@/shared/icons";
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
    <div className="sticky bottom-0 z-10 border-t border-line bg-background p-5 pb-[env(safe-area-inset-bottom)]">
      {allLogged && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-accent-cli-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-cli-bright">
          <Check size={13} />
          All sets logged
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAddExercise}>
          Add exercise
        </Button>
        <Button
          variant="default"
          className={`flex-1 ${allLogged ? "!bg-success hover:!bg-success/90" : ""}`}
          onClick={onFinish}
        >
          {allLogged ? "Finish workout ✓" : "Finish workout"}
        </Button>
      </div>
      <button
        type="button"
        className="mt-2 w-full py-1 text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 rounded"
        onClick={onDiscard}
      >
        Discard workout
      </button>
    </div>
  );
}

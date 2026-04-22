import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";
import { cn } from "@/shared/lib/utils";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "Chest", label: "Chest" },
  { value: "Back", label: "Back" },
  { value: "Legs", label: "Legs" },
  { value: "Shoulders", label: "Shoulders" },
  { value: "Arms", label: "Arms" },
  { value: "Core", label: "Core" },
  { value: "Glutes", label: "Glutes" },
];

const skipChipCls =
  "inline-flex items-center justify-center rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 border border-[var(--line)] bg-paper text-ink hover:bg-sage-soft self-start";

export function PrioritiesStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const values = answer?.kind === "chip-multi" ? answer.values : [];
  const handleSkip = () => {
    onAnswer({ kind: "chip-multi", values: [] });
    queueMicrotask(onNext);
  };
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Any muscle groups to prioritize?"
      subtitle="We'll give these a bit more volume. Skip for a balanced routine."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <ChipMulti
          options={OPTIONS}
          selected={values}
          onChange={(next) => onAnswer({ kind: "chip-multi", values: next })}
          ariaLabel="Priorities"
        />
        <button type="button" onClick={handleSkip} className={cn(skipChipCls)}>
          Keep it balanced — skip
        </button>
      </div>
    </WizardShell>
  );
}

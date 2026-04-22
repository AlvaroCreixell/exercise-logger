import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";
import { TOTAL_STEPS } from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

export interface StepProps {
  stepIndex: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const OPTIONS: ChipOption[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

export function DistinctDaysStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const selected = answer?.kind === "chip" ? answer.value : null;
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Schedule"
      title="How many different workouts do you want in your rotation?"
      subtitle={
        "This is about variety, not frequency. For reference only: full-body = 1, Upper/Lower = 2, Push/Pull/Legs = 3, body-part split = 5. Your goals, equipment, and experience will shape the actual split — you don't need to prescribe one here."
      }
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="distinct-days"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Distinct days"
      />
    </WizardShell>
  );
}

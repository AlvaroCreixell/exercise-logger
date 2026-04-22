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
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
];

export function DaysPerWeekStep({
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
      title="How many days a week can you train?"
      subtitle="Count the days you'll actually show up — better to start lower and level up."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="days-per-week"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Days per week"
      />
    </WizardShell>
  );
}

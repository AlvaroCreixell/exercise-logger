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
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "75", label: "75 min" },
  { value: "90", label: "90 min" },
];

export function SessionLengthStep({
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
      title="How long is a typical session?"
      subtitle="Time you have for the whole workout — warm-up, lifts, everything."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipRow
        name="session-length"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Session length"
      />
    </WizardShell>
  );
}

import { WizardShell } from "@/features/onboarding/components/WizardShell";
import {
  ChipWithDescription,
} from "@/features/onboarding/components/ChipWithDescription";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";
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
  {
    value: "Yes",
    label: "Yes",
    description: "Use them where they fit",
  },
  {
    value: "Only if time-crunched",
    label: "Only if time-crunched",
    description: "Prefer single exercises when possible",
  },
  {
    value: "No",
    label: "No supersets",
    description: "I like one exercise at a time",
  },
];

export function SupersetsStep({
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
      category="Preferences"
      title="Are supersets okay?"
      subtitle="A superset pairs two exercises back-to-back with no rest — saves time, harder on recovery."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipWithDescription
        name="supersets"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Supersets"
      />
    </WizardShell>
  );
}

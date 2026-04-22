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
    value: "Beginner",
    label: "Beginner",
    description: "New to lifting, or back after a long break",
  },
  {
    value: "Intermediate",
    label: "Intermediate",
    description: "Training regularly for 6+ months, know the main lifts",
  },
  {
    value: "Advanced",
    label: "Advanced",
    description: "Several years of structured training",
  },
];

export function ExperienceStep({
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
      category="About you"
      title="How experienced are you with lifting?"
      subtitle="Honest is better than optimistic — the routine matches what you're ready for."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      hideNext
    >
      <ChipWithDescription
        name="experience"
        options={OPTIONS}
        selected={selected}
        onSelect={(v) => onAnswer({ kind: "chip", value: v })}
        autoAdvance
        onAdvance={onNext}
        ariaLabel="Experience"
      />
    </WizardShell>
  );
}

import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
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
  { value: "Barbell", label: "Barbell" },
  { value: "Dumbbells", label: "Dumbbells" },
  { value: "Machines", label: "Machines" },
  { value: "Cables", label: "Cables" },
  { value: "Kettlebells", label: "Kettlebells" },
  { value: "Resistance bands", label: "Resistance bands" },
  { value: "Pull-up bar", label: "Pull-up bar" },
  { value: "Bodyweight only", label: "Bodyweight only" },
];

export function EquipmentStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const values = answer?.kind === "chip-multi" ? answer.values : [];
  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Equipment"
      title="What equipment do you have access to?"
      subtitle="Tap everything you can use. If you train at a full gym, you can just tap them all."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      nextDisabled={values.length === 0}
    >
      <ChipMulti
        options={OPTIONS}
        selected={values}
        onChange={(next) => onAnswer({ kind: "chip-multi", values: next })}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    </WizardShell>
  );
}

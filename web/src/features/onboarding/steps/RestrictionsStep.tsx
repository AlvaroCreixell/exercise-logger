import { WizardShell } from "@/features/onboarding/components/WizardShell";
import { StepTextArea } from "@/features/onboarding/components/StepTextArea";
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

export function RestrictionsStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const value = answer?.kind === "text" ? answer.value : "";
  const skipped = answer?.kind === "text" && value === "";

  const handleSkip = () => {
    onAnswer({ kind: "text", value: "" });
    queueMicrotask(onNext);
  };

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="About you"
      title="Anything we should work around?"
      subtitle="Injuries, pain spots, or movements your body doesn't like. Totally skippable."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <StepTextArea
        ariaLabel="Restrictions"
        value={value}
        onChange={(v) => onAnswer({ kind: "text", value: v })}
        maxLength={300}
        showCounterAt={240}
        placeholder={`e.g., "No back squats — tweaked my lower back. Shoulders are sensitive overhead."`}
        skipChipLabel="All clear — skip"
        onSkip={handleSkip}
        skipped={skipped}
      />
    </WizardShell>
  );
}

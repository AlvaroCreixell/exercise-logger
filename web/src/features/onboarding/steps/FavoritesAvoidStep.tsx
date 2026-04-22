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

export function FavoritesAvoidStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const favorites =
    answer?.kind === "favorites-avoid" ? answer.favorites : "";
  const avoid = answer?.kind === "favorites-avoid" ? answer.avoid : "";

  const commit = (nextFavorites: string, nextAvoid: string) => {
    onAnswer({
      kind: "favorites-avoid",
      favorites: nextFavorites,
      avoid: nextAvoid,
    });
  };

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="Preferences"
      title="Any specific exercises to include or avoid?"
      subtitle="Optional. Helpful if you have a favorite lift or one that always hurts."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-3">LOVE (MUST-INCLUDE)</span>
          <StepTextArea
            ariaLabel="Love"
            value={favorites}
            onChange={(v) => commit(v, avoid)}
            maxLength={200}
            showCounterAt={160}
            placeholder={`e.g., "Back squat, bench press, pull-ups"`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-3">AVOID (SKIP THESE)</span>
          <StepTextArea
            ariaLabel="Avoid"
            value={avoid}
            onChange={(v) => commit(favorites, v)}
            maxLength={200}
            showCounterAt={160}
            placeholder={`e.g., "Deadlifts — bad back"`}
          />
        </div>
      </div>
    </WizardShell>
  );
}

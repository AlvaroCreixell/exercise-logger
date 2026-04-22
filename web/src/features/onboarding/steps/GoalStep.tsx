import { useState } from "react";
import { WizardShell } from "@/features/onboarding/components/WizardShell";
import {
  ChipRow,
  type ChipOption,
} from "@/features/onboarding/components/ChipRow";
import { Input } from "@/shared/ui/input";
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

const PRESETS: ChipOption[] = [
  { value: "Build muscle", label: "Build muscle" },
  { value: "Build strength", label: "Build strength" },
  { value: "Lose fat", label: "Lose fat" },
  { value: "Conditioning", label: "Conditioning" },
  { value: "General fitness", label: "General fitness" },
  { value: "Other", label: "Something else…" },
];

export function GoalStep({
  stepIndex,
  answer,
  onAnswer,
  onBack,
  onNext,
  onClose,
}: StepProps) {
  const isOther =
    answer?.kind === "chip-with-other" && answer.value === "Other";
  const answerText =
    answer?.kind === "chip-with-other" ? (answer.otherText ?? "") : "";

  const [localOtherActive, setOtherActive] = useState(isOther);
  const [otherText, setOtherText] = useState(answerText);
  // Derive the effective "Other is active" flag: the parent-held answer
  // (isOther) unions with local-only state (the user tapped "Something
  // else…" but hasn't typed yet, so no answer has been committed).
  const otherActive = localOtherActive || isOther;

  const selected =
    answer?.kind === "chip-with-other"
      ? answer.value
      : otherActive
        ? "Other"
        : null;

  const handleSelect = (value: string) => {
    if (value === "Other") {
      setOtherActive(true);
      return;
    }
    setOtherActive(false);
    onAnswer({ kind: "chip-with-other", value });
    queueMicrotask(onNext);
  };

  const handleOtherChange = (text: string) => {
    setOtherText(text);
    onAnswer({ kind: "chip-with-other", value: "Other", otherText: text });
  };

  const nextDisabled =
    answer === undefined ||
    (answer.kind === "chip-with-other" &&
      answer.value === "Other" &&
      otherText.trim() === "");

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      category="About you"
      title="What's your main goal?"
      subtitle="Pick the one that matters most right now. You can always adjust later by regenerating."
      onBack={onBack}
      onNext={onNext}
      onClose={onClose}
      nextDisabled={nextDisabled}
    >
      <div className="flex flex-col gap-3">
        <ChipRow
          name="goal"
          options={PRESETS}
          selected={selected}
          onSelect={handleSelect}
          ariaLabel="Primary goal"
        />
        {otherActive && (
          <Input
            aria-label="Your custom goal"
            maxLength={60}
            value={otherText}
            onChange={(e) => handleOtherChange(e.target.value)}
            placeholder="e.g., train for a triathlon"
            className="rounded-[var(--radius-card)] bg-paper"
          />
        )}
      </div>
    </WizardShell>
  );
}

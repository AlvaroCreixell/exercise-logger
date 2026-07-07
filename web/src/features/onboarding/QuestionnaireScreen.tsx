// Orchestrator binds reducer ↔ sessionStorage. Persistence of the generated
// prompt happens in HandoffScreen. Wizard sessionStorage clearing happens in:
//   1. HandoffScreen "Start over" (intentional reset).
//   2. HandoffScreen successful import (Stage-2 success).
//   3. Welcome screen "Start over" (the only first-run reset).
// This screen NEVER clears sessionStorage on exit — exit returns to the
// welcome screen so the user can resume later.

import { useEffect, useReducer } from "react";
import { useNavigate } from "react-router";
import {
  questionnaireReducer,
  initialWizardState,
  TOTAL_STEPS,
  type WizardState,
} from "@/features/onboarding/lib/questionnaire-state";
import {
  loadWizardState,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Answer, StepId } from "@/features/onboarding/lib/types";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";
import { ExperienceStep } from "@/features/onboarding/steps/ExperienceStep";
import { RestrictionsStep } from "@/features/onboarding/steps/RestrictionsStep";
import { DaysPerWeekStep } from "@/features/onboarding/steps/DaysPerWeekStep";
import { SessionLengthStep } from "@/features/onboarding/steps/SessionLengthStep";
import { DistinctDaysStep } from "@/features/onboarding/steps/DistinctDaysStep";
import { EquipmentStep } from "@/features/onboarding/steps/EquipmentStep";
import { PrioritiesStep } from "@/features/onboarding/steps/PrioritiesStep";
import { FavoritesAvoidStep } from "@/features/onboarding/steps/FavoritesAvoidStep";
import { SupersetsStep } from "@/features/onboarding/steps/SupersetsStep";
import { CardioStep } from "@/features/onboarding/steps/CardioStep";

const STEP_IDS: readonly StepId[] = [
  "goal",
  "experience",
  "restrictions",
  "daysPerWeek",
  "sessionLength",
  "distinctDays",
  "equipment",
  "priorities",
  "favoritesAvoid",
  "supersets",
  "cardio",
];

function initWizard(): WizardState {
  const resumed = loadWizardState();
  if (resumed !== null) return resumed;
  return initialWizardState;
}

export default function QuestionnaireScreen() {
  const [state, dispatch] = useReducer(
    questionnaireReducer,
    undefined as unknown as WizardState,
    initWizard
  );
  const navigate = useNavigate();

  useEffect(() => {
    saveWizardState(state);
  }, [state]);

  const onAnswer = (answer: Answer) => {
    const stepId = STEP_IDS[state.stepIndex];
    if (stepId !== undefined) {
      dispatch({ type: "answer", stepId, answer });
    }
  };

  const onBack = () => dispatch({ type: "back" });

  const onNext = () => {
    if (state.stepIndex >= TOTAL_STEPS - 1) {
      navigate("/onboarding/generate");
      return;
    }
    dispatch({ type: "next" });
  };

  const onClose = () => {
    navigate("/onboarding", { replace: true });
  };

  const stepProps = {
    stepIndex: state.stepIndex,
    answer: state.answers[STEP_IDS[state.stepIndex] as StepId],
    onAnswer,
    onBack,
    onNext,
    onClose,
  };

  switch (state.stepIndex) {
    case 0:
      return <GoalStep {...stepProps} />;
    case 1:
      return <ExperienceStep {...stepProps} />;
    case 2:
      return <RestrictionsStep {...stepProps} />;
    case 3:
      return <DaysPerWeekStep {...stepProps} />;
    case 4:
      return <SessionLengthStep {...stepProps} />;
    case 5:
      return <DistinctDaysStep {...stepProps} />;
    case 6:
      return <EquipmentStep {...stepProps} />;
    case 7:
      return <PrioritiesStep {...stepProps} />;
    case 8:
      return <FavoritesAvoidStep {...stepProps} />;
    case 9:
      return <SupersetsStep {...stepProps} />;
    case 10:
      return <CardioStep {...stepProps} />;
    default:
      return <GoalStep {...stepProps} />;
  }
}

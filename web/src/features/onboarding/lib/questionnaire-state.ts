// Pure reducer — no I/O, no clock, no storage. The orchestrator binds side
// effects (sessionStorage persistence, focus management) via useEffect.
//
// Frozen API contract — Sprint C's QuestionnaireScreen dispatches these
// actions, Sprint D's HandoffScreen inspects `answers` through it.

import type { Answer, Answers, StepId } from "./types";

/** 11 intake topics = 11 reducer steps. Welcome/name screen is a separate route. */
export const TOTAL_STEPS = 11;

export interface WizardState {
  /** 0 through TOTAL_STEPS - 1, inclusive. */
  stepIndex: number;
  answers: Answers;
}

export type WizardAction =
  | { type: "answer"; stepId: StepId; answer: Answer }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; to: number }
  | { type: "restart" };

export const initialWizardState: WizardState = {
  stepIndex: 0,
  answers: {},
};

export function questionnaireReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "answer":
      return {
        stepIndex: state.stepIndex,
        answers: { ...state.answers, [action.stepId]: action.answer },
      };
    case "next": {
      const next = Math.min(state.stepIndex + 1, TOTAL_STEPS - 1);
      return next === state.stepIndex ? state : { ...state, stepIndex: next };
    }
    case "back": {
      const prev = Math.max(state.stepIndex - 1, 0);
      return prev === state.stepIndex ? state : { ...state, stepIndex: prev };
    }
    case "jump": {
      const to = action.to;
      if (!Number.isInteger(to) || to < 0 || to >= TOTAL_STEPS) return state;
      if (to === state.stepIndex) return state;
      return { ...state, stepIndex: to };
    }
    case "restart":
      return initialWizardState;
  }
}

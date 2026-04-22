import { describe, it, expect } from "vitest";
import {
  TOTAL_STEPS,
  initialWizardState,
  questionnaireReducer,
  type WizardState,
  type WizardAction,
} from "@/features/onboarding/lib/questionnaire-state";
import type { Answer } from "@/features/onboarding/lib/types";

describe("questionnaireReducer", () => {
  describe("initial state", () => {
    it("starts at step 0 with no answers", () => {
      expect(initialWizardState).toEqual({ stepIndex: 0, answers: {} });
    });

    it("exports TOTAL_STEPS = 11 (matches StepId union)", () => {
      expect(TOTAL_STEPS).toBe(11);
    });
  });

  describe("action: answer", () => {
    it("stores a chip answer under the given StepId", () => {
      const next = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(next.answers.goal).toEqual({
        kind: "chip-with-other",
        value: "Build muscle",
      });
      expect(next.stepIndex).toBe(0);
    });

    it("stores a chip-multi answer verbatim (reducer does not enforce exclusivity)", () => {
      const answer: Answer = {
        kind: "chip-multi",
        values: ["Barbell", "Dumbbells"],
      };
      const next = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "equipment",
        answer,
      });
      expect(next.answers.equipment).toEqual(answer);
    });

    it("overwrites an existing answer for the same stepId", () => {
      const first = questionnaireReducer(initialWizardState, {
        type: "answer",
        stepId: "experience",
        answer: { kind: "chip", value: "Beginner" },
      });
      const second = questionnaireReducer(first, {
        type: "answer",
        stepId: "experience",
        answer: { kind: "chip", value: "Advanced" },
      });
      expect(second.answers.experience).toEqual({
        kind: "chip",
        value: "Advanced",
      });
    });

    it("preserves answers for other stepIds", () => {
      const base: WizardState = {
        stepIndex: 3,
        answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
      };
      const next = questionnaireReducer(base, {
        type: "answer",
        stepId: "daysPerWeek",
        answer: { kind: "chip", value: "3" },
      });
      expect(next.answers.goal).toEqual({
        kind: "chip-with-other",
        value: "Build muscle",
      });
      expect(next.answers.daysPerWeek).toEqual({ kind: "chip", value: "3" });
    });
  });

  describe("action: next", () => {
    it("increments stepIndex", () => {
      const next = questionnaireReducer(
        { stepIndex: 0, answers: {} },
        { type: "next" }
      );
      expect(next.stepIndex).toBe(1);
    });

    it("clamps at TOTAL_STEPS - 1 (= 10)", () => {
      const last: WizardState = { stepIndex: 10, answers: {} };
      expect(questionnaireReducer(last, { type: "next" }).stepIndex).toBe(10);
    });
  });

  describe("action: back", () => {
    it("decrements stepIndex", () => {
      const next = questionnaireReducer(
        { stepIndex: 5, answers: {} },
        { type: "back" }
      );
      expect(next.stepIndex).toBe(4);
    });

    it("clamps at 0", () => {
      expect(
        questionnaireReducer(initialWizardState, { type: "back" }).stepIndex
      ).toBe(0);
    });
  });

  describe("action: jump", () => {
    it("jumps to a valid in-range index", () => {
      const next = questionnaireReducer(initialWizardState, {
        type: "jump",
        to: 7,
      });
      expect(next.stepIndex).toBe(7);
    });

    it("returns the same state reference when `to` is out of range", () => {
      const base = { stepIndex: 2, answers: {} };
      expect(questionnaireReducer(base, { type: "jump", to: -1 })).toBe(base);
      expect(questionnaireReducer(base, { type: "jump", to: 11 })).toBe(base);
      expect(
        questionnaireReducer(base, { type: "jump", to: 2.5 })
      ).toBe(base);
    });
  });

  describe("action: restart", () => {
    it("returns initialWizardState regardless of current state", () => {
      const dirty: WizardState = {
        stepIndex: 9,
        answers: {
          goal: { kind: "chip-with-other", value: "Build muscle" },
          equipment: { kind: "chip-multi", values: ["Barbell"] },
        },
      };
      expect(questionnaireReducer(dirty, { type: "restart" })).toEqual(
        initialWizardState
      );
    });
  });

  describe("immutability", () => {
    it("does not mutate the input state on answer", () => {
      const base: WizardState = { stepIndex: 0, answers: {} };
      const before = JSON.stringify(base);
      questionnaireReducer(base, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(JSON.stringify(base)).toBe(before);
    });

    it("returns a new answers object on answer (referentially distinct)", () => {
      const base: WizardState = { stepIndex: 0, answers: {} };
      const next = questionnaireReducer(base, {
        type: "answer",
        stepId: "goal",
        answer: { kind: "chip-with-other", value: "Build muscle" },
      });
      expect(next.answers).not.toBe(base.answers);
    });
  });

  it("exhaustively handles all action types (type check only — compile is the assertion)", () => {
    const actions: WizardAction[] = [
      { type: "answer", stepId: "goal", answer: { kind: "chip-with-other", value: "X" } },
      { type: "next" },
      { type: "back" },
      { type: "jump", to: 4 },
      { type: "restart" },
    ];
    for (const a of actions) {
      expect(() => questionnaireReducer(initialWizardState, a)).not.toThrow();
    }
  });
});

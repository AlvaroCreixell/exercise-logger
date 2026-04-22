import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoritesAvoidStep } from "@/features/onboarding/steps/FavoritesAvoidStep";
import type { Answer } from "@/features/onboarding/lib/types";

function makeProps(overrides = {}) {
  return {
    stepIndex: 8,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("FavoritesAvoidStep", () => {
  it("typing in Love emits favorites-avoid; avoid defaults to ''", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    function Harness() {
      const [a, setA] = useState<Answer | undefined>(undefined);
      return (
        <FavoritesAvoidStep
          {...makeProps({
            answer: a,
            onAnswer: (ans: Answer) => {
              setA(ans);
              onAnswer(ans);
            },
          })}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: /love/i }), "deadlifts");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "favorites-avoid",
      favorites: "deadlifts",
      avoid: "",
    });
  });

  it("typing in Avoid preserves the existing favorites value", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    function Harness() {
      const [a, setA] = useState<Answer | undefined>({
        kind: "favorites-avoid",
        favorites: "squats",
        avoid: "",
      });
      return (
        <FavoritesAvoidStep
          {...makeProps({
            answer: a,
            onAnswer: (ans: Answer) => {
              setA(ans);
              onAnswer(ans);
            },
          })}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: /avoid/i }), "deadlifts");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "favorites-avoid",
      favorites: "squats",
      avoid: "deadlifts",
    });
  });
});

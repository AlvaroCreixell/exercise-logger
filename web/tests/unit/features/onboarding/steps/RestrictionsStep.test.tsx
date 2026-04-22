import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestrictionsStep } from "@/features/onboarding/steps/RestrictionsStep";
import type { Answer } from "@/features/onboarding/lib/types";

function makeProps(overrides = {}) {
  return {
    stepIndex: 2,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("RestrictionsStep", () => {
  it("typing emits {kind:'text', value}", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    function Harness() {
      const [a, setA] = useState<Answer | undefined>(undefined);
      return (
        <RestrictionsStep
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
    await user.type(screen.getByRole("textbox", { name: /restrictions/i }), "bad knee");
    expect(onAnswer).toHaveBeenLastCalledWith({ kind: "text", value: "bad knee" });
  });

  it("tapping the skip chip commits empty text and advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<RestrictionsStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByRole("button", { name: /all clear — skip/i }));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "text", value: "" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

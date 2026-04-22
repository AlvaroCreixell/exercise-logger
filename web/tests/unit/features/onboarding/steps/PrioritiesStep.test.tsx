import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrioritiesStep } from "@/features/onboarding/steps/PrioritiesStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 7,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("PrioritiesStep", () => {
  it("tapping the 'Back' chip emits chip-multi with values:['Back']", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<PrioritiesStep {...makeProps({ onAnswer })} />);
    // Both the WizardShell footer and a chip may be named "Back".
    // Disambiguate: the shell's Back button is disabled on step 0, but here
    // stepIndex=7 so both are enabled. Pick the chip via aria-pressed=false.
    const candidates = screen.getAllByRole("button", { name: /^back$/i });
    const chip = candidates.find((b) => b.getAttribute("aria-pressed") !== null);
    expect(chip).toBeDefined();
    await user.click(chip!);
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-multi",
      values: ["Back"],
    });
  });

  it("skip chip clears selection, emits empty values, and advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(
      <PrioritiesStep
        {...makeProps({
          answer: { kind: "chip-multi", values: ["Back", "Legs"] },
          onAnswer,
          onNext,
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: /keep it balanced — skip/i }));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip-multi", values: [] });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

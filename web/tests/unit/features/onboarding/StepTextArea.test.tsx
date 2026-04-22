import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepTextArea } from "@/features/onboarding/components/StepTextArea";

describe("StepTextArea", () => {
  it("does NOT render the counter when value length is below showCounterAt", () => {
    render(
      <StepTextArea
        value="short"
        onChange={() => {}}
        maxLength={300}
        showCounterAt={240}
        ariaLabel="Restrictions"
      />
    );
    expect(screen.queryByText(/\/\s*300/)).not.toBeInTheDocument();
  });

  it("renders the counter once the value length hits showCounterAt", () => {
    render(
      <StepTextArea
        value={"x".repeat(250)}
        onChange={() => {}}
        maxLength={300}
        showCounterAt={240}
        ariaLabel="Restrictions"
      />
    );
    expect(screen.getByText("250 / 300")).toBeInTheDocument();
  });

  it("fires onChange with the typed value and respects the maxLength attribute", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [val, setVal] = useState("");
      return (
        <StepTextArea
          value={val}
          onChange={(next) => {
            onChange(next);
            setVal(next);
          }}
          maxLength={5}
          ariaLabel="Test"
        />
      );
    }
    render(<Harness />);
    const textarea = screen.getByRole("textbox", { name: /test/i });
    expect(textarea.getAttribute("maxlength")).toBe("5");
    await user.type(textarea, "hi");
    // each keystroke fires onChange; last call sees the running value "hi".
    expect(onChange).toHaveBeenLastCalledWith("hi");
  });

  it("when `skipped` is true, disables the textarea and marks the skip chip pressed", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <StepTextArea
        value=""
        onChange={() => {}}
        maxLength={300}
        skipChipLabel="All clear — skip"
        onSkip={onSkip}
        skipped
        ariaLabel="Restrictions"
      />
    );
    const textarea = screen.getByRole("textbox", { name: /restrictions/i });
    expect(textarea).toBeDisabled();
    const skipChip = screen.getByRole("button", { name: /all clear — skip/i });
    expect(skipChip.getAttribute("aria-pressed")).toBe("true");
    await user.click(skipChip);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

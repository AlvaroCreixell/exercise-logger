import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipRow, type ChipOption } from "@/features/onboarding/components/ChipRow";

const THREE: ChipOption[] = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

describe("ChipRow (single-select, ≤ 5 options → radiogroup)", () => {
  it("renders a radiogroup with one radio per option and the selected radio checked", () => {
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected="b"
        onSelect={() => {}}
        ariaLabel="Primary goal"
      />
    );
    const group = screen.getByRole("radiogroup", { name: /primary goal/i });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect((radios[0] as HTMLInputElement).checked).toBe(false);
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect((radios[2] as HTMLInputElement).checked).toBe(false);
  });

  it("fires onSelect when a chip is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected={null}
        onSelect={onSelect}
        ariaLabel="Primary goal"
      />
    );
    await user.click(screen.getByLabelText("C"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("fires both onSelect and onAdvance when autoAdvance is true", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected={null}
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Primary goal"
      />
    );
    await user.click(screen.getByLabelText("A"));
    expect(onSelect).toHaveBeenCalledWith("a");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("re-clicking the already-selected chip still fires onSelect AND onAdvance (regression: Back → same choice → must advance)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipRow
        name="goal"
        options={THREE}
        selected="b"
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Primary goal"
      />
    );
    // Clicking the already-selected "B" MUST still trigger the handler +
    // auto-advance. Native <input type="radio"> onChange only fires on value
    // change, which broke re-selection after Back — we use onClick instead.
    await user.click(screen.getByLabelText("B"));
    expect(onSelect).toHaveBeenCalledWith("b");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("ChipRow (single-select, > 5 options → aria-pressed buttons)", () => {
  const MANY: ChipOption[] = Array.from({ length: 6 }, (_, i) => ({
    value: String(i + 1),
    label: `Option ${i + 1}`,
  }));

  it("renders as a button group with aria-pressed on the selected button", () => {
    render(
      <ChipRow
        name="many"
        options={MANY}
        selected="3"
        onSelect={() => {}}
        ariaLabel="Pick one"
      />
    );
    const group = screen.getByRole("group", { name: /pick one/i });
    expect(group).toBeInTheDocument();
    const three = screen.getByRole("button", { name: /Option 3/i });
    expect(three.getAttribute("aria-pressed")).toBe("true");
    const four = screen.getByRole("button", { name: /Option 4/i });
    expect(four.getAttribute("aria-pressed")).toBe("false");
  });
});

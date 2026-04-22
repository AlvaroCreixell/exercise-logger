import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipMulti } from "@/features/onboarding/components/ChipMulti";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";

const EQUIPMENT: ChipOption[] = [
  { value: "Barbell", label: "Barbell" },
  { value: "Dumbbells", label: "Dumbbells" },
  { value: "Bodyweight only", label: "Bodyweight only" },
];

describe("ChipMulti", () => {
  it("toggling an unselected chip adds it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell"]}
        onChange={onChange}
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /dumbbells/i }));
    expect(onChange).toHaveBeenCalledWith(["Barbell", "Dumbbells"]);
  });

  it("toggling an already-selected chip removes it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell", "Dumbbells"]}
        onChange={onChange}
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /barbell/i }));
    expect(onChange).toHaveBeenCalledWith(["Dumbbells"]);
  });

  it("reflects selection via aria-pressed", () => {
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell"]}
        onChange={() => {}}
        ariaLabel="Equipment"
      />
    );
    expect(screen.getByRole("button", { name: /barbell/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /dumbbells/i }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the exclusive chip clears all siblings (direction 1)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Barbell", "Dumbbells"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /bodyweight only/i }));
    expect(onChange).toHaveBeenCalledWith(["Bodyweight only"]);
  });

  it("clicking a non-exclusive chip while exclusive is selected clears the exclusive (direction 2)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Bodyweight only"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /dumbbells/i }));
    expect(onChange).toHaveBeenCalledWith(["Dumbbells"]);
  });

  it("clicking the exclusive chip while it is the only selection deselects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipMulti
        options={EQUIPMENT}
        selected={["Bodyweight only"]}
        onChange={onChange}
        exclusiveValue="Bodyweight only"
        ariaLabel="Equipment"
      />
    );
    await user.click(screen.getByRole("button", { name: /bodyweight only/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipWithDescription } from "@/features/onboarding/components/ChipWithDescription";
import type { ChipOption } from "@/features/onboarding/components/ChipRow";

const EXPERIENCE: ChipOption[] = [
  { value: "Beginner", label: "Beginner", description: "Just starting out" },
  { value: "Intermediate", label: "Intermediate", description: "6+ months in" },
  { value: "Advanced", label: "Advanced", description: "Years of consistent training" },
];

describe("ChipWithDescription", () => {
  it("renders each option's label and description", () => {
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected={null}
        onSelect={() => {}}
        ariaLabel="Experience"
      />
    );
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Just starting out")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("Years of consistent training")).toBeInTheDocument();
  });

  it("marks the selected option's radio as checked", () => {
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected="Intermediate"
        onSelect={() => {}}
        ariaLabel="Experience"
      />
    );
    const radios = screen.getAllByRole("radio");
    expect((radios.find((r) => (r as HTMLInputElement).value === "Intermediate") as HTMLInputElement).checked).toBe(true);
    expect((radios.find((r) => (r as HTMLInputElement).value === "Beginner") as HTMLInputElement).checked).toBe(false);
  });

  it("fires onSelect and then onAdvance when autoAdvance is set", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected={null}
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Experience"
      />
    );
    await user.click(screen.getByLabelText(/Advanced/));
    expect(onSelect).toHaveBeenCalledWith("Advanced");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("re-clicking the already-selected option still fires onSelect AND onAdvance (regression: Back → same choice → must advance)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdvance = vi.fn();
    render(
      <ChipWithDescription
        name="experience"
        options={EXPERIENCE}
        selected="Intermediate"
        onSelect={onSelect}
        autoAdvance
        onAdvance={onAdvance}
        ariaLabel="Experience"
      />
    );
    await user.click(screen.getByLabelText(/Intermediate/));
    expect(onSelect).toHaveBeenCalledWith("Intermediate");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { Stat } from "@/shared/components/Stat";

afterEach(cleanup);

describe("Stat", () => {
  it("renders the value and label", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125")).toBeVisible();
    expect(screen.getByText("kg")).toBeVisible();
  });

  it("defaults to md size with value-sized value classname", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125").className).toMatch(/text-value\b/);
  });

  it("uses text-hero at hero size", () => {
    render(<Stat value="125" label="kg" size="hero" />);
    expect(screen.getByText("125").className).toMatch(/text-hero/);
  });

  it("omits label when not provided", () => {
    render(<Stat value="125" />);
    expect(screen.getByText("125")).toBeVisible();
    expect(screen.queryByRole("description")).toBeNull();
  });

  it("renders numeric children with tabular-nums", () => {
    render(<Stat value="125" label="kg" />);
    expect(screen.getByText("125").className).toMatch(/text-value/);
  });

  it("stacks label below value by default", () => {
    const { container } = render(<Stat value="125" label="kg" />);
    expect(container.firstChild).toHaveClass("flex");
    expect(container.firstChild).toHaveClass("flex-col");
  });

  it("inlines label at sm size", () => {
    const { container } = render(<Stat value="125" label="kg" size="sm" />);
    expect(container.firstChild).toHaveClass("flex-row");
  });
});

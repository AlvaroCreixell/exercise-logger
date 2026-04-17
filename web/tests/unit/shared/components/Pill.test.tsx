import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pill } from "@/shared/components/Pill";

afterEach(cleanup);

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill onClick={() => {}}>B</Pill>);
    expect(screen.getByRole("button", { name: "B" })).toBeVisible();
  });

  it("invokes onClick when tapped", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Pill onClick={spy}>A</Pill>);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("applies selected styling when selected=true", () => {
    render(
      <Pill onClick={() => {}} selected>
        A
      </Pill>,
    );
    expect(screen.getByRole("button").className).toMatch(/bg-primary/);
    expect(screen.getByRole("button").className).toMatch(/text-primary-foreground/);
  });

  it("applies muted styling when selected=false", () => {
    render(<Pill onClick={() => {}}>A</Pill>);
    expect(screen.getByRole("button").className).toMatch(/text-muted-foreground/);
  });

  it("shows a suggested indicator dot when indicator=true and not selected", () => {
    const { container } = render(
      <Pill onClick={() => {}} indicator>
        A
      </Pill>,
    );
    expect(container.querySelector("[data-indicator='true']")).not.toBeNull();
  });

  it("hides the indicator when selected (the pill itself conveys state)", () => {
    const { container } = render(
      <Pill onClick={() => {}} indicator selected>
        A
      </Pill>,
    );
    expect(container.querySelector("[data-indicator='true']")).toBeNull();
  });

  it("passes through aria-label", () => {
    render(
      <Pill onClick={() => {}} aria-label="Day A">
        A
      </Pill>,
    );
    expect(screen.getByRole("button", { name: "Day A" })).toBeVisible();
  });
});

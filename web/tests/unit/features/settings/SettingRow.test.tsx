import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingRow } from "@/features/settings/SettingRow";

describe("SettingRow", () => {
  it("renders label and sublabel", () => {
    render(
      <SettingRow label="Units" sublabel="Weight display">
        <button>toggle</button>
      </SettingRow>
    );
    expect(screen.getByText("Units")).toBeVisible();
    expect(screen.getByText("Weight display")).toBeVisible();
  });

  it("renders the control slot on the right", () => {
    render(
      <SettingRow label="Units" sublabel="Weight display">
        <button data-testid="control">toggle</button>
      </SettingRow>
    );
    expect(screen.getByTestId("control")).toBeVisible();
  });

  it("omits the sublabel node when sublabel is not provided", () => {
    const { container } = render(
      <SettingRow label="Units">
        <button>toggle</button>
      </SettingRow>
    );
    // Only one <p> should render (the label), no sublabel <p>.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("label typography is sm semibold foreground", () => {
    render(
      <SettingRow label="Units">
        <span>x</span>
      </SettingRow>
    );
    const label = screen.getByText("Units");
    expect(label.className).toMatch(/text-sm/);
    expect(label.className).toMatch(/font-semibold/);
  });
});

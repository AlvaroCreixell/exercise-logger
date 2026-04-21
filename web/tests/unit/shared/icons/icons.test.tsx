import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IconSvg } from "@/shared/icons/IconSvg";

describe("IconSvg", () => {
  it("renders an svg element", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24" size={16}>
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("sets aria-hidden when no label is provided", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24">
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets role=img and aria-label when labelled", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24" aria-label="Close">
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Close");
    expect(svg?.getAttribute("aria-hidden")).toBe(null);
  });
});

import * as Icons from "@/shared/icons";

describe("icon barrel", () => {
  it("exports all 18 custom icons + IconSvg", () => {
    const expected = [
      "IconSvg",
      "Check", "Close", "Chevron", "Back", "Plus", "Minus", "Play",
      "Flame", "Dumbbell", "Search", "Trash", "Grid", "Graph",
      "Settings", "Calendar", "History", "Sparkle", "Backspace",
    ];
    for (const name of expected) {
      expect(Icons).toHaveProperty(name);
      expect(typeof (Icons as Record<string, unknown>)[name]).toBe("function");
    }
  });
});

import { Sparkle } from "@/shared/icons";

describe("Sparkle icon", () => {
  it("renders an svg with default aria-hidden", () => {
    const { container } = render(<Sparkle />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
  it("switches to role=img with aria-label when provided", () => {
    const { container } = render(<Sparkle aria-label="celebration" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("celebration");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
  });
  it("accepts a custom size", () => {
    const { container } = render(<Sparkle size={48} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
    expect(svg?.getAttribute("height")).toBe("48");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader } from "@/shared/components/SectionHeader";

describe("SectionHeader", () => {
  it("renders children", () => {
    render(<SectionHeader>Paste YAML</SectionHeader>);
    expect(screen.getByText("Paste YAML")).toBeVisible();
  });

  it("applies base eyebrow styling", () => {
    render(<SectionHeader>Heading</SectionHeader>);
    const el = screen.getByText("Heading");
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-widest/);
    expect(el.className).toMatch(/text-muted-foreground/);
  });

  it("honors className override (e.g., `!text-cta`)", () => {
    render(<SectionHeader className="!text-cta">Day A</SectionHeader>);
    const el = screen.getByText("Day A");
    expect(el.className).toContain("!text-cta");
  });
});

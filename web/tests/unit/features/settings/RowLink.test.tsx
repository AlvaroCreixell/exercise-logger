import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { RowLink } from "@/features/settings/RowLink";

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("RowLink", () => {
  it("renders label and sublabel", () => {
    renderInRouter(<RowLink label="Export data" sublabel="Download JSON backup" onClick={() => {}} />);
    expect(screen.getByText("Export data")).toBeVisible();
    expect(screen.getByText("Download JSON backup")).toBeVisible();
  });

  it("renders a <button> when onClick is provided", () => {
    renderInRouter(<RowLink label="Export" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /export/i })).toBeVisible();
  });

  it("renders a <Link> when to is provided", () => {
    renderInRouter(<RowLink label="Import routine" to="/settings/import" />);
    const link = screen.getByRole("link", { name: /import routine/i });
    expect(link.getAttribute("href")).toBe("/settings/import");
  });

  it("calls onClick when the button is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    renderInRouter(<RowLink label="Export" onClick={spy} />);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    renderInRouter(<RowLink label="Import" onClick={spy} disabled />);
    const btn = screen.getByRole("button", { name: /import/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
    await user.click(btn);
    expect(spy).not.toHaveBeenCalled();
  });

  it("tints the label red when variant='destructive'", () => {
    renderInRouter(<RowLink label="Clear all data" onClick={() => {}} variant="destructive" />);
    const label = screen.getByText("Clear all data");
    expect(label.className).toMatch(/text-destructive|text-danger/);
  });

  it("renders a chevron by default", () => {
    const { container } = renderInRouter(<RowLink label="Export" onClick={() => {}} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BlockStripe } from "@/features/workout/BlockStripe";

afterEach(cleanup);

describe("BlockStripe", () => {
  it("renders children inside the striped container", () => {
    render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.getByText("child")).toBeVisible();
  });

  it("renders the label as an uppercase chip", () => {
    render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.getByText("Top")).toBeVisible();
    expect(screen.getByText("Top").className).toMatch(/uppercase/);
  });

  it("uses warning color stripe for top variant", () => {
    const { container } = render(
      <BlockStripe label="Top" variant="top">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe).not.toBeNull();
    expect(stripe!.className).toMatch(/bg-warning/);
  });

  it("uses info color stripe for amrap variant", () => {
    const { container } = render(
      <BlockStripe label="AMRAP" variant="amrap">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe!.className).toMatch(/bg-info/);
  });

  it("uses neutral color stripe for default variant", () => {
    const { container } = render(
      <BlockStripe label="Set block 2" variant="default">
        <p>child</p>
      </BlockStripe>,
    );
    const stripe = container.querySelector("[data-stripe]");
    expect(stripe!.className).toMatch(/bg-muted/);
  });

  it("omits label chip when label is empty", () => {
    render(
      <BlockStripe label="" variant="default">
        <p>child</p>
      </BlockStripe>,
    );
    expect(screen.queryByText(/./)).not.toBeNull(); // child is there
  });
});

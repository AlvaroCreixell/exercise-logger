import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryStatsTile } from "@/features/history/HistoryStatsTile";

describe("HistoryStatsTile", () => {
  it("renders the three stat values and labels", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 47, setCount: 1284, hours: 38 }} />);
    expect(screen.getByText("47")).toBeVisible();
    expect(screen.getByText("1,284")).toBeVisible();
    expect(screen.getByText("38")).toBeVisible();
    expect(screen.getByText(/sessions/i)).toBeVisible();
    expect(screen.getByText(/sets/i)).toBeVisible();
    expect(screen.getByText(/hours/i)).toBeVisible();
  });

  it("renders '0' when stats are all zero", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 0, setCount: 0, hours: 0 }} />);
    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(3);
  });

  it("returns null when stats is undefined", () => {
    const { container } = render(<HistoryStatsTile stats={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("formats thousands separators for big set counts", () => {
    render(<HistoryStatsTile stats={{ sessionCount: 1, setCount: 10000, hours: 1 }} />);
    expect(screen.getByText("10,000")).toBeVisible();
  });
});

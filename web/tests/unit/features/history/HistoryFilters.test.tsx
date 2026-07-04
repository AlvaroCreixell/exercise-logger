import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryFilters } from "@/features/history/HistoryFilters";

afterEach(() => {
  cleanup();
});

function renderFilters(overrides: Partial<Parameters<typeof HistoryFilters>[0]> = {}) {
  const props = {
    dayIds: ["A", "B", "C"],
    activeDay: null as string | null,
    onDayChange: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    ...overrides,
  };
  render(<HistoryFilters {...props} />);
  return props;
}

describe("HistoryFilters", () => {
  it("renders an All chip plus one chip per day", () => {
    renderFilters();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day C" })).toBeInTheDocument();
  });

  it("hides the chip row when only one day exists", () => {
    renderFilters({ dayIds: ["A"] });
    expect(screen.queryByRole("button", { name: "All" })).toBeNull();
  });

  it("marks the active chip with aria-pressed", () => {
    renderFilters({ activeDay: "B" });
    expect(screen.getByRole("button", { name: "Day B" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selecting a day chip reports the day; selecting it again toggles back to All", async () => {
    const user = userEvent.setup();
    const props = renderFilters({ activeDay: "B" });
    await user.click(screen.getByRole("button", { name: "Day A" }));
    expect(props.onDayChange).toHaveBeenCalledWith("A");
    await user.click(screen.getByRole("button", { name: "Day B" }));
    expect(props.onDayChange).toHaveBeenCalledWith(null);
  });

  it("All chip clears the day filter", async () => {
    const user = userEvent.setup();
    const props = renderFilters({ activeDay: "C" });
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(props.onDayChange).toHaveBeenCalledWith(null);
  });

  it("search input reports query changes", async () => {
    const user = userEvent.setup();
    const props = renderFilters();
    await user.type(screen.getByRole("searchbox", { name: /search by exercise/i }), "b");
    expect(props.onQueryChange).toHaveBeenCalledWith("b");
  });
});

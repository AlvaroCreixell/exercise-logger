import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YamlErrorList } from "@/features/settings/YamlErrorList";

describe("YamlErrorList", () => {
  it("renders nothing when errors is empty", () => {
    const { container } = render(<YamlErrorList errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each error with breadcrumb path and message", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "days.A.entries[2].sets", message: "must be ≥ 1" },
          { path: "name", message: "must be a non-empty string" },
        ]}
      />
    );
    expect(screen.getByText(/Day A · Entry 3 · sets/)).toBeVisible();
    expect(screen.getByText(/must be ≥ 1/)).toBeVisible();
    expect(screen.getByText(/Name/)).toBeVisible();
    expect(screen.getByText(/must be a non-empty string/)).toBeVisible();
  });

  it("wraps the list in role='alert' with aria-live='assertive'", () => {
    const { container } = render(
      <YamlErrorList errors={[{ path: "name", message: "required" }]} />
    );
    const alert = container.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
  });

  it("shows a summary count in the header", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "name", message: "required" },
          { path: "version", message: "must be 1" },
        ]}
      />
    );
    expect(screen.getByText(/2 errors/i)).toBeVisible();
  });

  it("uses singular 'error' when there's one", () => {
    render(<YamlErrorList errors={[{ path: "name", message: "required" }]} />);
    expect(screen.getByText(/1 error/i)).toBeVisible();
  });
});

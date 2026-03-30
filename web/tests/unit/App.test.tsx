import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the Today screen by default", () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("navigates to Workout screen when Workout tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Workout" }));

    expect(screen.getByText("No active workout. Start one from Today.")).toBeInTheDocument();
  });

  it("navigates to History screen when History tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "History" }));

    expect(screen.getByText("Your workout history will appear here.")).toBeInTheDocument();
  });

  it("navigates to Settings screen when Settings tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(screen.getByText("Routines, preferences, and data management.")).toBeInTheDocument();
  });

  it("renders all four tab links in the navigation bar", () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);

    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workout" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});

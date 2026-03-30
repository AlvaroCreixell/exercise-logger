import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the Today screen by default", () => {
    // BrowserRouter uses window.location, so set it before rendering
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});

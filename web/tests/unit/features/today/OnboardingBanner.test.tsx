import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { OnboardingBanner } from "@/features/today/OnboardingBanner";

function WithRouter({ onDismiss }: { onDismiss: () => void }) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<OnboardingBanner onDismiss={onDismiss} />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingBanner", () => {
  it("renders with role=status and the spec-exact body text", () => {
    render(<WithRouter onDismiss={() => {}} />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent ?? "").toContain("Finish setting up your routine");
  });

  it("clicking the body navigates to /onboarding/questionnaire", async () => {
    const user = userEvent.setup();
    render(<WithRouter onDismiss={() => {}} />);
    await user.click(screen.getByRole("button", { name: /finish setting up your routine/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });

  it("clicking × calls onDismiss and does NOT navigate", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<WithRouter onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("QUESTIONNAIRE")).not.toBeInTheDocument();
  });
});

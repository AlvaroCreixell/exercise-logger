import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import QuestionnaireScreen from "@/features/onboarding/QuestionnaireScreen";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";

function WithRouter({ initialPath = "/onboarding/questionnaire" }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function LocationReporter() {
  const loc = useLocation();
  const state = loc.state as { justCompleted?: boolean } | null;
  return (
    <div data-testid="loc-state">
      justCompleted:{String(state?.justCompleted === true)}
    </div>
  );
}

describe("QuestionnaireScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders step 1 (goal) on fresh mount", () => {
    render(<WithRouter />);
    expect(
      screen.getByRole("heading", { name: /What's your main goal/i })
    ).toBeInTheDocument();
  });

  it("resumes at the saved stepIndex when sessionStorage has valid state", async () => {
    saveWizardState({ stepIndex: 3, answers: {} });
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: /How many days/i })
    ).toBeInTheDocument();
  });

  it("auto-advances from step 1 to step 2 after a preset chip tap", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(screen.getByLabelText("Build muscle"));
    expect(
      await screen.findByRole("heading", { name: /How experienced/i })
    ).toBeInTheDocument();
  });

  it("Back from step 3 keeps the step-2 answer", async () => {
    saveWizardState({
      stepIndex: 2, // RestrictionsStep
      answers: {
        goal: { kind: "chip-with-other", value: "Build muscle" },
        experience: { kind: "chip", value: "Intermediate" },
      },
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: /Anything we should work around/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(
      await screen.findByRole("heading", { name: /How experienced/i })
    ).toBeInTheDocument();
    const intermediate = screen.getByLabelText(/Intermediate/);
    expect((intermediate as HTMLInputElement).checked).toBe(true);
  });

  it("Next is disabled on step 7 (equipment) until a selection is made", async () => {
    saveWizardState({
      stepIndex: 6,
      answers: {},
    });
    render(<WithRouter />);
    expect(
      await screen.findByRole("button", { name: /^next$/i })
    ).toBeDisabled();
  });

  it("step-11 Next navigates to /onboarding/handoff without clearing sessionStorage", async () => {
    saveWizardState({
      stepIndex: 10, // CardioStep
      answers: {},
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: /cardio section/i })
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText("Yes"));
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("step-11 Next navigates with state.justCompleted === true", async () => {
    sessionStorage.clear();
    const { saveWizardState } = await import(
      "@/features/onboarding/lib/session-storage"
    );
    saveWizardState({ stepIndex: 10, answers: {} });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
        <Routes>
          <Route
            path="/onboarding/questionnaire"
            element={<QuestionnaireScreen />}
          />
          <Route
            path="/onboarding/handoff"
            element={<LocationReporter />}
          />
        </Routes>
      </MemoryRouter>
    );
    await user.click(await screen.findByLabelText("Yes"));
    expect(await screen.findByTestId("loc-state")).toHaveTextContent(
      "justCompleted:true"
    );
  });
});

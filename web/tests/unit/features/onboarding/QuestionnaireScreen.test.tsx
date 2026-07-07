import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
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
        <Route path="/onboarding/generate" element={<div>GENERATE</div>} />
      </Routes>
    </MemoryRouter>
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

  it("step-11 Next navigates to /onboarding/generate without clearing sessionStorage", async () => {
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
    expect(await screen.findByText("GENERATE")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

describe("QuestionnaireScreen exit preserves wizard state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("close → confirm exit does NOT clear sessionStorage", async () => {
    const user = userEvent.setup();
    saveWizardState({
      stepIndex: 2,
      answers: {
        goal: { kind: "chip-with-other", value: "Build muscle" },
        experience: { kind: "chip", value: "Intermediate" },
      },
    });
    render(
      <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
        <Routes>
          <Route path="/onboarding/questionnaire" element={<QuestionnaireScreen />} />
          <Route path="/onboarding" element={<div>HOME</div>} />
          <Route path="/" element={<div>ROOT</div>} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(
      await screen.findByRole("button", { name: /exit questionnaire/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /save and exit/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

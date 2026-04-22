import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import OnboardingWelcomeScreen from "@/features/onboarding/OnboardingWelcomeScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";

function WithRouter({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={children} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingWelcomeScreen", () => {
  beforeEach(async () => {
    // Reset the singleton DB's settings row between tests.
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.settings.clear();
    await db.settings.put({
      id: "user",
      activeRoutineId: null,
      units: "kg",
      userName: null,
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
      lastGeneratedPrompt: null,
      lastGeneratedPromptAt: null,
      onboardingBannerDismissedAt: null,
    });
    await db.close();
  });

  it("autofocuses the name input on mount", () => {
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    expect(input.getAttribute("maxlength")).toBe("40");
  });

  it("Start with a name trims, saves via setUserName, and navigates to the questionnaire", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.type(screen.getByRole("textbox"), "  Alvaro  ");
    await user.click(screen.getByRole("button", { name: /^start$/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();

    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.userName).toBe("Alvaro");
    expect(s?.onboardingSkippedAt).toBeNull();
    await db.close();
  });

  it("Start with an empty name navigates without calling setUserName", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /^start$/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();

    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.userName).toBeNull();
    await db.close();
  });

  it("Maybe later calls markOnboardingSkipped and navigates to /", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <OnboardingWelcomeScreen />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();

    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(s?.userName).toBeNull();
    await db.close();
  });
});

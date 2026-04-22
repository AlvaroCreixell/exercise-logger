import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import QuestionnaireScreen from "@/features/onboarding/QuestionnaireScreen";
import { loadWizardState } from "@/features/onboarding/lib/session-storage";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/onboarding/questionnaire"]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route
          path="/onboarding/questionnaire"
          element={<QuestionnaireScreen />}
        />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("onboarding walkthrough (integration)", () => {
  it("completes 11 steps and the resulting buildPrompt contains the D10 line", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<WithRouter />);

    // Step 1: Goal — Build muscle.
    await user.click(await screen.findByLabelText("Build muscle"));

    // Step 2: Experience — Intermediate.
    await user.click(await screen.findByLabelText(/Intermediate/));

    // Step 3: Restrictions — skip.
    await user.click(
      await screen.findByRole("button", { name: /all clear — skip/i })
    );

    // Step 4: DaysPerWeek — 3.
    await user.click(await screen.findByLabelText("3"));

    // Step 5: SessionLength — 60 min.
    await user.click(await screen.findByLabelText("60 min"));

    // Step 6: DistinctDays — 3.
    await user.click(await screen.findByLabelText("3"));

    // Step 7: Equipment — Barbell + Dumbbells, then Next.
    await user.click(await screen.findByRole("button", { name: /^barbell$/i }));
    await user.click(await screen.findByRole("button", { name: /^dumbbells$/i }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // Step 8: Priorities — skip.
    await user.click(
      await screen.findByRole("button", { name: /keep it balanced — skip/i })
    );

    // Step 9: FavoritesAvoid — leave both empty, tap Next.
    await screen.findByRole("textbox", { name: /love/i });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // Step 10: Supersets — Yes. (ChipWithDescription label concatenates
    // title + description text, so match by role+name on the radio input.)
    await user.click(await screen.findByRole("radio", { name: /^Yes/ }));

    // Step 11: Cardio — Yes.
    await user.click(await screen.findByLabelText("Yes"));

    // After step-11 we navigate to HANDOFF.
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();

    // Inspect sessionStorage and build the prompt.
    const stored = loadWizardState();
    expect(stored).not.toBeNull();
    const prompt = buildPrompt(stored!.answers);

    // D10 lock: bare number, no parenthetical.
    expect(prompt).toContain("- Distinct training days desired: 3");
    expect(prompt).not.toContain("Distinct training days desired: 3 (");

    // A handful of other expected lines.
    expect(prompt).toContain("- Primary goal: Build muscle");
    expect(prompt).toContain("- Days per week available: 3");
    expect(prompt).toContain("- Typical session length: 60 minutes");
    expect(prompt).toContain("- Available equipment: Barbell, Dumbbells");
    expect(prompt).toContain("- Supersets: Yes — use them where they fit");
    expect(prompt).toContain("- Cardio section: Yes — include optional cardio");

    // Skipped optional bullets are absent.
    expect(prompt).not.toContain("Injuries / restrictions");
    expect(prompt).not.toContain("Muscle groups to prioritize");
    expect(prompt).not.toContain("Favorite exercises (include):");
    expect(prompt).not.toContain("Exercises to avoid:");
  });
});

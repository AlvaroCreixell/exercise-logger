import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import OnboardingWelcomeScreen from "@/features/onboarding/OnboardingWelcomeScreen";
import { db, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Routine } from "@/domain/types";

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const starter: Routine = {
  id: "starter",
  schemaVersion: 1,
  name: "Full Body 3-Day Rotation",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A", "B", "C"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Heavy Squat",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    },
    B: { id: "B", label: "Hinge", entries: [] },
    C: { id: "C", label: "Volume", entries: [] },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-04-22T00:00:00.000Z",
};

async function reset() {
  await Promise.all([
    db.settings.clear(),
    db.routines.clear(),
    db.exercises.clear(),
  ]);
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
  await db.routines.put(starter);
  const s = (await db.settings.get("user"))!;
  await db.settings.put({ ...s, activeRoutineId: starter.id });
}

describe("OnboardingWelcomeScreen — starter-first choice", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders starter routine summary and primary 'Use starter routine' CTA", async () => {
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", {
        name: /your starter routine is ready/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Full Body 3-Day Rotation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use starter routine/i })
    ).toBeInTheDocument();
  });

  it("Use starter routine: marks skipped and navigates home", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /use starter routine/i })
    );
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("Use starter routine: trims and saves name when name input is filled", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(screen.getByLabelText(/your name/i), "  Alvaro  ");
    await user.click(
      screen.getByRole("button", { name: /use starter routine/i })
    );
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.userName).toBe("Alvaro");
  });

  it("Build personalized routine: navigates to questionnaire and saves name", async () => {
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(screen.getByLabelText(/your name/i), "Alvaro");
    await user.click(
      screen.getByRole("button", { name: /build personalized routine/i })
    );
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings?.userName).toBe("Alvaro");
    expect(settings?.onboardingSkippedAt).toBeNull();
  });

  it("shows 'Continue personalized routine' when wizard state exists", async () => {
    saveWizardState({
      stepIndex: 3,
      answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
    });
    render(<WithRouter />);
    expect(
      await screen.findByRole("button", { name: /continue personalized routine/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start over/i })
    ).toBeInTheDocument();
  });

  it("Start over: confirms, clears wizard state, and shows the build CTA again", async () => {
    saveWizardState({
      stepIndex: 3,
      answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /start over/i }));
    await waitFor(() => {
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: /build personalized routine/i })
    ).toBeInTheDocument();
  });

  it("Start over: also clears the saved prompt", async () => {
    const before = (await db.settings.get("user"))!;
    await db.settings.put({
      ...before,
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({
      stepIndex: 3,
      answers: { goal: { kind: "chip-with-other", value: "Build muscle" } },
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /start over/i }));
    await waitFor(async () => {
      const after = await db.settings.get("user");
      expect(after?.lastGeneratedPrompt).toBeNull();
    });
  });

  it("initial focus lands on the heading, not the name input", async () => {
    render(<WithRouter />);
    const heading = await screen.findByRole("heading", {
      name: /your starter routine is ready/i,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
  });
});

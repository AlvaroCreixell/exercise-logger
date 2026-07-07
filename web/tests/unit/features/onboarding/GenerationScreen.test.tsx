import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { db, initializeSettings } from "@/db/database";
import { saveWizardState, clearWizardState } from "@/features/onboarding/lib/session-storage";
import GenerationScreen from "@/features/onboarding/GenerationScreen";
import { GenerationFailure } from "@/services/llm/types";
import type { Routine } from "@/domain/types";

vi.mock("@/services/generation-service", () => ({
  generateRoutine: vi.fn(),
}));
vi.mock("@/services/llm/anthropic-provider", () => ({
  createAnthropicProvider: vi.fn(() => ({ generateRoutine: vi.fn() })),
  testAnthropicKey: vi.fn(),
}));

import { generateRoutine } from "@/services/generation-service";

const fakeRoutine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "Generated Plan",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 5, maxValue: 8, count: 3 }],
        },
      ],
    },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-07-06T00:00:00.000Z",
};

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/onboarding/generate"]}>
      <Routes>
        <Route path="/onboarding/generate" element={<GenerationScreen />} />
        <Route path="/onboarding/questionnaire" element={<p>questionnaire</p>} />
        <Route path="/" element={<p>today</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  clearWizardState();
  await db.delete();
  await db.open();
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
  saveWizardState({
    stepIndex: 10,
    answers: { goal: { kind: "chip", value: "Build muscle" } },
  });
});

describe("GenerationScreen", () => {
  it("redirects to the questionnaire when no wizard answers exist", async () => {
    clearWizardState();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    renderScreen();
    expect(await screen.findByText("questionnaire")).toBeInTheDocument();
  });

  it("shows the key setup card when no key is configured", async () => {
    renderScreen();
    expect(
      await screen.findByText(/needs your Anthropic API key/i)
    ).toBeInTheDocument();
    expect(generateRoutine).not.toHaveBeenCalled();
  });

  it("generates and shows the preview when a key exists", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    expect(await screen.findByText("Generated Plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use this routine/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
  });

  it("activates the routine, marks onboarding complete, and navigates home on accept", async () => {
    const user = userEvent.setup();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: /use this routine/i }));
    expect(await screen.findByText("today")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings!.onboardingCompletedAt).not.toBeNull();
    expect(settings!.activeRoutineId).toBe("r1");
  });

  it("shows a typed error with retry for an auth failure", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-bad" });
    vi.mocked(generateRoutine).mockResolvedValue({
      ok: false,
      failure: new GenerationFailure("auth", "invalid key"),
    });
    renderScreen();
    expect(await screen.findByText(/check your api key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("lists validation errors when repairs are exhausted", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({
      ok: false,
      failure: new GenerationFailure("validation", "failed", [
        { path: "days.A.entries[0].exercise_id", message: 'Unknown exercise "xyz"' },
      ]),
    });
    renderScreen();
    expect(await screen.findByText(/Unknown exercise/)).toBeInTheDocument();
  });

  it("regenerates on the Regenerate button", async () => {
    const user = userEvent.setup();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: /regenerate/i }));
    await waitFor(() => expect(generateRoutine).toHaveBeenCalledTimes(2));
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import HandoffScreen from "@/features/onboarding/HandoffScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { Answers } from "@/features/onboarding/lib/types";
import type { Settings } from "@/domain/types";
import * as routineSvc from "@/services/routine-service";

const FULL_ANSWERS: Answers = {
  goal: { kind: "chip-with-other", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "3" },
  equipment: { kind: "chip-multi", values: ["Barbell", "Dumbbells"] },
  supersets: { kind: "chip", value: "Yes" },
  cardio: { kind: "chip", value: "Yes" },
};

function WithRouter({
  initialState,
}: {
  initialState?: { justCompleted?: boolean };
}) {
  return (
    <MemoryRouter
      initialEntries={[
        { pathname: "/onboarding/handoff", state: initialState ?? null },
      ]}
    >
      <Routes>
        <Route path="/onboarding/handoff" element={<HandoffScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function seedSettings(overrides: Partial<Settings> = {}) {
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
    ...overrides,
  });
  await db.close();
}

describe("HandoffScreen — Stage 1", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects to /onboarding/questionnaire when no prompt saved and not justCompleted", async () => {
    await seedSettings();
    render(<WithRouter />);
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });

  it("renders Stage 1 when justCompleted=true and no saved prompt", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    render(<WithRouter initialState={{ justCompleted: true }} />);
    expect(
      await screen.findByRole("heading", { name: /ready to build your routine/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy prompt & open gpt/i })
    ).toBeInTheDocument();
  });

  it("Stage 1 button: persists prompt, writes clipboard, opens GPT, flips to Stage 2", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false } as Window));

    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );

    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]![0] as string;
    expect(copied).toContain("- Distinct training days desired: 3");
    expect(copied).not.toContain("Distinct training days desired: 3 (");

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0] ?? [];
    expect(url).toContain("chatgpt.com");
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");

    const db2 = new ExerciseLoggerDB();
    await waitFor(async () => {
      const s = await db2.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe(copied);
      expect(s?.lastGeneratedPromptAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
    await db2.close();
  });

  it("Stage 1 button: clipboard failure toasts but still flips to Stage 2", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
      configurable: true,
    });
    vi.spyOn(window, "open").mockImplementation(() => ({ closed: false } as Window));

    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
  });

  it("Stage 1 button: popup blocker returns null — flips to Stage 2 with inline GPT link", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    vi.spyOn(window, "open").mockImplementation(() => null);

    render(<WithRouter initialState={{ justCompleted: true }} />);
    await user.click(
      await screen.findByRole("button", { name: /copy prompt & open gpt/i })
    );
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open gpt/i })).toBeInTheDocument();
  });

  it("Stage 2 shown directly when settings.lastGeneratedPrompt !== null", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    render(<WithRouter />);
    expect(
      await screen.findByRole("heading", { name: /paste your routine/i })
    ).toBeInTheDocument();
  });
});

describe("HandoffScreen — Stage 2", () => {
  beforeEach(async () => {
    sessionStorage.clear();
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
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
      onboardingBannerDismissedAt: null,
    });
    await db.close();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("invalid YAML shows errors and does NOT navigate", async () => {
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: false,
      errors: [{ path: "routine.days", message: "must be a map" }],
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "not yaml"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText(/must be a map/i)).toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
  });

  it("valid YAML imports, clears prompt, sets completed, navigates to /", async () => {
    const fakeRoutine = {
      id: "r1",
      schemaVersion: 1,
      name: "Import Me",
      restDefaultSec: 90,
      restSupersetSec: 60,
      dayOrder: ["A"],
      nextDayId: "A",
      days: { A: { id: "A", label: "Day A", entries: [] } },
      notes: [],
      cardio: null,
      importedAt: "2026-04-22T00:00:00.000Z",
    };
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: true,
      routine: fakeRoutine as never,
    });
    vi.spyOn(routineSvc, "importAndActivateRoutine").mockResolvedValue({
      ok: true,
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "name: Import Me"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();

    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(s?.lastGeneratedPromptAt).toBeNull();
    expect(s?.onboardingCompletedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(s?.onboardingBannerDismissedAt).toBeNull();
    await db2.close();
  });

  it("active-session block toasts the failure message and leaves prompt in place", async () => {
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: true,
      routine: { id: "r1" } as never,
    });
    vi.spyOn(routineSvc, "importAndActivateRoutine").mockResolvedValue({
      ok: false,
      message: "Cannot import while a workout session is active.",
    });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.type(
      await screen.findByRole("textbox", { name: /yaml/i }),
      "name: X"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));

    expect(screen.queryByText("HOME")).not.toBeInTheDocument();

    const db2 = new ExerciseLoggerDB();
    const s = await db2.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    expect(s?.onboardingCompletedAt).toBeNull();
    await db2.close();
  });
});

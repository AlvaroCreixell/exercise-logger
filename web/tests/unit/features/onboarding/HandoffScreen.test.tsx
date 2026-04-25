import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import HandoffScreen from "@/features/onboarding/HandoffScreen";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  STORAGE_KEY,
  saveWizardState,
} from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
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

describe("HandoffScreen — recovery and just-completed", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects to questionnaire when no prompt and not justCompleted", async () => {
    await seedSettings();
    render(<WithRouter />);
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });

  it("just-completed: builds prompt, persists it, renders prompt visible by default", async () => {
    await seedSettings();
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    render(<WithRouter initialState={{ justCompleted: true }} />);
    const textarea = (await screen.findByRole("textbox", {
      name: /generated prompt/i,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toContain("- Distinct training days desired: 3");
    const db = new ExerciseLoggerDB();
    await waitFor(async () => {
      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toContain("- Distinct training days desired: 3");
    });
    await db.close();
  });

  it("recovery: shows saved prompt visible by default", async () => {
    await seedSettings({
      lastGeneratedPrompt: "RECOVERED PROMPT BODY",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    render(<WithRouter />);
    const textarea = (await screen.findByRole("textbox", {
      name: /generated prompt/i,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toBe("RECOVERED PROMPT BODY");
  });

  it("Open GPT is a real anchor and never calls window.open", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    const openSpy = vi.spyOn(window, "open");
    render(<WithRouter />);
    const link = await screen.findByRole("link", { name: /open gpt/i });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(GPT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel") ?? "").toContain("noopener");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("copy button: success → 'Copied' inline state", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    // userEvent.setup() must come before Object.defineProperty so that
    // userEvent's clipboard stub is installed first; the subsequent
    // Object.defineProperty then overrides it with our mock.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("P");
  });

  it("copy button: failure → inline 'select and copy manually' message and prompt stays expanded", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    // userEvent.setup() must come before Object.defineProperty — see note above.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
      configurable: true,
    });
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(
      await screen.findByText(/select and copy the prompt above manually/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /generated prompt/i })
    ).toBeInTheDocument();
  });

  it("missing navigator.clipboard: prompt stays visible, copy reveals manual instructions", async () => {
    await seedSettings({
      lastGeneratedPrompt: "P",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    // userEvent.setup() must come before Object.defineProperty — see note above.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /^copy prompt$/i })
    );
    expect(
      await screen.findByText(/select and copy the prompt above manually/i)
    ).toBeInTheDocument();
  });

  it("import success: clears prompt + wizard state, marks completed, navigates home", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 10, answers: FULL_ANSWERS });
    const fakeRoutine = {
      id: "r1",
      schemaVersion: 1,
      name: "Imported",
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
      "name: Imported"
    );
    await user.click(screen.getByRole("button", { name: /import routine/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(s?.onboardingCompletedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    await db.close();
  });

  it("active-session block: shows inline error and preserves prompt", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
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
    expect(
      await screen.findByText(/cannot import while a workout session is active/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    await db.close();
  });

  it("Start over: clears prompt and wizard state, routes to questionnaire", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 5, answers: {} as never });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /start over/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /start over/i }));
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    await db.close();
  });

  it("Exit: navigates home without clearing prompt or wizard state", async () => {
    await seedSettings({
      lastGeneratedPrompt: "SAVED",
      lastGeneratedPromptAt: new Date().toISOString(),
    });
    saveWizardState({ stepIndex: 5, answers: {} as never });
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(await screen.findByRole("button", { name: /^exit$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^exit$/i }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    const db = new ExerciseLoggerDB();
    const s = await db.settings.get("user");
    expect(s?.lastGeneratedPrompt).toBe("SAVED");
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    await db.close();
  });
});

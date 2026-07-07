import "fake-indexeddb/auto";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import RoutineImportScreen from "@/features/settings/RoutineImportScreen";
import * as routineSvc from "@/services/routine-service";
import { db, initializeSettings } from "@/db/database";
import { STORAGE_KEY } from "@/features/onboarding/lib/session-storage";

// RoutineImportScreen uses `db.exercises.toArray()` inside runImport. The
// pre-fill test doesn't trigger runImport — it just renders and checks
// textarea value. Import tests mock the routine service.

function renderScreen(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/settings/import", state }]}>
      <Routes>
        <Route path="/settings/import" element={<RoutineImportScreen />} />
        <Route path="/settings" element={<div>SETTINGS</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoutineImportScreen — pre-fill from launchYaml", () => {
  it("pre-fills the textarea from location.state.launchYaml", async () => {
    renderScreen({ launchYaml: "version: 1\n" });
    const ta = await screen.findByLabelText(/paste yaml/i);
    expect((ta as HTMLTextAreaElement).value).toContain("version: 1");
  });
});

describe("RoutineImportScreen — paste from clipboard", () => {
  it("fills the textarea from the clipboard, unwrapping code fences", async () => {
    const user = userEvent.setup();
    const readText = vi
      .fn()
      .mockResolvedValue("```yaml\nversion: 1\nname: Clip\n```");
    Object.defineProperty(navigator, "clipboard", {
      value: { readText },
      configurable: true,
    });
    renderScreen();
    await user.click(
      screen.getByRole("button", { name: /paste from clipboard/i }),
    );
    const ta = await screen.findByLabelText(/paste yaml/i);
    await waitFor(() => {
      expect((ta as HTMLTextAreaElement).value).toBe("version: 1\nname: Clip");
    });
  });

  it("leaves the textarea unchanged when the clipboard is unavailable", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    renderScreen();
    await user.click(
      screen.getByRole("button", { name: /paste from clipboard/i }),
    );
    const ta = screen.getByLabelText(/paste yaml/i);
    expect((ta as HTMLTextAreaElement).value).toBe("");
  });
});

describe("RoutineImportScreen — first-run import completes onboarding", () => {
  const fakeRoutine = { id: "r1", name: "Shared" };

  beforeEach(async () => {
    sessionStorage.clear();
    await db.settings.clear();
    await initializeSettings(db);
    vi.spyOn(routineSvc, "validateAndNormalizeRoutine").mockResolvedValue({
      ok: true,
      routine: fakeRoutine as never,
    });
    vi.spyOn(routineSvc, "importAndActivateRoutine").mockResolvedValue({
      ok: true,
    });
  });

  it("marks onboarding completed and clears wizard state when first-run", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIndex: 3, answers: {} }));

    const user = userEvent.setup();
    renderScreen({ launchYaml: "version: 1" });
    await user.click(
      await screen.findByRole("button", { name: /import and activate routine/i }),
    );
    expect(await screen.findByText("SETTINGS")).toBeInTheDocument();

    const after = (await db.settings.get("user"))!;
    expect(after.onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("leaves onboarding flags alone for an already-skipped user", async () => {
    const skippedAt = "2026-06-01T10:00:00.000Z";
    const s = (await db.settings.get("user"))!;
    await db.settings.put({
      ...s,
      onboardingSkippedAt: skippedAt,
    });

    const user = userEvent.setup();
    renderScreen({ launchYaml: "version: 1" });
    await user.click(
      await screen.findByRole("button", { name: /import and activate routine/i }),
    );
    expect(await screen.findByText("SETTINGS")).toBeInTheDocument();

    const after = (await db.settings.get("user"))!;
    expect(after.onboardingCompletedAt).toBeNull();
    expect(after.onboardingSkippedAt).toBe(skippedAt);
  });
});

describe("RoutineImportScreen — fence-tolerant import", () => {
  it("strips code fences before validating pasted YAML", async () => {
    const user = userEvent.setup();
    const validateSpy = vi
      .spyOn(routineSvc, "validateAndNormalizeRoutine")
      .mockResolvedValue({
        ok: false,
        errors: [{ path: "", message: "stop here" }],
      });
    renderScreen({ launchYaml: "```yaml\nversion: 1\nname: Fenced\n```" });
    const importBtn = await screen.findByRole("button", {
      name: /import and activate routine/i,
    });
    await user.click(importBtn);
    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith(
        "version: 1\nname: Fenced",
        expect.anything(),
      );
    });
  });
});

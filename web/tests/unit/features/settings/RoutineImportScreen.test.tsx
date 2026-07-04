import "fake-indexeddb/auto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import RoutineImportScreen from "@/features/settings/RoutineImportScreen";
import * as routineSvc from "@/services/routine-service";

// RoutineImportScreen uses `db.exercises.toArray()` inside runImport. The
// pre-fill test doesn't trigger runImport — it just renders and checks
// textarea value. Import tests mock the routine service.

function renderScreen(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/settings/import", state }]}>
      <RoutineImportScreen />
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

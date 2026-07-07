import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import SettingsScreen from "@/features/settings/SettingsScreen";
import {
  initializeSettings,
  DEFAULT_SETTINGS,
  db,
} from "@/db/database";
import type { Settings } from "@/domain/types";

async function seed(overrides: Partial<Settings> = {}) {
  await initializeSettings(db);
  await db.settings.clear();
  await db.settings.put({ ...DEFAULT_SETTINGS, ...overrides });
}

function WithRouter() {
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/onboarding/questionnaire" element={<div>QUESTIONNAIRE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SettingsScreen Profile section", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows 'Not set' when userName is null", async () => {
    await seed();
    render(<WithRouter />);
    expect(await screen.findByRole("button", { name: /your name.*not set/i })).toBeInTheDocument();
  });

  it("editing and saving the name persists via setUserName", async () => {
    await seed();
    const user = userEvent.setup();
    render(<WithRouter />);
    // The default row: click it to open the editor.
    await user.click(await screen.findByRole("button", { name: /your name/i }));
    const input = await screen.findByRole("textbox", { name: /name editor/i });
    await user.type(input, "Alvaro");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(async () => {
      const s = await db.settings.get("user");
      expect(s?.userName).toBe("Alvaro");
    });
  });

  it("'Create a personalized routine' row navigates to the questionnaire", async () => {
    await seed();
    const user = userEvent.setup();
    render(<WithRouter />);
    await user.click(
      await screen.findByRole("button", { name: /create a personalized routine/i })
    );
    expect(await screen.findByText("QUESTIONNAIRE")).toBeInTheDocument();
  });
});

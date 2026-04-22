import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { LastPromptCard } from "@/features/onboarding/components/LastPromptCard";
import type { Settings } from "@/domain/types";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "user",
    activeRoutineId: null,
    units: "kg",
    userName: null,
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    lastGeneratedPrompt: "SAVED PROMPT",
    lastGeneratedPromptAt: new Date().toISOString(),
    onboardingBannerDismissedAt: null,
    ...overrides,
  };
}

function WithRouter({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={children} />
        <Route path="/onboarding/handoff" element={<div>HANDOFF</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LastPromptCard", () => {
  beforeEach(async () => {
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.settings.clear();
    await db.settings.put(makeSettings());
    await db.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when settings.lastGeneratedPrompt === null", () => {
    const { container } = render(
      <WithRouter>
        <LastPromptCard
          settings={makeSettings({
            lastGeneratedPrompt: null,
            lastGeneratedPromptAt: null,
          })}
        />
      </WithRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the relative time label", () => {
    render(
      <WithRouter>
        <LastPromptCard settings={makeSettings()} />
      </WithRouter>
    );
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it("Paste YAML navigates to /onboarding/handoff", async () => {
    const user = userEvent.setup();
    render(
      <WithRouter>
        <LastPromptCard settings={makeSettings()} />
      </WithRouter>
    );
    await user.click(screen.getByRole("button", { name: /paste yaml/i }));
    expect(await screen.findByText("HANDOFF")).toBeInTheDocument();
  });
});

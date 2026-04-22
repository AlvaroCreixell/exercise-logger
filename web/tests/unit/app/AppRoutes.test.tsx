import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock the PWA register hook before importing App (transitive via SWUpdatePrompt).
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(async () => {}),
  }),
}));

import { AppRoutes } from "@/app/App";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import type { Settings } from "@/domain/types";

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

describe("AppRoutes first-run gate", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("fresh install at / redirects to /onboarding (welcome screen)", async () => {
    await seedSettings();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Welcome screen hero heading.
    expect(
      await screen.findByRole("heading", { name: /what should we call you/i })
    ).toBeInTheDocument();
  });

  it("completed user at / stays on Today (no redirect)", async () => {
    await seedSettings({ onboardingCompletedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Today's greeting surfaces.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /what should we call you/i })
      ).not.toBeInTheDocument();
    });
  });

  it("skipped user at / stays on Today", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /what should we call you/i })
      ).not.toBeInTheDocument();
    });
  });
});

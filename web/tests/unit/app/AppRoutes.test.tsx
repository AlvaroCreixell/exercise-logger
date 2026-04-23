import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
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

// Pre-warm the lazy route modules this suite drives. React.lazy() calls
// import() at first render; if the chunk has not been evaluated yet, the
// <Suspense> fallback ("Loading...") can outlast React Testing Library's
// default 1000ms findBy* timeout under full-suite parallelism. Awaiting
// these imports once up-front populates the ESM module cache, so the
// subsequent React.lazy() factory resolves synchronously.
//
// See docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md
// for the investigation.
beforeAll(async () => {
  await Promise.all([
    import("@/features/onboarding/OnboardingWelcomeScreen"),
    import("@/features/today/TodayScreen"),
  ]);
});

/** Timeout used for all findBy* / waitFor calls in this suite. 4000ms is
 * comfortably below Vitest's 5000ms per-test limit and well above the
 * observed async cost of useAppInit + useSettings on slow workers. */
const WAIT_TIMEOUT = 4000;

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
      await screen.findByRole(
        "heading",
        { name: /what should we call you/i },
        { timeout: WAIT_TIMEOUT }
      )
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
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("skipped user at / stays on Today", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("skipped user at /onboarding redirects to /", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("completed user at /onboarding redirects to /", async () => {
    await seedSettings({ onboardingCompletedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });
});

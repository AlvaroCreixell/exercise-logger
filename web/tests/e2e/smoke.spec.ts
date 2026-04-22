import { test, expect } from "@playwright/test";
import { skipOnboardingIfShown } from "./helpers/onboarding-helpers";

test("app loads and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  await skipOnboardingIfShown(page);
  // Fresh app auto-seeds the bundled routine — Today shows the routine with Start Workout
  await expect(page.getByText(/start workout/i)).toBeVisible({ timeout: 10000 });
});

test("bottom nav has all four tabs", async ({ page }) => {
  await page.goto("/");
  await skipOnboardingIfShown(page);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByText("Today")).toBeVisible();
  await expect(nav.getByText("Workout")).toBeVisible();
  await expect(nav.getByText("History")).toBeVisible();
  await expect(nav.getByText("Settings")).toBeVisible();
});

test("can navigate between all tabs", async ({ page }) => {
  await page.goto("/");
  await skipOnboardingIfShown(page);

  await page.getByRole("link", { name: "Workout" }).click();
  await expect(
    page.getByRole("heading", { name: "No Active Workout" })
  ).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(
    page.getByRole("heading", { name: "No History Yet" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText(/start workout/i)).toBeVisible({ timeout: 10000 });
});

test("Service Worker activates and the app remains interactive after network goes offline", async ({ page, context }) => {
  await page.goto("/");
  await skipOnboardingIfShown(page);
  // Wait for the SW to activate and claim this page.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state === "activated";
  }, { timeout: 15_000 });

  // Verify the app is fully rendered while online.
  await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });

  // Drop the network connection. The already-loaded SPA (React) should
  // remain interactive — no reload needed — because all assets are in memory.
  await context.setOffline(true);
  // The tab bar and Today screen should still be visible (React is running).
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await context.setOffline(false);
});

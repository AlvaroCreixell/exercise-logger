import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.(spec|e2e)\.ts$/,
  // Onboarding + a local-first Dexie app share a single IndexedDB per
  // origin. Parallel workers race on addInitScript DB deletes and seed
  // helpers. Serialize to eliminate cross-test contamination.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173/exercise-logger",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/exercise-logger/",
    reuseExistingServer: !process.env.CI,
  },
});

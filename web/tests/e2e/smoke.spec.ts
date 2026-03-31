import { test, expect } from "@playwright/test";

test("app loads and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  // Fresh app with no routine shows "No Active Routine"
  await expect(
    page.getByRole("heading", { name: "No Active Routine" })
  ).toBeVisible();
});

test("bottom nav has all four tabs", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByText("Today")).toBeVisible();
  await expect(nav.getByText("Workout")).toBeVisible();
  await expect(nav.getByText("History")).toBeVisible();
  await expect(nav.getByText("Settings")).toBeVisible();
});

test("can navigate between all tabs", async ({ page }) => {
  await page.goto("/");

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
  await expect(
    page.getByRole("heading", { name: "No Active Routine" })
  ).toBeVisible();
});

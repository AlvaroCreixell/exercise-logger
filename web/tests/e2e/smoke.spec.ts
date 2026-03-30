import { test, expect } from "@playwright/test";

test("app loads and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
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
  await expect(page.getByText("No active workout")).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Your workout history")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Routines, preferences")).toBeVisible();

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("Your daily workout overview")).toBeVisible();
});

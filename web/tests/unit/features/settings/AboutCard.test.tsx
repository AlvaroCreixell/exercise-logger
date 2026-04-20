import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

// Declare the Vite define so the component can read it in tests.
// Vitest inherits `define` from vite.config.ts, but we also set it here
// for defensive resilience if the config hasn't been reloaded.
declare const globalThis: typeof global & { __APP_VERSION__?: string };

beforeAll(() => {
  globalThis.__APP_VERSION__ = "9.9.9-test";
});
afterAll(() => {
  delete globalThis.__APP_VERSION__;
});

describe("AboutCard", () => {
  it("renders the title 'Exercise Logger'", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText("Exercise Logger")).toBeVisible();
  });

  it("renders the tagline", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText(/offline-first gym logger/i)).toBeVisible();
  });

  it("renders the description", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(
      screen.getByText(/your workouts stay on this device/i)
    ).toBeVisible();
  });

  it("renders the version from __APP_VERSION__", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText(/version 9\.9\.9-test/i)).toBeVisible();
  });
});

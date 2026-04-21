import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA manifest theme colors", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../vite.config.ts"),
    "utf8",
  );

  it("theme_color matches the warm-paper meta theme-color in index.html", () => {
    const indexHtml = readFileSync(
      resolve(__dirname, "../../../index.html"),
      "utf8",
    );
    const meta = indexHtml.match(/name="theme-color"\s+content="([^"]+)"/);
    expect(meta?.[1]).toBe("#FCFAF5");
    expect(source).toMatch(/theme_color:\s*"#FCFAF5"/);
  });

  it("background_color matches the paper tone (warm paper)", () => {
    // Same hex as theme_color; the OS uses background_color for the splash
    // card under the icon while the PWA boots.
    expect(source).toMatch(/background_color:\s*"#FCFAF5"/);
  });
});

import { describe, it, expect } from "vitest";
import { extractSharedYaml } from "@/shared/lib/extractSharedYaml";

const YAML = `version: 1
name: "Test"
rest_default_sec: 90`;

describe("extractSharedYaml", () => {
  it("returns plain YAML unchanged (trimmed)", () => {
    expect(extractSharedYaml(`\n${YAML}\n  `)).toBe(YAML);
  });

  it("unwraps a ```yaml fenced block", () => {
    expect(extractSharedYaml("```yaml\n" + YAML + "\n```")).toBe(YAML);
  });

  it("unwraps a bare ``` fenced block", () => {
    expect(extractSharedYaml("```\n" + YAML + "\n```")).toBe(YAML);
  });

  it("extracts the fenced block out of surrounding prose (ChatGPT share shape)", () => {
    const shared = `Here's your routine!\n\n\`\`\`yaml\n${YAML}\n\`\`\`\n\nEnjoy your training!`;
    expect(extractSharedYaml(shared)).toBe(YAML);
  });

  it("uses the first fenced block when several exist", () => {
    const shared = "```yaml\n" + YAML + "\n```\ntext\n```\nother: block\n```";
    expect(extractSharedYaml(shared)).toBe(YAML);
  });

  it("drops an unclosed opening fence line", () => {
    expect(extractSharedYaml("```yaml\n" + YAML)).toBe(YAML);
  });

  it("returns an empty string for empty/whitespace input", () => {
    expect(extractSharedYaml("")).toBe("");
    expect(extractSharedYaml("   \n ")).toBe("");
  });
});

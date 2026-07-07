import { describe, it, expect } from "vitest";
import { mapProviderError, ANTHROPIC_MODEL } from "@/services/llm/anthropic-provider";
import { GenerationFailure } from "@/services/llm/types";

describe("ANTHROPIC_MODEL", () => {
  it("targets Haiku 4.5", () => {
    expect(ANTHROPIC_MODEL).toBe("claude-haiku-4-5");
  });
});

describe("mapProviderError", () => {
  it("passes an existing GenerationFailure through unchanged", () => {
    const original = new GenerationFailure("validation", "already typed");
    expect(mapProviderError(original)).toBe(original);
  });

  it("maps 401/403 to auth", () => {
    expect(mapProviderError({ status: 401, message: "unauthorized" }).kind).toBe("auth");
    expect(mapProviderError({ status: 403, message: "forbidden" }).kind).toBe("auth");
  });

  it("maps 429 and 529 to rate-limit", () => {
    expect(mapProviderError({ status: 429 }).kind).toBe("rate-limit");
    expect(mapProviderError({ status: 529 }).kind).toBe("rate-limit");
  });

  it("maps a status-less connection error to network", () => {
    expect(mapProviderError(new TypeError("Failed to fetch")).kind).toBe("network");
  });

  it("maps anything else to unknown", () => {
    expect(mapProviderError({ status: 400, message: "bad request" }).kind).toBe("unknown");
    expect(mapProviderError("weird").kind).toBe("unknown");
  });
});

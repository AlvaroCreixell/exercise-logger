// Anthropic implementation of LlmProvider. Calls api.anthropic.com directly
// from the browser with the user's own key (dangerouslyAllowBrowser is the
// SDK's documented opt-in for exactly this bring-your-own-key client case).
// The SDK + zod helper are dynamically imported to keep them out of the main
// bundle — they load with the generation flow only.

import { generatedRoutineSchema } from "./routine-schema";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "./types";

export const ANTHROPIC_MODEL = "claude-haiku-4-5";

/** Output budget: a full multi-day routine JSON is ~1-3k tokens; 8k is roomy. */
const MAX_TOKENS = 8192;

let sdkPromise: Promise<{
  Anthropic: typeof import("@anthropic-ai/sdk").default;
  zodOutputFormat: typeof import("@anthropic-ai/sdk/helpers/zod").zodOutputFormat;
}> | null = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import("@anthropic-ai/sdk"),
      import("@anthropic-ai/sdk/helpers/zod"),
    ]).then(([sdk, zodHelpers]) => ({
      Anthropic: sdk.default,
      zodOutputFormat: zodHelpers.zodOutputFormat,
    }));
  }
  return sdkPromise;
}

/**
 * Map any thrown value to a typed GenerationFailure. Status-based (not
 * instanceof) so it is independent of the dynamically imported SDK classes.
 */
export function mapProviderError(err: unknown): GenerationFailure {
  if (err instanceof GenerationFailure) return err;

  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  const message = err instanceof Error ? err.message : "Request failed";

  if (status === 401 || status === 403) {
    return new GenerationFailure("auth", message);
  }
  if (status === 429 || status === 529 || status === 503) {
    return new GenerationFailure("rate-limit", message);
  }
  if (typeof status === "number") {
    return new GenerationFailure("unknown", message);
  }
  // No HTTP status → the request never got a response: offline, DNS, CORS.
  if (err instanceof Error) {
    return new GenerationFailure("network", message);
  }
  return new GenerationFailure("unknown", message);
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  return {
    async generateRoutine(system: string, messages: ProviderMessage[]) {
      const { Anthropic, zodOutputFormat } = await loadSdk();
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        maxRetries: 1, // one automatic retry on 429/5xx (spec: error handling table)
      });
      try {
        const response = await client.messages.parse({
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          output_config: { format: zodOutputFormat(generatedRoutineSchema) },
        });
        if (response.parsed_output == null) {
          throw new GenerationFailure(
            "unknown",
            "The model returned no parseable routine."
          );
        }
        return response.parsed_output;
      } catch (err) {
        throw mapProviderError(err);
      }
    },
  };
}

/**
 * Cheap authenticated ping for the Settings "Test connection" button.
 * models.retrieve is free and fails with 401 on a bad key.
 */
export async function testAnthropicKey(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const { Anthropic } = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    await client.models.retrieve(ANTHROPIC_MODEL);
    return { ok: true, message: "Connected — key works." };
  } catch (err) {
    const failure = mapProviderError(err);
    if (failure.kind === "auth") {
      return { ok: false, message: "Invalid API key." };
    }
    if (failure.kind === "network") {
      return { ok: false, message: "Network error — are you online?" };
    }
    return { ok: false, message: failure.message };
  }
}

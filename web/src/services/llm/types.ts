import type { ValidationError } from "@/services/routine-service";
import type { GeneratedRoutine } from "./routine-schema";

/** One turn in the generation conversation sent to the provider. */
export interface ProviderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Why a generation attempt failed — drives the GenerationScreen error UI. */
export type GenerationFailureKind =
  | "no-api-key"
  | "auth"
  | "rate-limit"
  | "network"
  | "validation"
  | "unknown";

/** Typed failure carrying the kind and (for "validation") the final errors. */
export class GenerationFailure extends Error {
  readonly kind: GenerationFailureKind;
  readonly validationErrors: ValidationError[];

  constructor(
    kind: GenerationFailureKind,
    message: string,
    validationErrors: ValidationError[] = []
  ) {
    super(message);
    this.name = "GenerationFailure";
    this.kind = kind;
    this.validationErrors = validationErrors;
  }
}

/**
 * Provider abstraction: one structured-output round trip. Implementations
 * throw GenerationFailure on transport/auth errors. The Anthropic
 * implementation lives in anthropic-provider.ts; tests inject fakes.
 */
export interface LlmProvider {
  generateRoutine(
    system: string,
    messages: ProviderMessage[]
  ): Promise<GeneratedRoutine>;
}

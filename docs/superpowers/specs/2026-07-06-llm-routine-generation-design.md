# Embedded LLM Routine Generation — Design Spec

**Date:** 2026-07-06
**Status:** Approved by user (pre-implementation)
**Replaces:** the custom-GPT copy/paste flow (questionnaire → prompt → external GPT → paste YAML)

## Problem

Routine creation today is choppy: the user completes an 11-step questionnaire, copies a
generated prompt, opens an external custom GPT, waits for it to emit routine YAML, and
pastes that YAML back into the app for validation and import. The round-trip breaks flow,
depends on a third-party chat surface, and the Android share-target hand-back is broken.

## Goal

Generate the routine **inside the app**: questionnaire answers go straight to an embedded
LLM API call, the response is validated with the existing pipeline, previewed, and
activated — no copy/paste, no external tab.

## Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| API key handling | User pastes their own key into Settings; stored on-device (Dexie settings record); browser calls the API directly. No proxy, no baked-in key. |
| Provider | Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`) behind a small `LlmProvider` interface so other providers can be added later. |
| Old GPT flow | Removed entirely. Manual YAML import in Settings remains as the universal fallback. |
| Generation approach | **Structured outputs** (Anthropic `output_config.format` with a Zod schema) → convert → existing domain validation → automatic repair loop for semantic errors. |
| Result UX | Preview the generated routine, then explicit "Use this routine" / "Regenerate". No auto-activation. |
| Entry points | First-run onboarding **and** a "Generate new routine" entry in Settings. |

## Architecture & data flow

```
Questionnaire (existing, unchanged)
      ↓ answers (sessionStorage, existing mechanism)
GenerationScreen ──→ generation-service ──→ LlmProvider (Anthropic Haiku 4.5)
                          ↓ structured JSON (schema-guaranteed shape)
                     JSON → contract object → validateRoutineObject (existing logic)
                          ↓ semantic errors? → repair round-trip (max 2) with errors fed back
                          ↓ valid NormalizedRoutine
                     RoutinePreview → "Use this routine" → importAndActivateRoutine (existing)
```

- Structured outputs eliminate syntax failures; the response is guaranteed to match the
  generation schema.
- Strict JSON schemas cannot express dynamic object keys, so the generation schema uses
  `days: [{ id, label, entries }]` (an **array**), converted to the YAML contract's
  keyed-map shape before validation.
- Rules the schema cannot express — unknown `exercise_id`, superset set-count equality,
  `day_order` ↔ `days` consistency, range `min < max`, positive counts — are caught by the
  existing validator. Its errors are formatted and sent back to the model for up to
  **2 automatic repair attempts** before surfacing failure to the user.

## New components

```
web/src/services/llm/
  types.ts                 # LlmProvider interface, GenerationResult, GenerationError kinds
  anthropic-provider.ts    # @anthropic-ai/sdk with dangerouslyAllowBrowser: true,
                           # model claude-haiku-4-5, structured outputs via zodOutputFormat
  routine-schema.ts        # Zod schema mirroring the routine contract (generation shape)
  system-prompt.ts         # coach persona + contract rules + embedded exercise catalog (~90 rows)
web/src/services/generation-service.ts
                           # orchestrates: user prompt → provider → convert → validate → repair loop
web/src/features/onboarding/GenerationScreen.tsx
                           # generating / preview / error states; replaces HandoffScreen
web/src/features/onboarding/components/RoutinePreview.tsx
                           # readable summary: name, days, exercises, set×rep, supersets, cardio
```

Supporting changes:

- **`routine-service.ts` refactor:** split `validateRoutineObject(raw, lookup)` out of
  `validateAndNormalizeRoutine(yamlText, lookup)`. The YAML wrapper keeps its exact public
  behavior (manual import path untouched); the JSON path calls the object validator directly.
- **User prompt:** reuse `buildPrompt(answers)` with the lead-in/trailing text adjusted
  (no more "self-check protocol" references — the contract lives in the system prompt).
- **Services purity:** `generation-service` follows the existing services convention
  (pure functions, `db` first argument where DB access is needed); the provider is
  injected so tests never touch the network.

## API key & settings

- New `llmApiKey: string` field on the settings record (`""` = not configured — matching
  the codebase's no-null-sentinel convention). Stored in IndexedDB, never leaves the
  device except in requests to `api.anthropic.com`.
- Settings screen: new "AI routine generation" section with a masked key input, save, and
  a "Test connection" button (minimal-token ping that surfaces 401 vs OK).
- Direct browser calls use the official TypeScript SDK with `dangerouslyAllowBrowser: true`
  (Anthropic-supported for user-provided-key client apps).

## UX flow

**Onboarding:** questionnaire finish → GenerationScreen.
- No key configured → inline setup card: paste key (saves to settings) or "import YAML
  manually" escape hatch (existing RoutineImportScreen).
- **Generating:** progress indicator with staged copy ("Designing your split… validating…").
  Expected ~5–15 s on Haiku.
- **Preview:** RoutinePreview + primary **Use this routine** (validates already done →
  `importAndActivateRoutine` → `markOnboardingCompleted` → navigate to Today) and
  secondary **Regenerate** (same answers, fresh call).

**Settings re-entry:** "Generate new routine" row → same questionnaire → GenerationScreen
in re-generation mode:
- no onboarding-completion writes;
- respects the existing service-layer guard: routine activation is blocked during an
  active workout session — surfaced with a clear message.

Wizard answers persist in sessionStorage (existing `session-storage.ts` mechanism) so
Regenerate and mid-flow recovery work without retyping.

## Error handling

| Failure | Behavior |
|---|---|
| No / invalid API key (401) | "Check your API key in Settings" + direct link to the settings section |
| Offline / network error | "You're offline — generation needs a connection" + Retry |
| Rate limit / overloaded (429 / 529) | One automatic retry with backoff, then surface with Retry button |
| Semantic validation still failing after 2 repairs | Show formatted validation errors + Try again + manual-import escape hatch |
| Refusal / empty response | Generic "generation failed" + Retry (not expected for this domain) |

Manual YAML import remains untouched as the universal fallback for every failure mode.

## Removals

- `HandoffScreen.tsx` and its route (`/onboarding/handoff`)
- `shared/lib/gpt-url.ts` (`GPT_URL`)
- `components/LastPromptCard.tsx`
- `lastGeneratedPrompt` settings lifecycle (`saveGeneratedPrompt` / `clearLastPrompt`);
  the Today onboarding banner re-points to "finish setting up your routine" driven by
  saved wizard state instead of a saved prompt
- `ShareTargetRedirect` / `extractSharedYaml` **stay**: they serve generic manual YAML
  import (sharing a YAML file into the app), not just the GPT flow — only copy that
  routes shared YAML "back from the GPT" is reworded
- `docs/custom-gpt/` gets a deprecation note; `routine-yaml-contract.md` and
  `exercise-catalog-reference.md` stay — they are the source material for the system
  prompt and generation schema

## Testing

- **Unit (Vitest):**
  - `generation-service` with a mocked `LlmProvider`: happy path; one repair round; repairs
    exhausted; 401/429/network error mapping; refusal/empty response.
  - Schema→contract conversion (days array → keyed map, supersets, cardio, notes).
  - System/user prompt assembly snapshots.
  - `validateRoutineObject` split: existing YAML-path tests unchanged and passing.
- **E2E (Playwright):** `page.route()` intercepts `api.anthropic.com` with a canned
  structured-output response — full questionnaire → generating → preview → activate →
  Today flow, plus the no-key and validation-failure paths. Runs without real keys.
- **Manual smoke with a real key** is the final step once the user provides one.

## Out of scope (YAGNI)

- Free-text revision chat on the preview ("more leg volume") — Regenerate covers v1.
- OpenAI adapter — the `LlmProvider` interface leaves the door open.
- Proxy/backend infrastructure.
- Streaming token display during generation.

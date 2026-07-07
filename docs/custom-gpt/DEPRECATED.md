# Deprecated — replaced by in-app generation (2026-07-06)

The custom-GPT copy/paste flow was removed. Routine generation now happens
in-app via the Anthropic API (see `web/src/services/llm/` and
`docs/superpowers/specs/2026-07-06-llm-routine-generation-design.md`).

Still-relevant files:
- `routine-yaml-contract.md` — the import contract, still enforced by
  `validateRoutineObject` and still the reference for manual YAML import.
- `exercise-catalog-reference.md` — human-readable catalog reference. The
  generation system prompt builds its catalog section from the live DB, so
  this file is informational only.

Historical: `workout-routine-gpt.instructions.md` (superseded by
`web/src/services/llm/system-prompt.ts`), `README.md` setup instructions.

# Onboarding Questionnaire — Sprint Orchestration Plan (PM)

> **For the operator:** This is an **orchestration plan**, not a task plan. It does not contain the code-level steps that ship the feature. Each sprint's code-level *implementation plan* is produced by invoking `superpowers:writing-plans` with the prompt in the sprint's §N.1 below, then executed via `superpowers:subagent-driven-development`. This document tracks sprint-level progress; each sprint's own plan tracks task-level progress.
>
> **Scope:** Sprints A → E, end-to-end delivery of the First-Run Onboarding & Routine-Questionnaire feature on branch `feat/onboarding-questionnaire`.

**Goal:** Ship the in-app first-run welcome + 11-step questionnaire + GPT hand-off round-trip, replacing the "cold ChatGPT conversation" with a guided 2-minute flow that produces a pastable prompt and round-trips a YAML routine.

**Architecture:** Feature module `web/src/features/onboarding/` (screens + steps + lib + components) on top of existing `Dexie v3` settings fields, a pure `prompt-builder`, a single `HandoffScreen` with a two-stage local state machine, and a Settings/Today integration that makes the flow discoverable and recoverable.

**Tech Stack:** React 19 + Vite 7 + TypeScript 5 · Tailwind v4 + shadcn/ui · Dexie 4 (IndexedDB) · Vitest + RTL + Playwright · sonner (toasts) · existing `react-router` + `dexie-react-hooks` + `useLiveQuery` patterns. No new runtime dependencies.

---

## 1. Source material every sprint planner MUST read

Before invoking `/writing-plans` for any sprint, the planner should have ingested these in this order:

| # | Path | Why |
|---|---|---|
| 1 | `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` | The authoritative spec. Every decision D1–D12 is locked there. |
| 2 | `docs/custom-gpt/workout-routine-gpt.instructions.md` | Co-shipping: 11-topic intake + "skip intake when pre-built" paragraph. The app prompt must match this. |
| 3 | `docs/archive/claude-design-handoffs/2026-04-21/Design Handoff.md` | Design tokens (paper+sage, Instrument Serif for heroes, 18px card radius, 999px chip pill, hairlines). Do not invent new visual vocabulary. |
| 4 | `CLAUDE.md` (root) | App invariants 1–12 (active-session gate, snapshots, compound-index null trap, etc.) |
| 5 | `web/src/domain/CLAUDE.md` · `web/src/db/CLAUDE.md` · `web/src/services/CLAUDE.md` | Layer contracts: services take `db` as first arg; timestamps are ISO strings; `instanceLabel` is `""` not `null`; Dexie compound-index null pitfall. |
| 6 | `web/src/features/settings/CLAUDE.md` · `web/src/features/today/CLAUDE.md` | Feature module conventions the planner will either follow or extend. |
| 7 | `web/src/features/settings/RoutineImportScreen.tsx` | Existing stage-2 equivalent: YAML paste + validate + import. We reuse its helpers. |
| 8 | `web/src/app/App.tsx` | Current route table + `FadeRoute` + `Shell`. Route additions land here. |
| 9 | `web/src/features/today/TodayScreen.tsx` | Where the greeting line and the banner slot live. |
| 10 | `.superpowers/brainstorm/186-1776836513/content/final-copy.html` | Source of truth for step copy (titles, subtitles, chip labels). Transcribe verbatim. |

---

## 2. Sprint pipeline

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  A — Foundation │──▶│  B — Mechanics │──▶│  C — Content   │──▶│  D — Integrate │──▶│  E — E2E+Polish│
│  schema,svc,    │   │  reducer,shell,│   │  11 steps+host │   │  handoff,today,│   │  playwright,a11y│
│  prompt-builder │   │  chips,storage │   │  welcome, routes│  │  settings,gate │   │  final PR      │
└────────────────┘   └────────────────┘   └────────────────┘   └────────────────┘   └────────────────┘
         │                    │                    │                    │                    │
   ~25 tests            ~27 tests            ~22 tests            ~20 tests             ~4 E2E
   ~1 day               ~1–1.5 days         ~2 days              ~1.5 days             ~1 day
```

**Total test delta:** ~70 new tests. Baseline 742 → ~812.
**Branch:** all sprints commit to `feat/onboarding-questionnaire`. One squash-merge PR to `main` at end of Sprint E.
**Worktree strategy:** *optional* per sprint. Helpful for Sprint C (parallel step-component sub-agents) and Sprint D (isolated Settings/Today experiments). Not required for A, B, E.

**Sprint dependencies (hard):**
- B depends on A (uses `Settings` type + `setUserName` sig).
- C depends on B (uses `WizardShell`, `ChipRow`, reducer, sessionStorage util).
- D depends on A + C (uses `prompt-builder`, `onboarding-service`, `QuestionnaireScreen` route).
- E depends on A + B + C + D (E2E exercises the whole flow).

**No cross-sprint parallelism.** Sequential plan → review → implement → review → polish per sprint.

---

## 3. Shared conventions every sprint must honor

| Convention | Rule | Source |
|---|---|---|
| Timestamps | ISO 8601 UTC strings via `nowISO()` from `@/domain/timestamp`. Never `Date` objects in storage. | Root CLAUDE.md |
| Path alias | `@/` maps to `web/src/`. Always use aliased imports. | Root CLAUDE.md |
| DB guards | Active-session guards go **inside** the transaction, never before, to avoid TOCTOU. | `services/CLAUDE.md`, settings-service.ts |
| Compound-index null trap | Never store `null` in a compound-index field. Use `""` sentinel. | `db/CLAUDE.md` |
| Services signature | `export async function xxx(db: ExerciseLoggerDB, ...): Promise<...>`. db is first arg. | `services/CLAUDE.md` |
| Reactive reads | UI reads Dexie via `useLiveQuery` / hooks (e.g., `useSettings`). Never direct `await db.x.get` in components. | existing hooks |
| Tests | `fake-indexeddb` for Dexie, Vitest + RTL for components, Playwright for E2E. Helper factories (`makeExercise`, etc.) in each test file. | Root CLAUDE.md |
| Toasts | `sonner`. Reuse existing config; don't replace. | `App.tsx:162` |
| Icons | Inline SVG components in `@/shared/icons`. No icon fonts/sprite sheets. | Design Handoff §6 |
| Typography | `text-hero-serif` (Instrument Serif 32px italic, hero only), `text-eyebrow` (Inter 11px 600 uppercase 0.08em tracking), `text-meta` (Inter 12px 500 `--ink-3`). Already wired in Tailwind v4 config. | Design Handoff §1 |
| Colors | `--paper`, `--card`, `--ink`/`--ink-2`/`--ink-3`, `--line`/`--line-soft`, `--sage`/`--sage-deep`/`--sage-soft`. All already in `:root`. Use via Tailwind utilities `bg-sage-soft`, `text-ink-2`, etc. | Design Handoff §1 |
| Radii | `--radius-card` 18px for cards, `--radius-pill` 999px for chips. | Design Handoff §1 |
| Motion | `--dur-fadeInUp`/`--ease-handoff` for route changes (reuse `FadeRoute`). For step-index changes *inside* the questionnaire, use a 150ms cross-fade — not a new horizontal slide. | Design Handoff §1 + App.tsx |
| Commits | Conventional Commits: `feat(onboarding): …`, `test(onboarding): …`, `refactor(onboarding): …`, `docs: …`, `fix: …`. Small, frequent. | `git log --oneline` |
| No new deps | The feature ships with zero new npm packages. If a sprint thinks it needs one, stop and escalate. | Project policy |

---

## 4. Cross-sprint quality bars (applied at every review gate)

Reviewers (the user or a delegated `superpowers:code-reviewer` agent) use this rubric on **both** the plan-review gate and the implementation-review gate. Each item is a yes/no.

### Plan-review rubric

- [ ] **Spec-coverage:** every spec section in this sprint's scope has at least one task.
- [ ] **Scope discipline:** nothing in the plan extends beyond the sprint's scope (no early grabs at later sprints' work).
- [ ] **TDD present:** every behavior-changing task has "write the failing test" before "implement".
- [ ] **Minimal diff per task:** no task modifies > ~5 files without justification.
- [ ] **No placeholders:** grep the plan for `TODO`, `TBD`, `similar to`, `fill in`, `add appropriate …` — zero matches.
- [ ] **Exact file paths:** every task names paths (create/modify/test) using `web/src/…` absolute-to-repo paths.
- [ ] **Type consistency:** signatures, property names, and enum values referenced in later tasks match their earlier definitions.
- [ ] **Commit cadence:** frequent small commits, not one mega-commit per task.
- [ ] **Existing patterns:** new code follows the layer structure (domain / db / services / features) and the `db`-first-arg service signature.
- [ ] **No new runtime deps.**

### Implementation-review rubric

- [ ] **Full test suite green** on `cd web && npm test` (baseline count + expected sprint delta).
- [ ] **Type-check green** on `cd web && npx tsc --noEmit`.
- [ ] **Lint green** on `cd web && npm run lint`.
- [ ] **Build green** on `cd web && npm run build` when the sprint changes anything built into the bundle.
- [ ] **Diff matches plan:** `git diff main...HEAD --stat` only shows files listed in the plan's "Files" sections.
- [ ] **No regressions:** the 742 pre-sprint tests still pass verbatim.
- [ ] **Sprint exit criteria satisfied** (see each sprint's §N.6).
- [ ] **Conventional-commit log** readable as a narrative of the sprint (no "wip", no "fix thing", no "oops").
- [ ] **Feature CLAUDE.md updated** when the sprint creates a new feature module.

### Polish rubric

- [ ] No dead code / unused imports / unused exports introduced.
- [ ] No `console.log` left from debugging.
- [ ] No `@ts-ignore` / `@ts-expect-error` without a line-level comment explaining why.
- [ ] No TODOs added (fix them or open a follow-up issue).
- [ ] Relevant layer CLAUDE.md files updated if the sprint changed the layer's public surface.
- [ ] PR description (only applies to Sprint E) cites the spec path and lists the D1–D12 decisions the PR honors.

---

## 5. Sprint progress tracker

> Operator: tick each box as you complete the gate.

- [ ] **A.1** Write Sprint A plan (`superpowers:writing-plans` with prompt §A.1)
- [ ] **A.2** Review Sprint A plan against §A.2 checklist
- [ ] **A.3** Execute Sprint A implementation (`superpowers:subagent-driven-development`)
- [ ] **A.4** Review Sprint A implementation against §A.4 checklist
- [ ] **A.5** Polish Sprint A per §A.5
- [ ] **A.6** Sprint A exit criteria satisfied → start Sprint B
- [ ] **B.1** Write Sprint B plan
- [ ] **B.2** Review Sprint B plan
- [ ] **B.3** Execute Sprint B implementation
- [ ] **B.4** Review Sprint B implementation
- [ ] **B.5** Polish Sprint B
- [ ] **B.6** Sprint B exit criteria → start Sprint C
- [ ] **C.1** Write Sprint C plan
- [ ] **C.2** Review Sprint C plan
- [ ] **C.3** Execute Sprint C implementation (parallel sub-agents over steps)
- [ ] **C.4** Review Sprint C implementation
- [ ] **C.5** Polish Sprint C
- [ ] **C.6** Sprint C exit criteria → start Sprint D
- [ ] **D.1** Write Sprint D plan
- [ ] **D.2** Review Sprint D plan
- [ ] **D.3** Execute Sprint D implementation
- [ ] **D.4** Review Sprint D implementation
- [ ] **D.5** Polish Sprint D
- [ ] **D.6** Sprint D exit criteria → start Sprint E
- [ ] **E.1** Write Sprint E plan
- [ ] **E.2** Review Sprint E plan
- [ ] **E.3** Execute Sprint E implementation
- [ ] **E.4** Review Sprint E implementation
- [ ] **E.5** Polish Sprint E + final PR
- [ ] **E.6** PR merged to `main`, GPT instructions pasted to custom-GPT admin UI

---

## 6. Sprint A — Foundation

### A.0 Scope & deliverables

**In scope (code):**

| Path | Kind | Responsibility |
|---|---|---|
| `web/src/db/database.ts` | Modify | Add Dexie `version(3)` with `.upgrade()` backfilling 6 new settings fields. Mark existing users as `onboardingSkippedAt = nowISO()`. |
| `web/src/domain/types.ts` | Modify | Extend `Settings` interface with 6 new nullable fields. |
| `web/src/db/database.ts` | Modify | Extend `DEFAULT_SETTINGS` with the 6 new fields defaulting to `null`. |
| `web/src/services/onboarding-service.ts` | Create | `markOnboardingCompleted`, `markOnboardingSkipped`, `saveGeneratedPrompt`, `clearLastPrompt`, `dismissOnboardingBanner`. Each: plain `db.settings.update("user", {…})`. |
| `web/src/services/settings-service.ts` | Modify | Add `setUserName(db, name)` with trim + `maxLength` 40 (truncate rather than throw). |
| `web/src/shared/lib/gpt-url.ts` | Create | `export const GPT_URL = "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";`. |
| `web/src/features/settings/RoutineImportScreen.tsx` | Modify | Replace inline URL constant with `import { GPT_URL } from "@/shared/lib/gpt-url"`. |
| `web/src/features/onboarding/lib/prompt-builder.ts` | Create | Pure `buildPrompt(answers: Answers): string`. 10 formatting rules from spec §Prompt Generation. |
| `web/src/features/onboarding/lib/types.ts` (or similar) | Create | Exported `Answer` / `Answers` / `StepId` types if `prompt-builder` needs them before Sprint B's reducer lands. |

**In scope (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/unit/services/onboarding-service.test.ts` | ~8 | Each of 5 functions mutates the right field; each writes a valid ISO timestamp; `clearLastPrompt` also nulls `lastGeneratedPromptAt`; `saveGeneratedPrompt` resets `onboardingBannerDismissedAt`. |
| `web/tests/unit/services/settings-service.test.ts` (existing, extend) | ~4 | `setUserName` trims, enforces max length 40 (truncates), accepts unicode, accepts `null` to clear. |
| `web/tests/unit/features/onboarding/prompt-builder.test.ts` | ~10 | Full-answers output matches spec §Prompt Generation example byte-for-byte; minimum answers; Other goal; bodyweight-only; favorites-without-avoid and vice versa; free-text normalization; **step-6 no-parenthetical regression lock**; chip label mapping; empty answers throws. |
| `web/tests/integration/migration-v2-to-v3.test.ts` | ~3 | Fresh v3 install has nullable defaults; upgrade from v2 backfills `onboardingSkippedAt = nowISO()`, leaves `units` and `activeRoutineId` untouched, writes other 5 new fields as `null`. |

**Out of scope (explicit):**
- No UI code. No React components. No routes. No hooks.
- No `features/onboarding/` screens or steps or WizardShell (those are Sprint B/C).
- No change to `RoutineImportScreen` logic — only the URL-constant import change.
- No copy updates to the GPT custom-GPT admin panel (that's an Sprint E PR-checklist item).

**Files touched outside the plan:** none expected. If a task needs to touch a file not listed here, stop and escalate.

**Test delta:** +~25 unit/integration tests. Baseline 742 → ~767.

### A.1 — `/writing-plans` prompt

> Paste this as the `/writing-plans` input. The planner will then produce `docs/superpowers/plans/2026-04-22-onboarding-sprint-a-foundation.md`.

```
Write an implementation plan for Sprint A ("Foundation") of the
onboarding-questionnaire feature. The orchestration plan is at
docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
— read its §Sprint A section as the source of scope, deliverables, and
exit criteria.

Then read, in this order:
1. docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md
   (focus on §Architecture & Data Model, §Prompt Generation,
   §Validation & input limits, and Decisions D3 / D5 / D10)
2. docs/custom-gpt/workout-routine-gpt.instructions.md (so the prompt
   example in the plan matches the GPT's updated 11-topic intake)
3. web/src/db/database.ts + web/src/db/CLAUDE.md (Dexie v1→v2 pattern
   to mimic for v3)
4. web/src/domain/types.ts (current Settings interface)
5. web/src/services/settings-service.ts (existing service patterns,
   in-transaction guard style)
6. web/src/features/settings/RoutineImportScreen.tsx:14–15 (the URL
   constant being extracted)

Write the plan to
docs/superpowers/plans/2026-04-22-onboarding-sprint-a-foundation.md
using the standard writing-plans checkbox format.

Scope (do NOT expand):
- Dexie v3 migration with 6 new Settings fields, all nullable.
- Settings interface + DEFAULT_SETTINGS extensions.
- onboarding-service.ts: 5 functions, each a thin db.settings.update.
- settings-service.setUserName with trim + maxLength=40 truncate.
- shared/lib/gpt-url.ts constant + RoutineImportScreen refactor.
- prompt-builder.ts: pure function per spec §Prompt Generation.
- Answer/Answers/StepId types in features/onboarding/lib so
  prompt-builder can reference them (Sprint B's reducer will also
  import from here).
- All unit tests + a migration v2→v3 integration test.

Out of scope (defer to Sprint B+):
- Any React component, hook, route, or feature/onboarding screens.
- Any sessionStorage utility (that's Sprint B).
- Any changes to RoutineImportScreen beyond swapping the inline URL
  for the shared constant.

TDD discipline: every task writes the failing test first, runs it to
confirm it fails, implements the minimal code, runs to confirm it
passes, and commits. Conventional-commit messages.

Critical correctness items:
- The migration's .upgrade block must mark existing users as
  onboardingSkippedAt = nowISO(), not null (Decision D3).
- prompt-builder step-6 must render the number only — no
  parenthetical example. Include a regression-lock test that asserts
  "Distinct training days desired: 3" and NOT "Distinct training
  days desired: 3 (Push/Pull/Legs)" (Decision D10).
- prompt-builder rule 9 (free-text normalization): trim outer
  whitespace, collapse runs of whitespace/newlines to single space.
  Empty-after-normalize behaves like a skipped optional field.
- The prompt's lead-in must match the spec exactly:
  "I'd like a personalized workout routine. All 11 intake topics
  are answered below — treat this as the complete intake. Do NOT
  ask follow-up questions. Proceed directly to the catalog-ID check
  and YAML generation per your self-check protocol."
- Empty-answers map → throws
  `Error("Cannot build prompt from empty answers — complete the
  questionnaire first.")`.

Expected test count at sprint end: baseline 742 + ~25 new = ~767.

No new runtime dependencies. No UI code in this sprint.
```

### A.2 — Plan-review checklist (additional to §4 shared rubric)

- [ ] Plan has a task for each of the 4 test files in §A.0.
- [ ] The Settings interface change lists all 6 new fields with correct types (5× `string | null`, plus already-existing `id`/`activeRoutineId`/`units` stay unchanged).
- [ ] Migration task shows the full `this.version(3).stores(...).upgrade(...)` code, mirroring the v1→v2 pattern at `database.ts:36–52`.
- [ ] prompt-builder task shows the exact full-answers output from spec §Prompt Generation.
- [ ] prompt-builder test list covers all 10 cases from spec §Testing → Unit tests.
- [ ] `setUserName` behavior is clear: trim, truncate to 40 (not throw), accepts `null`.
- [ ] `RoutineImportScreen.tsx:14-15` is modified (not left with a duplicate constant).
- [ ] No UI files are in any "Files: Create/Modify" section.
- [ ] Plan explicitly says the answers-type file (`lib/types.ts`) is created in this sprint so Sprint B's reducer can import from it without a second file move.

### A.3 — Implementation guidance

**Execution mode:** `superpowers:subagent-driven-development`, single track. This sprint is small and tightly-coupled; parallelism adds more overhead than it saves.

**Recommended order (if plan allows):**
1. Types + Settings interface (compiles with old defaults)
2. DEFAULT_SETTINGS extension
3. Dexie v3 migration + integration test
4. onboarding-service + tests
5. settings-service.setUserName + tests
6. shared/lib/gpt-url + RoutineImportScreen refactor (one small commit)
7. features/onboarding/lib/types.ts (Answer, Answers, StepId)
8. prompt-builder + tests

Each task is its own commit. Expect 8–12 commits total.

**Watch-outs for the implementer:**
- When editing `database.ts`, the `version(2)` block stays intact — `.upgrade` chains, it doesn't replace. The v3 block goes *after* v2.
- Dexie silently drops records from compound indexes if a key field is `null`. The six new fields are not indexed, so this doesn't bite here — but mention it in a comment so future schema additions see the warning.
- `useSettings` (the hook) returns `Settings | undefined`. Do NOT change its return type; the new fields arrive as `null` for existing users post-migration.
- Fake-indexeddb is already configured in the project's Vitest setup. Just `import "fake-indexeddb/auto"` in the test file if needed.
- `RoutineImportScreen` is lazy-loaded; make sure the import path for `GPT_URL` doesn't break the code-split chunk (it won't — shared/lib is always in the main chunk).

### A.4 — Implementation-review checklist (additional to §4 shared rubric)

- [ ] `cd web && npm test` reports ~767 tests, all green.
- [ ] `web/tests/integration/migration-v2-to-v3.test.ts` asserts both the fresh-v3 case and the v2→v3 upgrade case.
- [ ] `prompt-builder.test.ts` has the step-6 regression-lock test and it would fail if anyone reintroduced the parenthetical.
- [ ] `setUserName("  Alvaro  ")` stores `"Alvaro"` (trimmed).
- [ ] `setUserName("x".repeat(100))` stores exactly 40 chars (truncated, not thrown).
- [ ] `setUserName(null)` stores `null`.
- [ ] `buildPrompt({})` throws with the exact spec error message.
- [ ] `RoutineImportScreen.tsx` imports `GPT_URL` from `@/shared/lib/gpt-url` and has zero inline URL strings matching the chatgpt.com host.
- [ ] `git diff main...HEAD` is limited to the 8 paths in §A.0 "In scope (code)" plus the 4 test files.

### A.5 — Polish

- [ ] Update `web/src/db/CLAUDE.md` with the Schema (version 3) section: enumerate the 6 new `Settings` fields and call out that existing users are backfilled as skipped.
- [ ] Update `web/src/services/CLAUDE.md` with an `onboarding-service.ts` entry matching the existing service-description style.
- [ ] Add a one-line comment at the top of `prompt-builder.ts` noting "co-ships with `docs/custom-gpt/workout-routine-gpt.instructions.md` — update both in the same commit".
- [ ] `git log --oneline feat/onboarding-questionnaire ^main` reads as a clean narrative. If it doesn't, squash/reword (interactive-rebase is fine here since nothing is pushed-shared yet; never squash after review in later sprints).

### A.6 — Exit criteria & handoff to Sprint B

**Exit criteria (all must be true before Sprint B starts):**
- ✓ Every item in §A.4 ticked.
- ✓ `prompt-builder(answers)` signature is locked. This is the contract Sprint D's HandoffScreen will call — no renames later.
- ✓ `Answer`, `Answers`, `StepId` types are exported from `@/features/onboarding/lib/types`. Sprint B's reducer imports from here.
- ✓ `Settings` interface has its final shape for this feature. Any further field additions require a v4 migration — avoid.
- ✓ `onboarding-service.ts` functions are named as in spec §Settings Integration → New services. Renames later break Sprint D.

**Handoff to Sprint B planner — must-read list:**
1. `web/src/features/onboarding/lib/types.ts` (new)
2. `web/src/features/onboarding/lib/prompt-builder.ts` (new — B won't call it, but seeing the answer shape helps)
3. `web/src/services/onboarding-service.ts` (new — B calls none of these; D does)
4. `web/src/domain/types.ts` — inspect the updated `Settings` shape
5. This PM plan, §Sprint B

---

## 7. Sprint B — Wizard mechanics

### B.0 Scope & deliverables

**In scope (code):**

| Path | Kind | Responsibility |
|---|---|---|
| `web/src/features/onboarding/lib/questionnaire-state.ts` | Create | Pure reducer. `WizardState` + `WizardAction` (spec §State management). `(state, action) => state`. No side effects. |
| `web/src/features/onboarding/lib/session-storage.ts` | Create | `saveWizardState(state)`, `loadWizardState()`, `clearWizardState()`. Key `exercise-logger:onboarding:in-progress`. Silently no-ops when sessionStorage is unavailable (private browsing). |
| `web/src/features/onboarding/components/WizardShell.tsx` | Create | Progress bar + eyebrow + hero + input slot + footer. Receives `stepIndex`, `totalSteps`, `category`, `title`, `subtitle`, `onBack`, `onNext`, `nextDisabled`, `hideNext`, `onClose`, `children` (the input). Owns the close-confirm dialog via `ConfirmDialog`. |
| `web/src/features/onboarding/components/ChipRow.tsx` | Create | Single-select chip row. Props: `options: {value, label, description?}[]`, `selected`, `onSelect`, `autoAdvance`. Renders `<input type="radio">` semantics when ≤5 options, else `<button aria-pressed>`. |
| `web/src/features/onboarding/components/ChipMulti.tsx` | Create | Multi-select. Supports the bodyweight-only exclusivity prop: `exclusiveValue?: string`. Tapping the exclusive chip clears others; tapping any other clears the exclusive. |
| `web/src/features/onboarding/components/ChipWithDescription.tsx` | Create | Stacked, full-width chip layout used by steps 2, 6, 10. Takes the same options shape as ChipRow but renders vertical. Extracted to share accessibility and styling. |
| `web/src/features/onboarding/components/StepTextArea.tsx` | Create | Multi-line text area + optional skip chip below. Props: `value`, `onChange`, `placeholder`, `maxLength`, `showCounterAt`, `skipChipLabel?`, `onSkip?`. |

**In scope (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/unit/features/onboarding/questionnaire-state.test.ts` | ~15 | Initial state. `answer` updates the right StepId. `next`/`back` clamp at bounds. `jump` validates range. `restart` returns initial. Setting a chip-multi answer with the exclusive value clears siblings; setting a non-exclusive with the exclusive currently selected clears the exclusive. State is immutable across actions. |
| `web/tests/unit/features/onboarding/session-storage.test.ts` | ~4 | Save then load round-trips. Load returns null when key absent. Clear removes the key. Save is a no-op (silent) when sessionStorage throws (mocked). |
| `web/tests/unit/components/onboarding/ChipRow.test.tsx` | ~4 | Single-tap selects. Auto-advance fires `onSelect` AND `onAdvance`. `aria-pressed` correct. Keyboard left/right navigates when rendered as radiogroup. |
| `web/tests/unit/components/onboarding/ChipMulti.test.tsx` | ~4 | Toggle adds/removes. Exclusive-value rule: selecting exclusive clears non-exclusive selections; selecting a non-exclusive while exclusive is active clears exclusive. |
| `web/tests/unit/components/onboarding/StepTextArea.test.tsx` | ~3 | Character counter appears past threshold. maxLength enforces. Skip chip calls `onSkip` and disables the textarea visually. |
| `web/tests/unit/components/onboarding/WizardShell.test.tsx` | ~5 | Progress `aria-valuenow` matches `stepIndex+1`. Back button disabled on stepIndex 0. Next hidden when `hideNext`. Close button opens ConfirmDialog. Heading gets focus on mount. |

**Out of scope (explicit):**
- No step components (Sprint C).
- No routes or screens.
- No QuestionnaireScreen host (Sprint C).
- No HandoffScreen, no Settings/Today integration (Sprint D).
- No copy from `final-copy.html` except what the components need for placeholders in their tests.

**Test delta:** ~27 new tests. Running total ~767 → ~794.

### B.1 — `/writing-plans` prompt

```
Write an implementation plan for Sprint B ("Wizard mechanics") of
the onboarding-questionnaire feature.

Prerequisite: Sprint A is fully merged to feat/onboarding-questionnaire.

Read in this order:
1. docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
   — §Sprint B section is your scope source of truth.
2. docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md
   — §Questionnaire UX, §State management, §Auto-advance rules,
   §Mid-wizard resume, §Validation & input limits, §Accessibility,
   §Welcome screen (/onboarding).
3. docs/archive/claude-design-handoffs/2026-04-21/Design Handoff.md
   — tokens, chip radii, hairlines, typography.
4. web/src/features/onboarding/lib/types.ts (Sprint A output) — the
   Answer / Answers / StepId types your reducer must speak.
5. web/src/shared/ui/ and web/src/shared/components/ — existing
   primitives. Do NOT create new primitives when existing ones fit
   (e.g., ConfirmDialog at shared/components/ConfirmDialog.tsx).
6. web/src/features/workout/ — pattern reference for feature-local
   components + tests.

Write the plan to
docs/superpowers/plans/2026-04-22-onboarding-sprint-b-mechanics.md.

Scope (do NOT expand):
- Pure reducer (questionnaire-state.ts) with all 5 actions.
- sessionStorage utility with silent-fail behavior.
- 5 components: WizardShell, ChipRow, ChipMulti, ChipWithDescription,
  StepTextArea.
- Unit tests per component + reducer + storage.

Out of scope (defer to Sprint C):
- Any step component (GoalStep, ExperienceStep, …).
- OnboardingWelcomeScreen or QuestionnaireScreen orchestrator.
- Any route in App.tsx.

Out of scope (defer to Sprint D):
- HandoffScreen, Stage-1/Stage-2 state machine, clipboard, window.open.
- LastPromptCard, Settings/Today integration, first-run gate.
- Use of onboarding-service.ts from Sprint A.

Critical correctness items:
- Reducer is pure. No Date.now, no Math.random, no sessionStorage
  calls — those happen in the orchestrator (Sprint C) via useEffect.
- ChipMulti's exclusive-value rule must be symmetric: selecting
  the exclusive chip clears others; selecting a non-exclusive while
  exclusive is already selected clears the exclusive.
- WizardShell renders the progress bar with
  role="progressbar" aria-valuemin=1 aria-valuemax=11
  aria-valuenow={stepIndex+1}.
- Single-select steps with ≤5 options: ChipRow renders radiogroup
  semantics (native <input type="radio"> hidden + label styling, or
  role="radiogroup" on the wrapper). Accessibility is non-negotiable.
- Heading focus: WizardShell receives a `headingRef` via `useRef`
  and focuses it on mount / when stepIndex changes.
- StepTextArea's character counter: visible-only past `showCounterAt`
  prop to avoid a 0/300 label on empty state.

Visual fidelity:
- 999px chip pill (--radius-pill). 18px card radius where applicable.
- Selected single chip: dark ink background, paper text. Unselected:
  hairline border, ink text. Hover: sage-soft tint (on non-touch).
- Do not import any new color variable — all exist in the theme.

TDD discipline as always. Expect ~27 new tests.
No new runtime deps.
```

### B.2 — Plan-review checklist

- [ ] Reducer has tests for EACH action type (`answer`, `next`, `back`, `jump`, `restart`) + bounds.
- [ ] ChipMulti tests cover both directions of the exclusive-value rule.
- [ ] WizardShell test asserts heading focus on mount.
- [ ] WizardShell test asserts close-button opens ConfirmDialog (reuse shared `ConfirmDialog`; do not create a new one).
- [ ] No step component or QuestionnaireScreen is in scope.
- [ ] Plan does not use `onboarding-service.ts` at all.
- [ ] All component tests use `@testing-library/react` render helpers, not custom shallow renders.
- [ ] Plan explicitly notes that the reducer is pure (no clock, no I/O) to satisfy Sprint C's testing story.

### B.3 — Implementation guidance

**Execution mode:** `superpowers:subagent-driven-development`. One main agent; if the agent proposes splitting, allow "reducer + storage" as one track and "4 components + WizardShell" as a second parallel track — they share no state.

**Watch-outs:**
- Do not call `sessionStorage.setItem` inside the reducer. Storage is a side-effect the orchestrator binds via `useEffect`.
- `ConfirmDialog` already exists at `web/src/shared/components/ConfirmDialog.tsx` with focus-trap and doubleConfirm support (see `SettingsScreen.tsx:202-225` for an example). Reuse it.
- Focus management: call `headingRef.current?.focus()` inside a `useEffect` with `[stepIndex]` deps. Screen readers announce the heading's text; don't add extra `aria-live` regions.
- Tailwind v4: no `tailwind.config.ts`. Theme extensions live in `@import "tailwindcss"` blocks. Do not add new utilities.
- `cn()` helper at `@/shared/lib/utils` (from shadcn) — use it for conditional classes.

### B.4 — Implementation-review checklist

- [ ] `cd web && npm test` reports ~794 tests green.
- [ ] Reducer tests do NOT import `sessionStorage` or `Date`.
- [ ] `questionnaire-state.ts` has zero `import` lines from `./session-storage` or `@/db`.
- [ ] ChipMulti exclusive-value behavior is tested in BOTH directions.
- [ ] `git diff --stat` limited to the paths in §B.0.
- [ ] Visual spot-check in Storybook-like test or dev server: chips render with 999px pill radius, selected state reads correctly.
- [ ] No new packages in `web/package.json`.

### B.5 — Polish

- [ ] Create `web/src/features/onboarding/CLAUDE.md` with a stub describing the module's role and listing the components + lib files shipped so far. This file will be extended in each subsequent sprint.
- [ ] Inline one-line comment at the top of `questionnaire-state.ts`: "Pure reducer — no I/O, no clock, no storage. The orchestrator binds side effects."

### B.6 — Exit criteria & handoff to Sprint C

**Exit criteria:**
- ✓ Every §B.4 item ticked.
- ✓ Reducer `WizardAction` type is frozen. Sprint C dispatches these actions.
- ✓ WizardShell's prop surface is frozen. 11 step components in Sprint C will all render inside it and pass identical prop shapes.
- ✓ `ChipRow` / `ChipMulti` / `ChipWithDescription` / `StepTextArea` prop surfaces are frozen.

**Handoff to Sprint C planner — must-read list:**
1. `web/src/features/onboarding/lib/questionnaire-state.ts` (reducer API)
2. `web/src/features/onboarding/lib/session-storage.ts` (persistence API)
3. `web/src/features/onboarding/components/WizardShell.tsx` (shell props)
4. All four chip/input components (props)
5. `.superpowers/brainstorm/186-1776836513/content/final-copy.html` (step copy verbatim)
6. This PM plan, §Sprint C

---

## 8. Sprint C — Wizard content (11 steps + welcome + host)

### C.0 Scope & deliverables

**In scope (code):**

| Path | Kind | Responsibility |
|---|---|---|
| `web/src/features/onboarding/OnboardingWelcomeScreen.tsx` | Create | Route `/onboarding`. Name input (autofocus, maxLength 40, Enter submits Start). Start button → trims + `setUserName` + navigate to `/onboarding/questionnaire`. Maybe later → `markOnboardingSkipped` + navigate to `/`. |
| `web/src/features/onboarding/QuestionnaireScreen.tsx` | Create | Route `/onboarding/questionnaire`. Owns `useReducer(questionnaireReducer, initial)`. Binds sessionStorage via `useEffect`. Dispatches step actions. Renders `<WizardShell>` with the current step component as child. On step-11 Next → `navigate("/onboarding/handoff")` WITHOUT calling `saveGeneratedPrompt` (Sprint D commits on Stage 1 button). |
| `web/src/features/onboarding/steps/GoalStep.tsx` | Create | Step 1. 5 chips + "Something else…" (chip-with-other). Auto-advance on preset tap; Next required for other-text. |
| `web/src/features/onboarding/steps/ExperienceStep.tsx` | Create | Step 2. `ChipWithDescription` with 3 options. Auto-advance. |
| `web/src/features/onboarding/steps/RestrictionsStep.tsx` | Create | Step 3. `StepTextArea` with skip chip. Optional. |
| `web/src/features/onboarding/steps/DaysPerWeekStep.tsx` | Create | Step 4. `ChipRow` 2/3/4/5/6. Auto-advance. |
| `web/src/features/onboarding/steps/SessionLengthStep.tsx` | Create | Step 5. `ChipRow` 30/45/60/75/90 min. Auto-advance. |
| `web/src/features/onboarding/steps/DistinctDaysStep.tsx` | Create | Step 6. `ChipRow` 1/2/3/4/5 (numbers only). Examples in subtitle only. Auto-advance. |
| `web/src/features/onboarding/steps/EquipmentStep.tsx` | Create | Step 7. `ChipMulti` with `exclusiveValue="Bodyweight only"`. Explicit Next. |
| `web/src/features/onboarding/steps/PrioritiesStep.tsx` | Create | Step 8. `ChipMulti` + skip chip. Optional. |
| `web/src/features/onboarding/steps/FavoritesAvoidStep.tsx` | Create | Step 9. Two stacked `StepTextArea`s (Love / Avoid) on one screen. Optional. |
| `web/src/features/onboarding/steps/SupersetsStep.tsx` | Create | Step 10. `ChipWithDescription` with 3 options. Auto-advance. |
| `web/src/features/onboarding/steps/CardioStep.tsx` | Create | Step 11. `ChipRow` Yes / No cardio. Auto-advance. |
| `web/src/app/App.tsx` | Modify | Add routes `/onboarding` and `/onboarding/questionnaire` (lazy imports). No first-run gate yet (that's Sprint D). |

**In scope (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/unit/features/onboarding/OnboardingWelcomeScreen.test.tsx` | ~4 | Autofocus. Start with name → `setUserName` + navigate. Start without name → navigate, no setUserName. Maybe later → `markOnboardingSkipped` + navigate to `/`. |
| `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx` | ~6 | Renders step 1 on fresh mount. sessionStorage present → resumes at saved stepIndex. Auto-advance from step 1 → step 2 after chip tap. Back from step 3 → step 2 keeps answer. Next disabled on required-but-unanswered steps. Step 11 Next navigates to `/onboarding/handoff`. |
| `web/tests/unit/features/onboarding/steps/*.test.tsx` | ~11 (1 per step) | Each step renders expected copy, emits the right `Answer` shape, respects its validation rule. Keep these small — the shared behavior lives in the shell/chip tests. |
| `web/tests/integration/onboarding-walkthrough.test.ts` | ~1 | Full 11-step walkthrough via RTL: select chips, type text, assert reducer state matches expected answers map at the end. Does NOT test navigation to `/onboarding/handoff` (Sprint D). |

**Out of scope (explicit):**
- First-run gate in `AppRoutes` (Sprint D).
- HandoffScreen, Settings/Today changes (Sprint D).
- Calling `saveGeneratedPrompt` on step-11 Next (Sprint D commits on Stage 1).
- E2E tests (Sprint E).

**Test delta:** ~22 new tests. Running total ~794 → ~816.

### C.1 — `/writing-plans` prompt

```
Write an implementation plan for Sprint C ("Wizard content") of the
onboarding-questionnaire feature.

Prerequisite: Sprint A and Sprint B are merged to feat/onboarding-questionnaire.

Read in this order:
1. docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
   §Sprint C.
2. docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md
   — §Questionnaire UX (step table, welcome screen), §State management,
   §Validation & input limits, §Accessibility.
3. .superpowers/brainstorm/186-1776836513/content/final-copy.html —
   THE authoritative step copy. Transcribe verbatim.
4. Sprint A output: web/src/features/onboarding/lib/types.ts,
   prompt-builder.ts, web/src/services/onboarding-service.ts.
5. Sprint B output: web/src/features/onboarding/lib/questionnaire-state.ts,
   session-storage.ts, components/*.
6. web/src/app/App.tsx (route table, FadeRoute, Shell).

Write the plan to
docs/superpowers/plans/2026-04-22-onboarding-sprint-c-content.md.

Scope (do NOT expand):
- OnboardingWelcomeScreen (/onboarding).
- QuestionnaireScreen orchestrator (/onboarding/questionnaire).
- 11 step components.
- Route additions in App.tsx.
- Component tests per step + orchestrator test + walkthrough integration.

Out of scope (Sprint D):
- HandoffScreen at /onboarding/handoff.
- saveGeneratedPrompt on step 11 (Sprint D commits it on Stage 1 button).
- First-run redirect gate in AppRoutes.
- Settings "Create a personalized routine" row.
- Today banner or greeting change.

Critical correctness items:
- Step 6 subtitle text must exactly match spec §Step 6 copy. Chips
  are numbers ONLY (1/2/3/4/5), no parenthetical. Decision D10.
- Auto-advance: steps 1, 2, 4, 5, 6, 10, 11 use `ChipRow` or
  `ChipWithDescription` with `autoAdvance={true}`. Steps 7 and 8 use
  `ChipMulti` (no auto-advance). Steps 3 and 9 use `StepTextArea`
  (no auto-advance).
- Step 1 "Something else…" expands a text input without advancing.
  The Answer shape becomes `{ kind: "chip-with-other", value:
  "other", otherText: "<typed>" }`.
- Step 9 renders TWO StepTextAreas on one screen (Love / Avoid). The
  Answer shape is `{ kind: "favorites-avoid", favorites, avoid }`.
- OnboardingWelcomeScreen behavior per spec §Welcome screen
  (/onboarding): Start does NOT set onboardingSkippedAt; Maybe later
  DOES set onboardingSkippedAt and does NOT save the name.
- QuestionnaireScreen must NOT call saveGeneratedPrompt on step-11
  Next. Navigation to /onboarding/handoff only. Sprint D wires
  prompt persistence.
- sessionStorage is bound in a useEffect inside QuestionnaireScreen
  — not in the reducer and not in step components.

Parallelism hint for the executor: the 11 step components can be
implemented by parallel sub-agents (3 agents × ~4 steps each). Each
step contract is: read one Answer from the reducer, render via the
shared shell and chip primitives, dispatch `answer` on change. Shared
copy reference is final-copy.html.

TDD discipline. Expect ~22 new tests.
No new runtime deps.
```

### C.2 — Plan-review checklist

- [ ] The step table in the plan uses copy verbatim from `final-copy.html`. Spot-check step 2, step 6, step 10, step 11.
- [ ] Step 6 chips are numbers only. The description appears only in the subtitle.
- [ ] `OnboardingWelcomeScreen` plan explicitly covers: trim, maxLength=40, autofocus, Enter-submits-Start, Maybe-later path calls `markOnboardingSkipped`.
- [ ] `QuestionnaireScreen` orchestrator plan shows the `useReducer` setup, the `useEffect` that persists to sessionStorage on every state change except `restart`, and the mount-time restore.
- [ ] No task calls `saveGeneratedPrompt` or imports from HandoffScreen.
- [ ] No task modifies `TodayScreen.tsx` or `SettingsScreen.tsx`.
- [ ] App.tsx modification is minimal: two new `<Route>` entries inside `<Shell>`, lazy-loaded. No first-run gate yet.
- [ ] Plan explicitly names which steps use `ChipRow` vs `ChipWithDescription` vs `ChipMulti` vs `StepTextArea` — there should be no ambiguity for the implementer.

### C.3 — Implementation guidance

**Execution mode:** `superpowers:subagent-driven-development` with **parallelism** on the step components.

**Recommended sub-agent layout (post-foundation commits):**
1. **Track 1 (sequential):** Route additions → OnboardingWelcomeScreen → QuestionnaireScreen orchestrator (minus step wiring).
2. **Track 2 (parallel, 3 sub-agents):**
   - Agent α: GoalStep, ExperienceStep, RestrictionsStep, DaysPerWeekStep.
   - Agent β: SessionLengthStep, DistinctDaysStep, EquipmentStep.
   - Agent γ: PrioritiesStep, FavoritesAvoidStep, SupersetsStep, CardioStep.
3. **Merge:** Track 1 integrates all 11 step components; walkthrough integration test lands last.

Each sub-agent is briefed with: the step table from the spec, the copy from `final-copy.html`, and the contract to follow (read from reducer, render in shell, dispatch on change).

**Watch-outs:**
- Lazy-load both new screens in `App.tsx` to match the existing code-split style.
- `FadeRoute` handles route-level transitions. For step-index changes WITHIN `QuestionnaireScreen`, consider a light 150ms cross-fade on the inner content — but do NOT add a new global motion token.
- Steps 3 (restrictions) and 9 (favorites/avoid) use textareas; make sure the keyboard doesn't cover the Next button on iOS — test by scrolling the container above the fold.
- Step 1 "Something else…" vs preset chip: the chip-with-other logic is in the step component, not the reducer. Reducer stores `{ kind: "chip-with-other", value: "other", otherText }` vs `{ kind: "chip", value: "build-muscle" }`.
- `QuestionnaireScreen` must call `clearWizardState()` when step-11 Next navigates to handoff, OR leave it in place until Stage 1 commits (spec §Mid-wizard resume says "Cleared on successful completion (handoff Stage 1 button tap)"). Keep the state until Stage 1 — so Sprint D is responsible for the clear. Plan should say so.

### C.4 — Implementation-review checklist

- [ ] `cd web && npm test` reports ~816 tests green.
- [ ] Manual walkthrough in dev server (`cd web && npm run dev`) from `/onboarding` to `/onboarding/handoff` succeeds (handoff will 404 or be empty — that's expected pre-Sprint-D).
- [ ] Copy spot-check on steps 2, 6, 9, 10 matches `final-copy.html`.
- [ ] Step 6 prompt-relevant output (via the walkthrough integration test that builds final answers) is the bare number with no parenthetical. Tie this back to the Sprint A `prompt-builder` regression lock by running `buildPrompt(answers)` at the end of the walkthrough and asserting the "Distinct training days desired: 3" line.
- [ ] No changes to `TodayScreen.tsx`, `SettingsScreen.tsx`, or `RoutineImportScreen.tsx`.
- [ ] `git diff --stat` limited to the paths in §C.0.
- [ ] No new runtime deps.

### C.5 — Polish

- [ ] Extend `web/src/features/onboarding/CLAUDE.md` with the screens + steps shipped; list the route endpoints.
- [ ] Inline comment at the top of `QuestionnaireScreen.tsx`: "Orchestrator binds reducer ↔ sessionStorage. Persistence of the generated prompt happens in `HandoffScreen` (Sprint D), not here."
- [ ] Visually verify chip heights are identical across `ChipRow` and `ChipWithDescription` (design handoff has the rule: 44px min tap target).

### C.6 — Exit criteria & handoff to Sprint D

**Exit criteria:**
- ✓ Every §C.4 item ticked.
- ✓ `/onboarding/questionnaire` is end-to-end navigable: step 1 → step 11.
- ✓ sessionStorage resume works on reload.
- ✓ All 11 step components use the same shell + chip primitives — no step-specific chip variants.

**Handoff to Sprint D planner — must-read list:**
1. `web/src/features/onboarding/QuestionnaireScreen.tsx` — understand what state it hands off at step-11 Next.
2. `web/src/features/onboarding/lib/prompt-builder.ts` — the function Sprint D calls.
3. `web/src/services/onboarding-service.ts` — the 5 functions Sprint D wires.
4. `web/src/features/settings/RoutineImportScreen.tsx` — the Stage-2-equivalent Sprint D reuses conceptually (NOT literally — HandoffScreen is new).
5. `web/src/features/today/TodayScreen.tsx` — where the banner + greeting go.
6. This PM plan, §Sprint D.

---

## 9. Sprint D — Integration (handoff + settings + today + first-run gate)

### D.0 Scope & deliverables

**In scope (code):**

| Path | Kind | Responsibility |
|---|---|---|
| `web/src/features/onboarding/HandoffScreen.tsx` | Create | Route `/onboarding/handoff`. Two-stage local state machine (Stage 1 ↔ Stage 2). Stage 1: builds prompt, persists via `saveGeneratedPrompt`, writes clipboard, opens GPT tab, flips to Stage 2. Stage 2: paste area + YAML validate + `importAndActivateRoutine` + `markOnboardingCompleted` + `clearLastPrompt` + clear wizard sessionStorage + navigate to `/`. |
| `web/src/features/onboarding/components/LastPromptCard.tsx` | Create | Settings card shown only when `settings.lastGeneratedPrompt !== null`. Actions: Copy, Paste YAML (navigate to Stage 2), Show prompt, Clear. Relative-time label via small inline helper. |
| `web/src/features/settings/SettingsScreen.tsx` | Modify | Insert Profile section at top with inline name editor. Restructure Routine section to include "Create a personalized routine" row and `<LastPromptCard>` when applicable. |
| `web/src/features/today/TodayScreen.tsx` | Modify | Line 164 greeting: `Hi, {name}.` when userName set, else `Hello.`. Add banner above `<StreakPill>` when `lastGeneratedPrompt !== null && onboardingBannerDismissedAt === null`. Banner body navigates to `/onboarding/handoff`; × sets `onboardingBannerDismissedAt = nowISO()`. |
| `web/src/features/today/OnboardingBanner.tsx` | Create | Small component extracted from TodayScreen to keep the screen readable. `role="status"`, sage-soft background, 12px radius, hairline border. |
| `web/src/app/App.tsx` | Modify | Add `/onboarding/handoff` route (lazy). Add the first-run gate in `AppRoutes`: when path is `/` and `settings.onboardingCompletedAt == null && settings.onboardingSkippedAt == null`, redirect to `/onboarding`. Also guard `/onboarding` with a redirect to `/` when `onboardingCompletedAt !== null`. Also guard `/onboarding/handoff` with a redirect to `/onboarding/questionnaire` when `lastGeneratedPrompt == null` and no local just-completed flag. |
| `web/src/features/onboarding/QuestionnaireScreen.tsx` | Modify | On step-11 Next, navigate to `/onboarding/handoff` with an in-memory "just completed" state (so HandoffScreen shows Stage 1 even though `lastGeneratedPrompt` is still null until the button). This routes fix was deferred from Sprint C. |

**In scope (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` | ~8 | Stage 1 shown when `lastGeneratedPrompt == null` + just-completed local flag. Stage 1 CTA: writes clipboard (mocked), opens GPT (mocked `window.open`), persists prompt, flips to Stage 2. Stage 2 shown when `lastGeneratedPrompt !== null`. Invalid YAML shows errors, does not navigate. Valid YAML imports, clears prompt, sets completed, navigates to `/`. Active-session blocks import with toast. Start over clears answers + sessionStorage + prompt. |
| `web/tests/unit/features/onboarding/LastPromptCard.test.tsx` | ~3 | Hidden when `lastGeneratedPrompt === null`. Shown with relative time otherwise. Each action wires to the right service. |
| `web/tests/unit/features/settings/SettingsScreen.test.tsx` (new or extend) | ~3 | Profile section shown with name editor. Name editor saves via `setUserName`. "Create a personalized routine" row navigates to `/onboarding/questionnaire` (with the unfinished-prompt dialog when applicable). |
| `web/tests/unit/features/today/TodayScreen.test.tsx` (new or extend) | ~3 | Greeting "Hi, {name}." when userName set. Banner visible when prompt saved + not dismissed. Banner × sets dismissed. |
| `web/tests/unit/app/App.test.tsx` (new or extend) | ~3 | First-run redirect from `/` → `/onboarding` when neither flag set. No redirect when `onboardingCompletedAt` set. No redirect when `onboardingSkippedAt` set. `/onboarding/handoff` redirects to `/onboarding/questionnaire` when no prompt and no just-completed flag. |

**Out of scope (explicit):**
- Playwright E2E (Sprint E).
- Full acceptance regression (Sprint E).
- Accessibility audit pass (Sprint E).

**Test delta:** ~20 new tests. Running total ~816 → ~836.

### D.1 — `/writing-plans` prompt

```
Write an implementation plan for Sprint D ("Integration") of the
onboarding-questionnaire feature.

Prerequisite: Sprints A, B, C merged to feat/onboarding-questionnaire.

Read in this order:
1. docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
   §Sprint D.
2. docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md
   — §Finale Screen State Machine, §Today banner, §Settings Integration,
   §Error Handling (ALL route-guard rows + clipboard-fallback row), §First-run gate.
3. web/src/features/settings/RoutineImportScreen.tsx — Stage 2's conceptual
   ancestor; we reuse validateAndNormalizeRoutine + importAndActivateRoutine.
4. web/src/features/settings/SettingsScreen.tsx — current structure; we
   insert a Profile section and a Routine section reshuffle.
5. web/src/features/today/TodayScreen.tsx — current greeting at line 164;
   banner goes above <StreakPill>.
6. web/src/app/App.tsx — current AppRoutes and first-run flow.
7. Sprint A output: onboarding-service.ts (all 5 functions used here),
   prompt-builder.ts, gpt-url.ts.
8. Sprint C output: QuestionnaireScreen.tsx (step-11 Next handoff).

Write the plan to
docs/superpowers/plans/2026-04-22-onboarding-sprint-d-integration.md.

Scope (do NOT expand):
- HandoffScreen with Stage 1 ↔ Stage 2 state machine.
- Clipboard writeText + window.open + toast fallbacks.
- YAML validation + importAndActivateRoutine wiring with error paths.
- LastPromptCard.
- SettingsScreen restructure (Profile section + Routine section).
- TodayScreen greeting change + OnboardingBanner component.
- App.tsx: /onboarding/handoff route + first-run gate + 2 guard redirects.
- QuestionnaireScreen small change: pass just-completed state to handoff.

Out of scope (Sprint E):
- Playwright E2E.
- Accessibility audit + iOS/Android device QA.
- Final acceptance regression.

Critical correctness items:
- Stage 1 button handler order matters:
  1. Build prompt (throws on empty → do not navigate, error toast).
  2. Persist via saveGeneratedPrompt (also resets onboardingBannerDismissedAt).
  3. Attempt navigator.clipboard.writeText — catch failure silently; on
     failure, auto-expand "Show prompt" block (spec error-handling row).
  4. Attempt window.open — on null result, toast + inline GPT link.
  5. Toast success.
  6. setStage("handoff-complete") — local React state that flips to Stage 2.
- Stage 2 import handler:
  1. validateAndNormalizeRoutine — on failure, set errors, return, do NOT
     clear prompt.
  2. importAndActivateRoutine — on !ok, toast message, do NOT clear prompt
     (keeps user in retry loop).
  3. On ok: markOnboardingCompleted + clearLastPrompt +
     clearWizardState() + navigate("/", { replace: true }).
- onboardingBannerDismissedAt resets on saveGeneratedPrompt (so a
  regenerated prompt re-shows the banner).
- First-run gate reads settings.onboardingCompletedAt and
  settings.onboardingSkippedAt via useSettings. The existing
  activeRoutineId auto-seed behavior is unrelated and must not be
  disturbed.
- Settings "Create a personalized routine" row: when
  lastGeneratedPrompt !== null, show the 3-option dialog (Start over
  / Continue with previous prompt / Cancel). Start over clears
  prompt + wizard state; Continue navigates to /onboarding/handoff.
- TodayScreen banner: visible only when path is exactly "/"
  (don't render inside /workout etc.). Use useLocation().
- Greeting line: `Hi, ${userName}.` when truthy after trim, else
  "Hello." The trim is already enforced at the service, so the UI
  just needs `settings.userName ?? null` handling.

TDD discipline. Expect ~20 new tests.
No new runtime deps.
```

### D.2 — Plan-review checklist

- [ ] HandoffScreen test plan covers all 8 scenarios listed in §D.0 tests.
- [ ] Clipboard failure is tested (mock `navigator.clipboard.writeText` to throw).
- [ ] `window.open` null is tested (mock to return null).
- [ ] Active-session-blocks-import is tested against the existing `importAndActivateRoutine` contract (it returns `{ok: false, message}`).
- [ ] LastPromptCard hidden-vs-shown logic tested.
- [ ] First-run gate tested with three states: fresh (redirect), completed (no redirect), skipped (no redirect).
- [ ] `/onboarding/handoff` guard test covers the "no prompt + no just-completed flag" case → redirect to `/onboarding/questionnaire`.
- [ ] Greeting test asserts "Hi, Alvaro." and "Hello." paths.
- [ ] Banner test covers visibility + dismiss + re-show on regenerated prompt.
- [ ] No task touches `web/src/features/workout/` or `web/src/features/history/` — those are untouched in this feature.
- [ ] Plan lists the clipboard + window.open mocks as fixtures (not per-test inline) to keep tests DRY.

### D.3 — Implementation guidance

**Execution mode:** `superpowers:subagent-driven-development`, moderate parallelism.

**Recommended sub-agent layout:**
1. **Main track:** HandoffScreen (the hardest piece) — one sub-agent owns Stage 1 + Stage 2 + clipboard + import wiring.
2. **Parallel track:** SettingsScreen + LastPromptCard + TodayScreen + OnboardingBanner + App.tsx gate. One sub-agent; these share no state but touch nearby concerns.
3. **Merge:** QuestionnaireScreen step-11 tweak is a tiny last edit.

**Watch-outs:**
- `importAndActivateRoutine` already handles the transaction + active-session check inside the transaction (`services/CLAUDE.md` §Transaction patterns). Do not add another active-session check outside — TOCTOU risk.
- The `onboardingBannerDismissedAt` reset lives inside `saveGeneratedPrompt` (Sprint A); the HandoffScreen doesn't need to reset it separately.
- Settings "Create a personalized routine" dialog is a reuse of `ConfirmDialog`, but ConfirmDialog currently supports only 2-button variants. Either extend it (small, with a test) OR use a three-button custom dialog inline. Prefer extending for DRY.
- TodayScreen already returns `null` when `!settings` — make sure the banner conditional handles `undefined` too.
- First-run gate: place the redirect inside `AppRoutes` after `useAppInit()` ready-check and before `<Routes>`. It must use `useSettings()` to be reactive.
- When HandoffScreen lands from step-11 Next (Stage 1), the local "just-completed" state is set via route state (`navigate("/onboarding/handoff", { state: { justCompleted: true, answers } })`). Reading `useLocation().state` to seed initial Stage-1 visibility.
- sessionStorage for wizard state: clear it in HandoffScreen Stage 2's success path, not in Stage 1's button. A user who generates the prompt, reloads, and returns should still see the wizard answers if they hit Back — BUT spec §Mid-wizard resume says "Cleared on successful completion (handoff Stage 1 button tap)". Honor the spec. Clear on Stage 1.

### D.4 — Implementation-review checklist

- [ ] `cd web && npm test` reports ~836 tests green.
- [ ] `cd web && npm run build` green.
- [ ] Manual walkthrough in dev server:
  - Fresh install → `/onboarding` auto-redirect works.
  - Welcome → name → Start → wizard → step 11 → handoff Stage 1 → button → toast + tab opens → Stage 2 flips.
  - Stage 2 paste valid YAML → import → Today with new active routine.
  - Stage 2 paste invalid YAML → errors visible, prompt still saved.
  - Close app mid-wizard, reopen → wizard resumes.
  - Close app after Stage 1, reopen Today → banner visible → tap → Stage 2.
  - Dismiss banner → hidden on reload. Regenerate prompt → banner returns.
- [ ] Settings → Profile name editor saves.
- [ ] Settings → "Create a personalized routine" shows the 3-option dialog when a prompt is saved.
- [ ] `git diff --stat` limited to the paths in §D.0.
- [ ] No new runtime deps.
- [ ] No `console.log` or commented-out code in the diff.

### D.5 — Polish

- [ ] Extend `web/src/features/onboarding/CLAUDE.md` with HandoffScreen + banner + state-machine diagram.
- [ ] Extend `web/src/features/settings/CLAUDE.md` to mention the Profile section and LastPromptCard.
- [ ] Extend `web/src/features/today/CLAUDE.md` to mention OnboardingBanner + greeting personalization.
- [ ] If `ConfirmDialog` was extended for 3-button support, update `web/src/shared/components/ConfirmDialog.tsx` comment header.

### D.6 — Exit criteria & handoff to Sprint E

**Exit criteria:**
- ✓ Every §D.4 item ticked.
- ✓ Feature is functionally complete end-to-end via manual walkthrough.
- ✓ All state machines (wizard resume, banner visibility, Stage 1/2, first-run gate) are verified.

**Handoff to Sprint E planner — must-read list:**
1. The full feature on `feat/onboarding-questionnaire` (run it).
2. `web/tests/integration/acceptance.test.ts` (ensure the pre-feature 16-scenario suite still passes).
3. `web/playwright.config.ts` + existing E2E tests for patterns (pixel-7 profile, preview-server port 4173).
4. This PM plan, §Sprint E.

---

## 10. Sprint E — E2E + polish + final PR

### E.0 Scope & deliverables

**In scope (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/e2e/onboarding-first-run.e2e.ts` | 1 | Fresh install → auto-redirect → welcome → fill wizard → handoff Stage 1 (clipboard + window.open mocked) → mock YAML paste → Stage 2 import → Today with name + new active routine. |
| `web/tests/e2e/onboarding-skip.e2e.ts` | 1 | Fresh install → welcome → Maybe later → Today with pre-seeded starter + default "Hello." greeting. |
| `web/tests/e2e/onboarding-settings-relaunch.e2e.ts` | 1 | Pre-skipped user → Settings → "Create a personalized routine" → full flow → import. |
| `web/tests/e2e/onboarding-banner-recovery.e2e.ts` | 1 | Generate prompt → reload → banner visible → tap → Stage 2. Dismiss → reload → banner hidden. Regenerate prompt → banner re-shows. |

**In scope (non-test):**
- Accessibility audit pass across all new screens: keyboard navigation, screen-reader announcements (`axe-core` scan or manual), focus traps, contrast.
- iOS Safari + Android Chrome manual QA notes — especially clipboard + popup-blocker + installed-PWA new-tab behavior.
- Full-suite run (unit + integration + E2E) green.
- `cd web && npm run lint` green.
- `cd web && npm run build` green.
- PR to `main` with a body citing the spec + D1–D12 decisions honored + test-count delta.
- Paste updated `docs/custom-gpt/workout-routine-gpt.instructions.md` into the custom-GPT admin UI (11-topic intake + pre-built-skip paragraph).

**Out of scope (explicit):**
- Any new feature or UX change.
- Any additional unit or component tests outside the E2E layer (fix bugs with targeted tests if the E2E pass uncovers one).

**Test delta:** +4 E2E tests. Running total unit/integration stays ~836. E2E count grows by 4.

### E.1 — `/writing-plans` prompt

```
Write an implementation plan for Sprint E ("E2E + polish") of the
onboarding-questionnaire feature.

Prerequisite: Sprints A–D merged to feat/onboarding-questionnaire. Feature
is functionally complete via manual walkthrough.

Read in this order:
1. docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
   §Sprint E.
2. docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md
   §Testing → E2E + §Risks.
3. web/playwright.config.ts + any existing E2E under web/tests/e2e/
   for patterns and fixtures.
4. web/tests/integration/acceptance.test.ts (the 16-scenario suite —
   this MUST still pass; E2E does not replace it).

Write the plan to
docs/superpowers/plans/2026-04-22-onboarding-sprint-e-e2e-polish.md.

Scope:
- 4 Playwright E2E tests as listed in §E.0.
- Accessibility audit of all new screens (welcome, questionnaire,
  handoff, banner, settings profile).
- Manual device QA checklist (iOS + Android) with a one-paragraph
  write-up in the PR body.
- Full test suite pass.
- PR description template + merge checklist.

Critical correctness items:
- E2E must mock `navigator.clipboard.writeText` and `window.open`
  explicitly — real clipboard access is gated by browser policy.
  Playwright: `page.context().grantPermissions(["clipboard-read",
  "clipboard-write"])`; for window.open, stub via
  `page.exposeFunction` or assert `page.on("popup", ...)` pattern.
- The first-run E2E must start with a clean IndexedDB. Clear via
  `page.addInitScript(() => { indexedDB.deleteDatabase("ExerciseLoggerDB"); })`
  or the project's existing clean-slate helper if one exists.
- The YAML pasted in Stage 2 should be a minimal but valid routine —
  reuse the bundled starter routine YAML as the source, or a small
  2-day fixture. The routine MUST validate and import; that's the
  success path the E2E is proving.
- The acceptance suite (web/tests/integration/acceptance.test.ts)
  has 16 scenarios and must stay green — if any scenario fails after
  this feature, it's a regression in Sprint D, not an E2E fix. File
  a targeted task, don't band-aid in E2E.

Polish items:
- axe-core: run against /onboarding, /onboarding/questionnaire,
  and /onboarding/handoff. Zero critical or serious violations.
- All tap targets >= 44x44 CSS px.
- Focus rings visible on keyboard navigation.

PR description template included in the plan. Must cite:
- The spec path.
- Each Decision D1–D12 with a one-line confirmation.
- Test-count delta (expected ~70).
- Manual QA screenshots / device matrix.
- Reminder: paste updated GPT instructions to the custom-GPT admin
  UI post-merge.

No new runtime deps.
```

### E.2 — Plan-review checklist

- [ ] All 4 E2E tests listed with concrete mock strategies (clipboard, window.open, IndexedDB reset).
- [ ] Plan references `web/tests/integration/acceptance.test.ts` and confirms it stays green.
- [ ] Accessibility audit task is concrete (axe-core run, tap-target check, focus-ring check) — not "audit for a11y".
- [ ] PR description template is complete and in the plan (not a placeholder).
- [ ] Plan includes a "paste the updated GPT instructions" step in the post-merge checklist.

### E.3 — Implementation guidance

**Execution mode:** `superpowers:subagent-driven-development`, single track. E2E cohesion benefits from one writer.

**Watch-outs:**
- iOS Safari's clipboard: real-device clipboard access requires a user gesture. In Playwright we're in Chromium; the permissions grant is enough. Note this limitation in the device-QA checklist so a human validates on real iOS.
- Popup blocker: desktop Chrome allows popups from user gestures by default. Playwright honors this. iOS Safari inside an installed PWA may reject `window.open` — document as a known fallback path (the inline GPT link is the safety net; the spec's error-handling row covers it).
- First-run E2E reset: the project may or may not have a clean-slate helper. If not, `indexedDB.deleteDatabase("ExerciseLoggerDB")` in `beforeEach` via `addInitScript` is the standard pattern.
- If a regression is uncovered in Sprints A–D during E2E authoring, **file a targeted fix task** — do NOT absorb the fix into the E2E plan.

### E.4 — Implementation-review checklist

- [ ] `cd web && npm run test:e2e` green. All 4 new E2E tests included.
- [ ] `cd web && npm test` reports ~836 tests green (unchanged vs Sprint D).
- [ ] `cd web && npm run build` green.
- [ ] `cd web && npm run lint` green.
- [ ] Acceptance suite (web/tests/integration/acceptance.test.ts) 16 scenarios pass.
- [ ] Manual QA screenshots for iOS + Android attached to the PR body (or a note if the devices weren't available).
- [ ] Axe-core scan clean on the 3 new routes.
- [ ] `git diff main...feat/onboarding-questionnaire --stat` reviewed for scope discipline.

### E.5 — Polish + final PR

- [ ] Spot-check `MEMORY.md` — nothing stale about the GPT-YAML integration needs updating (the Android download flow is still broken; this feature doesn't fix it — that's fine).
- [ ] PR description includes:
  - Link to spec.
  - Checklist of D1–D12 with one-line confirmations.
  - Test-count delta (742 → ~836 unit/integration + 4 E2E).
  - Screenshots: welcome, a mid-wizard step, handoff Stage 1, handoff Stage 2, Today with greeting, Settings with Profile + LastPromptCard.
  - **Post-merge action item (bold):** paste `docs/custom-gpt/workout-routine-gpt.instructions.md` into the ace-logger-routine-maker custom-GPT admin UI. Without this, the GPT still thinks there are 12 intake topics and may ask about equipment preferences.
- [ ] Optional (operator call): run `/ultrareview` on the final branch before merging.
- [ ] Squash-merge to `main` with message `feat(onboarding): first-run welcome + 11-step questionnaire + GPT handoff`.
- [ ] After merge: delete the feature branch (`git branch -d feat/onboarding-questionnaire && git push origin --delete feat/onboarding-questionnaire`).
- [ ] Paste updated GPT instructions into the custom-GPT admin UI. Confirm in a new ChatGPT chat that pasting the app's generated prompt produces YAML on the first turn without follow-up questions.

### E.6 — Exit criteria

- ✓ Every §E.4 item ticked.
- ✓ PR merged to `main`.
- ✓ GPT custom-GPT admin UI updated with the new instructions.
- ✓ End-to-end smoke test on the deployed GitHub Pages site: fresh install → onboard → import → train.
- ✓ Feature complete.

---

## 11. Appendix A — Interface contracts (single source of truth)

These contracts are set by Sprint A and Sprint B. Later sprints consume them without renaming.

### A-1. Settings interface (after Sprint A)

```ts
interface Settings {
  id: "user";
  activeRoutineId: string | null;
  units: UnitSystem;
  // added in v3 migration:
  userName: string | null;
  onboardingCompletedAt: string | null;     // ISO timestamp
  onboardingSkippedAt: string | null;       // ISO timestamp
  lastGeneratedPrompt: string | null;
  lastGeneratedPromptAt: string | null;     // ISO timestamp
  onboardingBannerDismissedAt: string | null;
}
```

### A-2. `onboarding-service.ts` exports (after Sprint A)

```ts
export async function markOnboardingCompleted(db: ExerciseLoggerDB): Promise<void>;
export async function markOnboardingSkipped(db: ExerciseLoggerDB): Promise<void>;
export async function saveGeneratedPrompt(db: ExerciseLoggerDB, prompt: string): Promise<void>;
export async function clearLastPrompt(db: ExerciseLoggerDB): Promise<void>;
export async function dismissOnboardingBanner(db: ExerciseLoggerDB): Promise<void>;
```

### A-3. `settings-service.ts` addition (after Sprint A)

```ts
export async function setUserName(db: ExerciseLoggerDB, name: string | null): Promise<void>;
// trims; truncates to 40 chars; null clears the field.
```

### A-4. `prompt-builder.ts` export (after Sprint A)

```ts
export function buildPrompt(answers: Answers): string;
// pure; throws on empty answers map.
```

### A-5. Answer types (after Sprint A)

```ts
export type StepId =
  | "goal" | "experience" | "restrictions"
  | "daysPerWeek" | "sessionLength" | "distinctDays"
  | "equipment" | "priorities" | "favoritesAvoid"
  | "supersets" | "cardio";

export type Answer =
  | { kind: "chip"; value: string }
  | { kind: "chip-multi"; values: string[] }
  | { kind: "text"; value: string }
  | { kind: "chip-with-other"; value: string; otherText?: string }
  | { kind: "favorites-avoid"; favorites: string; avoid: string };

export type Answers = Partial<Record<StepId, Answer>>;
```

### A-6. Reducer (after Sprint B)

```ts
export type WizardState = { stepIndex: number; answers: Answers };

export type WizardAction =
  | { type: "answer"; stepId: StepId; answer: Answer }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; to: number }
  | { type: "restart" };

export function questionnaireReducer(state: WizardState, action: WizardAction): WizardState;
export const initialWizardState: WizardState;
```

### A-7. sessionStorage helpers (after Sprint B)

```ts
export function saveWizardState(state: WizardState): void;     // silent on failure
export function loadWizardState(): WizardState | null;
export function clearWizardState(): void;
```

### A-8. Routes (after Sprint C + D)

| Route | Added in | Component |
|---|---|---|
| `/onboarding` | Sprint C | `OnboardingWelcomeScreen` |
| `/onboarding/questionnaire` | Sprint C | `QuestionnaireScreen` |
| `/onboarding/handoff` | Sprint D | `HandoffScreen` |

### A-9. `GPT_URL` constant (after Sprint A)

```ts
// web/src/shared/lib/gpt-url.ts
export const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";
```

Imported by: `RoutineImportScreen`, `HandoffScreen`, any other place that links to the GPT.

---

## 12. Appendix B — Known pitfalls & traps

- **Dexie compound-index null trap:** all 6 new Settings fields are unindexed, so this doesn't bite today. But future additions must remember the rule (`db/CLAUDE.md`).
- **`useLiveQuery` undefined vs null:** it returns `undefined` during initial load, then the record. Components already handle this with early-return `if (!settings) return null;` — follow suit for new fields.
- **React StrictMode double-mount in dev:** `initializeSettings` uses `put` (idempotent) for this reason. The onboarding-service functions are all `update`-based on an existing record, so they're safe under double-mount.
- **The base path `/exercise-logger/`:** BrowserRouter basename is set. All new routes use relative paths (`/onboarding`, not `/exercise-logger/onboarding`). React Router handles the basename.
- **Lazy route loading:** new screens must be lazy-loaded to keep the initial bundle lean (see App.tsx for pattern). Each new route: `const X = lazy(() => import("@/features/onboarding/X"));`.
- **Toast config:** `Toaster` is already mounted in `App.tsx:161` with sonner. Do not mount a second `<Toaster />`.
- **`ConfirmDialog` variants:** the shared `ConfirmDialog` currently supports 2-button confirm/cancel with optional destructive styling. Sprint D's 3-option dialog ("Start over / Continue / Cancel") either extends it or uses a Dialog primitive (`@/shared/ui/dialog`) inline. Prefer extending ConfirmDialog.
- **YAML library dynamic import:** `validateAndNormalizeRoutine` dynamic-imports the `yaml` library to keep it out of the main chunk (`services/CLAUDE.md`). HandoffScreen's Stage 2 path triggers this import on first use — expect a small async delay on the first "Import routine" tap. Test accordingly.
- **GPT instructions drift:** the app prompt and the GPT system prompt must stay in lockstep. Prompt-builder carries a comment pointing to the GPT instructions file. Any change to the prompt's lead-in text or the 11-topic list requires updates in both places.
- **`onboardingBannerDismissedAt` reset:** this happens INSIDE `saveGeneratedPrompt` (Sprint A). Don't add a second reset in HandoffScreen.
- **sessionStorage in iframes:** we don't ship inside iframes, so no worry. But private-browsing on iOS throws on `sessionStorage.setItem`. The utility must catch silently.
- **Android file-download flow:** pre-existing known bug in `gpt_yaml_integration.md` memory. This feature SIDESTEPS the file flow by using paste — don't try to fix the file flow here.
- **Pre-seeded starter routine:** runs on first launch regardless of onboarding state. Spec §Rollout accepts this; don't special-case.

---

## 13. Appendix C — Filename conventions

Sprint plans land at:

```
docs/superpowers/plans/2026-04-22-onboarding-sprint-a-foundation.md
docs/superpowers/plans/2026-04-22-onboarding-sprint-b-mechanics.md
docs/superpowers/plans/2026-04-22-onboarding-sprint-c-content.md
docs/superpowers/plans/2026-04-22-onboarding-sprint-d-integration.md
docs/superpowers/plans/2026-04-22-onboarding-sprint-e-e2e-polish.md
```

The orchestration plan (this document) lives at:

```
docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md
```

All sprint plan prompts include an explicit write-to path so the `/writing-plans` skill doesn't need to guess. Operators should not rename these post-hoc.

---

## 14. Self-review notes

This orchestration plan was self-checked against the feature spec:

- **Decision coverage (D1–D12):** all 12 decisions map to at least one sprint. D1 → Sprint D (gate). D2 → Sprint D (Settings row). D3 → Sprint A (migration). D4 → implicit (no Dexie persistence for answers; Sprint B sessionStorage). D5 → Sprint A (schema) + Sprint D (persist on Stage 1). D6 → Sprint B + Sprint C (one step per screen). D7 → Sprint B (auto-advance in chips) + Sprint C (per-step wiring). D8 → Sprint D (HandoffScreen). D9 → Sprint D (banner). D10 → Sprint A (prompt-builder) + Sprint C (step UI). D11 → all sprints (tokens). D12 → Sprint B (util) + Sprint C (orchestrator binding).
- **Spec-section coverage:** Context → §1. Non-Goals → enforced by scope-out lists in each sprint. Architecture → Sprint A (schema) + Sprint C (module). Questionnaire UX → Sprint B (chrome) + Sprint C (steps). Prompt Generation → Sprint A (builder) + Sprint D (call site). Finale Screen State Machine → Sprint D. Today banner → Sprint D. Settings Integration → Sprint D. Error Handling → distributed (clipboard + guards in D, migration in A). Testing → A/B/C/D unit + E2E. Rollout → Sprint E. Risks → addressed in relevant sprint guidance (Risk 1 clipboard → Sprint D + E; Risk 2 sessionStorage quota → Sprint B; Risk 3 GPT URL → Sprint A).
- **Placeholder scan:** no `TODO`, no `TBD`, no `fill in later` in the document.
- **Type consistency:** `buildPrompt`, `Answers`, `WizardAction`, `questionnaireReducer`, `setUserName`, the 5 onboarding-service names, the 3 route paths, and the `GPT_URL` constant name are identical across §Sprint A interfaces, §Sprint B contract, and Appendix A.
- **Exit-criteria rigor:** every sprint has concrete, verifiable exit criteria (test count, specific behaviors, specific files).
- **No new runtime deps** is repeated at every sprint prompt so no planner forgets.

This plan is ready to drive `/writing-plans` for Sprint A.

---

## 15. Execution handoff

**Plan saved to** `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md`.

This is an orchestration plan. Execution happens by, for each sprint in order:

1. **Operator** invokes `/writing-plans` with the prompt from §A.1 / §B.1 / §C.1 / §D.1 / §E.1.
2. **Planner** produces the sprint implementation plan at the path shown in §Appendix C.
3. **Operator** reviews the sprint plan using the shared rubric in §4 + the sprint-specific §N.2 checklist.
4. **Operator** invokes `superpowers:subagent-driven-development` on the sprint plan.
5. **Reviewer** (user or delegated agent) checks the implementation using §4 + §N.4.
6. **Operator** runs the sprint's §N.5 polish.
7. **Operator** confirms §N.6 exit criteria and ticks §5 progress tracker.

**Start with Sprint A**: paste the §A.1 prompt into `/writing-plans`.

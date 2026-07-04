# Ownership Roadmap — 2026-07-04

**Context:** Owner delegated prioritization ("improve the app, you decide what's top priority").
Product goal: the best app for (a) creating a tailor-made routine via a conversation/form + LLM,
(b) following that routine and logging sets/reps/weights/times, (c) tracking progress.

**State as of today:** Nothing shipped since 2026-04-23 (#27). The five hardening sprints landed
(data rendering, backup validation, strict YAML, architecture cleanup). The two biggest gaps in
the product goal remain open.

## Priority order

### P0 — First-run activation + GPT handoff recovery *(this session)*
Execute `docs/superpowers/plans/2026-04-25-first-run-activation-v2.md` as written.
- Directly serves goal (a): the questionnaire → prompt → ChatGPT → YAML import loop becomes
  recoverable (prompt always visible, real anchor for the GPT link, copy decoupled from popup).
- Fixes the activation cliff: cold-install user reaches a logged set via the starter routine
  in ≤ 4 actions, no docs, no Settings detour.
- Plan is already validated line-by-line against current code; risk is low.

### P1 — Workout rhythm (rest timer + superset alternation)
Re-validate `docs/archive/plans/2026-04-25-sprint-2-workout-rhythm.md` against post-#27 code,
then execute. Serves goal (b): the active-workout screen is the most-used and least-supported
surface. `restSecSnapshot` fields exist and are unread; supersets render as a stacked card with
no A1→B1→A2→B2 affordance.

### P2 — Frictionless LLM import paths
The Android download-and-open YAML flow is broken (user memory, 2026-04). After P0's paste-first
handoff ships, evaluate: Web Share Target API, URL/deep-link import, PWA `file_handlers`.
Prefer paths that sidestep the filesystem entirely.

### P3 — History at scale
Filter chips (day letter), exercise search, wire the orphaned `/history/exercise/:exerciseId`
route from session-detail set pills. One spark-line per exercise, no dashboard.

## Parked — needs an owner decision, will not build unprompted

- **OpenAI-native routine builder** (`docs/openai-native-routine-builder-spec.md`, Codex, 2026-05-05).
  Requires a backend + API-key billing, which contradicts the standing constraint: no server-side
  LLM costs; users bring their own ChatGPT. If the owner ever reverses that constraint, this spec
  is the starting point. A middle path worth discussing: BYO-API-key stored locally.
- Everything on the permanently-deferred list (dark mode, timer sounds v1, social, dashboards,
  wearables) stays deferred per `docs/2026-04-25-claudedesign-uiux-report.md` §3.

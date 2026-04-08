# Exercise Logger

A local-first progressive web app for tracking gym workouts. Runs entirely in the browser with offline support -- no server, no account, no data leaves your device.

**[Live Demo](https://alvarocreixell.github.io/exercise-logger/)**

## What it does

- **Routine management** -- Import YAML-based workout routines with structured set blocks, rep ranges, supersets, and cardio options
- **Workout logging** -- Tap-to-log sets with weight/reps pre-filled from history and progression suggestions
- **Automatic progression** -- Per-block +5% weight suggestions when all sets hit the top of the rep range
- **Full history** -- Browse past sessions, drill into per-exercise history grouped by block
- **Offline-first** -- Service worker caches all assets; IndexedDB stores all data locally
- **Installable** -- Add to home screen on any device for a native app experience

## How this was built

Every line of code in this repository was written by AI coding agents -- [Claude Code](https://claude.ai/claude-code) and [Codex](https://openai.com/index/codex/) -- with human direction, review, and iteration at every step.

This wasn't "generate code and hope for the best." The development followed a structured, multi-pass workflow:

1. **Spec-first design** -- Product requirements written as a detailed spec, reviewed and iterated on before any code was generated
2. **Phased planning** -- A 7-phase master plan broken into granular implementation plans, each reviewed for correctness and cross-checked by a second LLM (Codex audited Claude's plans and vice versa)
3. **Deterministic harnesses** -- Every planned behavior required a passing test. 370+ unit/integration tests + Playwright E2E suite, all enforced in CI alongside lint, type-check, and build
4. **Skill-driven execution** -- Development used [Superpowers](https://github.com/anthropics/claude-code-plugins) plugin skills for structured brainstorming, plan writing, test-driven development, code review, verification gates, and branch completion workflows
5. **Adversarial review** -- Codex reviewed Claude's implementations for bugs, contract violations, and architectural drift; Claude reviewed Codex's findings for false positives
6. **Human-in-the-loop** -- I directed the architecture, wrote the initial spec, reviewed every plan, made product decisions, tested on my phone, and iterated based on real usage

The result is a codebase that reads like it was written by a disciplined team, not generated -- because the process enforced the same rigor a good team would.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript 5 |
| Build | Vite 7 |
| UI | shadcn/ui + Tailwind CSS 4 |
| Storage | Dexie.js 4 (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest + React Testing Library + Playwright |
| CI/CD | GitHub Actions &rarr; GitHub Pages |

## Architecture

```
Features (Screens + Components) --> Hooks --> Services --> Dexie (IndexedDB)
```

Each layer only calls the layer below. Services are pure functions taking `db` as first argument. UI state reads from Dexie reactively via `useLiveQuery`. Sessions snapshot all routine/exercise data at creation so history survives routine changes.

```
web/src/
  app/          # Entry point, routing, global styles
  domain/       # Types, enums, pure helpers (no React, no DB)
  db/           # Dexie database class, schema, initialization
  services/     # Business logic (session, set, progression, backup)
  shared/       # Cross-feature hooks, UI primitives, utilities
  features/     # Feature modules
    today/      #   Routine overview, day selection, start workout
    workout/    #   Active workout logging, exercise cards, set forms
    history/    #   Session history, session detail, exercise history
    settings/   #   Settings, routine import, backup/restore
  data/         # Embedded exercise catalog (CSV)
```

## Getting started

```bash
cd web
npm install
npm run dev         # Dev server at localhost:5173
```

### Other commands

```bash
npm test            # Unit + integration tests (Vitest)
npm run build       # Production build with PWA
npm run preview     # Preview production build at localhost:4173
npm run test:e2e    # Build + Playwright E2E tests
npm run lint        # ESLint
```

## Design docs

- [`docs/design-spec.md`](docs/design-spec.md) -- Original product specification
- [`docs/ui-rewrite-spec.md`](docs/ui-rewrite-spec.md) -- UI architecture and screen design
- [`CLAUDE.md`](CLAUDE.md) -- Detailed project guide (conventions, invariants, gotchas)

## Project stats

### Codebase

| Metric | Value |
|--------|-------|
| Total commits | 223 |
| Active dev days | 12 (across a 41-day calendar span) |
| Lines of source code | 8,027 (63 files) |
| Lines of test code | 9,277 (24 files) |
| Test-to-source ratio | **1.16x** -- more test code than application code |
| Tests | 377 unit/integration + Playwright E2E suite |
| Domain invariants | 11 formally enforced |

### Planning and review artifacts

| Artifact | Count |
|----------|-------|
| Spec iterations | 4 (greenfield &#8594; consolidated audit &#8594; v2 simplified &#8594; final spec) |
| Implementation plans written | 22 (across 4 plan generations) |
| Hardening passes | 3 (broken-and-dangerous, spec-fidelity, schema-and-quality) |
| Cross-model audits | 3 (Claude audit, Codex audit, consolidated report) |
| Errata items found and applied | 44 |
| UI rewrite plans | 3 + 1 design spec |
| UX review | 1 (35-screenshot walkthrough with findings from both models) |

### Commits by type

| Type | Count |
|------|-------|
| `feat:` | 111 |
| `fix:` | 66 |
| `docs:` | 18 |
| `chore:` | 7 |
| `refactor:` | 6 |
| `test:` | 5 |

### Notable

- **60 commits on a single day** (March 24) -- the most intense session, when the first implementation was hardened across 3 passes
- **The project was rewritten 3 times** before landing on the final architecture (spec dates: Mar 23, Mar 26, Mar 28)
- **29,000+ lines of planning docs** were produced during development -- more planning was written than code shipped
- **Test-to-source ratio > 1** is uncommon even in professional codebases

## License

[MIT](LICENSE)

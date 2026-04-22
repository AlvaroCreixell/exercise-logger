# Repo Cleanup for GitHub Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the repo for GitHub publication as a portfolio artifact — refresh the README, reconcile stale references, un-gitignore the docs archive with a curated index, rewrite the default Vite web/README, and add missing feature-level CLAUDE.md guides. No code changes.

**Architecture:** Pure docs/metadata work. Six atomic commits, one per concern. Each commit is reversible. No `web/src/` or `web/tests/` edits.

**Tech Stack:** Markdown. Git. `cp` for screenshot copy.

**Spec:** `docs/superpowers/specs/2026-04-21-repo-cleanup-design.md`

---

## File Structure

| File | Action | Owner |
|---|---|---|
| `.gitignore` | Modify — remove `docs/archive/` line | Task 1 |
| `docs/archive/**` | Add to index (~50 files, ~3.9 MB) | Task 1 |
| Old paths under `docs/superpowers/plans/`, `docs/claude_design_handoffs/`, etc. | Remove (already unstaged deletions) | Task 1 |
| `docs/archive/README.md` | Create — curated index | Task 2 |
| `docs/screenshots/today.jpg` | Create — copy from archive | Task 3 |
| `docs/screenshots/workout-active.jpg` | Create — copy from archive | Task 3 |
| `docs/screenshots/session-detail.jpg` | Create — copy from archive | Task 3 |
| `README.md` (root) | Rewrite — portfolio hero | Task 4 |
| `CLAUDE.md` (root) | Modify — fix stale refs | Task 5 |
| `web/src/features/today/CLAUDE.md` | Create — feature guide | Task 5 |
| `web/src/features/workout/CLAUDE.md` | Create — feature guide | Task 5 |
| `web/src/features/history/CLAUDE.md` | Create — feature guide | Task 5 |
| `web/src/features/settings/CLAUDE.md` | Create — feature guide | Task 5 |
| `web/src/db/CLAUDE.md`, `domain/CLAUDE.md`, `services/CLAUDE.md` | Audit — modify only if drifted | Task 5 |
| `web/README.md` | Rewrite — replace Vite template | Task 6 |

---

## Preconditions

Before starting, confirm the following hold (run these commands first):

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
git status --porcelain | wc -l  # expect ~39 (deletions) — archive not yet tracked
ls docs/archive/ | wc -l        # expect 5 (claude-design-handoffs, misc, plans, reviews, specs)
git log --oneline -1 | grep -q 'repo cleanup for GitHub publication' && echo "spec committed" || echo "MISSING SPEC COMMIT"
```

Expected: 39, 5, `spec committed`.

If any fails, stop and investigate.

---

## Task 1: Un-gitignore docs/archive and commit in one atomic change

**Files:**
- Modify: `.gitignore:33` (remove `docs/archive/` line)
- Stage: all `docs/archive/**` (~50 files)
- Stage: 39 pending deletions from old paths

- [ ] **Step 1: Edit `.gitignore` to stop ignoring the archive**

Open `.gitignore`. It currently ends with:

```gitignore
# Local doc archive (historical plans/specs/reviews)
docs/archive/
```

Change to (delete both lines — the comment and the pattern):

```gitignore
# (docs/archive/ is tracked — historical plans, specs, reviews, handoffs)
```

- [ ] **Step 2: Verify the archive is now visible to git**

Run:
```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
git status --porcelain docs/archive/ | head -5
```

Expected: lines starting with `??` for archive files (now untracked, not ignored).

If you see zero lines, the gitignore edit didn't take — re-check the file.

- [ ] **Step 3: Stage the gitignore + archive + deletions**

Run these in order:

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
git add .gitignore
git add docs/archive/
git add -u docs/  # stages all deletions under docs/
```

- [ ] **Step 4: Sanity-check the staged diff before commit**

Run:
```bash
git status --porcelain | awk '{print $1}' | sort | uniq -c
```

Expected counts (roughly):
- `A ` (added): ~50 (archive tree)
- `D ` (deleted): ~39 (old paths)
- `M ` (modified): 1 (.gitignore)

Total changes ~90. If you see anything outside these prefixes (e.g., `??` or `M ` for source files), unstage the unexpected paths — only docs + gitignore should be in this commit.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(gitignore): track docs/archive so development history is visible

The archive contains all implementation plans, design specs, cross-model code
reviews, and Claude design handoffs that produced this codebase. Un-ignoring
it turns the archive into part of the story we're telling in the repo.

Also commits the deletions from the old paths (docs/superpowers/plans/,
docs/claude_design_handoffs/, etc.) — those files now live under docs/archive/
as their single source of truth."
```

- [ ] **Step 6: Verify clean tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. If anything remains, investigate — do not proceed.

---

## Task 2: Write the curated `docs/archive/README.md` index

**Files:**
- Create: `docs/archive/README.md`

- [ ] **Step 1: Create `docs/archive/README.md` with the following content**

```markdown
# Archive — Development History

This directory contains every planning artifact, design spec, code review, and
design handoff that produced the Exercise Logger codebase. It's preserved so
the "How this was built" narrative in the root README is verifiable, not just
claimed.

Nothing here is a dependency of the running app — it's a read-only record.

## Start here (5-minute tour for recruiters)

Four files, in this order, show the full development discipline in practice:

1. [`specs/2026-03-23-exercise-logger-greenfield-design.md`](specs/2026-03-23-exercise-logger-greenfield-design.md) — the original greenfield design that kicked off the project.
2. [`plans/2026-03-28-master-plan.md`](plans/2026-03-28-master-plan.md) — the 7-phase master plan that drove the final rewrite.
3. [`plans/2026-03-24-hardening-pass2-spec-fidelity.md`](plans/2026-03-24-hardening-pass2-spec-fidelity.md) — a hardening pass catching the spec/code drift that surfaced during the first implementation.
4. [`reviews/codebase-review-2026-04-17.md`](reviews/codebase-review-2026-04-17.md) — a full codebase review produced by running the review skill against the shipped code.

## Design specs (`specs/`)

Chronological. Each is a standalone design document produced before the
matching implementation plan.

- `2026-03-23-exercise-logger-greenfield-design.md` — first full design (greenfield scope).
- `2026-03-24-consolidated-audit-report.md` — cross-model audit of the v1 design, feeding the rewrite.
- `2026-03-26-exercise-logger-v2-simplified.md` — simplified v2 design after audit.
- `2026-03-28-gym-routine-tracker-design.md` — final design that drove the shipped code.
- `2026-04-06-ui-rewrite-design.md` — design for the UI rewrite that produced the current screens.
- `2026-04-08-per-exercise-units-design.md` — per-exercise unit override design.
- `2026-04-09-visual-makeover-design.md` — first pass at the visual design language.
- `2026-04-16-visual-polish-design.md` — second pass refining the visual language.
- `2026-04-19-visual-revamp-chunking-design.md` — chunking strategy for the final visual revamp.
- `current-design-spec.md`, `current-ui-rewrite-spec.md`, `ui-rewrite-spec.md` — snapshots of the spec at key points in the project lifecycle.

## Implementation plans (`plans/`)

Chronological. Each was written against a design spec and executed task-by-task.
48 plans total, grouped by phase:

**Foundation (March)**
- `2026-03-23-phase1-foundation-data-layer.md` — v1 Phase 1.
- `2026-03-24-phase2-sessions-and-features.md` — v1 Phase 2.
- `2026-03-24-phase3a-app-shell-and-navigation.md` — v1 Phase 3a.
- `2026-03-24-phase3b-workout-screen.md` — v1 Phase 3b.
- `2026-03-24-phase3c-remaining-screens.md` — v1 Phase 3c.
- `2026-03-24-hardening-pass1-broken-and-dangerous.md` — hardening pass 1 (invariants + safety).
- `2026-03-24-hardening-pass2-spec-fidelity.md` — hardening pass 2 (spec compliance).
- `2026-03-24-hardening-pass3-schema-and-quality.md` — hardening pass 3 (schema + code quality).

**V2 rewrite (late March)**
- `2026-03-26-v2-phase1-data-foundation.md` through `2026-03-26-v2-phase4-packaging.md` — v2 rewrite plans.
- `2026-03-28-master-plan.md` — final master plan replacing both prior attempts.
- `2026-03-28-phase1-scaffolding.md` through `2026-03-28-phase7-backup-polish.md` — final 7-phase execution.

**Audits (late March)**
- `2026-03-30-plan-audit-CLAUDE.md` — Claude auditing the plans.
- `2026-03-30-plan-audit-CODEX.md` — Codex auditing the same plans.
- `2026-03-30-plan-errata.md` — 44 errata items applied from both audits.

**UI rewrite (April)**
- `2026-04-06-ui-deletion-restructure.md` — planned deletion of the v1 UI.
- `2026-04-06-ui-rewrite-foundation.md` — new UI foundation.
- `2026-04-06-ui-rewrite-screens.md` — screen-by-screen rewrite.

**Features and polish (April)**
- `2026-04-08-per-exercise-units-plan.md` — per-exercise unit override.
- `2026-04-09-visual-makeover-plan.md` — first visual pass.
- `2026-04-16-bug-bash-rendering-and-validation.md` — rendering + validation bug bash.
- `2026-04-16-clipboard-paste-yaml-import.md` — YAML paste flow.
- `2026-04-16-in-session-weight-carryover.md` — weight carryover.
- `2026-04-16-invariant-hardening.md` — invariant hardening.
- `2026-04-16-visual-polish.md` — visual polish.
- `2026-04-17-pwa-polish.md` — PWA polish.
- `2026-04-17-sprint4-workout-shine.md` — workout UX shine.
- `2026-04-17-sprint5-open-doors.md` — sprint 5.
- `2026-04-19-sprint6-foundation.md` through `2026-04-21-sprint13-last-mile.md` — final sprints.

## Code reviews (`reviews/`)

- `codebase-review-2026-04-16.md` — full codebase review, mid-rewrite.
- `codebase-review-2026-04-17.md` — full codebase review after sprint 5.
- `test-suite-review-2026-04-08.md` — dedicated review of the test suite.

## Design handoffs (`claude-design-handoffs/`)

Visual design artifacts produced during UI iterations. Each handoff is a
self-contained bundle with Claude-generated mockups, component stubs, and
screenshots.

- `2026-04-19/` — first visual handoff: mockups + component stubs for the warm-paper design language.
- `2026-04-21/` — final handoff: six screenshots of the shipped app + design notes.

## Misc (`misc/`)

- `PLANS.md` — early outline of all planned work before it was broken into individual plans.
- `notes.md` — scratch notes kept during development.
```

- [ ] **Step 2: Verify the file renders as valid markdown**

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
head -5 docs/archive/README.md
```

Expected: `# Archive — Development History` as line 1.

- [ ] **Step 3: Commit**

```bash
git add docs/archive/README.md
git commit -m "docs(archive): add curated index README

Hand-holds a recruiter through the archive with a '5-minute tour' section
highlighting the four strongest artifacts (greenfield design, master plan,
hardening pass, codebase review), plus chronological catalogs of all specs,
plans, reviews, and handoffs."
```

---

## Task 3: Copy 3 screenshots into `docs/screenshots/` for the README hero row

**Files:**
- Create: `docs/screenshots/today.jpg`
- Create: `docs/screenshots/workout-active.jpg`
- Create: `docs/screenshots/session-detail.jpg`

- [ ] **Step 1: Create `docs/screenshots/` directory and copy files**

Run:

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
mkdir -p docs/screenshots
cp "docs/archive/claude-design-handoffs/2026-04-21/screenshots/1-today.jpg" "docs/screenshots/today.jpg"
cp "docs/archive/claude-design-handoffs/2026-04-21/screenshots/5-workout-active.jpg" "docs/screenshots/workout-active.jpg"
cp "docs/archive/claude-design-handoffs/2026-04-21/screenshots/6-session-detail.jpg" "docs/screenshots/session-detail.jpg"
```

- [ ] **Step 2: Verify the three files exist**

```bash
ls -la docs/screenshots/
```

Expected: three files (`today.jpg`, `workout-active.jpg`, `session-detail.jpg`), each non-zero bytes.

- [ ] **Step 3: Commit**

```bash
git add docs/screenshots/
git commit -m "docs(screenshots): import 3 screenshots for README hero row

Copies today / workout-active / session-detail from the archive into a
stable docs/screenshots/ path so the README can reference them without
being coupled to any future archive reorg."
```

---

## Task 4: Rewrite root `README.md` as the portfolio hero

**Files:**
- Rewrite: `README.md`

- [ ] **Step 1: Verify current stats match what the plan will commit**

Run these and note the values — if they drift, update the README before committing:

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
git log --oneline | wc -l                     # expect 341 (340 + the spec commit)
find web/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs wc -l | tail -1   # expect 10587
find web/src -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v ".test." | wc -l  # expect 120
find web -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.e2e.ts" \) | grep -v node_modules | xargs wc -l | tail -1  # expect 15034
find web -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.e2e.ts" \) | grep -v node_modules | wc -l                # expect 69
cd web && npm test 2>&1 | grep -oP 'Tests\s+\d+ passed' | head -1; cd ..  # expect "Tests  742 passed"
```

Expected snapshot (update README prose/stats if any differ from these):
- 341 commits (340 + spec)
- 10,587 LOC source / 120 files
- 15,034 LOC test / 69 files
- 742 tests passing

- [ ] **Step 2: Replace `README.md` with the new content**

Overwrite `README.md` with exactly this content:

```markdown
# Exercise Logger

A local-first progressive web app for tracking gym workouts. Runs entirely in the browser with offline support — no server, no account, no data leaves your device.

**[Live Demo](https://alvarocreixell.github.io/exercise-logger/)** · MIT licensed

## Screenshots

<p align="center">
  <img src="docs/screenshots/today.jpg" alt="Today screen — current day, streak, and start-workout CTA" width="30%" />
  <img src="docs/screenshots/workout-active.jpg" alt="Active workout — set logging with the custom keypad sheet" width="30%" />
  <img src="docs/screenshots/session-detail.jpg" alt="Session detail — per-exercise set pills and stats" width="30%" />
</p>

## What it does

- **Routine management** — Import YAML-based workout routines with structured set blocks, rep ranges, supersets, and cardio options.
- **Workout logging** — Tap-to-log sets with weight/reps pre-filled from history and progression suggestions.
- **Automatic progression** — Per-block +5% weight suggestions when all sets hit the top of the rep range.
- **Full history** — Browse past sessions, drill into per-exercise history grouped by block.
- **Offline-first** — Service worker caches all assets; IndexedDB stores all data locally.
- **Installable** — Add to home screen on any device for a native app experience.

## How this was built

Every line of code in this repository was written by AI coding agents — [Claude Code](https://claude.ai/claude-code) and [Codex](https://openai.com/index/codex/) — with human direction, review, and iteration at every step.

This wasn't "generate code and hope for the best." The development followed a structured, multi-pass workflow:

1. **Spec-first design.** Product requirements written as a detailed design document, reviewed and iterated on before any code was generated. Four spec iterations are preserved under [`docs/archive/specs/`](docs/archive/specs/).
2. **Phased planning.** A 7-phase master plan broken into 48 granular implementation plans, each reviewed for correctness and cross-checked by a second model (Codex audited Claude's plans and vice versa). All plans preserved under [`docs/archive/plans/`](docs/archive/plans/).
3. **Deterministic harnesses.** Every planned behavior required a passing test. 742 unit/integration tests + a Playwright E2E suite, all enforced in CI alongside lint, type-check, and build.
4. **Skill-driven execution.** Development used [Superpowers](https://github.com/anthropics/claude-code-plugins) plugin skills for structured brainstorming, plan writing, test-driven development, code review, verification gates, and branch completion workflows.
5. **Adversarial review.** Codex reviewed Claude's implementations for bugs, contract violations, and architectural drift; Claude reviewed Codex's findings for false positives. Review artifacts preserved under [`docs/archive/reviews/`](docs/archive/reviews/).
6. **Human-in-the-loop.** I wrote the original spec, directed the architecture, reviewed every plan, made product decisions, tested on my phone, and iterated based on real usage.

The result is a codebase that reads like a disciplined team produced it — because the process enforced the same rigor a good team would.

Start with [`docs/archive/README.md`](docs/archive/README.md) for a curated 5-minute tour of the artifacts.

## Codebase stats

### Code

| Metric               | Value                                       |
|----------------------|---------------------------------------------|
| Total commits        | 340                                         |
| Active dev days      | 18 across a 55-day calendar span            |
| Source code          | 10,587 lines across 120 files               |
| Test code            | 15,034 lines across 69 files                |
| Test-to-source ratio | **1.42×** — more test code than application code |
| Test suite           | 742 unit/integration + Playwright E2E       |
| Domain invariants    | 12 formally enforced in services            |

### Planning and review artifacts

| Artifact                     | Count |
|------------------------------|-------|
| Design specs                 | 12    |
| Implementation plans         | 48    |
| Hardening passes             | 3 (broken-and-dangerous, spec-fidelity, schema-and-quality) |
| Cross-model audits           | 3 (Claude audit, Codex audit, consolidated report) |
| Errata items applied         | 44    |
| Codebase reviews             | 3     |
| UI design handoffs           | 2     |

### Commits by type

| Type        | Count |
|-------------|-------|
| `feat:`     | 158   |
| `fix:`      | 87    |
| `docs:`     | 33    |
| `chore:`    | 15    |
| `test:`     | 13    |
| `refactor:` | 12    |
| `spec:`     | 5     |
| other       | ~17   |

### Notable

- **Test-to-source ratio > 1** is uncommon even in professional codebases — every behavior is backed by a deterministic test.
- **The project was rewritten twice** before landing on the final architecture (spec dates: Mar 23, Mar 26, Mar 28).
- The full development record — plans, specs, reviews, handoffs — is preserved under [`docs/archive/`](docs/archive/).

## Tech stack

| Layer      | Choice                                            |
|------------|---------------------------------------------------|
| Framework  | React 19 + TypeScript 5                           |
| Build      | Vite 7                                            |
| UI         | shadcn/ui + Tailwind CSS 4                        |
| Storage    | Dexie.js 4 (IndexedDB)                            |
| PWA        | vite-plugin-pwa (Workbox)                         |
| Testing    | Vitest + React Testing Library + Playwright       |
| CI/CD      | GitHub Actions → GitHub Pages                     |

## Architecture

```
Features (Screens + Components) → Hooks → Services → Dexie (IndexedDB)
```

Each layer only calls the layer below. Services are pure functions taking `db` as the first argument. UI state reads from Dexie reactively via `useLiveQuery`. Sessions snapshot all routine/exercise data at creation so history survives routine changes.

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

Full conventions, invariants, and gotchas are documented in [`CLAUDE.md`](CLAUDE.md) with layer-specific guides under `web/src/*/CLAUDE.md`.

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

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — Project guide: conventions, invariants, gotchas.
- [`docs/design-spec.md`](docs/design-spec.md) — Product specification.
- [`docs/archive/README.md`](docs/archive/README.md) — Curated tour of the development history (plans, specs, reviews, handoffs).
- [`docs/custom-gpt/`](docs/custom-gpt/) — Custom ChatGPT routine-maker docs.

## License

[MIT](LICENSE)
```

- [ ] **Step 3: Sanity check — verify the three screenshot paths resolve**

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
for f in docs/screenshots/today.jpg docs/screenshots/workout-active.jpg docs/screenshots/session-detail.jpg; do
  [[ -f "$f" ]] && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: three `OK:` lines. If any `MISSING:`, re-run Task 3.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): portfolio rewrite with refreshed stats and screenshots

- Add hero screenshot row (today / workout-active / session-detail).
- Refresh all numeric stats: 340 commits, 742 tests, 10.6k source LOC,
  15.0k test LOC, 1.42x test-to-source ratio, 18 dev days over 55 days.
- Update planning-artifact counts: 12 specs, 48 plans, 3 reviews, 2 handoffs.
- Link 'How this was built' claims to concrete exhibits in docs/archive/.
- Add Documentation section pointing at archive index and custom-gpt docs."
```

---

## Task 5: Reconcile CLAUDE.md files — fix root, audit subs, add feature guides

**Files:**
- Modify: `CLAUDE.md` (root)
- Audit (modify only if drifted): `web/src/db/CLAUDE.md`, `web/src/domain/CLAUDE.md`, `web/src/services/CLAUDE.md`
- Create: `web/src/features/today/CLAUDE.md`
- Create: `web/src/features/workout/CLAUDE.md`
- Create: `web/src/features/history/CLAUDE.md`
- Create: `web/src/features/settings/CLAUDE.md`

- [ ] **Step 1: Fix the stale `ui-rewrite-spec.md` reference in root `CLAUDE.md`**

Open `CLAUDE.md`. Find this block near the top:

```markdown
**Spec:** `docs/design-spec.md`
**UI Spec:** `docs/ui-rewrite-spec.md`
```

Replace with:

```markdown
**Spec:** `docs/design-spec.md`
**Development archive:** `docs/archive/README.md` (all plans, design specs, reviews, handoffs)
```

Rationale: `docs/ui-rewrite-spec.md` was moved to the archive; the broken path needs to go.

- [ ] **Step 2: Verify the test count in root `CLAUDE.md` still matches**

The `Commands` section lists `npm test` with a comment `# 742 unit+integration tests (Vitest)`. Confirm 742 is still accurate:

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger/web"
npm test 2>&1 | grep -oP 'Tests\s+\d+ passed' | head -1
cd ..
```

Expected: `Tests  742 passed`. If the count has drifted, update the comment in `CLAUDE.md:39` to match. If it matches, no change.

- [ ] **Step 3: Audit `web/src/db/CLAUDE.md` against the current code**

Read both files:

```bash
cat "C:/Users/creix/VSC Projects/exercise_logger/web/src/db/CLAUDE.md"
cat "C:/Users/creix/VSC Projects/exercise_logger/web/src/db/database.ts"
```

Check:
- Schema strings in the guide match the Dexie `version(N).stores({...})` calls in `database.ts`.
- Exported names (`ExerciseLoggerDB`, `db`, `DEFAULT_SETTINGS`, `initializeSettings`) all exist in `database.ts`.

**Expected outcome:** no changes needed. If anything is drifted, update the guide to match the code. Do not rewrite.

- [ ] **Step 4: Audit `web/src/domain/CLAUDE.md` against the current code**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/src/domain/"
```

Every `.ts` file mentioned in the guide should exist. Every function/type documented should be exported from its file (spot-check 2-3).

**Expected outcome:** no changes needed.

- [ ] **Step 5: Audit `web/src/services/CLAUDE.md` against the current code**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/src/services/"
```

Spot-check: every service documented (session, set, progression, settings, backup, catalog, routine) has a matching `*-service.ts` file. Function signatures in the guide match the actual exports (spot-check `startSessionWithCatalog`, `logSet`, `calculateBlockSuggestion`).

**Expected outcome:** no changes needed.

- [ ] **Step 6: Create `web/src/features/today/CLAUDE.md`**

Create the file with this content:

```markdown
# Today Feature

The default route (`/`). Shows the active routine's current day, a "Start workout" CTA, a day picker, the last session card, and a training streak pill.

## Screens

- `TodayScreen.tsx` — Main layout. Composes the hero card, day selector, last session card, and streak pill. If there's an active session, redirects to `/workout` (honoring invariant 2: resume takes priority over start).

## Components

- `TodayHeroCard.tsx` — The large "today" card with day label, muscle groups, set count, and start button.
- `DaySelector.tsx` — Lets the user pick a non-default day without advancing rotation.
- `LastSessionCard.tsx` — Summary of the most recent finished session.
- `StreakPill.tsx` — Training cadence badge (e.g., "3-day streak").

## Local utilities (`lib/`)

- `formatDate.ts` — `formatTodayEyebrow()` for the "FRIDAY · APRIL 21" eyebrow.
- `muscleGroups.ts` — `deriveDayMuscleGroups()` aggregates muscle groups from a `RoutineDay`'s exercises.

## Hooks used

`useSettings`, `useRoutine`, `useActiveSession`, `useLastSession`, `useTrainingCadence` — all from `@/shared/hooks/`.

## Services called

- `startSessionWithCatalog(db, routine, dayId)` from `@/services/session-service` — creates a new session on the "Start workout" tap. Does not advance rotation (rotation advances on finish, per invariant 3).

## Key UI invariants

- **Start is idempotent vs resume.** If an active session exists, never show "Start" — always redirect to `/workout`. Enforced by reading `useActiveSession` before rendering the hero CTA.
- **Day selector does not mutate routine state.** Picking a different day only changes the screen's "selected day" state; it does not advance `nextDayId` or write to the DB.
```

- [ ] **Step 7: Create `web/src/features/workout/CLAUDE.md`**

```markdown
# Workout Feature

The active workout screen (`/workout`). Only accessible when a session is in progress. Handles set logging, superset grouping, PR marking, adding extra exercises, and finishing or discarding the session.

## Screens

- `WorkoutScreen.tsx` — Main layout and state machine for set-logging. Orchestrates the SetLogSheet, ExercisePicker, FinishCelebration, and ConfirmDialog (for discard).

## Components

- `SessionHeader.tsx` — Top bar with day label and elapsed time.
- `SessionProgress.tsx` — Progress indicator across exercises.
- `ExerciseCard.tsx` — One exercise with its set blocks and set rows.
- `SupersetGroup.tsx` — Paired exercise layout for `kind: "superset"` entries.
- `SetRow.tsx` — One set row with weight/reps display and tap-to-edit.
- `SetDots.tsx` — Visual indicator of set completion state within a block.
- `SetLogSheet.tsx` — Bottom sheet for logging/editing a set. Uses `Keypad` + `ValueBox`.
- `Keypad.tsx` — Custom numeric keypad (digits, decimal, backspace, ± nudge). Reducer-driven.
- `ValueBox.tsx` — The active weight/reps field the keypad targets.
- `PrToggle.tsx` — Toggle for marking a set as a personal record.
- `ExercisePicker.tsx` — Sheet for picking an extra exercise to add mid-session.
- `WorkoutFooter.tsx` — Sticky footer with "+ Exercise", "Finish", "Discard".
- `FinishCelebration.tsx` — Celebration overlay shown briefly before navigating to the session detail.

## Local utilities (`lib/`)

- `formatSetTarget.ts` — Renders a `SetBlock`'s target as a human string (`"8–12 reps"`, `"30 sec"`, etc.).
- `keypad-reducer.ts` — Reducer for `Keypad` state (active field, digit buffer, nudge behavior).

Top-level: `set-log-validation.ts` — guards against invalid set input before hitting `logSet`.

## Hooks used

`useActiveSession`, `useSettings`, `useExerciseHistory`, `useExtraHistory` — from `@/shared/hooks/`.

## Services called

- `logSet`, `editSet`, `deleteSet` — `@/services/set-service`.
- `addExtraExercise`, `finishSession`, `discardSession` — `@/services/session-service`.
- `setUnitOverride` — `@/services/settings-service`.
- `getEffectiveUnit` — `@/domain/unit-helpers`.

## Key UI invariants

- **Set logging upserts by `[sessionExerciseId, blockIndex, setIndex]`** (invariant 9). The sheet passes these three identifiers; never a `loggedSetId` on create.
- **Extra exercises never see progression suggestions** (invariant 7). The sheet skips the "last time" and "suggested" rows when `sessionExercise.origin === "extra"`.
- **Weighted bodyweight promotion runs only on active sessions** (set-service contract). Editing a finished-session set never mutates `effectiveType`.
- **Discard does not advance rotation** (invariant 4). `finishSession` is the only path that advances `nextDayId`.
```

- [ ] **Step 8: Create `web/src/features/history/CLAUDE.md`**

```markdown
# History Feature

Browse past sessions and drill down into set-level detail. Routes:
- `/history` — list of finished sessions grouped by month.
- `/history/sessions/:sessionId` — one session's full detail.
- `/history/exercises/:exerciseId` — one exercise's history across all sessions, grouped by set block.

## Screens

- `HistoryScreen.tsx` — Monthly-grouped list of finished sessions with a stats tile on top.
- `SessionDetailScreen.tsx` — One session: header, stats tile, per-exercise cards with set pills.
- `ExerciseHistoryScreen.tsx` — One exercise across sessions, set-block grouped.

## Components

- `SessionRow.tsx` — List row for a finished session (date chip, title, meta, chevron).
- `HistoryStatsTile.tsx` — Aggregate stats (sessions / sets / hours).
- `SessionDetailHeader.tsx` — Back button, eyebrow, serif title.
- `SessionDetailStatsTile.tsx` — Per-session stats (sets / volume / time).
- `SessionDetailExerciseCard.tsx` — Exercise card with tap-to-edit set pills.

## Local utilities (`lib/`)

- `groupByMonth.ts` — `groupSessionsByMonth()` with local-time boundaries.
- `sessionStats.ts` — Aggregations: `computeSessionVolumeKg`, per-session set counts. Also used by the Workout feature's finish celebration.

## Hooks used

`useFinishedSessionSummaries`, `useHistoryStats`, `useSessionDetail`, `useExerciseHistoryGroups`, `useSettings` — from `@/shared/hooks/`.

## Services called

- `editSet`, `deleteSet` — `@/services/set-service` — used when tapping a set pill on a finished session.

## Key UI invariants

- **Finished sessions survive routine deletion** (invariant 5). All renderers read snapshot fields from `Session` and `SessionExercise`, never joining back to the live `Routine`.
- **Editing a finished session doesn't run bodyweight promotion** (set-service contract). The pill editor uses `editSet`, which is snapshot-safe on finished sessions.
- **Fractional weights preserved.** Display formatting uses `toDisplayWeight` which does not round to equipment increments (per key convention).
```

- [ ] **Step 9: Create `web/src/features/settings/CLAUDE.md`**

```markdown
# Settings Feature

Settings screen (`/settings`) and routine import screen (`/settings/import`). Handles units toggle, active routine management, routine import (YAML paste or file), backup export/import, clear-all-data, and the PWA install prompt.

## Screens

- `SettingsScreen.tsx` — Main settings list. Composes ActiveRoutineCard, RoutineList, UnitsToggle, backup/restore rows, AboutCard, install prompt.
- `RoutineImportScreen.tsx` — Import flow. Accepts YAML via paste textarea or file picker, validates, and imports-and-activates in one transaction.

## Components

- `ActiveRoutineCard.tsx` — Highlighted card for the currently active routine.
- `RoutineList.tsx` — List of non-active routines with activate/delete affordances.
- `AboutCard.tsx` — App info, GPT link, install prompt.
- `RowLink.tsx` — Settings row as a link.
- `SettingRow.tsx` — Generic settings row (label + action).
- `UnitsToggle.tsx` — Global kg/lbs toggle.
- `YamlErrorList.tsx` — Error list rendered in the import screen.

## Local utilities (`lib/`)

- `formatErrorPath.ts` — Formats `ValidationError.path` into a human-readable breadcrumb.

## Hooks used

`useSettings`, `useAllRoutines`, `useRoutine`, `useActiveSession`, `useInstallPrompt` — from `@/shared/hooks/`.

## Services called

- `setUnits`, `deleteRoutine` — `@/services/settings-service`.
- `validateAndNormalizeRoutine`, `importAndActivateRoutine` — `@/services/routine-service`.
- `exportBackup`, `downloadBackupFile`, `importBackup`, `readJsonFile`, `validateBackupPayload`, `clearAllData` — `@/services/backup-service`.

## Key UI invariants

- **Activation and deletion are blocked during an active session** (invariant 10). The UI disables these rows and shows an inline message when `useActiveSession()` is non-null.
- **Backup import is transactional.** `importBackup` runs inside a single Dexie transaction (invariant 11). The UI surfaces validation errors from `validateBackupPayload` *before* calling import.
- **Clear-all-data is blocked during an active session** and requires an explicit confirm dialog.
- **YAML import and activation is a single transaction** (`importAndActivateRoutine`). The UI treats it as atomic — either both succeed or both fail.
```

- [ ] **Step 10: Verify all 4 new files exist and are non-empty**

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
for f in web/src/features/today/CLAUDE.md web/src/features/workout/CLAUDE.md web/src/features/history/CLAUDE.md web/src/features/settings/CLAUDE.md; do
  [[ -s "$f" ]] && echo "OK: $f ($(wc -l < "$f") lines)" || echo "MISSING OR EMPTY: $f"
done
```

Expected: four `OK:` lines, each with 20+ lines. If any missing, re-run the creation step.

- [ ] **Step 11: Commit all CLAUDE.md changes as one**

```bash
git add CLAUDE.md web/src/features/today/CLAUDE.md web/src/features/workout/CLAUDE.md web/src/features/history/CLAUDE.md web/src/features/settings/CLAUDE.md
# Also stage any sub-CLAUDE edits you made during audit (steps 3-5); if none, the next line is a no-op:
git add web/src/db/CLAUDE.md web/src/domain/CLAUDE.md web/src/services/CLAUDE.md 2>/dev/null
git commit -m "docs(claude): fix stale refs and add feature-level guides

- Root CLAUDE.md: drop broken ui-rewrite-spec.md reference, point at
  docs/archive/README.md instead.
- Add per-feature CLAUDE.md guides for today/, workout/, history/,
  settings/ — same layered style as db/, domain/, services/.
- Audit pass on db/, domain/, services/ guides against current code."
```

---

## Task 6: Rewrite `web/README.md`

**Files:**
- Rewrite: `web/README.md`

- [ ] **Step 1: Replace `web/README.md` content**

Overwrite `web/README.md` with exactly:

```markdown
# Exercise Logger — Web App

The React + Vite PWA. See the [root README](../README.md) for project overview, architecture, and "how this was built" context.

## Quickstart

```bash
npm install
npm run dev         # Dev server at http://localhost:5173
```

## Commands

| Command             | What it does                                         |
|---------------------|------------------------------------------------------|
| `npm test`          | Unit + integration tests (Vitest, 742 tests)         |
| `npm run test:watch`| Vitest in watch mode                                 |
| `npm run build`     | Production build + PWA service worker                |
| `npm run preview`   | Preview the production build at http://localhost:4173 |
| `npm run test:e2e`  | Build + Playwright E2E (Pixel 7 Chromium on port 4173) |
| `npm run lint`      | ESLint                                               |
| `npm run typecheck` | `tsc -b` — TypeScript project references build       |

## Layout

| Path         | Responsibility                                  |
|--------------|--------------------------------------------------|
| `src/app/`   | Entry point, router, global styles               |
| `src/domain/`| Types, enums, pure helpers (no React, no DB)     |
| `src/db/`    | Dexie database class and schema                  |
| `src/services/` | Business logic (session, set, progression, backup, etc.) |
| `src/shared/`| Cross-feature hooks, UI primitives, utilities    |
| `src/features/` | Feature modules (today, workout, history, settings) |
| `src/data/`  | Embedded exercise catalog (CSV)                  |

## Conventions

See [`../CLAUDE.md`](../CLAUDE.md) for the full conventions, invariants, and gotchas list. Each layer directory also has its own `CLAUDE.md` guide.

## License

[MIT](../LICENSE)
```

- [ ] **Step 2: Verify the file is valid and doesn't reference the Vite template anymore**

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
head -3 web/README.md
grep -c 'Vite' web/README.md
grep -c 'Exercise Logger' web/README.md
```

Expected:
- Line 1: `# Exercise Logger — Web App`
- `Vite` count: 1 (only in "React + Vite PWA" intro line)
- `Exercise Logger` count: 2+

- [ ] **Step 3: Commit**

```bash
git add web/README.md
git commit -m "docs(web): replace default Vite README with real quickstart

- Removes the @vitejs/plugin-react/@vitejs/plugin-react-swc boilerplate.
- Adds actual quickstart (npm install, dev) and a command reference.
- Links to root README and CLAUDE.md for deeper context."
```

---

## Final verification

- [ ] **Step 1: Confirm clean tree and full commit chain**

```bash
cd "/c/Users/creix/VSC Projects/exercise_logger"
git status
git log --oneline -10
```

Expected:
- `nothing to commit, working tree clean`
- Last 7 commits (most recent first) should be:
  1. `docs(web): replace default Vite README with real quickstart`
  2. `docs(claude): fix stale refs and add feature-level guides`
  3. `docs(readme): portfolio rewrite with refreshed stats and screenshots`
  4. `docs(screenshots): import 3 screenshots for README hero row`
  5. `docs(archive): add curated index README`
  6. `chore(gitignore): track docs/archive so development history is visible`
  7. `docs(spec): repo cleanup for GitHub publication`

- [ ] **Step 2: Confirm tests still green**

```bash
cd web && npm test 2>&1 | tail -5; cd ..
```

Expected: `Tests  742 passed (742)` (or the current count if drifted — plan spec calls for a README adjustment only if it changed).

- [ ] **Step 3: Confirm key docs resolve**

```bash
for f in README.md CLAUDE.md docs/archive/README.md docs/screenshots/today.jpg docs/design-spec.md web/README.md web/src/features/today/CLAUDE.md web/src/features/workout/CLAUDE.md web/src/features/history/CLAUDE.md web/src/features/settings/CLAUDE.md; do
  [[ -e "$f" ]] && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: all `OK:`.

- [ ] **Step 4: Do NOT push or open a PR**

Stop here. Hand control back so the user can eyeball the diff and then decide on pushing.

---

## Rollback

If anything goes wrong mid-plan, each commit is reversible:

```bash
git reset --hard HEAD~N   # where N is the number of commits to undo
```

The spec commit (`docs(spec): repo cleanup for GitHub publication`) should always survive — it's the input, not the output.

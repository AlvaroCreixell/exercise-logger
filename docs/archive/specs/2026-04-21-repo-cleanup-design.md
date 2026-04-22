# 2026-04-21 — Repo Cleanup for GitHub Publication — Design

## Context & Intent

The project is deployed and functional at `alvarocreixell.github.io/exercise-logger/`.
The remaining work is editorial: refresh the README, reconcile stale refs, and organize
the docs so the GitHub repo reads as a portfolio artifact.

- **Audience:** technical recruiters / hiring managers evaluating engineering rigor.
- **Approach:** curated portfolio rewrite (not a minimal polish, not a full methodology essay).
- **Constraint:** no code changes — `web/src/`, `web/tests/`, config, and dependencies are untouched.

## Non-Goals

- No refactors, renames, or behavior changes anywhere under `web/src/` or `web/tests/`.
- No dependency, build, CI, or config changes.
- No git history rewrites or force-pushes.
- No new top-level `CONTRIBUTING.md`, `METHODOLOGY.md`, or `CODE_OF_CONDUCT.md` — these were option C and explicitly rejected.
- No changes to `LICENSE`.

## Deliverables

### 1. Un-gitignore `docs/archive/`

Edit `.gitignore` — remove the `docs/archive/` line. The ~3.9 MB of plans, specs, reviews,
handoffs, and misc notes become tracked. Acceptable for a portfolio repo.

Other gitignore entries stay (node_modules, dist, .claude, etc.).

### 2. `docs/archive/README.md` — curated index

New file, ~1 page. Structure:

- **Start here** — 4 curated links for a recruiter with 5 minutes:
  - `specs/2026-03-23-exercise-logger-greenfield-design.md` — original greenfield design
  - `plans/2026-03-28-master-plan.md` — master plan that drove the rewrite
  - `plans/2026-03-24-hardening-pass2-spec-fidelity.md` — example hardening pass
  - `reviews/codebase-review-2026-04-17.md` — cross-model code review
- **All plans** — chronological list of the 27 implementation plans (1-line summary each)
- **Design specs** — chronological list of 12 design specs (1-line summary each)
- **Code reviews** — 3 reviews with 1-line summaries
- **Design handoffs** — 2 handoff bundles (2026-04-19, 2026-04-21) explained
- **Misc** — `PLANS.md` and `notes.md`

### 3. Screenshots

Copy 3 of 6 screenshots from `docs/archive/claude-design-handoffs/2026-04-21/screenshots/`
to a new `docs/screenshots/` directory:

- `1-today.jpg` → `docs/screenshots/today.jpg`
- `5-workout-active.jpg` → `docs/screenshots/workout-active.jpg`
- `6-session-detail.jpg` → `docs/screenshots/session-detail.jpg`

Skip `2-workout.jpg` (redundant with active variant), `3-history.jpg` (list view, less punchy
than detail), `4-settings.jpg` (not a hero frame). Originals stay in the archive.

### 4. Root `README.md` — portfolio rewrite

New structure, ~150 lines:

```
# Exercise Logger
1-line tagline. [Live Demo] link.

## Screenshots
3-up row (today / workout-active / session-detail).

## What it does
Condensed bullet list from current README.

## How this was built
CENTERPIECE. Refined version of the current "How this was built" narrative —
tighter, with inline links to exhibits in docs/archive/ (the greenfield design,
one hardening pass, the cross-model audit, the codebase review).

## Codebase stats
Refreshed table. See "Stats to use" below.

## Tech stack
Existing table, unchanged (already accurate).

## Architecture
1 block diagram + brief prose + link to CLAUDE.md for details.

## Getting started
Short commands block (unchanged from current).

## Documentation
- docs/design-spec.md — product specification
- CLAUDE.md — project guide for contributors
- docs/archive/README.md — full development history (plans, specs, reviews)

## License
MIT
```

**Stats to use (verified 2026-04-21):**

| Metric | Value |
|---|---|
| Total commits | 340 |
| First commit | 2026-02-26 |
| Last commit | 2026-04-21 |
| Active dev days | 18 across a 55-day calendar span |
| Source code | 10,587 lines across 120 files |
| Test code | 15,034 lines across 69 files |
| Test-to-source ratio | 1.42x |
| Test count | 742 unit/integration (Vitest) + Playwright E2E |
| Domain invariants | 12 formally enforced |

Commits by type (`feat` 158, `fix` 87, `docs` 33, `chore` 15, `test` 13, `refactor` 12,
`spec` 5, `perf` 1, `ci` 1, `handoff` 1, remaining ~14 are `Sprint N:` messages).

Drop the "60 commits in a single day" factoid — outdated post-Sprint 13 and not the
strongest angle.

### 5. Root `CLAUDE.md`

- Remove or redirect the `docs/ui-rewrite-spec.md` reference — the file moved to
  `docs/archive/specs/ui-rewrite-spec.md`.
- Confirm test count (`742`) still matches `npm test` at commit time. Update if drifted.
- No structural changes; the file is accurate.

### 6. Sub-CLAUDE.md audit

- `web/src/db/CLAUDE.md`, `domain/CLAUDE.md`, `services/CLAUDE.md` — read-through against
  current code. Only edit if something contradicts reality. No rewrites.

### 7. New feature-level CLAUDE.md files

Add short guides (~30–60 lines each) to each feature module, matching the layered-guide
style used in `db/`, `domain/`, `services/`:

- `web/src/features/today/CLAUDE.md`
- `web/src/features/workout/CLAUDE.md`
- `web/src/features/history/CLAUDE.md`
- `web/src/features/settings/CLAUDE.md`

Each covers: purpose, key screens/components, hooks used, services called, UI-level
invariants or gotchas.

### 8. `web/README.md` — rewrite

Replace the default Vite/React template with ~20–30 lines:

- Title: "Exercise Logger — Web App"
- 1-line intro pointing up to the root README
- Dev quickstart (`npm install && npm run dev`)
- Other commands (test, build, preview, e2e, lint)
- Link to `../CLAUDE.md`

### 9. Commit strategy

Six commits, in order:

1. `chore(gitignore): un-ignore docs/archive so history is visible in the repo` — the
   `.gitignore` edit plus staging the newly-visible archive tree plus committing the 39
   pending deletions from old paths. Single atomic commit.
2. `docs(archive): add curated index README` — `docs/archive/README.md`.
3. `docs(screenshots): import 3 screenshots for README hero row` —
   `docs/screenshots/*.jpg`.
4. `docs(readme): portfolio rewrite with refreshed stats and screenshots` — root
   `README.md`.
5. `docs(claude): fix stale refs, add feature-level guides` — root `CLAUDE.md` + 4 new
   feature CLAUDE.md files + any sub-CLAUDE.md touch-ups.
6. `docs(web): replace default Vite README with real quickstart` — `web/README.md`.

Ask before pushing or opening a PR.

## Risks & edge cases

- **Archive size.** ~3.9 MB of markdown becomes tracked. One-time growth; acceptable.
- **Stats drift.** Between writing the spec and commit time, test count may change if a
  test is added. Re-verify immediately before committing the README.
- **Screenshot duplication.** `docs/screenshots/` duplicates three images from the
  archive. Accepted trade-off — gives README stable paths and decouples from any future
  archive reorg.
- **Deletion conflicts.** The 39 pending deletions under `docs/superpowers/plans/`,
  `docs/superpowers/specs/`, etc. need to be committed alongside the gitignore change so
  the archive tree is the only source of those files. Done in Commit 1.

## Open questions

None. All editorial decisions resolved during brainstorming.

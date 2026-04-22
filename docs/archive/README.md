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
3. [`plans/2026-03-30-plan-errata.md`](plans/2026-03-30-plan-errata.md) — the 48 concrete issues Claude and Codex independently flagged while auditing each other's plans, each with a fix applied before execution began.
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
- `current-design-spec.md` — design spec snapshot captured when the UI rewrite branched off (predates `2026-03-28-gym-routine-tracker-design.md`).
- `current-ui-rewrite-spec.md` — earlier UI rewrite spec (still references the original `docs/superpowers/specs/...` path for the product spec).
- `ui-rewrite-spec.md` — later UI rewrite spec (references the archive path after the docs move).

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
- `2026-03-30-plan-errata.md` — 48 errata items applied from both audits.

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

# Exercise Logger v2 — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first PWA gym routine tracker from scratch in `web/`, implementing the full v1 scope defined in the design spec.

**Architecture:** React + Vite + TypeScript app with Dexie.js (IndexedDB) as the persisted source of truth, Zustand for ephemeral UI state, shadcn/ui + Tailwind for the interface, deployed to GitHub Pages as an installable PWA. Six Dexie tables (`exercises`, `routines`, `sessions`, `sessionExercises`, `loggedSets`, `settings`) with session snapshotting for history durability.

**Spec:** `docs/superpowers/specs/2026-03-28-gym-routine-tracker-design.md`

**Errata:** `docs/superpowers/plans/2026-03-30-plan-errata.md` — consolidated audit fixes (2026-03-30). Read BEFORE implementing any phase. Fixes supersede corresponding code in phase plan files.

---

## Sequencing Rationale

The phases below are strictly sequential. Each phase produces working, testable code before the next begins. The ordering follows the spec's planning rule (section 17):

1. Contracts and storage first — everything else depends on stable types and schema
2. Import and normalization second — the app needs data to be useful
3. Session domain commands third — core business logic, no UI yet
4. UI fourth — screens consume stable domain logic
5. Backup, polish, and hardening last — requires a working app to test against

Each phase gets its own detailed plan document written before execution begins.

---

## Phase 1: Scaffolding & App Shell

**Plan file:** `docs/superpowers/plans/2026-03-28-phase1-scaffolding.md`

**Goal:** Create the `web/` project with all tooling configured and a deployable empty shell.

**Spec sections:** 2 (Repo Assumptions), 4 (Tech Stack)

**Scope:**
- Create `web/` directory with Vite + React + TypeScript
- Install and configure Tailwind CSS
- Install and configure shadcn/ui (initialize with a base theme)
- Install vite-plugin-pwa with a minimal manifest and service worker
- Install and configure Vitest + React Testing Library + Playwright
- Set up the app shell: bottom tab bar with 3 tabs (Today, Workout, History) + gear icon routing to Settings, all rendering placeholder content
- Set up React Router with the 4 routes
- Configure GitHub Actions workflow for GitHub Pages deployment
- Add `web/` scripts to root or `web/package.json`: `dev`, `build`, `test`, `test:e2e`
- Verify: `npm run dev` serves the app, `npm run build` produces a PWA-installable build, `npm test` runs, deploy pipeline triggers

**Deliverables:**
- Working dev server with tab navigation between placeholder screens
- CI pipeline that builds and deploys to GitHub Pages
- All tooling verified with at least one smoke test per tool (Vitest, RTL, Playwright)

**Dependencies:** None. This is the foundation.

---

## Phase 2: Domain Types & Data Layer

**Plan file:** `docs/superpowers/plans/2026-03-28-phase2-domain-data.md`

**Goal:** Define all TypeScript domain types, create the Dexie database with all 6 tables and indexes, and implement foundational helpers.

**Spec sections:** 5 (Architecture Decisions), 6 (Domain Invariants), 7 (Data Model)

**Scope:**
- TypeScript types for all domain entities:
  - `Exercise`, `ExerciseType`, `ExerciseEquipment`
  - `Routine`, `RoutineDay`, `RoutineEntry`, `RoutineExerciseEntry`, `SetBlock`
  - `Session`, `SessionStatus`
  - `SessionExercise`, `SessionExerciseOrigin`, `GroupType`
  - `LoggedSet`
  - `Settings`
  - `RoutineCardio`, `RoutineCardioOption` (routine cardio section types)
- `instanceLabel` must be `string` (not `string | null`) everywhere — use `""` as null sentinel for Dexie compound index compatibility (see errata S1)
- Dexie database class with all 6 tables, schema version 1, and all indexes from spec section 7
- Settings initialization (create default record if none exists)
- `blockSignature` generation helper (spec section 11)
- Unit conversion helpers: kg↔lbs, practical rounding by equipment type (spec section 11)
- UUID generation helper
- Slug generation helper (for exercise IDs)
- ISO timestamp helper

**Deliverables:**
- All types exported from a shared `domain/` module
- Dexie database instantiable and tested (tables create, indexes work)
- All helpers unit-tested
- No UI changes — this is pure data layer

**Dependencies:** Phase 1 (project exists, test tooling works)

---

## Phase 3: Catalog & Routine Import

**Plan file:** `docs/superpowers/plans/2026-03-28-phase3-catalog-routines.md`

**Goal:** Seed the exercise catalog from CSV and implement YAML routine parsing, validation, and normalization.

**Spec sections:** 8 (Exercise Catalog Contract), 9 (Routine YAML Contract)

**Scope:**
- Update `docs/exercises/gym_exercises_catalog.csv` with the 8 missing exercises, remove `Primary Muscles`, `Secondary Muscles`, `Difficulty` columns
- CSV parser that reads the catalog and produces `Exercise[]`
- Catalog seeding logic: on app init, seed/update the `exercises` table from the embedded CSV data
- YAML parser integration (`js-yaml` or `yaml` package)
- Routine validation: all rules from spec section 9 (version check, day_order matching, exercise_id existence, range validation, superset constraints, instance_label uniqueness, set count equality)
- Routine normalization: YAML authoring format → `Routine` record with generated `entryId`/`groupId`, `SetBlock` normalization
- Validation error messages: specific, field-level, user-readable
- Write the actual routine YAML template file for the Full Body 3-Day Rotation

**Deliverables:**
- Updated CSV with all exercises, trimmed columns
- CSV loader tested against the real catalog
- YAML validator tested against valid and invalid fixtures (at least 10 test cases covering each validation rule)
- Normalizer tested: valid YAML → correct `Routine` record shape
- Routine YAML template file ready for import testing

**Dependencies:** Phase 2 (types, Dexie schema, slug helper, `exercises` table)

---

## Phase 4: Session Management

**Plan file:** `docs/superpowers/plans/2026-03-28-phase4-session-management.md`

**Goal:** Implement all session lifecycle operations as tested domain functions, independent of UI.

**Spec sections:** 10 (Session Lifecycle), weighted bodyweight rules (section 7), domain invariants 1-9 and 13

**Scope:**
- **Start session:** create `sessions` row + snapshot all `sessionExercises` from the active routine's selected day. Enforce invariant 1 (at most one active session). Snapshot routine name, day label, day order, rest values, exercise names, effective type/equipment, notes, set blocks.
- **Resume session:** query for the active session, return it with its sessionExercises and loggedSets
- **Discard session:** hard-delete session + sessionExercises + loggedSets in one transaction. Must not advance rotation (invariant 4).
- **Finish session:** set status to `finished`, set `finishedAt`, advance `nextDayId` on the source routine using `dayOrderSnapshot` (invariant 3). Allow finishing with unlogged sets (spec: "may finish even if some prescribed sets were not logged").
- **Day override:** start session with a non-suggested day. Rotation advances to the day after the override pick.
- **Add extra exercise:** append a `sessionExercise` with `origin = "extra"`, no setBlocksSnapshot, at the end of orderIndex. Only allowed during active session (invariant 6).
- **Log set:** create or update `loggedSets` row keyed by `[sessionExerciseId, blockIndex, setIndex]` (invariant 9). Denormalize `exerciseId`, `instanceLabel`, `origin`, `blockSignature` from the sessionExercise. Weighted bodyweight promotion must run after BOTH create and update paths (see errata P4-D).
- **Edit set:** update existing loggedSet, set `updatedAt`. Also trigger weighted bodyweight promotion if applicable (see errata P4-E).
- **Delete set:** remove the loggedSet row.
- **Weighted bodyweight detection:** resolve `effectiveType` based on routine override, equipment override, or user-logged weight (spec section 7 rules).
- **Guard: block routine activation/deletion during active session** (invariant 13). Active-session check must be inside the Dexie transaction (see errata P4-B).

**Deliverables:**
- All session operations as pure functions / Dexie transactions
- Tests covering: start, resume, discard, finish, day override, extras, log/edit/delete, invariants 1-9, invariant 13, weighted bodyweight detection
- Acceptance test scenarios 4-7, 9, 11-13 from spec section 16

**Dependencies:** Phase 3 (catalog seeded, routine importable, exercises table populated)

---

## Phase 5: Progression & History Engine

**Plan file:** `docs/superpowers/plans/2026-03-28-phase5-progression.md`

**Goal:** Implement per-block history matching, weight suggestion engine, and last-time data retrieval.

**Spec sections:** 11 (Progression, Suggestions, and History Semantics), domain invariants 7-8

**Scope:**
- **Block matching:** given a sessionExercise and blockIndex, find the most recent finished session's loggedSets that match on `exerciseId` + `instanceLabel` + `blockSignature`. Implement fallback (same exerciseId + instanceLabel + tag + targetKind).
- **Suggestion engine:** evaluate all 4 conditions for automated progression (range target, weight/weighted-bodyweight type, all expected sets logged, all hit ceiling). The ceiling check must inspect `targetKind` to compare against the correct performed field — not just `performedReps` (see errata P5-A). Calculate 5% increase with practical rounding per equipment type and display unit. Use `getIncrement()` directly for minimum increment guard (see errata P5-B).
- **No-suggestion cases:** exact-rep blocks, exact-distance, cardio, extras, partial completion, no match.
- **Last-time display data:** retrieve per-block history for an exercise card. Format: `{ blockLabel, sets: [{ weightKg, reps, duration, distance }] }`. Multi-block exercises return separate entries per block.
- **Extra exercise history:** most recent sets for that exerciseId regardless of routine position or instanceLabel.
- **Guard: extras never feed progression** (invariant 7).
- **Guard: progression is per set block** (invariant 8).

**Deliverables:**
- Matching, suggestion, and last-time functions, all unit-tested
- Acceptance test scenario 8 from spec section 16
- Test cases: multi-block progression (top set ready for increase, back-off not), weighted bodyweight progression, no-suggestion cases, extras excluded

**Dependencies:** Phase 4 (session operations exist, loggedSets can be created)

---

## Phase 6: UI Screens & Timer

**Plan file:** `docs/superpowers/plans/2026-03-28-phase6-ui.md`

**Goal:** Build all four screens and the rest timer, consuming the domain logic from phases 2-5.

**Spec sections:** 12 (Rest Timer), 13 (Screen Requirements), domain invariant 2

**Scope:**

**Today screen:**
- No active routine → empty state with "Import Routine" and "Set Active Routine" prompts
- Active routine, no active session → show routine name, suggested day (`nextDayId`), day label, exercise preview list, "Start Workout" button, day override selector, last finished session summary, cardio notes
- Active session exists → "Resume Workout" card replaces the start flow (invariant 2)

**Workout screen:**
- No active session → "No active workout. Start one from Today."
- Active session → scrollable list of sessionExercises in orderIndex
- Exercise card: name, notes, prescribed set blocks with set slots, per-block last-time data, per-block suggestion (from Phase 5), tap-to-log interaction
- Superset rendering: visually connected pair
- Set logging form: pre-filled from current value → last-time → blank. Fields determined by block `targetKind` for routine exercises (see errata S2), with `effectiveType` controlling weight input visibility. Fallback to `effectiveType`-driven fields for extras.
- Extra exercises: "Add Exercise" button → catalog picker with muscle group filter tabs (invariant 11). Extras render without prescription blocks.
- Footer: "Finish Workout", "Discard Workout"

**History screen:**
- Session list: finished sessions, date, day letter, duration, exercise count, set count
- Session detail: full log, supports set edit and delete
- Per-exercise history: tap exercise name → all logged sets across finished sessions

**Settings screen:**
- Routines: list, highlight active, activate, import YAML (file picker), delete with confirmation. Activation/deletion blocked during active session.
- Preferences: units toggle (kg/lbs), theme toggle (light/dark/system)
- Data: export JSON, import JSON, clear all data (double confirmation, spec behavior)

**Rest timer (Zustand store + UI component):**
- Timer store: countdown, duration source (default vs superset), running/paused state
- Start on set log (single exercise: every set, superset: when both sides complete a round)
- Controls: dismiss, +30s, restart
- Non-blocking: visible overlay/banner, user can scroll freely
- Vibration alert on zero (fail silently if unsupported)

**Exercise picker component:**
- Muscle group filter tabs: Legs, Chest, Back, Shoulders, Arms, Core, Full Body, Cardio
- Exercises with compound muscleGroups appear under all matching tabs
- Search/select → appends to active session as extra

**Deliverables:**
- All 4 screens functional and navigable
- Timer working with superset round detection
- Exercise picker with muscle group filtering
- Acceptance test scenario 10 from spec section 16
- RTL tests for critical UI interactions (start workout, log a set, finish workout)

**Dependencies:** Phase 5 (progression and history logic). All domain logic is consumed here, not invented.

---

## Phase 7: Backup, Polish & Hardening

**Plan file:** `docs/superpowers/plans/2026-03-28-phase7-backup-polish.md`

**Goal:** Implement import/export, error handling, empty states, PWA finalization, and acceptance test coverage.

**Spec sections:** 14 (Import and Export), 15 (Error Handling and Empty States), 16 (Testing and Acceptance Criteria)

**Scope:**

**Export:**
- Versioned JSON envelope (`app`, `schemaVersion`, `exportedAt`, `data`)
- Export all routines, sessions, sessionExercises, loggedSets, settings
- Exclude exercise catalog
- Filename: `exercise-logger-backup-YYYY-MM-DD.json`
- Allowed even with an active session

**Import:**
- Full overwrite only
- Validate entire payload before any mutation (app field, schemaVersion, required collections, exerciseId existence in current catalog, at most one active session, structural validation)
- Blocked while a local active session exists
- Transactional: all-or-nothing Dexie transaction (invariant 12)
- Resume imported active session if present

**Clear all data:**
- Delete routines, sessions, sessionExercises, loggedSets, settings
- Recreate default settings (`activeRoutineId = null`, `units = "kg"`, `theme = "system"`)
- Blocked during active session

**Error handling:**
- Specific user-visible error messages for all cases in spec section 15
- No generic "Something went wrong" when a specific validation error exists

**Empty states:**
- No routines loaded, no active routine, no history, no exercise history, no previous block data

**PWA finalization:**
- App manifest with name, icons, theme color, display mode
- Service worker configured for offline-first (precache app shell, runtime cache for assets)
- Verify installability on Android Chrome

**Acceptance test suite:**
- All 16 scenarios from spec section 16 covered
- Playwright E2E smoke tests for the critical flows: import routine → start workout → log at least one set → finish → check history → verify export button (see errata P7-E for scope alignment). Use port 4173 (preview), not 5173 (dev) — see errata P7-D.

**Deliverables:**
- Export/import working and tested (scenario 15-16)
- All empty states and error states implemented
- PWA installable and working offline
- Full acceptance test suite passing

**Dependencies:** Phase 6 (UI complete, all features accessible)

---

## Phase Dependency Graph

```
Phase 1: Scaffolding
  └─→ Phase 2: Domain Types & Data Layer
        └─→ Phase 3: Catalog & Routine Import
              └─→ Phase 4: Session Management
                    └─→ Phase 5: Progression & History
                          └─→ Phase 6: UI Screens & Timer
                                └─→ Phase 7: Backup, Polish & Hardening
```

Strictly linear. No phase starts until the previous is complete and tested.

---

## File Structure (target state after all phases)

```
web/
├── public/
│   └── icons/                      # PWA icons
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Router + shell layout
│   ├── db/
│   │   ├── database.ts             # Dexie class, schema, migrations
│   │   └── seed.ts                 # Catalog seeding from CSV
│   ├── domain/
│   │   ├── types.ts                # All TypeScript domain types
│   │   ├── enums.ts                # ExerciseType, ExerciseEquipment, SessionStatus, etc.
│   │   ├── block-signature.ts      # blockSignature generation
│   │   ├── unit-conversion.ts      # kg↔lbs, practical rounding
│   │   ├── slug.ts                 # Name → slug
│   │   └── uuid.ts                 # UUID generation
│   ├── services/
│   │   ├── catalog-service.ts      # CSV parsing + catalog seeding
│   │   ├── routine-service.ts      # YAML validation, normalization, import
│   │   ├── session-service.ts      # Start, resume, discard, finish, extras
│   │   ├── set-service.ts          # Log, edit, delete sets
│   │   ├── progression-service.ts  # Block matching, suggestions, last-time
│   │   ├── settings-service.ts     # Settings CRUD, active routine management
│   │   └── backup-service.ts       # Export/import JSON
│   ├── stores/
│   │   └── timer-store.ts          # Zustand rest timer state
│   ├── screens/
│   │   ├── TodayScreen.tsx
│   │   ├── WorkoutScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── SessionDetailScreen.tsx
│   │   └── ExerciseHistoryScreen.tsx
│   ├── components/
│   │   ├── AppShell.tsx            # Bottom tabs + header
│   │   ├── ExerciseCard.tsx        # Workout exercise with set slots
│   │   ├── SetSlot.tsx             # Tap-to-log individual set
│   │   ├── SetLogForm.tsx          # Weight/reps/duration input
│   │   ├── SupersetGroup.tsx       # Visually connected pair
│   │   ├── ExercisePicker.tsx      # Muscle group filtered catalog picker
│   │   ├── RestTimer.tsx           # Non-blocking countdown overlay
│   │   ├── DaySelector.tsx         # Day override picker
│   │   └── RoutineImporter.tsx     # YAML file picker + validation feedback
│   ├── hooks/
│   │   ├── useActiveSession.ts     # Query active session state
│   │   ├── useLastTime.ts          # Per-block last-time data
│   │   └── useSuggestion.ts        # Per-block weight suggestion
│   └── lib/
│       ├── csv-parser.ts           # Generic CSV → object[] parser
│       └── yaml-parser.ts          # YAML string → validated routine
├── tests/
│   ├── unit/                       # Vitest unit tests
│   ├── integration/                # Vitest + fake-indexeddb integration tests
│   └── e2e/                        # Playwright E2E tests
├── data/
│   └── routines/
│       └── full-body-3day.yaml     # Reference routine template
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── playwright.config.ts
```

This structure enforces the spec's ownership rule: domain types and services are separate from UI, each service owns a disjoint responsibility, and screens consume services through hooks.

---

## Execution

Each phase is executed by implementing its detailed plan. Before starting any phase:

1. Read the errata file (`docs/superpowers/plans/2026-03-30-plan-errata.md`) for that phase's fixes
2. Apply all CERTAIN fixes — these override the corresponding code in the phase plan
3. Apply RECOMMENDED fixes unless there's a specific reason to defer
4. The phase plan's code is the baseline; the errata's fixes are patches on top

The detailed plans contain exact file paths, code, test commands, and commit points.

To begin: execute Phase 1, applying errata P1-A through P1-G during implementation.

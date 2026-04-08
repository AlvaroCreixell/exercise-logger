# Exercise Logger v2 — Project Guide

## Overview

Local-first PWA gym routine tracker. React + Vite + TypeScript app in `web/`, deployed to GitHub Pages. Single-user, phone-first, works offline.

**Spec:** `docs/superpowers/specs/2026-03-28-gym-routine-tracker-design.md`
**Errata:** `docs/superpowers/plans/2026-03-30-plan-errata.md` (44 audit-derived fixes applied during implementation)

## Architecture

```
Features (Screens + Components) → Hooks → Services → Dexie (IndexedDB)
```

Each layer only calls the layer below. Services are pure functions taking `db` as first argument. UI state reads from Dexie via `useLiveQuery`.

Layer-specific guides:
- `web/src/domain/CLAUDE.md` — Types, enums, helpers
- `web/src/db/CLAUDE.md` — Dexie schema, indexes, initialization
- `web/src/services/CLAUDE.md` — Business logic, invariants, transactions

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 7 + TypeScript 5 |
| UI | shadcn/ui + Tailwind CSS 4 |
| Storage | Dexie.js 4 (IndexedDB) |
| PWA | vite-plugin-pwa |
| Testing | Vitest + RTL + Playwright |
| Deploy | GitHub Pages via Actions |

## Commands

```bash
cd web
npm test              # 391 unit+integration tests (Vitest)
npm run test:watch    # Watch mode
npm run build         # Production build (includes PWA)
npm run dev           # Dev server (localhost:5173)
npm run preview       # Preview production build (localhost:4173)
npm run test:e2e      # Build + Playwright E2E
npm run lint          # ESLint
```

## Key Conventions

- **All timestamps:** ISO 8601 UTC strings, never `Date` objects
- **All weights:** Stored canonically in kilograms. Display conversion at render time.
- **`instanceLabel`:** Always `string`, never `null`. Use `""` as the null sentinel — Dexie silently drops `null` from compound indexes.
- **Snapshots:** Sessions snapshot routine/exercise state at creation. History survives routine deletion.
- **Imports:** Path alias `@/` maps to `web/src/`
- **IDs:** UUIDs for records, slugified names for exercises (e.g., `barbell-back-squat`)

## Domain Invariants (enforced in services)

1. At most one active session at a time
2. Resume takes priority over Start when active session exists
3. `nextDayId` advances only on session finish
4. Discard does NOT advance rotation
5. Finished sessions remain renderable after routine deletion (snapshots)
6. Extra exercises only during active session
7. Extra exercises never feed progression suggestions
8. Progression is per set block, not per exercise
9. Set logging upserts by `[sessionExerciseId, blockIndex, setIndex]`
10. Routine activation/deletion blocked during active session
11. Export/import is versioned and transactional (all-or-nothing)

## Testing Patterns

- **Dexie tests:** Use `fake-indexeddb` — real IndexedDB operations, not mocks
- **E2E:** Playwright targeting Pixel 7 Chromium on port 4173 (preview server)
- **Test data:** Helper factories (`makeExercise`, `makeRoutine`, etc.) in each test file
- **Integration tests:** `web/tests/integration/acceptance.test.ts` covers all 16 spec scenarios

## File Structure

```
web/src/
  app/          # Entry point: main.tsx, App.tsx, App.css
  domain/       # Types, enums, pure helpers (no React, no DB)
  db/           # Dexie database class, schema, initialization
  services/     # Business logic (session, set, progression, backup, etc.)
  shared/       # Cross-feature code
    lib/        # Generic utilities (CSV parser, shadcn cn())
    ui/         # shadcn/ui primitives (installed via CLI)
    hooks/      # Shared React hooks (useAppInit, useSettings, etc.)
    components/ # Shared UI components
  features/     # Feature modules (UI rewrite in progress)
    today/      # Routine overview, day selection, start workout
    workout/    # Active workout logging, exercise cards, set forms
    history/    # Session history, session detail, exercise history
    settings/   # Settings, routine import, backup/restore
  data/         # Embedded catalog CSV
```

## Gotchas

- **Dexie compound indexes + null:** Never store `null` in fields used in compound indexes. Use `""` instead. See `instanceLabel` on `SessionExercise` and `LoggedSet`.
- **PWA base path:** Everything uses `/exercise-logger/` base — BrowserRouter, Vite config, manifest.
- **Vite 7 not 8:** Downgraded from Vite 8 for vite-plugin-pwa compatibility.
- **shadcn/ui style:** Uses `base-nova` (v4 auto-detected), not legacy `default`.
- **Tailwind v4:** CSS-first config (`@import "tailwindcss"` in CSS), no `tailwind.config.ts`.

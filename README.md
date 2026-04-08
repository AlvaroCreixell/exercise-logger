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
npm test            # Run 377 unit + integration tests
npm run build       # Production build with PWA
npm run preview     # Preview production build at localhost:4173
npm run test:e2e    # Build + Playwright E2E tests
npm run lint        # ESLint
```

## Design docs

- [`docs/design-spec.md`](docs/design-spec.md) -- Original product specification
- [`docs/ui-rewrite-spec.md`](docs/ui-rewrite-spec.md) -- UI architecture and screen design
- [`CLAUDE.md`](CLAUDE.md) -- Detailed project guide (conventions, invariants, gotchas)

## License

[MIT](LICENSE)

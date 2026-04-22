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
| `src/test/`  | Vitest setup (`setup.ts`)                        |

## Conventions

See [`../CLAUDE.md`](../CLAUDE.md) for the full conventions, invariants, and gotchas list. Each layer directory also has its own `CLAUDE.md` guide.

## License

[MIT](../LICENSE)

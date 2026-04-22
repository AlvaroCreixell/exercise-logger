# UI Deletion & Codebase Restructure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all frontend UI code and restructure remaining files into a feature-based folder layout, ready for a clean UI rewrite.

**Architecture:** The data layer (domain, db, services) stays untouched except one bug fix (`initializeSettings` StrictMode race). All React screens, components, and the Zustand timer store are deleted. Hooks are preserved as thin data-access adapters and moved to `shared/hooks/`. Shared utilities move to `shared/lib/`. A minimal stub app is created so every committed state builds, boots, and passes tests. Feature folder scaffolding is created for the upcoming UI rewrite.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind CSS 4, shadcn/ui (base-nova), Dexie.js 4, Vitest

---

## Target folder structure

```
web/src/
  app/                          # App entry point
    main.tsx                    # React mount
    App.tsx                     # Router + init + placeholder routes
    App.css                     # Tailwind imports + theme tokens
  domain/                       # UNCHANGED (7 source files + CLAUDE.md)
    types.ts
    enums.ts
    block-signature.ts
    unit-conversion.ts
    slug.ts
    timestamp.ts
    uuid.ts
    CLAUDE.md
  db/                           # UNCHANGED (1 bug fix in database.ts + CLAUDE.md)
    database.ts
    CLAUDE.md
  services/                     # UNCHANGED (1 import path fix in catalog-service)
    session-service.ts
    set-service.ts
    progression-service.ts
    backup-service.ts
    routine-service.ts
    catalog-service.ts
    settings-service.ts
    CLAUDE.md
  shared/                       # Cross-feature shared code
    lib/                        # MOVED from lib/
      csv-parser.ts
      utils.ts
    ui/                         # EMPTY -- shadcn components install here
    hooks/                      # MOVED from hooks/ (thin Dexie wrappers)
      useAppInit.ts
      useActiveSession.ts
      useExerciseHistory.ts
      useExtraHistory.ts
      useRoutine.ts
      useSessionExercises.ts
      useSettings.ts
    components/                 # EMPTY -- shared UI components go here
  features/                     # EMPTY scaffolding for UI rewrite
    today/
    workout/
    history/
    settings/
  data/                         # UNCHANGED
    catalog.csv
  test/                         # UNCHANGED
    setup.ts
  vite-env-raw.d.ts             # UNCHANGED
```

```
web/tests/                      # Test structure after restructure
  unit/
    domain/                     # UNCHANGED (5 test files)
    db/                         # UNCHANGED (1 test file)
    services/                   # UNCHANGED (8 test files, lint fixed)
    shared/
      lib/
        csv-parser.test.ts      # MOVED from unit/lib/, import updated
  integration/                  # UNCHANGED (lint fixed)
    acceptance.test.ts
  e2e/                          # UNCHANGED
    smoke.spec.ts               # Passes against stub app
    full-workflow.spec.ts       # Fails until UI rewrite (expected)
```

## What is deleted and why

| Deleted | Reason |
|---------|--------|
| `screens/` (6 files + CLAUDE.md) | UI rewrite -- all screens rebuilt from scratch |
| `components/` (14 files incl. ui/ + CLAUDE.md) | UI rewrite -- new components, shadcn reinstalled to new path |
| `stores/timer-store.ts` + CLAUDE.md | Timer feature removed entirely |
| `App.tsx`, `App.css`, `main.tsx` | Replaced by `app/` directory versions |
| Component/screen/store/App tests (10 files) | Test code for deleted source files |

## What is kept and why

| Kept | Reason |
|------|--------|
| `domain/` (7 files + CLAUDE.md) | Pure types/helpers -- no UI dependency |
| `db/database.ts` + CLAUDE.md | Dexie schema -- no UI dependency (StrictMode bug fixed) |
| `services/` (7 files + CLAUDE.md) | Business logic -- no UI dependency |
| `hooks/` (7 files) | Thin Dexie wrappers -- moved to `shared/hooks/` |
| `data/catalog.csv` | Exercise catalog data |
| `lib/csv-parser.ts` + `lib/utils.ts` | Moved to `shared/lib/` |
| `test/setup.ts` | Test infra |
| Domain/service/db/lib tests (15 files) | Pure logic tests -- no UI dependency |
| Integration test (1 file) | Full workflow test -- no UI dependency |
| E2E tests (2 files) | smoke.spec.ts passes, full-workflow.spec.ts deferred to UI rewrite |

---

### Task 1: Fix initializeSettings StrictMode bug

**Why:** `initializeSettings()` does a read-then-add which races under React StrictMode's double-mount in dev. Two concurrent calls both see no record, both try `add()`, one gets a `ConstraintError`. Fix: use `put()` which is idempotent.

**Files:**
- Modify: `web/src/db/database.ts:46-51`
- Test: `web/tests/unit/db/database.test.ts` (existing tests cover this)

- [ ] **Step 1: Fix initializeSettings to use put()**

In `web/src/db/database.ts`, replace the `initializeSettings` function (lines 42-51):

```typescript
// OLD
/**
 * Ensure a default settings record exists.
 * Call this on app startup. If the "user" record already exists, this is a no-op.
 */
export async function initializeSettings(db: ExerciseLoggerDB): Promise<void> {
  const existing = await db.settings.get("user");
  if (!existing) {
    await db.settings.add(DEFAULT_SETTINGS);
  }
}

// NEW
/**
 * Ensure a default settings record exists.
 * Call this on app startup. Uses put() so concurrent calls under
 * React StrictMode's double-mount do not race on add().
 */
export async function initializeSettings(db: ExerciseLoggerDB): Promise<void> {
  const existing = await db.settings.get("user");
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
  }
}
```

- [ ] **Step 2: Run database tests to verify**

```bash
cd web && npx vitest run tests/unit/db/database.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd web && git add src/db/database.ts && git commit -m "$(cat <<'EOF'
fix: use put() in initializeSettings to prevent StrictMode race

React StrictMode double-mounts in dev, causing two concurrent
initializeSettings calls. Both see no record and call add(),
producing a ConstraintError. put() is idempotent and safe.
EOF
)"
```

---

### Task 2: Delete UI files, move hooks and lib, create stub app

This is one atomic task producing one green commit. No intermediate broken states.

**Files deleted:**
- `web/src/screens/` (6 files + CLAUDE.md)
- `web/src/components/` (14 files + CLAUDE.md)
- `web/src/stores/` (1 file + CLAUDE.md)
- `web/src/App.tsx`, `web/src/App.css`, `web/src/main.tsx`

**Files moved:**
- `web/src/hooks/*.ts` (7 files) to `web/src/shared/hooks/`
- `web/src/lib/*.ts` (2 files) to `web/src/shared/lib/`

**Files created:**
- `web/src/app/main.tsx`, `web/src/app/App.tsx`, `web/src/app/App.css`
- `.gitkeep` files in empty scaffold directories

**Files modified:**
- `web/src/services/catalog-service.ts` (import path)
- `web/index.html` (entry point)
- `web/components.json` (aliases)

- [ ] **Step 1: Delete screens, components, stores**

```bash
cd web && rm -rf src/screens src/components src/stores
```

- [ ] **Step 2: Delete old app entry files**

```bash
cd web && rm src/App.tsx src/App.css src/main.tsx
```

- [ ] **Step 3: Create new directory structure**

```bash
cd web/src && mkdir -p app shared/lib shared/hooks shared/ui shared/components features/today features/workout features/history features/settings
```

- [ ] **Step 4: Move hooks to shared/hooks/**

```bash
cd web && mv src/hooks/*.ts src/shared/hooks/ && rm -rf src/hooks
```

- [ ] **Step 5: Move lib to shared/lib/**

```bash
cd web && mv src/lib/*.ts src/shared/lib/ && rm -rf src/lib
```

- [ ] **Step 6: Update import in catalog-service.ts**

In `web/src/services/catalog-service.ts`, change line 1:

```typescript
// OLD
import { parseCsv } from "@/lib/csv-parser";
// NEW
import { parseCsv } from "@/shared/lib/csv-parser";
```

- [ ] **Step 7: Add .gitkeep to empty directories**

```bash
cd web/src && for dir in shared/ui shared/components features/today features/workout features/history features/settings; do touch "$dir/.gitkeep"; done
```

- [ ] **Step 8: Create app/App.css**

Preserve the existing Tailwind/shadcn setup and theme tokens. The theme will be redesigned during the UI rewrite.

Create `web/src/app/App.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 9: Create app/App.tsx**

Stub router with placeholder screens. Uses proper nav semantics (`role="navigation"`, `aria-label="Main navigation"`, `NavLink`) and route headings so `smoke.spec.ts` passes against this stub.

Create `web/src/app/App.tsx`:

```tsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
} from "react-router";
import { useAppInit } from "@/shared/hooks/useAppInit";

const tabs = [
  { to: "/", label: "Today" },
  { to: "/workout", label: "Workout" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
] as const;

function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
      <nav
        className="border-t border-border bg-background"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Placeholder({ heading }: { heading: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <h1 className="text-lg text-muted-foreground">{heading}</h1>
    </div>
  );
}

function AppRoutes() {
  const { ready, error } = useAppInit();

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <p className="text-destructive">Failed to initialize: {error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Placeholder heading="No Active Routine" />} />
        <Route
          path="/workout"
          element={<Placeholder heading="No Active Workout" />}
        />
        <Route
          path="/history"
          element={<Placeholder heading="No History Yet" />}
        />
        <Route
          path="/history/:sessionId"
          element={<Placeholder heading="Session Detail" />}
        />
        <Route
          path="/history/exercise/:exerciseId"
          element={<Placeholder heading="Exercise History" />}
        />
        <Route
          path="/settings"
          element={<Placeholder heading="Settings" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/exercise-logger">
      <AppRoutes />
    </BrowserRouter>
  );
}
```

- [ ] **Step 10: Create app/main.tsx**

Create `web/src/app/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Update index.html entry point**

In `web/index.html`, change the script src:

```html
<!-- OLD -->
<script type="module" src="/src/main.tsx"></script>
<!-- NEW -->
<script type="module" src="/src/app/main.tsx"></script>
```

- [ ] **Step 12: Update components.json paths**

Replace `web/components.json` with:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/App.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/shared/components",
    "utils": "@/shared/lib/utils",
    "ui": "@/shared/ui",
    "lib": "@/shared/lib",
    "hooks": "@/shared/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [ ] **Step 13: Verify source file count**

```bash
cd web && find src -type f -not -name '.gitkeep' | sort
```

Expected (30 files):
```
src/app/App.css
src/app/App.tsx
src/app/main.tsx
src/data/catalog.csv
src/db/CLAUDE.md
src/db/database.ts
src/domain/CLAUDE.md
src/domain/block-signature.ts
src/domain/enums.ts
src/domain/slug.ts
src/domain/timestamp.ts
src/domain/types.ts
src/domain/unit-conversion.ts
src/domain/uuid.ts
src/services/CLAUDE.md
src/services/backup-service.ts
src/services/catalog-service.ts
src/services/progression-service.ts
src/services/routine-service.ts
src/services/session-service.ts
src/services/set-service.ts
src/services/settings-service.ts
src/shared/hooks/useActiveSession.ts
src/shared/hooks/useAppInit.ts
src/shared/hooks/useExerciseHistory.ts
src/shared/hooks/useExtraHistory.ts
src/shared/hooks/useRoutine.ts
src/shared/hooks/useSessionExercises.ts
src/shared/hooks/useSettings.ts
src/test/setup.ts
src/vite-env-raw.d.ts
```

---

### Task 3: Delete UI tests, move lib test, fix lint in kept tests

**Files deleted:**
- `web/tests/unit/components/` (4 files)
- `web/tests/unit/screens/` (4 files)
- `web/tests/unit/stores/` (1 file)
- `web/tests/unit/App.test.tsx`

**Files moved:**
- `web/tests/unit/lib/csv-parser.test.ts` to `web/tests/unit/shared/lib/`

**Files modified (lint fixes):**
- `web/tests/integration/acceptance.test.ts` (remove unused imports)
- `web/tests/unit/services/backup-service.test.ts` (remove unused import, fix `any` types)
- `web/tests/unit/services/progression-service.test.ts` (remove unused imports)
- `web/tests/unit/services/routine-service.test.ts` (remove unused `vi` import)
- `web/tests/unit/services/session-lifecycle.test.ts` (remove unused imports, fix `const`)
- `web/tests/unit/services/session-service.test.ts` (remove unused imports)

- [ ] **Step 1: Delete UI test directories and App test**

```bash
cd web && rm -rf tests/unit/components tests/unit/screens tests/unit/stores && rm tests/unit/App.test.tsx
```

- [ ] **Step 2: Move csv-parser test**

```bash
cd web && mkdir -p tests/unit/shared/lib && mv tests/unit/lib/csv-parser.test.ts tests/unit/shared/lib/ && rm -rf tests/unit/lib
```

- [ ] **Step 3: Update import in csv-parser test**

In `web/tests/unit/shared/lib/csv-parser.test.ts`, change line 2:

```typescript
// OLD
import { parseCsv } from "@/lib/csv-parser";
// NEW
import { parseCsv } from "@/shared/lib/csv-parser";
```

- [ ] **Step 4: Fix lint in acceptance.test.ts**

In `web/tests/integration/acceptance.test.ts`, remove unused imports. Replace lines 3-5:

```typescript
// OLD
import {
  ExerciseLoggerDB,
  DEFAULT_SETTINGS,
  initializeSettings,
} from "@/db/database";

// NEW
import {
  ExerciseLoggerDB,
  initializeSettings,
} from "@/db/database";
```

Remove unused type import `ValidateRoutineResult` on line 13:

```typescript
// OLD
import type { ValidateRoutineResult } from "@/services/routine-service";
// NEW (delete this line entirely)
```

Remove unused `getSettings` import on line 23:

```typescript
// OLD (within settings-service import block)
import {
  getSettings,
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";

// NEW
import {
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";
```

Remove unused type imports on lines 39-42:

```typescript
// OLD
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
} from "@/domain/types";

// NEW
import type {
  Exercise,
} from "@/domain/types";
```

- [ ] **Step 5: Fix lint in backup-service.test.ts**

In `web/tests/unit/services/backup-service.test.ts`, remove unused `BackupData` type import on line 15:

```typescript
// OLD
  type BackupEnvelope,
  type BackupData,
} from "@/services/backup-service";

// NEW
  type BackupEnvelope,
} from "@/services/backup-service";
```

Fix `any` types on lines 378, 393, 470. Replace each `as any` with `as unknown`:

```typescript
// Line 378 pattern: (envelope as any).someField
// Replace each occurrence of `as any` with `as unknown as BackupEnvelope`
// or with a more specific type depending on context.
// Check each usage and apply the narrowest safe cast.
```

Note: The `as any` casts in this file are used to test validation of malformed input. Replace with explicit `unknown` casts:

```typescript
// Pattern for all three locations:
// OLD: someValue as any
// NEW: someValue as unknown as BackupEnvelope
```

- [ ] **Step 6: Fix lint in progression-service.test.ts**

In `web/tests/unit/services/progression-service.test.ts`, remove unused imports on lines 12-15 and 21:

```typescript
// OLD (lines 10-21)
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  Session,
  SessionExercise,
  LoggedSet,
  SetBlock,
} from "@/domain/types";
import type { ExerciseType, ExerciseEquipment, SetTag, UnitSystem } from "@/domain/enums";

// NEW
import type {
  Exercise,
  Session,
  SessionExercise,
  LoggedSet,
  SetBlock,
} from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
```

Verify after editing -- the test file may use some of these types further down. Only remove imports that are truly unused.

- [ ] **Step 7: Fix lint in routine-service.test.ts**

In `web/tests/unit/services/routine-service.test.ts`, remove unused `vi` from import on line 2:

```typescript
// OLD
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// NEW
import { describe, it, expect, beforeEach, afterEach } from "vitest";
```

- [ ] **Step 8: Fix lint in session-lifecycle.test.ts**

In `web/tests/unit/services/session-lifecycle.test.ts`:

Remove unused `Dexie` import on line 3:

```typescript
// OLD
import Dexie from "dexie";
// NEW (delete this line entirely)
```

Remove unused `hasActiveSession` import on line 14:

```typescript
// OLD
import {
  hasActiveSession,
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";

// NEW
import {
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";
```

Remove unused `RoutineEntry` from type import on line 18:

```typescript
// OLD
import type { Exercise, Routine, RoutineEntry, SetBlock } from "@/domain/types";
// NEW
import type { Exercise, Routine, SetBlock } from "@/domain/types";
```

Fix `prefer-const` on line 263:

```typescript
// OLD
let r2 = ...
// NEW
const r2 = ...
```

- [ ] **Step 9: Fix lint in session-service.test.ts**

In `web/tests/unit/services/session-service.test.ts`:

Remove unused `vi` from import on line 2:

```typescript
// OLD
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// NEW
import { describe, it, expect, beforeEach, afterEach } from "vitest";
```

Remove unused type imports on lines 17-18:

```typescript
// OLD
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  Session,
  SessionExercise,
  SetBlock,
} from "@/domain/types";

// NEW
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  SetBlock,
} from "@/domain/types";
```

Verify after editing -- check which types are actually used in the test file body before removing.

- [ ] **Step 10: Verify test file count**

```bash
cd web && find tests -type f | sort
```

Expected (18 test files):
```
tests/e2e/full-workflow.spec.ts
tests/e2e/smoke.spec.ts
tests/integration/acceptance.test.ts
tests/unit/db/database.test.ts
tests/unit/domain/block-signature.test.ts
tests/unit/domain/slug.test.ts
tests/unit/domain/timestamp.test.ts
tests/unit/domain/unit-conversion.test.ts
tests/unit/domain/uuid.test.ts
tests/unit/shared/lib/csv-parser.test.ts
tests/unit/services/backup-service.test.ts
tests/unit/services/catalog-service.test.ts
tests/unit/services/progression-service.test.ts
tests/unit/services/routine-service.test.ts
tests/unit/services/session-lifecycle.test.ts
tests/unit/services/session-service.test.ts
tests/unit/services/set-service.test.ts
tests/unit/services/settings-service.test.ts
```

---

### Task 4: Update project CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (project root)

- [ ] **Step 1: Update Architecture section**

In `CLAUDE.md`, replace the Architecture section (lines 10-27):

```markdown
## Architecture

```
Features (Screens + Components) --> Hooks --> Services --> Dexie (IndexedDB)
```

Each layer only calls the layer below. Services are pure functions taking `db` as first argument. UI state reads from Dexie via `useLiveQuery`.

Layer-specific guides:
- `web/src/domain/CLAUDE.md` -- Types, enums, helpers
- `web/src/db/CLAUDE.md` -- Dexie schema, indexes, initialization
- `web/src/services/CLAUDE.md` -- Business logic, invariants, transactions
```

- [ ] **Step 2: Update Tech Stack table**

In `CLAUDE.md`, replace the Tech Stack table (lines 28-38):

```markdown
## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 7 + TypeScript 5 |
| UI | shadcn/ui + Tailwind CSS 4 |
| Storage | Dexie.js 4 (IndexedDB) |
| PWA | vite-plugin-pwa |
| Testing | Vitest + RTL + Playwright |
| Deploy | GitHub Pages via Actions |
```

- [ ] **Step 3: Update Testing Patterns section**

In `CLAUDE.md`, replace the Testing Patterns section (lines 76-83):

```markdown
## Testing Patterns

- **Dexie tests:** Use `fake-indexeddb` -- real IndexedDB operations, not mocks
- **E2E:** Playwright targeting Pixel 7 Chromium on port 4173 (preview server)
- **Test data:** Helper factories (`makeExercise`, `makeRoutine`, etc.) in each test file
- **Integration tests:** `web/tests/integration/acceptance.test.ts` covers all 16 spec scenarios
```

- [ ] **Step 4: Update File Structure section**

In `CLAUDE.md`, replace the File Structure section (lines 84-97):

```markdown
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
```

- [ ] **Step 5: Update Gotchas section**

In `CLAUDE.md`, remove the last two bullets from Gotchas (SetLogForm and Superset timer, lines 106-107) since both relate to deleted UI:

```markdown
// DELETE these two lines:
- **SetLogForm fields:** Driven by `targetKind` from set block prescription, NOT by `effectiveType`. `effectiveType` only controls weight input visibility.
- **Superset timer:** Uses flat round index (not blockIndex+setIndex pairs) because superset sides may have different block decompositions.
```

---

### Task 5: Verify and commit

**Files:** None (verification and commit only)

- [ ] **Step 1: Run TypeScript compilation**

```bash
cd web && npx tsc -b
```

Expected: Clean exit, no errors.

- [ ] **Step 2: Run lint**

```bash
cd web && npm run lint
```

Expected: Clean exit, no errors. All unused-import and `any` issues from Task 3 are fixed.

If lint still fails, fix the remaining issues before proceeding.

- [ ] **Step 3: Run unit tests**

```bash
cd web && npm test
```

Expected: All domain, service, db, and lib tests pass. Count should match the number of tests in the 16 kept test files (excluding E2E).

- [ ] **Step 4: Verify production build**

```bash
cd web && npm run build
```

Expected: Clean build with no errors. PWA manifest and service worker generated.

- [ ] **Step 5: Verify dev server boots**

```bash
cd web && npm run dev
```

Open `http://localhost:5173/exercise-logger/` in a browser. Expected:
- App loads (no console errors)
- "No Active Routine" heading visible on Today tab
- Bottom navigation shows 4 tabs (Today, Workout, History, Settings)
- Clicking each tab shows the corresponding placeholder heading
- No ConstraintError in console (initializeSettings fix verified)

Stop the dev server after verification.

- [ ] **Step 6: Commit all changes**

```bash
cd web && git add -A && cd .. && git add CLAUDE.md && git commit -m "$(cat <<'EOF'
refactor: delete UI layer, restructure into feature-based folders

- Delete all screens, components, Zustand timer store
- Move hooks to shared/hooks/ (thin Dexie wrappers, reusable)
- Move lib/ to shared/lib/
- Create stub app with placeholder routes (smoke-test compatible)
- Create features/ scaffolding for upcoming UI rewrite
- Fix lint errors in kept test files (unused imports, any types)
- Update CLAUDE.md for new structure (remove Zustand, timer refs)
- Update components.json aliases for new paths
EOF
)"
```

---

## Post-plan notes

**Commit history after this plan:**
1. `fix: use put() in initializeSettings to prevent StrictMode race` -- data layer bug fix
2. `refactor: delete UI layer, restructure into feature-based folders` -- one green atomic commit

**What comes next:** A separate UI rewrite plan will define the new screen designs, interaction model, and visual system. That plan will populate the `features/` directories and add shadcn components to `shared/ui/`.

**E2E tests:**
- `smoke.spec.ts` -- passes against the stub app (headings and nav semantics match)
- `full-workflow.spec.ts` -- expected to fail until UI rewrite provides real screens. Do not run via `npm test` (Playwright is separate via `npm run test:e2e`).

**shadcn components:** None installed after this plan. Install with `npx shadcn add <component>` -- they land in `src/shared/ui/` per updated `components.json`.

**Hooks in shared/hooks/:** All 7 thin Dexie wrappers are preserved. During the UI rewrite, feature-specific hooks may move into their feature directory. Cross-feature hooks (`useAppInit`, `useSettings`, `useRoutine`) stay in `shared/hooks/`.

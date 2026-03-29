# Phase 1: Scaffolding & App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `web/` project with Vite + React + TypeScript, configure all tooling (Tailwind v4, shadcn/ui, PWA, testing), build a mobile-first app shell with bottom tab navigation and 4 routes, and set up GitHub Pages CI/CD.

**Architecture:** A Vite-bundled React SPA lives in `web/` at the repo root, isolated from the legacy Python/Kivy app. The app shell uses React Router for client-side routing between 4 screens (Today, Workout, History, Settings) with a persistent bottom tab bar. The PWA shell is configured for installability and offline caching from day one.

**Tech Stack:** Vite 8, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui (Radix), React Router 7, vite-plugin-pwa, Vitest + React Testing Library + Playwright, GitHub Actions for GitHub Pages deployment.

---

## File Structure (Phase 1 target state)

```
web/
├── public/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── components/
│   │   └── AppShell.tsx
│   ├── screens/
│   │   ├── TodayScreen.tsx
│   │   ├── WorkoutScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── lib/
│   │   └── utils.ts
│   └── test/
│       └── setup.ts
├── tests/
│   ├── unit/
│   │   └── App.test.tsx
│   └── e2e/
│       └── smoke.spec.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── components.json
├── package.json
├── playwright.config.ts
└── eslint.config.js
.github/
└── workflows/
    └── deploy-web.yml
```

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `web/` (entire scaffold via `npm create vite`)
- Modify: `web/package.json` (verify scripts)

- [ ] **Step 1: Create the Vite project**

Run from the repo root:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
npm create vite@latest web -- --template react-ts
```

Expected output (key lines):
```
Scaffolding project in C:\Users\creix\VSC Projects\exercise_logger\web...
Done. Now run:
  cd web
  npm install
  npm run dev
```

- [ ] **Step 2: Install dependencies**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install
```

Expected: Clean install with no errors. `node_modules/` created.

- [ ] **Step 3: Verify the dev server starts**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run dev -- --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173/ | head -5
kill %1 2>/dev/null
```

Expected: HTML response containing `<div id="root">`.

- [ ] **Step 4: Clean out Vite boilerplate**

Delete these files that come with the Vite template:
```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
rm -f src/App.css src/index.css src/assets/react.svg public/vite.svg
```

Replace `web/src/App.tsx` with a minimal placeholder:

```tsx
function App() {
  return <div>Exercise Logger</div>;
}

export default App;
```

Replace `web/src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Replace `web/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#09090b" />
    <title>Exercise Logger</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify clean app runs**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds with no errors. Output in `web/dist/`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: scaffold Vite + React + TypeScript project in web/"
```

---

### Task 2: Install and configure Tailwind CSS v4

**Files:**
- Modify: `web/package.json` (new deps)
- Create: `web/src/App.css`
- Modify: `web/src/main.tsx` (import CSS)

Tailwind CSS v4 uses a CSS-first configuration approach. There is no `tailwind.config.ts` file. All configuration is done via `@theme` directives in CSS. The Vite plugin handles PostCSS integration automatically.

- [ ] **Step 1: Install Tailwind CSS v4 and its Vite plugin**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install tailwindcss @tailwindcss/vite
```

Expected: Both packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Add the Tailwind Vite plugin to `vite.config.ts`**

Replace `web/vite.config.ts` with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 3: Create the Tailwind CSS entry point**

Create `web/src/App.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Import the CSS in `main.tsx`**

Update `web/src/main.tsx` to import the CSS file:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Verify Tailwind works**

Temporarily update `web/src/App.tsx` to use a Tailwind class:

```tsx
function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <h1 className="text-2xl font-bold">Exercise Logger</h1>
    </div>
  );
}

export default App;
```

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds. The output CSS in `dist/` contains the Tailwind utility classes used.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: install and configure Tailwind CSS v4"
```

---

### Task 3: Install and configure shadcn/ui

**Files:**
- Modify: `web/package.json` (new deps)
- Modify: `web/tsconfig.json` (path aliases)
- Modify: `web/tsconfig.app.json` (path aliases)
- Modify: `web/vite.config.ts` (path aliases)
- Create: `web/src/lib/utils.ts`
- Create: `web/components.json`
- Modify: `web/src/App.css` (shadcn theme variables)

shadcn/ui v4 has a `--template=vite` option that configures everything for a Vite + React + Tailwind v4 project. It sets up path aliases, CSS variables, and the `components.json` configuration.

- [ ] **Step 1: Set up TypeScript path aliases**

These path aliases are required by shadcn/ui. They must be configured before running `shadcn init`.

Update `web/tsconfig.json` to:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Update `web/tsconfig.app.json` — add `baseUrl` and `paths` to the existing `compilerOptions`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Add the Vite path alias resolver**

Update `web/vite.config.ts`:

```ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Run shadcn init**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx shadcn@latest init -t vite -y
```

Expected output (key lines):
```
- Created components.json
- Created src/lib/utils.ts
- Updated src/App.css
```

This will:
- Create `web/components.json` with the shadcn configuration
- Create `web/src/lib/utils.ts` with the `cn()` helper
- Update `web/src/App.css` with CSS custom properties for the theme
- Install `tailwind-merge`, `clsx`, `class-variance-authority`, `lucide-react` as dependencies

- [ ] **Step 4: Verify shadcn is configured**

Check that `web/components.json` exists and contains valid configuration:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
cat components.json
```

Expected: JSON file with `"$schema"`, `"style"`, `"tailwind"`, `"aliases"` fields.

Check that `web/src/lib/utils.ts` exists:

```bash
cat src/lib/utils.ts
```

Expected: File containing a `cn()` function that merges Tailwind classes.

- [ ] **Step 5: Install a test component to verify the pipeline**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx shadcn@latest add button -y
```

Expected: `web/src/components/ui/button.tsx` created.

- [ ] **Step 6: Verify the component works**

Update `web/src/App.tsx`:

```tsx
import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Button>Exercise Logger</Button>
    </div>
  );
}

export default App;
```

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Remove the test button component**

The button was only installed to verify shadcn works. Remove it since Phase 1 only needs the scaffold:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
rm -rf src/components/ui
```

Revert `web/src/App.tsx` to the Tailwind-only version:

```tsx
function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-bold">Exercise Logger</h1>
    </div>
  );
}

export default App;
```

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: install and configure shadcn/ui with Tailwind v4"
```

---

### Task 4: Install and configure vite-plugin-pwa

**Files:**
- Modify: `web/package.json` (new dep)
- Modify: `web/vite.config.ts` (PWA plugin)
- Create: `web/public/icons/icon-192.png` (placeholder)
- Create: `web/public/icons/icon-512.png` (placeholder)

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install vite-plugin-pwa
```

Expected: `vite-plugin-pwa` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create placeholder PWA icons**

Generate minimal placeholder icons (solid colored squares). These will be replaced with real icons later.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
mkdir -p public/icons
```

Use Node.js to create minimal valid PNG files:

```bash
node -e "
const fs = require('fs');

// Minimal 1x1 PNG, will be replaced with real icons later
// This is a valid PNG that renders as a single dark pixel
const png1px = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
  0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
  0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
  0x44, 0xAE, 0x42, 0x60, 0x82  // IEND chunk
]);

fs.writeFileSync('public/icons/icon-192.png', png1px);
fs.writeFileSync('public/icons/icon-512.png', png1px);
console.log('Created placeholder icons');
"
```

Expected: Two PNG files created in `web/public/icons/`.

- [ ] **Step 3: Configure the PWA plugin**

Update `web/vite.config.ts`. Note: we set `base: "/exercise-logger/"` now because the PWA manifest scope and start_url reference this path, and it must match the GitHub Pages deployment path. The BrowserRouter `basename` added in Task 7 will also depend on this.

```ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/exercise-logger/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Exercise Logger",
        short_name: "ExLog",
        description: "Local-first gym routine tracker",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        scope: "/exercise-logger/",
        start_url: "/exercise-logger/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Verify the PWA build produces a manifest and service worker**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
ls dist/manifest.webmanifest dist/sw.js 2>/dev/null
```

Expected: Both `manifest.webmanifest` and `sw.js` exist in `dist/`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: configure vite-plugin-pwa with manifest and service worker"
```

---

### Task 5: Install and configure Vitest + React Testing Library

**Files:**
- Modify: `web/package.json` (new dev deps)
- Modify: `web/vite.config.ts` (test config)
- Create: `web/src/test/setup.ts`
- Create: `web/tests/unit/App.test.tsx`

- [ ] **Step 1: Install test dependencies**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: All packages added to `devDependencies`.

- [ ] **Step 2: Create the test setup file**

Create `web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add Vitest configuration to `vite.config.ts`**

Update `web/vite.config.ts` to add the `test` block. The full file becomes:

```ts
/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/exercise-logger/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Exercise Logger",
        short_name: "ExLog",
        description: "Local-first gym routine tracker",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        scope: "/exercise-logger/",
        start_url: "/exercise-logger/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
```

- [ ] **Step 4: Add the `test` script to `package.json`**

Verify `web/package.json` has a test script. If the Vite scaffold did not add one, add it:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
```

- [ ] **Step 5: Write the first smoke test**

Create `web/tests/unit/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the app heading", () => {
    render(<App />);
    expect(
      screen.getByText("Exercise Logger")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test and verify it passes**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected:
```
 ✓ tests/unit/App.test.tsx (1)
   ✓ App (1)
     ✓ renders the app heading

 Test Files  1 passed (1)
 Tests       1 passed (1)
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: configure Vitest and React Testing Library with smoke test"
```

---

### Task 6: Install and configure Playwright

**Files:**
- Modify: `web/package.json` (new dev dep + script)
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install -D @playwright/test
npx playwright install chromium
```

Expected: `@playwright/test` added to `devDependencies`. Chromium browser binary downloaded.

- [ ] **Step 2: Create `web/playwright.config.ts`**

The `baseURL` includes `/exercise-logger` to match the Vite `base` path set in Task 4. The `webServer.url` also includes the base path so Playwright waits for the correct URL to be ready.

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173/exercise-logger",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/exercise-logger/",
    reuseExistingServer: !process.env.CI,
  },
});
```

Note: We use the Vite preview server (`npm run preview`) which serves the production build. This requires running `npm run build` before E2E tests.

- [ ] **Step 3: Add the E2E test script**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm pkg set scripts.test:e2e="playwright test"
```

- [ ] **Step 4: Write the E2E smoke test**

Create `web/tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("app loads and shows heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Exercise Logger")).toBeVisible();
});
```

- [ ] **Step 5: Run the E2E test**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build && npx playwright test
```

Expected:
```
  1 passed
```

- [ ] **Step 6: Add Playwright artifacts to `.gitignore`**

Append to `web/.gitignore` (which Vite created):

```
# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: configure Playwright with E2E smoke test"
```

---

### Task 7: Set up React Router with 4 routes

**Files:**
- Modify: `web/package.json` (new dep)
- Create: `web/src/screens/TodayScreen.tsx`
- Create: `web/src/screens/WorkoutScreen.tsx`
- Create: `web/src/screens/HistoryScreen.tsx`
- Create: `web/src/screens/SettingsScreen.tsx`
- Modify: `web/src/App.tsx` (router setup)

- [ ] **Step 1: Install React Router**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install react-router
```

Expected: `react-router` added to `dependencies`.

- [ ] **Step 2: Create placeholder screen components**

Create `web/src/screens/TodayScreen.tsx`:

```tsx
export default function TodayScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your daily workout overview will appear here.
        </p>
      </div>
    </div>
  );
}
```

Create `web/src/screens/WorkoutScreen.tsx`:

```tsx
export default function WorkoutScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Workout</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No active workout. Start one from Today.
        </p>
      </div>
    </div>
  );
}
```

Create `web/src/screens/HistoryScreen.tsx`:

```tsx
export default function HistoryScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">History</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your workout history will appear here.
        </p>
      </div>
    </div>
  );
}
```

Create `web/src/screens/SettingsScreen.tsx`:

```tsx
export default function SettingsScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Routines, preferences, and data management.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Set up the router in `App.tsx`**

Update `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import TodayScreen from "@/screens/TodayScreen";
import WorkoutScreen from "@/screens/WorkoutScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";

function App() {
  return (
    <BrowserRouter basename="/exercise-logger">
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

Note: `basename="/exercise-logger"` matches the GitHub Pages deployment path. During local dev the app is served at `http://localhost:5173/exercise-logger/`.

- [ ] **Step 4: Verify the build succeeds**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Update the unit test for the router**

Update `web/tests/unit/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the Today screen by default", () => {
    // BrowserRouter uses window.location, so set it before rendering
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the unit test**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected: 1 test passes.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: set up React Router with 4 placeholder screens"
```

---

### Task 8: Build the app shell with bottom tab navigation

**Files:**
- Modify: `web/package.json` (lucide-react if not already installed)
- Create: `web/src/components/AppShell.tsx`
- Modify: `web/src/App.tsx` (wrap routes in shell)

The app shell is a mobile-first layout: a scrollable content area above a fixed bottom tab bar. Three tabs (Today, Workout, History) plus a gear icon for Settings. The active tab is highlighted.

- [ ] **Step 1: Verify lucide-react is installed**

shadcn/ui should have installed `lucide-react` in Task 3. Verify:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
node -e "require.resolve('lucide-react'); console.log('OK')"
```

Expected: `OK`. If it prints an error instead, install it:

```bash
npm install lucide-react
```

- [ ] **Step 2: Create the `AppShell` component**

Create `web/src/components/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from "react-router";
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="border-t border-border bg-background" role="navigation" aria-label="Main navigation">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Update `App.tsx` to use the shell layout**

Update `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import AppShell from "@/components/AppShell";
import TodayScreen from "@/screens/TodayScreen";
import WorkoutScreen from "@/screens/WorkoutScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";

function App() {
  return (
    <BrowserRouter basename="/exercise-logger">
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Verify the build**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Run existing tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected: All tests pass (the unit test from Task 7 still works since the Today screen renders inside the AppShell now).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "feat: add mobile-first app shell with bottom tab navigation"
```

---

### Task 9: Write navigation tests

**Files:**
- Modify: `web/tests/unit/App.test.tsx` (add navigation tests)
- Modify: `web/tests/e2e/smoke.spec.ts` (add navigation E2E test)

- [ ] **Step 1: Write unit tests for tab navigation**

Update `web/tests/unit/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the Today screen by default", () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("navigates to Workout screen when Workout tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Workout" }));

    expect(screen.getByText("No active workout. Start one from Today.")).toBeInTheDocument();
  });

  it("navigates to History screen when History tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "History" }));

    expect(screen.getByText("Your workout history will appear here.")).toBeInTheDocument();
  });

  it("navigates to Settings screen when Settings tab is clicked", async () => {
    window.history.pushState({}, "", "/exercise-logger/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(screen.getByText("Routines, preferences, and data management.")).toBeInTheDocument();
  });

  it("renders all four tab links in the navigation bar", () => {
    window.history.pushState({}, "", "/exercise-logger/");
    render(<App />);

    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workout" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the unit tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected:
```
 ✓ tests/unit/App.test.tsx (5)
   ✓ App (5)
     ✓ renders the Today screen by default
     ✓ navigates to Workout screen when Workout tab is clicked
     ✓ navigates to History screen when History tab is clicked
     ✓ navigates to Settings screen when Settings tab is clicked
     ✓ renders all four tab links in the navigation bar

 Test Files  1 passed (1)
 Tests       5 passed (5)
```

- [ ] **Step 3: Write the E2E navigation test**

Update `web/tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("app loads and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Today")).toBeVisible();
});

test("bottom nav has all four tabs", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByText("Today")).toBeVisible();
  await expect(nav.getByText("Workout")).toBeVisible();
  await expect(nav.getByText("History")).toBeVisible();
  await expect(nav.getByText("Settings")).toBeVisible();
});

test("can navigate between all tabs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Workout" }).click();
  await expect(page.getByText("No active workout")).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Your workout history")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Routines, preferences")).toBeVisible();

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("Your daily workout overview")).toBeVisible();
});
```

- [ ] **Step 4: Run the E2E tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build && npx playwright test
```

Expected:
```
  3 passed
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "test: add unit and E2E tests for tab navigation"
```

---

### Task 10: Configure GitHub Actions and SPA routing for GitHub Pages

**Files:**
- Create: `.github/workflows/deploy-web.yml`
- Modify: `web/vite.config.ts` (add `copyIndexTo404` plugin)

The workflow builds the `web/` project and deploys the `web/dist/` output to GitHub Pages. It triggers on pushes to `main` that touch `web/` files. The `base` path (`/exercise-logger/`) was already configured in Task 4.

- [ ] **Step 1: Create the GitHub Actions workflow**

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "web/**"
      - ".github/workflows/deploy-web.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: web/playwright-report/
          retention-days: 7

  deploy:
    name: Deploy
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    defaults:
      run:
        working-directory: web
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create a 404.html for SPA routing on GitHub Pages**

GitHub Pages does not support SPA fallback routing natively. When a user navigates to `/exercise-logger/workout` and refreshes, GitHub Pages returns a 404. The standard workaround is a `404.html` that redirects to `index.html` with the path preserved.

Create a Vite plugin that copies `index.html` to `404.html` after build. Add this to `web/vite.config.ts`. The full file becomes:

```ts
/// <reference types="vitest/config" />
import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

function copyIndexTo404(): Plugin {
  return {
    name: "copy-index-to-404",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const index = path.join(dist, "index.html");
      const notFound = path.join(dist, "404.html");
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, notFound);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/exercise-logger/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Exercise Logger",
        short_name: "ExLog",
        description: "Local-first gym routine tracker",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        scope: "/exercise-logger/",
        start_url: "/exercise-logger/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
    copyIndexTo404(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
```

- [ ] **Step 3: Verify the build produces `404.html`**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
ls dist/404.html
```

Expected: `dist/404.html` exists.

- [ ] **Step 4: Run all tests to verify nothing broke**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test && npm run build && npx playwright test
```

Expected: All unit tests pass, build succeeds, all E2E tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/ .github/workflows/deploy-web.yml
git commit -m "feat: configure GitHub Actions for GitHub Pages deployment"
```

---

### Task 11: Final verification and cleanup

**Files:**
- No new files. This task verifies the full scaffold works end-to-end.

- [ ] **Step 1: Clean build from scratch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
rm -rf node_modules dist
npm install
npm run build
```

Expected: Clean install and build with no errors or warnings (npm peer dependency warnings are acceptable).

- [ ] **Step 2: Verify production build contents**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
ls dist/
ls dist/assets/
ls dist/manifest.webmanifest dist/sw.js dist/404.html
```

Expected:
- `dist/index.html` exists
- `dist/404.html` exists
- `dist/manifest.webmanifest` exists
- `dist/sw.js` exists
- `dist/assets/` contains `.js` and `.css` bundles

- [ ] **Step 3: Run all unit tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test
```

Expected: 5 tests pass (all from `App.test.tsx`).

- [ ] **Step 4: Run all E2E tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx playwright test
```

Expected: 3 tests pass (all from `smoke.spec.ts`).

- [ ] **Step 5: Verify dev server serves the app with tab navigation**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run dev &
DEV_PID=$!
sleep 3
# Check the app serves at the base path
curl -s http://localhost:5173/exercise-logger/ | grep -q "root" && echo "Dev server OK" || echo "Dev server FAILED"
kill $DEV_PID 2>/dev/null
```

Expected: `Dev server OK`.

- [ ] **Step 6: Verify `package.json` has all required scripts**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
node -e "
const pkg = require('./package.json');
const required = ['dev', 'build', 'preview', 'test', 'test:e2e'];
const missing = required.filter(s => !pkg.scripts[s]);
if (missing.length) {
  console.error('Missing scripts:', missing.join(', '));
  process.exit(1);
} else {
  console.log('All required scripts present:', required.join(', '));
}
"
```

Expected: `All required scripts present: dev, build, preview, test, test:e2e`

- [ ] **Step 7: No commit needed — this is verification only**

Phase 1 is complete. The `web/` directory is a fully configured, buildable, testable, deployable app shell with:
- Vite + React + TypeScript
- Tailwind CSS v4
- shadcn/ui initialized
- vite-plugin-pwa with manifest and service worker
- Vitest + React Testing Library (5 unit tests)
- Playwright (3 E2E tests)
- 4 routes with bottom tab navigation
- GitHub Actions workflow for GitHub Pages deployment

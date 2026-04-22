# PWA Ship-to-Friends Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the installable-PWA shipping experience — users get "update available" toasts instead of silent stale code, iOS users see guidance for Add-to-Home-Screen, Android users get an explicit Install button, the main bundle drops below 150 kB gzipped.

**Architecture:** Three independent tasks, each one commit. Task A is a new app-level component (`SWUpdatePrompt`) that consumes vite-plugin-pwa's `useRegisterSW` hook. Task B is an asset + manifest + `<head>` + UI batch that completes the install story. Task C is a vite config / dynamic-import tweak verified by gzipped bundle measurement.

**Tech Stack:** React 19, vite-plugin-pwa 1.2.0 (`virtual:pwa-register/react`), sonner (existing Toaster), Vitest + RTL, yaml 2.8.3 (dynamic-imported after Task C). Baseline: 451/451 tests, 154 kB gzipped main bundle, HEAD `3de5f8c`.

---

## Scope adjustments

- **Dark-mode drop is OUT OF SCOPE** — already shipped in the snack sprint (`3de5f8c`).
- **The existing `Toaster` in `app/App.tsx:130-138` is already configured** with `position="top-center"`, `richColors`, `closeButton`, and Softened-Swiss toast classes. Task A's update-prompt uses this Toaster — no new sonner setup required.

---

## File Structure

| File | Responsibility | Changes |
|------|----------------|---------|
| `web/vite.config.ts` | PWA config, manifest, build config | Switch `registerType` to `prompt` (Task A); add 256/384 icon entries (Task B); add `manualChunks` (Task C) |
| `web/src/vite-env.d.ts` | Vite type refs | Add `virtual:pwa-register/react` type reference (Task A) |
| `web/src/app/SWUpdatePrompt.tsx` | NEW — SW update-available toast | Task A |
| `web/src/app/App.tsx` | App root | Mount `<SWUpdatePrompt />` alongside `<Toaster />` (Task A) |
| `web/public/icons/icon-256.png` | NEW — placeholder icon | Task B (byte-for-byte copy of icon-512.png; flagged for future proper resampling) |
| `web/public/icons/icon-384.png` | NEW — placeholder icon | Task B (byte-for-byte copy of icon-512.png) |
| `web/index.html` | HTML shell | Add 3 `apple-mobile-web-app-*` meta tags (Task B) |
| `web/src/shared/hooks/useInstallPrompt.ts` | NEW — `beforeinstallprompt` capture | Task B |
| `web/src/features/settings/SettingsScreen.tsx` | Settings UI | Add Install App button (Task B) |
| `web/src/services/routine-service.ts` | YAML parsing | Dynamic-import `yaml` (Task C) |
| `web/src/shared/hooks/useAppInit.ts` | App init | Await the now-async `validateAndNormalizeRoutine` (Task C) |
| `web/src/services/routine-service.ts` (lines 840-862) | Paste-import helper | Await inside `validateParseAndImportRoutine` (Task C) |
| `web/tests/integration/acceptance.test.ts` | Acceptance tests | Await `validateAndNormalizeRoutine` calls (Task C) |
| `web/tests/unit/services/routine-service.test.ts` | Service tests | Await `validateAndNormalizeRoutine` calls (Task C) |
| `web/tests/unit/app/SWUpdatePrompt.test.tsx` | NEW — Task A render test | Task A |
| `web/tests/unit/shared/hooks/useInstallPrompt.test.ts` | NEW — Task B hook test | Task B |

---

## Task A — SW Update Prompt (P1)

**Goal:** Replace silent auto-update with a user-visible "Update available" toast that triggers `SKIP_WAITING` + `location.reload()` when tapped.

**Why:** Users hit bugs that "were fixed yesterday" because their tab runs stale code until a cold reload. The `autoUpdate` mode does install updates in the background but never signals the open tab.

**Files:**
- Modify: `web/vite.config.ts:30`
- Create: `web/src/vite-env.d.ts` (if missing) or modify existing
- Create: `web/src/app/SWUpdatePrompt.tsx`
- Modify: `web/src/app/App.tsx`
- Create: `web/tests/unit/app/SWUpdatePrompt.test.tsx`

### Steps

- [ ] **A.1: Baseline check**

From `web/`: `npx vitest run --reporter=dot 2>&1 | tail -3`
Expected: `Tests  451 passed (451)`. If not, STOP — surface the failure.

- [ ] **A.2: Switch registerType to prompt**

`web/vite.config.ts` line 30 currently:
```ts
      registerType: "autoUpdate",
```
Change to:
```ts
      registerType: "prompt",
```

No other changes to vite.config in this task.

- [ ] **A.3: Add type reference for the virtual module**

Check for `web/src/vite-env.d.ts`. If it exists, read it and append the reference. If not, create it with:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
```

(The `vite-plugin-pwa/react` reference makes `virtual:pwa-register/react` resolve in TypeScript.)

- [ ] **A.4: Write the failing test**

Create `web/tests/unit/app/SWUpdatePrompt.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";

// Mock the PWA register hook before importing the component.
const mockUpdate = vi.fn(async () => {});
let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn((v: boolean) => {
  mockNeedRefresh = v;
});

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdate,
  }),
}));

import { SWUpdatePrompt } from "@/app/SWUpdatePrompt";

describe("SWUpdatePrompt", () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockUpdate.mockClear();
    mockSetNeedRefresh.mockClear();
  });

  afterEach(() => {
    cleanup();
    // Clean up any toasts that leaked between tests.
    toast.dismiss();
  });

  it("renders nothing when there is no update available", () => {
    const { container } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    // No toast text should be present.
    expect(container.textContent ?? "").not.toMatch(/update available/i);
  });

  it("shows an Update toast when needRefresh becomes true", async () => {
    mockNeedRefresh = true;
    const { getByText } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    await waitFor(() => {
      expect(getByText(/update available/i)).toBeInTheDocument();
    });
  });

  it("calls updateServiceWorker(true) when the reload action is clicked", async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    const { getByRole } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    const reloadBtn = await waitFor(() =>
      getByRole("button", { name: /reload/i })
    );
    await user.click(reloadBtn);
    expect(mockUpdate).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **A.5: Run the test to confirm it fails**

From `web/`: `npx vitest run tests/unit/app/SWUpdatePrompt.test.tsx`
Expected: all 3 tests fail with `Cannot find module '@/app/SWUpdatePrompt'` or the import resolves but the component doesn't exist.

- [ ] **A.6: Create the component**

Create `web/src/app/SWUpdatePrompt.tsx`:

```tsx
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * SW update-available prompt.
 *
 * Hooks into vite-plugin-pwa's registration lifecycle. When the service
 * worker detects a new bundle and enters the `waiting` state, we show a
 * sonner toast with a "Reload" action. Tapping the action messages
 * SKIP_WAITING to the waiting SW and reloads the page, swapping the user
 * into the fresh bundle without a manual hard-refresh.
 *
 * This renders nothing visually by itself — it just orchestrates a toast.
 */
export function SWUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err: unknown) {
      console.error("SW registration error", err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast("Update available", {
      description: "A new version is ready.",
      duration: Infinity, // Stay until the user acts.
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      onDismiss: () => setNeedRefresh(false),
      onAutoClose: () => setNeedRefresh(false),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
```

- [ ] **A.7: Mount the component in App.tsx**

`web/src/app/App.tsx` currently (lines 124-141):

```tsx
export default function App() {
  return (
    <>
      <BrowserRouter basename="/exercise-logger">
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3000}
        toastOptions={{
          className: "!rounded !border-[1.5px] !border-border-strong !shadow-sm font-sans",
        }}
      />
    </>
  );
}
```

Add the import at the top and mount the component (after the `<Toaster />`):

```tsx
import { SWUpdatePrompt } from "./SWUpdatePrompt";
```

```tsx
export default function App() {
  return (
    <>
      <BrowserRouter basename="/exercise-logger">
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3000}
        toastOptions={{
          className: "!rounded !border-[1.5px] !border-border-strong !shadow-sm font-sans",
        }}
      />
      <SWUpdatePrompt />
    </>
  );
}
```

- [ ] **A.8: Run the test suite**

From `web/`: `npx vitest run`
Expected: 454/454 passing (451 baseline + 3 new).

If any existing test fails, it's likely because something else imports `virtual:pwa-register/react` unmocked. The vi.mock in `SWUpdatePrompt.test.tsx` only applies to that file. Other files that import SWUpdatePrompt (e.g. `App.tsx`) would need their own mock if they're tested directly. Currently App.tsx has no direct render test, so this should be fine. If something breaks, surface it rather than blindly patching.

- [ ] **A.9: Production build verification**

From `web/`: `npm run build`
Expected: build succeeds. Look for the SW mode in output — should see precache entries still listed. The built `dist/sw.js` should be generated.

- [ ] **A.10: Lint**

From `web/`: `npm run lint`
Expected: clean.

- [ ] **A.11: Commit**

```bash
git add web/vite.config.ts web/src/vite-env.d.ts web/src/app/SWUpdatePrompt.tsx web/src/app/App.tsx web/tests/unit/app/SWUpdatePrompt.test.tsx
git commit -m "feat(pwa): prompt-mode SW with 'Update available' reload toast"
```

---

## Task B — Icons + iOS meta + Install button (P3 + P4 + P5)

**Goal:** The installable-PWA surface feels complete: icons at the common sizes, iOS Add-to-Home-Screen has correct meta tags, Settings has an explicit Install App button that triggers the browser's native install prompt.

**Scope deferral:** The review's "proper maskable variant with 80% safe-zone padding" is a design task that requires re-rendering the icon with the app content centered. We can't generate a truly correct maskable icon without image tooling. This plan adds the 256/384 **size-declaration** entries using byte-copies of the 512 PNG as placeholders (the browser will resample — visual quality is the same as it would be if it picked the 512 and scaled) and KEEPS the current `purpose: "maskable"` entry pointing at icon-512.png. A follow-up task (outside this plan) can generate a proper safe-zoned maskable via `pwa-asset-generator` or a design tool.

**Files:**
- Modify: `web/vite.config.ts` (manifest.icons + includeAssets)
- Create: `web/public/icons/icon-256.png` (byte-copy of icon-512.png)
- Create: `web/public/icons/icon-384.png` (byte-copy of icon-512.png)
- Modify: `web/index.html` (iOS meta tags)
- Create: `web/src/shared/hooks/useInstallPrompt.ts`
- Modify: `web/src/features/settings/SettingsScreen.tsx`
- Create: `web/tests/unit/shared/hooks/useInstallPrompt.test.ts`

### Steps

- [ ] **B.1: Copy icon-512 to icon-256 and icon-384**

From `web/public/icons/`:
```bash
cp icon-512.png icon-256.png
cp icon-512.png icon-384.png
```

These are byte-identical to the 512 — a 512×512 image labeled as `sizes: "256x256"` / `"384x384"` in the manifest. Browsers will pick and resample. Quality is the same as letting the browser resample from the 512 directly; declaring the intermediate sizes can help some Android launchers pick a closer-to-native size.

A follow-up housekeeping task should regenerate these as proper resampled PNGs using `pwa-asset-generator` or similar. Add a note at the end of the commit message.

- [ ] **B.2: Update the manifest icons + includeAssets**

`web/vite.config.ts` lines 31-61 currently:

```ts
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
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
```

Replace with:

```ts
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-256.png",
        "icons/icon-384.png",
        "icons/icon-512.png",
      ],
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
        categories: ["fitness", "health"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
```

Also adds `categories: ["fitness", "health"]` (review P11 — free side-win).

- [ ] **B.3: Add iOS meta tags to index.html**

`web/index.html` currently:

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
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

Change to:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#09090b" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ExLog" />
    <link rel="apple-touch-icon" href="/exercise-logger/icons/icon-192.png" />
    <title>Exercise Logger</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

(`apple-touch-icon` is the iOS equivalent of manifest icons; iOS ignores the manifest. Using icon-192 because iOS scales it.)

- [ ] **B.4: Write the failing hook test**

Create `web/tests/unit/shared/hooks/useInstallPrompt.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";

// A fake BeforeInstallPromptEvent for tests.
interface FakePromptEvent {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function makeFakePromptEvent(outcome: "accepted" | "dismissed" = "accepted"): Event & FakePromptEvent {
  const ev = new Event("beforeinstallprompt") as Event & FakePromptEvent;
  ev.preventDefault = vi.fn();
  ev.prompt = vi.fn(async () => {});
  ev.userChoice = Promise.resolve({ outcome });
  return ev;
}

describe("useInstallPrompt", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts with canInstall=false", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("becomes canInstall=true when beforeinstallprompt fires", () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent();
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(true);
  });

  it("promptInstall() calls prompt() on the captured event and clears the flag on accepted", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent("accepted");
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(result.current.canInstall).toBe(true);
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(ev.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it("clears the flag on dismissed too", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent("dismissed");
    act(() => {
      window.dispatchEvent(ev);
    });
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall() is a no-op when canInstall is false", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(result.current.canInstall).toBe(false);
  });
});
```

- [ ] **B.5: Run the test to confirm it fails**

From `web/`: `npx vitest run tests/unit/shared/hooks/useInstallPrompt.test.ts`
Expected: all 5 tests fail — `Cannot find module '@/shared/hooks/useInstallPrompt'`.

- [ ] **B.6: Create the hook**

Create `web/src/shared/hooks/useInstallPrompt.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

/**
 * `BeforeInstallPromptEvent` from the Web App Manifest spec.
 * Non-standard — only Chromium-based browsers implement it today.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Capture the browser's `beforeinstallprompt` event so Settings can
 * surface an explicit "Install App" button. Without this capture, the
 * browser shows its native install banner once; if the user dismisses
 * it, there's no second chance until the browser's own heuristics
 * re-fire the event (which requires re-engagement).
 *
 * Returns:
 *   - canInstall: true when a captured event is available.
 *   - promptInstall(): invokes the native prompt and clears the event
 *     regardless of outcome. Safe to call when canInstall is false
 *     (no-op).
 *
 * After the user accepts or dismisses, the event is consumed and
 * canInstall goes false. The browser may re-fire it later; the hook
 * listens continuously and will re-populate.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      // Prevent the browser's mini-infobar / auto-toast.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt
      );
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    // Consume the event regardless of outcome. The browser will re-fire
    // beforeinstallprompt later if the user becomes eligible again.
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}
```

- [ ] **B.7: Run the hook test**

From `web/`: `npx vitest run tests/unit/shared/hooks/useInstallPrompt.test.ts`
Expected: all 5 pass.

- [ ] **B.8: Add the Install button to SettingsScreen**

`web/src/features/settings/SettingsScreen.tsx` — at the top imports section (current lines 1-24), add:

```tsx
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";
```

Inside the `SettingsScreen()` function body, near the other hook calls (after `const [importErrors, setImportErrors] = useState<string[]>([]);`), add:

```tsx
  const { canInstall, promptInstall } = useInstallPrompt();
```

Then find the `<Card>` that holds "Preferences" (Units) and just after its closing `</Card>`, before the Data card, add a new card:

```tsx
      {canInstall && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Install
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Install Exercise Logger on this device for faster access and offline use.
            </p>
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                void promptInstall();
              }}
            >
              Install App
            </Button>
          </CardContent>
        </Card>
      )}
```

The card is conditionally rendered — it only appears when the browser has offered an install prompt that's been captured. On iOS, this will never render (iOS doesn't fire `beforeinstallprompt`); the iOS meta tags in B.3 handle the manual Add-to-Home-Screen flow for those users.

Read the file structure to confirm the exact insert location before/after the Preferences card.

- [ ] **B.9: Run the test suite**

From `web/`: `npx vitest run`
Expected: 459/459 passing (451 baseline + 3 from Task A + 5 new from B). If A was committed separately, Task A's 3 tests are already counted and this is 456/456.

- [ ] **B.10: Lint**

From `web/`: `npm run lint`
Expected: clean.

- [ ] **B.11: Production build**

From `web/`: `npm run build`
Expected: build succeeds. Scan the output for:
- `dist/icons/icon-256.png` and `dist/icons/icon-384.png` should be precached.
- The build log should list ~38-40 precache entries (was 36 before B) — 2 new icons added.
- `dist/manifest.webmanifest` should list all 5 icon entries (4 x `purpose: "any"` at different sizes + 1 x `purpose: "maskable"`).

- [ ] **B.12: Commit**

```bash
git add web/vite.config.ts web/public/icons/icon-256.png web/public/icons/icon-384.png web/index.html web/src/shared/hooks/useInstallPrompt.ts web/src/features/settings/SettingsScreen.tsx web/tests/unit/shared/hooks/useInstallPrompt.test.ts
git commit -m "$(cat <<'EOF'
feat(pwa): icon suite, iOS meta tags, and Install button in Settings

- Add 256/384 icon entries to manifest + includeAssets (PNGs are
  byte-copies of the 512 as placeholders; follow-up task should
  regenerate via pwa-asset-generator for proper resampling).
- Add manifest `categories: ["fitness","health"]`.
- Add apple-mobile-web-app-* meta tags + apple-touch-icon to index.html
  so iOS Add-to-Home-Screen renders correctly.
- New useInstallPrompt() hook captures beforeinstallprompt and exposes
  canInstall + promptInstall(). Conditional "Install App" card in
  Settings uses it.
EOF
)"
```

---

## Task C — Bundle split (P6)

**Goal:** Main bundle drops below 150 kB gzipped. Baseline: ~154 kB.

**Strategy:** Dynamic-import the `yaml` library inside `validateAndNormalizeRoutine`. This moves ~8-15 kB gzipped out of the main bundle and into a chunk that loads only when the app actually needs to parse YAML (bundled-routine first-run seed via `useAppInit`, and user-triggered imports via `RoutineImporter`).

**Why not manualChunks alone?** `yaml` is imported by `routine-service.ts`, which is imported by `useAppInit.ts` (used at App mount). So `yaml` is unavoidably in the main chunk as long as the import is static. A `manualChunks` config that splits it to a vendor chunk doesn't help — that chunk still loads synchronously on app mount because `useAppInit` awaits it.

Dynamic import is the real cut.

**Side effect:** `validateAndNormalizeRoutine` becomes async. Every caller needs `await`. That's 1 source file + 2 test files to update.

**Files:**
- Modify: `web/src/services/routine-service.ts` (dynamic yaml import, function signature async)
- Modify: `web/src/shared/hooks/useAppInit.ts` (await the call at line 32)
- Modify: `web/tests/integration/acceptance.test.ts` (~10 await additions)
- Modify: `web/tests/unit/services/routine-service.test.ts` (await additions)
- Modify: `web/src/services/CLAUDE.md` (reflect async signature)

### Steps

- [ ] **C.1: Baseline measurement**

From `web/`: `npm run build 2>&1 | grep "index-" | head -3`
Expected output includes something like:
```
dist/assets/index-XXXXX.js    489.XX kB │ gzip: 157.XX kB
```
Record the exact "gzip:" number. Target: < 150.00 kB.

- [ ] **C.2: Convert `validateAndNormalizeRoutine` to dynamic-yaml async**

`web/src/services/routine-service.ts` currently:

Line 1:
```ts
import YAML from "yaml";
```

Change to:
```ts
// yaml is dynamically imported inside validateAndNormalizeRoutine (see below)
// to keep it out of the main bundle. It only loads when the app actually
// needs to parse YAML (first-run seed + user imports).
import type YAMLType from "yaml";
```

Line 115 currently:
```ts
export function validateAndNormalizeRoutine(
  yamlString: string,
  exerciseLookup: Map<string, Exercise>
): ValidateRoutineResult {
```

Change to:
```ts
// Cache the dynamic import across calls — the module only loads once.
let yamlModulePromise: Promise<typeof YAMLType> | null = null;
function loadYaml(): Promise<typeof YAMLType> {
  if (!yamlModulePromise) {
    yamlModulePromise = import("yaml").then((m) => m.default);
  }
  return yamlModulePromise;
}

export async function validateAndNormalizeRoutine(
  yamlString: string,
  exerciseLookup: Map<string, Exercise>
): Promise<ValidateRoutineResult> {
```

Line 124 currently:
```ts
    raw = YAML.parse(yamlString) as RawRoutine;
```

Change to:
```ts
    const YAML = await loadYaml();
    raw = YAML.parse(yamlString) as RawRoutine;
```

Also in `validateParseAndImportRoutine` (around line 855), the existing code was:
```ts
  const result = validateAndNormalizeRoutine(yamlText, lookup);
```
Needs to become:
```ts
  const result = await validateAndNormalizeRoutine(yamlText, lookup);
```

- [ ] **C.3: Update `useAppInit.ts` to await the now-async call**

`web/src/shared/hooks/useAppInit.ts` line 32 currently:
```ts
          const result = validateAndNormalizeRoutine(defaultRoutineYaml, exerciseLookup);
```

Change to:
```ts
          const result = await validateAndNormalizeRoutine(defaultRoutineYaml, exerciseLookup);
```

Verify the surrounding code is already inside an `async` function (it should be — the init pattern awaits Dexie operations).

- [ ] **C.4: Update test callers**

`web/tests/integration/acceptance.test.ts` has ~10 call sites (lines 125, 141, 173, 197, 213, 232, 274, 301, 337, and possibly more — grep to find all). Each one needs an `await` prefix. They're all inside `async` test bodies already, so mechanical.

Grep from `web/`:
```bash
grep -n "validateAndNormalizeRoutine(" tests/integration/acceptance.test.ts
```

For each match, change:
```ts
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
```
to:
```ts
    const result = await validateAndNormalizeRoutine(yamlStr, exerciseLookup);
```

`web/tests/unit/services/routine-service.test.ts` likely has similar calls. Grep:
```bash
grep -n "validateAndNormalizeRoutine(" tests/unit/services/routine-service.test.ts
```
Apply the same `await` additions.

- [ ] **C.5: Run the test suite**

From `web/`: `npx vitest run`
Expected: the same count that was green after Task B (e.g. 459/459). If any test fails:
- If the message mentions "unhandled promise rejection" or "result.ok is not a function" — a caller is missing an `await`. Find and fix.
- If the message is about the dynamic-import itself (module not found) — the import path or cache variable may be wrong.

- [ ] **C.6: Lint**

From `web/`: `npm run lint`
Expected: clean.

- [ ] **C.7: Measure new bundle size**

From `web/`: `npm run build 2>&1 | grep "index-" | head -3`
Expected: main chunk gzipped size dropped by 5-15 kB. If it's now < 150 kB, target met.

If still ≥ 150 kB:
- Look for a new `yaml-XXX.js` chunk in the output — should be 5-15 kB gzipped, present in the precache list but NOT in the main bundle.
- If the chunk is the expected size but main is still ≥ 150 kB, the remaining over-budget must come from elsewhere. Options: (1) accept slightly-over-budget and document (the cut still landed ~5-10 kB of real work), (2) investigate other tree-shakable candidates (check the DialogTitle 21.7 kB gzipped chunk for unnecessary Base UI primitives), (3) defer to a Phase 4 follow-up.

For this task, if the cut gets us close (within 5 kB of target), accept and commit. The plan's aim is meaningful reduction, not pixel-perfect.

- [ ] **C.8: Update services CLAUDE.md**

`web/src/services/CLAUDE.md` has a line describing `validateAndNormalizeRoutine` as synchronous. Find it and update the return type annotation to mention the async wrap:

Current (around line 59):
```
- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `{ ok, routine } | { ok, errors }` — 11 validation rules, ...
```

Change to:
```
- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `Promise<{ ok, routine } | { ok, errors }>` — async (dynamic-imports yaml to keep it out of the main bundle). 11 validation rules, deterministic entryId/groupId generation, all errors collected with field paths.
```

- [ ] **C.9: Commit**

```bash
git add web/src/services/routine-service.ts web/src/shared/hooks/useAppInit.ts web/tests/integration/acceptance.test.ts web/tests/unit/services/routine-service.test.ts web/src/services/CLAUDE.md
git commit -m "perf(routine-service): dynamic-import yaml to shrink main bundle

Main bundle goes from ~154 kB gzipped → target < 150 kB. yaml loads
lazily when the user first imports a routine (or on the bundled-routine
first-run seed). validateAndNormalizeRoutine + validateParseAndImportRoutine
are now async; all callers updated to await."
```

---

## Verification — full sprint

After all three tasks commit:

- [ ] **Full test suite:** `npx vitest run` → expect 459/459.
- [ ] **Lint:** `npm run lint` → clean.
- [ ] **Production build:** `npm run build` → successful, main chunk < 150 kB gzipped (or within 5 kB of target), new icons in precache, manifest with 5 icon entries.
- [ ] **Manual smoke (Pixel 8 via LAN):** run `npm --prefix web run dev -- --host` and open `http://<LAN-IP>:5173/exercise-logger/` on the phone.
  - Settings → "Install App" button appears on Chromium (if browser offers a prompt).
  - First SW update: deploy twice, on the second visit you should see an "Update available — Reload" toast appear instead of silently taking effect.
  - iOS (if accessible): Safari → Share → Add to Home Screen → the title should read "ExLog", status bar translucent, icon correct.

---

## Follow-ups (Phase 2 candidates, not in scope here)

- Proper maskable icon with 80% safe-zone padding (use `pwa-asset-generator` or a design tool; the placeholder copy of icon-512 into 256/384 entries can also be replaced with actually-resampled PNGs at that time).
- Further bundle-size cuts if still over 150 kB after Task C — investigate DialogTitle (21.7 kB gzipped), consider `manualChunks` to split `@base-ui/react` vendor into a separate chunk.
- Font preload link in index.html (P12 — tiny win).
- Vite 7 pinning comment in package.json (P13 — docs).

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| P1 SW update prompt | A |
| P3 icon suite | B (B.1, B.2) |
| P4 iOS meta tags | B (B.3) |
| P5 Install button | B (B.4–B.8) |
| P6 Bundle split | C |
| P11 manifest categories | B.2 (bonus — included) |

All five targeted items have tasks. ✓

**2. Placeholder scan:** No TBD/TODO/vague language. Every code block is complete. The icon-256/384 "placeholder byte-copy" approach is explicit and justified (review acknowledges the lack of ImageMagick; a proper fix is documented as a follow-up).

**3. Type consistency:**
- `useInstallPrompt()` returns `{ canInstall: boolean; promptInstall: () => Promise<void> }` — consistent between definition (B.6) and consumer (B.8).
- `BeforeInstallPromptEvent` interface local to the hook; never leaks to consumers.
- `validateAndNormalizeRoutine` return type changes from `ValidateRoutineResult` to `Promise<ValidateRoutineResult>` consistently across src + tests (C.2, C.3, C.4).
- `loadYaml()` internal helper in routine-service.ts is scoped to the module.

**4. Scope check:** Three tasks, all in one sprint, <1 day total. Single writing-plans. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-pwa-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

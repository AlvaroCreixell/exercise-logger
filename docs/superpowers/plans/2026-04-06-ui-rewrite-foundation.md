# UI Rewrite Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the complete foundation for the UI rewrite: Phase 0 service fixes, design system tokens, shared components, new hooks, and updated app shell. After this plan, all infrastructure is in place for screen implementation (Plan B).

**Architecture:** Fix two TOCTOU races in backup-service, export `getBlockLabel`, remove unused zustand dependency. Add semantic color tokens (success/info/warning) to the CSS design system. Install shadcn/ui components, create shared ConfirmDialog and toast setup. Create four new Dexie hooks for screens that need view-model-level data. Update the app shell with icons and safe-area insets.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind CSS 4, shadcn/ui (base-nova), Dexie.js 4, Vitest, sonner (toast), lucide-react

**Spec:** `docs/superpowers/specs/2026-04-06-ui-rewrite-design.md`

---

### Task 1: Fix TOCTOU on importBackup and clearAllData

**Files:**
- Modify: `web/src/services/backup-service.ts:941-990` (importBackup)
- Modify: `web/src/services/backup-service.ts:1008-1030` (clearAllData)
- Test: `web/tests/unit/services/backup-service.test.ts`

- [ ] **Step 1: Fix importBackup — move active-session guard inside transaction**

In `web/src/services/backup-service.ts`, replace lines 941-985 with:

```typescript
export async function importBackup(
  db: ExerciseLoggerDB,
  envelope: BackupEnvelope
): Promise<{ hasActiveSession: boolean }> {
  const { routines, sessions, sessionExercises, loggedSets, settings } =
    envelope.data;

  // All-or-nothing transactional overwrite (invariant 12)
  // Active-session guard is INSIDE the transaction to prevent TOCTOU races
  // across tabs (matches pattern in settings-service.ts).
  await db.transaction(
    "rw",
    [db.routines, db.sessions, db.sessionExercises, db.loggedSets, db.settings],
    async () => {
      const localActiveCount = await db.sessions
        .where("status")
        .equals("active")
        .count();
      if (localActiveCount > 0) {
        throw new Error(
          "Cannot import while a workout session is active. Finish or discard the session first."
        );
      }

      // Clear existing user data
      await db.routines.clear();
      await db.sessions.clear();
      await db.sessionExercises.clear();
      await db.loggedSets.clear();

      // Write imported data
      if (routines.length > 0) {
        await db.routines.bulkAdd(routines);
      }
      if (sessions.length > 0) {
        await db.sessions.bulkAdd(sessions);
      }
      if (sessionExercises.length > 0) {
        await db.sessionExercises.bulkAdd(sessionExercises);
      }
      if (loggedSets.length > 0) {
        await db.loggedSets.bulkAdd(loggedSets);
      }
      await db.settings.put(settings);
    }
  );

  // ERRATA P7-F: Return whether the imported data has an active session
  const importedActiveSession = sessions.some((s) => s.status === "active");
  return { hasActiveSession: importedActiveSession };
}
```

- [ ] **Step 2: Fix clearAllData — move active-session guard inside transaction**

In `web/src/services/backup-service.ts`, replace lines 1008-1030 with:

```typescript
export async function clearAllData(db: ExerciseLoggerDB): Promise<void> {
  // Active-session guard is INSIDE the transaction to prevent TOCTOU races
  // across tabs (matches pattern in settings-service.ts).
  await db.transaction(
    "rw",
    [db.routines, db.sessions, db.sessionExercises, db.loggedSets, db.settings],
    async () => {
      const activeCount = await db.sessions
        .where("status")
        .equals("active")
        .count();
      if (activeCount > 0) {
        throw new Error(
          "Cannot clear data while a workout session is active. Finish or discard the session first."
        );
      }

      await db.routines.clear();
      await db.sessions.clear();
      await db.sessionExercises.clear();
      await db.loggedSets.clear();
      await db.settings.put({ ...DEFAULT_SETTINGS });
    }
  );
}
```

- [ ] **Step 3: Run existing backup-service tests**

```bash
cd web && npx vitest run tests/unit/services/backup-service.test.ts
```

Expected: All tests pass. The active-session blocking behavior is unchanged — only the race safety is improved.

- [ ] **Step 4: Commit**

```bash
cd web && git add src/services/backup-service.ts && cd .. && git commit -m "$(cat <<'EOF'
fix: move active-session guard inside transaction for importBackup/clearAllData

Prevents TOCTOU race where another tab could start a workout
between the pre-check and the destructive write. Guard now runs
inside the same Dexie transaction, matching the pattern already
used by setActiveRoutine and deleteRoutine in settings-service.
EOF
)"
```

---

### Task 2: Export getBlockLabel from progression-service

**Files:**
- Modify: `web/src/services/progression-service.ts:347`
- Test: `web/tests/unit/services/progression-service.test.ts`

- [ ] **Step 1: Add export keyword to getBlockLabel**

In `web/src/services/progression-service.ts`, change line 347:

```typescript
// OLD
function getBlockLabel(

// NEW
export function getBlockLabel(
```

- [ ] **Step 2: Run existing progression-service tests**

```bash
cd web && npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All tests pass. Adding `export` doesn't change behavior.

- [ ] **Step 3: Commit**

```bash
cd web && git add src/services/progression-service.ts && cd .. && git commit -m "$(cat <<'EOF'
feat: export getBlockLabel from progression-service

UI components need this to render block labels (Top, AMRAP,
Back-off) on exercise cards. Was previously private.
EOF
)"
```

---

### Task 3: Remove zustand dependency

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Verify zustand is not imported anywhere**

```bash
cd web && grep -r "zustand" src/ --include="*.ts" --include="*.tsx" | head -5
```

Expected: No matches (timer store was deleted in the restructure).

- [ ] **Step 2: Uninstall zustand**

```bash
cd web && npm uninstall zustand
```

- [ ] **Step 3: Verify tests still pass**

```bash
cd web && npm test
```

Expected: All 342 tests pass.

- [ ] **Step 4: Commit**

```bash
cd web && git add package.json package-lock.json && cd .. && git commit -m "$(cat <<'EOF'
chore: remove zustand dependency

Timer store was deleted during UI restructure. No code imports
zustand anymore.
EOF
)"
```

---

### Task 4: Add semantic color tokens to design system

**Files:**
- Modify: `web/src/app/App.css`

- [ ] **Step 1: Add semantic color CSS variables to @theme inline**

In `web/src/app/App.css`, inside the `@theme inline { ... }` block, add these lines after the existing `--color-destructive` line:

```css
    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-success-soft: var(--success-soft);
    --color-info: var(--info);
    --color-info-foreground: var(--info-foreground);
    --color-info-soft: var(--info-soft);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --color-warning-soft: var(--warning-soft);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-destructive-soft: var(--destructive-soft);
```

- [ ] **Step 2: Add light mode token values to :root**

In `web/src/app/App.css`, inside the `:root { ... }` block, add after the `--ring` line:

```css
    --success: oklch(0.65 0.17 145);
    --success-foreground: oklch(0.98 0 0);
    --success-soft: oklch(0.95 0.05 145);
    --info: oklch(0.65 0.15 195);
    --info-foreground: oklch(0.98 0 0);
    --info-soft: oklch(0.95 0.05 195);
    --warning: oklch(0.75 0.15 85);
    --warning-foreground: oklch(0.15 0 0);
    --warning-soft: oklch(0.95 0.05 85);
    --destructive-foreground: oklch(0.98 0 0);
    --destructive-soft: oklch(0.95 0.05 27);
```

- [ ] **Step 3: Add dark mode token values to .dark**

In `web/src/app/App.css`, inside the `.dark { ... }` block, add after the `--ring` line:

```css
    --success: oklch(0.75 0.17 145);
    --success-foreground: oklch(0.15 0 0);
    --success-soft: oklch(0.25 0.08 145);
    --info: oklch(0.75 0.15 195);
    --info-foreground: oklch(0.15 0 0);
    --info-soft: oklch(0.25 0.08 195);
    --warning: oklch(0.80 0.15 85);
    --warning-foreground: oklch(0.15 0 0);
    --warning-soft: oklch(0.30 0.08 85);
    --destructive-foreground: oklch(0.98 0 0);
    --destructive-soft: oklch(0.25 0.08 27);
```

- [ ] **Step 4: Verify build still works**

```bash
cd web && npm run build
```

Expected: Clean build. Tailwind picks up the new tokens automatically via `@theme inline`.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/app/App.css && cd .. && git commit -m "$(cat <<'EOF'
feat: add semantic color tokens (success, info, warning) to design system

Four color families with -foreground and -soft variants for
consistent component usage. oklch values for both light and
dark modes. Extends existing shadcn neutral palette.
EOF
)"
```

---

### Task 5: Install shadcn/ui components

**Files:**
- Create: `web/src/shared/ui/button.tsx` (and 8 more)
- Modify: `web/components.json` (already configured)

- [ ] **Step 1: Install all required shadcn components**

Run each command. They install to `src/shared/ui/` per the updated `components.json` aliases.

```bash
cd web && npx shadcn@latest add button card dialog sheet input badge tabs separator scroll-area label
```

If prompted for overwrite, accept. These are fresh installs (old ui/ was deleted).

- [ ] **Step 2: Verify components were installed to correct path**

```bash
cd web && ls src/shared/ui/
```

Expected: `button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `input.tsx`, `badge.tsx`, `tabs.tsx`, `separator.tsx`, `scroll-area.tsx`, `label.tsx`

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
cd web && git add src/shared/ui/ && cd .. && git commit -m "$(cat <<'EOF'
feat: install shadcn/ui components for UI rewrite

button, card, dialog, sheet, input, badge, tabs, separator,
scroll-area, label — installed to shared/ui/ per components.json.
EOF
)"
```

---

### Task 6: Install sonner and create toast setup

**Files:**
- Modify: `web/package.json` (via npm install)
- Modify: `web/src/app/App.tsx`

- [ ] **Step 1: Install sonner**

```bash
cd web && npm install sonner
```

- [ ] **Step 2: Add Toaster to App.tsx**

In `web/src/app/App.tsx`, add the import at the top (after the react-router import):

```typescript
import { Toaster } from "sonner";
```

Then in the `App` function, add `<Toaster />` as a sibling of `BrowserRouter`:

```tsx
export default function App() {
  return (
    <>
      <BrowserRouter basename="/exercise-logger">
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton duration={3000} />
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
cd web && git add package.json package-lock.json src/app/App.tsx && cd .. && git commit -m "$(cat <<'EOF'
feat: add sonner toast provider

Configured in App.tsx for low-frequency notifications: routine
imported, workout finished, backup operations. Not used for
per-set logging.
EOF
)"
```

---

### Task 7: Create shared ConfirmDialog component

**Files:**
- Create: `web/src/shared/components/ConfirmDialog.tsx`
- Test: `web/tests/unit/shared/components/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write the test**

Create `web/tests/unit/shared/components/ConfirmDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title and description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete routine?"
        description="This cannot be undone."
        confirmText="Delete"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText("Delete routine?")).toBeVisible();
    expect(screen.getByText("This cannot be undone.")).toBeVisible();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Finish?"
        description="Are you sure?"
        confirmText="Finish"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders destructive variant with correct styling", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Discard?"
        description="All data will be lost."
        confirmText="Discard"
        onConfirm={() => {}}
        variant="destructive"
      />
    );
    const btn = screen.getByRole("button", { name: "Discard" });
    expect(btn).toBeVisible();
  });

  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Hidden"
        description="Should not appear"
        confirmText="OK"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run tests/unit/shared/components/ConfirmDialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ConfirmDialog**

Create `web/src/shared/components/ConfirmDialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Remove .gitkeep from shared/components/**

```bash
cd web && rm -f src/shared/components/.gitkeep
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npx vitest run tests/unit/shared/components/ConfirmDialog.test.tsx
```

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/shared/components/ConfirmDialog.tsx tests/unit/shared/components/ && cd .. && git commit -m "$(cat <<'EOF'
feat: add shared ConfirmDialog component

Reusable confirmation dialog with default and destructive variants.
Used by finish/discard workout, delete routine, clear data flows.
EOF
)"
```

---

### Task 8: Create useFinishedSessions and useLastSession hooks

**Files:**
- Create: `web/src/shared/hooks/useFinishedSessions.ts`
- Create: `web/src/shared/hooks/useLastSession.ts`
- Test: `web/tests/unit/shared/hooks/useFinishedSessions.test.ts`
- Test: `web/tests/unit/shared/hooks/useLastSession.test.ts`

- [ ] **Step 1: Write useFinishedSessions test**

Create `web/tests/unit/shared/hooks/useFinishedSessions.test.ts`:

```typescript
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import { useFinishedSessions } from "@/shared/hooks/useFinishedSessions";

let db: ExerciseLoggerDB;

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
});

afterEach(async () => {
  await db.delete();
});

describe("useFinishedSessions", () => {
  it("returns empty array when no finished sessions", async () => {
    const { result } = renderHook(() => useFinishedSessions());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual([]);
  });

  it("returns finished sessions sorted by startedAt desc", async () => {
    await db.sessions.bulkAdd([
      {
        id: "s1",
        routineId: "r1",
        routineNameSnapshot: "Routine",
        dayId: "A",
        dayLabelSnapshot: "Push",
        dayOrderSnapshot: ["A"],
        restDefaultSecSnapshot: 90,
        restSupersetSecSnapshot: 60,
        status: "finished",
        startedAt: "2026-04-01T10:00:00Z",
        finishedAt: "2026-04-01T11:00:00Z",
      },
      {
        id: "s2",
        routineId: "r1",
        routineNameSnapshot: "Routine",
        dayId: "B",
        dayLabelSnapshot: "Pull",
        dayOrderSnapshot: ["A", "B"],
        restDefaultSecSnapshot: 90,
        restSupersetSecSnapshot: 60,
        status: "finished",
        startedAt: "2026-04-03T10:00:00Z",
        finishedAt: "2026-04-03T11:00:00Z",
      },
      {
        id: "s3",
        routineId: "r1",
        routineNameSnapshot: "Routine",
        dayId: "A",
        dayLabelSnapshot: "Push",
        dayOrderSnapshot: ["A"],
        restDefaultSecSnapshot: 90,
        restSupersetSecSnapshot: 60,
        status: "active",
        startedAt: "2026-04-05T10:00:00Z",
        finishedAt: null,
      },
    ]);

    const { result } = renderHook(() => useFinishedSessions());
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current!.length).toBe(2);
    });
    expect(result.current![0]!.id).toBe("s2");
    expect(result.current![1]!.id).toBe("s1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useFinishedSessions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useFinishedSessions**

Create `web/src/shared/hooks/useFinishedSessions.ts`:

```typescript
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session } from "@/domain/types";

/**
 * Reactively load all finished sessions, sorted by startedAt descending.
 * Returns undefined while loading.
 */
export function useFinishedSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions
      .where("status")
      .equals("finished")
      .toArray();
    return sessions.sort(
      (a, b) => b.startedAt.localeCompare(a.startedAt)
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useFinishedSessions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write useLastSession test**

Create `web/tests/unit/shared/hooks/useLastSession.test.ts`:

```typescript
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import { useLastSession } from "@/shared/hooks/useLastSession";

let db: ExerciseLoggerDB;

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
});

afterEach(async () => {
  await db.delete();
});

describe("useLastSession", () => {
  it("returns null when no finished sessions for routine", async () => {
    const { result } = renderHook(() => useLastSession("r1"));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBeNull();
  });

  it("returns null when routineId is null", async () => {
    const { result } = renderHook(() => useLastSession(null));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBeNull();
  });

  it("returns the most recent finished session for a routine", async () => {
    await db.sessions.bulkAdd([
      {
        id: "s1",
        routineId: "r1",
        routineNameSnapshot: "Routine",
        dayId: "A",
        dayLabelSnapshot: "Push",
        dayOrderSnapshot: ["A"],
        restDefaultSecSnapshot: 90,
        restSupersetSecSnapshot: 60,
        status: "finished",
        startedAt: "2026-04-01T10:00:00Z",
        finishedAt: "2026-04-01T11:00:00Z",
      },
      {
        id: "s2",
        routineId: "r1",
        routineNameSnapshot: "Routine",
        dayId: "B",
        dayLabelSnapshot: "Pull",
        dayOrderSnapshot: ["A", "B"],
        restDefaultSecSnapshot: 90,
        restSupersetSecSnapshot: 60,
        status: "finished",
        startedAt: "2026-04-03T10:00:00Z",
        finishedAt: "2026-04-03T11:00:00Z",
      },
    ]);

    const { result } = renderHook(() => useLastSession("r1"));
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).not.toBeNull();
    });
    expect(result.current!.id).toBe("s2");
  });
});
```

- [ ] **Step 6: Implement useLastSession**

Create `web/src/shared/hooks/useLastSession.ts`:

```typescript
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session } from "@/domain/types";

/**
 * Reactively load the most recent finished session for a routine.
 * Returns null if no finished sessions exist. Returns undefined while loading.
 */
export function useLastSession(
  routineId: string | null | undefined
): Session | null | undefined {
  return useLiveQuery(
    async () => {
      if (!routineId) return null;
      const sessions = await db.sessions
        .where("[routineId+startedAt]")
        .between([routineId, ""], [routineId, "\uffff"])
        .reverse()
        .toArray();
      const finished = sessions.find((s) => s.status === "finished");
      return finished ?? null;
    },
    [routineId]
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useLastSession.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd web && git add src/shared/hooks/useFinishedSessions.ts src/shared/hooks/useLastSession.ts tests/unit/shared/hooks/ && cd .. && git commit -m "$(cat <<'EOF'
feat: add useFinishedSessions and useLastSession hooks

useFinishedSessions returns all finished sessions sorted desc.
useLastSession returns the most recent finished session for a
given routine. Both use useLiveQuery for reactive updates.
EOF
)"
```

---

### Task 9: Create useSessionDetail hook

**Files:**
- Create: `web/src/shared/hooks/useSessionDetail.ts`
- Test: `web/tests/unit/shared/hooks/useSessionDetail.test.ts`

- [ ] **Step 1: Write the test**

Create `web/tests/unit/shared/hooks/useSessionDetail.test.ts`:

```typescript
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";

let db: ExerciseLoggerDB;

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
});

afterEach(async () => {
  await db.delete();
});

describe("useSessionDetail", () => {
  it("returns null for non-existent session ID", async () => {
    const { result } = renderHook(() => useSessionDetail("nonexistent"));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBeNull();
  });

  it("returns null when sessionId is undefined", async () => {
    const { result } = renderHook(() => useSessionDetail(undefined));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBeNull();
  });

  it("returns session with exercises and sets", async () => {
    await db.sessions.add({
      id: "s1",
      routineId: "r1",
      routineNameSnapshot: "My Routine",
      dayId: "A",
      dayLabelSnapshot: "Push",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-04-01T10:00:00Z",
      finishedAt: "2026-04-01T11:00:00Z",
    });
    await db.sessionExercises.add({
      id: "se1",
      sessionId: "s1",
      routineEntryId: "e1",
      exerciseId: "barbell-bench-press",
      exerciseNameSnapshot: "Barbell Bench Press",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: "weight",
      effectiveEquipment: "barbell",
      notesSnapshot: null,
      setBlocksSnapshot: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
      createdAt: "2026-04-01T10:00:00Z",
    });
    await db.loggedSets.add({
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-bench-press",
      instanceLabel: "",
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:8-12:count3:tagnormal",
      setIndex: 0,
      tag: null,
      performedWeightKg: 80,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-04-01T10:05:00Z",
      updatedAt: "2026-04-01T10:05:00Z",
    });

    const { result } = renderHook(() => useSessionDetail("s1"));
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).not.toBeNull();
    });
    expect(result.current!.session.routineNameSnapshot).toBe("My Routine");
    expect(result.current!.sessionExercises).toHaveLength(1);
    expect(result.current!.loggedSets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useSessionDetail.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useSessionDetail**

Create `web/src/shared/hooks/useSessionDetail.ts`:

```typescript
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

export interface SessionDetailData {
  session: Session;
  sessionExercises: SessionExercise[];
  loggedSets: LoggedSet[];
}

/**
 * Reactively load a session with all its exercises and logged sets.
 * Returns null if session not found. Returns undefined while loading.
 */
export function useSessionDetail(
  sessionId: string | undefined
): SessionDetailData | null | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionId) return null;

      const session = await db.sessions.get(sessionId);
      if (!session) return null;

      const sessionExercises = await db.sessionExercises
        .where("sessionId")
        .equals(sessionId)
        .sortBy("orderIndex");

      const loggedSets = await db.loggedSets
        .where("sessionId")
        .equals(sessionId)
        .toArray();

      return { session, sessionExercises, loggedSets };
    },
    [sessionId]
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useSessionDetail.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/shared/hooks/useSessionDetail.ts tests/unit/shared/hooks/useSessionDetail.test.ts && cd .. && git commit -m "$(cat <<'EOF'
feat: add useSessionDetail hook

Returns session record + exercises + sets for SessionDetailScreen.
Handles invalid session IDs by returning null.
EOF
)"
```

---

### Task 10: Create useExerciseHistoryGroups hook

**Files:**
- Create: `web/src/shared/hooks/useExerciseHistoryGroups.ts`
- Test: `web/tests/unit/shared/hooks/useExerciseHistoryGroups.test.ts`

- [ ] **Step 1: Write the test**

Create `web/tests/unit/shared/hooks/useExerciseHistoryGroups.test.ts`:

```typescript
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import { useExerciseHistoryGroups } from "@/shared/hooks/useExerciseHistoryGroups";

let db: ExerciseLoggerDB;

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
});

afterEach(async () => {
  await db.delete();
});

describe("useExerciseHistoryGroups", () => {
  it("returns empty array when no sets exist for exercise", async () => {
    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-bench-press")
    );
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual([]);
  });

  it("returns null when exerciseId is undefined", async () => {
    const { result } = renderHook(() => useExerciseHistoryGroups(undefined));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toBeNull();
  });

  it("groups sets by session with context, excludes active sessions", async () => {
    // Finished session
    await db.sessions.add({
      id: "s1",
      routineId: "r1",
      routineNameSnapshot: "My Routine",
      dayId: "A",
      dayLabelSnapshot: "Push",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-04-01T10:00:00Z",
      finishedAt: "2026-04-01T11:00:00Z",
    });
    await db.sessionExercises.add({
      id: "se1",
      sessionId: "s1",
      routineEntryId: "e1",
      exerciseId: "barbell-bench-press",
      exerciseNameSnapshot: "Barbell Bench Press",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: "weight",
      effectiveEquipment: "barbell",
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: "2026-04-01T10:00:00Z",
    });
    await db.loggedSets.add({
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-bench-press",
      instanceLabel: "",
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:8-12:count3:tagnormal",
      setIndex: 0,
      tag: null,
      performedWeightKg: 80,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-04-01T10:05:00Z",
      updatedAt: "2026-04-01T10:05:00Z",
    });

    // Active session (should be excluded)
    await db.sessions.add({
      id: "s2",
      routineId: "r1",
      routineNameSnapshot: "My Routine",
      dayId: "A",
      dayLabelSnapshot: "Push",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "active",
      startedAt: "2026-04-05T10:00:00Z",
      finishedAt: null,
    });

    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-bench-press")
    );
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current!.length).toBe(1);
    });
    const group = result.current![0]!;
    expect(group.session.id).toBe("s1");
    expect(group.session.routineNameSnapshot).toBe("My Routine");
    expect(group.sets).toHaveLength(1);
    expect(group.effectiveEquipment).toBe("barbell");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useExerciseHistoryGroups.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useExerciseHistoryGroups**

Create `web/src/shared/hooks/useExerciseHistoryGroups.ts`:

```typescript
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Session, LoggedSet } from "@/domain/types";
import type { ExerciseEquipment } from "@/domain/enums";

export interface ExerciseHistoryGroup {
  session: Pick<
    Session,
    "id" | "dayLabelSnapshot" | "routineNameSnapshot" | "startedAt"
  >;
  instanceLabel: string;
  effectiveEquipment: ExerciseEquipment;
  sets: LoggedSet[];
}

/**
 * Reactively load all logged sets for an exercise across finished sessions,
 * grouped by session with context from sessionExercises and sessions tables.
 * Returns null if exerciseId is undefined. Returns undefined while loading.
 */
export function useExerciseHistoryGroups(
  exerciseId: string | undefined
): ExerciseHistoryGroup[] | null | undefined {
  return useLiveQuery(
    async () => {
      if (!exerciseId) return null;

      // Get all logged sets for this exercise, sorted by loggedAt desc
      const allSets = await db.loggedSets
        .where("exerciseId")
        .equals(exerciseId)
        .toArray();

      if (allSets.length === 0) return [];

      // Collect unique session IDs and sessionExercise IDs
      const sessionIds = new Set(allSets.map((s) => s.sessionId));
      const seIds = new Set(allSets.map((s) => s.sessionExerciseId));

      // Batch-load sessions (filter to finished only)
      const sessions = await db.sessions.bulkGet([...sessionIds]);
      const finishedSessions = new Map<string, Session>();
      for (const s of sessions) {
        if (s && s.status === "finished") {
          finishedSessions.set(s.id, s);
        }
      }

      // Batch-load sessionExercises for effectiveEquipment and instanceLabel
      const sessionExercises = await db.sessionExercises.bulkGet([...seIds]);
      const seMap = new Map<string, { instanceLabel: string; effectiveEquipment: ExerciseEquipment }>();
      for (const se of sessionExercises) {
        if (se) {
          seMap.set(se.id, {
            instanceLabel: se.instanceLabel,
            effectiveEquipment: se.effectiveEquipment,
          });
        }
      }

      // Group sets by session, only from finished sessions
      const groupMap = new Map<string, { sets: LoggedSet[]; seId: string }>();
      for (const ls of allSets) {
        if (!finishedSessions.has(ls.sessionId)) continue;
        const existing = groupMap.get(ls.sessionId);
        if (existing) {
          existing.sets.push(ls);
        } else {
          groupMap.set(ls.sessionId, { sets: [ls], seId: ls.sessionExerciseId });
        }
      }

      // Build result sorted by session date desc
      const groups: ExerciseHistoryGroup[] = [];
      for (const [sessionId, { sets, seId }] of groupMap) {
        const session = finishedSessions.get(sessionId)!;
        const seData = seMap.get(seId);
        groups.push({
          session: {
            id: session.id,
            dayLabelSnapshot: session.dayLabelSnapshot,
            routineNameSnapshot: session.routineNameSnapshot,
            startedAt: session.startedAt,
          },
          instanceLabel: seData?.instanceLabel ?? "",
          effectiveEquipment: seData?.effectiveEquipment ?? "bodyweight",
          sets: sets.sort((a, b) => {
            if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
            return a.setIndex - b.setIndex;
          }),
        });
      }

      return groups.sort((a, b) =>
        b.session.startedAt.localeCompare(a.session.startedAt)
      );
    },
    [exerciseId]
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/unit/shared/hooks/useExerciseHistoryGroups.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/shared/hooks/useExerciseHistoryGroups.ts tests/unit/shared/hooks/useExerciseHistoryGroups.test.ts && cd .. && git commit -m "$(cat <<'EOF'
feat: add useExerciseHistoryGroups hook

Three-table join (loggedSets -> sessionExercises -> sessions) for
ExerciseHistoryScreen. Groups by session with effectiveEquipment,
instanceLabel, and session context. Only finished sessions.
EOF
)"
```

---

### Task 11: Update App shell with icons and safe-area insets

**Files:**
- Modify: `web/src/app/App.tsx`

- [ ] **Step 1: Add lucide icons and safe-area to App.tsx**

In `web/src/app/App.tsx`, add the lucide import at the top:

```typescript
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";
```

Update the `tabs` array to include icons:

```typescript
const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
```

Update the Shell component's nav to use icons and safe-area:

```tsx
function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav
        className="border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
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

Note: removed `p-4` from `<main>` — each screen manages its own padding.

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

Expected: Clean build.

- [ ] **Step 3: Run all tests**

```bash
cd web && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Run lint**

```bash
cd web && npm run lint
```

Expected: Clean.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/app/App.tsx && cd .. && git commit -m "$(cat <<'EOF'
feat: add icons and safe-area insets to app shell

lucide-react icons on nav tabs. Safe-area bottom padding for
notch/gesture bar. Screen padding moved to individual screens.
EOF
)"
```

---

## Verification

After all 11 tasks, run the full verification suite:

```bash
cd web && npx tsc -b && npm run lint && npm test && npm run build
```

Expected:
- TypeScript: clean
- Lint: clean
- Tests: all pass (original 342 + new hook tests)
- Build: clean

## What comes next

**Plan B: Screen Implementation** — A separate plan that builds all 6 screens on top of this foundation. Each screen is a self-contained task using the hooks, components, and design tokens established here. Plan B should invoke the `frontend-design` skill for component-level visual quality.

Screens to implement (suggested order):
1. SettingsScreen (enables importing routines for testing other screens)
2. TodayScreen (depends on imported routine)
3. WorkoutScreen + ExerciseCard + SetSlot + SetLogSheet + SupersetGroup + WorkoutFooter + ExercisePicker
4. HistoryScreen + SessionCard
5. SessionDetailScreen
6. ExerciseHistoryScreen
7. E2E test updates

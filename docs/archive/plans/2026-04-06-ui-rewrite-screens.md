# UI Rewrite Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 6 screens and 18 components for the Exercise Logger UI rewrite, replacing placeholder routes with fully functional screens.

**Architecture:** Each screen lives in its feature folder (`features/{today,workout,history,settings}/`). Screens compose feature-specific components and shared primitives from `shared/ui/` and `shared/components/`. All data flows through existing hooks and services -- no business logic in components. The workout flow is the primary optimization target: 44px tap targets, tabular-nums on all values, semantic colors for progress feedback.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui (base-nova), Dexie.js 4 via useLiveQuery hooks, lucide-react icons, sonner toasts, react-router 7

**Spec:** `docs/superpowers/specs/2026-04-06-ui-rewrite-design.md`
**Foundation plan:** `docs/superpowers/plans/2026-04-06-ui-rewrite-foundation.md` (completed)

**Design direction:** Polished neutral. shadcn base with 4 semantic color families (success/info/warning/destructive). Geist Variable font. The memorable interaction is set logging -- muted slot transforms to green with checkmark on each logged set, visually coloring in your workout as you progress.

---

## File Map

```
features/settings/
  SettingsScreen.tsx      # Three-section settings page
  RoutineList.tsx         # Routine rows with activate/delete
  RoutineImporter.tsx     # YAML file picker + validation errors

features/today/
  TodayScreen.tsx         # Three states: no routine, preview, resume
  DaySelector.tsx         # Horizontal scrollable day pills
  DayPreview.tsx          # Compact exercise list for selected day
  LastSessionCard.tsx     # Most recent finished session summary

features/workout/
  WorkoutScreen.tsx       # Active workout orchestrator
  ExerciseCard.tsx        # Exercise name + blocks + slots + history
  SetSlot.tsx             # Individual set tap target
  SetLogSheet.tsx         # Bottom sheet for logging/editing sets
  SupersetGroup.tsx       # Visual wrapper for superset pairs
  ExercisePicker.tsx      # Full-height sheet with muscle group tabs
  WorkoutFooter.tsx       # Sticky bottom: Add/Finish/Discard

features/history/
  HistoryScreen.tsx       # Finished session list
  SessionCard.tsx         # Single session summary card
  SessionDetailScreen.tsx # Read-only session with editable sets
  ExerciseHistoryScreen.tsx # Cross-session exercise history

app/App.tsx               # Update routes to import real screens
```

## Task Order and Rationale

1. **Settings** first -- enables importing routines so all other screens can be tested with real data
2. **Today** second -- shows the routine and starts sessions
3. **Workout components** (SetSlot, ExerciseCard, SetLogSheet) -- the core logging primitives
4. **Workout assembly** (SupersetGroup, ExercisePicker, WorkoutFooter, WorkoutScreen) -- assembles the workout
5. **History** -- session list and detail
6. **Exercise History** -- cross-session drill-down
7. **Route wiring** -- connect everything in App.tsx

---

### Task 1: Settings Screen

**Files:**
- Create: `web/src/features/settings/RoutineImporter.tsx`
- Create: `web/src/features/settings/RoutineList.tsx`
- Create: `web/src/features/settings/SettingsScreen.tsx`
- Remove: `web/src/features/settings/.gitkeep`

- [ ] **Step 1: Create RoutineImporter**

Create `web/src/features/settings/RoutineImporter.tsx`:

```tsx
import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import { toast } from "sonner";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setImporting(true);

    try {
      const yaml = await file.text();

      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));

      const result = validateAndNormalizeRoutine(yaml, lookup);

      if (!result.ok) {
        setErrors(result.errors.map((err) => `${err.path}: ${err.message}`));
        return;
      }

      await importRoutine(db, result.routine);
      toast.success(`Routine "${result.routine.name}" imported`);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? "Importing..." : "Import Routine"}
      </Button>
      {errors.length > 0 && (
        <div className="rounded-lg border border-warning bg-warning-soft p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-warning-foreground">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create RoutineList**

Create `web/src/features/settings/RoutineList.tsx`:

```tsx
import { useState } from "react";
import type { Routine } from "@/domain/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { db } from "@/db/database";
import { setActiveRoutine, deleteRoutine } from "@/services/settings-service";
import { toast } from "sonner";

interface RoutineListProps {
  routines: Routine[];
  activeRoutineId: string | null;
  hasActiveSession: boolean;
}

export function RoutineList({
  routines,
  activeRoutineId,
  hasActiveSession,
}: RoutineListProps) {
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);

  async function handleActivate(routineId: string) {
    await setActiveRoutine(db, routineId);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRoutine(db, deleteTarget.id);
    toast.success("Routine deleted");
    setDeleteTarget(null);
  }

  if (routines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No routines imported yet.</p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {routines.map((routine) => {
          const isActive = routine.id === activeRoutineId;
          return (
            <div
              key={routine.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {routine.name}
                </span>
                {isActive && (
                  <Badge variant="secondary" className="bg-info-soft text-info shrink-0">
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={hasActiveSession}
                    onClick={() => handleActivate(routine.id)}
                  >
                    Set as active routine
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={hasActiveSession}
                  onClick={() => setDeleteTarget(routine)}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {hasActiveSession && (
          <p className="text-xs text-warning">
            Finish or discard your current workout first.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete routine?"
        description={
          deleteTarget?.id === activeRoutineId
            ? "This routine will be deleted. Your next routine will be automatically activated."
            : "This routine will be permanently deleted."
        }
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 3: Create SettingsScreen**

Create `web/src/features/settings/SettingsScreen.tsx`:

```tsx
import { useSettings } from "@/shared/hooks/useSettings";
import { useAllRoutines } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { db } from "@/db/database";
import { setUnits, setTheme } from "@/services/settings-service";
import {
  exportBackup,
  downloadBackupFile,
  importBackup,
  clearAllData,
  readJsonFile,
  validateBackupPayload,
  type BackupEnvelope,
} from "@/services/backup-service";
import type { UnitSystem, ThemePreference } from "@/domain/enums";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { RoutineList } from "./RoutineList";
import { RoutineImporter } from "./RoutineImporter";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

export default function SettingsScreen() {
  const settings = useSettings();
  const routines = useAllRoutines();
  const activeSession = useActiveSession();
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  if (!settings || routines === undefined) return null;

  const hasActive = activeSession !== undefined && activeSession !== null;

  function handleUnits(units: UnitSystem) {
    setUnits(db, units);
  }

  function handleTheme(theme: ThemePreference) {
    setTheme(db, theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }

  async function handleExport() {
    const envelope = await exportBackup(db);
    downloadBackupFile(envelope);
    toast.success("Backup exported");
  }

  async function handleJsonImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors([]);
    try {
      const raw = await readJsonFile(file);
      const exercises = await db.exercises.toArray();
      const catalogIds = new Set(exercises.map((ex) => ex.id));
      const errors = validateBackupPayload(raw, catalogIds);
      if (errors.length > 0) {
        setImportErrors(errors.map((err) => `${err.field}: ${err.message}`));
        return;
      }
      // After validation passes, raw is a valid BackupEnvelope
      const result = await importBackup(db, raw as BackupEnvelope);
      toast.success(
        result.hasActiveSession
          ? "Data imported. An active session was restored."
          : "Data imported successfully."
      );
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  }

  async function handleClear() {
    await clearAllData(db);
    toast.success("All data cleared");
    navigate("/");
  }

  const unitOptions: UnitSystem[] = ["kg", "lbs"];
  const themeOptions: ThemePreference[] = ["light", "dark", "system"];

  return (
    <div className="p-4 space-y-6 pb-8">
      <h1 className="text-xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Routines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoutineList
            routines={routines ?? []}
            activeRoutineId={settings.activeRoutineId}
            hasActiveSession={hasActive}
          />
          <Separator />
          <RoutineImporter />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Units</label>
            <div className="flex rounded-lg border overflow-hidden">
              {unitOptions.map((u) => (
                <button
                  key={u}
                  onClick={() => handleUnits(u)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    settings.units === u
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex rounded-lg border overflow-hidden">
              {themeOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTheme(t)}
                  className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                    settings.theme === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleExport}>
            Export Data
          </Button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJsonImport}
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={hasActive}
            onClick={() => jsonInputRef.current?.click()}
          >
            Import Data
          </Button>
          {hasActive && (
            <p className="text-xs text-warning">
              Finish or discard your current workout before importing.
            </p>
          )}
          {importErrors.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning-soft p-3 space-y-1">
              {importErrors.map((err, i) => (
                <p key={i} className="text-xs text-warning-foreground">{err}</p>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive-soft"
            disabled={hasActive}
            onClick={() => setClearOpen(true)}
          >
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all data?"
        description="This will permanently delete all routines, workouts, and history. This cannot be undone."
        confirmText="Clear All Data"
        onConfirm={handleClear}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    </div>
  );
}
```

- [ ] **Step 4: Remove .gitkeep and verify build**

```bash
cd web && rm -f src/features/settings/.gitkeep && npm run build
```

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/settings/ && git commit -m "feat: implement Settings screen with routine import, preferences, data management"
```

---

### Task 2: Today Screen

**Files:**
- Create: `web/src/features/today/DaySelector.tsx`
- Create: `web/src/features/today/DayPreview.tsx`
- Create: `web/src/features/today/LastSessionCard.tsx`
- Create: `web/src/features/today/TodayScreen.tsx`
- Remove: `web/src/features/today/.gitkeep`

- [ ] **Step 1: Create DaySelector**

Create `web/src/features/today/DaySelector.tsx`:

```tsx
import type { Routine } from "@/domain/types";

interface DaySelectorProps {
  routine: Routine;
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DaySelector({
  routine,
  selectedDayId,
  onSelectDay,
}: DaySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
      {routine.dayOrder.map((dayId) => {
        const day = routine.days[dayId];
        if (!day) return null;
        const isSelected = dayId === selectedDayId;
        const isSuggested = dayId === routine.nextDayId;

        return (
          <button
            key={dayId}
            onClick={() => onSelectDay(dayId)}
            className={`relative shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isSelected
                ? "bg-info text-info-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>
              {dayId} — {day.label}
            </span>
            {isSuggested && !isSelected && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-info" />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create DayPreview**

Create `web/src/features/today/DayPreview.tsx`:

```tsx
import type { Routine, RoutineDay, SetBlock } from "@/domain/types";
import { Card, CardContent } from "@/shared/ui/card";

interface DayPreviewProps {
  routine: Routine;
  day: RoutineDay;
}

function formatSetSummary(setBlocks: SetBlock[]): string {
  if (setBlocks.length === 0) return "";
  return setBlocks
    .map((b) => {
      const tag = b.tag === "top" ? "top" : b.tag === "amrap" ? "AMRAP" : "";
      const range = b.exactValue != null
        ? `${b.exactValue}`
        : b.minValue != null && b.maxValue != null
        ? `${b.minValue}-${b.maxValue}`
        : "";
      return tag ? `${b.count} ${tag}` : `${b.count} x ${range}`;
    })
    .join(" + ");
}

export function DayPreview({ routine, day }: DayPreviewProps) {
  return (
    <Card>
      <CardContent className="py-3 space-y-1.5">
        {day.entries.map((entry, i) => {
          if (entry.kind === "exercise") {
            return (
              <div key={entry.entryId} className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  {entry.exerciseId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  {entry.instanceLabel ? ` (${entry.instanceLabel})` : ""}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatSetSummary(entry.setBlocks)}
                </span>
              </div>
            );
          }
          // Superset
          return (
            <div key={entry.groupId} className="border-l-2 border-info/30 pl-3 space-y-1">
              {entry.items.map((item) => (
                <div key={item.entryId} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {item.exerciseId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatSetSummary(item.setBlocks)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create LastSessionCard**

Create `web/src/features/today/LastSessionCard.tsx`:

```tsx
import type { Session } from "@/domain/types";

interface LastSessionCardProps {
  session: Session;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const min = Math.round(ms / 60000);
  return `${min} min`;
}

export function LastSessionCard({ session }: LastSessionCardProps) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Last workout: {session.dayLabelSnapshot} &middot;{" "}
        <span className="tabular-nums">
          {formatRelativeDate(session.finishedAt ?? session.startedAt)}
        </span>
        {session.finishedAt && (
          <> &middot; <span className="tabular-nums">{formatDuration(session.startedAt, session.finishedAt)}</span></>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create TodayScreen**

Create `web/src/features/today/TodayScreen.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useLastSession } from "@/shared/hooks/useLastSession";
import { startSessionWithCatalog } from "@/services/session-service";
import { db } from "@/db/database";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DaySelector } from "./DaySelector";
import { DayPreview } from "./DayPreview";
import { LastSessionCard } from "./LastSessionCard";

export default function TodayScreen() {
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const lastSession = useLastSession(settings?.activeRoutineId);
  const navigate = useNavigate();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  if (!settings) return null;

  // State A: No active routine
  if (!settings.activeRoutineId || routine === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-bold">No Active Routine</h1>
        <p className="text-sm text-muted-foreground text-center">
          Import a routine in Settings to get started.
        </p>
        <Button variant="outline" asChild>
          <Link to="/settings">Go to Settings</Link>
        </Button>
      </div>
    );
  }

  if (routine === undefined) return null;

  // State C: Active session exists
  if (activeSession) {
    const elapsed = Math.round(
      (Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000
    );
    return (
      <div className="p-4">
        <Card
          className="border-info bg-info-soft cursor-pointer"
          onClick={() => navigate("/workout")}
        >
          <CardContent className="py-4">
            <h2 className="text-base font-semibold">Resume Workout</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSession.session.dayLabelSnapshot} &middot;{" "}
              {activeSession.session.routineNameSnapshot}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {elapsed} min &middot; {activeSession.sessionExercises.length} exercises
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State B: Routine active, no session
  const dayId = selectedDayId ?? routine.nextDayId ?? routine.dayOrder[0]!;
  const day = routine.days[dayId];

  async function handleStart() {
    setStarting(true);
    try {
      await startSessionWithCatalog(db, routine!, dayId);
      navigate("/workout");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h1 className="text-xl font-bold">{routine.name}</h1>

        <DaySelector
          routine={routine}
          selectedDayId={dayId}
          onSelectDay={setSelectedDayId}
        />

        {day && <DayPreview routine={routine} day={day} />}

        {routine.cardio && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Cardio
            </p>
            {routine.cardio.notes && (
              <p className="text-xs text-muted-foreground">{routine.cardio.notes}</p>
            )}
          </div>
        )}

        {lastSession && <LastSessionCard session={lastSession} />}
      </div>

      <div className="sticky bottom-0 border-t bg-background p-4 pb-[env(safe-area-inset-bottom)]">
        <Button className="w-full" size="lg" onClick={handleStart} disabled={starting}>
          {starting ? "Starting..." : "Start Workout"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Remove .gitkeep and verify build**

```bash
cd web && rm -f src/features/today/.gitkeep && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/src/features/today/ && git commit -m "feat: implement Today screen with day selector, preview, and session start"
```

---

### Task 3: Workout Core Components (SetSlot + ExerciseCard)

**Files:**
- Create: `web/src/features/workout/SetSlot.tsx`
- Create: `web/src/features/workout/ExerciseCard.tsx`

- [ ] **Step 1: Create SetSlot**

Create `web/src/features/workout/SetSlot.tsx`:

```tsx
import { Check } from "lucide-react";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";
import type { ExerciseEquipment } from "@/domain/enums";

interface SetSlotProps {
  setIndex: number;
  loggedSet: LoggedSet | undefined;
  units: UnitSystem;
  equipment: ExerciseEquipment;
  onClick: () => void;
}

export function SetSlot({
  setIndex,
  loggedSet,
  units,
  equipment,
  onClick,
}: SetSlotProps) {
  const isLogged = loggedSet !== undefined;

  function formatValue(ls: LoggedSet): string {
    if (ls.performedWeightKg != null && ls.performedReps != null) {
      const w = toDisplayWeight(ls.performedWeightKg, equipment, units);
      return `${w}x${ls.performedReps}`;
    }
    if (ls.performedReps != null) return `${ls.performedReps}r`;
    if (ls.performedDurationSec != null) return `${ls.performedDurationSec}s`;
    if (ls.performedDistanceM != null) return `${ls.performedDistanceM}m`;
    return "\u2713";
  }

  return (
    <button
      data-testid="set-slot"
      onClick={onClick}
      className={`min-h-[44px] min-w-[3.5rem] rounded-lg px-2 text-xs font-medium tabular-nums flex items-center justify-center gap-1 transition-colors shrink-0 ${
        isLogged
          ? "border border-success bg-success-soft text-success"
          : "border border-border text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {isLogged ? (
        <>
          <Check className="h-3 w-3 shrink-0" />
          <span>{formatValue(loggedSet)}</span>
        </>
      ) : (
        <span>{setIndex + 1}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create ExerciseCard**

Create `web/src/features/workout/ExerciseCard.tsx`:

```tsx
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";
import { getBlockLabel } from "@/services/progression-service";
import { toDisplayWeight } from "@/domain/unit-conversion";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { SetSlot } from "./SetSlot";
import { ArrowUp } from "lucide-react";

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  historyData: ExerciseHistoryData | undefined;
  extraHistory: ExtraExerciseHistory | null | undefined;
  onSetTap: (blockIndex: number, setIndex: number) => void;
  /** Read-only mode for history view: show subdued unlogged slots */
  readOnly?: boolean;
}

function blockLabelVariant(label: string) {
  if (label === "Top") return "bg-warning-soft text-warning";
  if (label === "AMRAP") return "bg-info-soft text-info";
  return "bg-muted text-muted-foreground";
}

function formatLastTime(
  sets: Array<{ weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null }>,
  equipment: string,
  units: UnitSystem
): string {
  if (sets.length === 0) return "";
  const first = sets[0]!;
  if (first.weightKg != null) {
    const w = toDisplayWeight(first.weightKg, equipment as never, units);
    const allSameWeight = sets.every((s) => s.weightKg === first.weightKg);
    if (allSameWeight) {
      const reps = sets.map((s) => s.reps ?? "?").join(", ");
      return `${w}${units} x ${reps}`;
    }
    return sets.map((s) => {
      const sw = s.weightKg != null ? toDisplayWeight(s.weightKg, equipment as never, units) : "?";
      return `${sw}x${s.reps ?? "?"}`;
    }).join(", ");
  }
  if (first.reps != null) return sets.map((s) => `${s.reps ?? "?"}r`).join(", ");
  if (first.durationSec != null) return sets.map((s) => `${s.durationSec ?? "?"}s`).join(", ");
  return "";
}

export function ExerciseCard({
  sessionExercise,
  loggedSets,
  units,
  historyData,
  extraHistory,
  onSetTap,
  readOnly = false,
}: ExerciseCardProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const isExtra = se.origin === "extra";

  // Build set lookup: [blockIndex][setIndex] -> LoggedSet
  const setLookup = new Map<string, LoggedSet>();
  for (const ls of loggedSets) {
    setLookup.set(`${ls.blockIndex}:${ls.setIndex}`, ls);
  }

  return (
    <Card className={readOnly ? "border-0 shadow-none bg-transparent" : undefined}>
      <CardContent className={`${readOnly ? "px-0" : ""} py-3 space-y-3`}>
        {/* Header */}
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold truncate">
            {se.exerciseNameSnapshot}
          </h3>
          {isExtra && (
            <Badge variant="secondary" className="shrink-0 text-[11px]">Extra</Badge>
          )}
        </div>

        {se.notesSnapshot && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {se.notesSnapshot}
          </p>
        )}

        {/* Blocks */}
        {blocks.length > 0 ? (
          blocks.map((block, blockIndex) => {
            const label = getBlockLabel(block, blockIndex, blocks.length, blocks);
            const lastTime = historyData?.lastTime[blockIndex];
            const suggestion = historyData?.suggestions.find((s) => s.blockIndex === blockIndex);

            return (
              <div key={blockIndex} className="space-y-1.5">
                {/* Block label + history */}
                <div className="flex items-center gap-2 flex-wrap">
                  {label && (
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${blockLabelVariant(label)}`}>
                      {label}
                    </span>
                  )}
                  {lastTime && lastTime.sets.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Last: {formatLastTime(lastTime.sets, se.effectiveEquipment, units)}
                    </span>
                  )}
                  {suggestion && (
                    <span className="text-xs text-success tabular-nums font-medium inline-flex items-center gap-0.5">
                      <ArrowUp className="h-3 w-3" />
                      {toDisplayWeight(suggestion.suggestedWeightKg, se.effectiveEquipment, units)}{units}
                    </span>
                  )}
                </div>

                {/* Set slots */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {Array.from({ length: block.count }, (_, setIndex) => (
                    <SetSlot
                      key={setIndex}
                      setIndex={setIndex}
                      loggedSet={setLookup.get(`${blockIndex}:${setIndex}`)}
                      units={units}
                      equipment={se.effectiveEquipment}
                      onClick={() => onSetTap(blockIndex, setIndex)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : isExtra && extraHistory ? (
          /* Extra exercise: show recent history as reference */
          <p className="text-xs text-muted-foreground tabular-nums">
            Recent: {formatLastTime(extraHistory.sets, se.effectiveEquipment, units)}
          </p>
        ) : null}

        {/* Extra exercise: single unstructured slot row */}
        {isExtra && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {loggedSets.map((ls, i) => (
              <SetSlot
                key={ls.id}
                setIndex={i}
                loggedSet={ls}
                units={units}
                equipment={se.effectiveEquipment}
                onClick={() => onSetTap(0, i)}
              />
            ))}
            <SetSlot
              setIndex={loggedSets.length}
              loggedSet={undefined}
              units={units}
              equipment={se.effectiveEquipment}
              onClick={() => onSetTap(0, loggedSets.length)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/features/workout/SetSlot.tsx web/src/features/workout/ExerciseCard.tsx && git commit -m "feat: implement SetSlot and ExerciseCard workout components"
```

---

### Task 4: SetLogSheet (Bottom Sheet Form)

**Files:**
- Create: `web/src/features/workout/SetLogSheet.tsx`

- [ ] **Step 1: Create SetLogSheet**

Create `web/src/features/workout/SetLogSheet.tsx`:

```tsx
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { BlockSuggestion, BlockLastTime } from "@/services/progression-service";
import { getBlockLabel } from "@/services/progression-service";
import { toDisplayWeight, toCanonicalKg } from "@/domain/unit-conversion";
import { toast } from "sonner";

interface SetLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  suggestion: BlockSuggestion | undefined;
  lastTime: BlockLastTime | undefined;
  units: UnitSystem;
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function SetLogSheet({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  suggestion,
  lastTime,
  units,
  onSave,
  onDelete,
}: SetLogSheetProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const block: SetBlock | undefined = blocks[blockIndex];
  const targetKind = block?.targetKind ?? "reps";
  const showWeight = se.effectiveType === "weight";
  const isBodyweight = se.effectiveType === "bodyweight";

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [showWeightForBodyweight, setShowWeightForBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill on open
  useEffect(() => {
    if (!open) return;
    setShowWeightForBodyweight(false);

    if (existingSet) {
      // Priority 1: current logged value
      setWeight(
        existingSet.performedWeightKg != null
          ? String(toDisplayWeight(existingSet.performedWeightKg, se.effectiveEquipment, units))
          : ""
      );
      setReps(existingSet.performedReps != null ? String(existingSet.performedReps) : "");
      setDuration(existingSet.performedDurationSec != null ? String(existingSet.performedDurationSec) : "");
      setDistance(existingSet.performedDistanceM != null ? String(existingSet.performedDistanceM) : "");
    } else if (suggestion || lastTime) {
      // Priority 2: suggestion weight + last-time reps
      const suggestedWeight = suggestion?.suggestedWeightKg;
      const lastSet = lastTime?.sets[setIndex];

      if (suggestedWeight != null) {
        setWeight(String(toDisplayWeight(suggestedWeight, se.effectiveEquipment, units)));
      } else if (lastSet?.weightKg != null) {
        setWeight(String(toDisplayWeight(lastSet.weightKg, se.effectiveEquipment, units)));
      } else {
        setWeight("");
      }

      setReps(lastSet?.reps != null ? String(lastSet.reps) : "");
      setDuration(lastSet?.durationSec != null ? String(lastSet.durationSec) : "");
      setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
    } else {
      // Priority 3: blank
      setWeight("");
      setReps("");
      setDuration("");
      setDistance("");
    }
  }, [open, existingSet, suggestion, lastTime, se, setIndex, units]);

  const blockLabel = block
    ? getBlockLabel(block, blockIndex, blocks.length, blocks)
    : "";

  async function handleSave() {
    setSaving(true);
    try {
      const w = weight.trim() ? parseFloat(weight) : null;
      await onSave({
        performedWeightKg: w != null ? toCanonicalKg(w, se.effectiveEquipment, units) : null,
        performedReps: reps.trim() ? parseInt(reps, 10) : null,
        performedDurationSec: duration.trim() ? parseInt(duration, 10) : null,
        performedDistanceM: distance.trim() ? parseFloat(distance) : null,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save set");
    } finally {
      setSaving(false);
    }
  }

  const totalSets = block?.count ?? "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh]" showCloseButton={false}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">
            {se.exerciseNameSnapshot}
            {blockLabel ? ` — ${blockLabel}` : ""}
            {" — "}
            <span className="tabular-nums">Set {setIndex + 1} of {totalSets}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-4">
          {/* Weight field */}
          {showWeight && (
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight ({units})</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {isBodyweight && !showWeightForBodyweight && (
            <button
              className="text-xs text-info hover:underline"
              onClick={() => setShowWeightForBodyweight(true)}
            >
              + Add weight (permanent for this session)
            </button>
          )}

          {isBodyweight && showWeightForBodyweight && (
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight ({units})</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <p className="text-[11px] text-warning">
                Adding weight is permanent for this session.
              </p>
            </div>
          )}

          {/* Target field */}
          {targetKind === "reps" && (
            <div className="space-y-1.5">
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                name="reps"
                type="number"
                inputMode="numeric"
                className="text-lg tabular-nums h-12"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                autoFocus={!showWeight}
              />
            </div>
          )}

          {targetKind === "duration" && (
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                inputMode="numeric"
                className="text-lg tabular-nums h-12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          )}

          {targetKind === "distance" && (
            <div className="space-y-1.5">
              <Label htmlFor="distance">Distance (meters)</Label>
              <Input
                id="distance"
                name="distance"
                type="number"
                inputMode="decimal"
                className="text-lg tabular-nums h-12"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2 pb-2">
          <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
            Save
          </Button>
          {existingSet && onDelete && (
            <button
              className="w-full text-center text-xs text-destructive hover:underline py-1"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onDelete();
                  onOpenChange(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete set");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete this set
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx && git commit -m "feat: implement SetLogSheet bottom sheet for set logging"
```

---

### Task 5: Workout Assembly (SupersetGroup + ExercisePicker + WorkoutFooter + WorkoutScreen)

**Files:**
- Create: `web/src/features/workout/SupersetGroup.tsx`
- Create: `web/src/features/workout/ExercisePicker.tsx`
- Create: `web/src/features/workout/WorkoutFooter.tsx`
- Create: `web/src/features/workout/WorkoutScreen.tsx`
- Remove: `web/src/features/workout/.gitkeep`

- [ ] **Step 1: Create SupersetGroup**

Create `web/src/features/workout/SupersetGroup.tsx`:

```tsx
import type { ReactNode } from "react";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-info pl-3 space-y-3">
      <span className="text-xs text-info font-medium">Superset</span>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create ExercisePicker**

Create `web/src/features/workout/ExercisePicker.tsx`:

```tsx
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

const MUSCLE_GROUPS = [
  "All", "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Full Body", "Cardio",
] as const;

interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingExerciseIds: Set<string>;
  onPick: (exerciseId: string) => void;
}

export function ExercisePicker({
  open,
  onOpenChange,
  existingExerciseIds,
  onPick,
}: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const exercises = useLiveQuery(() => db.exercises.toArray());

  if (!exercises) return null;

  const filtered = exercises.filter((ex) => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab !== "All" && !ex.muscleGroups.some((mg) => mg.toLowerCase() === tab.toLowerCase())) return false;
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh]" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        <div className="py-3">
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start" variant="line">
            {MUSCLE_GROUPS.map((mg) => (
              <TabsTrigger key={mg} value={mg} className="shrink-0 text-xs">
                {mg}
              </TabsTrigger>
            ))}
          </TabsList>

          {MUSCLE_GROUPS.map((mg) => (
            <TabsContent key={mg} value={mg} className="mt-0">
              <ScrollArea className="h-[calc(85dvh-200px)]">
                <div className="space-y-0.5 py-2">
                  {filtered.map((ex) => {
                    const inWorkout = existingExerciseIds.has(ex.id);
                    return (
                      <button
                        key={ex.id}
                        onClick={() => {
                          onPick(ex.id);
                          onOpenChange(false);
                          setSearch("");
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div>
                          <span className="text-sm font-medium">{ex.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 capitalize">
                            {ex.equipment}
                          </span>
                        </div>
                        {inWorkout && (
                          <Badge variant="secondary" className="text-[11px] shrink-0">
                            In workout
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No exercises found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Create WorkoutFooter**

Create `web/src/features/workout/WorkoutFooter.tsx`:

```tsx
import { Button } from "@/shared/ui/button";

interface WorkoutFooterProps {
  onAddExercise: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}

export function WorkoutFooter({
  onAddExercise,
  onFinish,
  onDiscard,
}: WorkoutFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 border-t bg-background p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAddExercise}>
          Add Exercise
        </Button>
        <Button className="flex-1" onClick={onFinish}>
          Finish Workout
        </Button>
      </div>
      <button
        className="w-full mt-2 text-xs text-destructive hover:underline py-1"
        onClick={onDiscard}
      >
        Discard workout
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create WorkoutScreen**

Create `web/src/features/workout/WorkoutScreen.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { useExtraHistory } from "@/shared/hooks/useExtraHistory";
import { db } from "@/db/database";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import { addExtraExercise, finishSession, discardSession } from "@/services/session-service";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ExerciseCard } from "./ExerciseCard";
import { SetLogSheet } from "./SetLogSheet";
import { SupersetGroup } from "./SupersetGroup";
import { ExercisePicker } from "./ExercisePicker";
import { WorkoutFooter } from "./WorkoutFooter";
import { toast } from "sonner";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function WorkoutScreen() {
  const activeSession = useActiveSession();
  const settings = useSettings();
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  if (!settings) return null;

  // Empty state
  if (activeSession === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <h1 className="text-xl font-bold">No Active Workout</h1>
        <p className="text-sm text-muted-foreground">
          Start a workout from the Today tab.
        </p>
      </div>
    );
  }

  if (activeSession === undefined) return null;

  const { session, sessionExercises, loggedSets } = activeSession;
  const units = settings.units;

  // Group sets by sessionExerciseId
  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const arr = setsByExercise.get(ls.sessionExerciseId) ?? [];
    arr.push(ls);
    setsByExercise.set(ls.sessionExerciseId, arr);
  }

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const sets = setsByExercise.get(se.id) ?? [];
    const existing = sets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex
    );
    setSheetExercise(se);
    setSheetBlockIndex(blockIndex);
    setSheetSetIndex(setIndex);
    setSheetExistingSet(existing);
    setSheetOpen(true);
  }

  async function handleSave(input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) {
    if (!sheetExercise) return;
    if (sheetExistingSet) {
      await editSet(db, sheetExistingSet.id, input);
    } else {
      await logSet(db, sheetExercise.id, sheetBlockIndex, sheetSetIndex, input);
    }
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  async function handleAddExercise(exerciseId: string) {
    await addExtraExercise(db, session.id, exerciseId);
  }

  // Count unlogged sets
  const totalPrescribed = sessionExercises.reduce(
    (sum, se) => sum + se.setBlocksSnapshot.reduce((s, b) => s + b.count, 0),
    0
  );
  const unloggedCount = totalPrescribed - loggedSets.filter((ls) => ls.origin === "routine").length;

  async function handleFinish() {
    await finishSession(db, session.id);
    toast.success("Workout finished!");
    navigate("/history");
  }

  async function handleDiscard() {
    await discardSession(db, session.id);
    toast.success("Workout discarded");
    navigate("/");
  }

  // Build render groups (singles and supersets)
  const renderGroups: Array<
    | { type: "single"; exercise: SessionExercise }
    | { type: "superset"; exercises: [SessionExercise, SessionExercise] }
  > = [];

  const processed = new Set<string>();
  for (const se of sessionExercises) {
    if (processed.has(se.id)) continue;
    if (se.groupType === "superset" && se.supersetGroupId) {
      const partner = sessionExercises.find(
        (other) =>
          other.id !== se.id && other.supersetGroupId === se.supersetGroupId
      );
      if (partner) {
        const ordered =
          (se.supersetPosition ?? 0) < (partner.supersetPosition ?? 0)
            ? [se, partner]
            : [partner, se];
        renderGroups.push({
          type: "superset",
          exercises: ordered as [SessionExercise, SessionExercise],
        });
        processed.add(se.id);
        processed.add(partner.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", exercise: se });
    processed.add(se.id);
  }

  const existingExerciseIds = new Set(sessionExercises.map((se) => se.exerciseId));

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h1 className="text-lg font-bold truncate">
          {session.dayLabelSnapshot}
        </h1>
        <p className="text-xs text-muted-foreground truncate">
          {session.routineNameSnapshot}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            const se = group.exercise;
            return (
              <ExerciseCardWithHistory
                key={se.id}
                sessionExercise={se}
                loggedSets={setsByExercise.get(se.id) ?? []}
                units={units}
                onSetTap={(bi, si) => handleSetTap(se, bi, si)}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.exercises.map((se) => (
                <ExerciseCardWithHistory
                  key={se.id}
                  sessionExercise={se}
                  loggedSets={setsByExercise.get(se.id) ?? []}
                  units={units}
                  onSetTap={(bi, si) => handleSetTap(se, bi, si)}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      <WorkoutFooter
        onAddExercise={() => setPickerOpen(true)}
        onFinish={() => setFinishOpen(true)}
        onDiscard={() => setDiscardOpen(true)}
      />

      {/* Set Log Sheet */}
      {sheetExercise && (
        <SetLogSheetWithHistory
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}

      {/* Exercise Picker */}
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingExerciseIds={existingExerciseIds}
        onPick={handleAddExercise}
      />

      {/* Finish Dialog */}
      <ConfirmDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="Finish Workout?"
        description={
          unloggedCount > 0
            ? `${unloggedCount} sets not logged — they will remain empty.`
            : "All sets logged. Ready to finish?"
        }
        confirmText="Finish Workout"
        onConfirm={handleFinish}
      />

      {/* Discard Dialog */}
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard Workout?"
        description="This will permanently delete this workout and all logged sets."
        confirmText="Discard"
        onConfirm={handleDiscard}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    </div>
  );
}

/**
 * Wrapper that provides history data to ExerciseCard via hooks.
 * Hooks must be called at the top level, so this wrapper isolates them per exercise.
 */
function ExerciseCardWithHistory({
  sessionExercise,
  loggedSets,
  units,
  onSetTap,
}: {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  units: "kg" | "lbs";
  onSetTap: (blockIndex: number, setIndex: number) => void;
}) {
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    units
  );
  const extraHistory = useExtraHistory(
    !isRoutine ? sessionExercise.exerciseId : undefined
  );

  return (
    <ExerciseCard
      sessionExercise={sessionExercise}
      loggedSets={loggedSets}
      units={units}
      historyData={historyData}
      extraHistory={extraHistory}
      onSetTap={onSetTap}
    />
  );
}

/**
 * Wrapper that provides history data to SetLogSheet via hooks.
 */
function SetLogSheetWithHistory({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  units,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => void;
  onDelete?: () => void;
}) {
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    units
  );

  const suggestion = historyData?.suggestions.find(
    (s) => s.blockIndex === blockIndex
  );
  const lastTime = historyData?.lastTime[blockIndex];

  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={suggestion}
      lastTime={lastTime}
      units={units}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
```

- [ ] **Step 5: Remove .gitkeep and verify build**

```bash
cd web && rm -f src/features/workout/.gitkeep && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/src/features/workout/ && git commit -m "feat: implement complete Workout screen with exercise cards, set logging, picker, supersets"
```

---

### Task 6: History Screen + SessionCard

**Files:**
- Create: `web/src/features/history/SessionCard.tsx`
- Create: `web/src/features/history/HistoryScreen.tsx`

- [ ] **Step 1: Create SessionCard**

Create `web/src/features/history/SessionCard.tsx`:

```tsx
import { Link } from "react-router";
import type { FinishedSessionSummary } from "@/shared/hooks/useFinishedSessionSummaries";
import { Badge } from "@/shared/ui/badge";

interface SessionCardProps {
  summary: FinishedSessionSummary;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const min = Math.round(ms / 60000);
  return `${min} min`;
}

export function SessionCard({ summary }: SessionCardProps) {
  const { session, exerciseCount, loggedSetCount } = summary;

  return (
    <Link
      to={`/history/${session.id}`}
      className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="bg-info-soft text-info shrink-0 mt-0.5">
          {session.dayId}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {session.routineNameSnapshot} — {session.dayLabelSnapshot}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {formatDate(summary.displayDate)}
            {session.finishedAt && (
              <> &middot; {formatDuration(session.startedAt, session.finishedAt)}</>
            )}
            &middot; {exerciseCount} exercises &middot; {loggedSetCount} sets
          </p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create HistoryScreen**

Create `web/src/features/history/HistoryScreen.tsx`:

```tsx
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import { SessionCard } from "./SessionCard";

export default function HistoryScreen() {
  const summaries = useFinishedSessionSummaries();

  if (summaries === undefined) return null;

  if (summaries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <h1 className="text-xl font-bold">No History Yet</h1>
        <p className="text-sm text-muted-foreground">
          Complete a workout to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-bold">History</h1>
      {summaries.map((summary) => (
        <SessionCard key={summary.session.id} summary={summary} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/features/history/SessionCard.tsx web/src/features/history/HistoryScreen.tsx && git commit -m "feat: implement History screen with session cards"
```

---

### Task 7: Session Detail Screen

**Files:**
- Create: `web/src/features/history/SessionDetailScreen.tsx`

- [ ] **Step 1: Create SessionDetailScreen**

Create `web/src/features/history/SessionDetailScreen.tsx`:

```tsx
import { useState } from "react";
import { useParams, Link } from "react-router";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";
import { useSettings } from "@/shared/hooks/useSettings";
import { useExerciseHistory } from "@/shared/hooks/useExerciseHistory";
import { db } from "@/db/database";
import { editSet, deleteSet } from "@/services/set-service";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import { SupersetGroup } from "@/features/workout/SupersetGroup";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { SessionExercise, LoggedSet } from "@/domain/types";

export default function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const detail = useSessionDetail(sessionId);
  const settings = useSettings();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<SessionExercise | null>(null);
  const [sheetBlockIndex, setSheetBlockIndex] = useState(0);
  const [sheetSetIndex, setSheetSetIndex] = useState(0);
  const [sheetExistingSet, setSheetExistingSet] = useState<LoggedSet | undefined>();

  if (!settings) return null;

  if (detail === null) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/history"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <p className="text-sm text-muted-foreground mt-4">Session not found.</p>
      </div>
    );
  }

  if (detail === undefined) return null;

  const { session, exercises } = detail;
  const units = settings.units;

  function formatDuration(start: string, end: string | null): string {
    if (!end) return "";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.round(ms / 60000);
    return `${min} min`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handleSetTap(se: SessionExercise, blockIndex: number, setIndex: number) {
    const exData = exercises.find((e) => e.sessionExercise.id === se.id);
    const existing = exData?.loggedSets.find(
      (ls) => ls.blockIndex === blockIndex && ls.setIndex === setIndex
    );
    // Only allow editing existing logged sets on finished sessions.
    // logSet() requires active session status — cannot create new sets here.
    if (!existing) return;
    setSheetExercise(se);
    setSheetBlockIndex(blockIndex);
    setSheetSetIndex(setIndex);
    setSheetExistingSet(existing);
    setSheetOpen(true);
  }

  async function handleSave(input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) {
    if (!sheetExercise || !sheetExistingSet) return;
    // Only editSet is valid on finished sessions
    await editSet(db, sheetExistingSet.id, input);
  }

  async function handleDeleteSet() {
    if (sheetExistingSet) {
      await deleteSet(db, sheetExistingSet.id);
    }
  }

  // Build render groups
  const renderGroups: Array<
    | { type: "single"; data: (typeof exercises)[0] }
    | { type: "superset"; data: [(typeof exercises)[0], (typeof exercises)[0]] }
  > = [];
  const processed = new Set<string>();

  for (const exData of exercises) {
    const se = exData.sessionExercise;
    if (processed.has(se.id)) continue;
    if (se.groupType === "superset" && se.supersetGroupId) {
      const partner = exercises.find(
        (other) => other.sessionExercise.id !== se.id && other.sessionExercise.supersetGroupId === se.supersetGroupId
      );
      if (partner) {
        const ordered = (se.supersetPosition ?? 0) < (partner.sessionExercise.supersetPosition ?? 0)
          ? [exData, partner]
          : [partner, exData];
        renderGroups.push({ type: "superset", data: ordered as [(typeof exercises)[0], (typeof exercises)[0]] });
        processed.add(se.id);
        processed.add(partner.sessionExercise.id);
        continue;
      }
    }
    renderGroups.push({ type: "single", data: exData });
    processed.add(se.id);
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/history"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">{session.dayLabelSnapshot}</h1>
        <p className="text-sm text-muted-foreground">
          {session.routineNameSnapshot}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums mt-1">
          {formatDate(session.finishedAt ?? session.startedAt)}
          {session.finishedAt && (
            <> &middot; {formatDuration(session.startedAt, session.finishedAt)}</>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {renderGroups.map((group, i) => {
          if (group.type === "single") {
            return (
              <SessionExerciseCardWithHistory
                key={group.data.sessionExercise.id}
                exData={group.data}
                units={units}
                onSetTap={handleSetTap}
              />
            );
          }
          return (
            <SupersetGroup key={i}>
              {group.data.map((d) => (
                <SessionExerciseCardWithHistory
                  key={d.sessionExercise.id}
                  exData={d}
                  units={units}
                  onSetTap={handleSetTap}
                />
              ))}
            </SupersetGroup>
          );
        })}
      </div>

      {sheetExercise && (
        <SetLogSheetWithHistoryForDetail
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}
    </div>
  );
}

function SessionExerciseCardWithHistory({
  exData,
  units,
  onSetTap,
}: {
  exData: { sessionExercise: SessionExercise; loggedSets: LoggedSet[] };
  units: "kg" | "lbs";
  onSetTap: (se: SessionExercise, blockIndex: number, setIndex: number) => void;
}) {
  const se = exData.sessionExercise;
  const historyData = useExerciseHistory(
    se.origin === "routine" ? se : undefined,
    units
  );

  return (
    <div>
      <Link
        to={`/history/exercise/${se.exerciseId}`}
        className="text-base font-semibold hover:underline"
      >
        {se.exerciseNameSnapshot}
      </Link>
      <ExerciseCard
        sessionExercise={se}
        loggedSets={exData.loggedSets}
        units={units}
        historyData={historyData}
        extraHistory={null}
        onSetTap={(bi, si) => onSetTap(se, bi, si)}
        readOnly
      />
    </div>
  );
}

function SetLogSheetWithHistoryForDetail({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  units,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => void;
  onDelete?: () => void;
}) {
  const historyData = useExerciseHistory(
    sessionExercise.origin === "routine" ? sessionExercise : undefined,
    units
  );
  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={historyData?.suggestions.find((s) => s.blockIndex === blockIndex)}
      lastTime={historyData?.lastTime[blockIndex]}
      units={units}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/history/SessionDetailScreen.tsx && git commit -m "feat: implement Session Detail screen with read-only exercise cards and set editing"
```

---

### Task 8: Exercise History Screen

**Files:**
- Create: `web/src/features/history/ExerciseHistoryScreen.tsx`
- Remove: `web/src/features/history/.gitkeep`

- [ ] **Step 1: Create ExerciseHistoryScreen**

Create `web/src/features/history/ExerciseHistoryScreen.tsx`:

```tsx
import { useParams, Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useExerciseHistoryGroups } from "@/shared/hooks/useExerciseHistoryGroups";
import { useSettings } from "@/shared/hooks/useSettings";
import { toDisplayWeight } from "@/domain/unit-conversion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";

export default function ExerciseHistoryScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const groups = useExerciseHistoryGroups(exerciseId);
  const settings = useSettings();
  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId]
  );

  if (!settings) return null;

  const units = settings.units;
  const name = exercise?.name ?? exerciseId ?? "Exercise";

  return (
    <div className="p-4 space-y-4 pb-8">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/history"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
      </Button>

      <h1 className="text-xl font-bold">{name}</h1>

      {groups === null || groups === undefined ? null : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No history for this exercise.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.session.id} className="space-y-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                {new Date(group.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" — "}
                {group.session.dayLabelSnapshot}
                {" — "}
                {group.session.routineNameSnapshot}
              </p>
              {group.entries.map((entry, ei) => (
                <div key={ei} className="pl-2">
                  {entry.instanceLabel && (
                    <p className="text-xs text-muted-foreground italic">
                      {entry.instanceLabel}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {entry.sets.map((ls, si) => {
                      let text = "";
                      if (ls.performedWeightKg != null && ls.performedReps != null) {
                        const w = toDisplayWeight(
                          ls.performedWeightKg,
                          entry.effectiveEquipment,
                          units
                        );
                        text = `${w}${units} x ${ls.performedReps}`;
                      } else if (ls.performedReps != null) {
                        text = `${ls.performedReps} reps`;
                      } else if (ls.performedDurationSec != null) {
                        text = `${ls.performedDurationSec}s`;
                      } else if (ls.performedDistanceM != null) {
                        text = `${ls.performedDistanceM}m`;
                      }
                      return (
                        <span
                          key={si}
                          className="text-sm tabular-nums font-medium"
                        >
                          {text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove .gitkeep and verify build**

```bash
cd web && rm -f src/features/history/.gitkeep && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/history/ && git commit -m "feat: implement Exercise History screen with grouped cross-session view"
```

---

### Task 9: Wire Routes in App.tsx + Theme Init

**Files:**
- Modify: `web/src/app/App.tsx`

- [ ] **Step 1: Update App.tsx to import real screens**

Replace the entire content of `web/src/app/App.tsx` with:

```tsx
import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
} from "react-router";
import { Toaster } from "sonner";
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useSettings } from "@/shared/hooks/useSettings";

import TodayScreen from "@/features/today/TodayScreen";
import WorkoutScreen from "@/features/workout/WorkoutScreen";
import HistoryScreen from "@/features/history/HistoryScreen";
import SessionDetailScreen from "@/features/history/SessionDetailScreen";
import ExerciseHistoryScreen from "@/features/history/ExerciseHistoryScreen";
import SettingsScreen from "@/features/settings/SettingsScreen";

const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function ThemeSync() {
  const settings = useSettings();
  useEffect(() => {
    if (!settings) return;
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (settings.theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () =>
        document.documentElement.classList.toggle("dark", mq.matches);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings?.theme]);
  return null;
}

function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <ThemeSync />
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
        <Route path="/" element={<TodayScreen />} />
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
        <Route
          path="/history/exercise/:exerciseId"
          element={<ExerciseHistoryScreen />}
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

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

- [ ] **Step 2: Run full verification**

```bash
cd web && npx tsc -b && npm run lint && npm test && npm run build
```

Expected: TypeScript, lint, tests, and build all pass.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/App.tsx && git commit -m "$(cat <<'EOF'
feat: wire all screens into App.tsx routes

Replace placeholder routes with real screen imports. Add ThemeSync
component for persistent theme application. All 6 screens now
functional: Today, Workout, History, Session Detail, Exercise
History, Settings.
EOF
)"
```

---

## Verification Checklist

After all 9 tasks, run the full suite:

```bash
cd web && npx tsc -b && npm run lint && npm test && npm run build
```

Then start the dev server and manually verify:

```bash
cd web && npm run dev
```

1. **Settings:** Import a YAML routine, activate it, toggle units/theme
2. **Today:** See routine preview, select day, start workout
3. **Workout:** Log sets (tap slots, fill sheet, save), add extra exercise, finish workout
4. **History:** See finished session, tap to view detail, tap exercise for history
5. **Settings:** Export data, verify download

Then run E2E:

```bash
cd web && npm run test:e2e
```

The smoke and full-workflow tests should pass against the real UI.
Y
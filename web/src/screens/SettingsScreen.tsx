import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, Trash2, Download, Upload, AlertTriangle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAllRoutines } from "@/hooks/useRoutine";
import { useActiveSession } from "@/hooks/useActiveSession";
import RoutineImporter from "@/components/RoutineImporter";
import ConfirmDialog from "@/components/ConfirmDialog";
import { db } from "@/db/database";
import {
  setActiveRoutine,
  deleteRoutine,
  setUnits,
  setTheme,
} from "@/services/settings-service";
import type { UnitSystem, ThemePreference } from "@/domain/enums";
import type { Routine } from "@/domain/types";

// ---------------------------------------------------------------------------
// Phase 7 placeholders for backup service
// ---------------------------------------------------------------------------

/**
 * Placeholder: export all user data as JSON.
 * Will be implemented in Phase 7 (backup-service.ts).
 */
async function handleExportData(): Promise<void> {
  alert("Export will be available after Phase 7 implementation.");
}

/**
 * Placeholder: import user data from JSON file.
 * Will be implemented in Phase 7 (backup-service.ts).
 */
async function handleImportData(): Promise<void> {
  alert("Import will be available after Phase 7 implementation.");
}

// ---------------------------------------------------------------------------
// ERRATA P6-J: Apply theme to document, including matchMedia listener for system
// ---------------------------------------------------------------------------
function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "light" || theme === "dark") {
    root.classList.add(theme);
  } else {
    // "system" — detect from OS preference
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    }
  }
}

export default function SettingsScreen() {
  const settings = useSettings();
  const routines = useAllRoutines();
  const activeSession = useActiveSession();

  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSession = activeSession !== undefined && activeSession !== null;

  // ERRATA P6-J: Listen for OS theme changes when "system" is selected
  useEffect(() => {
    if (!settings || settings.theme !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function listener() {
      applyTheme("system");
    }
    mql.addEventListener("change", listener);
    // Apply on mount
    applyTheme("system");
    return () => mql.removeEventListener("change", listener);
  }, [settings?.theme]);

  const handleActivateRoutine = useCallback(
    async (routineId: string) => {
      try {
        setError(null);
        await setActiveRoutine(db, routineId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to activate routine";
        setError(message);
      }
    },
    []
  );

  const handleDeleteRoutine = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setError(null);
      // ERRATA P6-K: Phase 4's deleteRoutine already handles auto-activation
      await deleteRoutine(db, deleteTarget.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete routine";
      setError(message);
    }
  }, [deleteTarget]);

  const handleUnitsChange = useCallback(async (newUnits: UnitSystem) => {
    try {
      await setUnits(db, newUnits);
    } catch (err: unknown) {
      console.error("Failed to set units:", err);
    }
  }, []);

  const handleThemeChange = useCallback(async (newTheme: ThemePreference) => {
    try {
      await setTheme(db, newTheme);
      applyTheme(newTheme);
    } catch (err: unknown) {
      console.error("Failed to set theme:", err);
    }
  }, []);

  const handleClearAllData = useCallback(async () => {
    try {
      setError(null);
      // Delete all user data except exercises (catalog is re-seeded)
      await db.transaction(
        "rw",
        [db.routines, db.sessions, db.sessionExercises, db.loggedSets, db.settings],
        async () => {
          await db.routines.clear();
          await db.sessions.clear();
          await db.sessionExercises.clear();
          await db.loggedSets.clear();
          await db.settings.put({
            id: "user",
            activeRoutineId: null,
            units: "kg",
            theme: "system",
          });
        }
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to clear data";
      setError(message);
    }
  }, []);

  if (settings === undefined || routines === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ---- Routines Section ---- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Routines
        </h2>

        {routines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No routines loaded. Import a YAML file below.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {routines
              .sort((a, b) => a.importedAt.localeCompare(b.importedAt))
              .map((routine) => {
                const isActive = settings.activeRoutineId === routine.id;
                return (
                  <Card key={routine.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {routine.name}
                        </span>
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActivateRoutine(routine.id)}
                            disabled={hasSession}
                            title={
                              hasSession
                                ? "Finish or discard active session first"
                                : "Set as active routine"
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(routine);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={hasSession}
                          title={
                            hasSession
                              ? "Finish or discard active session first"
                              : "Delete routine"
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}

        {hasSession && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Routine changes blocked during active session
          </p>
        )}

        <RoutineImporter onImported={() => {}} />
      </section>

      <Separator />

      {/* ---- Preferences Section ---- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Preferences
        </h2>

        <div className="space-y-4">
          {/* Units */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Units</span>
            <div className="flex gap-1">
              {(["kg", "lbs"] as const).map((u) => (
                <Button
                  key={u}
                  variant={settings.units === u ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUnitsChange(u)}
                >
                  {u}
                </Button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <div className="flex gap-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button
                  key={t}
                  variant={settings.theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ---- Data Section ---- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Data
        </h2>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleExportData}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data (JSON)
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleImportData}
            disabled={hasSession}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Data (JSON)
          </Button>

          {hasSession && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Import and clear are blocked during active session
            </p>
          )}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setClearDialogOpen(true)}
            disabled={hasSession}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All Data
          </Button>
        </div>
      </section>

      {/* Delete routine confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This routine will be removed. History from past sessions will not be affected."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteRoutine}
      />

      {/* Clear all data double confirmation */}
      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Clear All Data?"
        description="This will delete all routines, sessions, and workout history. The exercise catalog will be re-seeded on reload."
        doubleConfirmText="This action is irreversible. All your workout data will be permanently deleted."
        confirmLabel="Clear Data"
        variant="destructive"
        onConfirm={handleClearAllData}
      />
    </div>
  );
}

import { useSettings } from "@/shared/hooks/useSettings";
import { useAllRoutines } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";
import { db } from "@/db/database";
import { setUnits } from "@/services/settings-service";
import {
  exportBackup,
  downloadBackupFile,
  importBackup,
  clearAllData,
  readJsonFile,
  validateBackupPayload,
  type BackupEnvelope,
} from "@/services/backup-service";
import type { UnitSystem } from "@/domain/enums";
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
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!settings || routines === undefined) return null;

  const hasActive = activeSession !== undefined && activeSession !== null;

  function handleUnits(units: UnitSystem) {
    setUnits(db, units);
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
      if (result.hasActiveSession) {
        toast.success("Data imported. Resuming active session...");
        navigate("/workout");
      } else {
        toast.success("Data imported successfully.");
      }
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

  return (
    <div className="p-5 space-y-8 pb-8">
      <h1 className="text-2xl font-extrabold tracking-tight font-heading">Settings</h1>

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
            <div className="flex overflow-hidden">
              {unitOptions.map((u, i) => (
                <button
                  key={u}
                  onClick={() => handleUnits(u)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors border-[1.5px] border-border-strong ${
                    i > 0 ? "-ml-[1.5px]" : ""
                  } ${
                    settings.units === u
                      ? "bg-primary text-primary-foreground z-10"
                      : "hover:bg-muted"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="border border-warning bg-warning-soft p-3 space-y-1">
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

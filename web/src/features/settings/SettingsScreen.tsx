import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSettings } from "@/shared/hooks/useSettings";
import { useAllRoutines, useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";
import { db } from "@/db/database";
import { setUnits, deleteRoutine, setUserName } from "@/services/settings-service";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
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
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ActiveRoutineCard } from "./ActiveRoutineCard";
import { AboutCard } from "./AboutCard";
import { RoutineList } from "./RoutineList";
import { RowLink } from "./RowLink";
import { SettingRow } from "./SettingRow";
import { UnitsToggle } from "./UnitsToggle";
import { Card } from "@/shared/ui/card";
import { toast } from "sonner";

export default function SettingsScreen() {
  const settings = useSettings();
  const routines = useAllRoutines();
  const activeRoutine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const { canInstall, promptInstall } = useInstallPrompt();
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteActiveOpen, setDeleteActiveOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  if (!settings || routines === undefined) return null;

  const hasActive = activeSession !== undefined && activeSession !== null;
  const otherRoutines = routines.filter((r) => r.id !== settings.activeRoutineId);

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
      const result = await importBackup(db, raw as BackupEnvelope);
      if (result.hasActiveSession) {
        toast.success("Data imported. Resuming active session…");
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

  async function handleDeleteActive() {
    if (!settings?.activeRoutineId) return;
    try {
      await deleteRoutine(db, settings.activeRoutineId);
      toast.success("Routine deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 p-5 pb-8">
      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Preferences</p>
        <h1 className="text-hero-serif italic text-foreground">Settings</h1>
      </div>

      {/* Profile */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Profile</p>
        <Card className="py-0">
          {!editingName ? (
            <button
              type="button"
              onClick={() => {
                setNameDraft(settings.userName ?? "");
                setEditingName(true);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-sage-soft/40"
            >
              <span className="text-sm font-medium">Your name</span>
              <span
                className={cn(
                  "text-sm",
                  settings.userName === null && "italic text-ink-3"
                )}
              >
                {settings.userName ?? "Not set"}
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-2 px-4 py-3">
              <Input
                aria-label="Name editor"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={40}
                placeholder="Your name"
                className="rounded-[var(--radius-card)] bg-paper"
              />
              <div className="flex gap-2 self-end">
                <Button
                  variant="outline"
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const trimmed = nameDraft.trim();
                    await setUserName(db, trimmed === "" ? null : trimmed);
                    setEditingName(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Routines */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Routine</p>
        <ActiveRoutineCard
          routine={activeRoutine ?? null}
          onDelete={() => setDeleteActiveOpen(true)}
          deleteDisabled={hasActive}
        />
        {otherRoutines.length > 0 && (
          <RoutineList
            routines={otherRoutines}
            activeRoutineId={settings.activeRoutineId}
            hasActiveSession={hasActive}
          />
        )}
      </div>

      {/* Display */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Display</p>
        <Card className="py-0">
          <SettingRow label="Units" sublabel="Weight display">
            <UnitsToggle value={settings.units} onChange={handleUnits} />
          </SettingRow>
        </Card>
      </div>

      {/* App (install) */}
      {canInstall && (
        <div className="space-y-3">
          <p className="text-eyebrow text-ink-3">App</p>
          <Card className="py-0">
            <RowLink
              label="Install app"
              sublabel="Faster launch, works offline"
              onClick={() => {
                void promptInstall();
              }}
            />
          </Card>
        </div>
      )}

      {/* Data */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Data</p>
        <Card className="py-0 divide-y divide-line">
          <RowLink
            label="Import routine (YAML)"
            sublabel={hasActive ? "Finish the current workout first" : "Load a new plan"}
            onClick={() => navigate("/settings/import")}
            disabled={hasActive}
          />
          <RowLink
            label="Export data"
            sublabel="Download a JSON backup"
            onClick={handleExport}
          />
          <RowLink
            label="Import data"
            sublabel="Restore from JSON backup"
            onClick={() => jsonInputRef.current?.click()}
            disabled={hasActive}
          />
          <RowLink
            label="Clear all data"
            sublabel="Delete every routine, workout, and setting"
            onClick={() => setClearOpen(true)}
            disabled={hasActive}
            variant="destructive"
          />
        </Card>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          onChange={handleJsonImport}
          className="hidden"
        />
        {hasActive && (
          <p className="text-meta">
            Finish or discard your current workout before importing or clearing.
          </p>
        )}
        {importErrors.length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-1">
            {importErrors.map((err, i) => (
              <p key={i} className="text-sm text-foreground">{err}</p>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <AboutCard />

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
      <ConfirmDialog
        open={deleteActiveOpen}
        onOpenChange={setDeleteActiveOpen}
        title="Delete routine?"
        description={
          routines.length > 1
            ? "This routine will be deleted. Your next routine will be automatically activated."
            : "This is your only routine. Deleting it will leave you with no active routine."
        }
        confirmText="Delete"
        onConfirm={handleDeleteActive}
        variant="destructive"
      />
    </div>
  );
}

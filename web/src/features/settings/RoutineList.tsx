import { useState } from "react";
import type { Routine } from "@/domain/types";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
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

  if (routines.length === 0) return null;

  return (
    <>
      <p className="text-eyebrow text-ink-3">Other routines</p>
      <Card className="py-0 divide-y divide-line">
        {routines.map((routine) => (
          <div
            key={routine.id}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {routine.name}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={hasActiveSession}
                onClick={() => handleActivate(routine.id)}
              >
                Set active
              </Button>
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
        ))}
      </Card>
      {hasActiveSession && (
        <p className="text-meta">
          Finish or discard your current workout first.
        </p>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete routine?"
        description={
          deleteTarget?.id === activeRoutineId
            ? routines.length > 1
              ? "This routine will be deleted. Your next routine will be automatically activated."
              : "This is your only routine. Deleting it will leave you with no active routine."
            : "This routine will be permanently deleted."
        }
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}

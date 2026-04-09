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
              className="flex items-center justify-between border-b border-border p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {routine.name}
                </span>
                {isActive && (
                  <Badge variant="secondary" className="bg-cta text-white shrink-0">
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

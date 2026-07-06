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
import { Plus } from "@/shared/icons";

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
  const exercises = useLiveQuery(() => db.exercises.toArray());

  if (!exercises) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? exercises.filter((ex) => ex.name.toLowerCase().includes(q))
    : exercises;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) setSearch("");
      }}
    >
      <SheetContent side="bottom" className="h-[85dvh] bg-background" showCloseButton={false}>
        {/* Grabber bar per prototype */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        </div>
        <SheetHeader className="px-5 pt-1 pb-3">
          <p className="text-eyebrow text-ink-3">Add extra</p>
          <SheetTitle className="text-title-serif">Pick an exercise</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-3">
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search exercises"
          />
        </div>

        <ScrollArea className="flex-1 px-2 pb-4">
          <div className="flex flex-col">
            {filtered.map((ex) => {
              const inWorkout = existingExerciseIds.has(ex.id);
              return (
                <button
                  key={ex.id}
                  type="button"
                  aria-label={ex.name}
                  onClick={() => {
                    onPick(ex.id);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-line-soft px-3 py-3 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
                >
                  <div className="min-w-0 flex-1" aria-hidden="true">
                    <p className="truncate text-sm font-medium text-foreground">{ex.name}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.04em] text-ink-3">
                      {ex.equipment} · {ex.muscleGroups.join(" · ")}
                    </p>
                  </div>
                  {inWorkout ? (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      Add again
                    </Badge>
                  ) : (
                    <Plus size={16} aria-hidden />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No exercises found
              </p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

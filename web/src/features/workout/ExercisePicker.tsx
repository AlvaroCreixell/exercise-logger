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

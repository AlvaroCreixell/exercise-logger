import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db/database";
import type { Exercise } from "@/domain/types";

const MUSCLE_GROUP_TABS = [
  "All",
  "Legs",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Core",
  "Full Body",
  "Cardio",
] as const;

interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: Exercise) => void;
  /** Exercise IDs already in the session, to show as "already added". */
  existingExerciseIds?: Set<string>;
}

export default function ExercisePicker({
  open,
  onOpenChange,
  onSelect,
  existingExerciseIds,
}: ExercisePickerProps) {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");

  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);

  const filtered = useMemo(() => {
    if (!allExercises) return [];

    let exercises = allExercises;

    // Filter by muscle group tab (invariant 11: compound groups appear under all matching tabs)
    if (activeTab !== "All") {
      exercises = exercises.filter((e) =>
        e.muscleGroups.some(
          (mg) => mg.toLowerCase() === activeTab.toLowerCase()
        )
      );
    }

    // Filter by search text
    if (search.trim()) {
      const lower = search.toLowerCase();
      exercises = exercises.filter((e) =>
        e.name.toLowerCase().includes(lower)
      );
    }

    // Sort alphabetically
    return exercises.sort((a, b) => a.name.localeCompare(b.name));
  }, [allExercises, activeTab, search]);

  function handleSelect(exercise: Exercise) {
    onSelect(exercise);
    onOpenChange(false);
    setSearch("");
    setActiveTab("All");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-3">
          {/* Search input */}
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Muscle group tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MUSCLE_GROUP_TABS.map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className="shrink-0 text-xs"
              >
                {tab}
              </Button>
            ))}
          </div>

          {/* Exercise list */}
          <ScrollArea className="h-[calc(85vh-180px)]">
            <div className="space-y-1 pr-3">
              {filtered.map((exercise) => {
                const alreadyAdded = existingExerciseIds?.has(exercise.id);
                return (
                  <button
                    key={exercise.id}
                    onClick={() => !alreadyAdded && handleSelect(exercise)}
                    disabled={alreadyAdded}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      alreadyAdded
                        ? "text-muted-foreground opacity-50"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div>
                      <div className="font-medium">{exercise.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {exercise.muscleGroups.join(", ")} · {exercise.equipment}
                      </div>
                    </div>
                    {alreadyAdded && (
                      <span className="text-xs text-muted-foreground">Added</span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No exercises found
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

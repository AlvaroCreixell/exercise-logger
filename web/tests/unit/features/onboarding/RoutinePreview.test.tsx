import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoutinePreview } from "@/features/onboarding/components/RoutinePreview";
import type { Routine, Exercise } from "@/domain/types";

const exercisesById = new Map<string, Exercise>([
  ["barbell-back-squat", { id: "barbell-back-squat", name: "Barbell Back Squat", type: "weight", equipment: "barbell", muscleGroups: ["Legs"] }],
  ["barbell-row", { id: "barbell-row", name: "Barbell Row", type: "weight", equipment: "barbell", muscleGroups: ["Back"] }],
  ["barbell-bench-press", { id: "barbell-bench-press", name: "Barbell Bench Press", type: "weight", equipment: "barbell", muscleGroups: ["Chest"] }],
]);

const routine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "3-Day Split",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 5, maxValue: 8, count: 3 }],
        },
        {
          kind: "superset",
          groupId: "A-e1-group",
          items: [
            { entryId: "A-e1-s0", exerciseId: "barbell-row", setBlocks: [{ targetKind: "reps", exactValue: 10, count: 3 }] },
            { entryId: "A-e1-s1", exerciseId: "barbell-bench-press", setBlocks: [{ targetKind: "reps", exactValue: 10, count: 3 }] },
          ],
        },
      ],
    },
  },
  notes: [],
  cardio: { notes: "Optional, after lifting", options: [{ name: "Walk", detail: "20-30 min" }] },
  importedAt: "2026-07-06T00:00:00.000Z",
};

describe("RoutinePreview", () => {
  it("renders the routine name, day labels, and exercise names", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText("3-Day Split")).toBeInTheDocument();
    expect(screen.getByText(/Full Body/)).toBeInTheDocument();
    expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
  });

  it("formats set blocks and marks supersets", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText("3 × 5–8")).toBeInTheDocument();
    expect(screen.getAllByText("3 × 10")).toHaveLength(2);
    expect(screen.getByText(/superset/i)).toBeInTheDocument();
  });

  it("renders the cardio section when present", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText(/Walk/)).toBeInTheDocument();
    expect(screen.getByText(/20-30 min/)).toBeInTheDocument();
  });

  it("falls back to the exercise id when the catalog entry is missing", () => {
    const strippedMap = new Map<string, Exercise>();
    render(<RoutinePreview routine={routine} exercisesById={strippedMap} />);
    expect(screen.getByText("barbell-back-squat")).toBeInTheDocument();
  });
});

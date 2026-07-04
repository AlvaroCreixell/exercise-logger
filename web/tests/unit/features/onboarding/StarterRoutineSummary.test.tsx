import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarterRoutineSummary } from "@/features/onboarding/components/StarterRoutineSummary";
import type { Routine, Exercise } from "@/domain/types";

const exercise: Exercise = {
  id: "barbell-back-squat",
  name: "Barbell Back Squat",
  type: "weight",
  equipment: "barbell",
  muscleGroups: ["Legs"],
};
const exercisesById = new Map([[exercise.id, exercise]]);

const routine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "Full Body 3-Day Rotation",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A", "B", "C"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Heavy Squat",
      entries: [
        {
          kind: "exercise",
          entryId: "e1",
          exerciseId: exercise.id,
          setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
        },
      ],
    },
    B: { id: "B", label: "Hinge", entries: [] },
    C: { id: "C", label: "Volume", entries: [] },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-04-22T00:00:00.000Z",
};

describe("StarterRoutineSummary", () => {
  it("renders routine name, next day label, and exercise/set counts", () => {
    render(
      <StarterRoutineSummary routine={routine} exercisesById={exercisesById} />
    );
    expect(screen.getByText(/Full Body 3-Day Rotation/)).toBeInTheDocument();
    expect(screen.getByText(/Heavy Squat/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 exercise · 3 sets · first up: Barbell Back Squat/)
    ).toBeInTheDocument();
  });

  it("shows a loading shell when routine is undefined", () => {
    render(
      <StarterRoutineSummary
        routine={undefined}
        exercisesById={exercisesById}
      />
    );
    expect(screen.getByLabelText(/loading starter routine/i)).toBeInTheDocument();
  });

  it("renders nothing when routine is null", () => {
    const { container } = render(
      <StarterRoutineSummary routine={null} exercisesById={exercisesById} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

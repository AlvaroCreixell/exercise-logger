import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB } from "@/db/database";
import ExercisePicker from "@/components/ExercisePicker";
import type { Exercise } from "@/domain/types";

// We need to mock the db import since ExercisePicker uses it directly
vi.mock("@/db/database", async () => {
  const { ExerciseLoggerDB: RealDB } = await vi.importActual<
    typeof import("@/db/database")
  >("@/db/database");

  const testDb = new RealDB();
  return {
    ExerciseLoggerDB: RealDB,
    db: testDb,
    initializeSettings: vi.fn(),
  };
});

const { db } = await import("@/db/database");

const testExercises: Exercise[] = [
  {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  },
  {
    id: "dumbbell-bench-press",
    name: "Dumbbell Bench Press",
    type: "weight",
    equipment: "dumbbell",
    muscleGroups: ["Chest"],
  },
  {
    id: "pull-up",
    name: "Pull-Up",
    type: "bodyweight",
    equipment: "bodyweight",
    muscleGroups: ["Back", "Arms"],
  },
];

describe("ExercisePicker", () => {
  beforeEach(async () => {
    await (db as ExerciseLoggerDB).exercises.bulkPut(testExercises);
  });

  afterEach(async () => {
    await (db as ExerciseLoggerDB).exercises.clear();
  });

  it("renders all exercises when All tab is active", async () => {
    render(
      <ExercisePicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
      expect(screen.getByText("Dumbbell Bench Press")).toBeInTheDocument();
      expect(screen.getByText("Pull-Up")).toBeInTheDocument();
    });
  });

  it("filters by muscle group tab", async () => {
    const user = userEvent.setup();
    render(
      <ExercisePicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Legs" }));

    await waitFor(() => {
      expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
      expect(screen.queryByText("Dumbbell Bench Press")).not.toBeInTheDocument();
    });
  });

  it("shows compound-muscle exercises under all matching tabs (invariant 11)", async () => {
    const user = userEvent.setup();
    render(
      <ExercisePicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pull-Up")).toBeInTheDocument();
    });

    // Pull-Up has muscleGroups: ["Back", "Arms"] -- should appear under Arms tab
    await user.click(screen.getByRole("button", { name: "Arms" }));

    await waitFor(() => {
      expect(screen.getByText("Pull-Up")).toBeInTheDocument();
    });
  });

  it("calls onSelect when an exercise is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ExercisePicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Barbell Back Squat"));

    expect(onSelect).toHaveBeenCalledWith(testExercises[0]);
  });
});

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExercisePicker } from "@/features/workout/ExercisePicker";
import { db } from "@/db/database";

beforeEach(async () => {
  await db.exercises.clear();
  await db.exercises.bulkAdd([
    { id: "bench", name: "Bench Press", equipment: "barbell", muscleGroups: ["chest"], valueKinds: ["weight", "reps"], catalogSource: "seed", createdAt: new Date().toISOString() } as unknown as Parameters<typeof db.exercises.bulkAdd>[0][number],
    { id: "squat", name: "Back Squat", equipment: "barbell", muscleGroups: ["legs"], valueKinds: ["weight", "reps"], catalogSource: "seed", createdAt: new Date().toISOString() } as unknown as Parameters<typeof db.exercises.bulkAdd>[0][number],
    { id: "plank", name: "Plank", equipment: "bodyweight", muscleGroups: ["core"], valueKinds: ["duration"], catalogSource: "seed", createdAt: new Date().toISOString() } as unknown as Parameters<typeof db.exercises.bulkAdd>[0][number],
  ]);
});

afterEach(cleanup);

describe("ExercisePicker", () => {
  it("renders serif title and all exercises when search is empty", async () => {
    render(
      <ExercisePicker
        open={true}
        onOpenChange={() => {}}
        existingExerciseIds={new Set()}
        onPick={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible());
    expect(screen.getByRole("button", { name: /Back Squat/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Plank/ })).toBeVisible();
    expect(screen.getByText(/Pick an exercise/i)).toBeVisible();
  });

  it("filters results as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(
      <ExercisePicker
        open={true}
        onOpenChange={() => {}}
        existingExerciseIds={new Set()}
        onPick={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible());
    const search = screen.getByPlaceholderText(/Search/i);
    await user.type(search, "plan");
    expect(screen.getByRole("button", { name: /Plank/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bench Press/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Back Squat/ })).toBeNull();
  });

  it("shows an empty message when search has no matches", async () => {
    const user = userEvent.setup();
    render(
      <ExercisePicker
        open={true}
        onOpenChange={() => {}}
        existingExerciseIds={new Set()}
        onPick={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible());
    await user.type(screen.getByPlaceholderText(/Search/i), "zzzz");
    expect(screen.getByText(/No exercises found/i)).toBeVisible();
  });

  it("calls onPick with the id and closes the sheet", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ExercisePicker
        open={true}
        onOpenChange={onOpenChange}
        existingExerciseIds={new Set()}
        onPick={onPick}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible());
    await user.click(screen.getByRole("button", { name: /Bench Press/ }));
    expect(onPick).toHaveBeenCalledWith("bench");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("marks exercises already in the workout with an 'In workout' badge", async () => {
    render(
      <ExercisePicker
        open={true}
        onOpenChange={() => {}}
        existingExerciseIds={new Set(["bench"])}
        onPick={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible());
    const benchRow = screen.getByRole("button", { name: /Bench Press/ });
    expect(benchRow).toHaveTextContent(/In workout/i);
    const squatRow = screen.getByRole("button", { name: /Back Squat/ });
    expect(squatRow).not.toHaveTextContent(/In workout/i);
  });

  it("uses the exercise name as the button's accessible name (meta hidden from a11y)", async () => {
    render(
      <ExercisePicker
        open={true}
        onOpenChange={() => {}}
        existingExerciseIds={new Set()}
        onPick={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Bench Press/ })).toBeVisible()
    );
    const benchRow = screen.getByRole("button", { name: /Bench Press/ });
    // Accessible name should be exactly "Bench Press" — NOT
    // "Bench Press barbell · chest".
    expect(benchRow).toHaveAccessibleName("Bench Press");
  });
});

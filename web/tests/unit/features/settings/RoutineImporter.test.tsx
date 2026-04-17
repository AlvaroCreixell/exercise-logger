import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "@/db/database";
import { initializeSettings } from "@/db/database";
import type { Exercise } from "@/domain/types";
import { RoutineImporter } from "@/features/settings/RoutineImporter";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const validYaml = `
version: 1
name: Pasted Routine
rest_default_sec: 90
rest_superset_sec: 60
day_order: [a]
days:
  a:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - reps: 5
            count: 3
`.trim();

async function seed() {
  const exercises: Exercise[] = [
    {
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["quads", "glutes"],
    },
  ];
  await db.exercises.bulkPut(exercises);
}

beforeEach(async () => {
  await initializeSettings(db);
  await seed();
});

afterEach(async () => {
  cleanup();
  await db.routines.clear();
  await db.exercises.clear();
  await db.settings.clear();
});

describe("RoutineImporter — paste flow", () => {
  it("renders instructional copy with a link to the custom GPT", () => {
    render(<RoutineImporter />);
    const link = screen.getByRole("link", { name: /ace logger routine maker/i });
    expect(link).toHaveAttribute(
      "href",
      "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("imports a valid pasted YAML and persists the routine", async () => {
    const user = userEvent.setup();
    render(<RoutineImporter />);

    const textarea = screen.getByLabelText(/paste yaml/i);
    await user.click(textarea);
    await user.paste(validYaml);

    const button = screen.getByRole("button", { name: /import from text/i });
    await user.click(button);

    await waitFor(async () => {
      const routines = await db.routines.toArray();
      expect(routines).toHaveLength(1);
      expect(routines[0].name).toBe("Pasted Routine");
    });

    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("shows validation errors for malformed YAML and does not import", async () => {
    const user = userEvent.setup();
    render(<RoutineImporter />);

    const textarea = screen.getByLabelText(/paste yaml/i);
    await user.click(textarea);
    await user.paste("not: valid: [[[");

    await user.click(screen.getByRole("button", { name: /import from text/i }));

    await waitFor(() => {
      const warning = screen.getByRole("alert");
      expect(warning).toBeVisible();
      expect(warning.textContent).toMatch(/.+/);
    });

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(0);
  });

  it("disables the import button when the textarea is empty", () => {
    render(<RoutineImporter />);
    const button = screen.getByRole("button", { name: /import from text/i });
    expect(button).toBeDisabled();
  });

  it("keeps the file-picker fallback button visible", () => {
    render(<RoutineImporter />);
    expect(
      screen.getByRole("button", { name: /import from file/i })
    ).toBeVisible();
  });
});

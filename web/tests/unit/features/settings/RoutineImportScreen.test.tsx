import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import RoutineImportScreen from "@/features/settings/RoutineImportScreen";

// RoutineImportScreen uses `db.exercises.toArray()` inside runImport. The
// pre-fill test doesn't trigger runImport — it just renders and checks
// textarea value. No Dexie mock needed.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoutineImportScreen — pre-fill from launchYaml", () => {
  it("pre-fills the textarea from location.state.launchYaml", async () => {
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/settings/import", state: { launchYaml: "version: 1\n" } }]}
      >
        <RoutineImportScreen />
      </MemoryRouter>,
    );
    const ta = await screen.findByLabelText(/paste yaml/i);
    expect((ta as HTMLTextAreaElement).value).toContain("version: 1");
  });
});

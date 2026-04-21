import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { useRoutineLaunchQueue } from "@/shared/hooks/useRoutineLaunchQueue";

function Consumer() {
  useRoutineLaunchQueue();
  return null;
}

function LocationProbe({ onLoc }: { onLoc: (pathname: string, state: unknown) => void }) {
  const loc = useLocation();
  onLoc(loc.pathname, loc.state);
  return null;
}

describe("useRoutineLaunchQueue", () => {
  const originalLaunchQueue = (globalThis as { launchQueue?: unknown }).launchQueue;

  afterEach(() => {
    (globalThis as { launchQueue?: unknown }).launchQueue = originalLaunchQueue;
    vi.restoreAllMocks();
  });

  it("is a no-op when launchQueue is absent", () => {
    delete (globalThis as { launchQueue?: unknown }).launchQueue;
    render(
      <MemoryRouter>
        <Consumer />
      </MemoryRouter>,
    );
    // Nothing to assert: the hook must not throw.
    expect(true).toBe(true);
  });

  it("navigates to /settings/import with launchYaml state when a file is handed in", async () => {
    type Consumer = (params: { files: readonly unknown[] }) => Promise<void> | void;
    let consumer: Consumer | null = null;
    (globalThis as { launchQueue?: { setConsumer: (c: Consumer) => void } }).launchQueue = {
      setConsumer: (c) => { consumer = c; },
    };

    const fakeText = "version: 1\nname: Test\n";
    const fakeFile = { text: async () => fakeText };
    const fakeHandle = {
      kind: "file" as const,
      getFile: async () => fakeFile,
    };

    let capturedPath = "";
    let capturedState: unknown = null;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Consumer />
        <Routes>
          <Route path="*" element={<LocationProbe onLoc={(p, s) => { capturedPath = p; capturedState = s; }} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(consumer).not.toBeNull();
    await consumer!({ files: [fakeHandle] });

    // Give React a flush.
    await new Promise((r) => setTimeout(r, 0));

    expect(capturedPath).toBe("/settings/import");
    expect(capturedState).toEqual({ launchYaml: fakeText });
  });
});

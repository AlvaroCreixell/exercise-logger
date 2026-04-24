import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
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
    // The render itself is the assertion: if useRoutineLaunchQueue's effect
    // dereferences a missing launchQueue, render() throws and the test fails.
    expect(() =>
      render(
        <MemoryRouter>
          <Consumer />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it("navigates to /settings/import with launchYaml state when a file is handed in", async () => {
    // Renamed from `LaunchConsumer` to `FileHandlerCallback` to avoid the name
    // echo with `LaunchConsumer` in `useRoutineLaunchQueue.ts` (different
    // shape; the source uses `ReadonlyArray<FileSystemHandle>` while the test
    // uses `readonly unknown[]` for stub flexibility).
    type FileHandlerCallback = (params: { files: readonly unknown[] }) => Promise<void> | void;
    let consumer: FileHandlerCallback | null = null;
    (globalThis as { launchQueue?: { setConsumer: (c: FileHandlerCallback) => void } }).launchQueue = {
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

    // Wrap the consumer invocation in `act` so React flushes the navigate()
    // state update before we assert. Replaces a prior `setTimeout(0)` flush
    // that was not reliable under React 19 concurrent rendering.
    await act(async () => {
      await consumer!({ files: [fakeHandle] });
    });

    // `waitFor` guards against any remaining scheduler churn and makes the
    // assertion deterministic even if LocationProbe re-renders in multiple
    // passes.
    await waitFor(() => {
      expect(capturedPath).toBe("/settings/import");
    });
    expect(capturedState).toEqual({ launchYaml: fakeText });
  });
});

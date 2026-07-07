import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import { useWakeLock } from "@/shared/hooks/useWakeLock";

type Listener = () => void;

function makeFakeSentinel() {
  const listeners = new Map<string, Set<Listener>>();
  const sentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
      for (const l of listeners.get("release") ?? []) l();
    }),
    addEventListener: vi.fn((type: string, cb: Listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(cb);
      listeners.set(type, set);
    }),
    removeEventListener: vi.fn((type: string, cb: Listener) => {
      listeners.get(type)?.delete(cb);
    }),
    /** Simulate a UA-forced release (screen off / battery saver). */
    forceRelease() {
      sentinel.released = true;
      for (const l of listeners.get("release") ?? []) l();
    },
  };
  return sentinel;
}

let visibility: DocumentVisibilityState = "visible";

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useWakeLock", () => {
  let request: ReturnType<typeof vi.fn>;
  let sentinels: ReturnType<typeof makeFakeSentinel>[];

  beforeEach(() => {
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    sentinels = [];
    request = vi.fn(async () => {
      const s = makeFakeSentinel();
      sentinels.push(s);
      return s;
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
  });

  afterEach(() => {
    // Remove the mock so other suites see a clean navigator.
    delete (navigator as unknown as Record<string, unknown>).wakeLock;
  });

  it("acquires a screen lock when enabled", async () => {
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("does not acquire when disabled", async () => {
    renderHook(() => useWakeLock(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(request).not.toHaveBeenCalled();
  });

  it("releases on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(sentinels).toHaveLength(1));
    unmount();
    await waitFor(() => expect(sentinels[0]!.release).toHaveBeenCalled());
  });

  it("releases when enabled flips to false", async () => {
    const { rerender } = renderHook(({ on }) => useWakeLock(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(sentinels).toHaveLength(1));
    rerender({ on: false });
    await waitFor(() => expect(sentinels[0]!.release).toHaveBeenCalled());
  });

  it("re-acquires when the page becomes visible after a UA release", async () => {
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(sentinels).toHaveLength(1));

    // Tab hidden: the UA force-releases the lock.
    setVisibility("hidden");
    sentinels[0]!.forceRelease();
    await new Promise((r) => setTimeout(r, 10));
    expect(request).toHaveBeenCalledTimes(1); // no re-acquire while hidden

    // Back to visible → re-acquire.
    setVisibility("visible");
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("is a silent no-op when the API is unsupported", async () => {
    delete (navigator as unknown as Record<string, unknown>).wakeLock;
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("swallows request rejections (battery saver)", async () => {
    request.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    await waitFor(() => expect(request).toHaveBeenCalled());
  });
});

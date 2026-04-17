import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";

interface FakePromptEvent {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function makeFakePromptEvent(outcome: "accepted" | "dismissed" = "accepted"): Event & FakePromptEvent {
  const ev = new Event("beforeinstallprompt") as Event & FakePromptEvent;
  ev.preventDefault = vi.fn();
  ev.prompt = vi.fn(async () => {});
  ev.userChoice = Promise.resolve({ outcome });
  return ev;
}

describe("useInstallPrompt", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts with canInstall=false", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("becomes canInstall=true when beforeinstallprompt fires", () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent();
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(true);
  });

  it("promptInstall() calls prompt() on the captured event and clears the flag on accepted", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent("accepted");
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(result.current.canInstall).toBe(true);
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(ev.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it("clears the flag on dismissed too", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const ev = makeFakePromptEvent("dismissed");
    act(() => {
      window.dispatchEvent(ev);
    });
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall() is a no-op when canInstall is false", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(result.current.canInstall).toBe(false);
  });
});

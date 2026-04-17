import { useCallback, useEffect, useState } from "react";

/**
 * `BeforeInstallPromptEvent` from the Web App Manifest spec.
 * Non-standard — only Chromium-based browsers implement it today.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The minimal shape we hold in React state — plain data + bound methods,
 *  not a live DOM Event object. Keeps state serialisable-friendly. */
interface DeferredPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Capture the browser's `beforeinstallprompt` event so Settings can
 * surface an explicit "Install App" button. Without this capture, the
 * browser shows its native install banner once; if the user dismisses
 * it, there's no second chance until the browser's own heuristics
 * re-fire the event (which requires re-engagement).
 *
 * Returns:
 *   - canInstall: true when a captured event is available.
 *   - promptInstall(): invokes the native prompt and clears the event
 *     regardless of outcome. Safe to call when canInstall is false
 *     (no-op).
 *
 * After the user accepts or dismisses, the event is consumed and
 * canInstall goes false. The browser may re-fire it later; the hook
 * listens continuously and will re-populate.
 *
 * If beforeinstallprompt fires again while a previous event is still
 * captured, the newer event overrides.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);

  useEffect(() => {
    // Handler is stable — listener added once, removed on unmount.
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      // Store plain bound methods instead of the live Event object — React
      // state should be serialisable-friendly, and we only ever need these
      // two fields.
      setDeferred({
        prompt: evt.prompt.bind(evt),
        userChoice: evt.userChoice,
      });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt
      );
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    // prompt() resolves only after the user responds, so awaiting userChoice
    // afterwards is redundant. Clear the state in finally regardless of the
    // outcome — the browser re-fires beforeinstallprompt if the user becomes
    // eligible again.
    try {
      await deferred.prompt();
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}

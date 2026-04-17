import { useCallback, useEffect, useState } from "react";

/**
 * `BeforeInstallPromptEvent` from the Web App Manifest spec.
 * Non-standard — only Chromium-based browsers implement it today.
 */
interface BeforeInstallPromptEvent extends Event {
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
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
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
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}

import { useEffect, useRef } from "react";

/**
 * Hold a screen wake lock while `enabled` (spec §4.1 of the in-gym hardening
 * plan): phone stays on for the whole session so the visual/haptic rest cues
 * have a visible page to land on.
 *
 * Lifecycle:
 * - Acquire on enable (and only while the document is visible — the API
 *   rejects otherwise).
 * - The UA force-releases on tab hide / screen lock: that is contract, not
 *   error. Re-acquire on `visibilitychange → visible` while still enabled.
 * - A `release` event with the page still visible (battery-saver revocation
 *   that cleared) also triggers one re-acquire attempt.
 * - Release on disable/unmount.
 *
 * Failures (`NotAllowedError`, unsupported browser) are silent no-ops by
 * design — terminal-quiet, nothing in the UI depends on the lock existing.
 */
export function useWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator)) return;
    let cancelled = false;

    function onRelease() {
      sentinelRef.current = null;
      // Hidden-page releases are re-acquired by the visibilitychange handler;
      // acquire() below no-ops while hidden, so this only catches same-page
      // revocations that cleared.
      void acquire();
    }

    async function acquire() {
      if (cancelled) return;
      if (sentinelRef.current !== null) return;
      if (document.visibilityState !== "visible") return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", onRelease);
      } catch {
        // Battery saver / permissions policy / unsupported — silent no-op.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void acquire();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    void acquire();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        sentinel.removeEventListener("release", onRelease);
        sentinel.release().catch(() => {});
      }
    };
  }, [enabled]);
}

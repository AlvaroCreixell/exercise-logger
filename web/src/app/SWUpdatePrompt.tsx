import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * SW update-available prompt.
 *
 * Hooks into vite-plugin-pwa's registration lifecycle. When the service
 * worker detects a new bundle and enters the `waiting` state, we show a
 * sonner toast with a "Reload" action. Tapping the action messages
 * SKIP_WAITING to the waiting SW and reloads the page, swapping the user
 * into the fresh bundle without a manual hard-refresh.
 *
 * This renders nothing visually by itself — it just orchestrates a toast.
 */
export function SWUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err: unknown) {
      console.error("SW registration error", err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast("Update available", {
      description: "A new version is ready.",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      onDismiss: () => setNeedRefresh(false),
      onAutoClose: () => setNeedRefresh(false),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

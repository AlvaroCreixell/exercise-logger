import { useEffect } from "react";
import { useNavigate } from "react-router";

// The Launch Queue API is a File System Access-adjacent surface; it ships on
// Chromium-based browsers (Android Chrome, desktop Chrome/Edge) and is absent
// on Safari/Firefox. Feature-detect before touching.
interface LaunchParams {
  files: ReadonlyArray<FileSystemHandle>;
}

interface LaunchConsumer {
  (params: LaunchParams): Promise<void> | void;
}

interface LaunchQueueLike {
  setConsumer(consumer: LaunchConsumer): void;
}

/**
 * When the app is invoked via `file_handlers` (user opens a .yaml/.yml file
 * with the installed PWA), read the first file and hand the contents to the
 * Import Routine screen via router state.
 */
export function useRoutineLaunchQueue(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const w = window as unknown as { launchQueue?: LaunchQueueLike };
    if (!w.launchQueue) return;

    w.launchQueue.setConsumer(async (params) => {
      if (!params.files || params.files.length === 0) return;
      const handle = params.files[0];
      if (!handle || handle.kind !== "file") return;
      try {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        navigate("/settings/import", { state: { launchYaml: text } });
      } catch {
        // Silent fail — the hook is a best-effort enhancement; the paste flow
        // remains the guaranteed path. Surface errors through the import
        // screen's normal error affordances if/when the user retries.
      }
    });
  }, [navigate]);
}

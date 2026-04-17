import { useState, useEffect } from "react";
import { db, initializeSettings } from "@/db/database";
import { loadEmbeddedCatalog, seedCatalog } from "@/services/catalog-service";
import { validateAndNormalizeRoutine, importRoutine } from "@/services/routine-service";
import { setActiveRoutine } from "@/services/settings-service";
import defaultRoutineYaml from "../../../data/routines/full-body-3day.yaml?raw";

/**
 * Initialize the app on first mount:
 * 1. Ensure the settings record exists (idempotent).
 * 2. Seed or update the exercise catalog from the embedded CSV (idempotent).
 *
 * Returns `{ ready, error }`. Screens should not render until `ready` is true.
 */
export function useAppInit(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await initializeSettings(db);
        const exercises = loadEmbeddedCatalog();
        await seedCatalog(db, exercises);

        // Seed bundled routine if none exist yet (idempotent)
        const routineCount = await db.routines.count();
        if (routineCount === 0) {
          const exerciseLookup = new Map(exercises.map((e) => [e.id, e]));
          const result = await validateAndNormalizeRoutine(defaultRoutineYaml, exerciseLookup);
          if (result.ok) {
            await importRoutine(db, result.routine);
            await setActiveRoutine(db, result.routine.id);
          }
        }

        if (!cancelled) setReady(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "App initialization failed"
          );
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { ready, error };
}

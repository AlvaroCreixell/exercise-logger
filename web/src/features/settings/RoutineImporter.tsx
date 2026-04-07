import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import { toast } from "sonner";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setImporting(true);

    try {
      const yaml = await file.text();

      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));

      const result = validateAndNormalizeRoutine(yaml, lookup);

      if (!result.ok) {
        setErrors(result.errors.map((err) => `${err.path}: ${err.message}`));
        return;
      }

      await importRoutine(db, result.routine);
      toast.success(`Routine "${result.routine.name}" imported`);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? "Importing..." : "Import Routine"}
      </Button>
      {errors.length > 0 && (
        <div className="rounded-lg border border-warning bg-warning-soft p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-warning-foreground">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

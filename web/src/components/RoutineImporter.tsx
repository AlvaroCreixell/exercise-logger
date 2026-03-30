import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import type { ValidationError } from "@/services/routine-service";
import type { Exercise } from "@/domain/types";

interface RoutineImporterProps {
  onImported: () => void;
}

export default function RoutineImporter({ onImported }: RoutineImporterProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setSuccessMessage(null);
    setImporting(true);

    try {
      const text = await file.text();

      // Load all exercises for validation
      const allExercises = await db.exercises.toArray();
      const exerciseLookup = new Map<string, Exercise>();
      for (const ex of allExercises) {
        exerciseLookup.set(ex.id, ex);
      }

      const result = validateAndNormalizeRoutine(text, exerciseLookup);

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      await importRoutine(db, result.routine);
      setSuccessMessage(`Imported "${result.routine.name}" successfully.`);
      onImported();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrors([{ path: "", message }]);
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import routine YAML file"
      />

      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="w-full"
      >
        <Upload className="mr-2 h-4 w-4" />
        {importing ? "Importing..." : "Import Routine (YAML)"}
      </Button>

      {successMessage && (
        <Card className="border-green-500/30 bg-green-500/10">
          <CardContent className="py-2 text-sm text-green-700 dark:text-green-300">
            {successMessage}
          </CardContent>
        </Card>
      )}

      {errors.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="py-2 space-y-1">
            {errors.map((err, idx) => (
              <p key={idx} className="text-sm text-destructive">
                {err.path && (
                  <span className="font-mono text-xs">{err.path}: </span>
                )}
                {err.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

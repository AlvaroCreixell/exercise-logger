import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { db } from "@/db/database";
import { validateParseAndImportRoutine } from "@/services/routine-service";
import { toast } from "sonner";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function runImport(yamlText: string) {
    setErrors([]);
    setImporting(true);
    try {
      const result = await validateParseAndImportRoutine(db, yamlText);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      toast.success(`Routine "${result.routineName}" imported`);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const yaml = await file.text();
    await runImport(yaml);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        <div className="border border-warning bg-warning-soft p-3 space-y-1">
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

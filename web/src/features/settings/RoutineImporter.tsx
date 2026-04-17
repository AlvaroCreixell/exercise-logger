import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { db } from "@/db/database";
import { validateParseAndImportRoutine } from "@/services/routine-service";
import { toast } from "sonner";

const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [pastedYaml, setPastedYaml] = useState("");

  async function runImport(yamlText: string): Promise<boolean> {
    setErrors([]);
    setImporting(true);
    try {
      const result = await validateParseAndImportRoutine(db, yamlText);
      if (!result.ok) {
        setErrors(result.errors);
        return false;
      }
      toast.success(`Routine "${result.routineName}" imported`);
      setErrors([]);
      return true;
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
      return false;
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

  async function handlePaste() {
    const ok = await runImport(pastedYaml);
    if (ok) setPastedYaml("");
  }

  const canImportPaste = !importing && pastedYaml.trim().length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Go to{" "}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cta underline underline-offset-2 font-medium"
        >
          Ace Logger Routine Maker
        </a>{" "}
        and chat with the GPT about your personalized routine. Copy the YAML
        answer and paste it below.
      </p>

      <div className="space-y-2">
        <label htmlFor="routine-yaml-paste" className="block">
          <SectionHeader>Paste YAML</SectionHeader>
        </label>
        <Textarea
          id="routine-yaml-paste"
          rows={8}
          placeholder="version: 1&#10;name: ..."
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          disabled={importing}
        />
        <Button
          variant="default"
          className="w-full"
          disabled={!canImportPaste}
          onClick={handlePaste}
        >
          {importing ? "Importing..." : "Import from text"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Have a YAML file on your device? Use the file picker instead:
        </p>
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
          {importing ? "Importing..." : "Import from file"}
        </Button>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="border border-warning bg-warning-soft p-3 space-y-1"
        >
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

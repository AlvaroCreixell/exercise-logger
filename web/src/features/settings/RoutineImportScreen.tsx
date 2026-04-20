import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Back } from "@/shared/icons";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { YamlErrorList } from "./YamlErrorList";
import { toast } from "sonner";

const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";

export default function RoutineImportScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [pastedYaml, setPastedYaml] = useState("");
  const navigate = useNavigate();

  async function runImport(yamlText: string): Promise<boolean> {
    if (!yamlText.trim()) {
      setErrors([{ path: "", message: "YAML is empty" }]);
      return false;
    }
    setErrors([]);
    setImporting(true);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yamlText, lookup);
      if (!result.ok) {
        setErrors(result.errors);
        return false;
      }
      await importRoutine(db, result.routine);
      toast.success(`Routine "${result.routine.name}" imported`);
      navigate("/settings");
      return true;
    } catch (err) {
      setErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
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
    await runImport(pastedYaml);
  }

  const canImport = !importing && pastedYaml.trim().length > 0;

  return (
    <div className="space-y-5 p-5 pb-8">
      <Link
        to="/settings"
        aria-label="Back to Settings"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-foreground hover:bg-sage-soft/50 transition-colors"
      >
        <Back />
      </Link>

      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Routine</p>
        <h1 className="text-hero-serif text-foreground">Import routine</h1>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">
        Go to{" "}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sage-deep underline underline-offset-2"
        >
          Ace Logger Routine Maker
        </a>{" "}
        and chat with the GPT about your personalised routine. Copy the YAML
        answer and paste it below.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="routine-yaml-paste"
          className="text-eyebrow text-ink-3"
        >
          Paste YAML
        </label>
        <textarea
          id="routine-yaml-paste"
          rows={10}
          placeholder="version: 1&#10;name: ..."
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          disabled={importing}
          className="w-full rounded-[var(--radius-card)] border border-line bg-card px-3 py-2 font-mono text-sm text-foreground transition-colors focus-visible:border-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:opacity-50"
        />
      </div>

      <Button
        variant="default"
        size="lg"
        className="w-full"
        disabled={!canImport}
        onClick={handlePaste}
      >
        {importing ? "Importing…" : "Replace active routine"}
      </Button>

      <div className="space-y-2">
        <p className="text-meta">Or import a file on your device:</p>
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
          {importing ? "Importing…" : "Import from file"}
        </Button>
      </div>

      <YamlErrorList errors={errors} />
    </div>
  );
}

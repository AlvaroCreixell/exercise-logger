import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { Button } from "@/shared/ui/button";
import { Back } from "@/shared/icons";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { markOnboardingCompleted } from "@/services/onboarding-service";
import { clearWizardState } from "@/features/onboarding/lib/session-storage";
import { YamlErrorList } from "./YamlErrorList";
import { PromptHeading } from "@/shared/components/PromptHeading";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { extractSharedYaml } from "@/shared/lib/extractSharedYaml";
import { toast } from "sonner";

export default function RoutineImportScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [pastedYaml, setPastedYaml] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { launchYaml?: string } | null;
    if (state?.launchYaml && !pastedYaml) {
      setPastedYaml(state.launchYaml);
    }
  }, [location.state, pastedYaml]);

  async function runImport(rawText: string): Promise<boolean> {
    // Tolerate chat-app shapes: ```yaml fences and surrounding prose from
    // ChatGPT shares/copies are unwrapped before validation.
    const yamlText = extractSharedYaml(rawText);
    if (!yamlText) {
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
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        setErrors([{ path: "", message: activation.message }]);
        return false;
      }
      // A successful import fulfills the onboarding round-trip regardless of
      // entry path (share sheet, clipboard, file, manual paste, or the new
      // generation flow). Mark onboarding completed so the first-run gate
      // never bounces the user back into onboarding, and clear any
      // in-progress wizard state so it doesn't linger.
      const current = await db.settings.get("user");
      if (
        current &&
        current.onboardingCompletedAt === null &&
        current.onboardingSkippedAt === null
      ) {
        await markOnboardingCompleted(db);
      }
      clearWizardState();
      toast.success(`Routine "${result.routine.name}" imported and activated`);
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

  async function handleClipboardPaste() {
    try {
      if (!navigator.clipboard?.readText) {
        toast.error("Clipboard unavailable — long-press the box to paste manually");
        return;
      }
      const text = await navigator.clipboard.readText();
      const yaml = extractSharedYaml(text);
      if (!yaml) {
        toast.error("Clipboard is empty");
        return;
      }
      setPastedYaml(yaml);
    } catch {
      toast.error("Clipboard unavailable — long-press the box to paste manually");
    }
  }

  const canImport = !importing && pastedYaml.trim().length > 0;

  return (
    <div className="space-y-5 p-5 pb-8">
      <Link
        to="/settings"
        aria-label="Back to Settings"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-foreground hover:bg-accent-cli-soft/50 transition-colors"
      >
        <Back />
      </Link>

      <div className="space-y-1">
        <SectionHeader>Routine</SectionHeader>
        <PromptHeading command="Import routine" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="routine-yaml-paste"
            className="text-eyebrow text-ink-3"
          >
            Paste YAML
          </label>
          <button
            type="button"
            onClick={handleClipboardPaste}
            disabled={importing}
            className="rounded-[var(--radius-pill)] border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-3 transition-colors hover:border-accent-cli hover:text-accent-cli-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 disabled:opacity-50"
          >
            Paste from clipboard
          </button>
        </div>
        <textarea
          id="routine-yaml-paste"
          rows={10}
          placeholder="version: 1&#10;name: ..."
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          disabled={importing}
          className="w-full rounded-[var(--radius-card)] border border-line bg-card px-3 py-2 font-mono text-sm text-foreground transition-colors focus-visible:border-accent-cli focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 disabled:opacity-50"
        />
      </div>

      <Button
        variant="default"
        size="lg"
        className="w-full"
        disabled={!canImport}
        onClick={handlePaste}
      >
        {importing ? "Importing…" : "Import and activate routine"}
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

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import {
  saveGeneratedPrompt,
  clearLastPrompt,
  markOnboardingCompleted,
} from "@/services/onboarding-service";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import {
  clearWizardState,
  loadWizardState,
} from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { YamlErrorList } from "@/features/settings/YamlErrorList";

type CopyState = "idle" | "copied" | "blocked";

export default function HandoffScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const justCompleted =
    (location.state as { justCompleted?: boolean } | null)?.justCompleted ===
    true;

  const [promptExpanded, setPromptExpanded] = useState(true);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [yaml, setYaml] = useState("");
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [activeBlockMessage, setActiveBlockMessage] = useState<string | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);

  // Resolve the prompt: prefer settings.lastGeneratedPrompt; otherwise build
  // from sessionStorage when justCompleted=true.
  const prompt = useMemo<string | null>(() => {
    if (settings?.lastGeneratedPrompt != null && settings.lastGeneratedPrompt !== "") {
      return settings.lastGeneratedPrompt;
    }
    if (!justCompleted) return null;
    const wiz = loadWizardState();
    if (wiz === null) return null;
    try {
      return buildPrompt(wiz.answers);
    } catch {
      return null;
    }
  }, [settings?.lastGeneratedPrompt, justCompleted]);

  // Persist a freshly built prompt exactly once. The service resets
  // onboardingBannerDismissedAt — do NOT duplicate that here.
  useEffect(() => {
    if (!prompt) return;
    if (settings?.lastGeneratedPrompt != null && settings.lastGeneratedPrompt !== "") return;
    void saveGeneratedPrompt(db, prompt);
  }, [prompt, settings?.lastGeneratedPrompt]);

  // Defensive in-component redirect — mirrors the AppRoutes guard so this
  // screen stays correct in isolation. Skip once onboarding is completed
  // (Stage-2 success nulls the prompt before navigating away).
  useEffect(() => {
    if (!settings) return;
    if (settings.onboardingCompletedAt !== null) return;
    const hasPrompt =
      settings.lastGeneratedPrompt != null && settings.lastGeneratedPrompt !== "";
    // No prompt and no just-completed flag → user is on the wrong screen.
    if (!hasPrompt && !justCompleted) {
      navigate("/onboarding/questionnaire", { replace: true });
      return;
    }
    // justCompleted=true but `prompt` resolved to null — wizard state was lost
    // (private browsing, storage clear) or buildPrompt threw. Redirect rather
    // than render a blank screen.
    if (justCompleted && prompt === null) {
      navigate("/onboarding/questionnaire", { replace: true });
    }
  }, [settings, justCompleted, prompt, navigate]);

  if (!settings) return null;
  if (prompt === null) return null;

  async function handleCopy() {
    if (!prompt) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("blocked");
      setPromptExpanded(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("blocked");
      setPromptExpanded(true);
    }
  }

  async function handleImport() {
    if (importing) return;
    if (yaml.trim() === "") {
      setImportErrors([{ path: "", message: "YAML is empty" }]);
      return;
    }
    setImporting(true);
    setImportErrors([]);
    setActiveBlockMessage(null);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yaml, lookup);
      if (!result.ok) {
        setImportErrors(result.errors);
        return;
      }
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        setActiveBlockMessage(activation.message);
        return;
      }
      await markOnboardingCompleted(db);
      await clearLastPrompt(db);
      clearWizardState();
      navigate("/", { replace: true });
    } catch (err) {
      setImportErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
    } finally {
      setImporting(false);
    }
  }

  function handleExit() {
    navigate("/", { replace: true });
  }

  async function handleStartOver() {
    await clearLastPrompt(db);
    clearWizardState();
    navigate("/onboarding/questionnaire", { replace: true });
  }

  const copyLabel =
    copyState === "copied" ? "Copied" : copyState === "blocked" ? "Copy failed" : "Copy prompt";

  return (
    <>
      <div className="flex min-h-full flex-col gap-5 px-6 py-8">
        <div className="flex items-start justify-between">
          <p className="text-eyebrow text-ink-2">READY TO IMPORT</p>
          <button
            type="button"
            aria-label="Exit"
            onClick={() => setExitOpen(true)}
            className="text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-hero-serif italic text-ink">
            Copy your prompt, then bring back the YAML.
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            The saved prompt below stays on this device. Copy it (or select it
            manually), open the routine-maker GPT, and paste the resulting YAML
            in the box at the bottom of this screen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleCopy}>{copyLabel}</Button>
          <a
            href={GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-[var(--radius-pill)] bg-ink px-4 py-2 text-sm text-paper hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
          >
            Open GPT →
          </a>
          <button
            type="button"
            onClick={() => setPromptExpanded((v) => !v)}
            aria-pressed={promptExpanded}
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            {promptExpanded ? "Hide prompt" : "Show prompt"}
          </button>
        </div>

        {copyState === "blocked" && (
          <p
            role="alert"
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-paper px-3 py-2 text-sm text-ink-2"
          >
            Clipboard access was blocked. Select and copy the prompt above
            manually — long-press on iPhone to bring up the selection menu.
          </p>
        )}

        {promptExpanded && (
          <Textarea
            aria-label="Generated prompt"
            value={prompt}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-48 font-mono text-xs bg-paper"
          />
        )}

        <hr className="border-[var(--line-soft)]" />

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-ink-2">PASTE YAML</p>
          <Textarea
            aria-label="YAML"
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder="Paste the YAML the GPT gave you here"
            className="min-h-48 font-mono text-xs bg-paper"
          />
          <YamlErrorList errors={importErrors} />
          {activeBlockMessage && (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {activeBlockMessage}
            </p>
          )}
          <Button onClick={handleImport} disabled={importing}>
            Import routine →
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStartOverOpen(true)}
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Start over
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Exit?"
        description="Your saved prompt and answers stay on this device. You can come back from the Today banner or Settings."
        confirmText="Exit"
        onConfirm={handleExit}
      />
      <ConfirmDialog
        open={startOverOpen}
        onOpenChange={setStartOverOpen}
        title="Start over?"
        description="This clears your saved prompt and questionnaire answers."
        confirmText="Start over"
        onConfirm={handleStartOver}
        variant="destructive"
      />
    </>
  );
}

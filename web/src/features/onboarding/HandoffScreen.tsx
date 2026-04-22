import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import {
  saveGeneratedPrompt,
  clearLastPrompt,
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
import { nowISO } from "@/domain/timestamp";
import {
  validateAndNormalizeRoutine,
  importAndActivateRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { YamlErrorList } from "@/features/settings/YamlErrorList";

type Stage = "stage1" | "handoff-complete";

export default function HandoffScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const justCompleted =
    (location.state as { justCompleted?: boolean } | null)?.justCompleted ===
    true;

  const [localStage, setLocalStage] = useState<Stage>("stage1");
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);

  // Guard: redirect when no prompt saved AND no just-completed flag.
  // Skip once onboarding is completed — Stage 2 nulls the prompt on success
  // and hands off to `navigate("/")`; we must not redirect to questionnaire.
  useEffect(() => {
    if (!settings) return;
    if (settings.onboardingCompletedAt !== null) return;
    if (
      settings.lastGeneratedPrompt === null &&
      !justCompleted &&
      localStage === "stage1"
    ) {
      navigate("/onboarding/questionnaire", { replace: true });
    }
  }, [settings, justCompleted, localStage, navigate]);

  if (!settings) return null;

  const stage: "stage1" | "stage2" =
    localStage === "handoff-complete" || settings.lastGeneratedPrompt !== null
      ? "stage2"
      : "stage1";

  // Preview content (only relevant on Stage 1).
  let promptPreview = "";
  if (stage === "stage1") {
    const wiz = loadWizardState();
    try {
      if (wiz !== null) promptPreview = buildPrompt(wiz.answers);
    } catch {
      promptPreview = "";
    }
  } else {
    promptPreview = settings.lastGeneratedPrompt ?? "";
  }

  async function handleStage1Button() {
    if (busy) return;
    const wiz = loadWizardState();
    if (wiz === null) {
      toast.error("No answers found. Restart the questionnaire.");
      return;
    }
    let prompt: string;
    try {
      prompt = buildPrompt(wiz.answers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build prompt");
      return;
    }
    setBusy(true);
    try {
      await saveGeneratedPrompt(db, prompt);
      let clipboardOk = true;
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        clipboardOk = false;
        toast.error("Clipboard blocked — copy manually.");
        setShowPrompt(true);
      }
      const opened = window.open(GPT_URL, "_blank", "noopener,noreferrer");
      if (opened === null) {
        setPopupBlocked(true);
        toast.error("Popup blocked — use the inline link.");
      } else if (clipboardOk) {
        toast.success("Prompt copied · GPT opening in a new tab");
      }
      setLocalStage("handoff-complete");
    } finally {
      setBusy(false);
    }
  }

  function handleExit() {
    clearWizardState();
    navigate("/", { replace: true });
  }

  async function handleStartOver() {
    if (settings && settings.lastGeneratedPrompt !== null) {
      await clearLastPrompt(db);
    }
    clearWizardState();
    navigate("/onboarding/questionnaire", { replace: true });
  }

  // Always-rendered dialogs — available in both Stage 1 and Stage 2.
  const dialogs = (
    <>
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Exit?"
        description="Your answers won't be saved."
        confirmText="Exit"
        onConfirm={handleExit}
      />
      <ConfirmDialog
        open={startOverOpen}
        onOpenChange={setStartOverOpen}
        title="Start over?"
        description="This clears your current answers."
        confirmText="Start over"
        onConfirm={handleStartOver}
      />
    </>
  );

  if (stage === "stage1") {
    return (
      <>
        <div className="flex min-h-full flex-col gap-5 px-6 py-8">
          <div className="flex items-start justify-between">
            <p className="text-eyebrow text-ink-3">READY</p>
            <button
              type="button"
              aria-label="Exit"
              onClick={() => setExitOpen(true)}
              className="text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-hero-serif italic text-ink">
              Ready to build your routine?
            </h1>
            <p className="text-sm text-ink-2 leading-relaxed">
              Tap below to copy your prompt and open the routine-maker GPT.
              Paste it there, then switch back here with the YAML.
            </p>
          </div>

          <Button onClick={handleStage1Button} disabled={busy}>
            Copy prompt & open GPT →
          </Button>

          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            aria-pressed={showPrompt}
            className="self-start text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            {showPrompt ? "Hide prompt" : "Show prompt"}
          </button>

          {showPrompt && (
            <Textarea
              value={promptPreview}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-48 font-mono text-xs bg-paper"
            />
          )}

          <button
            type="button"
            onClick={() => setStartOverOpen(true)}
            className="self-start text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
          >
            Start over
          </button>
        </div>
        {dialogs}
      </>
    );
  }

  // Stage 2 — the paste form.
  return (
    <>
      <Stage2
        popupBlocked={popupBlocked}
        onStartOver={() => setStartOverOpen(true)}
      />
      {dialogs}
    </>
  );
}

function Stage2({
  popupBlocked,
  onStartOver,
}: {
  popupBlocked: boolean;
  onStartOver: () => void;
}) {
  const navigate = useNavigate();
  const [yaml, setYaml] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setYaml(text);
    } catch {
      toast.error("Couldn't read clipboard. Long-press to paste manually.");
    }
  }

  async function handleImport() {
    if (importing) return;
    if (yaml.trim() === "") {
      setErrors([{ path: "", message: "YAML is empty" }]);
      return;
    }
    setImporting(true);
    setErrors([]);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yaml, lookup);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      const activation = await importAndActivateRoutine(db, result.routine);
      if (!activation.ok) {
        toast.error(activation.message);
        return;
      }
      await db.settings.update("user", {
        onboardingCompletedAt: nowISO(),
        lastGeneratedPrompt: null,
        lastGeneratedPromptAt: null,
        onboardingBannerDismissedAt: null,
      });
      clearWizardState();
      toast.success("Routine imported. Time to train.");
      navigate("/", { replace: true });
    } catch (err) {
      setErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-3">YOUR TURN</p>
        <h1 className="text-hero-serif italic text-ink">
          Paste your routine when you're back.
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          When the GPT gives you YAML, copy it and paste it below.
        </p>
      </div>

      {popupBlocked && (
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm text-sage-deep underline"
        >
          Open GPT
        </a>
      )}

      <button
        type="button"
        onClick={handlePasteFromClipboard}
        className="self-start rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-sage-soft/50"
      >
        Paste from clipboard
      </button>

      <Textarea
        aria-label="YAML"
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        placeholder="Paste your YAML here"
        className="min-h-48 font-mono text-xs bg-paper"
      />

      <YamlErrorList errors={errors} />

      <Button onClick={handleImport} disabled={importing}>
        Import routine →
      </Button>

      <button
        type="button"
        onClick={onStartOver}
        className="self-start text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
      >
        Start over
      </button>
    </div>
  );
}

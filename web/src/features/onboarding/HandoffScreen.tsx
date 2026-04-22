import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import { saveGeneratedPrompt } from "@/services/onboarding-service";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import { loadWizardState } from "@/features/onboarding/lib/session-storage";
import { GPT_URL } from "@/shared/lib/gpt-url";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

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

  // Guard: redirect when no prompt saved AND no just-completed flag.
  useEffect(() => {
    if (!settings) return;
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

  if (stage === "stage1") {
    return (
      <div className="flex min-h-full flex-col gap-5 px-6 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-ink-3">READY</p>
          <h1 className="text-hero-serif italic text-ink">
            Ready to build your routine?
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Tap below to copy your prompt and open the routine-maker GPT. Paste
            it there, then switch back here with the YAML.
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
      </div>
    );
  }

  // Stage 2 stub — Task 5 replaces with the full paste form.
  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-3">YOUR TURN</p>
        <h1 className="text-hero-serif italic text-ink">
          Paste your routine when you're back.
        </h1>
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
    </div>
  );
}

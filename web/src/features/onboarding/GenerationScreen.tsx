import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import { setLlmApiKey } from "@/services/settings-service";
import { importAndActivateRoutine } from "@/services/routine-service";
import { markOnboardingCompleted } from "@/services/onboarding-service";
import { generateRoutine } from "@/services/generation-service";
import { createAnthropicProvider } from "@/services/llm/anthropic-provider";
import type { GenerationFailure } from "@/services/llm/types";
import type { Routine } from "@/domain/types";
import {
  loadWizardState,
  clearWizardState,
} from "@/features/onboarding/lib/session-storage";
import { RoutinePreview } from "@/features/onboarding/components/RoutinePreview";
import { YamlErrorList } from "@/features/settings/YamlErrorList";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";

type Phase =
  | { name: "boot" }
  | { name: "generating" }
  | { name: "preview"; routine: Routine }
  | { name: "error"; failure: GenerationFailure };

const ERROR_COPY: Record<GenerationFailure["kind"], string> = {
  "no-api-key": "No API key is configured.",
  auth: "Anthropic rejected the request — check your API key in Settings.",
  "rate-limit": "Anthropic is busy or rate-limited right now. Wait a moment and try again.",
  network: "You're offline — generation needs a connection.",
  validation: "The generated routine didn't pass validation after automatic repairs.",
  unknown: "Generation failed unexpectedly.",
};

export default function GenerationScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [phase, setPhase] = useState<Phase>({ name: "boot" });
  const [keyDraft, setKeyDraft] = useState("");
  const [activationBlock, setActivationBlock] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Note: this is called both from the mount effect (auto-start) and from
  // event handlers (Save key / Regenerate / Try again). It must NOT call
  // setPhase() before its first await — a synchronous setState reachable
  // from the mount effect trips react-hooks/set-state-in-effect. The
  // "generating" view is instead derived at render time for the effect-driven
  // path (see `showGenerating` below); event-handler callers that want an
  // immediate transition set `phase` themselves before calling this.
  const runGeneration = useCallback(async (apiKey: string) => {
    const wizard = loadWizardState();
    if (wizard === null || Object.keys(wizard.answers).length === 0) {
      navigate("/onboarding/questionnaire", { replace: true });
      return;
    }
    const provider = createAnthropicProvider(apiKey);
    const result = await generateRoutine(db, wizard.answers, provider);
    if (result.ok) {
      setPhase({ name: "preview", routine: result.routine });
    } else {
      setPhase({ name: "error", failure: result.failure });
    }
  }, [navigate]);

  // Kick off exactly once when settings resolve (StrictMode-safe via ref).
  // Once generation has started, later settings changes (e.g. the
  // activeRoutineId/onboardingCompletedAt writes from handleAccept) must not
  // re-run the wizard-state check below — clearWizardState() runs just
  // before navigate("/"), and re-checking here would bounce back to the
  // questionnaire, racing with (and sometimes winning over) that navigation.
  //
  // The "no API key" case is intentionally NOT tracked as state set from
  // here — it's derived directly from `settings` at render time (see
  // `showNoKey` below), so this effect only performs real side effects:
  // redirecting away, or kicking off the (async) generation call.
  useEffect(() => {
    if (!settings) return;
    if (startedRef.current) return;
    if (loadWizardState() === null) {
      navigate("/onboarding/questionnaire", { replace: true });
      return;
    }
    if (settings.llmApiKey === "") return;
    startedRef.current = true;
    // runGeneration only calls setPhase() after its internal `await`, once
    // the async generateRoutine() call resolves; the lint's static check
    // can't see that ordering and conservatively flags any effect-invoked
    // function that contains a setPhase() call anywhere in its body. This is
    // the standard "kick off a fetch on mount, setState when it resolves"
    // effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runGeneration(settings.llmApiKey);
  }, [settings, navigate, runGeneration]);

  async function handleSaveKey() {
    const trimmed = keyDraft.trim();
    if (trimmed === "") return;
    await setLlmApiKey(db, trimmed);
    startedRef.current = true;
    setPhase({ name: "generating" });
    void runGeneration(trimmed);
  }

  async function handleAccept(routine: Routine) {
    setActivationBlock(null);
    const activation = await importAndActivateRoutine(db, routine);
    if (!activation.ok) {
      setActivationBlock(activation.message);
      return;
    }
    // First-run only — Settings re-entry must not re-stamp completion (spec).
    if (settings && settings.onboardingCompletedAt === null) {
      await markOnboardingCompleted(db);
    }
    clearWizardState();
    navigate("/", { replace: true });
  }

  function handleRetry() {
    if (!settings || settings.llmApiKey === "") return;
    setPhase({ name: "generating" });
    void runGeneration(settings.llmApiKey);
  }

  if (!settings) return null;

  // Wizard-missing: the effect below will redirect away; render nothing.
  if (phase.name === "boot" && loadWizardState() === null) return null;

  const showNoKey = phase.name === "boot" && settings.llmApiKey === "";
  // Boot phase past the no-key/wizard-missing checks means the mount effect
  // has kicked off generation (or is about to, synchronously next); treat it
  // the same as the explicit "generating" phase set by manual retries.
  const showGenerating = phase.name === "generating" || (phase.name === "boot" && !showNoKey);

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <p className="text-eyebrow text-ink-2">YOUR ROUTINE</p>

      {showNoKey && (
        <div className="flex flex-col gap-3">
          <h1 className="text-hero-serif text-ink">One more thing.</h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Generating a routine needs your Anthropic API key. It stays on this
            device and is only sent to Anthropic.
          </p>
          <Card className="flex flex-col gap-2 px-4 py-3">
            <Input
              aria-label="Anthropic API key"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              className="rounded-[var(--radius-card)] bg-paper font-mono"
            />
            <Button onClick={handleSaveKey} disabled={keyDraft.trim() === ""}>
              Save and generate →
            </Button>
          </Card>
          <Link
            to="/settings/import"
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            No key? Import routine YAML manually instead
          </Link>
        </div>
      )}

      {showGenerating && (
        <div
          role="status"
          className="flex min-h-48 flex-col items-center justify-center gap-3"
        >
          <span
            aria-hidden="true"
            className="animate-glyph-pulse text-2xl text-accent-cli select-none"
          >
            ✻
          </span>
          <p className="text-sm text-ink-2">
            Designing your split… this takes a few seconds.
          </p>
        </div>
      )}

      {phase.name === "preview" && exercises && (
        <div className="flex flex-col gap-4">
          <RoutinePreview
            routine={phase.routine}
            exercisesById={new Map(exercises.map((ex) => [ex.id, ex]))}
          />
          {activationBlock && (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {activationBlock}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={() => void handleAccept(phase.routine)}>
              Use this routine →
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {phase.name === "error" && (
        <div className="flex flex-col gap-3">
          <h1 className="text-hero-serif text-ink">That didn't work.</h1>
          <p role="alert" className="text-sm text-ink-2 leading-relaxed">
            {ERROR_COPY[phase.failure.kind]}
          </p>
          {phase.failure.kind === "validation" && (
            <YamlErrorList errors={phase.failure.validationErrors} />
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry}>Try again</Button>
            {phase.failure.kind === "auth" && (
              <Link
                to="/settings"
                className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                Open Settings →
              </Link>
            )}
            <Link
              to="/settings/import"
              className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Import routine YAML manually instead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { db } from "@/db/database";
import { setUserName } from "@/services/settings-service";
import { markOnboardingSkipped } from "@/services/onboarding-service";
import { useSettings } from "@/shared/hooks/useSettings";
import { useRoutine } from "@/shared/hooks/useRoutine";
import {
  clearWizardState,
  loadWizardState,
} from "@/features/onboarding/lib/session-storage";
import { StarterRoutineSummary } from "./components/StarterRoutineSummary";
import type { Exercise } from "@/domain/types";

export default function OnboardingWelcomeScreen() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const settings = useSettings();
  const routine = useRoutine(settings?.activeRoutineId);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasWizardState, setHasWizardState] = useState(
    () => loadWizardState() !== null
  );
  const [startOverOpen, setStartOverOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Pre-fill name from settings if a value was already saved (defensive — first-run normally has null).
  useEffect(() => {
    if (settings?.userName && name === "") setName(settings.userName);
  }, [settings?.userName, name]);

  const exercisesById = useMemo(() => {
    const m = new Map<string, Exercise>();
    if (exercises) for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  async function persistName() {
    const trimmed = name.trim();
    if (trimmed !== "") await setUserName(db, trimmed);
  }

  async function handleUseStarter() {
    if (busy) return;
    setBusy(true);
    await persistName();
    await markOnboardingSkipped(db);
    navigate("/", { replace: true });
  }

  async function handleBuildOrContinue() {
    if (busy) return;
    setBusy(true);
    await persistName();
    navigate("/onboarding/questionnaire", { replace: true });
  }

  function handleStartOver() {
    clearWizardState();
    setHasWizardState(false);
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-ink-2">STARTER READY</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-hero-serif italic text-ink focus:outline-none"
        >
          Your starter routine is ready.
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          Three rotating days you can train today. Or build a personalized
          routine with the GPT — your call.
        </p>
      </div>

      <StarterRoutineSummary routine={routine} exercisesById={exercisesById} />

      <Button onClick={handleUseStarter} disabled={busy}>
        ▶ Use starter routine
      </Button>

      <div className="flex items-center gap-3 text-meta text-ink-3">
        <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden="true" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="welcome-name" className="text-meta text-ink-2">
          Your name (optional, used in greetings)
        </label>
        <Input
          id="welcome-name"
          aria-label="Your name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-[var(--radius-card)] bg-paper"
        />
      </div>

      <Button variant="outline" onClick={handleBuildOrContinue} disabled={busy}>
        {hasWizardState
          ? "Continue personalized routine"
          : "Build personalized routine"}
      </Button>

      {hasWizardState && (
        <button
          type="button"
          onClick={() => setStartOverOpen(true)}
          className="self-start text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Start over
        </button>
      )}

      <ConfirmDialog
        open={startOverOpen}
        onOpenChange={setStartOverOpen}
        title="Start over?"
        description="This clears your in-progress questionnaire answers. The starter routine stays available."
        confirmText="Start over"
        onConfirm={handleStartOver}
        variant="destructive"
      />
    </div>
  );
}

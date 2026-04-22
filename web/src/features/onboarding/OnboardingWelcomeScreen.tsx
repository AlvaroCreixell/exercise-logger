import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { db } from "@/db/database";
import { setUserName } from "@/services/settings-service";
import { markOnboardingSkipped } from "@/services/onboarding-service";

export default function OnboardingWelcomeScreen() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    const trimmed = name.trim();
    if (trimmed !== "") {
      await setUserName(db, trimmed);
    }
    navigate("/onboarding/questionnaire", { replace: true });
  }

  async function handleSkip() {
    if (busy) return;
    setBusy(true);
    await markOnboardingSkipped(db);
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <div className="text-eyebrow text-ink-3">WELCOME</div>
        <h1 className="text-hero-serif italic text-ink">
          What should we call you?
        </h1>
        <p id="name-hint" className="text-sm text-ink-2 leading-relaxed">
          We'll use this as a greeting in the app — like "Hi, Alvaro." You can
          change it anytime in Settings, or skip for now.
        </p>
      </div>

      <Input
        ref={inputRef}
        aria-label="Your name"
        aria-describedby="name-hint"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleStart();
          }
        }}
        placeholder="Your name"
        className="rounded-[var(--radius-card)] bg-paper"
      />

      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={handleStart} disabled={busy}>Start</Button>
        <Button variant="outline" onClick={handleSkip} disabled={busy}>
          Maybe later
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { db } from "@/db/database";
import { clearLastPrompt } from "@/services/onboarding-service";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import type { Settings } from "@/domain/types";

export interface LastPromptCardProps {
  settings: Settings;
}

function relativeTime(iso: string | null): string {
  if (iso === null) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function LastPromptCard({ settings }: LastPromptCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);

  if (settings.lastGeneratedPrompt === null) return null;

  const prompt = settings.lastGeneratedPrompt;
  const when = relativeTime(settings.lastGeneratedPromptAt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Clipboard blocked — copy manually.");
      setExpanded(true);
    }
  };

  const handleClear = async () => {
    await clearLastPrompt(db);
    toast.success("Saved prompt cleared");
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-accent-cli-soft border border-[var(--line)] p-4 space-y-3"
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-eyebrow text-accent-cli-bright">Saved prompt</p>
        <p className="text-meta">{when}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-accent-cli-soft/50"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => navigate("/onboarding/handoff")}
          className="rounded-[var(--radius-pill)] bg-ink px-3 py-1.5 text-sm text-paper hover:opacity-90"
        >
          Paste YAML
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm hover:bg-accent-cli-soft/50"
        >
          {expanded ? "Hide prompt" : "Show prompt"}
        </button>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="rounded-[var(--radius-pill)] border border-[var(--line)] bg-paper px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5"
        >
          Clear
        </button>
      </div>
      {expanded && (
        <Textarea
          aria-label="Generated prompt"
          value={prompt}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-48 font-mono text-xs bg-paper"
        />
      )}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear saved prompt?"
        description="You'll need to re-run the questionnaire to generate a new one."
        confirmText="Clear"
        onConfirm={handleClear}
        variant="destructive"
      />
    </div>
  );
}

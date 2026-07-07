import { useState } from "react";
import { db } from "@/db/database";
import { setLlmApiKey } from "@/services/settings-service";
import { testAnthropicKey } from "@/services/llm/anthropic-provider";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

function maskKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `${"•".repeat(8)}…${key.slice(-3)}`;
}

export function LlmKeyCard({ llmApiKey }: { llmApiKey: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const hasKey = llmApiKey !== "";

  async function handleSave() {
    await setLlmApiKey(db, draft);
    setDraft("");
    setEditing(false);
    setTestResult(null);
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAnthropicKey(llmApiKey));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="py-0">
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent-cli-soft/40"
        >
          <span className="text-sm font-medium">Anthropic API key</span>
          <span className={cn("text-sm font-mono", !hasKey && "italic font-sans text-ink-3")}>
            {hasKey ? maskKey(llmApiKey) : "Not set"}
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-2 px-4 py-3">
          <Input
            aria-label="Anthropic API key"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            className="rounded-[var(--radius-card)] bg-paper font-mono"
          />
          <p className="text-meta">
            Stays on this device. Used only to call Anthropic when generating a routine.
          </p>
          <div className="flex gap-2 self-end">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
      {!editing && hasKey && (
        <div className="border-t border-line px-4 py-3">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {testResult && (
            <p
              role="status"
              className={cn(
                "mt-2 text-sm",
                testResult.ok ? "text-ink-2" : "text-destructive"
              )}
            >
              {testResult.message}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

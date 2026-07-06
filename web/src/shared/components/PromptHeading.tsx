import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface PromptHeadingProps {
  /** Semantic heading text; rendered lowercase via CSS only. */
  command: React.ReactNode;
  /** Optional decorative flag suffix, e.g. "--active". */
  detail?: string;
  className?: string;
  as?: "h1" | "h2" | "p";
}

/**
 * Claude Code prompt-style screen heading: `❯ command ▌`.
 * Glyphs are decorative (aria-hidden); the accessible name is `command` alone.
 */
export function PromptHeading({
  command,
  detail,
  className,
  as: Tag = "h1",
}: PromptHeadingProps) {
  return (
    <Tag
      className={cn(
        "flex items-baseline gap-2 text-2xl font-semibold lowercase tracking-tight text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="text-accent-cli select-none">
        ❯
      </span>
      <span className="min-w-0 truncate">{command}</span>
      {detail && (
        <span
          aria-hidden="true"
          className="shrink-0 text-sm font-medium text-ink-3"
        >
          {detail}
        </span>
      )}
      <span
        aria-hidden="true"
        className="animate-cursor-blink shrink-0 text-accent-cli select-none"
      >
        ▌
      </span>
    </Tag>
  );
}

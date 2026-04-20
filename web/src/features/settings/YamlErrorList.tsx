import type { ValidationError } from "@/services/routine-service";
import { formatErrorPath } from "./lib/formatErrorPath";

interface YamlErrorListProps {
  errors: ValidationError[];
}

export function YamlErrorList({ errors }: YamlErrorListProps) {
  if (errors.length === 0) return null;

  const summary = `${errors.length} ${errors.length === 1 ? "error" : "errors"}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3"
    >
      <p className="text-eyebrow text-destructive">
        {summary}
      </p>
      <ul className="space-y-2">
        {errors.map((err, i) => (
          <li key={i} className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {formatErrorPath(err.path)}
            </p>
            <p className="text-sm text-foreground">{err.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

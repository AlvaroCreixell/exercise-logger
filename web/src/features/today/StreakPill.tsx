import { Flame } from "@/shared/icons";

interface StreakPillProps {
  count: number;
}

export function StreakPill({ count }: StreakPillProps) {
  if (count <= 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1 text-xs font-medium text-accent-cli-bright"
      role="status"
      aria-label={`${count} ${count === 1 ? "session" : "sessions"} this week`}
    >
      <span aria-hidden="true" className="text-ink-3 select-none">[</span>
      <Flame size={13} />
      <span>
        {count} {count === 1 ? "session" : "sessions"} this week
      </span>
      <span aria-hidden="true" className="text-ink-3 select-none">]</span>
    </div>
  );
}

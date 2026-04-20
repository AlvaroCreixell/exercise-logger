import { Flame } from "@/shared/icons";

interface StreakPillProps {
  count: number;
}

export function StreakPill({ count }: StreakPillProps) {
  if (count <= 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-sage-soft text-sage-deep px-3 py-1 text-xs font-medium"
      role="status"
      aria-label={`${count} ${count === 1 ? "session" : "sessions"} this week`}
    >
      <Flame size={13} />
      <span>
        {count} {count === 1 ? "session" : "sessions"} this week
      </span>
    </div>
  );
}

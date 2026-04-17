interface SetDotsProps {
  total: number;
  current: number;
}

export function SetDots({ total, current }: SetDotsProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`Set ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === current;
        return (
          <span
            key={i}
            data-dot
            data-state={isActive ? "active" : "inactive"}
            className={
              isActive
                ? "h-2.5 w-2.5 rounded-full bg-cta"
                : "h-2 w-2 rounded-full border border-border-strong bg-background"
            }
          />
        );
      })}
    </div>
  );
}

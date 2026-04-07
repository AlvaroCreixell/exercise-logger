import type { Routine } from "@/domain/types";

interface DaySelectorProps {
  routine: Routine;
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DaySelector({
  routine,
  selectedDayId,
  onSelectDay,
}: DaySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
      {routine.dayOrder.map((dayId) => {
        const day = routine.days[dayId];
        if (!day) return null;
        const isSelected = dayId === selectedDayId;
        const isSuggested = dayId === routine.nextDayId;

        return (
          <button
            key={dayId}
            onClick={() => onSelectDay(dayId)}
            className={`relative shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isSelected
                ? "bg-info text-info-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>
              {dayId} — {day.label}
            </span>
            {isSuggested && !isSelected && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-info" />
            )}
          </button>
        );
      })}
    </div>
  );
}

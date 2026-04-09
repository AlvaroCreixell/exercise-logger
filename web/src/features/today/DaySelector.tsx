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
  const selectedDay = routine.days[selectedDayId];
  const selectedLabel = selectedDay?.label ?? selectedDayId;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-cta">
        Day {selectedDayId} — {selectedLabel}
      </p>
      <div className="border-t-2 border-border-strong" />
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
        {routine.dayOrder.map((dayId, i) => {
          const isSelected = dayId === selectedDayId;
          const isSuggested = dayId === routine.nextDayId;
          return (
            <button
              key={dayId}
              onClick={() => onSelectDay(dayId)}
              className={`relative shrink-0 px-4 py-2 text-sm font-semibold transition-colors border-[1.5px] border-border-strong focus-visible:ring-2 focus-visible:ring-cta/30 ${
                i > 0 ? "-ml-[1.5px]" : ""
              } ${
                isSelected
                  ? "bg-primary text-primary-foreground z-10"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{dayId}</span>
              {isSuggested && !isSelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cta" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

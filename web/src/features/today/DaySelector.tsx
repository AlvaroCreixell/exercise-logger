import type { Routine } from "@/domain/types";
import { Pill } from "@/shared/components/Pill";

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
    <div>
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
        {routine.dayOrder.map((dayId, i) => (
          <Pill
            key={dayId}
            onClick={() => onSelectDay(dayId)}
            selected={dayId === selectedDayId}
            indicator={dayId === routine.nextDayId}
            aria-label={`Day ${dayId}`}
            className={i > 0 ? "-ml-[1.5px]" : ""}
          >
            {dayId}
          </Pill>
        ))}
      </div>
    </div>
  );
}

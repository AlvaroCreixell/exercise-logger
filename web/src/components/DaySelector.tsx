import { Button } from "@/components/ui/button";
import type { RoutineDay } from "@/domain/types";

interface DaySelectorProps {
  days: Record<string, RoutineDay>;
  dayOrder: string[];
  suggestedDayId: string;
  selectedDayId: string;
  onSelect: (dayId: string) => void;
}

export default function DaySelector({
  days,
  dayOrder,
  suggestedDayId,
  selectedDayId,
  onSelect,
}: DaySelectorProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {dayOrder.map((dayId) => {
        const day = days[dayId];
        if (!day) return null;

        const isSelected = dayId === selectedDayId;
        const isSuggested = dayId === suggestedDayId;

        return (
          <Button
            key={dayId}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(dayId)}
            className={`shrink-0 ${
              isSuggested && !isSelected
                ? "border-primary/50 text-primary"
                : ""
            }`}
          >
            {dayId}
            {isSuggested && !isSelected && (
              <span className="ml-1 text-xs">(next)</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

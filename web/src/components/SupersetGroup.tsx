import type { SessionExercise, LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type {
  ExerciseHistoryData,
} from "@/services/progression-service";
import type { SetLogInput } from "@/services/set-service";
import ExerciseCard from "@/components/ExerciseCard";

interface SupersetGroupProps {
  exercises: Array<{
    sessionExercise: SessionExercise;
    loggedSets: LoggedSet[];
    historyData: ExerciseHistoryData | undefined;
  }>;
  units: UnitSystem;
  isActiveSession: boolean;
  onLogSet: (
    sessionExerciseId: string,
    blockIndex: number,
    setIndex: number,
    input: SetLogInput
  ) => void;
  onDeleteSet: (loggedSetId: string) => void;
}

export default function SupersetGroup({
  exercises,
  units,
  isActiveSession,
  onLogSet,
  onDeleteSet,
}: SupersetGroupProps) {
  return (
    <div className="relative mb-3 flex">
      {/* Vertical connector bar */}
      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/30" />

      <div className="flex-1 pl-3 space-y-0">
        {exercises.map(({ sessionExercise, loggedSets, historyData }) => (
          <ExerciseCard
            key={sessionExercise.id}
            sessionExercise={sessionExercise}
            loggedSets={loggedSets}
            historyData={historyData}
            extraHistory={null}
            units={units}
            isActiveSession={isActiveSession}
            onLogSet={onLogSet}
            onDeleteSet={onDeleteSet}
          />
        ))}
      </div>
    </div>
  );
}

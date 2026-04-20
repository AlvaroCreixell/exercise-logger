import type { SessionExercise, LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";
import { toDisplayWeight } from "@/domain/unit-conversion";
import { Card, CardContent } from "@/shared/ui/card";
import { SetRow } from "./SetRow";
import { formatExerciseTargetLine } from "./lib/formatSetTarget";

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  historyData: ExerciseHistoryData | undefined;
  extraHistory: ExtraExerciseHistory | null | undefined;
  onSetTap: (blockIndex: number, setIndex: number) => void;
  /** Callback when unit toggle is tapped. Undefined = no toggle shown (history view). */
  onUnitToggle?: (newUnit: UnitSystem) => void;
}

/**
 * Format one set from BlockLastTime or ExtraExerciseHistory as "{weight}×{reps}"
 * (no unit suffix — the LAST strip's context makes the unit clear).
 */
function formatHintValue(
  set: { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null },
  units: UnitSystem,
): string | null {
  if (set.weightKg != null && set.reps != null) {
    return `${toDisplayWeight(set.weightKg, units)}×${set.reps}`;
  }
  if (set.reps != null) return `${set.reps}r`;
  if (set.durationSec != null) {
    // Inline the min/sec convention from formatSetTarget
    return set.durationSec >= 60 && set.durationSec % 60 === 0
      ? `${set.durationSec / 60}min`
      : `${set.durationSec}s`;
  }
  if (set.distanceM != null) return `${set.distanceM}m`;
  return null;
}

export function ExerciseCard({
  sessionExercise,
  loggedSets,
  units,
  historyData,
  extraHistory,
  onSetTap,
  onUnitToggle,
}: ExerciseCardProps) {
  const se = sessionExercise;
  const blocks = se.setBlocksSnapshot;
  const isExtra = se.origin === "extra";

  // Build lookup: "{blockIndex}:{setIndex}" → LoggedSet
  const setLookup = new Map<string, LoggedSet>();
  for (const ls of loggedSets) {
    setLookup.set(`${ls.blockIndex}:${ls.setIndex}`, ls);
  }

  const totalPrescribed = blocks.reduce((s, b) => s + b.count, 0);
  const totalLogged = loggedSets.filter((ls) => ls.origin === "routine").length;

  // Flatten history.lastTime across blocks for the LAST strip.
  const lastStripSets = blocks.flatMap((_, i) => historyData?.lastTime[i]?.sets ?? []);
  const lastStripFormatted = lastStripSets
    .map((s) => formatHintValue(s, units))
    .filter((v): v is string => v !== null);

  // For routine exercises, the empty-state row shows a per-block "Tap to log · last {hint}"
  // using the FIRST set of that block's lastTime as the hint.
  function emptyHintForBlock(blockIndex: number): string | undefined {
    const blockLast = historyData?.lastTime[blockIndex];
    const first = blockLast?.sets[0];
    if (!first) return undefined;
    return formatHintValue(first, units) ?? undefined;
  }

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-lg font-bold tracking-tight text-foreground truncate">
              {se.exerciseNameSnapshot}
            </h3>
            {blocks.length > 0 && (
              <p className="text-meta tabular-nums">
                {formatExerciseTargetLine(blocks)}
              </p>
            )}
          </div>
          {totalPrescribed > 0 && (
            <span
              aria-label={`${totalLogged} of ${totalPrescribed} sets logged`}
              className="shrink-0 text-xs font-semibold text-ink-3 tabular-nums"
            >
              {totalLogged}/{totalPrescribed}
            </span>
          )}
          {onUnitToggle && (
            <button
              type="button"
              className="shrink-0 rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-3 transition-colors hover:border-sage hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
              onClick={(e) => {
                e.stopPropagation();
                onUnitToggle(units === "kg" ? "lbs" : "kg");
              }}
            >
              {units}
            </button>
          )}
        </div>

        {se.notesSnapshot && (
          <p className="text-meta line-clamp-1">{se.notesSnapshot}</p>
        )}

        {/* Set rows — continuous numbering across blocks */}
        {blocks.length > 0 && (
          <div className="space-y-1.5">
            {(() => {
              const rows: React.ReactNode[] = [];
              let runningIndex = 0;
              blocks.forEach((block, bi) => {
                for (let si = 0; si < block.count; si++) {
                  runningIndex += 1;
                  const setKey = `${bi}:${si}`;
                  const logged = setLookup.get(setKey);
                  rows.push(
                    <SetRow
                      key={setKey}
                      setNumber={runningIndex}
                      loggedSet={logged}
                      units={units}
                      isTopBlock={block.tag === "top"}
                      lastHint={emptyHintForBlock(bi)}
                      onClick={() => onSetTap(bi, si)}
                    />,
                  );
                }
              });
              return rows;
            })()}
          </div>
        )}

        {/* LAST strip (routine exercises only, shown when there's history data) */}
        {blocks.length > 0 && lastStripFormatted.length > 0 && (
          <p className="text-meta tabular-nums">
            LAST {lastStripFormatted.join(" · ")}
          </p>
        )}

        {/* Extra exercise: single row list, no block structure */}
        {isExtra && (() => {
          const sorted = [...loggedSets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
          const nextSetIndex = loggedSets.reduce((max, ls) => Math.max(max, ls.setIndex + 1), 0);
          const extraHint = extraHistory?.sets[0]
            ? formatHintValue(extraHistory.sets[0], units) ?? undefined
            : undefined;
          return (
            <div className="space-y-1.5">
              {sorted.map((ls, i) => (
                <SetRow
                  key={ls.id}
                  setNumber={i + 1}
                  loggedSet={ls}
                  units={units}
                  isTopBlock={false}
                  onClick={() => onSetTap(0, ls.setIndex)}
                />
              ))}
              <SetRow
                setNumber={sorted.length + 1}
                loggedSet={undefined}
                units={units}
                isTopBlock={false}
                lastHint={extraHint}
                onClick={() => onSetTap(0, nextSetIndex)}
              />
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

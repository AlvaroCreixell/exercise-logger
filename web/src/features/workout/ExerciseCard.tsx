import { useState } from "react";
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

  // Sprint 4 (D3b): per-block in-session "Add extra set" tap counter.
  // Source of truth on rehydrate is loggedSets (extras logged in a prior
  // mount restore via loggedExtras below). The local counter only needs
  // to remember unconsumed taps in the current session.
  const [extraTaps, setExtraTaps] = useState<Record<number, number>>({});

  // Logged-driven extras: for each block, the highest setIndex among its
  // loggedSets, minus block.count + 1 (clamped to >= 0). Skip the scan
  // entirely for extras-origin SessionExercises (no blocks → loggedExtras
  // would always be empty anyway).
  const loggedExtras: Record<number, number> = {};
  if (blocks.length > 0) {
    for (const ls of loggedSets) {
      const block = blocks[ls.blockIndex];
      if (!block) continue;
      const overrun = ls.setIndex - block.count + 1;
      if (overrun > 0) {
        loggedExtras[ls.blockIndex] = Math.max(loggedExtras[ls.blockIndex] ?? 0, overrun);
      }
    }
  }

  function getExtraCount(bi: number): number {
    return Math.max(loggedExtras[bi] ?? 0, extraTaps[bi] ?? 0);
  }

  function addExtraSet(bi: number) {
    setExtraTaps((prev) => ({ ...prev, [bi]: getExtraCount(bi) + 1 }));
  }

  // Build lookup: "{blockIndex}:{setIndex}" → LoggedSet
  const setLookup = new Map<string, LoggedSet>();
  for (const ls of loggedSets) {
    setLookup.set(`${ls.blockIndex}:${ls.setIndex}`, ls);
  }

  // A block is complete when every prescribed slot has a logged set.
  function isBlockComplete(bi: number): boolean {
    const block = blocks[bi];
    if (!block) return false;
    for (let si = 0; si < block.count; si++) {
      if (!setLookup.has(`${bi}:${si}`)) return false;
    }
    return true;
  }

  const totalPrescribed = blocks.reduce((s, b) => s + b.count, 0);
  // The N/X badge counts only prescribed-slot completion. Extra sets logged
  // via "+ Add extra set" don't push the numerator past the denominator —
  // they're bonus work, not progress against the routine.
  const totalLogged = loggedSets.filter((ls) => {
    if (ls.origin !== "routine") return false;
    const block = blocks[ls.blockIndex];
    if (!block) return false;
    return ls.setIndex < block.count;
  }).length;

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
            <h3 className="flex items-baseline gap-2 font-heading text-lg font-bold tracking-tight text-foreground">
              <span
                aria-hidden="true"
                className={`shrink-0 text-xs select-none ${
                  totalPrescribed > 0 && totalLogged >= totalPrescribed
                    ? "text-success"
                    : totalLogged > 0 || loggedSets.length > 0
                      ? "text-accent-cli"
                      : "text-ink-3"
                }`}
              >
                ⏺
              </span>
              <span className="min-w-0 truncate">{se.exerciseNameSnapshot}</span>
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
              className="shrink-0 rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-3 transition-colors hover:border-accent-cli hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40"
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

        {/* Set rows — continuous numbering across blocks; extras render after each block's prescribed rows. */}
        {blocks.length > 0 && (
          <div className="space-y-1.5">
            {(() => {
              const rows: React.ReactNode[] = [];
              let runningIndex = 0;
              blocks.forEach((block, bi) => {
                const extras = getExtraCount(bi);
                const total = block.count + extras;
                for (let si = 0; si < total; si++) {
                  runningIndex += 1;
                  const setKey = `${bi}:${si}`;
                  const logged = setLookup.get(setKey);
                  rows.push(
                    <SetRow
                      key={setKey}
                      setNumber={runningIndex}
                      loggedSet={logged}
                      units={units}
                      // Extras are not "top" sets; only prescribed rows in a top-tagged block carry the badge.
                      isTopBlock={block.tag === "top" && si < block.count}
                      lastHint={si < block.count ? emptyHintForBlock(bi) : undefined}
                      onClick={() => onSetTap(bi, si)}
                    />,
                  );
                }
                // Contextual "Extra set" control below this block (Sprint 2
                // delta 3): hidden on untouched incomplete blocks; appears once
                // every prescribed slot is logged, or while extra rows exist
                // (persisted overruns via loggedExtras, pending local taps via
                // extraTaps — both folded into getExtraCount). Multi-block
                // exercises render one independent control per block; the
                // aria-label disambiguates them so screen-reader users know
                // which block they're extending.
                if (isBlockComplete(bi) || extras > 0) {
                  rows.push(
                    <button
                      key={`add-extra-${bi}`}
                      type="button"
                      aria-label={
                        blocks.length > 1
                          ? `Add extra set to set block ${bi + 1}`
                          : "Add extra set"
                      }
                      onClick={() => addExtraSet(bi)}
                      className="ml-9 text-meta hover:text-accent-cli-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cli/40 rounded-sm py-1"
                    >
                      Extra set
                    </button>,
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

import type { SessionExercise, LoggedSet } from "@/domain/types";

/**
 * Superset rhythm helpers (Sprint 2 workout rhythm).
 *
 * Paired superset exercises can have different block structures (A might be
 * 2+1 blocks while B is a single block of 3), so raw [blockIndex, setIndex]
 * can never be compared between partners. Instead every slot is flattened
 * into a 1-based "ordinal" — its position in the same visual order
 * ExerciseCard renders rows (block by block, setIndex within block). Round N
 * of a superset is A's ordinal-N slot followed by B's ordinal-N slot.
 */

export interface SupersetSlot {
  /** 1-based position across all prescribed slots of the exercise. */
  ordinal: number;
  blockIndex: number;
  setIndex: number;
}

/**
 * Flatten an exercise's prescribed slots in render order.
 * Extra-origin exercises (empty setBlocksSnapshot) yield [].
 */
export function flattenPrescribedSlots(se: SessionExercise): SupersetSlot[] {
  const slots: SupersetSlot[] = [];
  let ordinal = 0;
  se.setBlocksSnapshot.forEach((block, blockIndex) => {
    for (let setIndex = 0; setIndex < block.count; setIndex++) {
      ordinal += 1;
      slots.push({ ordinal, blockIndex, setIndex });
    }
  });
  return slots;
}

/**
 * Ordinal for any [blockIndex, setIndex] slot, including overrun extra sets.
 * Overrun slots (setIndex >= block.count, or a blockIndex with no prescribed
 * block) continue the sequence after ALL prescribed slots, so an overrun
 * round can still pair with the partner's matching overrun.
 *
 * Overrun ordinals interleave by (overrunIndex, blockIndex) so that extras in
 * DIFFERENT blocks of a multi-block exercise never collide onto one ordinal —
 * a collision would merge two real sets into one rail chip and let
 * isRoundComplete pair mismatched extras. Single-block exercises reduce to
 * the plain totalPrescribed + overrunIndex + 1 sequence.
 */
export function getSlotOrdinal(
  se: SessionExercise,
  blockIndex: number,
  setIndex: number,
): number {
  const blocks = se.setBlocksSnapshot;
  const block = blocks[blockIndex];

  if (block && setIndex < block.count) {
    let before = 0;
    for (let bi = 0; bi < blockIndex; bi++) before += blocks[bi].count;
    return before + setIndex + 1;
  }

  const totalPrescribed = blocks.reduce((sum, b) => sum + b.count, 0);
  const blockCount = Math.max(1, blocks.length);
  const overrunIndex = block ? setIndex - block.count : setIndex;
  return totalPrescribed + overrunIndex * blockCount + blockIndex + 1;
}

/** Ordinals that have a logged set, per exercise, in exercises order. */
function loggedOrdinalSets(
  exercises: [SessionExercise, SessionExercise],
  setsByExercise: Map<string, LoggedSet[]>,
): [Set<number>, Set<number>] {
  return exercises.map((se) => {
    const sets = setsByExercise.get(se.id) ?? [];
    return new Set(sets.map((ls) => getSlotOrdinal(se, ls.blockIndex, ls.setIndex)));
  }) as [Set<number>, Set<number>];
}

/** Round N is complete when BOTH exercises have a logged set at ordinal N. */
export function isRoundComplete(args: {
  exercises: [SessionExercise, SessionExercise];
  setsByExercise: Map<string, LoggedSet[]>;
  ordinal: number;
}): boolean {
  const { exercises, setsByExercise, ordinal } = args;
  const [aOrdinals, bOrdinals] = loggedOrdinalSets(exercises, setsByExercise);
  return aOrdinals.has(ordinal) && bOrdinals.has(ordinal);
}

export interface SupersetRailItem {
  key: string;
  side: "A" | "B";
  ordinal: number;
  /** e.g. "A1" */
  label: string;
  status: "complete" | "current" | "upcoming";
}

/**
 * Interleaved A1,B1,A2,B2… covering max(prescribed rounds of A, B) plus any
 * logged overrun rounds. "current" is the first incomplete slot in sequence;
 * later incomplete slots are "upcoming".
 */
export function buildSupersetRail(args: {
  exercises: [SessionExercise, SessionExercise];
  setsByExercise: Map<string, LoggedSet[]>;
}): SupersetRailItem[] {
  const { exercises, setsByExercise } = args;
  const ordinalSets = loggedOrdinalSets(exercises, setsByExercise);

  const prescribedRounds = Math.max(
    flattenPrescribedSlots(exercises[0]).length,
    flattenPrescribedSlots(exercises[1]).length,
  );
  const maxLoggedOrdinal = Math.max(
    0,
    ...ordinalSets.flatMap((set) => [...set]),
  );
  const totalRounds = Math.max(prescribedRounds, maxLoggedOrdinal);

  const items: SupersetRailItem[] = [];
  for (let ordinal = 1; ordinal <= totalRounds; ordinal++) {
    (["A", "B"] as const).forEach((side, i) => {
      items.push({
        key: `${side}-${ordinal}`,
        side,
        ordinal,
        label: `${side}${ordinal}`,
        status: ordinalSets[i].has(ordinal) ? "complete" : "upcoming",
      });
    });
  }

  const firstIncomplete = items.find((item) => item.status !== "complete");
  if (firstIncomplete) firstIncomplete.status = "current";

  return items;
}

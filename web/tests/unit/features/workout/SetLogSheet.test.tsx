// web/tests/unit/features/workout/SetLogSheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { BlockSuggestion, BlockLastTime } from "@/services/progression-service";

function makeSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: "se-1",
    sessionId: "s-1",
    routineEntryId: "re-1",
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
    ],
    createdAt: "2026-04-16T12:00:00.000Z",
    unitOverride: null,
    ...overrides,
  };
}

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls-1",
    sessionId: "s-1",
    sessionExerciseId: "se-1",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 80,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

interface RenderOpts {
  sessionExercise?: SessionExercise;
  blockIndex?: number;
  setIndex?: number;
  existingSet?: LoggedSet;
  suggestion?: BlockSuggestion;
  lastTime?: BlockLastTime;
  blockSetsInSession?: LoggedSet[];
}

function renderSheet(opts: RenderOpts = {}) {
  return render(
    <SetLogSheet
      open={true}
      onOpenChange={vi.fn()}
      sessionExercise={opts.sessionExercise ?? makeSessionExercise()}
      blockIndex={opts.blockIndex ?? 0}
      setIndex={opts.setIndex ?? 0}
      existingSet={opts.existingSet}
      suggestion={opts.suggestion}
      lastTime={opts.lastTime}
      blockSetsInSession={opts.blockSetsInSession ?? []}
      units="kg"
      onSave={vi.fn()}
    />
  );
}

describe("SetLogSheet prefill", () => {
  it("defaults weight to '0' and reps to block minValue when no history is available", () => {
    renderSheet({ setIndex: 0 });
    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    const reps = screen.getByLabelText(/reps/i) as HTMLInputElement;
    expect(weight.value).toBe("0");
    expect(reps.value).toBe("8"); // minValue of the default STANDARD_BLOCK
  });

  it("prefills weight from the most recent in-session set for the same block, overriding the suggestion", () => {
    // Scenario from docs/notes.md: suggestion says 130, user actually used 135 on set 0.
    // Opening set 1 must show 135, not 130.
    const priorSet = makeLoggedSet({
      id: "ls-set0",
      setIndex: 0,
      blockIndex: 0,
      performedWeightKg: 135,
      performedReps: 12,
      loggedAt: "2026-04-16T12:05:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      isProgression: true,
      previousWeightKg: 125,
    };

    renderSheet({
      setIndex: 1,
      suggestion,
      blockSetsInSession: [priorSet],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("135");
  });
});

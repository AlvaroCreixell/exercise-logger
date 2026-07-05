// web/tests/unit/features/workout/SetLogSheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  onSave?: ReturnType<typeof vi.fn>;
  onOpenChange?: ReturnType<typeof vi.fn>;
  onDelete?: ReturnType<typeof vi.fn>;
}

function renderSheet(opts: RenderOpts = {}) {
  return render(
    <SetLogSheet
      open={true}
      onOpenChange={opts.onOpenChange ?? vi.fn()}
      sessionExercise={opts.sessionExercise ?? makeSessionExercise()}
      blockIndex={opts.blockIndex ?? 0}
      setIndex={opts.setIndex ?? 0}
      existingSet={opts.existingSet}
      suggestion={opts.suggestion}
      lastTime={opts.lastTime}
      blockSetsInSession={opts.blockSetsInSession ?? []}
      units="kg"
      onSave={opts.onSave ?? vi.fn()}
      onDelete={opts.onDelete}
    />
  );
}

/** Reads the displayed value from the Weight ValueBox tile. */
function weightValueText(): string {
  const tile = screen.getByRole("button", { name: /weight value/i });
  const big = within(tile).getByText(/^(—|\d+(\.\d+)?)$/);
  return big.textContent ?? "";
}

/** Reads the displayed value from the Reps ValueBox tile. */
function repsValueText(): string {
  const tile = screen.getByRole("button", { name: /reps value/i });
  const big = within(tile).getByText(/^(—|\d+(\.\d+)?)$/);
  return big.textContent ?? "";
}

describe("SetLogSheet prefill", () => {
  it("defaults weight to '0' and reps to block minValue when no history is available", () => {
    renderSheet({ setIndex: 0 });
    expect(weightValueText()).toBe("0");
    expect(repsValueText()).toBe("8"); // minValue of the default STANDARD_BLOCK
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

    expect(weightValueText()).toBe("135");
  });

  it("existingSet wins over carryover (edit mode)", () => {
    const priorSet = makeLoggedSet({
      id: "ls-set0",
      setIndex: 0,
      performedWeightKg: 135,
      loggedAt: "2026-04-16T12:05:00.000Z",
    });
    const existing = makeLoggedSet({
      id: "ls-set1",
      setIndex: 1,
      performedWeightKg: 140,
      performedReps: 8,
      loggedAt: "2026-04-16T12:06:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      isProgression: true,
      previousWeightKg: 125,
    };

    renderSheet({
      setIndex: 1,
      existingSet: existing,
      suggestion,
      blockSetsInSession: [priorSet, existing],
    });

    expect(weightValueText()).toBe("140");
  });

  it("picks the most recent carryover set by updatedAt (so in-session edits win)", () => {
    // Scenario: user logged set 0 = 130 at 12:00, then set 1 = 120 at 12:01,
    // then went back and EDITED set 0 to 140. The edit bumps updatedAt to 12:10
    // but leaves loggedAt at 12:00. Opening set 2 should prefill 140 (the
    // just-edited weight), not 120 (the unchanged set 1).
    const editedSet0 = makeLoggedSet({
      id: "ls-set0",
      setIndex: 0,
      performedWeightKg: 140,
      loggedAt: "2026-04-16T12:00:00.000Z",
      updatedAt: "2026-04-16T12:10:00.000Z",
    });
    const untouchedSet1 = makeLoggedSet({
      id: "ls-set1",
      setIndex: 1,
      performedWeightKg: 120,
      loggedAt: "2026-04-16T12:01:00.000Z",
      updatedAt: "2026-04-16T12:01:00.000Z",
    });

    renderSheet({
      setIndex: 2,
      blockSetsInSession: [editedSet0, untouchedSet1],
    });

    expect(weightValueText()).toBe("140");
  });

  it("ignores carryover sets from other session exercises even if blockIndex matches", () => {
    // Defense-in-depth: if a caller ever passes sets from multiple session
    // exercises, the carryover filter must scope by sessionExerciseId.
    const otherExerciseSet = makeLoggedSet({
      id: "ls-other",
      sessionExerciseId: "se-OTHER",
      blockIndex: 0,
      setIndex: 0,
      performedWeightKg: 999,
      loggedAt: "2026-04-16T12:05:00.000Z",
      updatedAt: "2026-04-16T12:05:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      previousWeightKg: 125,
      isProgression: true,
    };

    renderSheet({
      setIndex: 0,
      suggestion,
      blockSetsInSession: [otherExerciseSet],
    });

    expect(weightValueText()).toBe("130"); // suggestion, not 999
  });

  it("ignores carryover sets whose performedWeightKg is null", () => {
    // An empty save with only reps shouldn't override the suggestion.
    const nullWeightSet = makeLoggedSet({
      id: "ls-a",
      setIndex: 0,
      performedWeightKg: null,
      performedReps: 10,
      loggedAt: "2026-04-16T12:00:00.000Z",
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
      blockSetsInSession: [nullWeightSet],
    });

    expect(weightValueText()).toBe("130");
  });

  it("ignores carryover from other blocks (blockIndex mismatch)", () => {
    // Top-set block 0 was 140; back-off block 1 should not inherit from it.
    const topSet = makeLoggedSet({
      id: "ls-top",
      blockIndex: 0,
      setIndex: 0,
      performedWeightKg: 140,
      loggedAt: "2026-04-16T12:00:00.000Z",
    });
    const backOffSuggestion: BlockSuggestion = {
      blockIndex: 1,
      suggestedWeightKg: 100,
      isProgression: true,
      previousWeightKg: 125,
    };
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });

    renderSheet({
      sessionExercise: se,
      blockIndex: 1,
      setIndex: 0,
      suggestion: backOffSuggestion,
      blockSetsInSession: [topSet],
    });

    expect(weightValueText()).toBe("100"); // suggestion for block 1, not 140 from block 0
  });

  it("falls through to suggestion when blockSetsInSession is empty", () => {
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 125,
      isProgression: true,
      previousWeightKg: 125,
    };

    renderSheet({
      setIndex: 0,
      suggestion,
      blockSetsInSession: [],
    });

    expect(weightValueText()).toBe("125");
  });
});

describe("SetLogSheet — inline context", () => {
  it("shows SetDots in the header with the right current index", () => {
    renderSheet({ setIndex: 1 });
    expect(screen.getByLabelText(/set 2 of 3/i)).toBeInTheDocument();
  });

  it("shows Last-time context when lastTime is provided", () => {
    renderSheet({
      lastTime: {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [
          { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
        ],
      },
    });
    expect(screen.getByText(/100kg/i)).toBeVisible();
    expect(screen.getByText(/last time/i)).toBeVisible();
  });

  it("shows suggestion inline when provided", () => {
    renderSheet({
      suggestion: {
        blockIndex: 0,
        suggestedWeightKg: 105,
        isProgression: true,
        previousWeightKg: 100,
      },
    });
    expect(screen.getByText(/105kg/i)).toBeVisible();
    expect(screen.getByText(/suggested/i)).toBeVisible();
  });

  it("'Use last' chip prefills weight and reps from lastTime[setIndex] when tapped", async () => {
    const user = userEvent.setup();
    renderSheet({
      lastTime: {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [
          { weightKg: 100, reps: 8, durationSec: null, distanceM: null },
          { weightKg: 95, reps: 7, durationSec: null, distanceM: null },
        ],
      },
      setIndex: 1,
    });
    // Pre-state: the existing prefill path already fills weight=95 (from lastTime[1])
    // and reps=7 (from lastTime[1]). Empty BOTH fields away from lastTime values,
    // so the Use last button restore is testable (not just passing because prefill == expected).
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    expect(weightValueText()).toBe("—");

    // Switch to reps, mutate away from 7.
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    await user.click(screen.getByRole("button", { name: /^1$/ }));
    expect(repsValueText()).toBe("1");

    // Use last restores both fields from lastTime[1].
    await user.click(screen.getByRole("button", { name: /use last/i }));
    expect(weightValueText()).toBe("95");
    expect(repsValueText()).toBe("7");
  });

  it("'Use last' chip populates duration from lastTime when tapped on a duration target", async () => {
    const user = userEvent.setup();
    const durationSE = makeSessionExercise({
      effectiveType: "bodyweight",
      setBlocksSnapshot: [
        { targetKind: "duration", minValue: 30, maxValue: 60, count: 3 } as SetBlock,
      ],
    });
    renderSheet({
      sessionExercise: durationSE,
      setIndex: 0,
      lastTime: {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [{ weightKg: null, reps: null, durationSec: 180, distanceM: null }],
      },
    });
    // The existing prefill path also fills duration from lastTime, so first mutate
    // the field to a different value, then verify Use last restores it.
    const durationInput = screen.getByLabelText(/duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, "99");
    expect(durationInput).toHaveValue(99);

    await user.click(screen.getByRole("button", { name: /use last/i }));
    // durationInMinutes is false here (bodyweight + block present), so 180 sec stored raw.
    expect(durationInput).toHaveValue(180);
  });

  it("'Use last' chip populates distance from lastTime when tapped on a distance target", async () => {
    const user = userEvent.setup();
    const distanceSE = makeSessionExercise({
      effectiveType: "bodyweight",
      setBlocksSnapshot: [
        { targetKind: "distance", minValue: 500, maxValue: 1000, count: 3 } as SetBlock,
      ],
    });
    renderSheet({
      sessionExercise: distanceSE,
      setIndex: 0,
      lastTime: {
        blockIndex: 0,
        blockLabel: "Set block 1",
        tag: null,
        sets: [{ weightKg: null, reps: null, durationSec: null, distanceM: 1000 }],
      },
    });
    const distanceInput = screen.getByLabelText(/distance/i);
    await user.clear(distanceInput);
    await user.type(distanceInput, "250");
    expect(distanceInput).toHaveValue(250);

    await user.click(screen.getByRole("button", { name: /use last/i }));
    expect(distanceInput).toHaveValue(1000);
  });
});

describe("SetLogSheet — open-edge prefill", () => {
  it("does not re-prefill when parent re-renders with new props while open", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // Initial prefill runs — weight defaults to "0" since showWeight path hits no carryover/suggest/last.
    // Tap digits on the keypad: "0" is replaced by "8", then "0" appended → "80"
    await user.click(screen.getByRole("button", { name: /^8$/ }));
    await user.click(screen.getByRole("button", { name: /^0$/ }));
    expect(weightValueText()).toBe("80");

    // Parent re-renders with a new suggestion (simulates useLiveQuery refresh).
    rerender(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={{ blockIndex: 0, suggestedWeightKg: 100, isProgression: true, previousWeightKg: 95 }}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // User's typed value should NOT be clobbered by the new suggestion's prefill.
    expect(weightValueText()).toBe("80");
  });

  it("does not re-prefill when blockSetsInSession identity changes while open", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // Tap digits: "0" is replaced by "8", then "0" appended → "80"
    await user.click(screen.getByRole("button", { name: /^8$/ }));
    await user.click(screen.getByRole("button", { name: /^0$/ }));
    expect(weightValueText()).toBe("80");

    // Parent re-renders with a fresh blockSetsInSession (simulates a different set being logged elsewhere).
    // The carryover-candidate set carries 100kg — but the user's "80" must not be clobbered.
    rerender(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[
          {
            id: "ls-1",
            sessionId: "s-1",
            sessionExerciseId: makeSessionExercise().id,
            blockIndex: 0,
            setIndex: 0,
            performedWeightKg: 100,
            performedReps: 5,
            performedDurationSec: null,
            performedDistanceM: null,
            instanceLabel: "",
            exerciseId: "barbell-bench-press",
            blockSignature: "reps:8-12:count3:tagnormal",
            origin: "routine",
            tag: null,
            loggedAt: "2026-04-17T12:00:00Z",
            updatedAt: "2026-04-17T12:00:00Z",
          },
        ]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    expect(weightValueText()).toBe("80");
  });

  it("does not re-prefill when lastTime identity changes while open", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // Tap digits: "0" is replaced by "8", then "0" appended → "80"
    await user.click(screen.getByRole("button", { name: /^8$/ }));
    await user.click(screen.getByRole("button", { name: /^0$/ }));
    expect(weightValueText()).toBe("80");

    // Parent re-renders with a newly-loaded lastTime (simulates useExerciseHistory resolving).
    // lastTime suggests 100kg — but the user's "80" must not be clobbered.
    rerender(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={{
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: 100, reps: 10, durationSec: null, distanceM: null },
          ],
        }}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    expect(weightValueText()).toBe("80");
  });
});

describe("SetLogSheet — global Enter handler", () => {
  it("saves the current isPR value when Enter fires after toggling PR", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    // Provide weight+reps prefill so save succeeds without validation error.
    renderSheet({
      onSave,
      existingSet: makeLoggedSet({
        performedWeightKg: 80,
        performedReps: 10,
        isPersonalRecord: false,
      } as Partial<LoggedSet>),
    });
    // Toggle PR, then blur the button so the global Enter handler (not the button) fires.
    await user.click(screen.getByRole("button", { name: /mark pr/i }));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0].isPersonalRecord).toBe(true);
  });

  it("lets Enter activate a focused button instead of triggering save", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onSave });
    const markPr = screen.getByRole("button", { name: /mark pr/i });
    // Fire Enter as a bubbling keydown with the button as the target — this
    // simulates the window handler receiving Enter while the button is focused.
    fireEvent.keyDown(markPr, { key: "Enter", bubbles: true });
    // The sheet-level save must NOT have been called.
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lets Tab move focus away from a focused button instead of flipping activeField", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onSave });
    const markPr = screen.getByRole("button", { name: /mark pr/i });
    markPr.focus();
    expect(document.activeElement).toBe(markPr);
    // user.tab() dispatches a real Tab keydown and respects preventDefault
    // from listeners. If the bug is live, the SetLogSheet effect
    // preventDefault's and focus stays on markPr.
    await user.tab();
    // With the fix: focus has moved off markPr.
    expect(document.activeElement).not.toBe(markPr);
    // And activeField must NOT have flipped — weight tile stays active.
    const weightBtn = screen.getByRole("button", { name: /weight value/i });
    expect(weightBtn.getAttribute("data-active")).toBe("true");
  });
});

describe("SetLogSheet — keypad input (weight + reps)", () => {
  it("renders a keypad when the sheet is open with weight+reps target", () => {
    renderSheet();
    expect(screen.getByRole("group", { name: /numeric keypad/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^5$/ })).toBeVisible();
  });

  it("tapping a digit updates the active ValueBox (defaults to weight on open)", async () => {
    const user = userEvent.setup();
    renderSheet(); // default: new set, no existing, no suggestion → weight="0"
    // Weight starts "0", tapping "8" replaces the leading zero (keypad-reducer rule), then "5" appends.
    await user.click(screen.getByRole("button", { name: /^8$/ }));
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(weightValueText()).toBe("85");
  });

  it("switches keypad target to reps when the reps ValueBox is tapped", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    // Reps prefill is minValue=8. Tapping "1" replaces is NOT expected because the reducer
    // only replaces on a *standalone* "0" — for "8" it appends. So start by clearing.
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    await user.click(screen.getByRole("button", { name: /^1$/ }));
    await user.click(screen.getByRole("button", { name: /^2$/ }));
    expect(repsValueText()).toBe("12");
  });

  it("backspace removes the last character of the active value", async () => {
    const user = userEvent.setup();
    renderSheet();
    // Weight prefilled to "0", tap 7 (replaces 0) then 0 then backspace → "7"
    await user.click(screen.getByRole("button", { name: /^7$/ }));
    await user.click(screen.getByRole("button", { name: /^0$/ }));
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    expect(weightValueText()).toBe("7");
  });

  it("weight ± nudge steps by 2.5 kg", async () => {
    const user = userEvent.setup();
    renderSheet(); // weight prefilled to "0"
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(weightValueText()).toBe("2.5");
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(weightValueText()).toBe("5");
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    expect(weightValueText()).toBe("2.5");
  });

  it("reps ± nudge steps by 1", async () => {
    const user = userEvent.setup();
    renderSheet(); // reps prefilled to minValue=8
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    await user.click(screen.getByRole("button", { name: /increase reps/i }));
    expect(repsValueText()).toBe("9");
    await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    expect(repsValueText()).toBe("7");
  });

  it("weight nudge clamps at 0 (cannot go negative)", async () => {
    const user = userEvent.setup();
    renderSheet(); // weight="0"
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    expect(weightValueText()).toBe("0");
  });

  it("reps nudge clamps at 0", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole("button", { name: /decrease reps/i }));
    }
    expect(repsValueText()).toBe("0");
  });

  it("ignores the decimal key when reps is the active field", async () => {
    const user = userEvent.setup();
    renderSheet();
    // Activate reps tile
    await user.click(screen.getByRole("button", { name: /reps value/i }));
    // Clear prefill (reps starts at minValue=8 — one backspace clears it)
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    // Type "1" + "." + "5" — "." must be ignored, result should be "15"
    await user.click(screen.getByRole("button", { name: /^1$/ }));
    await user.click(screen.getByRole("button", { name: /\./ }));
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(repsValueText()).toBe("15");
  });
});

describe("SetLogSheet — physical keyboard", () => {
  it("digit keypresses update the active field", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.keyboard("85");
    expect(weightValueText()).toBe("85");
  });

  it("backspace key removes the last character", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.keyboard("85");
    await user.keyboard("{Backspace}");
    expect(weightValueText()).toBe("8");
  });

  it("Tab moves active field from weight to reps", () => {
    renderSheet();
    // The sheet auto-focuses the weight tile (a BUTTON). The Tab handler
    // now bails out on BUTTON focus (11.6 Task 1), so to exercise the
    // inner Tab branch (which flips activeField for non-button focus) we
    // dispatch the keydown directly on document.body.
    fireEvent.keyDown(document.body, { key: "Tab" });
    // After the flip, reps is active. Reps prefilled to minValue=8; clear
    // then type via direct keydowns so we don't depend on user-event's
    // focus-aware dispatch either.
    fireEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent.keyDown(document.body, { key: "1" });
    fireEvent.keyDown(document.body, { key: "2" });
    expect(repsValueText()).toBe("12");
  });

  it("Enter triggers onSave with the current values", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={makeLoggedSet({ performedWeightKg: 85, performedReps: 10 })}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    // Fire Enter directly at document.body so the BUTTON bailout doesn't
    // apply; the sheet-level keydown listener should catch it and save.
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        performedWeightKg: 85,
        performedReps: 10,
      }),
    ));
  });
});

describe("SetLogSheet — bodyweight activeField", () => {
  function makeBwSessionExercise(): SessionExercise {
    return makeSessionExercise({
      effectiveType: "bodyweight",
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });
  }

  it("makes weight the active field immediately when + Add weight is tapped", async () => {
    const user = userEvent.setup();
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeBwSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={vi.fn()}
      />,
    );

    // Weight tile should not be visible yet (bodyweight, showWeightForBodyweight=false)
    expect(screen.queryByRole("button", { name: /weight value/i })).toBeNull();

    // Click "+ Add weight"
    await user.click(screen.getByRole("button", { name: /add weight/i }));

    // Weight tile is now visible and must be the active field
    const weightTile = screen.getByRole("button", { name: /weight value/i });
    expect(weightTile).toBeVisible();
    expect(weightTile).toHaveAttribute("data-active", "true");
  });

  it("resets activeField to reps on bodyweight re-open after + Add weight", async () => {
    const user = userEvent.setup();

    function Harness({ initialOpen }: { initialOpen: boolean }) {
      const [open, setOpen] = useState(initialOpen);
      return (
        <>
          <button data-testid="harness-close" onClick={() => setOpen(false)}>close sheet</button>
          <button data-testid="harness-reopen" onClick={() => setOpen(true)}>reopen sheet</button>
          <SetLogSheet
            open={open}
            onOpenChange={setOpen}
            sessionExercise={makeBwSessionExercise()}
            blockIndex={0}
            setIndex={0}
            existingSet={undefined}
            suggestion={undefined}
            lastTime={undefined}
            blockSetsInSession={[]}
            units="kg"
            onSave={vi.fn()}
          />
        </>
      );
    }

    render(<Harness initialOpen={true} />);

    // Click "+ Add weight" — weight tile appears and is active
    await user.click(screen.getByRole("button", { name: /add weight/i }));
    expect(screen.getByRole("button", { name: /weight value/i })).toHaveAttribute("data-active", "true");

    // Close the sheet
    await user.click(screen.getByTestId("harness-close"));

    // Reopen the sheet
    await user.click(screen.getByTestId("harness-reopen"));

    // After re-open: showWeightForBodyweight resets to false, weight tile hidden
    // activeField must be "reps", not "weight"
    expect(screen.queryByRole("button", { name: /weight value/i })).toBeNull();
    const repsTile = screen.getByRole("button", { name: /reps value/i });
    expect(repsTile).toHaveAttribute("data-active", "true");

    // Confirm keypad updates reps, not the hidden weight
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(repsValueText()).toBe("5");
  });
});

describe("SetLogSheet — PR toggle", () => {
  it("defaults to false for a new set", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /mark pr/i })).toBeVisible();
  });

  it("defaults from existingSet.isPersonalRecord when editing", () => {
    renderSheet({
      existingSet: makeLoggedSet({ isPersonalRecord: true }),
    });
    expect(screen.getByRole("button", { name: /^pr/i })).toBeVisible();
  });

  it("includes isPersonalRecord=true in onSave payload when toggled on", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    await user.keyboard("85");
    await user.keyboard("{Tab}");
    await user.keyboard("{Backspace}");
    await user.keyboard("10");
    await user.click(screen.getByRole("button", { name: /mark pr/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isPersonalRecord: true }),
    );
  });

  it("passes isPersonalRecord=false in onSave when untoggled", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <SetLogSheet
        open={true}
        onOpenChange={vi.fn()}
        sessionExercise={makeSessionExercise()}
        blockIndex={0}
        setIndex={0}
        existingSet={undefined}
        suggestion={undefined}
        lastTime={undefined}
        blockSetsInSession={[]}
        units="kg"
        onSave={save}
      />,
    );
    await user.keyboard("85");
    await user.keyboard("{Tab}");
    await user.keyboard("{Backspace}");
    await user.keyboard("10");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isPersonalRecord: false }),
    );
  });
});

describe("SetLogSheet — cancel control", () => {
  it("shows a visible Cancel control in create mode", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeVisible();
  });

  it("shows a visible Cancel control in edit mode", () => {
    renderSheet({
      existingSet: makeLoggedSet(),
      onDelete: vi.fn().mockResolvedValue(undefined),
    });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeVisible();
  });

  it("clicking Cancel closes the sheet via onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSheet({ onOpenChange });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clicking Cancel does not call onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onSave });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("clicking Cancel in edit mode does not call onDelete", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSheet({
      existingSet: makeLoggedSet(),
      onOpenChange,
      onSave,
      onDelete,
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("Cancel is keyboard-reachable: Enter on the focused control closes without saving", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onOpenChange, onSave });
    const cancel = screen.getByRole("button", { name: /cancel/i });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
  });
});

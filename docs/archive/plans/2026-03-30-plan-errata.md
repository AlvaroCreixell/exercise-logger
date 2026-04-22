# Plan Errata — Consolidated Audit Fixes

> **For agentic workers:** Read this document BEFORE implementing any phase. Apply the relevant amendments during implementation. Each fix is tagged with its phase and severity.

**Source:** Cross-referencing of two independent audits (Claude + Codex, 2026-03-30) against the design spec and all 7 phase plans.

**Status:** Authoritative. These fixes supersede the corresponding code in the phase plan files.

---

## Spec-Level Amendments

These are necessary deviations from the design spec that must be applied project-wide.

### S1. `instanceLabel` must be `string`, not `string | null` [Phase 2+]

**Reason:** Dexie/IndexedDB silently excludes rows from compound indexes when any component is `null`. The `[exerciseId+instanceLabel+blockSignature+loggedAt]` index is critical for progression matching. Storing `null` would make most loggedSets invisible to this index.

**Fix:** Change `instanceLabel` from `string | null` to `string` everywhere (`SessionExercise`, `LoggedSet`). Use `""` as the semantic equivalent of "no instance label." Apply at the type level in Phase 2 so all downstream phases inherit the fix.

### S2. SetLogForm field selection must be driven by `targetKind`, not `effectiveType` [Phase 6]

**Reason:** The spec says "For routine exercises, the block prescription determines which fields are shown" (spec line 615). Each set block has exactly one target kind (`reps`, `duration`, or `distance`). `effectiveType` only determines whether the weight input is shown.

**Fix:** For routine exercises, pass `targetKind` from the set block to `SetLogForm`. Use it to select which performed-value fields appear:
- `targetKind === "reps"` → show reps input
- `targetKind === "duration"` → show duration input
- `targetKind === "distance"` → show distance input
- `effectiveType === "weight"` → additionally show weight input
- `effectiveType === "bodyweight"` → additionally show optional weight toggle

For extra exercises (no set blocks), fall back to `effectiveType`-driven field selection.

---

## Phase 1 Fixes

### P1-A. Install `@types/node` as devDependency [CERTAIN]

Add `npm install -D @types/node` before or during the Vite config step. Without it, `import path from "path"` and `__dirname` produce TypeScript errors.

### P1-B. Use `-D` flag for build-time packages [CERTAIN]

`tailwindcss`, `@tailwindcss/vite`, and `vite-plugin-pwa` are build-time tools. Install with `npm install -D` instead of `npm install`.

### P1-C. Split PWA icon `purpose` into two entries [CERTAIN]

Replace the single `{ src: "...", sizes: "512x512", purpose: "any maskable" }` entry with two entries:
```json
{ "src": "icons/icon-512x512.png", "sizes": "512x512", "purpose": "any" },
{ "src": "icons/icon-512x512-maskable.png", "sizes": "512x512", "purpose": "maskable" }
```

### P1-D. Generate correctly-sized placeholder icons [MINOR]

Phase 1 generates 1x1 PNGs but declares them as 192x192 and 512x512 in the manifest. Generate solid-color PNGs at the actual declared dimensions so installability verification is trustworthy.

### P1-E. Verify Vite 8 + vite-plugin-pwa compatibility [CAUTION]

Vite 8 is very recent. If `vite-plugin-pwa` has compatibility issues, pin to Vite 7. Add a verification step after install.

### P1-F. Drop `-t vite` from `shadcn init` [CAUTION]

`npx shadcn@latest init -t vite -y` on an existing project may overwrite files. Use `npx shadcn@latest init` and let the CLI auto-detect the framework.

### P1-G. Chain build into E2E test script [MINOR]

Change `test:e2e` to `npm run build && playwright test` so `npx playwright test` doesn't serve a stale or missing `dist/`.

---

## Phase 2 Fixes

### P2-A. Add `RoutineCardio`, `RoutineCardioOption`, and `Routine.notes` types [CERTAIN]

The spec's `routines` table has `notes: string[]` and `cardio: object | null`. Phase 2 must define:
```ts
interface RoutineCardioOption { name: string; detail: string; }
interface RoutineCardio { notes: string; options: RoutineCardioOption[]; }
```
And ensure `Routine` includes `notes: string[]` and `cardio: RoutineCardio | null`. These are shared contracts that Phase 3 depends on.

### P2-B. Apply instanceLabel normalization at the type level [CERTAIN]

Per S1 above: `instanceLabel: string` (not `string | null`) on both `SessionExercise` and `LoggedSet`. Default to `""`. Fix the Phase 2 test that inserts `null` and queries with `""`.

### P2-C. Confirm `tagnormal` sentinel for blockSignature [DESIGN DECISION]

The spec examples use `tagnormal` for blocks without a tag. The plan's `generateBlockSignature` defaults untagged blocks to `"normal"`. This matches the spec examples exactly (`reps:8-12:count3:tagnormal`). **Keep as-is.** Document that `"normal"` is the canonical sentinel for "no tag" and is not an actual `SetTag` enum value.

---

## Phase 3 Fixes

### P3-A. Add equipment enum validation to CSV parser [CERTAIN]

`parseExerciseCatalog` uses `as ExerciseEquipment` cast without checking the value. Add validation against the `VALID_EQUIPMENT` set (which already exists in the routine service). Reject or warn on unknown equipment values.

### P3-B. Resolve compound equipment values in CSV [CERTAIN]

`Lat Pulldown` has `Machine / Cable`; `Farmer's Carry` has `Kettlebell / Dumbbell`. The spec's equipment is a single enum.

**Decision: first value wins after split on `/`.** The plan's `normalizeEquipment` already does this. Just ensure it's documented and tested:
- `Lat Pulldown` → `machine`
- `Farmer's Carry` → `kettlebell`

### P3-C. Delete malformed `Burpees,,,` row [CERTAIN]

Line 83 of the CSV has empty fields and duplicates line 70's `Burpee`. Remove it along with the trailing blank line.

### P3-D. Fix `Run/walk` slug inconsistency [CERTAIN]

The slugify function strips `/`, producing `runwalk`. Phase 5 references this exercise as `run-walk`. Two options:
- **(Recommended)** Change the CSV name from `Run/walk` to `Run/Walk` or `Run-Walk` so slugify produces `run-walk`
- Or update Phase 5's reference to use `runwalk`

### P3-E. Add `distance` target positive test case [MINOR]

No test validates a `distance` target block (e.g., `{ distance: 2000, count: 1 }`). Add one to the normalization test suite.

---

## Phase 4 Fixes

### P4-A. Remove dead `startSession` function [CERTAIN]

The plan has both `startSession` (with placeholder values like `""` name, `"weight"` type) and `startSessionWithCatalog` (the correct version). Remove or unexport `startSession` and its helpers (`buildSessionExercises`, `buildSingleSessionExercise`). Only `startSessionWithCatalog` should exist.

### P4-B. Move `hasActiveSession` check inside Dexie transactions [CERTAIN]

`setActiveRoutine` and `deleteRoutine` call `hasActiveSession(db)` outside the transaction, creating a TOCTOU race. Move the check inside the transaction so the active-session guard and the mutation are atomic.

```ts
// WRONG:
const hasActive = await hasActiveSession(db);
if (hasActive) throw new Error("...");
await db.transaction("rw", [db.settings, db.routines], async () => { ... });

// RIGHT:
await db.transaction("rw", [db.settings, db.routines, db.sessions], async () => {
  const active = await db.sessions.where("status").equals("active").first();
  if (active) throw new Error("...");
  // ... mutation ...
});
```

### P4-C. Read settings inside the transaction in `deleteRoutine` [CERTAIN]

`deleteRoutine` reads `settings.activeRoutineId` before the transaction. Move the read inside the transaction to avoid stale-data risk.

### P4-D. Weighted bodyweight promotion must run on BOTH create and update paths in `logSet` [CERTAIN]

The `if (existing)` branch at line 1250 returns at line 1261, BEFORE the promotion check at line 1286. Move the promotion check to run after BOTH the create and update paths:

```ts
if (existing) {
  await db.loggedSets.update(existing.id, updated);
  result = { ...existing, ...updated } as LoggedSet;
} else {
  await db.loggedSets.add(loggedSet);
  result = loggedSet;
}

// Weighted bodyweight promotion — runs for BOTH create and update
if (input.performedWeightKg !== null && sessionExercise.effectiveType === "bodyweight") {
  await db.sessionExercises.update(sessionExerciseId, { effectiveType: "weight" });
}

return result;
```

### P4-E. Add weighted bodyweight promotion to `editSet` [RECOMMENDED]

`editSet` updates performed values but doesn't check if `performedWeightKg` should trigger promotion. The spec is ambiguous on whether "edit" counts as "logging," but for consistency and user expectation, add the same promotion check to `editSet`.

### P4-F. Add negative test: editing set to null weight does NOT demote [RECOMMENDED]

Verify that once an exercise is promoted to `"weight"`, setting `performedWeightKg = null` on `editSet` does not revert `effectiveType` back to `"bodyweight"`.

### P4-G. Validate `setIndex` against block count in `logSet` [RECOMMENDED]

Add a guard: if `blockIndex < setBlocksSnapshot.length`, check `setIndex < block.count`. Reject out-of-range values at the service layer rather than relying on the UI to prevent them.

### P4-H. Verify `deleteRoutine` implements auto-activation [CERTAIN]

The spec requires: "if deleting the active routine and other routines remain, automatically activate the earliest remaining routine by `importedAt` ASC." Verify this logic exists in the `deleteRoutine` function. If not, add it.

---

## Phase 5 Fixes

### P5-A. `allSetsHitCeiling` must check the correct performed field [CERTAIN]

The function only checks `performedReps`. It must inspect `block.targetKind` and compare the ceiling against the appropriate field:
- `targetKind === "reps"` → `performedReps >= ceiling`
- `targetKind === "duration"` → `performedDurationSec >= ceiling`
- `targetKind === "distance"` → `performedDistanceM >= ceiling`

### P5-B. Fix minimum increment guard math [CERTAIN]

`roundToIncrement(1, "barbell", "kg")` = `Math.round(1/2.5)*2.5` = 0. The fallback branch adds 0 instead of one increment.

**Fix:** Use `getIncrement(equipment, units)` directly:
```ts
if (suggestedWeightKg <= previousWeightKg) {
  suggestedWeightKg = previousWeightKg + getIncrement(effectiveEquipment, "kg");
}
```

### P5-C. Use `lbsToKg` helper instead of hardcoded `/ 2.20462` [RECOMMENDED]

Lines 409 and 428 use `roundedLbs / 2.20462`. Replace with the Phase 2 `lbsToKg()` helper for a single source of truth on conversion constants.

### P5-D. Add "Back-off" heuristic to `getBlockLabel` [RECOMMENDED]

The spec example shows "Back-off: 70kg x 12, 11, 10" but the plan produces "Set block 2". Add a heuristic: if a block follows a `top`-tagged block and has no tag itself, label it "Back-off." This is a small change with significant UX impact.

### P5-E. Strengthen lbs rounding test assertion [MINOR]

The test uses `toBeGreaterThan(100)` which would pass even with broken logic. Assert the exact expected canonical kg value within floating-point tolerance.

### P5-F. Fix `run-walk` exercise reference [CERTAIN]

Phase 5 references `run-walk` but the slug from `Run/walk` is `runwalk`. Apply the CSV name fix from P3-D, then update or verify the Phase 5 reference matches.

---

## Phase 6 Fixes

### P6-A. Superset timer: use flat round index, not `(blockIndex, setIndex)` pairs [CERTAIN]

The spec requires equal total working sets but allows different block decompositions. The timer must compute a flat round index by expanding all blocks sequentially, not match on `(blockIndex, setIndex)` pairs between the two sides.

```ts
function flatRoundIndex(blockIndex: number, setIndex: number, blocks: SetBlock[]): number {
  let idx = 0;
  for (let b = 0; b < blockIndex; b++) idx += blocks[b].count;
  return idx + setIndex;
}
```

### P6-B. Fix hardcoded `"barbell"` in ExerciseHistoryScreen [CERTAIN]

`toDisplayWeight` is called with `"barbell"` for all exercises. Pass the actual `effectiveEquipment` from the `sessionExercises` record (requires joining or denormalizing equipment onto the history query).

### P6-C. Pre-fill reps/duration/distance from last-time data [CERTAIN]

`handleSlotTap` in `ExerciseCard` only prefills `suggestedWeightKg` from the suggestion. It must also consult `historyData.lastTime[blockIndex]` for the reps/duration/distance fields when no current value exists.

### P6-D. Remove duplicate RestTimer from WorkoutScreen [CERTAIN]

`RestTimer` is rendered in both `WorkoutScreen.tsx` and `AppShell.tsx`. Remove the WorkoutScreen instance since AppShell provides the global placement.

### P6-E. Apply SetLogForm field selection per S2 [CERTAIN]

Pass `targetKind` from the set block to `SetLogForm`. Use it instead of `effectiveType` to determine which performed-value fields appear. Fall back to `effectiveType` for extras.

### P6-F. Fix superset round detection stale-data race [RECOMMENDED]

`shouldStartTimer` reads `activeSession.loggedSets` which hasn't been updated yet after `logSet` completes. Either re-query the database after `logSet`, or have `logSet` return the updated set list that `shouldStartTimer` can consume directly.

### P6-G. Reset `optionalWeightExpanded` on dialog reopen [RECOMMENDED]

Add `optionalWeightExpanded` reset to the `useEffect` that runs when `open` changes, or key the SetLogForm component so it remounts on each open.

### P6-H. Look up exercise names from catalog, not slug-splitting [RECOMMENDED]

Day preview in TodayScreen converts exercise IDs to names via slug heuristic. Use a catalog lookup instead for correct display names.

### P6-I. Distinguish create vs update in `logSet` for timer behavior [RECOMMENDED]

The spec says "editing does not affect the timer automatically." Have `logSet` return a flag indicating whether it was a create or update. Only start the timer on create.

### P6-J. Add `matchMedia` listener for "system" theme [RECOMMENDED]

When theme is set to "system", add a `matchMedia("(prefers-color-scheme: dark)")` listener to reactively apply the correct class when the OS theme changes.

### P6-K. Verify auto-activation-on-delete in Settings [CERTAIN]

The Settings screen's `handleDeleteRoutine` delegates to the service. Verify the Phase 4 `deleteRoutine` service implements the spec's deletion rules: auto-activate earliest remaining routine by `importedAt` ASC, or set `activeRoutineId = null` for last routine.

---

## Phase 7 Fixes

### P7-A. Deep-validate routine `exerciseId` references during import [CERTAIN]

`validateRoutine` checks structural fields but doesn't descend into `routine.days[*].entries[*].exerciseId`. Add a loop that checks every exercise reference against the current catalog.

### P7-B. Deep-validate routine internal structure during import [CERTAIN]

`validateRoutine` should validate `RoutineDay` and `RoutineEntry` internal structure: `entries` array exists, each entry has valid `kind`, set blocks are structurally valid, etc. Reuse validation logic from the routine-service if possible.

### P7-C. Add cross-record FK integrity checks to import [RECOMMENDED]

Validate referential integrity across imported records:
- `settings.activeRoutineId` → must match an imported routine ID (or be null)
- Every `sessionExercises.sessionId` → must match an imported session ID
- Every `loggedSets.sessionExerciseId` → must match an imported sessionExercise ID

### P7-D. Fix Playwright E2E port from 5173 to 4173 [CERTAIN]

Phase 7's `full-workflow.spec.ts` hardcodes `http://localhost:5173/exercise-logger/`. Phase 1's Playwright config uses `http://localhost:4173/exercise-logger` (preview server). Change to `4173`, or better, use `baseURL` from the Playwright config rather than hardcoding.

### P7-E. Expand Playwright test to actually log a set and test export [RECOMMENDED]

The "full workflow" test claims to cover "log sets, export, import round-trip" but finishes without logging and only checks that the export button exists. Add:
- Tap a set slot, fill in values, submit
- Click export and verify the download triggers
- (Import round-trip can remain a unit test if Playwright file handling is complex)

### P7-F. Add post-import navigation for active session [RECOMMENDED]

The spec says "the app must resume it after import." After a successful import that contains an active session, either navigate to the Workout screen or show a prominent toast directing the user there.

---

## Master Plan File Structure Fix

Remove `tailwind.config.ts` from the target file structure. Tailwind v4 uses CSS-first configuration with no config file.

---

## Summary

| Severity | Count |
|---|---|
| CERTAIN (must fix) | 24 |
| RECOMMENDED (should fix) | 12 |
| MINOR / CAUTION | 6 |
| DESIGN DECISION (resolved) | 2 |
| **Total** | **44** |

None of these issues are architectural — the phase decomposition, dependency chain, and spec coverage are all sound. These are implementation-level fixes that prevent bugs, spec drift, and test failures.

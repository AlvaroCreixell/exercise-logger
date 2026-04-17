# Per-Exercise Unit Selection & Weight Input Precision

## Problem

1. **Rounding destroys user input.** The app rounds every weight entry to equipment-specific increments (e.g., machine/cable = 10 lbs). Entering 7.5 lbs on a machine stores 10 lbs. The user knows what they lifted — the app should trust them.

2. **Unit choice is global.** A single kg/lbs toggle in Settings applies to all exercises. Real gyms mix equipment: some machines display lbs, some display kg, dumbbells may be in either. The user must go to Settings mid-workout to switch, and it changes every exercise at once.

## Design

### Change 1: Stop rounding weights (input AND display)

Both `toCanonicalKg()` and `toDisplayWeight()` currently round to equipment-specific increments. This rounding must be removed from **both paths** — user input AND display — because otherwise:
- User enters 7.5 lbs → stored as 3.40 kg (precise, good)
- Set chip shows `toDisplayWeight(3.40, "machine", "lbs")` → rounds to 10 lbs (bad — lies about what was logged)
- Reopening the set pre-fills "10" → saving a reps-only edit overwrites 7.5 with 10 (data loss)

**After:**

- **`toCanonicalKg(displayValue, displayUnits)`** — Convert display value to kg. No rounding. Just `lbsToKg()` when `displayUnits === "lbs"`, identity when `"kg"`. The `equipment` parameter is removed.
- **`toDisplayWeight(canonicalKg, units)`** — Convert canonical kg to display units. No equipment rounding. Just `kgToLbs()` when `units === "lbs"`, identity when `"kg"`. Clean floating-point noise with `Math.round(value * 100) / 100`. The `equipment` parameter is removed.
- **`roundToIncrement()`** — Kept. Used **only** by the progression engine for suggestions.

**Historical data note:** Existing `performedWeightKg` values were stored after rounding, so they remain at their rounded values. This is not reversible (the original input precision is lost). Only new logs from this point forward will store exact user input.

### Change 2: Per-exercise unit override on SessionExercise

Add a nullable field to `SessionExercise`:

```typescript
unitOverride: UnitSystem | null;  // null = inherit global setting
```

**Schema migration:** Dexie version 2 (IndexedDB schema version — distinct from the backup envelope `schemaVersion` which stays at 1). The field is not indexed, so no index change — just a version bump to add the field with a default of `null`.

**Default logic at session start:** When creating `SessionExercise` records in `startSessionWithCatalog`, look up the most recent finished session's `SessionExercise` for the same `exerciseId + instanceLabel`. If it had a non-null `unitOverride`, carry it forward. Otherwise `null`.

**Same for `addExtraExercise`:** Look up the most recent `SessionExercise` for that `exerciseId` across **any** instanceLabel (extras don't have labels, so they should match regardless of label) and carry forward `unitOverride`.

**Carryover query strategy:** To avoid a full-table scan of `sessionExercises`, query finished sessions first (sorted by `finishedAt` desc, limited), then load their session exercises. This keeps performance constant regardless of history size.

**Transaction safety:** The carryover lookup should run inside the same transaction as session creation to avoid TOCTOU races where another tab finishes a session between lookup and write.

### Change 3: UI — kg/lbs toggle on exercise cards

Add a small toggle to each `ExerciseCard` header during active workouts. Tapping it cycles between kg and lbs and writes the new value to the `SessionExercise` record.

**Effective unit resolution:** `unitOverride ?? globalUnits`. A helper function `getEffectiveUnit(unitOverride, globalUnits)` encapsulates this.

**Where units flow through the UI:**

| Component | Currently uses | After |
|-----------|---------------|-------|
| `ExerciseCard` (workout) | global `units` | `getEffectiveUnit(se.unitOverride, globalUnits)` |
| `SetLogSheet` | global `units` | effective unit from parent |
| `SetSlot` | global `units` | effective unit from parent |
| `ExerciseCard` (history — `SessionDetailScreen`) | global `units` | `getEffectiveUnit(se.unitOverride, globalUnits)` |
| `ExerciseHistoryScreen` | global `units` | `getEffectiveUnit(entry.unitOverride, globalUnits)` per entry |

### Change 4: Progression suggestions use effective unit

`getExerciseHistoryData` and `calculateBlockSuggestion` already receive `units`. The callers will pass the effective unit (override or global) instead of always passing global. Progression suggestions are the **only** place where `roundToIncrement` is still used — they snap to practical equipment increments so the user sees "add 5 lbs" not "add 4.87 lbs".

### Backup compatibility

The backup envelope `schemaVersion` stays at 1 (distinct from Dexie DB version which becomes 2). The `unitOverride` field is optional (nullable), so:
- Old backups without `unitOverride` import fine (field defaults to `null` at DB level)
- New backups with `unitOverride` are valid (validation accepts `UnitSystem | null | undefined`)
- On import, `unitOverride: undefined` is treated as `null` (Dexie handles this naturally since the field has no index)

Add validation for `unitOverride` in `validateSessionExercise`: must be `"kg"`, `"lbs"`, `null`, or `undefined`.

## Non-goals

- Per-exercise equipment override (already exists as `equipmentOverride` on routine entries)
- Changing the increment table
- Reconstructing original precision for historical rounded data

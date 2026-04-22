# Handoff — theme removal + workout-complete state

Two independent changes to the `exercise_logger` codebase. Files in this folder
mirror the original paths and are drop-in replacements.

## 1. Drop `theme` / `ThemePreference`

Dark mode was dropped from the UI but the field stayed in the data model. This
removes it everywhere.

**Modified files**

| File | Change |
|---|---|
| `web/src/domain/enums.ts` | Remove `ThemePreference` type |
| `web/src/domain/types.ts` | Remove `ThemePreference` import; remove `theme` from `Settings` interface |
| `web/src/db/database.ts` | Remove `theme: "system"` from `DEFAULT_SETTINGS` |
| `web/src/services/settings-service.ts` | Remove `ThemePreference` import and `setTheme()` function |
| `web/src/services/backup-service.ts` | Remove `ThemePreference` import, `VALID_THEMES`, `theme` validation; tolerate legacy `theme` on imported envelopes but strip it before `db.settings.put` |
| `web/src/services/CLAUDE.md` | Doc update |
| `web/tests/unit/db/database.test.ts` | Drop `theme` assertions |
| `web/tests/unit/services/settings-service.test.ts` | Drop `setTheme` import + describe block + `theme` assertions |
| `docs/design-spec.md` | Drift block updated |

**Backup compatibility**

Legacy backups that still carry `theme` will import fine: the validator no
longer requires or rejects the field, and `importBackup` rebuilds the settings
record from the current `Settings` shape (`id`, `activeRoutineId`, `units`)
before `put`, so dead keys never reach IndexedDB.

**What was NOT done (deliberately)**

- No Dexie v3 migration to strip `theme` from existing on-device settings
  records. Since the field is no longer read, it's inert. If you want the data
  purged from active installs, add a v3 migration that deletes the key; I
  didn't because the spec review listed this as low-priority cleanup.

## 2. "Workout complete" state

When every prescribed set is logged on `WorkoutScreen`, the footer now signals
a clear terminal state instead of looking identical to a half-done workout.

**Modified files**

| File | Change |
|---|---|
| `web/src/features/workout/WorkoutFooter.tsx` | New optional `allLogged` prop; when true, shows an "All sets logged" success-tinted eyebrow above the buttons and swaps the Finish CTA background to `bg-success` + appends a ✓ |
| `web/src/features/workout/WorkoutScreen.tsx` | Passes `allLogged={totalPrescribed > 0 && unloggedCount === 0}` |

**Behaviour**

- Only triggers when `totalPrescribed > 0` — an empty-routine session doesn't
  masquerade as "complete."
- Counts only `origin === "routine"` sets (existing convention from the
  unloggedCount computation).
- Sets remain editable after completion — tapping a logged cell still opens
  the sheet in edit mode. The banner just re-renders.
- Reuses existing Tailwind tokens (`success`, `success-soft`) — no new CSS.

**Why the lightweight approach**

Rejected: full-screen celebration, confetti, auto-finish. The Finish dialog
already gated by `ConfirmDialog` handles confirmation; a big celebration would
fight it. A sticky banner + tinted CTA is visible without blocking the user
from adding one more extra exercise before finishing.

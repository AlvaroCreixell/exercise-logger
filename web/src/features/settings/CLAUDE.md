# Settings Feature

Settings screen (`/settings`), routine import screen (`/settings/import`), and the share-target landing route (`/share-target`). Handles units toggle, active routine management, routine import (YAML paste, clipboard, share sheet, or file), backup export/import, clear-all-data, and the PWA install prompt.

## Screens

- `SettingsScreen.tsx` — Main settings list. Composes ActiveRoutineCard, RoutineList, UnitsToggle, backup/restore rows, AboutCard, install prompt.
- `RoutineImportScreen.tsx` — Import flow. Accepts YAML via paste textarea, "Paste from clipboard" button, or file picker; validates and imports-and-activates in one transaction. All input paths run through `extractSharedYaml` (`@/shared/lib/extractSharedYaml`), so ```-fenced blocks and surrounding chat prose are tolerated.
- `ShareTargetRedirect.tsx` — Landing route for the PWA `share_target` (manifest, GET). Android share sheet → `/share-target?text=…` → unwraps fences → redirects to `/settings/import` with `location.state.launchYaml`. The same `launchYaml` state key is used by `useRoutineLaunchQueue` (file_handlers).

## Components

- `ActiveRoutineCard.tsx` — Highlighted card for the currently active routine.
- `RoutineList.tsx` — List of non-active routines with activate/delete affordances.
- `AboutCard.tsx` — App info (name, tagline, privacy blurb, version). No GPT link — the custom-GPT flow is deprecated (`docs/custom-gpt/DEPRECATED.md`).
- `RowLink.tsx` — Settings row as a link.
- `SettingRow.tsx` — Generic settings row (label + action).
- `UnitsToggle.tsx` — Global kg/lbs toggle.
- `PrefSwitch.tsx` — Boolean `[on]`/`[off]` bracket-tag switch (role="switch", ≥44 px hit area). Used by the Workout section (keep screen on / rest cue vibration / rest cue sound).
- `LlmKeyCard.tsx` — "AI routine generation" section's Anthropic API key card. Collapsed row shows a masked key (`maskKey`) or "Not set"; tapping opens an inline editor (`Input` + Save/Cancel) that calls `setLlmApiKey`. When a key is set, also renders a "Test connection" button that calls `testAnthropicKey` (a free `models.retrieve` ping) and shows the pass/fail message inline.
- `YamlErrorList.tsx` — Error list rendered in the import screen and reused by `GenerationScreen`'s `"validation"` failure view.

## Local utilities (`lib/`)

- `formatErrorPath.ts` — Formats `ValidationError.path` into a human-readable breadcrumb.

## Hooks used

`useSettings`, `useAllRoutines`, `useRoutine`, `useActiveSession`, `useInstallPrompt` — from `@/shared/hooks/`.

## Services called

- `setUnits`, `setActiveRoutine`, `deleteRoutine`, `setKeepScreenOn`, `setRestCueHaptic`, `setRestCueSound`, `setUserName`, `setLlmApiKey` — `@/services/settings-service`.
- `validateAndNormalizeRoutine`, `importAndActivateRoutine` — `@/services/routine-service`.
- `exportBackup`, `downloadBackupFile`, `importBackup`, `readJsonFile`, `validateBackupPayload`, `clearAllData` — `@/services/backup-service`.
- `testAnthropicKey` — `@/services/llm/anthropic-provider` (LlmKeyCard's "Test connection").

## AI routine generation

`SettingsScreen` has an "AI routine generation" section composing only `LlmKeyCard`. The actual generation flow (questionnaire → `GenerationScreen`) lives in `features/onboarding/` — see that feature's CLAUDE.md — and is also reachable from here via the Routine section's "✨ Create a personalized routine" row, which navigates to `/onboarding/questionnaire` regardless of onboarding-completion state (Settings re-entry).

## Key UI invariants

- **Activation and deletion are blocked during an active session** (invariant 10). The UI disables these rows and shows an inline message when `useActiveSession()` is non-null.
- **Backup import is transactional.** `importBackup` runs inside a single Dexie transaction (invariant 11). The UI surfaces validation errors from `validateBackupPayload` *before* calling import.
- **Clear-all-data is blocked during an active session** and requires an explicit confirm dialog.
- **YAML import and activation is a single transaction** (`importAndActivateRoutine`). The UI treats it as atomic — either both succeed or both fail.

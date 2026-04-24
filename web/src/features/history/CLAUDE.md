# History Feature

Browse past sessions and drill down into set-level detail. Routes:
- `/history` — list of finished sessions grouped by month.
- `/history/sessions/:sessionId` — one session's full detail.
- `/history/exercises/:exerciseId` — one exercise's history across all sessions, grouped by set block.

## Screens

- `HistoryScreen.tsx` — Monthly-grouped list of finished sessions with a stats tile on top.
- `SessionDetailScreen.tsx` — One session: header, stats tile, per-exercise cards with set pills.
- `ExerciseHistoryScreen.tsx` — One exercise across sessions, set-block grouped.

## Components

- `SessionRow.tsx` — List row for a finished session (date chip, title, meta, chevron).
- `HistoryStatsTile.tsx` — Aggregate stats (sessions / sets / hours).
- `SessionDetailHeader.tsx` — Back button, eyebrow, serif title.
- `SessionDetailStatsTile.tsx` — Per-session stats (sets / volume / time).
- `SessionDetailExerciseCard.tsx` — Exercise card with tap-to-edit set pills.

## Local utilities (`lib/`)

- `groupByMonth.ts` — `groupSessionsByMonth()` with local-time boundaries.
- `sessionStats.ts` — Aggregations: `computeSessionVolumeKg`, per-session set counts. Also used by the Workout feature's finish celebration.

## Hooks used

`useFinishedSessionSummaries`, `useHistoryStats`, `useSessionDetail`, `useExerciseHistory`, `useExerciseHistoryGroups`, `useSettings` — from `@/shared/hooks/`.

## Shared utilities used

- `formatLoggedSet` — `@/shared/lib/formatLoggedSet` — single source of truth for rendering a `LoggedSet`. Used by `SessionDetailExerciseCard` pills and `ExerciseHistoryScreen` inline values. The compact string form (`"80kg × 10"`, `"12 reps"`, `"30s"`, `"500m"`) is canonical across every screen that shows logged sets.

## Services called

- `editSet`, `deleteSet` — `@/services/set-service` — used when tapping a set pill on a finished session.

## Key UI invariants

- **Finished sessions survive routine deletion** (invariant 5). All renderers read snapshot fields from `Session` and `SessionExercise`, never joining back to the live `Routine`.
- **Editing a finished session doesn't run bodyweight promotion** (set-service contract). The pill editor uses `editSet`, which is snapshot-safe on finished sessions.
- **Fractional weights preserved.** Display formatting uses `toDisplayWeight` which does not round to equipment increments (per key convention).

# Today Feature

The default route (`/`). Shows the active routine's current day, a "Start workout" CTA, a day picker, the last session card, and a training streak pill.

## Screens

- `TodayScreen.tsx` — Main layout. Composes the onboarding banner (conditionally), hero card, day selector, last session card, and streak pill. If there's an active session, renders a Resume Workout link card in place of the normal layout (honoring invariant 2: resume takes priority over start).

## Components

- `TodayHeroCard.tsx` — The large "today" card with day label, muscle groups, set count, and start button. Accepts an optional `routineName` prop; when set, renders a small 'Active routine: X' caption row above the day eyebrow. The active-session resume card also includes `session.routineNameSnapshot` for the same context.
- `DaySelector.tsx` — Lets the user pick a non-default day without advancing rotation.
- `LastSessionCard.tsx` — Summary of the most recent finished session.
- `StreakPill.tsx` — Training cadence badge (e.g., "3-day streak").
- `OnboardingBanner.tsx` (`@/features/today/OnboardingBanner`) — Dismissable banner reading "Finish setting up your routine →". Tapping it navigates to `/onboarding/questionnaire`; the × button calls `dismissOnboardingBanner`. Rendered by `TodayScreen` only when all three are true: an in-progress wizard state exists in sessionStorage (`loadWizardState() !== null`), `settings.onboardingCompletedAt === null`, and `settings.onboardingBannerDismissedAt === null`. It is wizard-state driven, not prompt-driven — there is no saved-prompt concept anymore (see `docs/custom-gpt/DEPRECATED.md`).

## Local utilities (`lib/`)

- `formatDate.ts` — `formatTodayEyebrow()` for the "FRIDAY · APRIL 21" eyebrow.
- `muscleGroups.ts` — `deriveDayMuscleGroups()` aggregates muscle groups from a `RoutineDay`'s exercises.
- `routineSummary.ts` — `summarizeRoutineDay(day, exercisesById)` returns `RoutineDaySummary` with `exerciseCount`, `setCount`, `firstExerciseName`, and `muscleGroups`. Used by `TodayScreen` to replace three former local helpers.

## Hooks used

`useSettings`, `useRoutine`, `useActiveSession`, `useLastSession`, `useTrainingCadence` — all from `@/shared/hooks/`.

## Services called

- `startSessionWithCatalog(db, routine, dayId)` from `@/services/session-service` — creates a new session on the "Start workout" tap. Does not advance rotation (rotation advances on finish, per invariant 3).

## Key UI invariants

- **Start is idempotent vs resume.** If an active session exists, never show "Start" — always redirect to `/workout`. Enforced by reading `useActiveSession` before rendering the hero CTA.
- **Day selector does not mutate routine state.** Picking a different day only changes the screen's "selected day" state; it does not advance `nextDayId` or write to the DB.

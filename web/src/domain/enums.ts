/** Exercise type — determines which fields are shown on the set logging form. */
export type ExerciseType = "weight" | "bodyweight" | "isometric" | "cardio";

/** Equipment type — drives practical rounding increments. */
export type ExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "kettlebell"
  | "bodyweight"
  | "cardio"
  | "medicine-ball"
  | "other";

/** Session lifecycle status.
 *  [R9] "discarded" was removed — discard() hard-deletes the row, so the value
 *  can never appear on a persisted Session. No data migration needed: past
 *  exports never included discarded rows either (they were deleted before
 *  the export ran). */
export type SessionStatus = "active" | "finished";

/** How a session exercise was added. */
export type SessionExerciseOrigin = "routine" | "extra";

/** Whether an exercise is standalone or part of a superset. */
export type GroupType = "single" | "superset";

/** The kind of target a set block prescribes. */
export type TargetKind = "reps" | "duration" | "distance";

/** Optional tag on a set block or logged set. */
export type SetTag = "top" | "amrap";

/** Display unit preference. */
export type UnitSystem = "kg" | "lbs";

/** Theme preference. */
export type ThemePreference = "light" | "dark" | "system";

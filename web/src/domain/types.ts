import type {
  ExerciseType,
  ExerciseEquipment,
  SessionStatus,
  SessionExerciseOrigin,
  GroupType,
  TargetKind,
  SetTag,
  UnitSystem,
  ThemePreference,
} from "./enums";

// ---------------------------------------------------------------------------
// Exercise Catalog
// ---------------------------------------------------------------------------

/** An exercise from the seeded catalog. */
export interface Exercise {
  /** Canonical slug, e.g. "barbell-back-squat". Primary key. */
  id: string;
  /** Display name, e.g. "Barbell Back Squat". */
  name: string;
  /** Exercise type. */
  type: ExerciseType;
  /** Equipment type. */
  equipment: ExerciseEquipment;
  /** Normalized muscle groups, e.g. ["Legs", "Core"]. */
  muscleGroups: string[];
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/** A single set-block prescription within a routine entry. */
export interface SetBlock {
  /** What kind of target: reps, duration, or distance. */
  targetKind: TargetKind;
  /** Minimum of a range target. Undefined when exactValue is set. */
  minValue?: number;
  /** Maximum of a range target. Undefined when exactValue is set. */
  maxValue?: number;
  /** Exact target value. Undefined when min/max range is set. */
  exactValue?: number;
  /** Number of sets for this block (>= 1). */
  count: number;
  /** Optional set tag. */
  tag?: SetTag;
}

/** An exercise entry within a routine day (standalone or inside a superset). */
export interface RoutineExerciseEntry {
  /** Deterministic ID generated at import time. */
  entryId: string;
  /** FK to exercises table. */
  exerciseId: string;
  /** Optional disambiguator for duplicate same-day exercises. */
  instanceLabel?: string;
  /** Override the catalog exercise type. */
  typeOverride?: ExerciseType;
  /** Override the catalog equipment type. */
  equipmentOverride?: ExerciseEquipment;
  /** Optional notes for this entry. */
  notes?: string;
  /** Prescribed set blocks. At least one. */
  setBlocks: SetBlock[];
}

/** A single entry in a routine day — either a standalone exercise or a superset. */
export type RoutineEntry =
  | {
      kind: "exercise";
      entryId: string;
      exerciseId: string;
      instanceLabel?: string;
      typeOverride?: ExerciseType;
      equipmentOverride?: ExerciseEquipment;
      notes?: string;
      setBlocks: SetBlock[];
    }
  | {
      kind: "superset";
      groupId: string;
      items: [RoutineExerciseEntry, RoutineExerciseEntry];
    };

/** A single day within a routine. */
export interface RoutineDay {
  /** Day identifier, e.g. "A". */
  id: string;
  /** Display label, e.g. "Heavy Squat + Horizontal Push/Pull". */
  label: string;
  /** Ordered entries for this day. */
  entries: RoutineEntry[];
}

/** A stored routine record. */
export interface Routine {
  /** UUID primary key. */
  id: string;
  /** Schema version, starts at 1. */
  schemaVersion: number;
  /** Display name. */
  name: string;
  /** Default rest between normal sets, in seconds. */
  restDefaultSec: number;
  /** Default rest between superset rounds, in seconds. */
  restSupersetSec: number;
  /** Explicit ordered rotation, e.g. ["A", "B", "C"]. */
  dayOrder: string[];
  /** Per-routine rotation state. Initialized to dayOrder[0]. */
  nextDayId: string;
  /** Normalized routine payload, keyed by day ID. */
  days: Record<string, RoutineDay>;
  /** Optional routine-level notes. */
  notes: string[];
  /** Optional informational cardio section. */
  cardio: RoutineCardio | null;
  /** ISO UTC timestamp of when this routine was imported. */
  importedAt: string;
}

/** Optional cardio info attached to a routine. */
export interface RoutineCardio {
  notes: string;
  options: RoutineCardioOption[];
}

/** A single cardio option. */
export interface RoutineCardioOption {
  name: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** A workout session record. */
export interface Session {
  /** UUID primary key. */
  id: string;
  /** FK to routines table, or null for ad-hoc sessions. */
  routineId: string | null;
  /** Snapshot of routine name at session start. */
  routineNameSnapshot: string;
  /** Selected day ID, e.g. "A". */
  dayId: string;
  /** Snapshot of day label at session start. */
  dayLabelSnapshot: string;
  /** Snapshot of dayOrder at session start for rotation advancement. */
  dayOrderSnapshot: string[];
  /** Snapshot of restDefaultSec at session start. */
  restDefaultSecSnapshot: number;
  /** Snapshot of restSupersetSec at session start. */
  restSupersetSecSnapshot: number;
  /** Session lifecycle status. */
  status: SessionStatus;
  /** ISO UTC timestamp of when the session was started. */
  startedAt: string;
  /** ISO UTC timestamp of when the session was finished, or null. */
  finishedAt: string | null;
}

/** A session exercise record — snapshot of a routine entry or an extra. */
export interface SessionExercise {
  /** UUID primary key. */
  id: string;
  /** FK to sessions table. */
  sessionId: string;
  /** FK to the source routine entry, or null for extras. */
  routineEntryId: string | null;
  /** FK to exercises table. */
  exerciseId: string;
  /** Snapshot of exercise display name. */
  exerciseNameSnapshot: string;
  /** How this exercise was added. */
  origin: SessionExerciseOrigin;
  /** Stable display order within the session. */
  orderIndex: number;
  /** Whether this is standalone or part of a superset. */
  groupType: GroupType;
  /** Shared by both members of a superset, or null. */
  supersetGroupId: string | null;
  /** 0 or 1 for supersets, null for singles. */
  supersetPosition: number | null;
  /**
   * Disambiguator copied from routine entry.
   * Empty string "" means "no instance label" (never null — Dexie excludes
   * null components from compound indexes).
   */
  instanceLabel: string;
  /** Catalog default or routine override. */
  effectiveType: ExerciseType;
  /** Catalog default or routine override. */
  effectiveEquipment: ExerciseEquipment;
  /** Copied from routine entry or user input, or null. */
  notesSnapshot: string | null;
  /** Copied normalized prescription. Empty array for extras. */
  setBlocksSnapshot: SetBlock[];
  /** ISO UTC timestamp of when this record was created. */
  createdAt: string;
}

/** A logged set record — one row per set slot. */
export interface LoggedSet {
  /** UUID primary key. */
  id: string;
  /** FK to sessions table. */
  sessionId: string;
  /** FK to sessionExercises table. */
  sessionExerciseId: string;
  /** Denormalized FK to exercises table for querying. */
  exerciseId: string;
  /**
   * Denormalized from sessionExercises for progression matching.
   * Empty string "" means "no instance label" (never null — Dexie excludes
   * null components from compound indexes).
   */
  instanceLabel: string;
  /** How the parent exercise was added. */
  origin: SessionExerciseOrigin;
  /** Index within setBlocksSnapshot; 0 for extras. */
  blockIndex: number;
  /** Normalized signature for progression matching. */
  blockSignature: string;
  /** Zero-based index within the block. */
  setIndex: number;
  /** Optional set tag: "top", "amrap", or null. */
  tag: SetTag | null;
  /** External load in kg, or null when not applicable. */
  performedWeightKg: number | null;
  /** Performed reps, or null when not applicable. */
  performedReps: number | null;
  /** Performed duration in seconds, or null when not applicable. */
  performedDurationSec: number | null;
  /** Performed distance in meters, or null when not applicable. */
  performedDistanceM: number | null;
  /** ISO UTC timestamp of when this set was first logged. */
  loggedAt: string;
  /** ISO UTC timestamp of the most recent update. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Single-record settings table. */
export interface Settings {
  /** Always "user". */
  id: string;
  /** FK to routines table, or null when no routine is active. */
  activeRoutineId: string | null;
  /** Display unit preference. */
  units: UnitSystem;
  /** Theme preference. */
  theme: ThemePreference;
}

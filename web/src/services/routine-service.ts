// yaml is dynamically imported inside validateAndNormalizeRoutine (see
// loadYaml() below) to keep the ~50 kB library out of the main bundle.
// It only loads when the app actually needs to parse YAML: first-run
// seed of the bundled routine, or user-triggered routine imports.
import type YAMLType from "yaml";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import type {
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  RoutineCardio,
  RoutineCardioOption,
  SetBlock,
  Exercise,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  TargetKind,
  SetTag,
} from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

/** A single validation error with field path and user-readable message. */
export interface ValidationError {
  path: string;
  message: string;
}

/** Result of validating and normalizing a routine YAML string. */
export type ValidateRoutineResult =
  | { ok: true; routine: Routine }
  | { ok: false; errors: ValidationError[] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_VERSIONS = new Set([1]);

const VALID_EXERCISE_TYPES = new Set<string>([
  "weight",
  "bodyweight",
  "isometric",
  "cardio",
]);

const VALID_EQUIPMENT = new Set<string>([
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "kettlebell",
  "bodyweight",
  "cardio",
  "medicine-ball",
  "other",
]);

const VALID_TAGS = new Set<string>(["top", "amrap"]);

const TARGET_KEYS = ["reps", "duration", "distance"] as const;

// ---------------------------------------------------------------------------
// Raw YAML shape types (unvalidated)
// ---------------------------------------------------------------------------

interface RawRoutine {
  version?: unknown;
  name?: unknown;
  rest_default_sec?: unknown;
  rest_superset_sec?: unknown;
  day_order?: unknown;
  days?: unknown;
  notes?: unknown;
  cardio?: unknown;
}

interface RawDay {
  label?: unknown;
  entries?: unknown;
}

interface RawExerciseEntry {
  exercise_id?: unknown;
  instance_label?: unknown;
  type_override?: unknown;
  equipment_override?: unknown;
  notes?: unknown;
  sets?: unknown;
}

interface RawSetBlock {
  reps?: unknown;
  duration?: unknown;
  distance?: unknown;
  count?: unknown;
  tag?: unknown;
}

// ---------------------------------------------------------------------------
// Validation + normalization
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a routine YAML string into a Routine record.
 *
 * @param yamlString - Raw YAML text to parse
 * @param exerciseLookup - Map of exerciseId -> Exercise for catalog validation.
 *   Pass the result of loading all exercises from the DB.
 * @returns ValidateRoutineResult with either the normalized Routine or validation errors.
 */
// Cache the dynamic yaml module so we only fetch the chunk once.
let yamlModulePromise: Promise<typeof YAMLType> | null = null;
function loadYaml(): Promise<typeof YAMLType> {
  if (!yamlModulePromise) {
    yamlModulePromise = import("yaml").then((m) => m.default);
  }
  return yamlModulePromise;
}

export async function validateAndNormalizeRoutine(
  yamlString: string,
  exerciseLookup: Map<string, Exercise>
): Promise<ValidateRoutineResult> {
  const errors: ValidationError[] = [];

  // Parse YAML
  let raw: RawRoutine;
  try {
    const YAML = await loadYaml();
    raw = YAML.parse(yamlString) as RawRoutine;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown parse error";
    return { ok: false, errors: [{ path: "", message: `Invalid YAML: ${message}` }] };
  }

  if (raw == null || typeof raw !== "object") {
    return {
      ok: false,
      errors: [{ path: "", message: "YAML must be a mapping (object), not a scalar or list" }],
    };
  }

  // --- version ---
  if (raw.version === undefined || raw.version === null) {
    errors.push({ path: "version", message: "version is required" });
  } else if (typeof raw.version !== "number" || !SUPPORTED_VERSIONS.has(raw.version)) {
    errors.push({
      path: "version",
      message: `Unsupported version "${raw.version}". Supported: ${[...SUPPORTED_VERSIONS].join(", ")}`,
    });
  }

  // --- name ---
  if (raw.name === undefined || raw.name === null || typeof raw.name !== "string" || raw.name.trim() === "") {
    errors.push({ path: "name", message: "name is required and must be a non-empty string" });
  }

  // --- rest_default_sec ---
  if (raw.rest_default_sec === undefined || raw.rest_default_sec === null) {
    errors.push({ path: "rest_default_sec", message: "rest_default_sec is required" });
  } else if (typeof raw.rest_default_sec !== "number" || raw.rest_default_sec < 0) {
    errors.push({
      path: "rest_default_sec",
      message: "rest_default_sec must be a non-negative number",
    });
  }

  // --- rest_superset_sec ---
  if (raw.rest_superset_sec === undefined || raw.rest_superset_sec === null) {
    errors.push({ path: "rest_superset_sec", message: "rest_superset_sec is required" });
  } else if (typeof raw.rest_superset_sec !== "number" || raw.rest_superset_sec < 0) {
    errors.push({
      path: "rest_superset_sec",
      message: "rest_superset_sec must be a non-negative number",
    });
  }

  // --- day_order ---
  let dayOrder: string[] = [];
  if (raw.day_order === undefined || raw.day_order === null) {
    errors.push({ path: "day_order", message: "day_order is required" });
  } else if (!Array.isArray(raw.day_order) || raw.day_order.length === 0) {
    errors.push({ path: "day_order", message: "day_order must be a non-empty array" });
  } else {
    dayOrder = raw.day_order.map((v: unknown) => String(v));

    // Check for duplicate day IDs in day_order
    const seen = new Set<string>();
    for (const id of dayOrder) {
      if (seen.has(id)) {
        errors.push({
          path: "day_order",
          message: `Duplicate day ID "${id}" in day_order`,
        });
      }
      seen.add(id);
    }
  }

  // --- days ---
  const rawDays: Record<string, RawDay> =
    raw.days != null && typeof raw.days === "object" && !Array.isArray(raw.days)
      ? (raw.days as Record<string, RawDay>)
      : {};

  if (raw.days === undefined || raw.days === null) {
    errors.push({ path: "days", message: "days is required" });
  } else if (typeof raw.days !== "object" || Array.isArray(raw.days)) {
    errors.push({ path: "days", message: "days must be a mapping (object)" });
  } else {
    const declaredDayIds = new Set(Object.keys(rawDays));

    // Check for missing day IDs (in day_order but not in days)
    for (const id of dayOrder) {
      if (!declaredDayIds.has(id)) {
        errors.push({
          path: `days`,
          message: `Day "${id}" is in day_order but not declared in days`,
        });
      }
    }

    // Check for extra day IDs (in days but not in day_order)
    const dayOrderSet = new Set(dayOrder);
    for (const id of declaredDayIds) {
      if (!dayOrderSet.has(id)) {
        errors.push({
          path: `days.${id}`,
          message: `Day "${id}" is declared in days but not in day_order`,
        });
      }
    }
  }

  // If we have structural errors at the top level, bail early
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // --- Validate and normalize each day ---
  const normalizedDays: Record<string, RoutineDay> = {};

  for (const dayId of dayOrder) {
    const rawDay = rawDays[dayId];
    if (rawDay === undefined || rawDay === null) {
      // Already caught above, but defensive
      continue;
    }

    const dayPath = `days.${dayId}`;

    // label
    if (
      rawDay.label === undefined ||
      rawDay.label === null ||
      typeof rawDay.label !== "string" ||
      rawDay.label.trim() === ""
    ) {
      errors.push({ path: `${dayPath}.label`, message: "label is required and must be a non-empty string" });
    }

    // entries
    if (!Array.isArray(rawDay.entries) || rawDay.entries.length === 0) {
      errors.push({
        path: `${dayPath}.entries`,
        message: "entries is required and must be a non-empty array",
      });
      continue;
    }

    // Track exercise_id usage for duplicate detection within this day
    const exerciseUsage = new Map<string, string[]>(); // exerciseId -> instanceLabels[]

    const normalizedEntries: RoutineEntry[] = [];
    let entryIndex = 0;

    for (let i = 0; i < rawDay.entries.length; i++) {
      const rawEntry = rawDay.entries[i];
      const entryPath = `${dayPath}.entries[${i}]`;

      if (rawEntry == null || typeof rawEntry !== "object") {
        errors.push({ path: entryPath, message: "Entry must be an object" });
        entryIndex++;
        continue;
      }

      // Determine if this is a superset or a single exercise
      if ("superset" in rawEntry) {
        // --- Superset entry ---
        const supersetItems = (rawEntry as { superset: unknown }).superset;

        if (!Array.isArray(supersetItems)) {
          errors.push({
            path: `${entryPath}.superset`,
            message: "superset must be an array",
          });
          entryIndex++;
          continue;
        }

        if (supersetItems.length !== 2) {
          errors.push({
            path: `${entryPath}.superset`,
            message: `Superset must have exactly 2 items, got ${supersetItems.length}`,
          });
          entryIndex++;
          continue;
        }

        const groupId = `${dayId}-e${entryIndex}-group`;
        const normalizedItems: RoutineExerciseEntry[] = [];
        let supersetValid = true;

        for (let si = 0; si < 2; si++) {
          const rawItem = supersetItems[si] as RawExerciseEntry;
          const itemPath = `${entryPath}.superset[${si}]`;
          const entryId = `${dayId}-e${entryIndex}-s${si}`;

          const result = validateExerciseEntry(
            rawItem,
            itemPath,
            exerciseLookup,
            errors
          );
          if (result === null) {
            supersetValid = false;
            continue;
          }

          // Track exercise usage for duplicate detection
          trackExerciseUsage(
            exerciseUsage,
            result.exerciseId,
            result.instanceLabel,
            itemPath,
            errors
          );

          normalizedItems.push({
            entryId,
            exerciseId: result.exerciseId,
            ...(result.instanceLabel !== undefined && {
              instanceLabel: result.instanceLabel,
            }),
            ...(result.typeOverride !== undefined && {
              typeOverride: result.typeOverride,
            }),
            ...(result.equipmentOverride !== undefined && {
              equipmentOverride: result.equipmentOverride,
            }),
            ...(result.notes !== undefined && { notes: result.notes }),
            setBlocks: result.setBlocks,
          });
        }

        // Validate equal total working set count
        if (supersetValid && normalizedItems.length === 2) {
          const totalSetsA = normalizedItems[0]!.setBlocks.reduce(
            (sum, b) => sum + b.count,
            0
          );
          const totalSetsB = normalizedItems[1]!.setBlocks.reduce(
            (sum, b) => sum + b.count,
            0
          );
          if (totalSetsA !== totalSetsB) {
            errors.push({
              path: `${entryPath}.superset`,
              message: `Superset items must have equal total working set count. "${normalizedItems[0]!.exerciseId}" has ${totalSetsA} sets, "${normalizedItems[1]!.exerciseId}" has ${totalSetsB} sets`,
            });
          }
        }

        if (supersetValid && normalizedItems.length === 2) {
          normalizedEntries.push({
            kind: "superset",
            groupId,
            items: [normalizedItems[0]!, normalizedItems[1]!],
          });
        }

        entryIndex++;
      } else if ("exercise_id" in rawEntry) {
        // --- Single exercise entry ---
        const entryId = `${dayId}-e${entryIndex}`;
        const result = validateExerciseEntry(
          rawEntry as RawExerciseEntry,
          entryPath,
          exerciseLookup,
          errors
        );

        if (result !== null) {
          // Track exercise usage for duplicate detection
          trackExerciseUsage(
            exerciseUsage,
            result.exerciseId,
            result.instanceLabel,
            entryPath,
            errors
          );

          normalizedEntries.push({
            kind: "exercise",
            entryId,
            exerciseId: result.exerciseId,
            ...(result.instanceLabel !== undefined && {
              instanceLabel: result.instanceLabel,
            }),
            ...(result.typeOverride !== undefined && {
              typeOverride: result.typeOverride,
            }),
            ...(result.equipmentOverride !== undefined && {
              equipmentOverride: result.equipmentOverride,
            }),
            ...(result.notes !== undefined && { notes: result.notes }),
            setBlocks: result.setBlocks,
          });
        }

        entryIndex++;
      } else {
        errors.push({
          path: entryPath,
          message:
            "Entry must have either 'exercise_id' (single exercise) or 'superset' (superset pair)",
        });
        entryIndex++;
      }
    }

    normalizedDays[dayId] = {
      id: dayId,
      label: typeof rawDay.label === "string" ? rawDay.label.trim() : "",
      entries: normalizedEntries,
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // --- notes (optional) ---
  let notes: string[] = [];
  if (raw.notes !== undefined && raw.notes !== null) {
    if (Array.isArray(raw.notes)) {
      notes = raw.notes.map((n: unknown) => String(n));
    } else {
      errors.push({
        path: "notes",
        message: "notes must be an array of strings",
      });
    }
  }

  // --- cardio (optional) ---
  let cardio: RoutineCardio | null = null;
  if (raw.cardio !== undefined && raw.cardio !== null) {
    if (typeof raw.cardio === "object" && !Array.isArray(raw.cardio)) {
      const rawCardio = raw.cardio as {
        notes?: unknown;
        options?: unknown;
      };
      const cardioNotes =
        typeof rawCardio.notes === "string" ? rawCardio.notes : "";
      const cardioOptions: RoutineCardioOption[] = [];
      if (Array.isArray(rawCardio.options)) {
        for (const opt of rawCardio.options) {
          if (typeof opt === "object" && opt !== null) {
            const o = opt as { name?: unknown; detail?: unknown };
            cardioOptions.push({
              name: typeof o.name === "string" ? o.name : "",
              detail: typeof o.detail === "string" ? o.detail : "",
            });
          }
        }
      }
      cardio = { notes: cardioNotes, options: cardioOptions };
    } else {
      errors.push({
        path: "cardio",
        message: "cardio must be an object with notes and options",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // --- Build the Routine record ---
  const routine: Routine = {
    id: generateId(),
    schemaVersion: raw.version as number,
    name: (raw.name as string).trim(),
    restDefaultSec: raw.rest_default_sec as number,
    restSupersetSec: raw.rest_superset_sec as number,
    dayOrder,
    nextDayId: dayOrder[0]!,
    days: normalizedDays,
    notes,
    cardio,
    importedAt: nowISO(),
  };

  return { ok: true, routine };
}

// ---------------------------------------------------------------------------
// Exercise entry validation helper
// ---------------------------------------------------------------------------

interface ParsedExerciseEntry {
  exerciseId: string;
  instanceLabel?: string;
  typeOverride?: ExerciseType;
  equipmentOverride?: ExerciseEquipment;
  notes?: string;
  setBlocks: SetBlock[];
}

/**
 * Validate a single exercise entry (either standalone or inside a superset).
 * Pushes errors to the errors array and returns null if the entry is invalid.
 */
function validateExerciseEntry(
  raw: RawExerciseEntry,
  path: string,
  exerciseLookup: Map<string, Exercise>,
  errors: ValidationError[]
): ParsedExerciseEntry | null {
  let valid = true;

  // exercise_id
  if (
    raw.exercise_id === undefined ||
    raw.exercise_id === null ||
    typeof raw.exercise_id !== "string" ||
    raw.exercise_id.trim() === ""
  ) {
    errors.push({
      path: `${path}.exercise_id`,
      message: "exercise_id is required",
    });
    valid = false;
  } else if (!exerciseLookup.has(raw.exercise_id)) {
    errors.push({
      path: `${path}.exercise_id`,
      message: `Exercise "${raw.exercise_id}" does not exist in the catalog`,
    });
    valid = false;
  }

  // instance_label (optional)
  let instanceLabel: string | undefined;
  if (raw.instance_label !== undefined && raw.instance_label !== null) {
    if (typeof raw.instance_label !== "string") {
      errors.push({
        path: `${path}.instance_label`,
        message: "instance_label must be a string",
      });
      valid = false;
    } else {
      instanceLabel = raw.instance_label;
    }
  }

  // type_override (optional)
  let typeOverride: ExerciseType | undefined;
  if (raw.type_override !== undefined && raw.type_override !== null) {
    const typeStr = String(raw.type_override).toLowerCase();
    if (!VALID_EXERCISE_TYPES.has(typeStr)) {
      errors.push({
        path: `${path}.type_override`,
        message: `Unsupported type_override "${raw.type_override}". Valid values: ${[...VALID_EXERCISE_TYPES].join(", ")}`,
      });
      valid = false;
    } else {
      typeOverride = typeStr as ExerciseType;
    }
  }

  // equipment_override (optional)
  let equipmentOverride: ExerciseEquipment | undefined;
  if (raw.equipment_override !== undefined && raw.equipment_override !== null) {
    const equipStr = String(raw.equipment_override).toLowerCase();
    if (!VALID_EQUIPMENT.has(equipStr)) {
      errors.push({
        path: `${path}.equipment_override`,
        message: `Unsupported equipment_override "${raw.equipment_override}". Valid values: ${[...VALID_EQUIPMENT].join(", ")}`,
      });
      valid = false;
    } else {
      equipmentOverride = equipStr as ExerciseEquipment;
    }
  }

  // notes (optional)
  let notes: string | undefined;
  if (raw.notes !== undefined && raw.notes !== null) {
    notes = String(raw.notes);
  }

  // sets (required, at least one)
  const setBlocks: SetBlock[] = [];
  if (!Array.isArray(raw.sets) || raw.sets.length === 0) {
    errors.push({
      path: `${path}.sets`,
      message: "At least one set block is required",
    });
    valid = false;
  } else {
    for (let si = 0; si < raw.sets.length; si++) {
      const rawBlock = raw.sets[si] as RawSetBlock;
      const blockPath = `${path}.sets[${si}]`;

      const block = validateSetBlock(rawBlock, blockPath, errors);
      if (block !== null) {
        setBlocks.push(block);
      } else {
        valid = false;
      }
    }
  }

  if (!valid) {
    return null;
  }

  return {
    exerciseId: raw.exercise_id as string,
    ...(instanceLabel !== undefined && { instanceLabel }),
    ...(typeOverride !== undefined && { typeOverride }),
    ...(equipmentOverride !== undefined && { equipmentOverride }),
    ...(notes !== undefined && { notes }),
    setBlocks,
  };
}

// ---------------------------------------------------------------------------
// Set block validation helper
// ---------------------------------------------------------------------------

/**
 * Validate a single set block.
 * Returns null and pushes errors if invalid.
 */
function validateSetBlock(
  raw: RawSetBlock,
  path: string,
  errors: ValidationError[]
): SetBlock | null {
  if (raw == null || typeof raw !== "object") {
    errors.push({ path, message: "Set block must be an object" });
    return null;
  }

  let valid = true;

  // --- Exactly one of reps/duration/distance ---
  const presentTargets = TARGET_KEYS.filter(
    (k) => raw[k] !== undefined && raw[k] !== null
  );

  if (presentTargets.length === 0) {
    errors.push({
      path,
      message: "Set block must define exactly one of: reps, duration, distance",
    });
    return null;
  }

  if (presentTargets.length > 1) {
    errors.push({
      path,
      message: `Set block must define exactly one of reps/duration/distance, but found: ${presentTargets.join(", ")}`,
    });
    return null;
  }

  const targetKey = presentTargets[0]! as TargetKind;
  const targetValue = raw[targetKey];

  let minValue: number | undefined;
  let maxValue: number | undefined;
  let exactValue: number | undefined;

  if (Array.isArray(targetValue)) {
    // Range: [min, max]
    if (targetValue.length !== 2) {
      errors.push({
        path: `${path}.${targetKey}`,
        message: `Range must have exactly 2 values [min, max], got ${targetValue.length}`,
      });
      valid = false;
    } else {
      const min = targetValue[0] as number;
      const max = targetValue[1] as number;
      if (typeof min !== "number" || typeof max !== "number") {
        errors.push({
          path: `${path}.${targetKey}`,
          message: "Range values must be numbers",
        });
        valid = false;
      } else if (min >= max) {
        errors.push({
          path: `${path}.${targetKey}`,
          message: `Range min (${min}) must be less than max (${max})`,
        });
        valid = false;
      } else {
        minValue = min;
        maxValue = max;
      }
    }
  } else if (typeof targetValue === "number") {
    // Exact value
    exactValue = targetValue;
  } else {
    errors.push({
      path: `${path}.${targetKey}`,
      message: `${targetKey} must be a number (exact) or [min, max] array (range)`,
    });
    valid = false;
  }

  // --- count ---
  if (raw.count === undefined || raw.count === null) {
    errors.push({ path: `${path}.count`, message: "count is required" });
    valid = false;
  } else if (typeof raw.count !== "number" || !Number.isInteger(raw.count) || raw.count < 1) {
    errors.push({
      path: `${path}.count`,
      message: `count must be an integer >= 1, got ${raw.count}`,
    });
    valid = false;
  }

  // --- tag (optional) ---
  let tag: SetTag | undefined;
  if (raw.tag !== undefined && raw.tag !== null) {
    const tagStr = String(raw.tag).toLowerCase();
    if (!VALID_TAGS.has(tagStr)) {
      errors.push({
        path: `${path}.tag`,
        message: `Unsupported tag "${raw.tag}". Valid values: top, amrap`,
      });
      valid = false;
    } else {
      tag = tagStr as SetTag;
    }
  }

  if (!valid) {
    return null;
  }

  const block: SetBlock = {
    targetKind: targetKey,
    count: raw.count as number,
    ...(minValue !== undefined && { minValue }),
    ...(maxValue !== undefined && { maxValue }),
    ...(exactValue !== undefined && { exactValue }),
    ...(tag !== undefined && { tag }),
  };

  return block;
}

// ---------------------------------------------------------------------------
// Duplicate exercise tracking within a day
// ---------------------------------------------------------------------------

/**
 * Track exercise usage within a day for duplicate detection.
 *
 * Spec rule: "Duplicate exercise_id values in the same day are allowed only
 * when each duplicate defines a distinct instance_label."
 */
function trackExerciseUsage(
  usage: Map<string, string[]>,
  exerciseId: string,
  instanceLabel: string | undefined,
  path: string,
  errors: ValidationError[]
): void {
  const label = instanceLabel ?? "";
  const existing = usage.get(exerciseId);

  if (existing === undefined) {
    usage.set(exerciseId, [label]);
    return;
  }

  // Check if this exact label already exists
  if (existing.includes(label)) {
    if (label === "") {
      errors.push({
        path: `${path}.exercise_id`,
        message: `Duplicate exercise "${exerciseId}" in the same day without instance_label. Add distinct instance_label values to disambiguate.`,
      });
    } else {
      errors.push({
        path: `${path}.instance_label`,
        message: `Duplicate exercise "${exerciseId}" with instance_label "${label}" in the same day. Each duplicate must have a distinct instance_label.`,
      });
    }
  } else {
    // Different label — check that previously seen entries also had labels
    if (existing.includes("")) {
      errors.push({
        path: `${path}.exercise_id`,
        message: `Duplicate exercise "${exerciseId}" in the same day. The earlier entry has no instance_label. Add distinct instance_label values to all occurrences.`,
      });
    }
    existing.push(label);
  }
}

// ---------------------------------------------------------------------------
// Import routine to database
// ---------------------------------------------------------------------------

/**
 * Import a validated and normalized routine into the database.
 */
export async function importRoutine(
  db: ExerciseLoggerDB,
  routine: Routine
): Promise<void> {
  await db.routines.add(routine);
}

// ---------------------------------------------------------------------------
// Combined validate + import helper for UI entry points
// ---------------------------------------------------------------------------

/** User-facing result of running a YAML import end-to-end. */
export type ImportRoutineResult =
  | { ok: true; routineName: string }
  | { ok: false; errors: string[] };

/**
 * Validate a YAML string, normalize it into a Routine, and import it.
 *
 * Shared entry point for both the file-picker and paste-to-import UI flows.
 * Returns a user-friendly result: `routineName` on success, or an array of
 * `"path: message"` strings on failure.
 */
export async function validateParseAndImportRoutine(
  db: ExerciseLoggerDB,
  yamlText: string
): Promise<ImportRoutineResult> {
  if (!yamlText.trim()) {
    return { ok: false, errors: ["input: YAML is empty"] };
  }

  const exercises = await db.exercises.toArray();
  const lookup = new Map(exercises.map((ex) => [ex.id, ex]));

  const result = await validateAndNormalizeRoutine(yamlText, lookup);
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }

  await importRoutine(db, result.routine);
  return { ok: true, routineName: result.routine.name };
}

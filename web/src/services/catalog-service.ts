import { parseCsv } from "@/lib/csv-parser";
import { slugify } from "@/domain/slug";
import type { Exercise } from "@/domain/types";
import type { ExerciseType, ExerciseEquipment } from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import catalogCsvRaw from "@/data/catalog.csv?raw";

/**
 * Parse the embedded catalog CSV and return Exercise[].
 * This is the primary entry point for browser usage (Vite bundles the CSV).
 */
export function loadEmbeddedCatalog(): Exercise[] {
  return parseExerciseCatalog(catalogCsvRaw);
}

// ---------------------------------------------------------------------------
// CSV -> Exercise[] conversion
// ---------------------------------------------------------------------------

/** Valid ExerciseType values (lowercase for matching). */
const VALID_TYPES = new Set<string>([
  "weight",
  "bodyweight",
  "isometric",
  "cardio",
]);

/** Valid ExerciseEquipment values (lowercase for matching). */
const VALID_EQUIPMENT = new Set<string>([
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "kettlebell",
  "bodyweight",
  "cardio",
  "medicine-ball",
  "medicine ball",
  "other",
  // Compound values from catalog — we take the first one
  "machine / cable",
  "kettlebell / dumbbell",
]);

/**
 * Normalize an equipment string from the CSV to a valid ExerciseEquipment enum value.
 *
 * The catalog uses display-friendly formats like "Machine / Cable" and
 * "Medicine Ball". We map these to the canonical enum values:
 * - "Machine / Cable" -> "machine" (first value wins)
 * - "Kettlebell / Dumbbell" -> "kettlebell" (first value wins)
 * - "Medicine Ball" -> "medicine-ball"
 */
function normalizeEquipment(raw: string): ExerciseEquipment {
  const lower = raw.toLowerCase().trim();

  // Handle compound equipment — take the first value
  if (lower.includes(" / ")) {
    const first = lower.split(" / ")[0]!.trim();
    return first as ExerciseEquipment;
  }

  // Handle "medicine ball" -> "medicine-ball"
  if (lower === "medicine ball") {
    return "medicine-ball";
  }

  return lower as ExerciseEquipment;
}

/**
 * Normalize a type string from the CSV to a valid ExerciseType enum value.
 */
function normalizeType(raw: string): ExerciseType {
  return raw.toLowerCase().trim() as ExerciseType;
}

/**
 * Parse the muscle group field into an array of normalized muscle group strings.
 *
 * The CSV uses " / " as a separator for multi-group exercises:
 * - "Legs" -> ["Legs"]
 * - "Back / Legs" -> ["Back", "Legs"]
 * - "Chest / Arms" -> ["Chest", "Arms"]
 */
function parseMuscleGroups(raw: string): string[] {
  return raw
    .split("/")
    .map((g) => g.trim())
    .filter((g) => g !== "");
}

/**
 * Parse a CSV string into an array of Exercise records.
 *
 * Expected CSV columns: Name, Type, Equipment, Muscle Group
 *
 * Throws if any row has:
 * - an empty Name field
 * - an unrecognized Type value
 * - an unrecognized Equipment value (P3-A: validated against VALID_EQUIPMENT)
 * - an empty Type or Equipment field
 */
export function parseExerciseCatalog(csv: string): Exercise[] {
  const rows = parseCsv(csv);
  const exercises: Exercise[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const lineNum = i + 2; // +2 because line 1 is header, and i is 0-based

    const name = row["Name"] ?? "";
    const typeRaw = row["Type"] ?? "";
    const equipmentRaw = row["Equipment"] ?? "";
    const muscleGroupRaw = row["Muscle Group"] ?? "";

    if (name === "") {
      errors.push(`Line ${lineNum}: missing Name`);
      continue;
    }

    if (typeRaw === "") {
      errors.push(`Line ${lineNum} (${name}): missing Type`);
      continue;
    }

    if (!VALID_TYPES.has(typeRaw.toLowerCase().trim())) {
      errors.push(
        `Line ${lineNum} (${name}): unknown Type "${typeRaw}"`
      );
      continue;
    }

    if (equipmentRaw === "") {
      errors.push(`Line ${lineNum} (${name}): missing Equipment`);
      continue;
    }

    // P3-A: Validate equipment against VALID_EQUIPMENT set
    if (!VALID_EQUIPMENT.has(equipmentRaw.toLowerCase().trim())) {
      errors.push(
        `Line ${lineNum} (${name}): unknown Equipment "${equipmentRaw}"`
      );
      continue;
    }

    exercises.push({
      id: slugify(name),
      name,
      type: normalizeType(typeRaw),
      equipment: normalizeEquipment(equipmentRaw),
      muscleGroups: parseMuscleGroups(muscleGroupRaw),
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `Exercise catalog has ${errors.length} error(s):\n${errors.join("\n")}`
    );
  }

  return exercises;
}

// ---------------------------------------------------------------------------
// Catalog seeding
// ---------------------------------------------------------------------------

/**
 * Seed or update the exercises table from parsed Exercise records.
 *
 * Uses bulkPut to upsert — existing exercises with the same ID are updated,
 * new exercises are inserted. This makes the catalog idempotent across app
 * restarts and CSV updates.
 */
export async function seedCatalog(
  db: ExerciseLoggerDB,
  exercises: Exercise[]
): Promise<void> {
  await db.exercises.bulkPut(exercises);
}

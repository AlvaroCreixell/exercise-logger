# Phase 3: Catalog & Routine Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠ ERRATA — READ BEFORE IMPLEMENTING ⚠**
> Full errata: `docs/superpowers/plans/2026-03-30-plan-errata.md`
> Fixes for this phase: **P3-A through P3-E**. Apply these during implementation — they override the corresponding code below.
>
> **P3-A [CERTAIN]:** Add equipment enum validation to the CSV parser. Currently `parseExerciseCatalog` uses `as ExerciseEquipment` cast without checking. Validate each equipment value against the `VALID_EQUIPMENT` set (already exists in the routine service). Reject or warn on unknown values like `"Trampoline"`.
> **P3-B [CERTAIN]:** Resolve compound equipment values in CSV: `Lat Pulldown` = `Machine / Cable`, `Farmer's Carry` = `Kettlebell / Dumbbell`. Decision: **first value wins** after split on `/` and trim. `Lat Pulldown` → `machine`, `Farmer's Carry` → `kettlebell`. Document and test this behavior.
> **P3-C [CERTAIN]:** Delete the malformed `Burpees,,,` row (line 83) and trailing blank line from the CSV. It has empty Type/Equipment/Muscle Group and duplicates `Burpee`.
> **P3-D [CERTAIN]:** Fix `Run/walk` slug inconsistency. The slugify function strips `/`, producing `runwalk`, but Phase 5 references this exercise as `run-walk`. **Fix: rename the CSV entry from `Run/walk` to `Run-Walk`** so slugify produces `run-walk`.
> **P3-E [MINOR]:** Add a positive test case for `distance` target kind (e.g., `{ distance: 2000, count: 1 }`). No test currently validates this target type.

**Goal:** Update the exercise catalog CSV with 8 missing exercises and trimmed columns, build a CSV parser that seeds the exercises table on app init, install the YAML parser, implement full routine validation (all 11 rules from spec section 9), normalize YAML authoring format into the `Routine` record shape, and write the actual Full Body 3-Day Rotation YAML template file.

**Architecture:** The CSV parser lives in `web/src/lib/csv-parser.ts` as a generic utility. The catalog service in `web/src/services/catalog-service.ts` uses it to parse the embedded CSV and seed/update the Dexie `exercises` table. The routine service in `web/src/services/routine-service.ts` uses `yaml` (npm package) to parse YAML, validates against all spec rules, and normalizes into the `Routine` type from Phase 2. All validation errors are specific, field-level, and user-readable. Tests live in `web/tests/unit/`.

**Tech Stack:** TypeScript 5 strict mode, Vitest for unit testing, `fake-indexeddb` for Dexie tests in Node, `yaml` npm package for YAML parsing. Import alias `@/` maps to `web/src/`.

---

## File Structure (Phase 3 target state)

New and modified files created by this phase:

```
docs/exercises/
└── gym_exercises_catalog.csv         # Modified: add 8 exercises, remove 3 columns, fix Burpees dupe
web/
├── data/
│   └── routines/
│       └── full-body-3day.yaml       # Create: reference routine template
├── src/
│   ├── data/
│   │   └── catalog.csv               # Create: embedded copy of exercise catalog for Vite
│   ├── lib/
│   │   └── csv-parser.ts             # Create: generic CSV -> object[] parser
│   └── services/
│       ├── catalog-service.ts        # Create: CSV parsing + catalog seeding
│       └── routine-service.ts        # Create: YAML validation, normalization, import
└── tests/
    └── unit/
        ├── lib/
        │   └── csv-parser.test.ts    # Create: CSV parser tests
        └── services/
            ├── catalog-service.test.ts   # Create: catalog seeding tests
            └── routine-service.test.ts   # Create: validation + normalization tests
```

---

### Task 1: Update the exercise catalog CSV

**Files:**
- Modify: `docs/exercises/gym_exercises_catalog.csv`

The current CSV has columns: `Name`, `Type`, `Equipment`, `Muscle Group`, `Primary Muscles`, `Secondary Muscles`, `Difficulty`. The spec says to remove `Primary Muscles`, `Secondary Muscles`, and `Difficulty`. The current CSV already lacks those three columns (they were already removed), so the structure is already `Name,Type,Equipment,Muscle Group`. We need to add 8 missing exercises and remove the duplicate incomplete "Burpees" entry at the end (line 83 — "Burpees,,,").

- [ ] **Step 1: Update the CSV file**

Replace `docs/exercises/gym_exercises_catalog.csv` with:

```csv
Name,Type,Equipment,Muscle Group
Barbell Back Squat,Weight,Barbell,Legs
Barbell Deadlift,Weight,Barbell,Back / Legs
Barbell Romanian Deadlift,Weight,Barbell,Legs
Barbell Hip Thrust,Weight,Barbell,Legs
Barbell Bench Press,Weight,Barbell,Chest
Incline Barbell Press,Weight,Barbell,Chest
Barbell Overhead Press,Weight,Barbell,Shoulders
Barbell Row,Weight,Barbell,Back
Barbell Curl,Weight,Barbell,Arms
Close-Grip Bench Press,Weight,Barbell,Arms
Skull Crusher,Weight,Barbell,Arms
Barbell Shrug,Weight,Barbell,Back
Dumbbell Bench Press,Weight,Dumbbell,Chest
Incline Dumbbell Press,Weight,Dumbbell,Chest
Dumbbell Flyes,Weight,Dumbbell,Chest
Dumbbell Shoulder Press,Weight,Dumbbell,Shoulders
Dumbbell Lateral Raise,Weight,Dumbbell,Shoulders
Dumbbell Front Raise,Weight,Dumbbell,Shoulders
Dumbbell Rear Delt Fly,Weight,Dumbbell,Shoulders
Arnold Press,Weight,Dumbbell,Shoulders
Dumbbell Row,Weight,Dumbbell,Back
Dumbbell Curl,Weight,Dumbbell,Arms
Hammer Curl,Weight,Dumbbell,Arms
Concentration Curl,Weight,Dumbbell,Arms
Dumbbell Overhead Tricep Extension,Weight,Dumbbell,Arms
Dumbbell Kickback,Weight,Dumbbell,Arms
Dumbbell Lunge,Weight,Dumbbell,Legs
Dumbbell Romanian Deadlift,Weight,Dumbbell,Legs
Dumbbell Shrug,Weight,Dumbbell,Back
Dumbbell Pullover,Weight,Dumbbell,Chest
Dumbbell Reverse Lunge,Weight,Dumbbell,Legs
Single-Leg Romanian Deadlift,Weight,Dumbbell,Legs
Chest Press Machine,Weight,Machine,Chest
Pec Deck / Fly Machine,Weight,Machine,Chest
Leg Press,Weight,Machine,Legs
Leg Extension,Weight,Machine,Legs
Leg Curl,Weight,Machine,Legs
Calf Raise Machine,Weight,Machine,Legs
Adductor Machine,Weight,Machine,Legs
Abductor Machine,Weight,Machine,Legs
Shoulder Press Machine,Weight,Machine,Shoulders
Reverse Pec Deck,Weight,Machine,Shoulders
Lat Pulldown,Weight,Machine / Cable,Back
Seated Cable Row,Weight,Cable,Back
T-Bar Row,Weight,Machine,Back
Tricep Pushdown,Weight,Cable,Arms
Cable Curl,Weight,Cable,Arms
Cable Crossover,Weight,Cable,Chest
Face Pull,Weight,Cable,Shoulders
Cable Lateral Raise,Weight,Cable,Shoulders
Cable Crunch,Weight,Cable,Core
Pallof Press,Weight,Cable,Core
Cable Woodchop,Weight,Cable,Core
Kettlebell Swing,Weight,Kettlebell,Legs / Back
Farmer's Carry,Weight,Kettlebell / Dumbbell,Full Body
Medicine Ball Rotational Slam,Weight,Medicine Ball,Core
Wrist Roller,Weight,Other,Arms
Pull-Up,Bodyweight,Bodyweight,Back
Chin-Up,Bodyweight,Bodyweight,Back
Inverted Row,Bodyweight,Bodyweight,Back
Push-Up,Bodyweight,Bodyweight,Chest
Wide Push-Up,Bodyweight,Bodyweight,Chest
Diamond Push-Up,Bodyweight,Bodyweight,Arms
Decline Push-Up,Bodyweight,Bodyweight,Chest
Pike Push-Up,Bodyweight,Bodyweight,Shoulders
Dip,Bodyweight,Bodyweight,Chest / Arms
Squat,Bodyweight,Bodyweight,Legs
Lunge,Bodyweight,Bodyweight,Legs
Reverse Lunge,Bodyweight,Bodyweight,Legs
Calf Raise,Bodyweight,Bodyweight,Legs
Crunch,Bodyweight,Bodyweight,Core
Bicycle Crunch,Bodyweight,Bodyweight,Core
Leg Raise,Bodyweight,Bodyweight,Core
Hanging Leg Raise,Bodyweight,Bodyweight,Core
Mountain Climber,Bodyweight,Bodyweight,Core
Superman,Bodyweight,Bodyweight,Back
Burpee,Bodyweight,Bodyweight,Full Body
Ab Wheel Rollout,Bodyweight,Bodyweight,Core
Plank,Isometric,Bodyweight,Core
Side Plank,Isometric,Bodyweight,Core
Wall Sit,Isometric,Bodyweight,Legs
Glute Bridge Hold,Isometric,Bodyweight,Legs
Dead Hang,Isometric,Bodyweight,Back
Hollow Body Hold,Isometric,Bodyweight,Core
L-Sit,Isometric,Bodyweight,Core
Flexed-Arm Hang,Isometric,Bodyweight,Arms
Run/walk,Cardio,Cardio,Cardio
Rowing machine,Cardio,Cardio,Cardio
Stationary Bike,Cardio,Cardio,Cardio
```

Changes from the original:
- Added 8 exercises: Pallof Press, Cable Woodchop, Medicine Ball Rotational Slam, Wrist Roller, Reverse Lunge, Dumbbell Reverse Lunge, Single-Leg Romanian Deadlift, Dumbbell Pullover
- Removed the duplicate incomplete "Burpees,,," entry at the end (line 83)
- Kept the original "Burpee" entry (which was already present)

- [ ] **Step 2: Verify the CSV has the correct number of rows**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
wc -l docs/exercises/gym_exercises_catalog.csv
```

Expected: `90 docs/exercises/gym_exercises_catalog.csv` (1 header + 89 exercises).

- [ ] **Step 3: Verify no duplicate exercise names**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
tail -n +2 docs/exercises/gym_exercises_catalog.csv | cut -d',' -f1 | sort | uniq -d
```

Expected: No output (no duplicates).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/exercises/gym_exercises_catalog.csv
git commit -m "$(cat <<'EOF'
feat: add 8 missing exercises and clean up catalog CSV

Add: Pallof Press, Cable Woodchop, Medicine Ball Rotational Slam,
Wrist Roller, Reverse Lunge, Dumbbell Reverse Lunge,
Single-Leg Romanian Deadlift, Dumbbell Pullover.
Remove duplicate incomplete Burpees entry.
EOF
)"
```

---

### Task 2: Create the generic CSV parser

**Files:**
- Create: `web/src/lib/csv-parser.ts`
- Create: `web/tests/unit/lib/csv-parser.test.ts`

- [ ] **Step 1: Create the CSV parser**

Create `web/src/lib/csv-parser.ts`:

```ts
/**
 * Parse a CSV string into an array of objects.
 *
 * Assumptions:
 * - The first line is a header row.
 * - Fields are comma-separated.
 * - No quoted fields with embedded commas or newlines (the exercise catalog
 *   uses simple values like "Machine / Cable" which contain slashes, not commas).
 * - Empty lines are skipped.
 * - Leading and trailing whitespace is trimmed from each field.
 *
 * Returns an array of Record<string, string> where keys are the header names.
 */
export function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}
```

- [ ] **Step 2: Create the CSV parser tests**

Create `web/tests/unit/lib/csv-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv-parser";

describe("parseCsv", () => {
  it("parses a simple CSV with header and data rows", () => {
    const csv = `Name,Type,Equipment
Barbell Back Squat,Weight,Barbell
Leg Curl,Weight,Machine`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Barbell Back Squat", Type: "Weight", Equipment: "Barbell" },
      { Name: "Leg Curl", Type: "Weight", Equipment: "Machine" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseCsv("   \n  \n  ")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    const csv = "Name,Type,Equipment";
    const result = parseCsv(csv);
    expect(result).toEqual([]);
  });

  it("trims whitespace from headers and values", () => {
    const csv = ` Name , Type , Equipment
 Squat , Bodyweight , Bodyweight `;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight", Equipment: "Bodyweight" },
    ]);
  });

  it("skips empty lines", () => {
    const csv = `Name,Type

Squat,Bodyweight

Plank,Isometric
`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight" },
      { Name: "Plank", Type: "Isometric" },
    ]);
  });

  it("handles values with slashes (not treated as separators)", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Lat Pulldown,Weight,Machine / Cable,Back
Kettlebell Swing,Weight,Kettlebell,Legs / Back`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      {
        Name: "Lat Pulldown",
        Type: "Weight",
        Equipment: "Machine / Cable",
        "Muscle Group": "Back",
      },
      {
        Name: "Kettlebell Swing",
        Type: "Weight",
        Equipment: "Kettlebell",
        "Muscle Group": "Legs / Back",
      },
    ]);
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const csv = "Name,Type\r\nSquat,Bodyweight\r\nPlank,Isometric\r\n";
    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight" },
      { Name: "Plank", Type: "Isometric" },
    ]);
  });

  it("fills missing values with empty string when row has fewer columns", () => {
    const csv = `Name,Type,Equipment
Squat,Bodyweight`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight", Equipment: "" },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/lib/csv-parser.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/lib/csv-parser.ts web/tests/unit/lib/csv-parser.test.ts
git commit -m "$(cat <<'EOF'
feat: add generic CSV parser utility
EOF
)"
```

---

### Task 3: Create the catalog service (CSV parsing + Dexie seeding)

**Files:**
- Create: `web/src/services/catalog-service.ts`
- Create: `web/tests/unit/services/catalog-service.test.ts`

- [ ] **Step 1: Create the catalog service**

Create `web/src/services/catalog-service.ts`:

```ts
import { parseCsv } from "@/lib/csv-parser";
import { slugify } from "@/domain/slug";
import type { Exercise } from "@/domain/types";
import type { ExerciseType, ExerciseEquipment } from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";

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
```

- [ ] **Step 2: Create the catalog service tests**

Create `web/tests/unit/services/catalog-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB } from "@/db/database";
import {
  parseExerciseCatalog,
  seedCatalog,
} from "@/services/catalog-service";
import type { Exercise } from "@/domain/types";

describe("parseExerciseCatalog", () => {
  it("parses a valid catalog CSV into Exercise[]", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Barbell Back Squat,Weight,Barbell,Legs
Pull-Up,Bodyweight,Bodyweight,Back
Plank,Isometric,Bodyweight,Core
Run/walk,Cardio,Cardio,Cardio`;

    const exercises = parseExerciseCatalog(csv);
    expect(exercises).toHaveLength(4);

    expect(exercises[0]).toEqual({
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    });

    expect(exercises[1]).toEqual({
      id: "pull-up",
      name: "Pull-Up",
      type: "bodyweight",
      equipment: "bodyweight",
      muscleGroups: ["Back"],
    });

    expect(exercises[2]).toEqual({
      id: "plank",
      name: "Plank",
      type: "isometric",
      equipment: "bodyweight",
      muscleGroups: ["Core"],
    });

    expect(exercises[3]).toEqual({
      id: "runwalk",
      name: "Run/walk",
      type: "cardio",
      equipment: "cardio",
      muscleGroups: ["Cardio"],
    });
  });

  it("normalizes compound equipment to the first value", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Lat Pulldown,Weight,Machine / Cable,Back
Farmer's Carry,Weight,Kettlebell / Dumbbell,Full Body`;

    const exercises = parseExerciseCatalog(csv);
    expect(exercises[0]!.equipment).toBe("machine");
    expect(exercises[1]!.equipment).toBe("kettlebell");
  });

  it("normalizes 'Medicine Ball' equipment to 'medicine-ball'", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Medicine Ball Rotational Slam,Weight,Medicine Ball,Core`;

    const exercises = parseExerciseCatalog(csv);
    expect(exercises[0]!.equipment).toBe("medicine-ball");
  });

  it("parses multi-group muscle groups", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Barbell Deadlift,Weight,Barbell,Back / Legs
Dip,Bodyweight,Bodyweight,Chest / Arms`;

    const exercises = parseExerciseCatalog(csv);
    expect(exercises[0]!.muscleGroups).toEqual(["Back", "Legs"]);
    expect(exercises[1]!.muscleGroups).toEqual(["Chest", "Arms"]);
  });

  it("generates correct slugs", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Single-Leg Romanian Deadlift,Weight,Dumbbell,Legs
Pec Deck / Fly Machine,Weight,Machine,Chest
Farmer's Carry,Weight,Kettlebell / Dumbbell,Full Body`;

    const exercises = parseExerciseCatalog(csv);
    expect(exercises[0]!.id).toBe("single-leg-romanian-deadlift");
    expect(exercises[1]!.id).toBe("pec-deck-fly-machine");
    expect(exercises[2]!.id).toBe("farmers-carry");
  });

  it("throws on missing Name", () => {
    const csv = `Name,Type,Equipment,Muscle Group
,Weight,Barbell,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow("missing Name");
  });

  it("throws on missing Type", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Squat,,Bodyweight,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow("missing Type");
  });

  it("throws on unknown Type", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Squat,Unknown,Bodyweight,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow('unknown Type "Unknown"');
  });

  it("throws on missing Equipment", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Squat,Bodyweight,,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow("missing Equipment");
  });

  it("collects multiple errors into one throw", () => {
    const csv = `Name,Type,Equipment,Muscle Group
,Weight,Barbell,Legs
Squat,,Bodyweight,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow("2 error(s)");
  });

  it("returns empty array for header-only CSV", () => {
    const csv = "Name,Type,Equipment,Muscle Group";
    const exercises = parseExerciseCatalog(csv);
    expect(exercises).toEqual([]);
  });
});

describe("parseExerciseCatalog with real catalog", () => {
  it("parses all exercises from the actual catalog file", async () => {
    // Read the actual CSV file
    const fs = await import("fs");
    const path = await import("path");
    const csvPath = path.resolve(
      __dirname,
      "../../../../docs/exercises/gym_exercises_catalog.csv"
    );
    const csv = fs.readFileSync(csvPath, "utf-8");

    const exercises = parseExerciseCatalog(csv);

    // Should have 89 exercises (90 lines minus 1 header)
    expect(exercises.length).toBe(89);

    // Verify the 8 newly added exercises exist
    const ids = new Set(exercises.map((e) => e.id));
    expect(ids.has("pallof-press")).toBe(true);
    expect(ids.has("cable-woodchop")).toBe(true);
    expect(ids.has("medicine-ball-rotational-slam")).toBe(true);
    expect(ids.has("wrist-roller")).toBe(true);
    expect(ids.has("reverse-lunge")).toBe(true);
    expect(ids.has("dumbbell-reverse-lunge")).toBe(true);
    expect(ids.has("single-leg-romanian-deadlift")).toBe(true);
    expect(ids.has("dumbbell-pullover")).toBe(true);

    // Verify no duplicate IDs
    expect(ids.size).toBe(exercises.length);

    // Spot check specific exercises
    const paloff = exercises.find((e) => e.id === "pallof-press")!;
    expect(paloff.type).toBe("weight");
    expect(paloff.equipment).toBe("cable");
    expect(paloff.muscleGroups).toEqual(["Core"]);

    const medBall = exercises.find(
      (e) => e.id === "medicine-ball-rotational-slam"
    )!;
    expect(medBall.equipment).toBe("medicine-ball");

    const latPulldown = exercises.find((e) => e.id === "lat-pulldown")!;
    expect(latPulldown.equipment).toBe("machine");
  });
});

describe("seedCatalog", () => {
  let db: ExerciseLoggerDB;

  beforeEach(() => {
    db = new ExerciseLoggerDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("seeds exercises into the database", async () => {
    const exercises: Exercise[] = [
      {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight",
        equipment: "barbell",
        muscleGroups: ["Legs"],
      },
      {
        id: "pull-up",
        name: "Pull-Up",
        type: "bodyweight",
        equipment: "bodyweight",
        muscleGroups: ["Back"],
      },
    ];

    await seedCatalog(db, exercises);

    const stored = await db.exercises.toArray();
    expect(stored).toHaveLength(2);
    expect(stored[0]!.id).toBe("barbell-back-squat");
    expect(stored[1]!.id).toBe("pull-up");
  });

  it("updates existing exercises on re-seed (idempotent)", async () => {
    const v1: Exercise[] = [
      {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight",
        equipment: "barbell",
        muscleGroups: ["Legs"],
      },
    ];

    const v2: Exercise[] = [
      {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight",
        equipment: "barbell",
        muscleGroups: ["Legs", "Core"],
      },
    ];

    await seedCatalog(db, v1);
    await seedCatalog(db, v2);

    const stored = await db.exercises.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.muscleGroups).toEqual(["Legs", "Core"]);
  });

  it("adds new exercises on re-seed without removing existing ones", async () => {
    const v1: Exercise[] = [
      {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight",
        equipment: "barbell",
        muscleGroups: ["Legs"],
      },
    ];

    const v2: Exercise[] = [
      {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight",
        equipment: "barbell",
        muscleGroups: ["Legs"],
      },
      {
        id: "pull-up",
        name: "Pull-Up",
        type: "bodyweight",
        equipment: "bodyweight",
        muscleGroups: ["Back"],
      },
    ];

    await seedCatalog(db, v1);
    await seedCatalog(db, v2);

    const stored = await db.exercises.toArray();
    expect(stored).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/catalog-service.test.ts
```

Expected: All 14 tests pass (11 parseExerciseCatalog + 3 seedCatalog).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/catalog-service.ts web/tests/unit/services/catalog-service.test.ts
git commit -m "$(cat <<'EOF'
feat: add catalog service for CSV parsing and exercise seeding
EOF
)"
```

---

### Task 3b: Embed the catalog CSV for Vite and update catalog-service for dual usage

**Files:**
- Create: `web/src/data/catalog.csv`
- Modify: `web/src/services/catalog-service.ts`

The CSV lives in `docs/exercises/gym_exercises_catalog.csv` but Vite cannot serve files outside the `web/` tree. This task copies the CSV content into `web/src/data/catalog.csv` and updates the catalog-service to support two import modes: (a) a raw CSV string import via Vite's `?raw` suffix for the browser, and (b) the existing `parseExerciseCatalog(csvString)` API for tests (which can read via Node `fs`).

- [ ] **Step 1: Copy the catalog CSV into the web source tree**

Copy `docs/exercises/gym_exercises_catalog.csv` to `web/src/data/catalog.csv`:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
cp docs/exercises/gym_exercises_catalog.csv web/src/data/catalog.csv
```

- [ ] **Step 2: Add a Vite `?raw` import module declaration**

Create `web/src/vite-env-raw.d.ts` (or add to existing `vite-env.d.ts`):

```ts
declare module "*.csv?raw" {
  const content: string;
  export default content;
}
```

This tells TypeScript that `import csv from "./data/catalog.csv?raw"` returns a `string`.

- [ ] **Step 3: Add a convenience re-export for the embedded catalog**

Add the following to the top of `web/src/services/catalog-service.ts`, after the existing imports:

```ts
import catalogCsvRaw from "@/data/catalog.csv?raw";

/**
 * Parse the embedded catalog CSV and return Exercise[].
 * This is the primary entry point for browser usage (Vite bundles the CSV).
 */
export function loadEmbeddedCatalog(): Exercise[] {
  return parseExerciseCatalog(catalogCsvRaw);
}
```

The existing `parseExerciseCatalog(csv: string)` function remains unchanged and is still used by tests that read CSV via Node `fs`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/data/catalog.csv web/src/services/catalog-service.ts web/src/vite-env-raw.d.ts
git commit -m "$(cat <<'EOF'
feat: embed catalog CSV in web source tree for Vite bundling
EOF
)"
```

---

### Task 4: Install the YAML parser

**Files:**
- Modify: `web/package.json` (new dependency)

- [ ] **Step 1: Install the `yaml` package**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install yaml
```

Expected: `yaml` added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify the package works**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
node -e "const YAML = require('yaml'); console.log(YAML.parse('name: test').name)"
```

Expected: `test` printed.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/package.json web/package-lock.json
git commit -m "$(cat <<'EOF'
feat: install yaml package for routine import parsing
EOF
)"
```

---

### Task 5: Create the routine service — validation and normalization

**Files:**
- Create: `web/src/services/routine-service.ts`

This is the largest task. It implements:
1. YAML parsing into a raw object
2. Validation against all 11 spec section 9 rules
3. Normalization from the YAML authoring format into the `Routine` record shape

- [ ] **Step 1: Create the routine service**

Create `web/src/services/routine-service.ts`:

```ts
import YAML from "yaml";
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
export function validateAndNormalizeRoutine(
  yamlString: string,
  exerciseLookup: Map<string, Exercise>
): ValidateRoutineResult {
  const errors: ValidationError[] = [];

  // Parse YAML
  let raw: RawRoutine;
  try {
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
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/routine-service.ts
git commit -m "$(cat <<'EOF'
feat: add routine service with YAML validation, normalization, and import
EOF
)"
```

---

### Task 6: Write routine service tests — validation rules

**Files:**
- Create: `web/tests/unit/services/routine-service.test.ts`

This test file covers all 11 validation rules from spec section 9, plus normalization and import tests. It is split into multiple parts for readability.

- [ ] **Step 1: Create the test file**

Create `web/tests/unit/services/routine-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ExerciseLoggerDB } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
  type ValidationError,
} from "@/services/routine-service";
import type { Exercise, Routine } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal exercise lookup map for validation. */
function buildLookup(ids: string[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const id of ids) {
    map.set(id, {
      id,
      name: id,
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    });
  }
  return map;
}

/**
 * Minimal valid YAML that passes all validation rules.
 * All exercise_ids in this YAML must be present in the lookup.
 */
const VALID_EXERCISE_IDS = [
  "barbell-back-squat",
  "leg-curl",
  "dumbbell-bench-press",
  "dumbbell-row",
];

const VALID_YAML = `
version: 1
name: "Test Routine"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]

days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 3 }
`;

const VALID_LOOKUP = buildLookup(VALID_EXERCISE_IDS);

/** Helper to get error messages from a failed validation result. */
function getErrors(yamlStr: string, lookup?: Map<string, Exercise>): ValidationError[] {
  const result = validateAndNormalizeRoutine(yamlStr, lookup ?? VALID_LOOKUP);
  if (result.ok) {
    throw new Error("Expected validation to fail but it succeeded");
  }
  return result.errors;
}

/** Helper to get the routine from a successful validation result. */
function getRoutine(yamlStr: string, lookup?: Map<string, Exercise>): Routine {
  const result = validateAndNormalizeRoutine(yamlStr, lookup ?? VALID_LOOKUP);
  if (!result.ok) {
    throw new Error(
      `Expected validation to succeed but it failed:\n${result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`
    );
  }
  return result.routine;
}

// ---------------------------------------------------------------------------
// Validation rule tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — validation rules", () => {
  describe("Rule: unknown version", () => {
    it("rejects missing version", () => {
      const yaml = `
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version")).toBe(true);
    });

    it("rejects unsupported version number", () => {
      const yaml = `
version: 99
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version" && e.message.includes("Unsupported version"))).toBe(true);
    });

    it("rejects non-numeric version", () => {
      const yaml = `
version: "one"
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "version")).toBe(true);
    });
  });

  describe("Rule: missing or duplicate day IDs", () => {
    it("rejects missing days section", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.path === "days")).toBe(true);
    });

    it("rejects duplicate day IDs in day_order", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate day ID"))).toBe(true);
    });
  });

  describe("Rule: day_order does not match declared days exactly", () => {
    it("rejects day in day_order but not in days", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"B" is in day_order but not declared'))).toBe(true);
    });

    it("rejects day in days but not in day_order", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
  B:
    label: "Day B"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"B" is declared in days but not in day_order'))).toBe(true);
    });
  });

  describe("Rule: exercise_id does not exist in catalog", () => {
    it("rejects unknown exercise_id", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: unknown-exercise
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"unknown-exercise" does not exist in the catalog'))).toBe(true);
    });

    it("rejects unknown exercise_id inside a superset", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: nonexistent-exercise
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('"nonexistent-exercise" does not exist'))).toBe(true);
    });
  });

  describe("Rule: range has min >= max", () => {
    it("rejects reps range where min >= max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [12, 8], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (12) must be less than max (8)"))).toBe(true);
    });

    it("rejects reps range where min equals max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 8], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (8) must be less than max (8)"))).toBe(true);
    });

    it("rejects duration range where min >= max", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { duration: [60, 30], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("min (60) must be less than max (30)"))).toBe(true);
    });
  });

  describe("Rule: count < 1", () => {
    it("rejects count of 0", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 0 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
    });

    it("rejects negative count", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: -1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
    });

    it("rejects missing count", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8] }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("count is required"))).toBe(true);
    });
  });

  describe("Rule: more than one of reps/duration/distance in a block", () => {
    it("rejects block with both reps and duration", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, duration: 30, count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of reps/duration/distance"))).toBe(true);
    });

    it("rejects block with all three targets", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, duration: 30, distance: 1000, count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of reps/duration/distance"))).toBe(true);
    });

    it("rejects block with no target", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly one of: reps, duration, distance"))).toBe(true);
    });
  });

  describe("Rule: superset does not have exactly 2 items", () => {
    it("rejects superset with 1 item", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly 2 items, got 1"))).toBe(true);
    });

    it("rejects superset with 3 items", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: leg-curl
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("exactly 2 items, got 3"))).toBe(true);
    });
  });

  describe("Rule: superset pair does not have equal total working set count", () => {
    it("rejects superset with unequal set counts", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 2 }
`;
      const errors = getErrors(yaml);
      expect(
        errors.some(
          (e) =>
            e.message.includes("equal total working set count") &&
            e.message.includes("3 sets") &&
            e.message.includes("2 sets")
        )
      ).toBe(true);
    });

    it("accepts superset with equal set counts across multiple blocks", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [6, 8], count: 1 }
              - { reps: [8, 12], count: 2 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
`;
      const routine = getRoutine(yaml);
      expect(routine).toBeDefined();
    });
  });

  describe("Rule: duplicate same-day exercise entries without instance_label", () => {
    it("rejects duplicate exercise_id in same day without instance_label", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate exercise") && e.message.includes("instance_label"))).toBe(true);
    });

    it("accepts duplicate exercise_id with distinct instance_labels", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        instance_label: heavy
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const routine = getRoutine(yaml);
      expect(routine).toBeDefined();
    });

    it("rejects when first entry has no label but second does", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes("Duplicate exercise") || e.message.includes("instance_label"))).toBe(true);
    });
  });

  describe("Rule: unsupported type_override or equipment_override", () => {
    it("rejects unsupported type_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        type_override: swimming
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('Unsupported type_override "swimming"'))).toBe(true);
    });

    it("rejects unsupported equipment_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        equipment_override: trampoline
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const errors = getErrors(yaml);
      expect(errors.some((e) => e.message.includes('Unsupported equipment_override "trampoline"'))).toBe(true);
    });

    it("accepts valid type_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        type_override: bodyweight
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const routine = getRoutine(yaml);
      const entry = routine.days["A"]!.entries[0]!;
      expect(entry.kind).toBe("exercise");
      if (entry.kind === "exercise") {
        expect(entry.typeOverride).toBe("bodyweight");
      }
    });

    it("accepts valid equipment_override", () => {
      const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        equipment_override: dumbbell
        sets:
          - { reps: [6, 8], count: 1 }
`;
      const routine = getRoutine(yaml);
      const entry = routine.days["A"]!.entries[0]!;
      expect(entry.kind).toBe("exercise");
      if (entry.kind === "exercise") {
        expect(entry.equipmentOverride).toBe("dumbbell");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Normalization tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — normalization", () => {
  it("normalizes a valid minimal YAML into a Routine record", () => {
    const routine = getRoutine(VALID_YAML);

    expect(routine.schemaVersion).toBe(1);
    expect(routine.name).toBe("Test Routine");
    expect(routine.restDefaultSec).toBe(90);
    expect(routine.restSupersetSec).toBe(60);
    expect(routine.dayOrder).toEqual(["A"]);
    expect(routine.nextDayId).toBe("A");
    expect(routine.notes).toEqual([]);
    expect(routine.cardio).toBeNull();
    expect(routine.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(routine.importedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("generates deterministic entryIds from day and position", () => {
    const routine = getRoutine(VALID_YAML);
    const entries = routine.days["A"]!.entries;

    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("exercise");
    if (entries[0]!.kind === "exercise") {
      expect(entries[0]!.entryId).toBe("A-e0");
    }
  });

  it("normalizes set blocks with range values", () => {
    const routine = getRoutine(VALID_YAML);
    const entry = routine.days["A"]!.entries[0]!;
    expect(entry.kind).toBe("exercise");
    if (entry.kind === "exercise") {
      expect(entry.setBlocks).toHaveLength(2);

      const block0 = entry.setBlocks[0]!;
      expect(block0.targetKind).toBe("reps");
      expect(block0.minValue).toBe(6);
      expect(block0.maxValue).toBe(8);
      expect(block0.exactValue).toBeUndefined();
      expect(block0.count).toBe(1);
      expect(block0.tag).toBe("top");

      const block1 = entry.setBlocks[1]!;
      expect(block1.targetKind).toBe("reps");
      expect(block1.minValue).toBe(8);
      expect(block1.maxValue).toBe(12);
      expect(block1.exactValue).toBeUndefined();
      expect(block1.count).toBe(3);
      expect(block1.tag).toBeUndefined();
    }
  });

  it("normalizes exact value set blocks", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, count: 3 }
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      const block = entry.setBlocks[0]!;
      expect(block.targetKind).toBe("reps");
      expect(block.exactValue).toBe(8);
      expect(block.minValue).toBeUndefined();
      expect(block.maxValue).toBeUndefined();
      expect(block.count).toBe(3);
    }
  });

  it("normalizes duration set blocks", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { duration: [30, 60], count: 2 }
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      const block = entry.setBlocks[0]!;
      expect(block.targetKind).toBe("duration");
      expect(block.minValue).toBe(30);
      expect(block.maxValue).toBe(60);
    }
  });

  it("normalizes superset entries with correct entryIds and groupId", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Each arm"
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    expect(entry.kind).toBe("superset");
    if (entry.kind === "superset") {
      expect(entry.groupId).toBe("A-e0-group");
      expect(entry.items).toHaveLength(2);
      expect(entry.items[0]!.entryId).toBe("A-e0-s0");
      expect(entry.items[0]!.exerciseId).toBe("dumbbell-bench-press");
      expect(entry.items[1]!.entryId).toBe("A-e0-s1");
      expect(entry.items[1]!.exerciseId).toBe("dumbbell-row");
      expect(entry.items[1]!.notes).toBe("Each arm");
    }
  });

  it("normalizes multi-day routines with correct nextDayId", () => {
    const yaml = `
version: 1
name: "Multi-day"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B, C]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
  B:
    label: "Day B"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
  C:
    label: "Day C"
    entries:
      - exercise_id: dumbbell-row
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const routine = getRoutine(yaml);
    expect(routine.dayOrder).toEqual(["A", "B", "C"]);
    expect(routine.nextDayId).toBe("A");
    expect(Object.keys(routine.days)).toHaveLength(3);
  });

  it("normalizes notes and cardio sections", () => {
    const yaml = `
version: 1
name: "With extras"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
notes:
  - "First note"
  - "Second note"
cardio:
  notes: "After lifting"
  options:
    - { name: "Walk", detail: "20-30 min" }
    - { name: "Run", detail: "5K" }
`;
    const routine = getRoutine(yaml);
    expect(routine.notes).toEqual(["First note", "Second note"]);
    expect(routine.cardio).not.toBeNull();
    expect(routine.cardio!.notes).toBe("After lifting");
    expect(routine.cardio!.options).toHaveLength(2);
    expect(routine.cardio!.options[0]!.name).toBe("Walk");
    expect(routine.cardio!.options[0]!.detail).toBe("20-30 min");
    expect(routine.cardio!.options[1]!.name).toBe("Run");
    expect(routine.cardio!.options[1]!.detail).toBe("5K");
  });

  it("preserves exercise notes on individual entries", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1 }
        notes: "Warm up with 2 lighter sets"
`;
    const routine = getRoutine(yaml);
    const entry = routine.days["A"]!.entries[0]!;
    if (entry.kind === "exercise") {
      expect(entry.notes).toBe("Warm up with 2 lighter sets");
    }
  });

  it("preserves instanceLabel on entries", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        instance_label: heavy
        sets:
          - { reps: [6, 8], count: 1 }
      - exercise_id: barbell-back-squat
        instance_label: light
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const routine = getRoutine(yaml);
    const entries = routine.days["A"]!.entries;
    expect(entries).toHaveLength(2);
    if (entries[0]!.kind === "exercise") {
      expect(entries[0]!.instanceLabel).toBe("heavy");
      expect(entries[0]!.entryId).toBe("A-e0");
    }
    if (entries[1]!.kind === "exercise") {
      expect(entries[1]!.instanceLabel).toBe("light");
      expect(entries[1]!.entryId).toBe("A-e1");
    }
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — edge cases", () => {
  it("rejects invalid YAML syntax", () => {
    const yaml = `
version: 1
name: "Test
  this is broken
`;
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.message).toContain("Invalid YAML");
    }
  });

  it("rejects YAML that parses to a scalar", () => {
    const yaml = "just a string";
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
  });

  it("rejects YAML that parses to null", () => {
    const yaml = "";
    const result = validateAndNormalizeRoutine(yaml, VALID_LOOKUP);
    expect(result.ok).toBe(false);
  });

  it("rejects entry with no exercise_id or superset key", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - sets:
          - { reps: [6, 8], count: 1 }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("exercise_id") || e.message.includes("superset"))).toBe(true);
  });

  it("rejects exercise entry with no sets", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("At least one set block is required"))).toBe(true);
  });

  it("rejects exercise entry with empty sets array", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets: []
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("At least one set block is required"))).toBe(true);
  });

  it("handles fractional count (non-integer)", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 2.5 }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes("count must be an integer >= 1"))).toBe(true);
  });

  it("handles unsupported tag value", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: warmup }
`;
    const errors = getErrors(yaml);
    expect(errors.some((e) => e.message.includes('Unsupported tag "warmup"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// importRoutine tests
// ---------------------------------------------------------------------------

describe("importRoutine", () => {
  let db: ExerciseLoggerDB;

  beforeEach(() => {
    db = new ExerciseLoggerDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("stores a routine in the database", async () => {
    const routine = getRoutine(VALID_YAML);
    await importRoutine(db, routine);

    const stored = await db.routines.get(routine.id);
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("Test Routine");
    expect(stored!.dayOrder).toEqual(["A"]);
    expect(stored!.nextDayId).toBe("A");
  });

  it("stores multiple routines", async () => {
    const r1 = getRoutine(VALID_YAML);

    const yaml2 = `
version: 1
name: "Second Routine"
rest_default_sec: 60
rest_superset_sec: 45
day_order: [X]
days:
  X:
    label: "Day X"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const r2 = getRoutine(yaml2);

    await importRoutine(db, r1);
    await importRoutine(db, r2);

    const all = await db.routines.toArray();
    expect(all).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/routine-service.test.ts
```

Expected: All tests pass. The test file contains approximately 40 test cases across 4 describe blocks:
- Validation rules: ~25 tests (at least 2 per rule, covering 11 rules)
- Normalization: ~10 tests
- Edge cases: ~7 tests
- importRoutine: 2 tests

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/routine-service.test.ts
git commit -m "$(cat <<'EOF'
test: add comprehensive routine validation and normalization tests

Covers all 11 validation rules from spec section 9, normalization of
YAML authoring format to Routine record shape, and database import.
EOF
)"
```

---

### Task 7: Write the Full Body 3-Day Rotation YAML template

**Files:**
- Create: `web/data/routines/full-body-3day.yaml`

This is the actual routine YAML file from spec section 9, ready for import.

- [ ] **Step 1: Create the routine directory**

```bash
mkdir -p "C:/Users/creix/VSC Projects/exercise_logger/web/data/routines"
```

- [ ] **Step 2: Create the YAML file**

Create `web/data/routines/full-body-3day.yaml`:

```yaml
version: 1
name: "Full Body 3-Day Rotation"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B, C]

days:
  A:
    label: "Heavy Squat + Horizontal Push/Pull"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 3 }
        notes: "Warm up with 2 lighter sets"

      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
        notes: "Slow eccentric, 2-3 sec"

      - exercise_id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }

      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Each arm"

      - exercise_id: tricep-pushdown
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: pallof-press
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Slow rotation at full extension"

  B:
    label: "Moderate Hinge + Vertical Push/Pull"
    entries:
      - exercise_id: dumbbell-romanian-deadlift
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 2 }
        notes: "Top set first, then back-off work"

      - exercise_id: dumbbell-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: leg-extension
        sets:
          - { reps: [8, 12], count: 2 }

      - superset:
          - exercise_id: dumbbell-shoulder-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Seated or standing"
          - exercise_id: lat-pulldown
            sets:
              - { reps: [8, 12], count: 3 }

      - exercise_id: dumbbell-curl
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: cable-woodchop
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Alternate angle weekly"

      - exercise_id: wrist-roller
        sets:
          - { duration: [30, 60], count: 2 }
        notes: "One up, one down"

  C:
    label: "Unilateral + Accessories"
    entries:
      - exercise_id: single-leg-romanian-deadlift
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: reverse-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }

      - superset:
          - exercise_id: incline-dumbbell-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "30-45 degree incline"
          - exercise_id: seated-cable-row
            sets:
              - { reps: [8, 12], count: 3 }

      - exercise_id: dumbbell-pullover
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: medicine-ball-rotational-slam
        sets:
          - { reps: 8, count: 3 }
        notes: "Each side"

cardio:
  notes: "After lifting, or as a separate session"
  options:
    - { name: "Walk", detail: "20-30 min brisk pace" }
    - { name: "Rowing 2K Sprints", detail: "3 x 2K with 3-4 min rest" }
    - { name: "Mix", detail: "1-2 rowing sprints + 10-15 min walk" }

notes:
  - "Rotation is continuous: A-B-C regardless of training days per week."
  - "Rest after both exercises in a superset round."
  - "Progression is per set block, not a single number for the whole exercise."
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/data/routines/full-body-3day.yaml
git commit -m "$(cat <<'EOF'
feat: add Full Body 3-Day Rotation YAML routine template
EOF
)"
```

---

### Task 8: Integration test — validate the real YAML against the real catalog

**Files:**
- Modify: `web/tests/unit/services/routine-service.test.ts` (append integration describe block)

This test reads both the real CSV catalog and the real YAML routine file, parses them, and validates the routine against the catalog. This proves the full pipeline works end-to-end.

- [ ] **Step 1: Add the integration test block to the end of `routine-service.test.ts`**

Append to `web/tests/unit/services/routine-service.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Integration: real catalog + real routine YAML
// ---------------------------------------------------------------------------

describe("validateAndNormalizeRoutine — integration with real files", () => {
  it("validates the Full Body 3-Day Rotation YAML against the real catalog", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // Read the real catalog CSV
    const csvPath = path.resolve(
      __dirname,
      "../../../../docs/exercises/gym_exercises_catalog.csv"
    );
    const csv = fs.readFileSync(csvPath, "utf-8");

    // Parse it into Exercise[]
    const { parseExerciseCatalog } = await import(
      "@/services/catalog-service"
    );
    const exercises = parseExerciseCatalog(csv);

    // Build the lookup map
    const lookup = new Map(exercises.map((e) => [e.id, e]));

    // Read the real YAML routine
    const yamlPath = path.resolve(
      __dirname,
      "../../../data/routines/full-body-3day.yaml"
    );
    const yamlStr = fs.readFileSync(yamlPath, "utf-8");

    // Validate and normalize
    const result = validateAndNormalizeRoutine(yamlStr, lookup);

    // It must succeed
    if (!result.ok) {
      throw new Error(
        `Expected validation to succeed but got errors:\n${result.errors
          .map((e) => `  ${e.path}: ${e.message}`)
          .join("\n")}`
      );
    }

    const routine = result.routine;

    // Verify basic structure
    expect(routine.name).toBe("Full Body 3-Day Rotation");
    expect(routine.schemaVersion).toBe(1);
    expect(routine.restDefaultSec).toBe(90);
    expect(routine.restSupersetSec).toBe(60);
    expect(routine.dayOrder).toEqual(["A", "B", "C"]);
    expect(routine.nextDayId).toBe("A");

    // Verify day A
    const dayA = routine.days["A"]!;
    expect(dayA.label).toBe("Heavy Squat + Horizontal Push/Pull");
    expect(dayA.entries).toHaveLength(6);

    // First entry: barbell-back-squat with 2 set blocks
    const squat = dayA.entries[0]!;
    expect(squat.kind).toBe("exercise");
    if (squat.kind === "exercise") {
      expect(squat.exerciseId).toBe("barbell-back-squat");
      expect(squat.setBlocks).toHaveLength(2);
      expect(squat.setBlocks[0]!.tag).toBe("top");
      expect(squat.setBlocks[0]!.count).toBe(1);
      expect(squat.setBlocks[1]!.count).toBe(3);
      expect(squat.notes).toBe("Warm up with 2 lighter sets");
    }

    // Fourth entry: superset (dumbbell-bench-press + dumbbell-row)
    const superset = dayA.entries[3]!;
    expect(superset.kind).toBe("superset");
    if (superset.kind === "superset") {
      expect(superset.items[0]!.exerciseId).toBe("dumbbell-bench-press");
      expect(superset.items[1]!.exerciseId).toBe("dumbbell-row");
      expect(superset.items[1]!.notes).toBe("Each arm");
    }

    // Verify day B
    const dayB = routine.days["B"]!;
    expect(dayB.label).toBe("Moderate Hinge + Vertical Push/Pull");
    expect(dayB.entries).toHaveLength(7);

    // Wrist roller uses duration target
    const wristRoller = dayB.entries[6]!;
    if (wristRoller.kind === "exercise") {
      expect(wristRoller.exerciseId).toBe("wrist-roller");
      expect(wristRoller.setBlocks[0]!.targetKind).toBe("duration");
      expect(wristRoller.setBlocks[0]!.minValue).toBe(30);
      expect(wristRoller.setBlocks[0]!.maxValue).toBe(60);
    }

    // Verify day C
    const dayC = routine.days["C"]!;
    expect(dayC.label).toBe("Unilateral + Accessories");
    expect(dayC.entries).toHaveLength(6);

    // Medicine ball rotational slam uses exact reps
    const medBall = dayC.entries[5]!;
    if (medBall.kind === "exercise") {
      expect(medBall.exerciseId).toBe("medicine-ball-rotational-slam");
      expect(medBall.setBlocks[0]!.targetKind).toBe("reps");
      expect(medBall.setBlocks[0]!.exactValue).toBe(8);
      expect(medBall.setBlocks[0]!.count).toBe(3);
    }

    // Verify notes and cardio
    expect(routine.notes).toHaveLength(3);
    expect(routine.notes[0]).toContain("Rotation is continuous");
    expect(routine.cardio).not.toBeNull();
    expect(routine.cardio!.options).toHaveLength(3);
    expect(routine.cardio!.options[0]!.name).toBe("Walk");
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/routine-service.test.ts
```

Expected: All tests pass, including the new integration test.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/routine-service.test.ts
git commit -m "$(cat <<'EOF'
test: add integration test validating real YAML against real catalog
EOF
)"
```

---

### Task 9: Run the full test suite and verify

**Files:**
- No new files

- [ ] **Step 1: Run all tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run
```

Expected: All tests pass, including:
- Phase 2 tests (domain helpers, database)
- Phase 3 tests:
  - `tests/unit/lib/csv-parser.test.ts` — 8 tests
  - `tests/unit/services/catalog-service.test.ts` — 14 tests
  - `tests/unit/services/routine-service.test.ts` — ~45 tests (validation + normalization + edge cases + import + integration)

Total new Phase 3 tests: approximately 67.

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Verify the build still works**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds with no errors.

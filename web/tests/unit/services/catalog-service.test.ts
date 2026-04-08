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
Run-Walk,Cardio,Cardio,Cardio`;

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
      id: "run-walk",
      name: "Run-Walk",
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

  it("throws on unknown Equipment (P3-A)", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Squat,Bodyweight,Trampoline,Legs`;

    expect(() => parseExerciseCatalog(csv)).toThrow('unknown Equipment "Trampoline"');
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
      "../../../src/data/catalog.csv"
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

    // P3-D: Verify Run-Walk produces slug "run-walk"
    const runWalk = exercises.find((e) => e.id === "run-walk")!;
    expect(runWalk).toBeDefined();
    expect(runWalk.name).toBe("Run-Walk");
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

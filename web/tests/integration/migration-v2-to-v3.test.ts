import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import Dexie from "dexie";
import { ExerciseLoggerDB, DEFAULT_SETTINGS, initializeSettings } from "@/db/database";

const DB_NAME = "ExerciseLoggerDB";

describe("migration v2 → v3", () => {
  afterEach(async () => {
    // Ensure any prior handle is deleted so each test starts clean.
    await Dexie.delete(DB_NAME);
  });

  it("fresh v3 install has all 6 onboarding fields defaulting to null", async () => {
    const db = new ExerciseLoggerDB();
    await initializeSettings(db);
    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings?.onboardingSkippedAt).toBeNull();
    expect(settings?.onboardingCompletedAt).toBeNull();
    expect(settings?.userName).toBeNull();
    expect(settings?.onboardingBannerDismissedAt).toBeNull();
    await db.close();
  });

  it("upgrades a v2 database and marks the existing user as skipped (D3)", async () => {
    // Arrange: build a v2-schema database by hand, matching database.ts:36–52.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    v2.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    await v2.open();
    await v2.table("settings").put({
      id: "user",
      activeRoutineId: "r-existing",
      units: "lbs",
    });
    await v2.close();

    // Act: re-open through the current app class, which advances to v3.
    const before = Date.now();
    const db = new ExerciseLoggerDB();
    await db.open();
    const after = Date.now();
    const settings = await db.settings.get("user");
    await db.close();

    // Assert: D3 — existing user is silently marked skipped.
    expect(settings?.onboardingSkippedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    const skippedMs = Date.parse(settings!.onboardingSkippedAt!);
    expect(skippedMs).toBeGreaterThanOrEqual(before);
    expect(skippedMs).toBeLessThanOrEqual(after);

    // Preserved from v2.
    expect(settings?.activeRoutineId).toBe("r-existing");
    expect(settings?.units).toBe("lbs");

    // Other 5 new fields are null.
    expect(settings?.userName).toBeNull();
    expect(settings?.onboardingCompletedAt).toBeNull();
    expect(settings?.lastGeneratedPrompt).toBeNull();
    expect(settings?.lastGeneratedPromptAt).toBeNull();
    expect(settings?.onboardingBannerDismissedAt).toBeNull();
  });

  it("upgrade leaves other tables untouched", async () => {
    // Arrange: seed a v2 DB with an exercise + settings.
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    v2.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
    await v2.open();
    await v2.table("exercises").put({
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    });
    await v2.table("settings").put({ id: "user", activeRoutineId: null, units: "kg" });
    await v2.close();

    // Act: re-open as v3.
    const db = new ExerciseLoggerDB();
    await db.open();
    const ex = await db.exercises.get("barbell-back-squat");
    await db.close();

    // Assert: exercise row is intact.
    expect(ex?.name).toBe("Barbell Back Squat");
  });
});

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  markOnboardingCompleted,
  markOnboardingSkipped,
  dismissOnboardingBanner,
} from "@/services/onboarding-service";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("onboarding-service", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("markOnboardingCompleted", () => {
    it("sets onboardingCompletedAt to an ISO timestamp", async () => {
      await markOnboardingCompleted(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingCompletedAt).toMatch(ISO_RE);
      expect(s?.onboardingSkippedAt).toBeNull();
    });
  });

  describe("markOnboardingSkipped", () => {
    it("sets onboardingSkippedAt to an ISO timestamp", async () => {
      await markOnboardingSkipped(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingSkippedAt).toMatch(ISO_RE);
      expect(s?.onboardingCompletedAt).toBeNull();
    });
  });

  describe("dismissOnboardingBanner", () => {
    it("sets onboardingBannerDismissedAt to an ISO timestamp", async () => {
      await dismissOnboardingBanner(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toMatch(ISO_RE);
    });
  });

});

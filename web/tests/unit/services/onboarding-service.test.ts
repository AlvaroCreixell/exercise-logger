import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  markOnboardingCompleted,
  markOnboardingSkipped,
  saveGeneratedPrompt,
  clearLastPrompt,
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

  describe("saveGeneratedPrompt", () => {
    it("persists prompt + timestamp and resets the banner dismissal", async () => {
      await db.settings.update("user", {
        onboardingBannerDismissedAt: "2026-01-01T00:00:00.000Z",
      });

      await saveGeneratedPrompt(db, "HELLO PROMPT");

      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe("HELLO PROMPT");
      expect(s?.lastGeneratedPromptAt).toMatch(ISO_RE);
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
  });

  describe("clearLastPrompt", () => {
    it("nulls both prompt and promptAt, leaves banner dismissal untouched", async () => {
      await db.settings.update("user", {
        lastGeneratedPrompt: "OLD",
        lastGeneratedPromptAt: "2026-01-01T00:00:00.000Z",
        onboardingBannerDismissedAt: "2026-01-02T00:00:00.000Z",
      });

      await clearLastPrompt(db);

      const s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBeNull();
      expect(s?.lastGeneratedPromptAt).toBeNull();
      expect(s?.onboardingBannerDismissedAt).toBe("2026-01-02T00:00:00.000Z");
    });
  });

  describe("dismissOnboardingBanner", () => {
    it("sets onboardingBannerDismissedAt to an ISO timestamp", async () => {
      await dismissOnboardingBanner(db);
      const s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toMatch(ISO_RE);
    });
  });

  describe("integration: saveGeneratedPrompt resets a prior dismiss, clear does not", () => {
    it("saveGeneratedPrompt → dismiss → saveGeneratedPrompt re-nulls the dismissal", async () => {
      await saveGeneratedPrompt(db, "P1");
      await dismissOnboardingBanner(db);
      let s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toMatch(ISO_RE);

      await saveGeneratedPrompt(db, "P2");
      s = await db.settings.get("user");
      expect(s?.lastGeneratedPrompt).toBe("P2");
      expect(s?.onboardingBannerDismissedAt).toBeNull();
    });
  });

  describe("integration: clearLastPrompt does not reset a prior dismissal", () => {
    it("preserves onboardingBannerDismissedAt on clearLastPrompt", async () => {
      await saveGeneratedPrompt(db, "P1");
      await dismissOnboardingBanner(db);
      const before = (await db.settings.get("user"))?.onboardingBannerDismissedAt;

      await clearLastPrompt(db);

      const s = await db.settings.get("user");
      expect(s?.onboardingBannerDismissedAt).toBe(before);
      expect(s?.lastGeneratedPrompt).toBeNull();
    });
  });
});

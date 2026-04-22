import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEY,
  saveWizardState,
  loadWizardState,
  clearWizardState,
} from "@/features/onboarding/lib/session-storage";
import type { WizardState } from "@/features/onboarding/lib/questionnaire-state";

const sampleState: WizardState = {
  stepIndex: 4,
  answers: {
    goal: { kind: "chip-with-other", value: "Build muscle" },
    daysPerWeek: { kind: "chip", value: "3" },
  },
};

describe("session-storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips a saved WizardState", () => {
    saveWizardState(sampleState);
    const loaded = loadWizardState();
    expect(loaded).toEqual(sampleState);
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("loadWizardState returns null when the key is absent", () => {
    expect(loadWizardState()).toBeNull();
  });

  it("clearWizardState removes the stored value", () => {
    saveWizardState(sampleState);
    expect(loadWizardState()).not.toBeNull();
    clearWizardState();
    expect(loadWizardState()).toBeNull();
  });

  it("saveWizardState silently no-ops when sessionStorage.setItem throws", () => {
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError (mocked)");
      });
    expect(() => saveWizardState(sampleState)).not.toThrow();
    expect(setSpy).toHaveBeenCalled();
  });

  it("loadWizardState returns null on malformed JSON", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadWizardState()).toBeNull();
  });

  it("loadWizardState returns null when the payload shape is wrong", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(loadWizardState()).toBeNull();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(loadWizardState()).toBeNull();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(42));
    expect(loadWizardState()).toBeNull();
  });
});

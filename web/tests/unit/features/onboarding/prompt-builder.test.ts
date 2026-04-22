import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import type { Answers } from "@/features/onboarding/lib/types";

const LEAD_IN =
  "I'd like a personalized workout routine. All 11 intake topics are answered\n" +
  "below — treat this as the complete intake. Do NOT ask follow-up questions.\n" +
  "Proceed directly to the catalog-ID check and YAML generation per your\n" +
  "self-check protocol.";

const TRAILING =
  "Please generate the complete routine YAML following the contract exactly.";

const FULL_ANSWERS: Answers = {
  goal: { kind: "chip-with-other", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  restrictions: {
    kind: "text",
    value:
      "No back squats — tweaked lower back. Shoulders sensitive overhead.",
  },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "3" },
  equipment: {
    kind: "chip-multi",
    values: ["Barbell", "Dumbbells", "Cables", "Pull-up bar"],
  },
  priorities: { kind: "chip-multi", values: ["Back", "Glutes"] },
  favoritesAvoid: {
    kind: "favorites-avoid",
    favorites: "deadlift, pull-ups",
    avoid: "back squat",
  },
  supersets: { kind: "chip", value: "Yes" },
  cardio: { kind: "chip", value: "Yes" },
};

describe("buildPrompt", () => {
  it("renders the full-answers spec example byte-for-byte", () => {
    const expected = [
      LEAD_IN,
      "",
      "- Primary goal: Build muscle",
      "- Experience level: Intermediate — training regularly for 6+ months, know the main lifts",
      "- Injuries / restrictions: No back squats — tweaked lower back. Shoulders sensitive overhead.",
      "- Days per week available: 3",
      "- Typical session length: 60 minutes",
      "- Distinct training days desired: 3",
      "- Available equipment: Barbell, Dumbbells, Cables, Pull-up bar",
      "- Muscle groups to prioritize: Back, Glutes",
      "- Favorite exercises (include): deadlift, pull-ups",
      "- Exercises to avoid: back squat",
      "- Supersets: Yes — use them where they fit",
      "- Cardio section: Yes — include optional cardio",
      "",
      TRAILING,
    ].join("\n");
    expect(buildPrompt(FULL_ANSWERS)).toBe(expected);
  });

  it("renders minimum required answers (all 3 optional steps skipped)", () => {
    const a: Answers = {
      goal: { kind: "chip-with-other", value: "Build strength" },
      experience: { kind: "chip", value: "Beginner" },
      daysPerWeek: { kind: "chip", value: "2" },
      sessionLength: { kind: "chip", value: "30" },
      distinctDays: { kind: "chip", value: "1" },
      equipment: { kind: "chip-multi", values: ["Bodyweight only"] },
      supersets: { kind: "chip", value: "No" },
      cardio: { kind: "chip", value: "No" },
    };
    const out = buildPrompt(a);
    expect(out).toContain("- Primary goal: Build strength");
    expect(out).toContain(
      "- Experience level: Beginner — just getting started, learning the main lifts"
    );
    expect(out).not.toContain("Injuries / restrictions");
    expect(out).not.toContain("Muscle groups to prioritize");
    expect(out).not.toContain("Favorite exercises");
    expect(out).not.toContain("Exercises to avoid");
    expect(out).toContain("- Available equipment: Bodyweight only");
    expect(out).toContain("- Supersets: No supersets");
    expect(out).toContain("- Cardio section: No — skip cardio");
  });

  it("uses Other text verbatim when goal is 'Other'", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      goal: {
        kind: "chip-with-other",
        value: "Other",
        otherText: "train for a military selection course",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Primary goal: train for a military selection course"
    );
  });

  it("renders 'Bodyweight only' as a single-item bullet", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      equipment: { kind: "chip-multi", values: ["Bodyweight only"] },
    };
    expect(buildPrompt(a)).toContain("- Available equipment: Bodyweight only");
  });

  it("renders favorites without avoid (omits the avoid bullet)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "deadlifts",
        avoid: "",
      },
    };
    const out = buildPrompt(a);
    expect(out).toContain("- Favorite exercises (include): deadlifts");
    expect(out).not.toContain("- Exercises to avoid:");
  });

  it("renders avoid without favorites (omits the favorites bullet)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "",
        avoid: "overhead press",
      },
    };
    const out = buildPrompt(a);
    expect(out).not.toContain("- Favorite exercises (include):");
    expect(out).toContain("- Exercises to avoid: overhead press");
  });

  it("omits both bullets when favorites-avoid is empty after normalization", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      favoritesAvoid: {
        kind: "favorites-avoid",
        favorites: "   \n  ",
        avoid: "\t  ",
      },
    };
    const out = buildPrompt(a);
    expect(out).not.toContain("- Favorite exercises (include):");
    expect(out).not.toContain("- Exercises to avoid:");
  });

  it("normalizes free-text: trims and collapses whitespace/newlines (rule 9)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      restrictions: {
        kind: "text",
        value: "  tight hips.\n\n  bad   knee.   ",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Injuries / restrictions: tight hips. bad knee."
    );
  });

  it("treats empty-after-normalize restrictions as skipped (rule 9 + rule 1)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      restrictions: { kind: "text", value: "   \n\t  " },
    };
    expect(buildPrompt(a)).not.toContain("Injuries / restrictions");
  });

  it("normalizes goal 'Other' text the same way", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      goal: {
        kind: "chip-with-other",
        value: "Other",
        otherText: "   train\n\n   for   a   triathlon  ",
      },
    };
    expect(buildPrompt(a)).toContain(
      "- Primary goal: train for a triathlon"
    );
  });

  it("maps experience chip labels to their calibration descriptions (rule 2)", () => {
    for (const [label, description] of [
      ["Beginner", "just getting started, learning the main lifts"],
      ["Intermediate", "training regularly for 6+ months, know the main lifts"],
      ["Advanced", "years of consistent training, pushing near your limits"],
    ] as const) {
      const a: Answers = {
        ...FULL_ANSWERS,
        experience: { kind: "chip", value: label },
      };
      expect(buildPrompt(a)).toContain(
        `- Experience level: ${label} — ${description}`
      );
    }
  });

  it("maps supersets chip labels to their calibration descriptions (rule 2)", () => {
    const expectations: [string, string][] = [
      ["Yes", "- Supersets: Yes — use them where they fit"],
      ["Only if time-crunched", "- Supersets: Only if time-crunched"],
      ["No", "- Supersets: No supersets"],
    ];
    for (const [label, line] of expectations) {
      const a: Answers = {
        ...FULL_ANSWERS,
        supersets: { kind: "chip", value: label },
      };
      expect(buildPrompt(a)).toContain(line);
    }
  });

  it("step 6 renders the number only — no parenthetical example (D10)", () => {
    const a: Answers = {
      ...FULL_ANSWERS,
      distinctDays: { kind: "chip", value: "3" },
    };
    const out = buildPrompt(a);
    expect(out).toContain("- Distinct training days desired: 3");
    expect(out).not.toContain("Distinct training days desired: 3 (Push/Pull/Legs)");
    expect(out).not.toContain("Push/Pull/Legs");
    expect(out).not.toContain("Upper/Lower");
    expect(out).not.toContain("full-body");
    expect(out).not.toMatch(/Distinct training days desired: \d \(/);
  });

  it("throws on an empty answers map with the exact spec message", () => {
    expect(() => buildPrompt({})).toThrowError(
      "Cannot build prompt from empty answers — complete the questionnaire first."
    );
  });
});

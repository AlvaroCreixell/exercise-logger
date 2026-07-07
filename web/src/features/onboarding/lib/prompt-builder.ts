// Co-ships with `@/services/llm/system-prompt.ts` — the user prompt built
// here and the system prompt must stay consistent when intake topics change.
//
// Pure function: no clock, no RNG, no I/O.

import type { Answer, Answers } from "./types";

const LEAD_IN =
  "Design a personalized workout routine for this user. All intake topics\n" +
  "are answered below — treat this as the complete intake.";

const TRAILING =
  "Generate the complete routine now, following your system instructions exactly.";

const EMPTY_ERROR =
  "Cannot build prompt from empty answers — complete the questionnaire first.";

const EXPERIENCE_DESCRIPTIONS: Record<string, string> = {
  Beginner: "just getting started, learning the main lifts",
  Intermediate: "training regularly for 6+ months, know the main lifts",
  Advanced: "years of consistent training, pushing near your limits",
};

const SUPERSETS_RENDERINGS: Record<string, string> = {
  Yes: "Yes — use them where they fit",
  "Only if time-crunched": "Only if time-crunched",
  No: "No supersets",
};

const CARDIO_RENDERINGS: Record<string, string> = {
  Yes: "Yes — include optional cardio",
  No: "No — skip cardio",
};

/** Rule 9: trim outer, collapse runs of whitespace/newlines to single space. */
function normalizeFreeText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function renderGoal(a: Answer | undefined): string | null {
  if (!a) return null;
  if (a.kind === "chip-with-other") {
    if (a.value === "Other") {
      const other = normalizeFreeText(a.otherText ?? "");
      return other === "" ? null : other;
    }
    return a.value;
  }
  if (a.kind === "chip") return a.value;
  return null;
}

function renderExperience(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  const description = EXPERIENCE_DESCRIPTIONS[a.value];
  return description ? `${a.value} — ${description}` : a.value;
}

function renderText(a: Answer | undefined): string | null {
  if (!a || a.kind !== "text") return null;
  const normalized = normalizeFreeText(a.value);
  return normalized === "" ? null : normalized;
}

function renderChip(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return a.value;
}

function renderSessionLength(a: Answer | undefined): string | null {
  const v = renderChip(a);
  if (v === null) return null;
  return /^\d+$/.test(v) ? `${v} minutes` : v;
}

function renderMulti(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip-multi") return null;
  if (a.values.length === 0) return null;
  return a.values.join(", ");
}

function renderSupersets(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return SUPERSETS_RENDERINGS[a.value] ?? a.value;
}

function renderCardio(a: Answer | undefined): string | null {
  if (!a || a.kind !== "chip") return null;
  return CARDIO_RENDERINGS[a.value] ?? a.value;
}

export function buildPrompt(answers: Answers): string {
  if (Object.keys(answers).length === 0) {
    throw new Error(EMPTY_ERROR);
  }

  const bullets: string[] = [];

  const goal = renderGoal(answers.goal);
  if (goal !== null) bullets.push(`- Primary goal: ${goal}`);

  const experience = renderExperience(answers.experience);
  if (experience !== null) bullets.push(`- Experience level: ${experience}`);

  const restrictions = renderText(answers.restrictions);
  if (restrictions !== null) {
    bullets.push(`- Injuries / restrictions: ${restrictions}`);
  }

  const daysPerWeek = renderChip(answers.daysPerWeek);
  if (daysPerWeek !== null) {
    bullets.push(`- Days per week available: ${daysPerWeek}`);
  }

  const sessionLength = renderSessionLength(answers.sessionLength);
  if (sessionLength !== null) {
    bullets.push(`- Typical session length: ${sessionLength}`);
  }

  // Rule 3 / Decision D10 — number only, no parenthetical.
  const distinctDays = renderChip(answers.distinctDays);
  if (distinctDays !== null) {
    bullets.push(`- Distinct training days desired: ${distinctDays}`);
  }

  const equipment = renderMulti(answers.equipment);
  if (equipment !== null) {
    bullets.push(`- Available equipment: ${equipment}`);
  }

  const priorities = renderMulti(answers.priorities);
  if (priorities !== null) {
    bullets.push(`- Muscle groups to prioritize: ${priorities}`);
  }

  const fav = answers.favoritesAvoid;
  if (fav && fav.kind === "favorites-avoid") {
    const favorites = normalizeFreeText(fav.favorites);
    const avoid = normalizeFreeText(fav.avoid);
    if (favorites !== "") {
      bullets.push(`- Favorite exercises (include): ${favorites}`);
    }
    if (avoid !== "") {
      bullets.push(`- Exercises to avoid: ${avoid}`);
    }
  }

  const supersets = renderSupersets(answers.supersets);
  if (supersets !== null) bullets.push(`- Supersets: ${supersets}`);

  const cardio = renderCardio(answers.cardio);
  if (cardio !== null) bullets.push(`- Cardio section: ${cardio}`);

  return `${LEAD_IN}\n\n${bullets.join("\n")}\n\n${TRAILING}`;
}

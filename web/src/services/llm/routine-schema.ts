// Generation-side schema for structured outputs. Mirrors the routine YAML
// contract (docs/custom-gpt/routine-yaml-contract.md) with two deliberate
// differences:
//   1. `days` is an ARRAY of {id, label, entries} — strict JSON schemas
//      forbid dynamic object keys. toRawRoutine() derives day_order from
//      array order and re-keys days, which makes day_order/days mismatches
//      structurally impossible.
//   2. `version` is not asked of the model; toRawRoutine() injects 1.
// Constraints the schema cannot express (min < max, positive values,
// count >= 1, catalog IDs, superset arity/balance, duplicate-exercise
// labels) are enforced by validateRoutineObject; its errors drive the
// generation-service repair loop. toRawRoutine() is therefore TOTAL: it
// never throws on schema-valid input — degenerate values convert to
// contract shapes the validator will reject with a useful message.

import { z } from "zod";

const setBlockSchema = z.object({
  target_kind: z
    .enum(["reps", "duration", "distance"])
    .describe("reps for lifting, duration (seconds) for timed/isometric work, distance (meters) for cardio"),
  min_value: z.number().nullable().describe("Range minimum (must be < max_value). null when exact_value is used."),
  max_value: z.number().nullable().describe("Range maximum. null when exact_value is used."),
  exact_value: z.number().nullable().describe("Exact target. null when a min/max range is used."),
  count: z.number().describe("Number of sets — an integer >= 1"),
  tag: z.enum(["top", "amrap"]).nullable().describe("null for normal working sets"),
});

const exerciseItemSchema = z.object({
  exercise_id: z.string().describe("A catalog ID copied VERBATIM from the exercise catalog — lowercase kebab-case"),
  instance_label: z
    .string()
    .nullable()
    .describe('Only to disambiguate the same exercise_id used twice in one day (e.g. "heavy"/"light"). Otherwise null.'),
  notes: z.string().nullable().describe("Short execution cue, only when it materially affects execution. Otherwise null."),
  sets: z.array(setBlockSchema).describe("At least one set block"),
});

const entrySchema = z.union([
  z.object({
    kind: z.literal("exercise"),
    exercise: exerciseItemSchema,
  }),
  z.object({
    kind: z.literal("superset"),
    items: z.array(exerciseItemSchema).describe("Exactly 2 items, with equal total working set counts"),
  }),
]);

export const generatedRoutineSchema = z.object({
  name: z.string().describe("Short routine name, e.g. '3-Day Upper/Lower Split'"),
  rest_default_sec: z.number().describe("Rest between normal sets, in seconds (e.g. 90)"),
  rest_superset_sec: z.number().describe("Rest between superset rounds, in seconds (e.g. 60)"),
  days: z
    .array(
      z.object({
        id: z.string().describe("Single uppercase letter day ID: A, B, C, ... — unique per day"),
        label: z.string().describe("Display label, e.g. 'Heavy Squat + Horizontal Push/Pull'"),
        entries: z.array(entrySchema).describe("Ordered entries for this day — non-empty"),
      })
    )
    .describe("Training days. Rotation order = array order."),
  notes: z.array(z.string()).describe("Routine-level notes. Empty array when none are needed."),
  cardio: z
    .object({
      notes: z.string(),
      options: z.array(z.object({ name: z.string(), detail: z.string() })),
    })
    .nullable()
    .describe("Optional cardio guidance. null unless the user asked for cardio."),
});

export type GeneratedRoutine = z.infer<typeof generatedRoutineSchema>;

type GeneratedSetBlock = z.infer<typeof setBlockSchema>;
type GeneratedExerciseItem = z.infer<typeof exerciseItemSchema>;

function toRawSetBlock(b: GeneratedSetBlock): Record<string, unknown> {
  const value =
    b.exact_value !== null ? b.exact_value : [b.min_value ?? 0, b.max_value ?? 0];
  return {
    [b.target_kind]: value,
    count: b.count,
    ...(b.tag !== null && { tag: b.tag }),
  };
}

function toRawItem(item: GeneratedExerciseItem): Record<string, unknown> {
  return {
    exercise_id: item.exercise_id,
    ...(item.instance_label !== null &&
      item.instance_label !== "" && { instance_label: item.instance_label }),
    ...(item.notes !== null && item.notes !== "" && { notes: item.notes }),
    sets: item.sets.map(toRawSetBlock),
  };
}

/**
 * Convert a schema-valid GeneratedRoutine into the YAML-contract object shape
 * consumed by validateRoutineObject. Total — never throws on schema-valid input.
 */
export function toRawRoutine(g: GeneratedRoutine): Record<string, unknown> {
  return {
    version: 1,
    name: g.name,
    rest_default_sec: g.rest_default_sec,
    rest_superset_sec: g.rest_superset_sec,
    day_order: g.days.map((d) => d.id),
    days: Object.fromEntries(
      g.days.map((d) => [
        d.id,
        {
          label: d.label,
          entries: d.entries.map((e) =>
            e.kind === "exercise"
              ? toRawItem(e.exercise)
              : { superset: e.items.map(toRawItem) }
          ),
        },
      ])
    ),
    ...(g.notes.length > 0 && { notes: g.notes }),
    ...(g.cardio !== null && { cardio: g.cardio }),
  };
}

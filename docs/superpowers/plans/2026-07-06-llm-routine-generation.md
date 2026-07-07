# Embedded LLM Routine Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the questionnaire → copy-prompt → external-GPT → paste-YAML flow with in-app routine generation: questionnaire answers go to Anthropic Claude Haiku via structured outputs, the result is validated with the existing pipeline (with an automatic repair loop), previewed, and activated.

**Architecture:** A provider-agnostic `LlmProvider` interface with an Anthropic implementation using the official TS SDK (`dangerouslyAllowBrowser`, structured outputs via a Zod schema). A pure `generation-service` orchestrates prompt → provider → JSON-to-contract conversion → existing domain validation → up to 2 repair round-trips. A new `GenerationScreen` replaces `HandoffScreen`. The user's API key lives on the Dexie settings record, entered in Settings.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Dexie 4, `@anthropic-ai/sdk` (new dep), `zod` (new dep), Vitest + RTL + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-llm-routine-generation-design.md`

## Global Constraints

- All work happens under `web/`. Run all commands from the `web/` directory.
- Path alias: `@/` maps to `web/src/`.
- All timestamps are ISO 8601 UTC strings via `nowISO()` — never `Date` objects.
- Null sentinel convention: settings string fields that are "not configured" use `""` (here: `llmApiKey`), matching the codebase's Dexie compound-index guidance. Nullable-by-design fields (timestamps) use `null`.
- Services are pure functions taking `db: ExerciseLoggerDB` as the first argument; no React imports in `services/`.
- Unit tests live in `web/tests/unit/`, mirroring `src/` paths. E2E specs in `web/tests/e2e/`.
- Model ID is exactly `claude-haiku-4-5` (user's explicit choice). Do not use another model or append date suffixes.
- Test commands: `npx vitest run <path>` for a single file, `npm test` for the full suite, `npm run typecheck` for tsc, `npm run test:e2e` for Playwright.
- Commit message style: conventional prefixes (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`), imperative mood, as in recent history.
- PowerShell note: chain commands with `;` not `&&` (Windows dev machine).

---

### Task 1: Dependencies + `llmApiKey` settings field

**Files:**
- Modify: `web/package.json` (via npm install)
- Modify: `web/src/domain/types.ts` (Settings interface)
- Modify: `web/src/db/database.ts` (Dexie v5, DEFAULT_SETTINGS)
- Modify: `web/src/services/settings-service.ts` (new setter)
- Modify: `web/src/services/backup-service.ts` (validate + normalize + export-strip)
- Test: `web/tests/unit/services/settings-service.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Settings.llmApiKey: string` (`""` = not configured); `setLlmApiKey(db: ExerciseLoggerDB, key: string): Promise<void>` exported from `@/services/settings-service`.

- [ ] **Step 1: Install dependencies**

Run (from `web/`):
```bash
npm install @anthropic-ai/sdk zod
```
Expected: both added to `dependencies` in `web/package.json`. If npm warns that `@anthropic-ai/sdk` wants a specific `zod` peer range, re-install `zod` at the version the peer range requests (e.g. `npm install zod@^3.25`) — the SDK's `helpers/zod` must be compatible with the installed zod.

- [ ] **Step 2: Write the failing test for the setter**

Append to `web/tests/unit/services/settings-service.test.ts` (inside the existing top-level `describe`, following the file's existing `db` setup pattern — it creates an `ExerciseLoggerDB` against fake-indexeddb and calls `initializeSettings`):

```ts
describe("setLlmApiKey", () => {
  it("stores the trimmed key on the settings record", async () => {
    await setLlmApiKey(db, "  sk-ant-test-123  ");
    const settings = await getSettings(db);
    expect(settings.llmApiKey).toBe("sk-ant-test-123");
  });

  it("clears the key with an empty string", async () => {
    await setLlmApiKey(db, "sk-ant-test-123");
    await setLlmApiKey(db, "");
    const settings = await getSettings(db);
    expect(settings.llmApiKey).toBe("");
  });
});
```

Add `setLlmApiKey` to the existing import from `@/services/settings-service` at the top of the test file.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/settings-service.test.ts`
Expected: FAIL — `setLlmApiKey` is not exported.

- [ ] **Step 4: Add the field to the Settings type**

In `web/src/domain/types.ts`, add to the `Settings` interface after `restCueSound: boolean;`:

```ts
  /**
   * Anthropic API key for in-app routine generation, entered by the user in
   * Settings. Stored on-device only; stripped from backup exports. "" means
   * "not configured" (empty-string sentinel, matching instanceLabel).
   */
  llmApiKey: string;
```

- [ ] **Step 5: Add Dexie version 5 and default**

In `web/src/db/database.ts`, after the `.version(4)` block inside the constructor, add:

```ts
    // Version 5: Anthropic API key for in-app routine generation. Unindexed
    // string, so the `.stores(...)` signature is identical to v4. "" is the
    // "not configured" sentinel (never null — see the compound-index note on
    // version 3).
    this.version(5).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(async (trans) => {
      const existing = await trans.table("settings").get("user");
      if (existing) {
        await trans.table("settings").update("user", { llmApiKey: "" });
      }
    });
```

And add to `DEFAULT_SETTINGS` after `restCueSound: false,`:

```ts
  llmApiKey: "",
```

- [ ] **Step 6: Add the setter to settings-service**

Append to `web/src/services/settings-service.ts`:

```ts
/**
 * Set the Anthropic API key used for in-app routine generation.
 * Trims outer whitespace; "" clears the key ("not configured").
 */
export async function setLlmApiKey(
  db: ExerciseLoggerDB,
  key: string
): Promise<void> {
  await db.settings.update("user", { llmApiKey: key.trim() });
}
```

- [ ] **Step 7: Backup handling — validate, normalize, strip on export**

In `web/src/services/backup-service.ts`:

1. In `validateSettings(...)`, after the gym-proofing boolean loop (the `for (const field of ["keepScreenOn", ...`), add:

```ts
  // llmApiKey (Dexie v5): string OR undefined for legacy backups. Exports
  // strip it to "", so any value here is legacy/foreign — still type-check it.
  if (s.llmApiKey !== undefined && typeof s.llmApiKey !== "string") {
    errors.push({
      field: `${path}.llmApiKey`,
      message: "must be a string",
    });
  }
```

2. In `exportBackup(...)`, replace the `settings,` line inside the returned `data` object with a stripped copy so backups are shareable without leaking the key:

```ts
      settings: { ...settings, llmApiKey: "" },
```

3. In `importBackup(...)`, the `cleanSettings: Settings = { ... }` literal must preserve the **device-local** key rather than take it from the backup (a restore should not wipe the key you entered on this phone). Above the transaction that builds `cleanSettings`, the function already reads nothing extra — add a read *before* the transaction:

```ts
  const existingSettings = await db.settings.get("user");
  const localLlmApiKey = existingSettings?.llmApiKey ?? "";
```

and inside the `cleanSettings` literal add:

```ts
        llmApiKey: localLlmApiKey,
```

- [ ] **Step 8: Run the settings test and typecheck**

Run: `npx vitest run tests/unit/services/settings-service.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: clean. If backup-service tests reference a hand-built `Settings` literal, add `llmApiKey: ""` to those fixtures (typecheck will point at each one).

- [ ] **Step 9: Run the full unit suite**

Run: `npm test`
Expected: PASS (fixture literals fixed in step 8).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(settings): llmApiKey field, Dexie v5, backup strip + SDK/zod deps"
```

---

### Task 2: Split `validateRoutineObject` out of `validateAndNormalizeRoutine`

**Files:**
- Modify: `web/src/services/routine-service.ts`
- Test: `web/tests/unit/services/routine-service.test.ts` (extend)

**Interfaces:**
- Consumes: existing `ValidationError`, `ValidateRoutineResult`, `Exercise`.
- Produces: `validateRoutineObject(raw: unknown, exerciseLookup: Map<string, Exercise>): ValidateRoutineResult` — **synchronous**, exported from `@/services/routine-service`. Behavior identical to the post-YAML-parse body of `validateAndNormalizeRoutine`.

- [ ] **Step 1: Write the failing test**

Append to `web/tests/unit/services/routine-service.test.ts` (reuse the file's existing exercise-lookup helper/fixtures):

```ts
import { validateRoutineObject } from "@/services/routine-service";

describe("validateRoutineObject", () => {
  it("validates a parsed object without YAML", () => {
    const raw = {
      version: 1,
      name: "Object Routine",
      rest_default_sec: 90,
      rest_superset_sec: 60,
      day_order: ["A"],
      days: {
        A: {
          label: "Day A",
          entries: [
            { exercise_id: "barbell-back-squat", sets: [{ reps: [5, 8], count: 3 }] },
          ],
        },
      },
    };
    const result = validateRoutineObject(raw, exerciseLookup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routine.name).toBe("Object Routine");
      expect(result.routine.dayOrder).toEqual(["A"]);
    }
  });

  it("rejects a non-object input with a top-level error", () => {
    const result = validateRoutineObject("not an object", exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.message).toContain("mapping");
    }
  });

  it("collects the same semantic errors as the YAML path", () => {
    const raw = {
      version: 1,
      name: "Bad",
      rest_default_sec: 90,
      rest_superset_sec: 60,
      day_order: ["A"],
      days: {
        A: {
          label: "Day A",
          entries: [{ exercise_id: "not-a-real-exercise", sets: [{ reps: [5, 8], count: 3 }] }],
        },
      },
    };
    const result = validateRoutineObject(raw, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes("not-a-real-exercise"))).toBe(true);
    }
  });
});
```

Note: `exerciseLookup` in these tests refers to whatever the existing test file names its `Map<string, Exercise>` fixture — if it uses a different name or builds it per-test, follow that convention. It must contain `barbell-back-squat`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/routine-service.test.ts`
Expected: FAIL — `validateRoutineObject` is not exported.

- [ ] **Step 3: Perform the split**

In `web/src/services/routine-service.ts`, restructure `validateAndNormalizeRoutine` so it only parses YAML and delegates. The entire body **from the `if (raw == null || typeof raw !== "object")` check down to the final `return { ok: true, routine }`** moves verbatim into the new function (it is already synchronous — the only `await` in the current function is the YAML import/parse):

```ts
/**
 * Validate and normalize an already-parsed routine object (the raw YAML
 * contract shape). Synchronous — used by the LLM generation path, which
 * produces JSON directly, and by validateAndNormalizeRoutine after parsing.
 */
export function validateRoutineObject(
  rawInput: unknown,
  exerciseLookup: Map<string, Exercise>
): ValidateRoutineResult {
  const errors: ValidationError[] = [];
  const raw = rawInput as RawRoutine;

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ path: "", message: "YAML must be a mapping (object), not a scalar or list" }],
    };
  }

  // ... (moved body, unchanged: version, name, rest_default_sec,
  // rest_superset_sec, day_order, days, per-day validation, notes, cardio,
  // and the final Routine construction) ...
}
```

Then reduce `validateAndNormalizeRoutine` to:

```ts
export async function validateAndNormalizeRoutine(
  yamlString: string,
  exerciseLookup: Map<string, Exercise>
): Promise<ValidateRoutineResult> {
  let raw: unknown;
  try {
    const YAML = await loadYaml();
    raw = YAML.parse(yamlString);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown parse error";
    return { ok: false, errors: [{ path: "", message: `Invalid YAML: ${message}` }] };
  }
  return validateRoutineObject(raw, exerciseLookup);
}
```

Note the one intentional addition in the moved body: the top guard also rejects arrays (`Array.isArray(raw)`) — YAML.parse of a list previously fell through to field errors; a top-level "must be a mapping" error is strictly clearer and no existing test asserts the old behavior for arrays. If any existing test does fail on this, drop the `|| Array.isArray(raw)` addition and keep the moved body byte-identical.

- [ ] **Step 4: Run the routine-service suites**

Run: `npx vitest run tests/unit/services/routine-service.test.ts tests/unit/services/routine-service-import.test.ts tests/unit/services/routine-service-bundled.test.ts tests/integration/acceptance.test.ts`
Expected: PASS — the YAML path's behavior is unchanged; the new object tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(routine-service): extract sync validateRoutineObject from YAML wrapper"
```

---

### Task 3: Generation schema + `toRawRoutine` conversion

**Files:**
- Create: `web/src/services/llm/routine-schema.ts`
- Test: `web/tests/unit/services/llm/routine-schema.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces (from `@/services/llm/routine-schema`):
  - `generatedRoutineSchema` — Zod schema (passed to `zodOutputFormat` in Task 7)
  - `type GeneratedRoutine = z.infer<typeof generatedRoutineSchema>`
  - `toRawRoutine(g: GeneratedRoutine): Record<string, unknown>` — converts to the YAML-contract object shape consumed by `validateRoutineObject` (Task 2)

Design notes locked in the spec: `days` is an **array** (`{id, label, entries}[]`) because strict JSON schemas can't express dynamic keys; `day_order` and `version: 1` are derived in conversion; `type_override`/`equipment_override` are intentionally not in the generation schema (the model picks catalog exercises whose type/equipment already fit — YAGNI). The conversion is **total**: it never throws on schema-valid input; semantic garbage (e.g. all-null target values) converts to contract shapes the validator rejects with useful errors, which feed the repair loop.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/services/llm/routine-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generatedRoutineSchema,
  toRawRoutine,
  type GeneratedRoutine,
} from "@/services/llm/routine-schema";

function minimalGenerated(): GeneratedRoutine {
  return {
    name: "Test Plan",
    rest_default_sec: 90,
    rest_superset_sec: 60,
    days: [
      {
        id: "A",
        label: "Full Body",
        entries: [
          {
            kind: "exercise",
            exercise: {
              exercise_id: "barbell-back-squat",
              instance_label: null,
              notes: null,
              sets: [
                { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null },
              ],
            },
          },
        ],
      },
    ],
    notes: [],
    cardio: null,
  };
}

describe("generatedRoutineSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(generatedRoutineSchema.safeParse(minimalGenerated()).success).toBe(true);
  });

  it("rejects an entry with an unknown kind", () => {
    const g = minimalGenerated() as unknown as { days: { entries: unknown[] }[] };
    g.days[0]!.entries[0] = { kind: "circuit" };
    expect(generatedRoutineSchema.safeParse(g).success).toBe(false);
  });
});

describe("toRawRoutine", () => {
  it("derives version and day_order and keys days by id", () => {
    const raw = toRawRoutine(minimalGenerated()) as {
      version: number;
      day_order: string[];
      days: Record<string, { label: string }>;
    };
    expect(raw.version).toBe(1);
    expect(raw.day_order).toEqual(["A"]);
    expect(raw.days["A"]!.label).toBe("Full Body");
  });

  it("converts range and exact set blocks to the contract shape", () => {
    const g = minimalGenerated();
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: null,
        notes: null,
        sets: [
          { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: "top" },
          { target_kind: "duration", min_value: null, max_value: null, exact_value: 45, count: 2, tag: null },
        ],
      },
    };
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: { sets: Record<string, unknown>[] }[] }>;
    };
    const sets = raw.days["A"]!.entries[0]!.sets;
    expect(sets[0]).toEqual({ reps: [5, 8], count: 3, tag: "top" });
    expect(sets[1]).toEqual({ duration: 45, count: 2 });
  });

  it("converts a superset entry to the contract superset array", () => {
    const g = minimalGenerated();
    const item = (id: string) => ({
      exercise_id: id,
      instance_label: null,
      notes: null,
      sets: [{ target_kind: "reps" as const, min_value: 8, max_value: 12, exact_value: null, count: 3, tag: null }],
    });
    g.days[0]!.entries.push({ kind: "superset", items: [item("barbell-row"), item("barbell-bench-press")] });
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: Record<string, unknown>[] }>;
    };
    const entry = raw.days["A"]!.entries[1]! as { superset: { exercise_id: string }[] };
    expect(entry.superset.map((i) => i.exercise_id)).toEqual(["barbell-row", "barbell-bench-press"]);
  });

  it("omits null/empty optionals and includes non-empty notes and cardio", () => {
    const g = minimalGenerated();
    g.notes = ["Rotation is continuous."];
    g.cardio = { notes: "After lifting", options: [{ name: "Walk", detail: "20-30 min" }] };
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: "heavy",
        notes: "",
        sets: [{ target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null }],
      },
    };
    const raw = toRawRoutine(g) as Record<string, unknown> & {
      days: Record<string, { entries: Record<string, unknown>[] }>;
    };
    const entry = raw.days["A"]!.entries[0]!;
    expect(entry["instance_label"]).toBe("heavy");
    expect("notes" in entry).toBe(false); // empty string omitted
    expect(raw["notes"]).toEqual(["Rotation is continuous."]);
    expect(raw["cardio"]).toEqual({ notes: "After lifting", options: [{ name: "Walk", detail: "20-30 min" }] });
  });

  it("is total on degenerate targets: all-null values become an invalid range for the validator", () => {
    const g = minimalGenerated();
    g.days[0]!.entries[0] = {
      kind: "exercise",
      exercise: {
        exercise_id: "barbell-back-squat",
        instance_label: null,
        notes: null,
        sets: [{ target_kind: "reps", min_value: null, max_value: null, exact_value: null, count: 3, tag: null }],
      },
    };
    const raw = toRawRoutine(g) as {
      days: Record<string, { entries: { sets: { reps: unknown }[] }[] }>;
    };
    // [0, 0] fails the validator's positive-finite range rule → repair loop.
    expect(raw.days["A"]!.entries[0]!.sets[0]!.reps).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/llm/routine-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema and conversion**

Create `web/src/services/llm/routine-schema.ts`:

```ts
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
```

(Duplicate day IDs in the `days` array collapse in `Object.fromEntries` but survive in `day_order`, so the existing validator's duplicate-day check fires — no special handling needed.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/llm/routine-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(llm): generation Zod schema + toRawRoutine contract conversion"
```

---

### Task 4: System prompt builder

**Files:**
- Create: `web/src/services/llm/system-prompt.ts`
- Test: `web/tests/unit/services/llm/system-prompt.test.ts`

**Interfaces:**
- Consumes: `Exercise` from `@/domain/types`.
- Produces: `buildSystemPrompt(exercises: Exercise[]): string` from `@/services/llm/system-prompt`. The catalog section is built from the live DB exercises (passed in), so the prompt can never drift from the seeded catalog.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/services/llm/system-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/services/llm/system-prompt";
import type { Exercise } from "@/domain/types";

const exercises: Exercise[] = [
  { id: "barbell-back-squat", name: "Barbell Back Squat", type: "weight", equipment: "barbell", muscleGroups: ["Legs"] },
  { id: "run-walk", name: "Run / Walk", type: "cardio", equipment: "cardio", muscleGroups: ["Full Body"] },
];

describe("buildSystemPrompt", () => {
  it("lists every catalog exercise with id, name, type, equipment, and muscle groups", () => {
    const prompt = buildSystemPrompt(exercises);
    expect(prompt).toContain("barbell-back-squat");
    expect(prompt).toContain("Barbell Back Squat");
    expect(prompt).toContain("run-walk");
    expect(prompt).toContain("(cardio, cardio)");
    expect(prompt).toContain("Legs");
  });

  it("states the rules the schema cannot enforce", () => {
    const prompt = buildSystemPrompt(exercises);
    expect(prompt).toContain("exactly 2");           // superset arity
    expect(prompt).toContain("equal total");          // superset balance
    expect(prompt).toContain("min_value");            // range rule wording
    expect(prompt).toContain("instance_label");       // duplicate-exercise rule
    expect(prompt).toContain("verbatim");             // catalog-ID rule
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/llm/system-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `web/src/services/llm/system-prompt.ts`:

```ts
// System prompt for in-app routine generation. Successor to
// docs/custom-gpt/workout-routine-gpt.instructions.md — the intake/output
// sections are gone (structured outputs replace the YAML contract; the
// questionnaire replaces the intake chat), the programming rules and
// catalog-ID discipline carry over. The catalog section is generated from
// the live exercises table so it can never drift from the seeded catalog.

import type { Exercise } from "@/domain/types";

function formatCatalogLine(ex: Exercise): string {
  return `- ${ex.id} — ${ex.name} (${ex.type}, ${ex.equipment}) [${ex.muscleGroups.join(", ")}]`;
}

export function buildSystemPrompt(exercises: Exercise[]): string {
  const catalog = exercises.map(formatCatalogLine).join("\n");

  return `You are a workout routine designer for the Exercise Logger app. You receive a user's complete intake (goal, experience, constraints, equipment, preferences) and produce one personalized workout routine as structured output.

## Exercise catalog (closed set)

Every exercise_id you output MUST be copied verbatim from this catalog. IDs are lowercase kebab-case. Never invent, translate, or qualify an ID. If the ideal exercise is not listed, pick the closest catalog entry instead.

${catalog}

## Structural rules (the output schema cannot enforce these — you must)

- Each set block uses EITHER a range (min_value AND max_value, with min_value < max_value, both > 0) OR exact_value (> 0). Set the unused fields to null.
- count must be an integer >= 1.
- Every day needs a unique single-letter id (A, B, C, ...) and at least one entry.
- A superset has exactly 2 items, and both items must have the same total number of working sets (sum of count across their set blocks).
- The same exercise_id may appear twice in one day ONLY if each occurrence has a distinct instance_label (e.g. "heavy" / "light"). Otherwise leave instance_label null.
- Match target_kind to the exercise: reps for weight/bodyweight, duration (seconds) for isometric holds, duration or distance (meters) for cardio.

## Programming rules

- Match the routine to the user's available days, session length, equipment access, goals, and experience.
- Prefer simpler exercise selection for beginners.
- Respect stated equipment limits and exercise preferences; substitute with the closest catalog option when needed.
- Keep each day realistic for the stated session length.
- Use supersets mainly when the user is time-constrained or explicitly open to them.
- Include cardio only when the user wants it; otherwise set cardio to null.
- Use routine-level notes sparingly, for important global instructions only.
- Use per-exercise notes only when a cue materially affects execution.

## Repair requests

If a follow-up message lists validation errors for your previous output, fix exactly those problems and return the complete corrected routine. Do not change parts of the routine that were not flagged.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/llm/system-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(llm): system prompt builder with live catalog section"
```

---

### Task 5: Update `buildPrompt` lead-in for the embedded flow

**Files:**
- Modify: `web/src/features/onboarding/lib/prompt-builder.ts`
- Test: `web/tests/unit/features/onboarding/prompt-builder.test.ts` (update)

**Interfaces:**
- Consumes/Produces: `buildPrompt(answers: Answers): string` — signature unchanged; only the framing text changes. The 10 bullet-formatting rules and the empty-answers throw are untouched.

- [ ] **Step 1: Update the failing expectations first**

In `web/tests/unit/features/onboarding/prompt-builder.test.ts`, find every assertion that checks the lead-in/trailing text (searches for "intake topics", "self-check protocol", "contract", "Do NOT ask"). Replace those expected strings with the new framing below. Bullet-content assertions stay untouched.

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `npx vitest run tests/unit/features/onboarding/prompt-builder.test.ts`
Expected: FAIL on the lead-in/trailing assertions only.

- [ ] **Step 3: Update the constants**

In `web/src/features/onboarding/lib/prompt-builder.ts`, replace `LEAD_IN` and `TRAILING`:

```ts
const LEAD_IN =
  "Design a personalized workout routine for this user. All intake topics\n" +
  "are answered below — treat this as the complete intake.";

const TRAILING =
  "Generate the complete routine now, following your system instructions exactly.";
```

Also update the file's header comment: the co-ship contract with `docs/custom-gpt/workout-routine-gpt.instructions.md` is replaced — the prompt now co-ships with `web/src/services/llm/system-prompt.ts`:

```ts
// Co-ships with `@/services/llm/system-prompt.ts` — the user prompt built
// here and the system prompt must stay consistent when intake topics change.
//
// Pure function: no clock, no RNG, no I/O.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/features/onboarding/prompt-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(onboarding): retarget buildPrompt lead-in at the embedded generator"
```

---

### Task 6: `LlmProvider` types + generation-service with repair loop

**Files:**
- Create: `web/src/services/llm/types.ts`
- Create: `web/src/services/generation-service.ts`
- Test: `web/tests/unit/services/generation-service.test.ts`

**Interfaces:**
- Consumes: `GeneratedRoutine`, `toRawRoutine` (Task 3); `buildSystemPrompt` (Task 4); `buildPrompt` (Task 5); `validateRoutineObject`, `ValidationError` (Task 2).
- Produces (from `@/services/llm/types`):
  - `interface ProviderMessage { role: "user" | "assistant"; content: string }`
  - `type GenerationFailureKind = "no-api-key" | "auth" | "rate-limit" | "network" | "validation" | "unknown"`
  - `class GenerationFailure extends Error { kind: GenerationFailureKind; validationErrors: ValidationError[] }`
  - `interface LlmProvider { generateRoutine(system: string, messages: ProviderMessage[]): Promise<GeneratedRoutine> }`
- Produces (from `@/services/generation-service`):
  - `const MAX_REPAIR_ATTEMPTS = 2`
  - `type GenerationResult = { ok: true; routine: Routine } | { ok: false; failure: GenerationFailure }`
  - `generateRoutine(db: ExerciseLoggerDB, answers: Answers, provider: LlmProvider): Promise<GenerationResult>`

- [ ] **Step 1: Write the provider/failure types (no test — pure declarations)**

Create `web/src/services/llm/types.ts`:

```ts
import type { ValidationError } from "@/services/routine-service";
import type { GeneratedRoutine } from "./routine-schema";

/** One turn in the generation conversation sent to the provider. */
export interface ProviderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Why a generation attempt failed — drives the GenerationScreen error UI. */
export type GenerationFailureKind =
  | "no-api-key"
  | "auth"
  | "rate-limit"
  | "network"
  | "validation"
  | "unknown";

/** Typed failure carrying the kind and (for "validation") the final errors. */
export class GenerationFailure extends Error {
  readonly kind: GenerationFailureKind;
  readonly validationErrors: ValidationError[];

  constructor(
    kind: GenerationFailureKind,
    message: string,
    validationErrors: ValidationError[] = []
  ) {
    super(message);
    this.name = "GenerationFailure";
    this.kind = kind;
    this.validationErrors = validationErrors;
  }
}

/**
 * Provider abstraction: one structured-output round trip. Implementations
 * throw GenerationFailure on transport/auth errors. The Anthropic
 * implementation lives in anthropic-provider.ts; tests inject fakes.
 */
export interface LlmProvider {
  generateRoutine(
    system: string,
    messages: ProviderMessage[]
  ): Promise<GeneratedRoutine>;
}
```

- [ ] **Step 2: Write the failing generation-service tests**

Create `web/tests/unit/services/generation-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  generateRoutine,
  MAX_REPAIR_ATTEMPTS,
} from "@/services/generation-service";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "@/services/llm/types";
import type { GeneratedRoutine } from "@/services/llm/routine-schema";
import type { Answers } from "@/features/onboarding/lib/types";

const answers: Answers = {
  goal: { kind: "chip", value: "Build muscle" },
  experience: { kind: "chip", value: "Intermediate" },
  daysPerWeek: { kind: "chip", value: "3" },
  sessionLength: { kind: "chip", value: "60" },
  distinctDays: { kind: "chip", value: "2" },
  equipment: { kind: "chip-multi", values: ["Barbell"] },
  supersets: { kind: "chip", value: "No" },
  cardio: { kind: "chip", value: "No" },
};

function validGenerated(exerciseId = "barbell-back-squat"): GeneratedRoutine {
  return {
    name: "Test Plan",
    rest_default_sec: 90,
    rest_superset_sec: 60,
    days: [
      {
        id: "A",
        label: "Full Body",
        entries: [
          {
            kind: "exercise",
            exercise: {
              exercise_id: exerciseId,
              instance_label: null,
              notes: null,
              sets: [
                { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null },
              ],
            },
          },
        ],
      },
    ],
    notes: [],
    cardio: null,
  };
}

function providerReturning(...results: (GeneratedRoutine | Error)[]): {
  provider: LlmProvider;
  calls: ProviderMessage[][];
} {
  const calls: ProviderMessage[][] = [];
  let i = 0;
  const provider: LlmProvider = {
    async generateRoutine(_system, messages) {
      calls.push(messages.map((m) => ({ ...m })));
      const result = results[Math.min(i, results.length - 1)]!;
      i++;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { provider, calls };
}

let db: ExerciseLoggerDB;

beforeEach(async () => {
  // Fresh DB per test, seeded with one catalog exercise.
  indexedDB.deleteDatabase("ExerciseLoggerDB");
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
});

describe("generateRoutine", () => {
  it("returns a normalized routine on first-shot success", async () => {
    const { provider, calls } = providerReturning(validGenerated());
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routine.name).toBe("Test Plan");
      expect(result.routine.dayOrder).toEqual(["A"]);
    }
    expect(calls).toHaveLength(1);
    // First call carries only the user prompt.
    expect(calls[0]).toHaveLength(1);
    expect(calls[0]![0]!.role).toBe("user");
    expect(calls[0]![0]!.content).toContain("Build muscle");
  });

  it("repairs once when the first attempt has a semantic error", async () => {
    const { provider, calls } = providerReturning(
      validGenerated("not-a-real-exercise"),
      validGenerated()
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    // Repair call: user prompt + assistant JSON + repair instructions.
    expect(calls[1]).toHaveLength(3);
    expect(calls[1]![1]!.role).toBe("assistant");
    expect(calls[1]![2]!.role).toBe("user");
    expect(calls[1]![2]!.content).toContain("not-a-real-exercise");
  });

  it("gives up after MAX_REPAIR_ATTEMPTS repairs with a validation failure", async () => {
    const { provider, calls } = providerReturning(
      validGenerated("not-a-real-exercise")
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe("validation");
      expect(result.failure.validationErrors.length).toBeGreaterThan(0);
    }
    expect(calls).toHaveLength(1 + MAX_REPAIR_ATTEMPTS);
  });

  it("passes through a GenerationFailure thrown by the provider", async () => {
    const { provider } = providerReturning(
      new GenerationFailure("auth", "invalid key")
    );
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("auth");
  });

  it("wraps an unknown provider error as kind 'unknown'", async () => {
    const { provider } = providerReturning(new Error("boom"));
    const result = await generateRoutine(db, answers, provider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("unknown");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/generation-service.test.ts`
Expected: FAIL — `@/services/generation-service` not found.

- [ ] **Step 4: Implement generation-service**

Create `web/src/services/generation-service.ts`:

```ts
// Orchestrates one routine generation: build prompts → provider round trip →
// convert structured output to the YAML-contract shape → domain validation →
// automatic repair loop. Pure service: no React, provider injected for
// testability, db is only read (exercises table).

import type { ExerciseLoggerDB } from "@/db/database";
import type { Routine } from "@/domain/types";
import type { Answers } from "@/features/onboarding/lib/types";
import { buildPrompt } from "@/features/onboarding/lib/prompt-builder";
import {
  validateRoutineObject,
  type ValidationError,
} from "@/services/routine-service";
import { toRawRoutine } from "@/services/llm/routine-schema";
import { buildSystemPrompt } from "@/services/llm/system-prompt";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "@/services/llm/types";

/** Repair round-trips after the initial attempt (spec: max 2). */
export const MAX_REPAIR_ATTEMPTS = 2;

export type GenerationResult =
  | { ok: true; routine: Routine }
  | { ok: false; failure: GenerationFailure };

function buildRepairPrompt(errors: ValidationError[]): string {
  const lines = errors
    .map((e) => (e.path === "" ? `- ${e.message}` : `- ${e.path}: ${e.message}`))
    .join("\n");
  return (
    "Your previous routine failed validation with these errors:\n\n" +
    `${lines}\n\n` +
    "Fix exactly these problems and return the complete corrected routine. " +
    "Do not change anything that was not flagged."
  );
}

function toFailure(err: unknown): GenerationFailure {
  if (err instanceof GenerationFailure) return err;
  const message = err instanceof Error ? err.message : "Generation failed";
  return new GenerationFailure("unknown", message);
}

/**
 * Generate, validate, and normalize a routine from questionnaire answers.
 * Never throws — every outcome is a GenerationResult.
 */
export async function generateRoutine(
  db: ExerciseLoggerDB,
  answers: Answers,
  provider: LlmProvider
): Promise<GenerationResult> {
  const exercises = await db.exercises.toArray();
  const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
  const system = buildSystemPrompt(exercises);

  let userPrompt: string;
  try {
    userPrompt = buildPrompt(answers);
  } catch (err) {
    return { ok: false, failure: toFailure(err) };
  }

  const messages: ProviderMessage[] = [{ role: "user", content: userPrompt }];
  let lastErrors: ValidationError[] = [];

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    let generated;
    try {
      generated = await provider.generateRoutine(system, messages);
    } catch (err) {
      return { ok: false, failure: toFailure(err) };
    }

    const result = validateRoutineObject(toRawRoutine(generated), lookup);
    if (result.ok) {
      return { ok: true, routine: result.routine };
    }

    lastErrors = result.errors;
    messages.push({ role: "assistant", content: JSON.stringify(generated) });
    messages.push({ role: "user", content: buildRepairPrompt(result.errors) });
  }

  return {
    ok: false,
    failure: new GenerationFailure(
      "validation",
      "The generated routine failed validation after automatic repairs.",
      lastErrors
    ),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/generation-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(llm): provider types + generation-service with validation repair loop"
```

---

### Task 7: Anthropic provider (structured outputs) + key test helper

**Files:**
- Create: `web/src/services/llm/anthropic-provider.ts`
- Test: `web/tests/unit/services/llm/anthropic-provider.test.ts`

**Interfaces:**
- Consumes: `generatedRoutineSchema`, `GeneratedRoutine` (Task 3); `GenerationFailure`, `LlmProvider`, `ProviderMessage` (Task 6).
- Produces (from `@/services/llm/anthropic-provider`):
  - `const ANTHROPIC_MODEL = "claude-haiku-4-5"`
  - `createAnthropicProvider(apiKey: string): LlmProvider`
  - `testAnthropicKey(apiKey: string): Promise<{ ok: boolean; message: string }>`
  - `mapProviderError(err: unknown): GenerationFailure` (exported for tests)

Implementation notes: the SDK and the zod helper are **dynamically imported** so the ~100 kB chunk loads only when the (already route-lazy) generation flow runs. `dangerouslyAllowBrowser: true` is required and correct here — the key belongs to the end user and is stored on their device. Error mapping is status-code based (not `instanceof`) so it works across the dynamic import boundary and is trivially unit-testable.

- [ ] **Step 1: Write the failing error-mapping tests**

Create `web/tests/unit/services/llm/anthropic-provider.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapProviderError, ANTHROPIC_MODEL } from "@/services/llm/anthropic-provider";
import { GenerationFailure } from "@/services/llm/types";

describe("ANTHROPIC_MODEL", () => {
  it("targets Haiku 4.5", () => {
    expect(ANTHROPIC_MODEL).toBe("claude-haiku-4-5");
  });
});

describe("mapProviderError", () => {
  it("passes an existing GenerationFailure through unchanged", () => {
    const original = new GenerationFailure("validation", "already typed");
    expect(mapProviderError(original)).toBe(original);
  });

  it("maps 401/403 to auth", () => {
    expect(mapProviderError({ status: 401, message: "unauthorized" }).kind).toBe("auth");
    expect(mapProviderError({ status: 403, message: "forbidden" }).kind).toBe("auth");
  });

  it("maps 429 and 529 to rate-limit", () => {
    expect(mapProviderError({ status: 429 }).kind).toBe("rate-limit");
    expect(mapProviderError({ status: 529 }).kind).toBe("rate-limit");
  });

  it("maps a status-less connection error to network", () => {
    expect(mapProviderError(new TypeError("Failed to fetch")).kind).toBe("network");
  });

  it("maps anything else to unknown", () => {
    expect(mapProviderError({ status: 400, message: "bad request" }).kind).toBe("unknown");
    expect(mapProviderError("weird").kind).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/llm/anthropic-provider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

Create `web/src/services/llm/anthropic-provider.ts`:

```ts
// Anthropic implementation of LlmProvider. Calls api.anthropic.com directly
// from the browser with the user's own key (dangerouslyAllowBrowser is the
// SDK's documented opt-in for exactly this bring-your-own-key client case).
// The SDK + zod helper are dynamically imported to keep them out of the main
// bundle — they load with the generation flow only.

import { generatedRoutineSchema } from "./routine-schema";
import {
  GenerationFailure,
  type LlmProvider,
  type ProviderMessage,
} from "./types";

export const ANTHROPIC_MODEL = "claude-haiku-4-5";

/** Output budget: a full multi-day routine JSON is ~1-3k tokens; 8k is roomy. */
const MAX_TOKENS = 8192;

let sdkPromise: Promise<{
  Anthropic: typeof import("@anthropic-ai/sdk").default;
  zodOutputFormat: typeof import("@anthropic-ai/sdk/helpers/zod").zodOutputFormat;
}> | null = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import("@anthropic-ai/sdk"),
      import("@anthropic-ai/sdk/helpers/zod"),
    ]).then(([sdk, zodHelpers]) => ({
      Anthropic: sdk.default,
      zodOutputFormat: zodHelpers.zodOutputFormat,
    }));
  }
  return sdkPromise;
}

/**
 * Map any thrown value to a typed GenerationFailure. Status-based (not
 * instanceof) so it is independent of the dynamically imported SDK classes.
 */
export function mapProviderError(err: unknown): GenerationFailure {
  if (err instanceof GenerationFailure) return err;

  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  const message = err instanceof Error ? err.message : "Request failed";

  if (status === 401 || status === 403) {
    return new GenerationFailure("auth", message);
  }
  if (status === 429 || status === 529 || status === 503) {
    return new GenerationFailure("rate-limit", message);
  }
  if (typeof status === "number") {
    return new GenerationFailure("unknown", message);
  }
  // No HTTP status → the request never got a response: offline, DNS, CORS.
  if (err instanceof Error) {
    return new GenerationFailure("network", message);
  }
  return new GenerationFailure("unknown", message);
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  return {
    async generateRoutine(system: string, messages: ProviderMessage[]) {
      const { Anthropic, zodOutputFormat } = await loadSdk();
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        maxRetries: 1, // one automatic retry on 429/5xx (spec: error handling table)
      });
      try {
        const response = await client.messages.parse({
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          output_config: { format: zodOutputFormat(generatedRoutineSchema) },
        });
        if (response.parsed_output == null) {
          throw new GenerationFailure(
            "unknown",
            "The model returned no parseable routine."
          );
        }
        return response.parsed_output;
      } catch (err) {
        throw mapProviderError(err);
      }
    },
  };
}

/**
 * Cheap authenticated ping for the Settings "Test connection" button.
 * models.retrieve is free and fails with 401 on a bad key.
 */
export async function testAnthropicKey(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const { Anthropic } = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    await client.models.retrieve(ANTHROPIC_MODEL);
    return { ok: true, message: "Connected — key works." };
  } catch (err) {
    const failure = mapProviderError(err);
    if (failure.kind === "auth") {
      return { ok: false, message: "Invalid API key." };
    }
    if (failure.kind === "network") {
      return { ok: false, message: "Network error — are you online?" };
    }
    return { ok: false, message: failure.message };
  }
}
```

If `client.messages.parse` or the `output_config.format` typing rejects at compile time, check the installed SDK version's helper docs (`node_modules/@anthropic-ai/sdk/helpers/zod`) — the canonical shape is `client.messages.parse({ ..., output_config: { format: zodOutputFormat(schema) } })` with the result on `response.parsed_output`. Fix names against the installed SDK, not by guessing.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/unit/services/llm/anthropic-provider.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(llm): Anthropic provider with structured outputs + key test helper"
```

---

### Task 8: Settings UI — "AI routine generation" section

**Files:**
- Create: `web/src/features/settings/LlmKeyCard.tsx`
- Modify: `web/src/features/settings/SettingsScreen.tsx`
- Test: `web/tests/unit/features/settings/LlmKeyCard.test.tsx`

**Interfaces:**
- Consumes: `setLlmApiKey` (Task 1), `testAnthropicKey` (Task 7), `Settings`, shared UI (`Card`, `Input`, `Button`, `SectionHeader`).
- Produces: `LlmKeyCard({ llmApiKey }: { llmApiKey: string })` — a named-export component rendering the masked key state, editor, and test-connection button.

- [ ] **Step 1: Write the failing component tests**

Create `web/tests/unit/features/settings/LlmKeyCard.test.tsx` (follow the render/mocking conventions of `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx` — RTL, user-event, `vi.mock` for services):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LlmKeyCard } from "@/features/settings/LlmKeyCard";

vi.mock("@/services/settings-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setLlmApiKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/llm/anthropic-provider", () => ({
  testAnthropicKey: vi.fn().mockResolvedValue({ ok: true, message: "Connected — key works." }),
}));

import { setLlmApiKey } from "@/services/settings-service";
import { testAnthropicKey } from "@/services/llm/anthropic-provider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LlmKeyCard", () => {
  it("shows 'Not set' when no key is configured", () => {
    render(<LlmKeyCard llmApiKey="" />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("masks a configured key", () => {
    render(<LlmKeyCard llmApiKey="sk-ant-abc123xyz789" />);
    expect(screen.getByText(/•+…789/)).toBeInTheDocument();
    expect(screen.queryByText("sk-ant-abc123xyz789")).not.toBeInTheDocument();
  });

  it("saves an entered key", async () => {
    const user = userEvent.setup();
    render(<LlmKeyCard llmApiKey="" />);
    await user.click(screen.getByText("Not set"));
    await user.type(screen.getByLabelText("Anthropic API key"), "sk-ant-new-key");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setLlmApiKey).toHaveBeenCalledWith(expect.anything(), "sk-ant-new-key");
  });

  it("runs the connection test and shows the result", async () => {
    const user = userEvent.setup();
    render(<LlmKeyCard llmApiKey="sk-ant-abc123xyz789" />);
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(testAnthropicKey).toHaveBeenCalledWith("sk-ant-abc123xyz789");
    expect(await screen.findByText("Connected — key works.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/features/settings/LlmKeyCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `web/src/features/settings/LlmKeyCard.tsx`:

```tsx
import { useState } from "react";
import { db } from "@/db/database";
import { setLlmApiKey } from "@/services/settings-service";
import { testAnthropicKey } from "@/services/llm/anthropic-provider";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

function maskKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `${"•".repeat(8)}…${key.slice(-3)}`;
}

export function LlmKeyCard({ llmApiKey }: { llmApiKey: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const hasKey = llmApiKey !== "";

  async function handleSave() {
    await setLlmApiKey(db, draft);
    setDraft("");
    setEditing(false);
    setTestResult(null);
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAnthropicKey(llmApiKey));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="py-0">
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent-cli-soft/40"
        >
          <span className="text-sm font-medium">Anthropic API key</span>
          <span className={cn("text-sm font-mono", !hasKey && "italic font-sans text-ink-3")}>
            {hasKey ? maskKey(llmApiKey) : "Not set"}
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-2 px-4 py-3">
          <Input
            aria-label="Anthropic API key"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            className="rounded-[var(--radius-card)] bg-paper font-mono"
          />
          <p className="text-meta">
            Stays on this device. Used only to call Anthropic when generating a routine.
          </p>
          <div className="flex gap-2 self-end">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
      {!editing && hasKey && (
        <div className="border-t border-line px-4 py-3">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {testResult && (
            <p
              role="status"
              className={cn(
                "mt-2 text-sm",
                testResult.ok ? "text-ink-2" : "text-destructive"
              )}
            >
              {testResult.message}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Wire it into SettingsScreen**

In `web/src/features/settings/SettingsScreen.tsx`:

1. Add import: `import { LlmKeyCard } from "./LlmKeyCard";`
2. Insert a new section between the `{/* Routines */}` and `{/* Display */}` sections:

```tsx
      {/* AI generation */}
      <div className="space-y-3">
        <SectionHeader>AI routine generation</SectionHeader>
        <LlmKeyCard llmApiKey={settings.llmApiKey} />
      </div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/features/settings/LlmKeyCard.test.tsx tests/unit/features/settings/SettingsScreen.test.tsx`
Expected: PASS. (If SettingsScreen.test.tsx snapshots/queries break on the new section, update them to expect the "AI routine generation" header.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(settings): AI generation section with API key card + connection test"
```

---

### Task 9: RoutinePreview component

**Files:**
- Create: `web/src/features/onboarding/components/RoutinePreview.tsx`
- Test: `web/tests/unit/features/onboarding/RoutinePreview.test.tsx`

**Interfaces:**
- Consumes: `Routine`, `Exercise`, `SetBlock` from `@/domain/types`.
- Produces: `RoutinePreview({ routine, exercisesById }: { routine: Routine; exercisesById: Map<string, Exercise> })` — named export, read-only summary. Set formatting reuses nothing (workout's `formatSetTarget` is display-unit aware and session-shaped; a tiny local formatter is simpler here).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/onboarding/RoutinePreview.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoutinePreview } from "@/features/onboarding/components/RoutinePreview";
import type { Routine, Exercise } from "@/domain/types";

const exercisesById = new Map<string, Exercise>([
  ["barbell-back-squat", { id: "barbell-back-squat", name: "Barbell Back Squat", type: "weight", equipment: "barbell", muscleGroups: ["Legs"] }],
  ["barbell-row", { id: "barbell-row", name: "Barbell Row", type: "weight", equipment: "barbell", muscleGroups: ["Back"] }],
  ["barbell-bench-press", { id: "barbell-bench-press", name: "Barbell Bench Press", type: "weight", equipment: "barbell", muscleGroups: ["Chest"] }],
]);

const routine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "3-Day Split",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 5, maxValue: 8, count: 3 }],
        },
        {
          kind: "superset",
          groupId: "A-e1-group",
          items: [
            { entryId: "A-e1-s0", exerciseId: "barbell-row", setBlocks: [{ targetKind: "reps", exactValue: 10, count: 3 }] },
            { entryId: "A-e1-s1", exerciseId: "barbell-bench-press", setBlocks: [{ targetKind: "reps", exactValue: 10, count: 3 }] },
          ],
        },
      ],
    },
  },
  notes: [],
  cardio: { notes: "Optional, after lifting", options: [{ name: "Walk", detail: "20-30 min" }] },
  importedAt: "2026-07-06T00:00:00.000Z",
};

describe("RoutinePreview", () => {
  it("renders the routine name, day labels, and exercise names", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText("3-Day Split")).toBeInTheDocument();
    expect(screen.getByText(/Full Body/)).toBeInTheDocument();
    expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
  });

  it("formats set blocks and marks supersets", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText("3 × 5–8")).toBeInTheDocument();
    expect(screen.getAllByText("3 × 10")).toHaveLength(2);
    expect(screen.getByText(/superset/i)).toBeInTheDocument();
  });

  it("renders the cardio section when present", () => {
    render(<RoutinePreview routine={routine} exercisesById={exercisesById} />);
    expect(screen.getByText(/Walk/)).toBeInTheDocument();
    expect(screen.getByText(/20-30 min/)).toBeInTheDocument();
  });

  it("falls back to the exercise id when the catalog entry is missing", () => {
    const strippedMap = new Map<string, Exercise>();
    render(<RoutinePreview routine={routine} exercisesById={strippedMap} />);
    expect(screen.getByText("barbell-back-squat")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/features/onboarding/RoutinePreview.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `web/src/features/onboarding/components/RoutinePreview.tsx`:

```tsx
import type { Routine, Exercise, SetBlock, RoutineExerciseEntry } from "@/domain/types";
import { Card } from "@/shared/ui/card";

function formatBlock(b: SetBlock): string {
  const target =
    b.exactValue !== undefined
      ? `${b.exactValue}`
      : `${b.minValue}–${b.maxValue}`;
  const unit = b.targetKind === "duration" ? "s" : b.targetKind === "distance" ? "m" : "";
  const tag = b.tag === "top" ? " · top" : b.tag === "amrap" ? " · AMRAP" : "";
  return `${b.count} × ${target}${unit}${tag}`;
}

function ExerciseLine({
  item,
  exercisesById,
}: {
  item: Pick<RoutineExerciseEntry, "exerciseId" | "instanceLabel" | "setBlocks">;
  exercisesById: Map<string, Exercise>;
}) {
  const name = exercisesById.get(item.exerciseId)?.name ?? item.exerciseId;
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm">
        {name}
        {item.instanceLabel && (
          <span className="ml-1 text-meta">({item.instanceLabel})</span>
        )}
      </span>
      <span className="flex flex-col items-end font-mono text-xs text-ink-2">
        {item.setBlocks.map((b, i) => (
          <span key={i}>{formatBlock(b)}</span>
        ))}
      </span>
    </div>
  );
}

export function RoutinePreview({
  routine,
  exercisesById,
}: {
  routine: Routine;
  exercisesById: Map<string, Exercise>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-hero-serif text-ink">{routine.name}</h2>
      <p className="text-meta">
        Rest {routine.restDefaultSec}s · superset rest {routine.restSupersetSec}s
      </p>
      {routine.dayOrder.map((dayId) => {
        const day = routine.days[dayId];
        if (!day) return null;
        return (
          <Card key={dayId} className="px-4 py-3">
            <p className="text-eyebrow text-ink-2">
              DAY {dayId} — {day.label}
            </p>
            <div className="mt-1 divide-y divide-line-soft">
              {day.entries.map((entry) =>
                entry.kind === "exercise" ? (
                  <ExerciseLine
                    key={entry.entryId}
                    item={entry}
                    exercisesById={exercisesById}
                  />
                ) : (
                  <div key={entry.groupId} className="py-1">
                    <p className="text-meta">superset</p>
                    <div className="border-l-2 border-line pl-2">
                      {entry.items.map((item) => (
                        <ExerciseLine
                          key={item.entryId}
                          item={item}
                          exercisesById={exercisesById}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        );
      })}
      {routine.cardio && (
        <Card className="px-4 py-3">
          <p className="text-eyebrow text-ink-2">CARDIO</p>
          <p className="mt-1 text-sm text-ink-2">{routine.cardio.notes}</p>
          {routine.cardio.options.map((opt) => (
            <p key={opt.name} className="text-sm">
              {opt.name} — <span className="text-ink-2">{opt.detail}</span>
            </p>
          ))}
        </Card>
      )}
      {routine.notes.length > 0 && (
        <Card className="px-4 py-3">
          <p className="text-eyebrow text-ink-2">NOTES</p>
          {routine.notes.map((n, i) => (
            <p key={i} className="mt-1 text-sm text-ink-2">
              {n}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/features/onboarding/RoutinePreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(onboarding): RoutinePreview summary component"
```

---

### Task 10: GenerationScreen

**Files:**
- Create: `web/src/features/onboarding/GenerationScreen.tsx`
- Test: `web/tests/unit/features/onboarding/GenerationScreen.test.tsx`

**Interfaces:**
- Consumes: `generateRoutine`, `GenerationResult` (Task 6); `createAnthropicProvider` (Task 7); `RoutinePreview` (Task 9); `setLlmApiKey` (Task 1); existing `loadWizardState`/`clearWizardState`, `importAndActivateRoutine`, `markOnboardingCompleted`, `useSettings`, `YamlErrorList`.
- Produces: default-export screen component for route `/onboarding/generate` (wired in Task 11).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/onboarding/GenerationScreen.test.tsx` (mirror the router/DB mocking conventions of `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` — MemoryRouter wrapper, fake-indexeddb `db`, seeded settings). The essential structure:

```tsx
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { db, initializeSettings } from "@/db/database";
import { saveWizardState, clearWizardState } from "@/features/onboarding/lib/session-storage";
import GenerationScreen from "@/features/onboarding/GenerationScreen";
import { GenerationFailure } from "@/services/llm/types";
import type { Routine } from "@/domain/types";

vi.mock("@/services/generation-service", () => ({
  generateRoutine: vi.fn(),
}));
vi.mock("@/services/llm/anthropic-provider", () => ({
  createAnthropicProvider: vi.fn(() => ({ generateRoutine: vi.fn() })),
  testAnthropicKey: vi.fn(),
}));

import { generateRoutine } from "@/services/generation-service";

const fakeRoutine: Routine = {
  id: "r1",
  schemaVersion: 1,
  name: "Generated Plan",
  restDefaultSec: 90,
  restSupersetSec: 60,
  dayOrder: ["A"],
  nextDayId: "A",
  days: {
    A: {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [{ targetKind: "reps", minValue: 5, maxValue: 8, count: 3 }],
        },
      ],
    },
  },
  notes: [],
  cardio: null,
  importedAt: "2026-07-06T00:00:00.000Z",
};

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/onboarding/generate"]}>
      <Routes>
        <Route path="/onboarding/generate" element={<GenerationScreen />} />
        <Route path="/onboarding/questionnaire" element={<p>questionnaire</p>} />
        <Route path="/" element={<p>today</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  clearWizardState();
  await db.delete();
  await db.open();
  await initializeSettings(db);
  await db.exercises.put({
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
  });
  saveWizardState({
    stepIndex: 10,
    answers: { goal: { kind: "chip", value: "Build muscle" } },
  });
});

describe("GenerationScreen", () => {
  it("redirects to the questionnaire when no wizard answers exist", async () => {
    clearWizardState();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    renderScreen();
    expect(await screen.findByText("questionnaire")).toBeInTheDocument();
  });

  it("shows the key setup card when no key is configured", async () => {
    renderScreen();
    expect(
      await screen.findByText(/needs your Anthropic API key/i)
    ).toBeInTheDocument();
    expect(generateRoutine).not.toHaveBeenCalled();
  });

  it("generates and shows the preview when a key exists", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    expect(await screen.findByText("Generated Plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use this routine/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
  });

  it("activates the routine, marks onboarding complete, and navigates home on accept", async () => {
    const user = userEvent.setup();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: /use this routine/i }));
    expect(await screen.findByText("today")).toBeInTheDocument();
    const settings = await db.settings.get("user");
    expect(settings!.onboardingCompletedAt).not.toBeNull();
    expect(settings!.activeRoutineId).toBe("r1");
  });

  it("shows a typed error with retry for an auth failure", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-bad" });
    vi.mocked(generateRoutine).mockResolvedValue({
      ok: false,
      failure: new GenerationFailure("auth", "invalid key"),
    });
    renderScreen();
    expect(await screen.findByText(/check your api key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("lists validation errors when repairs are exhausted", async () => {
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({
      ok: false,
      failure: new GenerationFailure("validation", "failed", [
        { path: "days.A.entries[0].exercise_id", message: 'Unknown exercise "xyz"' },
      ]),
    });
    renderScreen();
    expect(await screen.findByText(/Unknown exercise/)).toBeInTheDocument();
  });

  it("regenerates on the Regenerate button", async () => {
    const user = userEvent.setup();
    await db.settings.update("user", { llmApiKey: "sk-ant-x" });
    vi.mocked(generateRoutine).mockResolvedValue({ ok: true, routine: fakeRoutine });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: /regenerate/i }));
    await waitFor(() => expect(generateRoutine).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/features/onboarding/GenerationScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `web/src/features/onboarding/GenerationScreen.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useSettings } from "@/shared/hooks/useSettings";
import { setLlmApiKey } from "@/services/settings-service";
import { importAndActivateRoutine } from "@/services/routine-service";
import { markOnboardingCompleted } from "@/services/onboarding-service";
import { generateRoutine } from "@/services/generation-service";
import { createAnthropicProvider } from "@/services/llm/anthropic-provider";
import type { GenerationFailure } from "@/services/llm/types";
import type { Routine } from "@/domain/types";
import {
  loadWizardState,
  clearWizardState,
} from "@/features/onboarding/lib/session-storage";
import { RoutinePreview } from "@/features/onboarding/components/RoutinePreview";
import { YamlErrorList } from "@/features/settings/YamlErrorList";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";

type Phase =
  | { name: "boot" }
  | { name: "no-key" }
  | { name: "generating" }
  | { name: "preview"; routine: Routine }
  | { name: "error"; failure: GenerationFailure };

const ERROR_COPY: Record<GenerationFailure["kind"], string> = {
  "no-api-key": "No API key is configured.",
  auth: "Anthropic rejected the request — check your API key in Settings.",
  "rate-limit": "Anthropic is busy or rate-limited right now. Wait a moment and try again.",
  network: "You're offline — generation needs a connection.",
  validation: "The generated routine didn't pass validation after automatic repairs.",
  unknown: "Generation failed unexpectedly.",
};

export default function GenerationScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [phase, setPhase] = useState<Phase>({ name: "boot" });
  const [keyDraft, setKeyDraft] = useState("");
  const [activationBlock, setActivationBlock] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runGeneration = useCallback(async (apiKey: string) => {
    const wizard = loadWizardState();
    if (wizard === null || Object.keys(wizard.answers).length === 0) {
      navigate("/onboarding/questionnaire", { replace: true });
      return;
    }
    setPhase({ name: "generating" });
    const provider = createAnthropicProvider(apiKey);
    const result = await generateRoutine(db, wizard.answers, provider);
    if (result.ok) {
      setPhase({ name: "preview", routine: result.routine });
    } else {
      setPhase({ name: "error", failure: result.failure });
    }
  }, [navigate]);

  // Kick off exactly once when settings resolve (StrictMode-safe via ref).
  useEffect(() => {
    if (!settings) return;
    if (loadWizardState() === null) {
      navigate("/onboarding/questionnaire", { replace: true });
      return;
    }
    if (settings.llmApiKey === "") {
      if (!startedRef.current) setPhase({ name: "no-key" });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void runGeneration(settings.llmApiKey);
  }, [settings, navigate, runGeneration]);

  async function handleSaveKey() {
    const trimmed = keyDraft.trim();
    if (trimmed === "") return;
    await setLlmApiKey(db, trimmed);
    startedRef.current = true;
    void runGeneration(trimmed);
  }

  async function handleAccept(routine: Routine) {
    setActivationBlock(null);
    const activation = await importAndActivateRoutine(db, routine);
    if (!activation.ok) {
      setActivationBlock(activation.message);
      return;
    }
    // First-run only — Settings re-entry must not re-stamp completion (spec).
    if (settings && settings.onboardingCompletedAt === null) {
      await markOnboardingCompleted(db);
    }
    clearWizardState();
    navigate("/", { replace: true });
  }

  function handleRetry() {
    if (!settings || settings.llmApiKey === "") return;
    void runGeneration(settings.llmApiKey);
  }

  if (!settings || phase.name === "boot") return null;

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-8">
      <p className="text-eyebrow text-ink-2">YOUR ROUTINE</p>

      {phase.name === "no-key" && (
        <div className="flex flex-col gap-3">
          <h1 className="text-hero-serif text-ink">One more thing.</h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Generating a routine needs your Anthropic API key. It stays on this
            device and is only sent to Anthropic.
          </p>
          <Card className="flex flex-col gap-2 px-4 py-3">
            <Input
              aria-label="Anthropic API key"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              className="rounded-[var(--radius-card)] bg-paper font-mono"
            />
            <Button onClick={handleSaveKey} disabled={keyDraft.trim() === ""}>
              Save and generate →
            </Button>
          </Card>
          <Link
            to="/settings/import"
            className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            No key? Import routine YAML manually instead
          </Link>
        </div>
      )}

      {phase.name === "generating" && (
        <div
          role="status"
          className="flex min-h-48 flex-col items-center justify-center gap-3"
        >
          <span
            aria-hidden="true"
            className="animate-glyph-pulse text-2xl text-accent-cli select-none"
          >
            ✻
          </span>
          <p className="text-sm text-ink-2">
            Designing your split… this takes a few seconds.
          </p>
        </div>
      )}

      {phase.name === "preview" && exercises && (
        <div className="flex flex-col gap-4">
          <RoutinePreview
            routine={phase.routine}
            exercisesById={new Map(exercises.map((ex) => [ex.id, ex]))}
          />
          {activationBlock && (
            <p
              role="alert"
              className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {activationBlock}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={() => void handleAccept(phase.routine)}>
              Use this routine →
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {phase.name === "error" && (
        <div className="flex flex-col gap-3">
          <h1 className="text-hero-serif text-ink">That didn't work.</h1>
          <p role="alert" className="text-sm text-ink-2 leading-relaxed">
            {ERROR_COPY[phase.failure.kind]}
          </p>
          {phase.failure.kind === "validation" && (
            <YamlErrorList errors={phase.failure.validationErrors} />
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry}>Try again</Button>
            {phase.failure.kind === "auth" && (
              <Link
                to="/settings"
                className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                Open Settings →
              </Link>
            )}
            <Link
              to="/settings/import"
              className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Import routine YAML manually instead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/features/onboarding/GenerationScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(onboarding): GenerationScreen with no-key/generating/preview/error phases"
```

---

### Task 11: Routing — wire `/onboarding/generate`, retarget the questionnaire

**Files:**
- Modify: `web/src/app/App.tsx`
- Modify: `web/src/features/onboarding/QuestionnaireScreen.tsx`
- Test: `web/tests/unit/app/AppRoutes.test.tsx`, `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx` (update)

**Interfaces:**
- Consumes: `GenerationScreen` (Task 10).
- Produces: route `/onboarding/generate`; questionnaire completion navigates there. The old `/onboarding/handoff` route and its settings-based guard are **left in place** in this task and removed in Task 12 (so each commit stays green).

- [ ] **Step 1: Update the questionnaire test expectation**

In `web/tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`, find the assertion for the final-step navigation (`/onboarding/handoff` with `justCompleted: true`) and change the expected path to `/onboarding/generate` (keep the `justCompleted` state expectation only if the test asserts it — the new screen does not read it; drop the state assertion if simpler).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
Expected: FAIL on the navigation assertion.

- [ ] **Step 3: Retarget the questionnaire and add the route**

1. In `web/src/features/onboarding/QuestionnaireScreen.tsx`, in `onNext`, replace:

```ts
      navigate("/onboarding/handoff", { state: { justCompleted: true } });
```
with:
```ts
      navigate("/onboarding/generate");
```

2. In `web/src/app/App.tsx`:
   - Add the lazy import next to the other onboarding screens:
     ```tsx
     const GenerationScreen = lazy(
       () => import("@/features/onboarding/GenerationScreen"),
     );
     ```
   - Add the route inside the `OnboardingLayout` route group, after the questionnaire route:
     ```tsx
     <Route path="/onboarding/generate" element={<GenerationScreen />} />
     ```
   (No AppRoutes-level guard is needed: GenerationScreen redirects itself when sessionStorage has no wizard answers — settings can't see sessionStorage, so a guard here would be wrong anyway.)

- [ ] **Step 4: Run the routing tests**

Run: `npx vitest run tests/unit/app/AppRoutes.test.tsx tests/unit/features/onboarding/QuestionnaireScreen.test.tsx`
Expected: PASS. If AppRoutes.test.tsx has a route-table snapshot/assertion, add `/onboarding/generate` to it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(routing): questionnaire hands off to /onboarding/generate"
```

---

### Task 12: Remove the GPT copy/paste flow

**Files:**
- Delete: `web/src/features/onboarding/HandoffScreen.tsx`, `web/src/features/onboarding/components/LastPromptCard.tsx`, `web/src/shared/lib/gpt-url.ts`
- Delete: `web/tests/unit/features/onboarding/HandoffScreen.test.tsx`, `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`
- Modify: `web/src/app/App.tsx` (route + guard + lazy import), `web/src/features/settings/SettingsScreen.tsx`, `web/src/features/settings/RoutineImportScreen.tsx`, `web/src/features/today/TodayScreen.tsx`, `web/src/features/today/OnboardingBanner.tsx`, `web/src/services/onboarding-service.ts`, `web/src/domain/types.ts`, `web/src/db/database.ts`, `web/src/services/backup-service.ts`
- Test: update `web/tests/unit/services/onboarding-service.test.ts`, `web/tests/unit/features/today/TodayScreen.test.tsx`, `web/tests/unit/features/today/OnboardingBanner.test.tsx`, `web/tests/unit/features/settings/SettingsScreen.test.tsx`, plus any backup-service tests referencing the removed fields

This is one task because the pieces are interdependent — removing `lastGeneratedPrompt` breaks every consumer at once, so they must land in a single green commit.

- [ ] **Step 1: Update tests first (expected new behavior)**

1. `web/tests/unit/services/onboarding-service.test.ts`: delete the `saveGeneratedPrompt` and `clearLastPrompt` describe blocks; keep `markOnboardingCompleted`, `markOnboardingSkipped`, `dismissOnboardingBanner`.
2. `web/tests/unit/features/today/OnboardingBanner.test.tsx`: change the label expectation to `"Finish setting up your routine →"` and the navigation expectation to `/onboarding/questionnaire`.
3. `web/tests/unit/features/today/TodayScreen.test.tsx`: banner-visibility tests now hinge on saved wizard state instead of `lastGeneratedPrompt`. Use `saveWizardState({ stepIndex: 0, answers: { goal: { kind: "chip", value: "x" } } })` from `@/features/onboarding/lib/session-storage` in the "banner shows" case and `clearWizardState()` in the "banner hidden" case (also hidden when `onboardingCompletedAt` is set or the banner was dismissed).
4. `web/tests/unit/features/settings/SettingsScreen.test.tsx`: remove assertions about `LastPromptCard` and the "Start a new routine?" saved-prompt confirm dialog; the "Create a personalized routine" row now always navigates straight to `/onboarding/questionnaire`.
5. Delete `web/tests/unit/features/onboarding/HandoffScreen.test.tsx` and `web/tests/unit/features/onboarding/LastPromptCard.test.tsx`.
6. Backup-service tests: remove `lastGeneratedPrompt` / `lastGeneratedPromptAt` from settings fixtures and any validation-error expectations for them.

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `npm test`
Expected: FAIL in the files updated above (old implementation still present).

- [ ] **Step 3: Remove the implementation pieces**

1. **App.tsx**: delete the `HandoffScreen` lazy import, the `/onboarding/handoff` route, and the entire "Handoff guard" block (the `if` on `location.pathname === "/onboarding/handoff"`).
2. **Delete files**: `web/src/features/onboarding/HandoffScreen.tsx`, `web/src/features/onboarding/components/LastPromptCard.tsx`, `web/src/shared/lib/gpt-url.ts`.
3. **RoutineImportScreen.tsx**: remove the `GPT_URL` import and the anchor that used it (the "open the GPT" link); the screen keeps its paste/clipboard/file import mechanics.
4. **SettingsScreen.tsx**: remove the `LastPromptCard` import and render block, the `clearLastPrompt` import, the `newRoutineConfirmOpen` state, and its `ConfirmDialog`; the "✨ Create a personalized routine" `RowLink` becomes simply `onClick={() => navigate("/onboarding/questionnaire")}`.
5. **OnboardingBanner.tsx**: change the button label to `Finish setting up your routine →` and the navigate target to `/onboarding/questionnaire`.
6. **TodayScreen.tsx**: replace the banner condition. Add import `import { loadWizardState } from "@/features/onboarding/lib/session-storage";` and change:

```tsx
        {settings.lastGeneratedPrompt !== null &&
          settings.onboardingBannerDismissedAt === null && (
```
to:
```tsx
        {loadWizardState() !== null &&
          settings.onboardingCompletedAt === null &&
          settings.onboardingBannerDismissedAt === null && (
```

7. **onboarding-service.ts**: delete `saveGeneratedPrompt` and `clearLastPrompt` (and their doc comments). Keep the other three functions.
8. **domain/types.ts**: delete `lastGeneratedPrompt` and `lastGeneratedPromptAt` from `Settings` (keep `onboardingBannerDismissedAt` — still used). Update the `onboardingCompletedAt` doc comment ("successful YAML import on Stage 2" → "successful routine generation or import").
9. **db/database.ts**: remove the two fields from `DEFAULT_SETTINGS` and from the v3 upgrade's `update(...)` payload — **no**: leave the v3 migration body untouched (migrations are history; editing them changes behavior for users upgrading from v2). Only remove the fields from `DEFAULT_SETTINGS`. Add a one-line comment in the v5 block: `// v5 also predates the removal of lastGeneratedPrompt fields from the Settings type; stale props on existing rows are harmless and intentionally not migrated away.`
10. **backup-service.ts**: remove `"lastGeneratedPrompt", "lastGeneratedPromptAt"` from the string-or-null field list in `validateSettings` (leave unknown-field tolerance as is — old backups containing them import fine as ignored extras), and remove the two lines from the `cleanSettings` literal in `importBackup`.

- [ ] **Step 4: Typecheck to catch stragglers**

Run: `npm run typecheck`
Expected: clean. Any remaining reference to the deleted exports/fields shows up here — fix each (they should all be covered by step 3).

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat!: remove custom-GPT handoff flow (HandoffScreen, saved prompt, GPT links)"
```

---

### Task 13: E2E — mock the Anthropic API, cover the full flow

**Files:**
- Create: `web/tests/e2e/llm-generation.spec.ts`
- Modify: `web/tests/e2e/helpers/onboarding-helpers.ts`
- Modify/Rewrite: `web/tests/e2e/onboarding-first-run.e2e.ts`, `web/tests/e2e/onboarding-banner-recovery.e2e.ts`, `web/tests/e2e/onboarding-settings-relaunch.e2e.ts` (and check `onboarding-skip.e2e.ts`, `onboarding-a11y.e2e.ts`, `onboarding-starter-first-set.e2e.ts` for handoff references)

**Interfaces:**
- Consumes: the deployed flow from Tasks 10–12; existing questionnaire helpers.
- Produces: `mockAnthropicRoutine(page, generated)` helper; green E2E suite that never touches the real API.

- [ ] **Step 1: Add the API mock helper**

Append to `web/tests/e2e/helpers/onboarding-helpers.ts`:

```ts
import type { Page } from "@playwright/test";

/**
 * A schema-valid GeneratedRoutine payload using real catalog IDs. The
 * structured-outputs client parses the message's text content as JSON.
 */
export const MOCK_GENERATED_ROUTINE = {
  name: "E2E Test Plan",
  rest_default_sec: 90,
  rest_superset_sec: 60,
  days: [
    {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          exercise: {
            exercise_id: "barbell-back-squat",
            instance_label: null,
            notes: null,
            sets: [
              { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null },
            ],
          },
        },
      ],
    },
  ],
  notes: [],
  cardio: null,
};

/** Intercept Anthropic's messages endpoint with a canned structured output. */
export async function mockAnthropicRoutine(
  page: Page,
  generated: unknown = MOCK_GENERATED_ROUTINE
): Promise<void> {
  await page.route("https://api.anthropic.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_e2e_mock",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: JSON.stringify(generated) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    });
  });
}

/** Seed the API key straight into IndexedDB so tests skip the key card. */
export async function seedLlmApiKey(page: Page, key = "sk-ant-e2e-test"): Promise<void> {
  await page.evaluate(async (k) => {
    const openReq = indexedDB.open("ExerciseLoggerDB");
    await new Promise<void>((resolve, reject) => {
      openReq.onsuccess = () => {
        const idb = openReq.result;
        const tx = idb.transaction("settings", "readwrite");
        const store = tx.objectStore("settings");
        const getReq = store.get("user");
        getReq.onsuccess = () => {
          const record = getReq.result;
          if (record) {
            record.llmApiKey = k;
            store.put(record);
          }
        };
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, key);
}
```

- [ ] **Step 2: Write the new spec**

Create `web/tests/e2e/llm-generation.spec.ts` (reuse the existing questionnaire-completion helper from `onboarding-helpers.ts` — referred to below as `completeQuestionnaire(page)`; use its actual exported name):

```ts
import { test, expect } from "@playwright/test";
import {
  mockAnthropicRoutine,
  seedLlmApiKey,
  MOCK_GENERATED_ROUTINE,
} from "./helpers/onboarding-helpers";
// also import the existing questionnaire walk-through helper by its real name

test.describe("LLM routine generation", () => {
  test("full flow: questionnaire → generate → preview → activate → Today", async ({ page }) => {
    await mockAnthropicRoutine(page);
    await page.goto("/exercise-logger/");
    // welcome → questionnaire (existing helper walks all 11 steps)
    // ... completeQuestionnaire(page) ...
    await seedLlmApiKey(page); // before the generate screen fires? see note below
    // On /onboarding/generate: either the key card (fill + save) or, with the
    // seeded key, straight to generating → preview.
    await expect(page.getByText("E2E Test Plan")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /use this routine/i }).click();
    await expect(page).toHaveURL(/exercise-logger\/$/);
    await expect(page.getByText("Full Body")).toBeVisible();
  });

  test("no key → key card appears, manual import escape hatch works", async ({ page }) => {
    await page.goto("/exercise-logger/");
    // ... completeQuestionnaire(page) ...
    await expect(page.getByText(/needs your Anthropic API key/i)).toBeVisible();
    await page.getByRole("link", { name: /import routine yaml manually/i }).click();
    await expect(page).toHaveURL(/settings\/import/);
  });

  test("invalid catalog id → repair loop exhausts → validation errors shown", async ({ page }) => {
    const bad = structuredClone(MOCK_GENERATED_ROUTINE);
    bad.days[0]!.entries[0]!.exercise!.exercise_id = "not-a-real-exercise";
    await mockAnthropicRoutine(page, bad);
    await page.goto("/exercise-logger/");
    // ... completeQuestionnaire(page) ...
    await seedLlmApiKey(page);
    await expect(page.getByText(/didn't pass validation|not-a-real-exercise/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
```

Sequencing note: `seedLlmApiKey` must run while the app origin is loaded but **before** the questionnaire's final "Next" fires the navigation to `/onboarding/generate` — the simplest ordering is: `page.goto` → seed key → walk questionnaire → land on generate already keyed. Adjust the calls to that order when writing the spec against the real helper.

- [ ] **Step 3: Fix the legacy onboarding specs**

Search `web/tests/e2e/` for `handoff`, `YAML`, `Copy prompt`, `lastGeneratedPrompt`:
- `onboarding-first-run.e2e.ts`: replace the handoff/paste-YAML stage with `mockAnthropicRoutine` + `seedLlmApiKey` + preview-accept (same shape as the new spec's first test).
- `onboarding-banner-recovery.e2e.ts`: the banner now appears when wizard state exists and onboarding is incomplete; it navigates to the questionnaire. Rewrite assertions accordingly (label `Finish setting up your routine →`, target `/onboarding/questionnaire`).
- `onboarding-settings-relaunch.e2e.ts`: the Settings "Create a personalized routine" row goes straight to the questionnaire (no saved-prompt confirm dialog); finish with the mocked generation.
- `onboarding-skip.e2e.ts` / `onboarding-a11y.e2e.ts` / `onboarding-starter-first-set.e2e.ts`: update only if they reference the handoff screen; skip/welcome behavior is unchanged.

- [ ] **Step 4: Run the E2E suite**

Run: `npm run test:e2e`
Expected: PASS. (This builds first; any lingering type error also surfaces here.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): mocked-API generation flow; retire handoff-era onboarding specs"
```

---

### Task 14: Docs + final verification

**Files:**
- Modify: `CLAUDE.md` (root), `web/src/features/onboarding/CLAUDE.md`, `web/src/services/CLAUDE.md`, `web/src/db/CLAUDE.md`, `web/src/features/settings/CLAUDE.md`, `web/src/features/today/CLAUDE.md`
- Create: `docs/custom-gpt/DEPRECATED.md`

- [ ] **Step 1: Update the layer docs**

1. `web/src/features/onboarding/CLAUDE.md`: rewrite the module-shape and flow sections — `HandoffScreen`/`LastPromptCard` gone; add `GenerationScreen.tsx` (route `/onboarding/generate`), `components/RoutinePreview.tsx`; update the "Saved-prompt lifecycle" section to a "Generation flow" section (wizard state in sessionStorage is the single recovery source; banner keys off it); update the first-run-gate description (handoff guard removed; GenerationScreen self-redirects); prompt co-ship note now points at `services/llm/system-prompt.ts`.
2. `web/src/services/CLAUDE.md`: add `generation-service.ts` and the `llm/` folder (provider interface, Anthropic impl, schema, system prompt); document `validateRoutineObject` under routine-service; update onboarding-service (three functions remain); note backup export strips `llmApiKey` and import preserves the device-local key.
3. `web/src/db/CLAUDE.md`: add the v5 schema section (`llmApiKey`, default `""`, backfill `""`); note the `lastGeneratedPrompt`/`lastGeneratedPromptAt` type-level removal with stale-prop tolerance.
4. `web/src/features/settings/CLAUDE.md`: add `LlmKeyCard.tsx`; remove GPT-link references.
5. `web/src/features/today/CLAUDE.md`: update the banner description (wizard-state driven, navigates to questionnaire).
6. Root `CLAUDE.md`: in Key Conventions add one line — `**LLM generation:** Routine generation calls Anthropic (claude-haiku-4-5) directly from the browser with the user's own key (Settings). Provider interface in services/llm/; validation reuses validateRoutineObject with a 2-attempt repair loop.` Update the test-count if it changed.

- [ ] **Step 2: Deprecate the custom-GPT docs**

Create `docs/custom-gpt/DEPRECATED.md`:

```markdown
# Deprecated — replaced by in-app generation (2026-07-06)

The custom-GPT copy/paste flow was removed. Routine generation now happens
in-app via the Anthropic API (see `web/src/services/llm/` and
`docs/superpowers/specs/2026-07-06-llm-routine-generation-design.md`).

Still-relevant files:
- `routine-yaml-contract.md` — the import contract, still enforced by
  `validateRoutineObject` and still the reference for manual YAML import.
- `exercise-catalog-reference.md` — human-readable catalog reference. The
  generation system prompt builds its catalog section from the live DB, so
  this file is informational only.

Historical: `workout-routine-gpt.instructions.md` (superseded by
`web/src/services/llm/system-prompt.ts`), `README.md` setup instructions.
```

- [ ] **Step 3: Final verification**

Run: `npm test`
Expected: PASS.
Run: `npm run lint`
Expected: clean.
Run: `npm run build`
Expected: clean production build (also proves the dynamic-import chunking compiles).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update layer guides for embedded LLM generation; deprecate custom-gpt docs"
```

---

## Post-plan notes for the executor

- **Branching:** create a fresh branch off `main` (e.g. `feat/llm-routine-generation`) before Task 1 — do not stack on `feat/in-gym-hardening`. The spec commit already on that branch can be cherry-picked or the spec re-read from there.
- **Real-key smoke test** is deliberately not a task: the user doesn't have API keys yet. When they do: Settings → AI routine generation → paste key → Test connection → Settings → Create a personalized routine → complete questionnaire → verify a real generation end-to-end.
- **SDK API drift:** if `client.messages.parse` / `zodOutputFormat` / `parsed_output` names differ in the installed SDK version, resolve against `node_modules/@anthropic-ai/sdk` typings — do not guess alternates.

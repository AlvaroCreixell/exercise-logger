# Clipboard-Paste YAML Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clipboard-paste import flow to the app's routine importer so users on Android (and everywhere else) can bring a YAML routine produced by the Ace Logger Routine Maker GPT without relying on Android's unreliable `.yaml` file picker. Keep the existing file-picker path intact as a desktop-friendly fallback.

**Architecture:** Extract a single `validateParseAndImportRoutine(db, yamlText)` helper in the services layer that both the file path and the new paste path call. Add a shadcn-style `Textarea` primitive (we don't have one yet). Extend `RoutineImporter.tsx` with a textarea, an "Import from text" button, and an instructional paragraph with a deep link to the custom GPT. Tests: add one new component test file covering the paste flow (happy path, invalid YAML, empty input) using `fake-indexeddb/auto` for a real DB round-trip; add service-level tests for the new helper.

**Tech Stack:** React 19, TypeScript 5 (strict), shadcn/ui (base-nova) + Tailwind 4, Dexie 4 via `@/db/database`, YAML parsing already wired in `routine-service.ts`, Vitest + React Testing Library + `@testing-library/user-event`, `fake-indexeddb/auto` for DB tests, `sonner` for toasts.

---

## File Structure

- **Create** `web/src/shared/ui/textarea.tsx` — thin wrapper around `<textarea>` styled to match `input.tsx` tokens. One responsibility: styled form primitive.
- **Modify** `web/src/services/routine-service.ts` — append `validateParseAndImportRoutine(db, yamlText)` helper at the end of the file. Centralizes the parse → validate → import → user-result chain so both UI paths are one-liners.
- **Modify** `web/src/features/settings/RoutineImporter.tsx` — add paste state, textarea, "Import from text" button, instructional copy with a link to the GPT, and reuse the new service helper. Keep the existing file-input flow intact but refactor its handler to call the helper too.
- **Create** `web/tests/unit/features/settings/RoutineImporter.test.tsx` — component tests for the paste flow with a real fake-indexeddb DB.
- **Modify** `web/tests/unit/services/routine-service.test.ts` (likely exists — verify in Task 2) — add tests for the new service helper.

Each file has one clear responsibility. The extraction of `validateParseAndImportRoutine` keeps the two UI entry points DRY without adding surface area — the helper is a composition of two already-exported functions.

---

## Task 1 — Add a `Textarea` UI primitive

**Why first:** no upstream dependencies; lets every later task `import { Textarea }` without stubs.

**Files:**
- Create: `web/src/shared/ui/textarea.tsx`

- [ ] **Step 1.1: Create the primitive**

Write this to `web/src/shared/ui/textarea.tsx`:

```tsx
import * as React from "react"

import { cn } from "@/shared/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-w-0 border-[1.5px] border-border-strong bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm font-mono",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

Design notes:
- Mirrors `input.tsx:1-21` token set so light/dark, focus, and invalid states match the rest of the form system.
- `font-mono` because YAML is code — users will appreciate fixed-width alignment when they review their paste.
- No `rows` default: the consumer controls height via `className`/`rows`.

- [ ] **Step 1.2: Verify the TypeScript build is clean**

Run: `npm run lint`
Expected: no errors. If ESLint complains about unused React import, drop it (a bare `import "react"` is fine since the JSX transform runs automatic).

- [ ] **Step 1.3: Commit**

```bash
git add web/src/shared/ui/textarea.tsx
git commit -m "feat(ui): add textarea primitive for multi-line inputs"
```

---

## Task 2 — Add `validateParseAndImportRoutine` service helper (TDD)

**Why next:** both UI flows will call this. Building it before the UI lets us test the logic without DOM/React concerns.

**Files:**
- Modify: `web/src/services/routine-service.ts` (append at end)
- Modify/Create: `web/tests/unit/services/routine-service.test.ts`

- [ ] **Step 2.1: Check whether the test file exists**

Run: `ls web/tests/unit/services/routine-service.test.ts`
Expected: either the file exists or doesn't. If it exists, you'll append tests. If not, create it and import the existing helpers in the standard way (see `backup-service.test.ts` for the `fake-indexeddb/auto` + `ExerciseLoggerDB` template).

If the file doesn't exist, create it with this skeleton:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import type { Exercise } from "@/domain/types";

let db: ExerciseLoggerDB;

async function seedCatalog() {
  const exercises: Exercise[] = [
    {
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["quads", "glutes"],
      source: "catalog",
    },
    {
      id: "bench-press",
      name: "Bench Press",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["chest"],
      source: "catalog",
    },
  ];
  await db.exercises.bulkPut(exercises);
}

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await db.open();
  await initializeSettings(db);
  await seedCatalog();
});

afterEach(async () => {
  await db.delete();
});
```

If the file exists, reuse its existing setup — don't duplicate it.

- [ ] **Step 2.2: Write failing tests for the helper**

Append to `web/tests/unit/services/routine-service.test.ts`:

```ts
import { validateParseAndImportRoutine } from "@/services/routine-service";

describe("validateParseAndImportRoutine", () => {
  const validYaml = `
version: 1
name: Minimal Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [a]
days:
  a:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - reps: [5, 5]
            count: 3
`;

  it("imports a valid routine and returns the name", async () => {
    const result = await validateParseAndImportRoutine(db, validYaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routineName).toBe("Minimal Test");

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0].name).toBe("Minimal Test");
  });

  it("returns validation errors for malformed YAML", async () => {
    const invalid = "this: is: not: valid: yaml: [[[";
    const result = await validateParseAndImportRoutine(db, invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(0);
  });

  it("returns validation errors for schema violations", async () => {
    const missingVersion = `
name: No Version
rest_default_sec: 90
rest_superset_sec: 60
day_order: [a]
days:
  a:
    label: A
    entries: []
`;
    const result = await validateParseAndImportRoutine(db, missingVersion);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("returns an error for empty input", async () => {
    const result = await validateParseAndImportRoutine(db, "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns an error when input is only whitespace", async () => {
    const result = await validateParseAndImportRoutine(db, "   \n\n  ");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2.3: Run tests to confirm they fail**

Run: `npx vitest run web/tests/unit/services/routine-service.test.ts`
Expected: the five new tests fail with an import/resolution error for `validateParseAndImportRoutine` (it doesn't exist yet). Other tests in the file should still pass.

- [ ] **Step 2.4: Implement the helper**

Append to the end of `web/src/services/routine-service.ts`:

```ts
// ---------------------------------------------------------------------------
// Combined validate + import helper for UI entry points
// ---------------------------------------------------------------------------

/** User-facing result of running a YAML import end-to-end. */
export type ImportRoutineResult =
  | { ok: true; routineName: string }
  | { ok: false; errors: string[] };

/**
 * Validate a YAML string, normalize it into a Routine, and import it.
 *
 * Shared entry point for both the file-picker and paste-to-import UI flows.
 * Returns a user-friendly result: `routineName` on success, or an array of
 * `"path: message"` strings on failure.
 */
export async function validateParseAndImportRoutine(
  db: ExerciseLoggerDB,
  yamlText: string
): Promise<ImportRoutineResult> {
  if (!yamlText.trim()) {
    return { ok: false, errors: ["input: YAML is empty"] };
  }

  const exercises = await db.exercises.toArray();
  const lookup = new Map(exercises.map((ex) => [ex.id, ex]));

  const result = validateAndNormalizeRoutine(yamlText, lookup);
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }

  await importRoutine(db, result.routine);
  return { ok: true, routineName: result.routine.name };
}
```

- [ ] **Step 2.5: Run tests to confirm they pass**

Run: `npx vitest run web/tests/unit/services/routine-service.test.ts`
Expected: all tests pass, including the five new ones.

- [ ] **Step 2.6: Commit**

```bash
git add web/src/services/routine-service.ts web/tests/unit/services/routine-service.test.ts
git commit -m "feat(routine-service): add validateParseAndImportRoutine helper"
```

---

## Task 3 — Refactor existing file-input flow to use the helper

**Why:** eliminates near-duplicate logic that would otherwise drift. Gets us clean diffs for Task 4.

**Files:**
- Modify: `web/src/features/settings/RoutineImporter.tsx`

- [ ] **Step 3.1: Run the full test suite to confirm a clean baseline**

Run: `npx vitest run`
Expected: all 426+ tests pass. If any fail, stop and surface before changing anything.

- [ ] **Step 3.2: Replace `handleFile` with a helper-based version**

Replace the current contents of `web/src/features/settings/RoutineImporter.tsx` (74 lines) with this — note: no paste UI yet; that comes in Task 4. This step is a pure refactor with identical behavior:

```tsx
import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { db } from "@/db/database";
import { validateParseAndImportRoutine } from "@/services/routine-service";
import { toast } from "sonner";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function runImport(yamlText: string) {
    setErrors([]);
    setImporting(true);
    try {
      const result = await validateParseAndImportRoutine(db, yamlText);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      toast.success(`Routine "${result.routineName}" imported`);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const yaml = await file.text();
    await runImport(yaml);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? "Importing..." : "Import Routine"}
      </Button>
      {errors.length > 0 && (
        <div className="border border-warning bg-warning-soft p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-warning-foreground">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.3: Run the full test suite again**

Run: `npx vitest run`
Expected: still 426+ passing. Behavior is unchanged — same tests, same results.

- [ ] **Step 3.4: Manual smoke (optional but worth 30 seconds)**

Run: `npm run dev`
Expected: Settings → "Import Routine" opens the native file picker. Picking a valid YAML still works. Picking an invalid YAML still shows the warning box.

- [ ] **Step 3.5: Commit**

```bash
git add web/src/features/settings/RoutineImporter.tsx
git commit -m "refactor(settings): route file import through validateParseAndImportRoutine"
```

---

## Task 4 — Add paste-to-import UI with tests (TDD)

**Why:** the user-facing feature.

**Files:**
- Create: `web/tests/unit/features/settings/RoutineImporter.test.tsx`
- Modify: `web/src/features/settings/RoutineImporter.tsx`

- [ ] **Step 4.1: Write failing component tests**

Create `web/tests/unit/features/settings/RoutineImporter.test.tsx`:

```tsx
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "@/db/database";
import { initializeSettings } from "@/db/database";
import type { Exercise } from "@/domain/types";
import { RoutineImporter } from "@/features/settings/RoutineImporter";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const validYaml = `
version: 1
name: Pasted Routine
rest_default_sec: 90
rest_superset_sec: 60
day_order: [a]
days:
  a:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - reps: [5, 5]
            count: 3
`.trim();

async function seed() {
  const exercises: Exercise[] = [
    {
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["quads", "glutes"],
      source: "catalog",
    },
  ];
  await db.exercises.bulkPut(exercises);
}

beforeEach(async () => {
  await initializeSettings(db);
  await seed();
});

afterEach(async () => {
  cleanup();
  await db.routines.clear();
  await db.exercises.clear();
  await db.settings.clear();
});

describe("RoutineImporter — paste flow", () => {
  it("renders instructional copy with a link to the custom GPT", () => {
    render(<RoutineImporter />);
    const link = screen.getByRole("link", { name: /ace logger routine maker/i });
    expect(link).toHaveAttribute(
      "href",
      "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("imports a valid pasted YAML and persists the routine", async () => {
    const user = userEvent.setup();
    render(<RoutineImporter />);

    const textarea = screen.getByLabelText(/paste yaml/i);
    await user.click(textarea);
    await user.paste(validYaml);

    const button = screen.getByRole("button", { name: /import from text/i });
    await user.click(button);

    await waitFor(async () => {
      const routines = await db.routines.toArray();
      expect(routines).toHaveLength(1);
      expect(routines[0].name).toBe("Pasted Routine");
    });

    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("shows validation errors for malformed YAML and does not import", async () => {
    const user = userEvent.setup();
    render(<RoutineImporter />);

    const textarea = screen.getByLabelText(/paste yaml/i);
    await user.click(textarea);
    await user.paste("not: valid: [[[");

    await user.click(screen.getByRole("button", { name: /import from text/i }));

    await waitFor(() => {
      const warning = screen.getByRole("alert");
      expect(warning).toBeVisible();
      expect(warning.textContent).toMatch(/.+/);
    });

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(0);
  });

  it("disables the import button when the textarea is empty", () => {
    render(<RoutineImporter />);
    const button = screen.getByRole("button", { name: /import from text/i });
    expect(button).toBeDisabled();
  });

  it("keeps the file-picker fallback button visible", () => {
    render(<RoutineImporter />);
    expect(
      screen.getByRole("button", { name: /import from file/i })
    ).toBeVisible();
  });
});
```

- [ ] **Step 4.2: Run the new test file to confirm failures**

Run: `npx vitest run web/tests/unit/features/settings/RoutineImporter.test.tsx`
Expected: all five tests fail (no link, no textarea, wrong button names, etc.).

- [ ] **Step 4.3: Implement the paste UI**

Replace the contents of `web/src/features/settings/RoutineImporter.tsx` with:

```tsx
import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { db } from "@/db/database";
import { validateParseAndImportRoutine } from "@/services/routine-service";
import { toast } from "sonner";

const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";

export function RoutineImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [pastedYaml, setPastedYaml] = useState("");

  async function runImport(yamlText: string): Promise<boolean> {
    setErrors([]);
    setImporting(true);
    try {
      const result = await validateParseAndImportRoutine(db, yamlText);
      if (!result.ok) {
        setErrors(result.errors);
        return false;
      }
      toast.success(`Routine "${result.routineName}" imported`);
      setErrors([]);
      return true;
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
      return false;
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const yaml = await file.text();
    await runImport(yaml);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste() {
    const ok = await runImport(pastedYaml);
    if (ok) setPastedYaml("");
  }

  const canImportPaste = !importing && pastedYaml.trim().length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Go to{" "}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cta underline underline-offset-2 font-medium"
        >
          Ace Logger Routine Maker
        </a>{" "}
        and chat with the GPT about your personalized routine. Copy the YAML
        answer and paste it below.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="routine-yaml-paste"
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Paste YAML
        </label>
        <Textarea
          id="routine-yaml-paste"
          rows={8}
          placeholder="version: 1&#10;name: ..."
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          disabled={importing}
        />
        <Button
          variant="default"
          className="w-full"
          disabled={!canImportPaste}
          onClick={handlePaste}
        >
          {importing ? "Importing..." : "Import from text"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Have a YAML file on your device? Use the file picker instead:
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? "Importing..." : "Import from file"}
        </Button>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="border border-warning bg-warning-soft p-3 space-y-1"
        >
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-warning-foreground">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- The button renamed from "Import Routine" → "Import from file" is intentional; the tests assert the new name. The file flow is now the secondary CTA.
- `role="alert"` on the error box exists so the test can match it without relying on styling classes. This also improves accessibility: screen readers announce validation errors.
- `rel="noopener noreferrer"` is the safe default for `target="_blank"`.

- [ ] **Step 4.4: Run the component test file**

Run: `npx vitest run web/tests/unit/features/settings/RoutineImporter.test.tsx`
Expected: all five tests pass.

- [ ] **Step 4.5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, count is now 426 + 5 (paste tests) + 5 (service tests) = 436.

- [ ] **Step 4.6: Commit**

```bash
git add web/src/features/settings/RoutineImporter.tsx web/tests/unit/features/settings/RoutineImporter.test.tsx
git commit -m "feat(settings): add paste-to-import YAML flow with GPT link"
```

---

## Task 5 — Manual verification

**Why:** the tests cover logic and wiring. This step confirms the UI actually renders well on a phone-sized viewport and the GPT link works.

- [ ] **Step 5.1: Start the dev server**

Run: `npm run dev`
Expected: app on `http://localhost:5173/exercise-logger/`.

- [ ] **Step 5.2: Open DevTools in device-emulation mode (Pixel 7 preset)**

In Chrome: F12 → Toggle device toolbar → select "Pixel 7". Navigate to Settings.

- [ ] **Step 5.3: Verify the new section renders correctly**

Expected:
- Instructional paragraph displays above the textarea with "Ace Logger Routine Maker" styled as a link in CTA color.
- Clicking the link opens a new tab to the GPT URL.
- Textarea is 8 rows tall, monospace font, with placeholder hint.
- "Import from text" button is disabled when textarea is empty, enabled once any non-whitespace character is typed.
- The file-picker flow below is labeled "Import from file" and still works.

- [ ] **Step 5.4: Paste a known-valid YAML**

Copy the contents of `web/data/routines/full-body-4day-mom.yaml` into the textarea and click "Import from text".
Expected:
- Brief "Importing..." state.
- Success toast: `Routine "<name>" imported`.
- Textarea clears.
- Routine appears in the list above.

- [ ] **Step 5.5: Paste invalid YAML**

Clear the textarea and paste: `name: broken` (missing version, no days). Click "Import from text".
Expected: the warning box appears with one or more `path: message` lines. No toast. Routine list unchanged.

- [ ] **Step 5.6: Verify the file-picker fallback still works**

Click "Import from file" and pick a valid YAML file. Expected: same success path as paste.

- [ ] **Step 5.7: Run the lint**

Run: `npm run lint`
Expected: clean.

---

## Task 6 — Final tidy + push-ready commit

- [ ] **Step 6.1: Run the full test suite once more**

Run: `npx vitest run`
Expected: all tests green.

- [ ] **Step 6.2: Run a production build to catch any type-only errors**

Run: `npm run build`
Expected: build succeeds. Note: this also catches any regressions in the PWA manifest / chunking.

- [ ] **Step 6.3: Confirm git state is clean aside from this feature**

Run: `git status`
Expected: only the files listed in the File Structure section should appear. If any incidental files changed, investigate and stash/revert as appropriate.

- [ ] **Step 6.4: Review the diff before pushing**

Run: `git log --oneline main..HEAD`
Expected: 4 feature commits in order:
1. `feat(ui): add textarea primitive for multi-line inputs`
2. `feat(routine-service): add validateParseAndImportRoutine helper`
3. `refactor(settings): route file import through validateParseAndImportRoutine`
4. `feat(settings): add paste-to-import YAML flow with GPT link`

Run: `git diff main..HEAD --stat`
Expected: ~5 files modified/created, net addition around +200 lines (implementation + tests).

- [ ] **Step 6.5 (optional): Push to origin**

Only if the user asks. The user typically reviews local commits before pushing.

```bash
git push
```

---

## Self-Review (completed before handing off)

**Spec coverage check** — every requirement from the user's `/writing-plans` argument:

1. *"Adding a `<textarea>` to RoutineImporter.tsx with a 'Paste YAML' label and an 'Import from text' button"* → Task 4, Step 4.3 (component code with `<label for="routine-yaml-paste">Paste YAML</label>` and `<Button>Import from text</Button>`). **Covered.**

2. *"Wiring it through the existing `validateAndNormalizeRoutine` validator (no new parsing logic needed)"* → Task 2 (new helper composes existing `validateAndNormalizeRoutine` + `importRoutine`). **Covered.**

3. *"Adding instructional copy with a clickable link: 'Go to [Ace Logger Routine Maker](…) and chat with the GPT about your personalized routine. Copy the YAML answer and paste it here.'"* → Task 4, Step 4.3 (the `<p>` block with the link, plus the assertion-backed test in Step 4.1). **Covered.**

4. *"Validating UX: show field-level errors from the validator inline"* → Task 4, Step 4.3 (the `role="alert"` warning box reuses the existing error-list pattern; each error is `path: message` from the validator so the user sees exactly which field failed). **Covered.**

5. *"Tests: unit test for the component's happy path, invalid YAML, and empty input; integration coverage that an imported routine appears in the list afterward"* → Task 2 (service-layer: happy path, malformed YAML, schema violation, empty input, whitespace-only input) + Task 4 (component: link renders, valid YAML imports and persists to DB, malformed YAML shows alert and does not persist, empty textarea disables the button, file fallback still present). **Covered.**

6. *"Keep the existing file-input path as a fallback"* → Task 3 (refactor preserves the flow) + Task 4 (renamed to "Import from file", moved below the paste flow, explicit test asserting it's still visible). **Covered.**

**Placeholder scan:** No "TBD", no "add appropriate error handling", no "similar to Task N" without inline code. Every code block is complete as-written.

**Type consistency check:**
- `validateParseAndImportRoutine(db, yamlText)` signature matches between Task 2 definition and Task 3/4 call sites.
- `ImportRoutineResult` discriminated-union shape (`{ ok: true; routineName: string } | { ok: false; errors: string[] }`) matches between definition and consumer (`result.ok` → `result.routineName` / `result.errors`).
- Component `runImport` now returns `Promise<boolean>` in Task 4 (was `void` in Task 3). This is an intentional change — `handlePaste` needs to know whether to clear the textarea on success. Not a bug; the Task 3 version is obsoleted by Task 4.

**No fictitious APIs:** `db.exercises.toArray()`, `db.routines.toArray()`, `db.routines.clear()`, `validateAndNormalizeRoutine`, `importRoutine`, `initializeSettings`, `ExerciseLoggerDB`, `fake-indexeddb/auto`, `userEvent.paste()`, `role="alert"` — all standard / already used elsewhere in the codebase per the files I read during plan prep.

**Risk notes for the executor:**
- If `npx vitest run` in CI uses `--pool=threads` and the tests mutate the single `db` instance, tests may interfere. The existing test pattern (see `backup-service.test.ts`) uses a new `ExerciseLoggerDB` instance per suite; the component test file uses the singleton `db` from `@/db/database` because the component imports it directly. If flakiness shows up, switch to rendering with a DI context or move the component test to use the singleton with explicit clear + re-seed in `beforeEach`/`afterEach` (which Step 4.1 already does via `cleanup()` + `db.*.clear()`).
- `user.paste()` requires that the target is focused first; the tests do `user.click(textarea)` before `user.paste(...)`. If the paste isn't landing in the textarea, verify focus is on the right element.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-clipboard-paste-yaml-import.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

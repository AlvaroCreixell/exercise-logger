# Sprint 13 — Last Mile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Visual Revamp cycle by fixing the PWA-manifest color bug, scrubbing the remaining Sprint 6 transition debt (`--cta` alias + `.text-hero` back-compat), cleaning up the orphan `ExerciseHistoryScreen` comment, refreshing stale docs + archiving the four untracked sprint plans, strengthening a11y-test coverage (aria-pressed M2, keyboard-nav E2E depth M4), wiring the Android download-and-open YAML flow via PWA `file_handlers` + Launch Queue, and finally running the deferred Sprint 12 Lighthouse + DevTools PWA checklist.

**Architecture:** Single additive sprint on top of `main`. Every task is small and independent — each produces either a green test or a verified bundle change. No new features, no data-model changes, no routing additions (only a stale comment edit on the existing orphan route). `file_handlers` + Launch Queue are the only net-new capability and stay gated behind PWA install — paste-YAML flow is unchanged.

**Tech Stack:** React 19 + TypeScript 5, Tailwind v4, Vitest + RTL, Playwright, vite-plugin-pwa (Workbox `generateSW`), Launch Queue API (`launchQueue`).

**Branch / worktree:**
- Worktree: `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`
- Branch: `sprint-13-last-mile`

---

## Context and scope

### Source-of-truth inputs
- Audit report surfaced against `main` tip `ddf7843` (Sprint 12 + 12.1 squash-merge).
- Spec: `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §5 (permanently deferred — must NOT be absorbed) and §3 Sprint 12 (Lighthouse + a11y bullets never fully completed).
- Sprint 11.6/12.1 out-of-scope carry-overs: `docs/superpowers/plans/2026-04-21-sprint11.6-sprint12.1-finalize.md:1125-1129` (Lighthouse, M1/M2/M4/M5).

### Findings addressed (traceability table)

| # | Category | Severity | Target | Task |
|---|---|---|---|---|
| 1 | Bug | User-visible | `vite.config.ts:45-46` dark manifest `theme_color` + `background_color` | Task 2 |
| 2 | Doc drift | Minor | `CLAUDE.md:39` test count `731` → `735` | Task 6 |
| 3 | Doc drift | Minor | `App.tsx:138` stale "Sprint 12 reintroduces navigation" | Task 5 |
| 4 | Doc drift | Minor | `services/CLAUDE.md` missing `importAndActivateRoutine` | Task 6 |
| 5 | Transition debt | Cleanup | `App.css:118-121` `--cta` alias + 6 primitive files still using `ring-cta/30` | Task 3 |
| 6 | Transition debt | Cleanup | `App.css:247-250` `.text-hero` back-compat + `Stat size="hero"` dead variant | Task 4 |
| 7 | Sprint 12 deferred | Audit | Lighthouse + DevTools PWA checklist (Task 12 carry-over) | Task 10 |
| 8 | Sprint 12 M2 | Minor a11y | Strengthen `aria-pressed` tests on toggling buttons (PrToggle, UnitsToggle, ValueBox) | Task 7 |
| 9 | Sprint 12 M4 | Minor a11y | Deepen `a11y-keyboard.spec.ts` — currently 12 lines / bottom-nav only | Task 8 |
| 10 | User memory | Real bug | Android download-and-open YAML flow broken (no `file_handlers` in manifest) | Task 9 |
| 11 | Git hygiene | — | 4 untracked plan docs under `docs/superpowers/plans/` | Task 1 |

### Explicitly out of scope (reject if tempted)

- **Spec §5 deferred items** — superset UI, PR auto-detection, streak refactor, session editing, timer UI, dark mode, density/accent/numeralStyle toggles, name personalisation, target time on hero card, keypad for duration/distance. Do NOT absorb.
- **Sprint 12 review minor M1** ("icon render depth") — signal too low; addressable in a future cleanup pass.
- **Sprint 12 review minor M5** ("unit handoff non-issue") — explicitly not-a-bug.
- **PWA `share_target`** — distinct from `file_handlers` (sibling API for "Share to app" from other apps); adds complexity (SW POST interception); file_handlers alone solves the broken Android flow. Surface as a follow-up if the user asks later.
- **Wiring the `/history/exercise/:exerciseId` orphan into in-app navigation** — that's a feature (exercise history tap-through), out of cleanup scope. Task 5 only updates the stale comment to reflect reality.
- **iOS `file_handlers`** — Safari doesn't support it yet; no-op on iOS. Paste-YAML stays the universal fallback.

### Baseline

From `main`:
- Vitest: **735** passing (66 files)
- Playwright: **11** passing
- Lint: clean
- Build: 920.74 KiB precache, 44 entries
- No `lucide-react` in `web/src`, `web/tests`, or `web/package.json`

Each task's expected delta is listed under Cross-cutting notes at the end. Total projected final count: **~742 Vitest + ~13 Playwright**.

---

## Preflight

- [ ] **Step 0.1: Confirm main is at the expected tip**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger" log --oneline -3
```
Expected top commit: `ddf7843 Sprint 12 + 12.1: Closing Notes — pickers, celebration, a11y, PWA wrap`. If anything else, STOP and check.

- [ ] **Step 0.2: Create the Sprint 13 worktree**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger" worktree add "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" -b sprint-13-last-mile main
git -C "C:/Users/creix/VSC Projects/exercise_logger" worktree list
```
Expected: two worktrees (main + sprint-13-last-mile).

- [ ] **Step 0.3: Baseline CI from the new worktree**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm install --no-audit --no-fund && npm test -- --run && npm run lint && npm run build
```
Expected: Vitest reports `Tests 735 passed (735)`, lint clean, build succeeds.

Record the baseline Vitest count as `N_BASELINE = 735`.

---

## Task 1: Commit the four untracked plan docs

These already exist on disk; git just never tracked them. Pattern matches commit `8b42f59 docs(plans): archive Sprint 9/10 and review-response implementation plans`.

**Files:**
- Add to index: `docs/superpowers/plans/2026-04-20-sprint11-setlogsheet-keypad.md`
- Add to index: `docs/superpowers/plans/2026-04-20-sprint11.5-review-response.md`
- Add to index: `docs/superpowers/plans/2026-04-20-sprint12-closing-notes.md`
- Add to index: `docs/superpowers/plans/2026-04-21-sprint11.6-sprint12.1-finalize.md`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

- [ ] **Step 1.1: Verify the files exist and are untracked**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" status --short docs/superpowers/plans
```
Expected output (order may vary):
```
?? docs/superpowers/plans/2026-04-20-sprint11-setlogsheet-keypad.md
?? docs/superpowers/plans/2026-04-20-sprint11.5-review-response.md
?? docs/superpowers/plans/2026-04-20-sprint12-closing-notes.md
?? docs/superpowers/plans/2026-04-21-sprint11.6-sprint12.1-finalize.md
```

- [ ] **Step 1.2: Stage and commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add docs/superpowers/plans/2026-04-20-sprint11-setlogsheet-keypad.md docs/superpowers/plans/2026-04-20-sprint11.5-review-response.md docs/superpowers/plans/2026-04-20-sprint12-closing-notes.md docs/superpowers/plans/2026-04-21-sprint11.6-sprint12.1-finalize.md
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "docs(plans): archive Sprint 11/11.5/12/11.6+12.1 plans

Four plan docs were left untracked after the squash-merges shipped
(ddf7843 + 533b4be). Mirrors the 8b42f59 archive pattern for
Sprint 9/10 plans."
```

Expected: single commit, 4 new files.

- [ ] **Step 1.3: Verify working tree clean**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" status
```
Expected: `nothing to commit, working tree clean`.

---

## Task 2: Fix the PWA manifest color bug

`vite.config.ts:45-46` still has dark-era values. When the app is installed on Android (or iOS via "Add to Home Screen"), the OS uses these for the splash screen + task switcher chrome — producing dark-on-dark against the warm paper app. The `<meta name="theme-color">` at `web/index.html:6` was updated in Sprint 6 to `#FCFAF5`; the manifest was missed.

**Files:**
- Modify: `web/vite.config.ts`
- Modify: `web/tests/unit/app/manifest-theme.test.ts` (create)

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 2.1: Write the failing test**

Create `web/tests/unit/app/manifest-theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA manifest theme colors", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../vite.config.ts"),
    "utf8",
  );

  it("theme_color matches the warm-paper meta theme-color in index.html", () => {
    const indexHtml = readFileSync(
      resolve(__dirname, "../../../index.html"),
      "utf8",
    );
    const meta = indexHtml.match(/name="theme-color"\s+content="([^"]+)"/);
    expect(meta?.[1]).toBe("#FCFAF5");
    expect(source).toMatch(/theme_color:\s*"#FCFAF5"/);
  });

  it("background_color matches the paper tone (warm paper)", () => {
    // Same hex as theme_color; the OS uses background_color for the splash
    // card under the icon while the PWA boots.
    expect(source).toMatch(/background_color:\s*"#FCFAF5"/);
  });
});
```

Match the test-file naming pattern already in use under `web/tests/unit/app/` if any tests live there; otherwise put it at `web/tests/unit/app/manifest-theme.test.ts` as shown.

- [ ] **Step 2.2: Run to confirm failure**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run tests/unit/app/manifest-theme.test.ts
```
Expected: FAIL — both assertions see `#09090b`.

- [ ] **Step 2.3: Apply the fix**

Edit `web/vite.config.ts`. Find lines 45-46:
```ts
        theme_color: "#09090b",
        background_color: "#09090b",
```
Replace with:
```ts
        theme_color: "#FCFAF5",
        background_color: "#FCFAF5",
```

Matches the `<meta name="theme-color">` in `index.html:6` and the warm-paper `--paper` oklch token resolved to sRGB (`#FCFAF5`) during Sprint 6 planning.

- [ ] **Step 2.4: Run test to confirm pass**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run tests/unit/app/manifest-theme.test.ts
```
Expected: both assertions pass.

- [ ] **Step 2.5: Rebuild and inspect generated manifest**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm run build 2>&1 | tail -5
```

```bash
grep -E "theme_color|background_color" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/dist/manifest.webmanifest"
```
Expected: both show `"#FCFAF5"`.

- [ ] **Step 2.6: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/vite.config.ts web/tests/unit/app/manifest-theme.test.ts
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "fix(pwa): warm-paper theme_color + background_color on manifest

Sprint 6 updated index.html's <meta name=\"theme-color\"> but missed
the generateSW manifest. On install, Android used the dark #09090b
for the splash card + task-switcher chrome, clashing with the warm
paper app. Bring both into alignment with the meta value."
```

---

## Task 3: Remove the `--cta` transition alias + swap primitives to `sage`

`App.css:118-121` has a transition alias dating to Sprint 6 ("Remove in Task 17 once all direct cta classnames are gone"). Six files still reference `cta` classnames (resolving to sage via the alias but bypassing the Sprint 12 focus-ring audit, which targeted `ring-sage/40`). This task removes the alias and migrates the classnames.

**Files:**
- Modify: `web/src/app/App.css`
- Modify: `web/src/shared/components/Pill.tsx`
- Modify: `web/src/shared/ui/input.tsx`
- Modify: `web/src/shared/ui/textarea.tsx`
- Modify: `web/src/shared/ui/badge.tsx`
- Modify: `web/src/shared/ui/scroll-area.tsx`
- Modify: `web/src/shared/ui/tabs.tsx`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 3.1: Inventory every `cta` reference**

```bash
grep -rn "bg-cta\|border-cta\|ring-cta\|text-cta\|focus-visible:border-cta\|focus-visible:ring-cta\|color-cta\|--cta" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" | sort
```
Expected: 12-14 hits across `App.css` (3 — the `--color-cta` mapping line, the alias comment, and the alias itself), `Pill.tsx` (1), `input.tsx` (1), `textarea.tsx` (1), `badge.tsx` (1), `scroll-area.tsx` (1), `tabs.tsx` (1+). Record the exact list — every non-App.css hit must be migrated in Step 3.3.

- [ ] **Step 3.2: Swap `Pill.tsx` `bg-cta` → `bg-sage`**

Edit `web/src/shared/components/Pill.tsx:34`. Find:
```tsx
className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cta"
```
Replace with:
```tsx
className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sage"
```

- [ ] **Step 3.3: Swap the five shadcn primitives**

For each of these files, find every `focus-visible:border-cta` → `focus-visible:border-sage` and `focus-visible:ring-cta/30` → `focus-visible:ring-sage/40`:

- `web/src/shared/ui/input.tsx`
- `web/src/shared/ui/textarea.tsx`
- `web/src/shared/ui/badge.tsx`
- `web/src/shared/ui/scroll-area.tsx`
- `web/src/shared/ui/tabs.tsx`

`ring-sage/40` is the alpha the Sprint 12 a11y audit standardised on (see `button.tsx` + `Keypad.tsx`). Sticking at `/30` perpetuates the old strength; `/40` matches the rest of the codebase.

Concrete example for `input.tsx` — find:
```tsx
"... focus-visible:border-cta focus-visible:ring-cta/30 ..."
```
Replace with:
```tsx
"... focus-visible:border-sage focus-visible:ring-sage/40 ..."
```

Do the same edit in the four sibling files. Only classnames change — no structural edits.

- [ ] **Step 3.4: Remove the `--cta` alias and `--color-cta` mapping**

Edit `web/src/app/App.css`.

Find line 30:
```css
    --color-cta: var(--cta);
```
Delete the whole line.

Find lines 118-121:
```css
    /* Transition alias: keeps pre-Sprint-6 `bg-cta` / `border-cta` /
       `ring-cta/30` utilities resolving during the per-screen migration.
       Remove in Task 17 once all direct cta classnames are gone. */
    --cta: var(--sage);
```
Delete all four lines (the comment block + the `--cta` declaration).

- [ ] **Step 3.5: Confirm no `cta` references remain**

```bash
grep -rn "cta" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" | grep -v "effectiveType\|octal\|locator\|inactive\|active" || echo "CLEAN"
```
(The grep's `-v` filter removes false positives on words *containing* `cta` substrings like `effectiveType`, `inactive`, `locator`.)

Expected: `CLEAN`. If any hit remains, fix it.

- [ ] **Step 3.6: Smoke the unit suite**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run 2>&1 | tail -5
```
Expected: still 735 passing (no test touches the swapped classnames directly — they are visual only).

If any test fails because it asserts on `ring-cta` in a snapshot, update the snapshot. Classname sweeps do not create behavioural regressions — only visual.

- [ ] **Step 3.7: Lint + build**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm run lint && npm run build 2>&1 | tail -3
```
Expected: both green.

- [ ] **Step 3.8: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/src/app/App.css web/src/shared/components/Pill.tsx web/src/shared/ui/input.tsx web/src/shared/ui/textarea.tsx web/src/shared/ui/badge.tsx web/src/shared/ui/scroll-area.tsx web/src/shared/ui/tabs.tsx
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "refactor(tokens): drop --cta alias, migrate primitives to sage

Sprint 6 left a --cta transition alias (-> sage) and six primitives
still referenced cta classnames. The alias's own comment flagged
itself for removal. Migrate Pill + five shadcn primitives to
bg-sage / border-sage / ring-sage/40 — matching the focus-ring
strength the Sprint 12 a11y audit standardised on. No behavioural
change; visual output is identical."
```

---

## Task 4: Remove `.text-hero` back-compat + `Stat size="hero"` dead variant

`App.css:247-250` has a `.text-hero` back-compat utility flagged "Delete in Sprint 7 once Today migrates" — never removed. The only consumers are `shared/components/Stat.tsx:19` (the `hero` size variant) and `shared/lib/utils.ts:17` (tailwind-merge safelist). Verified via grep that no `<Stat size="hero">` callsite exists in the codebase.

**Files:**
- Modify: `web/src/app/App.css`
- Modify: `web/src/shared/components/Stat.tsx`
- Modify: `web/src/shared/lib/utils.ts`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 4.1: Confirm no `Stat size="hero"` callsite exists**

```bash
grep -rn 'size="hero"\|size={"hero"}\|size={[\x27"]hero[\x27"]}' "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" || echo "CLEAN"
```
Expected: `CLEAN`. If any callsite exists, STOP — this task's premise is wrong; migrate the callsite to `text-hero-serif` (or `text-value` for numeric heroes) before deleting the variant.

- [ ] **Step 4.2: Remove the `hero` case from `Stat`**

Edit `web/src/shared/components/Stat.tsx`.

Find line 4:
```ts
export type StatSize = "sm" | "md" | "lg" | "hero";
```
Replace with:
```ts
export type StatSize = "sm" | "md" | "lg";
```

Find lines 15-20 (the `VALUE_CLASS` record):
```ts
const VALUE_CLASS: Record<StatSize, string> = {
  sm: "text-value-sm",
  md: "text-value",
  lg: "text-value",
  hero: "text-hero",
};
```
Replace with:
```ts
const VALUE_CLASS: Record<StatSize, string> = {
  sm: "text-value-sm",
  md: "text-value",
  lg: "text-value",
};
```

Find lines 22-27 (the `LABEL_CLASS` record) and remove the `hero: "text-eyebrow text-ink-3"` entry the same way — the record's keys must match `StatSize` exactly or TypeScript will reject.

- [ ] **Step 4.3: Remove `text-hero` from the tailwind-merge safelist**

Edit `web/src/shared/lib/utils.ts:17`. Find the `"text-hero",` line inside the `font-size` class group array and delete it.

- [ ] **Step 4.4: Remove the `.text-hero` utility + the stale paragraph in App.css**

Edit `web/src/app/App.css`.

Find lines 247-~258 (the back-compat `.text-hero` rule and its comment). The exact span varies with the rule body — read around the comment "Back-compat alias — pre-Sprint-6 screens still reference .text-hero" and delete the comment PLUS the full `.text-hero { ... }` block that follows, up to and including its closing brace.

Also edit App.css:31-35 — the paragraph comment at lines 31-35 mentions `.text-hero` as a back-compat target. Update the prose to drop the `.text-hero` reference. Before:
```css
    /* Body + heading both use Inter. Serif is reserved for explicit opt-in
       via .text-hero-serif / .text-title-serif (History / Settings page labels,
       italic name in Today greeting). This keeps every existing
       `font-heading` / `.text-hero` call site rendering as bold sans,
       matching the handoff screenshots — serif is not a global heading face. */
```
After:
```css
    /* Body + heading both use Inter. Serif is reserved for explicit opt-in
       via .text-hero-serif / .text-title-serif (History / Settings page labels,
       italic name in Today greeting). Serif is not a global heading face. */
```

- [ ] **Step 4.5: Confirm no `text-hero` (without `-serif`) references remain**

```bash
grep -rn "text-hero[^-]\|text-hero$\|\\.text-hero\\b" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/tests" || echo "CLEAN"
```
Expected: `CLEAN`. `text-hero-serif` references MUST remain (different utility).

- [ ] **Step 4.6: Unit + build**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run 2>&1 | tail -5 && npm run build 2>&1 | tail -3
```
Expected: tests still at 735, build still green. Build should be slightly smaller (one fewer utility class in the final CSS).

- [ ] **Step 4.7: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/src/app/App.css web/src/shared/components/Stat.tsx web/src/shared/lib/utils.ts
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "chore(tokens): drop .text-hero back-compat + Stat hero variant

The .text-hero utility was flagged for removal in Sprint 7 (never
deleted), and the Stat \"hero\" size variant it supported has zero
callsites. Drop the CSS rule, the safelist entry, and the type/record
branches. Serif hero remains available via .text-hero-serif."
```

---

## Task 5: Update the stale route comment for the orphan `ExerciseHistoryScreen`

`App.tsx:138` claims "Sprint 12 reintroduces navigation" — factually wrong; Sprint 12 did not. The Sprint 12 plan itself documents this as deferred to a `feature/exercise-history-navigation` branch (see `2026-04-20-sprint12-closing-notes.md:1902-1903`). Fix the comment to describe reality. Keep the route + component in place (tests depend on `useExerciseHistoryGroups`; the 3.78 kB chunk is lazy-loaded so it only ships when navigated to, and today nothing navigates to it — the overhead is negligible).

**Files:**
- Modify: `web/src/app/App.tsx`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 5.1: Apply the fix**

Edit `web/src/app/App.tsx:138`. Find:
```tsx
          {/* Orphaned as of Sprint 8 — no in-app link; Sprint 12 reintroduces navigation. */}
```
Replace with:
```tsx
          {/* Orphan route: no in-app link drives here. Kept for the planned
              exercise-history-navigation feature; remove if abandoned. */}
```

- [ ] **Step 5.2: Lint + build**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm run lint && npm run build 2>&1 | tail -3
```
Expected: both green.

- [ ] **Step 5.3: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/src/app/App.tsx
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "docs(app): accurate comment on orphan ExerciseHistoryScreen route

Sprint 12 did not reintroduce this navigation (the Sprint 12 plan
itself deferred it to a follow-up feature branch). Correct the
comment so future-us doesn't grep it and get misled."
```

---

## Task 6: Refresh CLAUDE.md test count + services doc

`CLAUDE.md:39` says `731`; actual is `735` (post-Sprint 13 may rise further — update AT THE END of the sprint, or leave as a reminder and batch with Task 11). `services/CLAUDE.md` lists the old `importRoutine` but not the Sprint 9–era `importAndActivateRoutine`.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `web/src/services/CLAUDE.md`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 6.1: Update root `CLAUDE.md` test count (provisional)**

Edit `CLAUDE.md:39`. Find:
```
npm test              # 731 unit+integration tests (Vitest)
```
Replace with (to be re-updated in Task 11 once all new tests in Sprint 13 have been counted):
```
npm test              # 735 unit+integration tests (Vitest)
```

If executing this sprint linearly, you can defer this step to Task 11 so the number reflects the post-Sprint-13 final. Either is fine; Task 11 explicitly verifies.

- [ ] **Step 6.2: Update `services/CLAUDE.md` with `importAndActivateRoutine`**

Edit `web/src/services/CLAUDE.md`. Find the `routine-service.ts` paragraph:

```markdown
### `routine-service.ts` — YAML validation and normalization

- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `Promise<{ ok, routine } | { ok, errors }>` — async (dynamic-imports yaml to keep the ~50kB library out of the main bundle). 11 validation rules, deterministic entryId/groupId generation, all errors collected with field paths.
- `importRoutine(db, routine)` — Simple `db.routines.put`.
```

Replace with:

```markdown
### `routine-service.ts` — YAML validation and normalization

- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `Promise<{ ok, routine } | { ok, errors }>` — async (dynamic-imports yaml to keep the ~50kB library out of the main bundle). 11 validation rules, deterministic entryId/groupId generation, all errors collected with field paths.
- `importRoutine(db, routine)` — Simple `db.routines.put` (low-level; no settings mutation).
- `importAndActivateRoutine(db, routine)` → `Promise<{ ok: true } | { ok: false, message: string }>` — Transactional: blocks with a message when a session is active (invariant 10), otherwise puts the routine and sets it as the active routine in one `rw` transaction. Used by the Settings Import screen.
```

- [ ] **Step 6.3: Verify the docs match reality**

```bash
grep -n "importAndActivateRoutine\|importRoutine" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src/services/routine-service.ts"
```
Expected: both functions exported. If `importAndActivateRoutine` isn't present, STOP — Sprint 9 PR#12 review was supposed to land it; investigate.

- [ ] **Step 6.4: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add CLAUDE.md web/src/services/CLAUDE.md
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "docs: refresh test count + document importAndActivateRoutine

CLAUDE.md had the pre-Sprint-11 test count. services/CLAUDE.md
never got the importAndActivateRoutine entry added in Sprint 9's
PR#12 review response. Both are now accurate as of main."
```

---

## Task 7: Strengthen `aria-pressed` tests on toggling buttons (M2)

Three toggling controls ship an `aria-pressed` attribute: `PrToggle` (value ↔ PR marked), `UnitsToggle` (kg/lb), and `ValueBox` tile (active field). Current tests assert `data-active="true"` or direct state; they don't cover the a11y attribute that screen readers consume. M2's ask: assert both states explicitly on all three.

**Files:**
- Modify: `web/tests/unit/features/workout/PrToggle.test.tsx` (or create if missing — check first)
- Modify: `web/tests/unit/features/settings/UnitsToggle.test.tsx` (or create if missing)
- Modify: `web/tests/unit/features/workout/ValueBox.test.tsx`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 7.1: Read the existing test files**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/tests/unit/features/workout/" | grep -E "PrToggle|ValueBox"
ls "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/tests/unit/features/settings/" | grep -E "UnitsToggle"
```

Record which test files exist. For any missing file, the step below creates it; for existing files, add the new tests alongside the existing describe block.

- [ ] **Step 7.2: Write the failing `PrToggle` test**

Add inside the existing describe block in `web/tests/unit/features/workout/PrToggle.test.tsx` (create the file if it doesn't exist, matching the file-header style of a sibling like `ValueBox.test.tsx`):

```tsx
it("exposes aria-pressed accurately in both states", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [v, setV] = useState(false);
    return <PrToggle value={v} onChange={setV} />;
  }
  render(<Harness />);
  const btn = screen.getByRole("button", { name: /mark pr/i });
  expect(btn.getAttribute("aria-pressed")).toBe("false");
  await user.click(btn);
  // After the toggle, the button's accessible name changes to "PR ✓"
  const btnAfter = screen.getByRole("button", { name: /pr/i });
  expect(btnAfter.getAttribute("aria-pressed")).toBe("true");
  await user.click(btnAfter);
  expect(screen.getByRole("button", { name: /mark pr/i }).getAttribute("aria-pressed")).toBe("false");
});
```

Make sure `useState` is imported from `react` and `render`/`screen` from `@testing-library/react` at the top of the file. Wrap the harness in a local `function` to avoid needing a separate state-management library in the test.

- [ ] **Step 7.3: Write the failing `UnitsToggle` test**

Add inside the existing describe block in `web/tests/unit/features/settings/UnitsToggle.test.tsx` (create the file if missing):

```tsx
it("exposes aria-pressed on exactly the selected pill", () => {
  const { rerender } = render(
    <UnitsToggle value="kg" onChange={() => {}} />,
  );
  const kg = screen.getByRole("button", { name: /kg/i });
  const lb = screen.getByRole("button", { name: /lb/i });
  expect(kg.getAttribute("aria-pressed")).toBe("true");
  expect(lb.getAttribute("aria-pressed")).toBe("false");
  rerender(<UnitsToggle value="lb" onChange={() => {}} />);
  expect(screen.getByRole("button", { name: /kg/i }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: /lb/i }).getAttribute("aria-pressed")).toBe("true");
});
```

If the existing `UnitsToggle` tests already import `render`, `screen` at the file top, reuse that; otherwise add imports.

- [ ] **Step 7.4: Write the failing `ValueBox` tile test**

Add inside the existing describe block in `web/tests/unit/features/workout/ValueBox.test.tsx`:

```tsx
it("exposes aria-pressed on the tile matching the isActive prop", () => {
  const { rerender } = render(
    <ValueBox
      label="Weight"
      value="80"
      unit="kg"
      isActive={true}
      onFocus={() => {}}
      onNudgeDown={() => {}}
      onNudgeUp={() => {}}
    />,
  );
  let tile = screen.getByRole("button", { name: /weight value/i });
  expect(tile.getAttribute("aria-pressed")).toBe("true");
  rerender(
    <ValueBox
      label="Weight"
      value="80"
      unit="kg"
      isActive={false}
      onFocus={() => {}}
      onNudgeDown={() => {}}
      onNudgeUp={() => {}}
    />,
  );
  tile = screen.getByRole("button", { name: /weight value/i });
  expect(tile.getAttribute("aria-pressed")).toBe("false");
});
```

- [ ] **Step 7.5: Run the three test files to confirm the new assertions pass**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run tests/unit/features/workout/PrToggle.test.tsx tests/unit/features/workout/ValueBox.test.tsx tests/unit/features/settings/UnitsToggle.test.tsx
```
Expected: all three files green. Each of the three new `aria-pressed` tests passes because the components already ship correct `aria-pressed` wiring — the point is to lock that behaviour down with a test.

If any of the new tests fails, either (a) the component is missing `aria-pressed` on one branch (fix the component), or (b) the test asserts against the wrong accessible name (fix the regex).

- [ ] **Step 7.6: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/tests/unit/features/workout/PrToggle.test.tsx web/tests/unit/features/workout/ValueBox.test.tsx web/tests/unit/features/settings/UnitsToggle.test.tsx
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "test(a11y): aria-pressed coverage on PrToggle, UnitsToggle, ValueBox

Sprint 12 review M2 — previous tests asserted visual state
(data-active, classname) but not the aria-pressed that screen readers
actually consume. Lock both states for each toggle in place."
```

---

## Task 8: Deepen the keyboard-nav E2E (M4)

`web/tests/e2e/a11y-keyboard.spec.ts` is 12 lines — it checks bottom-nav is present and that pressing Tab focuses *something*. M4's ask: deepen. Specifically cover (a) tab-through cycle through all four bottom-nav links and arrive back on body content, (b) tab-through the Settings screen hits the main controls, (c) SetLogSheet keypad keyboard input works (the Sprint 12 manual smoke spec already implies this — formalise).

**Files:**
- Modify: `web/tests/e2e/a11y-keyboard.spec.ts`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 8.1: Replace the spec with a richer set of cases**

Edit `web/tests/e2e/a11y-keyboard.spec.ts` — replace the whole file contents with:

```ts
import { test, expect } from "@playwright/test";

test.describe("Keyboard navigation", () => {
  test("bottom nav exposes all four tabs as keyboard-reachable links", async ({
    page,
  }) => {
    await page.goto("/exercise-logger/");
    const tabs = ["Today", "Workout", "History", "Settings"];
    for (const name of tabs) {
      const link = page.getByRole("link", { name });
      await expect(link).toBeVisible();
    }
    // Tab repeatedly and collect the accessible names of focused elements
    // until we land on the Settings link or exhaust a reasonable budget.
    const seen = new Set<string>();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "";
        return (
          el.getAttribute("aria-label") ??
          el.textContent?.trim() ??
          el.tagName.toLowerCase()
        );
      });
      if (active) seen.add(active);
      if (active.toLowerCase().includes("settings")) break;
    }
    // We don't pin the exact order — only that every nav label was reached.
    for (const name of tabs) {
      expect(Array.from(seen).some((s) => s.toLowerCase().includes(name.toLowerCase()))).toBe(true);
    }
  });

  test("settings screen is keyboard-reachable from the bottom nav", async ({
    page,
  }) => {
    await page.goto("/exercise-logger/");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    // The Units toggle is a central Settings control — confirm keyboard focus
    // lands on one of the kg / lb pills via Tab.
    let focusedText = "";
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      focusedText = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.textContent?.trim() ?? "";
      });
      if (/^(kg|lb|lbs)$/i.test(focusedText)) break;
    }
    expect(focusedText).toMatch(/^(kg|lb|lbs)$/i);
  });

  test("import-routine textarea is keyboard-focusable", async ({ page }) => {
    await page.goto("/exercise-logger/settings/import");
    await expect(
      page.getByRole("heading", { name: /import routine/i }),
    ).toBeVisible();
    const ta = page.getByLabel(/paste yaml/i);
    await ta.focus();
    await ta.type("version: 1\n");
    expect(await ta.inputValue()).toContain("version: 1");
  });
});
```

The three sub-tests cover: (a) all four bottom-nav links are reached via Tab, (b) Settings screen's main control is reachable, (c) Import routine textarea takes keyboard input. No reliance on the SetLogSheet keypad (that has dedicated unit-level coverage in `SetLogSheet.test.tsx`).

- [ ] **Step 8.2: Run the spec**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm run test:e2e -- a11y-keyboard
```
Expected: 3 tests pass. If any flakes on a tab budget, bump the loop bound (15 → 25 for nav, 30 → 50 for settings) before escalating — the UI may have more focusable elements than estimated.

- [ ] **Step 8.3: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/tests/e2e/a11y-keyboard.spec.ts
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "test(e2e): deepen keyboard-nav coverage (M4)

Previous spec only asserted that Tab focused something on the Today
screen. Extend to three cases: bottom nav reaches all four tabs,
Settings screen exposes the Units pill to keyboard, and the Import
routine textarea accepts keyboard input."
```

---

## Task 9: Wire the Android download-and-open YAML flow via `file_handlers` + Launch Queue

Adds a client-side handler so that when a user downloads a `.yaml` / `.yml` file on Android Chrome (the ChatGPT → download → open flow the user flagged as broken in memory), the OS offers the installed PWA as an opener. On selection, the app launches at a dedicated route, reads the file, and populates the Import Routine screen. iOS and older browsers are unaffected (feature-detect `launchQueue` on `window`).

**Files:**
- Modify: `web/vite.config.ts` — add `file_handlers` to manifest
- Create: `web/src/shared/hooks/useRoutineLaunchQueue.ts` — feature-detect + read file → route with state
- Modify: `web/src/app/App.tsx` — wire the hook in one place, near the other `useEffect` bootstrapping
- Modify: `web/src/features/settings/RoutineImportScreen.tsx` — accept incoming YAML via router state
- Create: `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 9.1: Add the `file_handlers` manifest entry**

Edit `web/vite.config.ts`. Inside the `manifest` object (after the `icons` array, before the closing `}`), add:

```ts
        file_handlers: [
          {
            action: "/exercise-logger/settings/import",
            accept: {
              "text/yaml": [".yaml", ".yml"],
              "text/x-yaml": [".yaml", ".yml"],
              "application/x-yaml": [".yaml", ".yml"],
              "text/plain": [".yaml", ".yml"],
            },
          },
        ],
```

(The MIME variations are to maximise Android-browser compatibility; different versions advertise different types for the same extension.)

- [ ] **Step 9.2: Create the Launch Queue hook**

Create `web/src/shared/hooks/useRoutineLaunchQueue.ts`:

```ts
import { useEffect } from "react";
import { useNavigate } from "react-router";

// The Launch Queue API is a File System Access-adjacent surface; it ships on
// Chromium-based browsers (Android Chrome, desktop Chrome/Edge) and is absent
// on Safari/Firefox. Feature-detect before touching.
interface LaunchParams {
  files: ReadonlyArray<FileSystemHandle>;
}

interface LaunchConsumer {
  (params: LaunchParams): Promise<void> | void;
}

interface LaunchQueueLike {
  setConsumer(consumer: LaunchConsumer): void;
}

/**
 * When the app is invoked via `file_handlers` (user opens a .yaml/.yml file
 * with the installed PWA), read the first file and hand the contents to the
 * Import Routine screen via router state.
 */
export function useRoutineLaunchQueue(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const w = window as unknown as { launchQueue?: LaunchQueueLike };
    if (!w.launchQueue) return;

    w.launchQueue.setConsumer(async (params) => {
      if (!params.files || params.files.length === 0) return;
      const handle = params.files[0];
      if (!handle || handle.kind !== "file") return;
      try {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        navigate("/settings/import", { state: { launchYaml: text } });
      } catch {
        // Silent fail — the hook is a best-effort enhancement; the paste flow
        // remains the guaranteed path. Surface errors through the import
        // screen's normal error affordances if/when the user retries.
      }
    });
  }, [navigate]);
}
```

- [ ] **Step 9.3: Wire the hook in `App.tsx`**

Edit `web/src/app/App.tsx`. Find the `AppRoutes` function (around lines 100-130, just before the `if (!ready)` return). Add:

```tsx
import { useRoutineLaunchQueue } from "@/shared/hooks/useRoutineLaunchQueue";
```

near the other shared-hook imports at the top of the file, then inside `AppRoutes` add a call:

```tsx
function AppRoutes() {
  const ready = useAppInit();  // existing line (or similar)
  useRoutineLaunchQueue();      // <-- add this

  if (!ready) {
    return <LoadingState fullscreen />;
  }
  // ... rest unchanged
}
```

Read the existing function carefully and slot the call next to the other top-level side-effect hooks — the exact identifier before `ready` may differ.

- [ ] **Step 9.4: Accept launched YAML in the Import screen**

Edit `web/src/features/settings/RoutineImportScreen.tsx`. Add imports:

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router";
```

(if not already imported — the file currently imports `Link, useNavigate` from `react-router`, extend that line to include `useLocation`.)

Inside the component body, between the state declarations and the `runImport` function, add:

```tsx
const location = useLocation();
useEffect(() => {
  const state = location.state as { launchYaml?: string } | null;
  if (state?.launchYaml && !pastedYaml) {
    setPastedYaml(state.launchYaml);
  }
}, [location.state, pastedYaml]);
```

This pre-fills the textarea when the user arrives from a `file_handlers` launch. The user still has to tap "Replace active routine" — this is intentional: silent importing on launch would violate the Sprint 12.1 celebration-on-finish-only discipline.

- [ ] **Step 9.5: Write the failing hook test**

Create `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { useLocation } from "react-router";
import { useRoutineLaunchQueue } from "@/shared/hooks/useRoutineLaunchQueue";

function Consumer() {
  useRoutineLaunchQueue();
  return null;
}

function LocationProbe({ onLoc }: { onLoc: (pathname: string, state: unknown) => void }) {
  const loc = useLocation();
  onLoc(loc.pathname, loc.state);
  return null;
}

describe("useRoutineLaunchQueue", () => {
  const originalLaunchQueue = (globalThis as { launchQueue?: unknown }).launchQueue;

  afterEach(() => {
    (globalThis as { launchQueue?: unknown }).launchQueue = originalLaunchQueue;
    vi.restoreAllMocks();
  });

  it("is a no-op when launchQueue is absent", () => {
    delete (globalThis as { launchQueue?: unknown }).launchQueue;
    render(
      <MemoryRouter>
        <Consumer />
      </MemoryRouter>,
    );
    // Nothing to assert: the hook must not throw.
    expect(true).toBe(true);
  });

  it("navigates to /settings/import with launchYaml state when a file is handed in", async () => {
    let consumer: ((params: { files: readonly unknown[] }) => Promise<void> | void) | null = null;
    (globalThis as { launchQueue?: { setConsumer: typeof setConsumer } }).launchQueue = { setConsumer } as never;
    function setConsumer(c: typeof consumer) {
      consumer = c;
    }

    const fakeText = "version: 1\nname: Test\n";
    const fakeFile = { text: async () => fakeText };
    const fakeHandle = {
      kind: "file" as const,
      getFile: async () => fakeFile,
    };

    let capturedPath = "";
    let capturedState: unknown = null;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Consumer />
        <Routes>
          <Route path="*" element={<LocationProbe onLoc={(p, s) => { capturedPath = p; capturedState = s; }} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(consumer).not.toBeNull();
    await consumer!({ files: [fakeHandle] });

    // Give React a flush.
    await new Promise((r) => setTimeout(r, 0));

    expect(capturedPath).toBe("/settings/import");
    expect(capturedState).toEqual({ launchYaml: fakeText });
  });
});
```

- [ ] **Step 9.6: Run the hook test**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx
```
Expected: both tests pass. If the navigation test fails, double-check the `MemoryRouter` import matches the rest of the codebase (the project uses `react-router`, not `react-router-dom` — keep consistent).

- [ ] **Step 9.7: Add a RoutineImportScreen test for the pre-fill**

Add to `web/tests/unit/features/settings/RoutineImportScreen.test.tsx` (create if it doesn't exist; mirror sibling test file style):

```tsx
it("pre-fills the textarea from location.state.launchYaml", async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/settings/import", state: { launchYaml: "version: 1\n" } }]}>
      <RoutineImportScreen />
    </MemoryRouter>,
  );
  const ta = screen.getByLabelText(/paste yaml/i) as HTMLTextAreaElement;
  expect(ta.value).toContain("version: 1");
});
```

Imports at top of file — match `react-router` (not `react-router-dom`). If the test file already has a `renderWith(router)` helper, use that.

- [ ] **Step 9.8: Run both tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx tests/unit/features/settings/RoutineImportScreen.test.tsx
```
Expected: all green.

- [ ] **Step 9.9: Full unit suite + build + manifest check**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run 2>&1 | tail -5 && npm run build 2>&1 | tail -3
```
Expected: full suite green; build succeeds.

```bash
grep -A 8 "file_handlers" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/dist/manifest.webmanifest"
```
Expected: the `file_handlers` entry appears in the built manifest with the correct `action` and `accept` object.

- [ ] **Step 9.10: Commit**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add web/vite.config.ts web/src/shared/hooks/useRoutineLaunchQueue.ts web/src/app/App.tsx web/src/features/settings/RoutineImportScreen.tsx web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx web/tests/unit/features/settings/RoutineImportScreen.test.tsx
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "feat(pwa): file_handlers for .yaml/.yml opens import screen

Previously the Android download-and-open flow was broken — users
could download the GPT-generated YAML but tapping it on Android had
no path back into the PWA. Add file_handlers + a Launch Queue hook
that navigates to /settings/import with the YAML in router state,
pre-filling the textarea. Feature-detects launchQueue so iOS and
older browsers are unaffected; paste flow unchanged. iOS and older
browsers continue to use the paste-YAML path as before."
```

---

## Task 10: Lighthouse + DevTools PWA checklist (carry-over from Sprint 12 Task 12)

Manual-driven verification. Produces either an `artefacts/` drop or a scores-in-commit-message record. The Sprint 12 plan pre-specified targets (PWA 100 / Perf ≥ 90 / A11y ≥ 95 / BP ≥ 95) — confirm the bundle still meets them after Sprint 13's changes.

**Files:**
- Optionally create: `docs/superpowers/artefacts/sprint-13/` (gitignore-dependent; skip if your gitignore excludes `artefacts/`)

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 10.1: Build + preview**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm run build && npm run preview
```
Expected: preview server at `http://localhost:4173/exercise-logger/`.

- [ ] **Step 10.2: Confirm the Service Worker activates**

In Chrome: DevTools → Application → Service Workers. Confirm `sw.js` is listed under `/exercise-logger/` scope with status `activated and is running`. Source: `/exercise-logger/sw.js`.

- [ ] **Step 10.3: Confirm the manifest uses warm paper**

Still in DevTools → Application → Manifest. Confirm:
- Theme color: `#FCFAF5`
- Background color: `#FCFAF5`
- File handlers section is present with the `.yaml` / `.yml` accept list.

If any field is wrong, the earlier tasks drifted — go back and re-run the relevant rebuild.

- [ ] **Step 10.4: SW update prompt**

In a second terminal, edit any user-visible string (e.g. `App.tsx` tab label "Today" → "Today "), rebuild (`npm run build`), keep the original tab open, reload. Expected: `SWUpdatePrompt` fires the "Update available" toast with a Reload action. Tap Reload — new bundle loads.

Revert the label change:
```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" checkout web/src/app/App.tsx
```

- [ ] **Step 10.5: Offline navigation**

DevTools → Network → Offline. Navigate Today / Workout / History / Settings — each renders. Reload — boots offline (the `navigateFallback` at `vite.config.ts:117` handles this).

- [ ] **Step 10.6: Lighthouse**

DevTools → Lighthouse → select **Progressive Web App**, **Performance**, **Accessibility**, **Best Practices**, Mobile form factor → Analyze page load.

Record the four scores. Targets:
- PWA: 100
- Performance: ≥ 90
- Accessibility: ≥ 95
- Best Practices: ≥ 95

If PWA < 100: check the diagnostics. Typical culprits: missing installability criteria (manifest fields), `start_url` not cached offline, maskable icon missing. The current config declares a maskable icon at `vite.config.ts:77-83`; confirm it's actually on disk at `web/public/icons/icon-512.png`.

If Accessibility < 95: the flagged rule should be specific (low-contrast text, missing labels). Fix the specific rule, not a wholesale redesign.

- [ ] **Step 10.7: Record the scores**

In the commit message below, fill in actual observed scores (not the targets):

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit --allow-empty -m "chore(pwa): Sprint 13 Lighthouse + DevTools checklist

- Manifest theme_color + background_color: #FCFAF5 (warm paper)
- Service Worker register + waiting→active + update-prompt: verified
- Offline navigation across all four tabs + reload: verified
- Lighthouse (mobile, preview:4173):
    PWA:           <FILL IN>
    Performance:   <FILL IN>
    Accessibility: <FILL IN>
    Best Practices: <FILL IN>
- file_handlers entry present in the generated manifest.webmanifest"
```

Replace `<FILL IN>` with the actual scores. If any score is below its target, open a follow-up issue rather than blocking merge — cosmetic perf regressions can be chased in a later pass.

- [ ] **Step 10.8: Stop the preview server**

Ctrl+C in the `npm run preview` terminal.

---

## Task 11: Final green-light + PR

Pull together the sprint: full CI, verify Lucide still uninstalled, push, open PR.

**Worktree:** `C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile`

### Steps

- [ ] **Step 11.1: Re-confirm `CLAUDE.md` test count reflects the final total**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run 2>&1 | grep "Tests "
```
Note the final `Tests NNN passed (NNN)`. If it differs from what `CLAUDE.md:39` now says (updated provisionally in Task 6.1), amend:

Edit `CLAUDE.md:39`:
```
npm test              # <FINAL> unit+integration tests (Vitest)
```

If a change is needed, commit:
```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" add CLAUDE.md
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" commit -m "docs: finalize test count for Sprint 13"
```

If the provisional count already matches, skip this commit.

- [ ] **Step 11.2: Full local CI**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web" && npm test -- --run && npm run lint && npm run build && npm run test:e2e
```
Expected: four green sections. Playwright: 11 → 11 (the existing a11y-keyboard test was restructured into 3 sub-tests; Playwright counts sub-tests, so the number rises by 2 to **13 passed**). Vitest: 735 → **~742** (see Cross-cutting).

- [ ] **Step 11.3: Confirm no `lucide-react` regression + no `cta` leak**

```bash
grep -rln "lucide-react" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/tests" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/package.json" || echo "CLEAN"
```
Expected: `CLEAN`.

```bash
grep -rn "\\bcta\\b" "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile/web/src" | grep -vE "effectiveType|inactive|octal|locator" || echo "CLEAN"
```
Expected: `CLEAN`. Any hit means a classname was missed in Task 3 — go back and fix.

- [ ] **Step 11.4: Push + open PR**

```bash
git -C "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile" push -u origin sprint-13-last-mile
gh pr create --title "Sprint 13: Last Mile — manifest fix, transition debt, a11y + Android YAML" --body "$(cat <<'EOF'
## Summary
- **Bug fix:** PWA manifest `theme_color` + `background_color` updated to warm paper `#FCFAF5` (was dark `#09090b`, mismatched the `index.html` meta from Sprint 6). Fixes the dark-on-light splash + task-switcher chrome seen after installing on Android/iOS.
- **Transition debt:** dropped the `--cta` alias and the six primitives that referenced it (Pill + 5 shadcn primitives); migrated to `bg-sage` / `border-sage` / `ring-sage/40` (matches Sprint 12's audited focus-ring strength).
- **Transition debt:** dropped the `.text-hero` back-compat utility and the unused `Stat size="hero"` variant.
- **A11y:** strengthened aria-pressed tests on PrToggle, UnitsToggle, ValueBox (Sprint 12 M2); deepened the keyboard-nav Playwright spec (Sprint 12 M4).
- **Android YAML flow:** added PWA `file_handlers` + a `launchQueue` consumer. Tapping a downloaded `.yaml`/`.yml` file on Android Chrome now offers the installed PWA as an opener, routes to Import Routine, and pre-fills the textarea. Paste flow unchanged; iOS unaffected.
- **Docs:** archived four untracked sprint plans (11, 11.5, 12, 11.6+12.1); refreshed root `CLAUDE.md` test count; documented `importAndActivateRoutine` in `services/CLAUDE.md`; corrected the stale `App.tsx` comment on the `ExerciseHistoryScreen` orphan route.
- **PWA:** re-ran the Sprint 12 Task 12 Lighthouse + DevTools checklist. Scores in the history.

## Out of scope
- Spec §5 deferred items (superset UI, PR auto-detection, streak refactor, session editing, timer UI, dark mode, density/accent toggles, name personalisation, target time, keypad for duration/distance).
- `share_target` (sibling of `file_handlers`; surface as a later follow-up if needed).
- Wiring an in-app link to `/history/exercise/:exerciseId` — remains deferred per Sprint 12 plan.

## Test plan
- [ ] `npm test -- --run` reports `Tests ~742 passed (~742)` (target: +7 vs. 735 baseline)
- [ ] `npm run lint` clean
- [ ] `npm run build` green; bundle precache unchanged ±1 KiB
- [ ] `npm run test:e2e` reports 13 passed (was 11; a11y-keyboard split into 3 sub-tests)
- [ ] Manual: install the PWA on Android, confirm warm-paper splash screen
- [ ] Manual: download a `.yaml` routine on Android Chrome, tap it, app offers itself as opener, textarea pre-fills
- [ ] Manual: Lighthouse (mobile) meets or beats PWA 100 / Perf 90 / A11y 95 / BP 95

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 11.5: After PR merges to main (don't do this pre-merge)**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git fetch origin
git pull --ff-only origin main
git worktree remove "C:/Users/creix/VSC Projects/exercise_logger-sprint13-last-mile"
git branch -d sprint-13-last-mile
git worktree list
```
Expected: only the main worktree listed; branch deleted locally. The remote branch is removed automatically if GitHub's "auto-delete head branches" setting is on; otherwise delete via the PR page.

---

## Cross-cutting notes

### Expected test-count deltas

| Task | Vitest delta | Playwright delta |
|---|---|---|
| Task 2 (manifest) | +2 | 0 |
| Task 3 (cta sweep) | 0 (snapshot tweaks at most) | 0 |
| Task 4 (.text-hero) | 0 | 0 |
| Task 5 (orphan comment) | 0 | 0 |
| Task 6 (CLAUDE.md) | 0 | 0 |
| Task 7 (aria-pressed M2) | +3 | 0 |
| Task 8 (keyboard-nav M4) | 0 | +2 (1 spec → 3 cases) |
| Task 9 (file_handlers) | +3 (2 hook + 1 RoutineImportScreen) | 0 |
| Task 10 (Lighthouse) | 0 | 0 |

**Final projected: Vitest 735 → ~742, Playwright 11 → 13.** If the actual Vitest delta diverges by more than ±2, a test was dropped or duplicated — investigate before merging.

### Risk flags

- **Task 3 focus-ring alpha change (low):** moving from `ring-cta/30` to `ring-sage/40` increases visible ring intensity by ~33%. Visually cleaner (matches the rest of the app); flag only if the user finds a specific component where the stronger ring crowds content.
- **Task 9 Launch Queue API scope (medium):** `launchQueue` is Chrome/Android-only (~75% of browser share as of 2026). iOS Safari, Firefox, older Chromes are completely unaffected — the feature-detect in the hook ensures that. The paste-YAML flow remains the universal fallback.
- **Task 9 manifest MIME types (low):** Android advertises YAML MIMEs inconsistently across OEM file managers. The accept object covers the four common variants; if a user reports "Exercise Logger doesn't appear for my .yaml file," add the specific MIME their device reports to the list.
- **Task 10 Lighthouse score regression (low):** Sprint 12 never recorded baseline scores, so we can't strictly "regression test" them. Targets in Task 10.6 are the authoritative floor; if we fall under, fix the flagged rule specifically rather than reverting Sprint 13 work.

### Placeholder scan (self-review pass)

The plan was scanned for "TBD", "fill in details", "implement error handling", "similar to earlier task", etc. The only intentional placeholder is `<FILL IN>` in Task 10.7, which is explicitly user-driven input (actual Lighthouse scores).

### Out of scope (reject if tempted)

- Reviving the `/history/exercise/:exerciseId` navigation — a feature, not cleanup. Sprint 12 plan says "Revive under a separate `feature/exercise-history-navigation` branch."
- Bumping `package.json` version or cutting a release tag.
- Any work on spec §5 deferred items.
- Re-generating the icon set, refactoring SetLogSheet internals, changing session data model, any progression-engine tweaks.
- `share_target` (sibling PWA API). Can be added later if the "Share to app" flow becomes important.
- Addressing Sprint 12 review minor M1 (icon render depth) — too low-signal to bundle with this sprint. Open a new issue if a concrete symptom surfaces.

---

## Self-review

1. **Finding coverage:** every row of the traceability table maps to a task. Items 1–6 + 11 are lean-scope; items 7–10 + 12 are the "Full" additions the user chose. All addressed.

2. **Placeholder scan:** one deliberate `<FILL IN>` in Task 10.7 (Lighthouse scores); everything else has concrete code / commands / expected output. No "TODO", "figure out later", or "similar to".

3. **Type consistency:**
   - `useRoutineLaunchQueue` (Task 9) returns `void`; called without a destructure in `App.tsx`.
   - `LaunchParams` / `LaunchConsumer` types are local to `useRoutineLaunchQueue.ts`; not re-exported because callers never construct them.
   - `launchYaml` is consistently `string` in the hook's navigate state payload and in `RoutineImportScreen`'s consumer.
   - `StatSize` (Task 4) removes the `"hero"` branch from both the type and both class-record consumers simultaneously — no type/value drift.

4. **Cross-task dependencies honoured:**
   - Task 2 (manifest fix) is independent.
   - Task 3 (cta sweep) is independent.
   - Task 4 (.text-hero) is independent.
   - Task 5 (route comment) is independent.
   - Task 6 (CLAUDE.md) can be done first or last; a provisional update in Task 6.1 + a final touch-up in Task 11.1 is the safer path.
   - Task 7 (aria-pressed) + Task 8 (keyboard E2E) are independent of each other and of Tasks 2-6.
   - Task 9 (file_handlers) is independent; Task 10 (Lighthouse) benefits from being last so it measures the final bundle.
   - Task 11 (final CI + PR) strictly after all prior.

5. **Spec coverage:** the Sprint 13 goal — "close the Visual Revamp cycle" — maps to every traceability row; nothing in the audit punchlist is missed (permanently-deferred items are intentionally excluded).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-sprint13-last-mile.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per code-level task (Tasks 1-9), with the controller handling flow tasks (Task 10 Lighthouse is user-driven, Task 11 CI + PR). Sprint 11.6/12.1 used the same pattern.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batching with a checkpoint before Task 9 (the most complex task) and again before Task 11 (the irreversible push/merge step).

Which approach?

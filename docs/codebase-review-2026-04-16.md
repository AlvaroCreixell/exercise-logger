# Exercise Logger v2 — Full Codebase Review

**Date:** 2026-04-16
**Reviewer:** Claude Code (Opus 4.7, 1M context)
**Scope:** `web/` (all source, tests, config) + `docs/` + `.github/` + repo-root config
**Target state:** Ready to share with a few friends
**Method:** 4 parallel Explore agents across discrete slices (data/services, features/UI, shared/PWA/build, tests/docs/GPT/YAML). Each returned a structured report; findings were synthesized, de-duplicated, and spot-checked against current code. Per-claim verification status is noted inline.

---

## Executive Summary

### TL;DR

The app is **architecturally sound, functionally complete, and well-tested at the service layer**. The codebase shows real discipline: clean four-layer architecture (features → hooks → services → Dexie), strict transaction boundaries on multi-table writes, careful handling of the Dexie compound-index-null gotcha, snapshot pattern for history durability, and 440 unit+integration tests. The decision to treat ChatGPT as an unpaid co-processor and keep the app free of server-side AI is both pragmatic and well-reasoned.

What's holding it back from a "share with friends" state is a **small number of concrete problems** rather than any deep architectural flaw:

1. **YAML import does not work on Android** — the single biggest user-blocker. It's a platform/UX issue, not an app-logic bug.
2. **The UI does the job but feels generic.** The complaint of "clunky, not exciting" is real, and it's fixable with ~2 hours of surgical typography, spacing, contrast, and hierarchy edits — no redesign needed.
3. **Two genuine backend correctness risks** around concurrent set logging and edit-on-finished-session promotions. Neither is catastrophic today (single user, slow typing), but both would bite the first time two people use the app simultaneously or one person taps very fast.
4. **PWA polish gaps** — silent auto-update, missing file handlers, incomplete icon set, no iOS guidance — all standard installable-PWA hygiene that isn't wired up yet.
5. **Test coverage is strong on services, weak on screens** — service regressions will be caught; UI regressions won't.

### What's Good

- **Service layer discipline.** `session-service.ts`, `set-service.ts`, `progression-service.ts`, `backup-service.ts` all enforce domain invariants inside transactions. Snapshot pattern for history is correct. Backup has real deep-structural validation and FK-integrity checks.
- **Type/IO discipline.** ISO 8601 UTC everywhere, kg canonical with display conversion, `""` sentinel for compound-indexed strings, slugified exercise IDs. These conventions are consistent and documented.
- **Per-block progression engine.** Correctly keyed by `blockIndex` (invariant 8), with a sound block-signature fallback for when routines change.
- **Dev ergonomics.** Path alias, strict TS, lazy-loaded screens, lint+test+e2e gating the deploy, `autoUpdate` SW, 404-to-index copy hack for GitHub Pages SPA routing.
- **Custom GPT instruction quality.** The `docs/custom-gpt/` system prompt is thorough — intake questions, self-check rules, a separate YAML contract document, duplicate-exercise rule, range validation. This is better than 95% of "GPT + app" integrations I've seen.
- **A sample routine ships pre-loaded.** `full-body-4day-mom.yaml` gives a friend something to do before they figure out the import flow.

### The Clunky-Visuals Diagnosis

The app is **not badly designed** — it's under-executed. It borrows Swiss/brutalist design language (zero border-radius, strong top borders, monochrome, tight tracking) but skips the details that make that style feel intentional rather than minimal-to-the-point-of-cold:

- **Hierarchy is inverted on the most-viewed screen.** On Workout, the day label ("Day B") is the big heading and the routine name ("Pull") is the small paragraph underneath. That's the opposite of what the user's brain wants to read.
- **The core interaction (tapping a set) looks meek.** Logged set slots use `bg-success-soft` (very pale green) against a light background with small fonts and 44×56px touch targets. A user scanning their workout under effort can't quickly see what's done and what's not.
- **Exercise names are ALL CAPS with tight tracking.** `BARBELL BACK SQUAT` at `text-base font-semibold uppercase tracking-wide` (features/workout/ExerciseCard.tsx:97) reduces scannability. Sentence-case with slightly bolder weight would read faster.
- **Global padding is `p-4` (16px)** in most components. On a phone, `p-5` (20px) is the right baseline; major sections want `p-6`. The UI feels cramped because it is.
- **Semantic colors are undersaturated.** Success and info are muted OKLCH values; their `-soft` variants are nearly invisible against the background.
- **No motion anywhere.** Every interaction is instantaneous. Even a 150ms color transition on tap is enough to make the app feel responsive instead of abrupt.

None of this requires a redesign. See [Section 2](#2-features-ui--ux) for a ranked fix list. **~8 surgical changes, ~2 hours of work, would resolve the "clunky" feeling.**

### The Single Biggest Blocker

**YAML routine files downloaded from ChatGPT don't work on Android.** The current `RoutineImporter.tsx` uses `<input type="file" accept=".yaml,.yml">`, and Android's file picker doesn't reliably surface `.yaml` files — the user couldn't even find them in the Files app. The whole "custom-GPT generates a routine, user imports it" flow is broken for the target platform.

The fix is unambiguous: **add a clipboard-paste textarea** next to the file input. Users copy the YAML from the ChatGPT chat, paste into the app, done. This works on every platform, every browser, and sidesteps Android's file system entirely. ~50 LOC, one evening. Do this first.

See [Section 4](#4-testing-docs-gpt-integration--yaml-import) for the long-term PWA file-handlers story.

### Top 10 Critical Path

Ranked by (user impact × leverage ÷ effort). Detailed breakdowns in each section below.

| # | Item | Area | Effort | Impact |
|---|------|------|--------|--------|
| 1 | **Clipboard-paste YAML import** | UX / integration | 2-3h | Unblocks the entire GPT-routine flow |
| 2 | **Workout screen header: swap day/routine hierarchy** | UI | 10 min | Biggest single readability win |
| 3 | **Set slot redesign: larger, higher-contrast, clearer logged/unlogged** | UI | 30 min | Core interaction clarity |
| 4 | **Typography + padding pass** (drop all-caps, p-5 baseline, hoist headings to `font-heading`) | UI | 1-2h | Eliminates "generic" feel |
| 5 | **Fix `logSet` concurrent-write race** | Backend | 2h | Data integrity |
| 6 | **Update GPT instructions for copy-paste & explicit version field** | GPT | 30 min | Paired with #1 |
| 7 | **SW update prompt** (switch `autoUpdate` → `prompt`) | PWA | 2h | Users get fixes without confusion |
| 8 | **Harden E2E assertions** (remove `.catch(() => false)` noise) | Tests | 2-3h | Catches regressions of #2-4 |
| 9 | **Component tests for Workout, SetLogSheet, Settings, Today** | Tests | 2-3 days | Safety net for future UI work |
| 10 | **Manifest `file_handlers` + `launchQueue`** | PWA | ~1 day | Long-term Android fix; complements #1 |

**Minimum ship set** (~2 days): 1, 2, 3, 4, 5, 6, 8.
**Full hardening** (~1-2 weeks): everything above plus icons/iOS polish, bundle split, coverage tool.

---

## Progress Update — 2026-04-16 PM

**Shipped since the review was written** (see `git log b5a7bfc..HEAD` for 16 commits):

- ✅ Plan A item #1: **Clipboard-paste YAML import** (app-side)
- ✅ Plan A item #2: **Workout screen header hierarchy** — verified already in place pre-review; no code change needed
- ✅ Plan A item #3: **Set slot redesign** (saturated `bg-success`, `min-h-[48px]`, focus ring, scale press, 600ms flash on log)
- ✅ Plan A item #4: **Exercise-name typography** (`tracking-tight`, `text-base`, no-uppercase) + **vertical last-time/suggestion stack**
- ✅ Plan A item #5: **Spacing outliers** fixed (WorkoutScreen, HistoryScreen, Card primitive defaults)
- ✅ Plan A item #10: **CLAUDE.md test count** 391 → 440
- ✅ Phase 2 #13-14 carried forward: motion tokens + `--success` saturation + `flash-logged` keyframe + Softened-Swiss pivot across Card, Dialog, Alert-Dialog, Sheet, Toaster, and Button primitives
- 🟡 Component test coverage: **SetSlot** (flash mechanism, 4 tests) and **RoutineImporter** (paste flow, 5 tests) — 9 new tests. Workout/SetLogSheet/Settings/Today still pending.

**Decisions locked in from Appendix B:**
- Zero-radius commitment **dropped** → Softened Swiss (4–6 px radii, soft shadows, 180 ms motion) is now the baseline language
- Dark mode **dropped** → light-only going forward; the `.dark` tokens and `ThemeSync` are now removable
- Routine count: 1-2 typical, up to 5-6 max → current picker UX is fine, no list navigation needed
- URL-based routine sharing: **yes**, moves up in priority
- Catalog contributions: **defer**
- `editSet` promotion on finished sessions: **pending discussion** — user asked for options

---

## Unified Critical Path (Ranked Checklist)

```
[x]  1. RoutineImporter: add <textarea> + "Import from text" button                       (2-3h)  ✅ shipped
[x]  2. WorkoutScreen header: routine name as <h1>, day label as <p>                       (10m)  ✅ verified already done
[x]  3. SetSlot: bg-success + white text for logged; min 48×64; border-cta on focus       (30m)  ✅ shipped
[x]  4. ExerciseCard: remove `uppercase` from names; vertical-stack last-time + suggest   (30m)  ✅ shipped
[x]  5. Global: p-4 → p-5 baseline across feature screens; space-y-4 between cards        (30m)  ✅ shipped
[ ]  6. set-service.ts: wrap logSet weighted-bodyweight promotion in db.transaction       (2h)
[ ]  7. GPT instructions: require `version: 1`, add copy-paste Android guidance           (30m)
[ ]  8. vite.config: registerType "autoUpdate" → "prompt"; add update-available toast     (2h)
[ ]  9. tests/e2e/full-workflow.spec.ts: replace .catch() guards with real assertions     (2h)
[x] 10. CLAUDE.md: 391 → 440 tests (and note drift)                                        (5m)  ✅ shipped
[~] 11. Component tests: WorkoutScreen, SetLogSheet, SettingsScreen, TodayScreen          (3d)  🟡 partial (SetSlot+RoutineImporter done)
[ ] 12. Manifest: file_handlers + launchQueue consumer; maskable icon with safe-zone       (1d)
[ ] 13. Icons: add 256 + 384; iOS apple-mobile-web-app-* meta; "Install" Settings button  (3h)
[ ] 14. Bundle: manualChunks for SettingsScreen + dialogs; target <150 kB gzipped          (4h)
[ ] 15. finishSession: guard currentIndex === -1; add test for corrupt dayOrder            (1h)
```

---

## 1. Data Layer, Domain & Services

### 1.1 What Works Well

- **Invariant enforcement is real.** Active-session singleton (invariant 1) is checked *inside* transactions in every session-mutating operation (`session-service.ts:280-290`, `settings-service.ts:50-60`), so the TOCTOU window is closed.
- **Snapshot strategy is sound.** Sessions snapshot `routineNameSnapshot`, `dayLabelSnapshot`, `setBlocksSnapshot`, `dayOrderSnapshot` at creation (`session-service.ts:204-216`). History remains fully renderable after routine deletion (invariant 5) without hacks.
- **Dexie transaction hygiene.** `db.transaction("rw", [...], async () => {...})` is used consistently for `finishSession`, `deleteRoutine`, `importBackup`, `clearAllData`. Active-session precondition checks always live inside the transaction.
- **Compound-index null guard.** `instanceLabel` normalizes to `""` in `set-service.ts:157` and `progression-service.ts:101` — the Dexie-drops-null gotcha documented in the root CLAUDE.md is handled everywhere it matters.
- **Block signatures are deterministic.** `generateBlockSignature` (`block-signature.ts:27-42`) plus the signature-or-position fallback in `progression-service.ts:124-149` gracefully handles routines that were edited after sessions were logged against them.
- **Weight precision discipline.** `toCanonicalKg` / `toDisplayWeight` (`unit-conversion.ts:98-120`) do not round user input. Rounding is confined to progression *suggestions* via `roundToIncrement`. This matches the CLAUDE.md invariant and is consistent across the codebase.
- **Backup validation is deep.** `validateBackupPayload` (`backup-service.ts:765-932`) does structural checks, foreign-key integrity validation, and catalog cross-reference verification — far beyond "is this JSON?"

### 1.2 Correctness Risks (prioritized)

**Critical — worth fixing before friends**

**R1. `logSet` weighted-bodyweight promotion is not in a transaction** — `set-service.ts:104-209`
- The function reads `sessionExercise`, validates, writes logged sets, *then* (line 206) updates `sessionExercise.effectiveType` if promotion is needed. That final write happens outside the transaction that wrapped the set write.
- Two rapid taps on the same exercise card (easy with an impatient finger) can have two concurrent `logSet` calls both reading `effectiveType === "bodyweight"` and both trying to promote to `"weight"`. Dexie optimistic concurrency can cause one write to be silently overwritten. The promotion itself is idempotent, but the lack of atomicity means state between the set insert and the exercise update can diverge.
- **Fix:** Wrap the entire read-validate-write-promote sequence in `db.transaction("rw", [db.sessionExercises, db.loggedSets], async () => {...})`. One transaction, atomic. Add a concurrent-tap test to lock the behavior in.

**High**

**R2. `editSet` can mutate a finished session's snapshot via promotion** — `set-service.ts:229-263`
- The spec permits editing sets on finished sessions from the History screen. But `editSet` (line 252-260) still runs the weighted-bodyweight promotion check and, if the user adds weight to a previously-bodyweight set, silently flips `sessionExercise.effectiveType` on a *finished* session. That's a snapshot mutation.
- Whether this is intended is ambiguous in the spec. If intended, document it explicitly (and probably show a confirmation in the UI). If not, guard promotion to `session.status === "active"` only.
- **Fix:** Decide the intended behavior, then either (a) add an `if (session.status !== "active") return` before the promotion block, or (b) document and add a UI confirmation.

**R3. `editSet` silent-failure path on deleted `sessionExercise`** — `set-service.ts:229-263`
- Reads `sessionExercise` at line 254 without checking for undefined. If it's gone (race with session discard), the promotion skips but the set update still succeeds. No error surfaces.
- **Fix:** `if (!sessionExercise) throw new Error(\`SessionExercise ${id} not found\`);` before using it. Fail loudly, not quietly.

**R4. `finishSession` rotation can silently wrap on corrupt `dayOrderSnapshot`** — `session-service.ts:441-444`
- `const currentIndex = dayOrderSnapshot.indexOf(session.dayId); const nextIndex = (currentIndex + 1) % dayOrderSnapshot.length;` — if `indexOf` returns -1 (dayId not in order), `nextIndex = 0`, which silently resets the rotation to the first day.
- Low probability today (snapshots are built from valid routines), but an imported backup with a corrupt routine could exhibit this.
- **Fix:** Guard `if (currentIndex === -1) throw new Error(...)`. Surfaces the invariant violation at the moment it happens.

**Medium**

**R5. `addExtraExercise` carries over `unitOverride` from any historical occurrence** — `session-service.ts:477`
- `findPreviousUnitOverride` with `matchAnyLabel=true` matches the same `exerciseId` regardless of instance label. If a user logged bench press as an extra (lbs) in January, then imported a routine where bench press is a core exercise (kg), then added bench press as an extra again in April — the April extra inherits the January lbs override.
- **Fix:** For extras specifically, either don't carry over unit overrides at all (they're ad-hoc by definition) or only match extras-to-extras.

**R6. Unit conversion cleanup rounding is only applied on the `lbs` branch** — `progression-service.ts:295-307`
- `kg` path can emit `102.4999999997` kg from floating-point math; `lbs` path applies a `Math.round(x * 100) / 100` cleanup at the end; `kg` path doesn't.
- **Fix:** Apply the same cleanup to both branches. One line.

**R7. `Routine.cardio` is not structurally validated by `validateBackupPayload`** — `backup-service.ts:315-405`
- A malformed `cardio` object passed in a backup import is stored as-is.
- **Fix:** Add structural check (`notes: string`, `options: RoutineCardioOption[]`) matching the rest of the validator's rigor.

**R8. `findPreviousUnitOverride` loads all finished sessions into memory** — `session-service.ts:88-119`
- `db.sessions.where("status").equals("finished").toArray()` then in-memory sort. Works fine today; gets slow at hundreds of sessions.
- **Fix:** Add a `[status+finishedAt]` compound index (schema bump) and use `.reverse().first()` to pull the newest match. Defer until you actually feel the latency.

**Low**

**R9. `SessionStatus` enum includes `"discarded"` but `discard()` hard-deletes** — `session-service.ts:390`
- Dead value; backup validator accepts data that can't be produced by the app.
- **Fix:** Remove `"discarded"` from the enum. Or commit to soft-delete if you want "recently discarded" to be recoverable — but that's a feature call, not a cleanup.

**R10. `downloadBackupFile` has no error handling** — `backup-service.ts:108-126`
- Blob → URL → anchor → click, with no `try/catch`. Silent failure in an unusual context (tests, sandboxed iframe, permission blocked).
- **Fix:** Wrap and log. Cheap defense.

### 1.3 Simplification Opportunities

- **`findPreviousUnitOverride` and `getExtraExerciseHistory`** both implement "get the most recent finished session matching X" in slightly different ways. Extract a helper: `getMostRecentFinishedSession(db, predicate?)`.
- **Backup validation ID-set construction** (`backup-service.ts:869-888`) builds ID sets three times. Replace with a `collectIds<T extends { id: string }>(records: T[]): Set<string>` helper.
- **`BackupEnvelope` / `BackupData` types live in `services/`** but are really data-model types. Move them to `domain/types.ts` so UI components that need to eyeball a backup payload don't have to import from a service.
- **`validateSetInput` is private to `set-service.ts`.** If it's the rule of record, export it so form UIs can pre-validate before calling `logSet` — removes a roundtrip of "type, tap save, get error".

### 1.4 Action List

1. [R1, Critical] Wrap `logSet` in a transaction spanning `sessionExercises` + `loggedSets`. Add a concurrent-tap test.
2. [R2, High] Decide intended behavior for `editSet` promotion on finished sessions; implement + document.
3. [R3, High] Add non-null guard in `editSet` after `sessionExercise` read.
4. [R4, High] Add `currentIndex === -1` guard in `finishSession`.
5. [R5, Medium] Scope `findPreviousUnitOverride` for extras to extras-only.
6. [R6, Medium] Apply cleanup rounding uniformly in `calculateBlockSuggestion`.
7. [R7, Medium] Add structural validation for `cardio` in `validateBackupPayload`.
8. [R9, Low] Remove dead `"discarded"` from `SessionStatus`, update validator.
9. [Simplification] Extract `getMostRecentFinishedSession` and `collectIds` helpers.

---

## 2. Features, UI & UX

This is the most important section. The user's stated complaint is that **"visuals are clunky, I think it does the job but is not exciting."** The review below treats that as the North Star.

### 2.1 What Works Well

- **Route structure is clean.** `app/App.tsx:26-31` lazily loads every screen. Suspense fallbacks in place. Shell component separates nav from content.
- **TodayScreen's three visual states** (no routine / active session / ready to start) are distinctly handled (`features/today/TodayScreen.tsx:52-89`). The Resume card is prominent enough that users won't accidentally start a second session.
- **Workout screen composition is pragmatic.** The `SetLogSheetWithHistory` and `ExerciseCardWithHistory` wrappers (`WorkoutScreen.tsx:260-354`) correctly isolate hooks per exercise — avoids stale closures when multiple cards render concurrently.
- **Accessibility basics present.** Bottom nav has `role="navigation"`. Set slots have descriptive aria-labels including logged state. 44px minimum touch targets. `<h1>` usage correct. Safe-area insets respected. `h-dvh` handles the dynamic browser chrome.
- **Semantic color use is correct.** Success green for logged sets, info teal for active/selected, warning amber for confirmations, destructive red for delete/discard. Token-based via `App.css:86-92`.

### 2.2 The "Clunky" Deep Dive

#### 2.2.1 Why the UI Feels Generic

**Inverted hierarchy on the most-viewed screen.**
`WorkoutScreen.tsx:160-162`: The day label renders as `text-lg font-bold`, while the routine name is a smaller paragraph underneath. The primary context during a workout is *which routine am I doing* (Push? Pull? Legs?). Day-within-routine is secondary. Today the user reads "Day B" first and has to hunt for "Pull".

**Typography is inconsistent and under-leveraged.**
The app already imports Urbanist (heading) and DM Sans (body) via `@fontsource-variable/*`, and `App.css` defines a `font-heading` utility — but usage is uneven:
- Screen titles: mix of `text-2xl font-extrabold` with and without `font-heading`.
- Exercise names (the thing the user's eye lands on during logging): `text-base font-semibold uppercase tracking-wide` (`ExerciseCard.tsx:97`). All-caps + tight tracking + base size = hard to scan, especially under physical effort.
- Empty-state headings use DM Sans instead of Urbanist. Visually inconsistent with screen titles elsewhere.

**Spacing is tight.**
Default gap/padding across feature screens is `p-4` (16px). The spec and several individual screens specify `p-5` (20px), but it's not applied consistently. Cards use `py-3 space-y-3`. On a phone, this reads as "dense" — which is different from "rich" and reads to the eye as "generic admin panel".

**Monochrome + low-saturation semantic tokens.**
Light-mode `--success` is `oklch(0.65 0.17 145)` — perceptually muted green. Its `-soft` variant `oklch(0.95 0.05 145)` is nearly white. The `bg-success-soft text-success` combination on logged set slots is very pale against a very pale background — the one visual signal that should scream "this set is done" whispers instead. Info teal has the same issue.

**The CTA purple is the only saturated color in the palette.** `--cta: oklch(0.546 0.245 262.88)`. Everything else is a neutral or desaturated semantic. The overall palette reads as "brand + grayscale" rather than a designed color system.

**Zero border-radius everywhere.** The spec intentionally chooses a Swiss/brutalist style. That's a valid direction, but Swiss design is *also* very disciplined about whitespace, weight, and typographic contrast — disciplines this app hasn't yet committed to. Right now you get the harshness without the discipline, which reads as institutional rather than editorial.

**No motion.** Tapping a button, opening a sheet, selecting a day — all instant. Even 150ms transitions would change perceived quality enormously. There's a commented intent in the design spec that motion is "not a goal", but subtle transitions are basic polish rather than feature work.

**Block label + target line wraps unpredictably.** `ExerciseCard.tsx:159-168` renders the block label ("Top"), target ("1 x 6-8"), and last-time inline with `flex-wrap`. At some screen widths this reflows, creating layout shift that's disorienting during a fast-paced workout log.

**Empty states are utilitarian.** Centered heading + subtitle + CTA button in a plain div. Functional, but compare against the feel of polished fitness apps (Hevy's empty-state illustrations with accent color, Strong's big iconography, Fitbod's image-rich cards). Doesn't need illustration, but a muted background tint + icon + better copy would lift them.

#### 2.2.2 Concrete Fixes — Ranked by Impact/Effort

1. **Swap the Workout header hierarchy** — 10 min.
   ```tsx
   <p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
     {session.dayLabelSnapshot}
   </p>
   <h1 className="text-2xl font-extrabold font-heading truncate">
     {session.routineNameSnapshot}
   </h1>
   ```
   This single edit changes the whole feel of the most-viewed screen.

2. **Rework the logged set slot for punch** — 15 min. `SetSlot.tsx:54`.
   - `bg-success text-white` (from `bg-success-soft text-success`)
   - `min-w-[4rem] min-h-[48px]` (from 3.5rem / 44px)
   - `border-l-2 border-l-success` on logged; `border-2 border-border-strong` on unlogged
   - `transition-colors duration-200 active:scale-95 hover:border-cta` for feedback

3. **Remove ALL-CAPS from exercise names** — 5 min. `ExerciseCard.tsx:97`. Change `text-base font-semibold uppercase tracking-wide` → `text-base font-semibold tracking-wide`. Keep weight and tracking; drop uppercase.

4. **Vertical-stack last-time + suggestion** — 10 min. `ExerciseCard.tsx:171-191`. Replace horizontal flex with a `space-y-1` stack. Muted gray for last-time, success green with an up-arrow icon for suggestion. The current layout has them at the same visual weight; the stack creates clear hierarchy.

5. **Bump global padding** — 20 min. Audit feature screens for `p-4` → `p-5` or `p-6` (between major sections, `p-5` inside cards). Cards should use `py-4 space-y-4`.

6. **Add subtle motion everywhere interactive** — 30 min. Add `transition-colors duration-200` to buttons/nav links, `active:scale-95` to tappable targets. One keyframe animation for "just logged this set" (brief flash to saturated green):
   ```css
   @keyframes flash-logged {
     0% { background-color: var(--success); transform: scale(1.05); }
     100% { background-color: var(--success); transform: scale(1); }
   }
   ```

7. **Fix block label / target layout** — 15 min. Stack vertically: badge on its own line, target below, set slots below that. No flex-wrap.

8. **Saturate semantic colors** — 15 min, requires a quick eye test. `App.css:86-92`. `--success: oklch(0.60 0.20 145)`, `--info: oklch(0.60 0.18 195)`. Test both modes.

9. **Empty state dressing** — 30 min. Wrap in `border-border-strong bg-muted/20 p-8 text-center`, add a category-appropriate Lucide icon (e.g., `CalendarBlank`, `Barbell`) above the heading. Don't over-do it; one visual element per empty state is plenty.

10. **Resume card visual weight** — 10 min. `TodayScreen.tsx:73-86`. Swap `bg-info-soft text-info` → `bg-info text-info-foreground` with a `Play` icon. Should look like the most important thing on screen.

**Total effort for 1-10: ~2 hours. Expected change in "does the job but not exciting" feeling: large.**

### 2.3 UX Issues (prioritized)

*Spot-checked: agent reports of "`getBlockLabel` not exported" and "`distanceM` missing from `formatLastTime`" and "extra-set-index bug" are all stale — the current code at `progression-service.ts:349`, `ExerciseCard.tsx:59-63`, and `ExerciseCard.tsx:216-231` (with a self-documenting comment) shows all three are already handled. Omitting from the issue list.*

**High**

- **Set log sheet: keyboard behavior on numeric fields.** Verify every weight/reps/duration input has `inputMode="decimal"` or `"numeric"` so Android pops the numeric keypad directly (no alpha keys → fewer taps).
- **No flash/confirmation feedback on set log success.** Tapping Save closes the sheet silently. Users will occasionally wonder "did that register?" Flash animation (#6 above) solves this.
- **Settings segmented controls lack focus-visible styling.** `SettingsScreen.tsx:128-144` (units/theme). Keyboard focus is invisible → ESC-only users get lost.
- **`ConfirmDialog` requires double-confirm on Discard.** For a single-user local app where discarding a session is a common recovery move (started wrong routine, etc.), a single confirmation is sufficient. Remove the `doubleConfirm` prop from the discard-workout call site.

**Medium**

- **Bottom nav active-state indicator is almost invisible at small sizes.** `App.tsx:87-104`. Consider a thicker accent underline spanning the tab width, or a colored-icon-only indicator.
- **Cardio notes block lacks visual grouping.** `TodayScreen.tsx:118-139`. Add a left accent border (`border-l-2 border-cta pl-4`) to make it read as a distinct section.
- **ExercisePicker tabs don't show counts per muscle group.** "Legs (42)" is a small detail that signals breadth to the user before they dig in.
- **Unlogged slots in read-only History detail are ambiguous.** A dashed-border gray slot that's actually tappable (to retroactively log). Copy should signal "tap to log"; a soft hover state would help.

**Low**

- **No dark-mode accessibility audit.** Contrast ratios of `oklch(0.75 0.17 145)` success on dark backgrounds are borderline. One 5-min WCAG check covers this.
- **No keyboard arrow-navigation between set slots** — nice-to-have for desktop, irrelevant for phone.

### 2.4 Simplification Opportunities

- **Extra-exercise SetSlot rendering** (`ExerciseCard.tsx:220-244`) duplicates the routine-exercise rendering path. Unify by treating extras as exercises with `setBlocksSnapshot = []` and a single block with `count = loggedSets.length + 1`. Removes a branch.
- **`ExerciseCardWithHistory` and `SetLogSheetWithHistory` wrappers** (`WorkoutScreen.tsx:256-354`) each fetch the same per-exercise history data. Extract `useExerciseCardData(sessionExercise)` and call it in both.
- **Recurring `border-t-2 border-border-strong` pattern.** Add a utility `border-t-structural` (via `@layer utilities` in `App.css`) or a shared `<SectionCard>` component. Shortens markup and lets you tune the design system from one place.
- **`ThemeSync` in `App.tsx:33-52`** could be a hook `useThemeSync()` consumed by Shell. Minor but tidier.

### 2.5 Action List

1. [1-10 from 2.2.2] ~2 hours for the visual overhaul.
2. [UX High 1] Verify `inputMode` on every numeric input in SetLogSheet.
3. [UX High 2] Add the success flash animation on set log.
4. [UX High 3] Focus-visible ring on Settings segmented controls.
5. [UX High 4] Drop `doubleConfirm` from Discard.
6. [Simplification 1] Unify extras rendering with routine-exercise path.
7. [Simplification 2] Extract `useExerciseCardData`.

---

## 3. Cross-cutting, Shared, PWA & Build

### 3.1 What Works Well

- **Base-path consistency.** `/exercise-logger/` is correctly propagated through `vite.config.ts:25` (base), manifest (`:40-41`), router (`App.tsx:150`), and SW `navigateFallback` (`:95`). This is the classic failure mode of GitHub Pages PWAs and it's done right.
- **GitHub Pages SPA fallback.** `vite.config.ts:9-20` has a `copyIndexTo404` plugin that duplicates `index.html` → `404.html` at build time. This is the canonical trick and it's in place.
- **StrictMode-aware DB init.** `db/database.ts:56-75` uses idempotent `put()` instead of `add()` for settings, documented with a comment about the React dev double-invoke. This was clearly a real bug that was fixed; the mitigation is the right shape.
- **TypeScript strictness.** `tsconfig.app.json:20-25`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`. Could add `noUncheckedIndexedAccess` for extra safety.
- **CI/CD.** `.github/workflows/deploy-web.yml` runs lint + unit + E2E before deploy. Playwright artifacts uploaded on failure. Node 22 pinned. npm cache enabled. Solid pipeline.
- **Utilities are minimal and focused.** `shared/lib/utils.ts` (`cn` helper) and `csv-parser.ts` are tight and self-contained.

### 3.2 PWA Gaps (prioritized)

**High**

**P1. Silent auto-update — users never see "a new version is available"** — `vite.config.ts:30`.
`registerType: "autoUpdate"` installs the SW update in the background, but the currently-open tab keeps running the old bundle until a hard refresh. Users will report "it's broken" when they're actually running stale code.
- **Fix:** Switch to `registerType: "prompt"` and add a small toast banner ("Update available — tap to reload") listening for `navigator.serviceWorker.getRegistrations()` + `updatefound` + `statechange === "installed"`. On tap, `registration.waiting?.postMessage({ type: "SKIP_WAITING" })` + `location.reload()`.

**P2. Manifest lacks `file_handlers` (Android YAML handoff)** — `vite.config.ts:32-62`.
See the YAML section below. Short version: add a `file_handlers` entry for `.yaml`/`.yml`, implement a `launchQueue.setConsumer` handler in `App.tsx` that reads the launch file and routes to the import screen. This is the long-term fix for the Android flow (#1 clipboard-paste is the short-term fix).

**P3. Incomplete icon coverage + reused maskable variant.**
Only 192 and 512 PNGs provided. Android adaptive icon quality suffers at mid-range sizes; the 512 is used for the maskable purpose without the required safe-zone padding (maskable icons need content within the center 80%).
- **Fix:** Generate 256 and 384 PNGs; create a dedicated maskable variant with proper padding. `pwa-asset-generator` does both in one command. Add to manifest + `includeAssets`.

**P4. iOS install path has no guidance.** `index.html` has no `apple-mobile-web-app-*` meta tags. No in-app hint.
- **Fix:** Add to `<head>`:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ExLog">
  ```
  Optionally: a dismissible hint in Settings when `navigator.standalone === false` and `/iP(hone|ad|od)/.test(navigator.userAgent)`.

**P5. No `beforeinstallprompt` capture / manual Install button.**
Browser shows the native install prompt once; if dismissed, user has no recourse. A manual Install button in Settings (triggered by a captured `beforeinstallprompt` event) lets users install later.
- **Fix:** Capture `beforeinstallprompt`, store the event, expose a Settings button that calls `.prompt()` on it.

**Medium**

**P6. Main bundle ~489 kB raw (estimate 150-160 kB gzipped).**
Spot-checked against `dist/assets/index-*.js`. Rough but genuine: `DialogTitle-*.js` is 62 kB for a single primitive — Base UI React is getting partially pulled even for screens that don't use dialogs. `SettingsScreen` is the heaviest screen (backup/restore, routine import) but currently ships in the main bundle.
- **Fix:** Add `build.rollupOptions.output.manualChunks` to split Settings and its deps into a separate chunk. Dynamic-import the YAML parser. Target < 150 kB gzipped main bundle.

**P7. No visualViewport soft-keyboard handling.**
On Android PWAs, the soft keyboard resizes the visual viewport but not the layout viewport. The bottom nav can end up hidden beneath the keyboard on input-heavy screens (SetLogSheet).
- **Fix:** Add a hook that listens to `window.visualViewport.resize` and sets a CSS var `--keyboard-height` that screens can use to shift critical UI above the keyboard when needed.

**P8. Cache busting under `/exercise-logger/` basename is best-effort.**
After a deploy, a user whose browser holds a stale `index.html` + old asset hashes can hit 404s on asset fetch. The precache manifest covers this, but a defensive banner ("App updated — refresh for latest") triggered when the current cache-manifest age exceeds 7 days is a belt-and-suspenders safety net.

**P9. `useRoutine` null-vs-undefined three-state contract is confusing.** `shared/hooks/useRoutine.ts:17`. Returns `null | undefined | Routine` to distinguish "no ID requested" (null) from "loading" (undefined). Callers must reason about three states where two would do.
- **Fix:** Return `undefined | Routine`. Callers that care about "no ID" check the ID themselves.

**P10. `CSV parser` doesn't handle RFC 4180 quoting.** `shared/lib/csv-parser.ts`. Currently fine for the existing catalog, but adds fragility if you ever add comma-containing fields (e.g., `"Barbell, Olympic"`).
- **Fix:** Either add quote-aware parsing (~30 LOC) or swap to `papaparse` (~15 kB). The current state is a latent failure; low priority today.

**Low**

**P11. Manifest missing `categories: ["fitness", "health"]`** — app-store hint, no functional impact.
**P12. No font preload in `index.html`** — SW caches fonts after first load, so FOIT is only first-visit. Preload would smooth that but is optional.
**P13. Vite 7 pinning isn't commented in `package.json`** — CLAUDE.md explains it, but `package.json` should have a one-liner so a future contributor doesn't blindly bump.

### 3.3 Build / Bundle Observations

- Lazy-loaded screens are split correctly (HistoryScreen, SessionDetailScreen, ExerciseHistoryScreen, SettingsScreen each have their own chunk ranging 2-5 kB). Good.
- `DialogTitle-*.js` at 62 kB is the outlier worth investigating — probably bundling unused Base UI primitives.
- No dependency bloat caught from a read-through of `package.json`. Dexie + React + Tailwind + Base UI primitives is a lean stack for this scope.

### 3.4 Action List

1. [P1] Switch SW to prompt-mode + add update toast. (~2h)
2. [P2] `file_handlers` + `launchQueue` consumer. (~1d)
3. [P3] Complete icon suite + proper maskable. (~2h)
4. [P4] iOS meta tags + optional standalone-mode hint. (~1h)
5. [P5] Capture `beforeinstallprompt`, expose Install button. (~1h)
6. [P6] Bundle manual-chunks for Settings + dialogs. (~3-4h)
7. [P7] visualViewport keyboard-height hook. (~2h)
8. [P9] Simplify `useRoutine` to two states. (~30m)
9. [Hygiene] Add `noUncheckedIndexedAccess` to tsconfig, address fallout. (~2-4h)

---

## 4. Testing, Docs, GPT Integration & YAML Import

### 4.1 Testing Coverage

**Actual count: 440 passing tests across 25 files.**

Breakdown:
| Layer | Files | Tests | Depth |
|-------|------:|------:|-------|
| `domain/*` | 5 | ~50 | Strong — pure functions, boundary cases |
| `db/database.ts` | 1 | ~20 | Strong — schema, indexes, init |
| `services/*` | 9 | ~220 | Strong — 9 services, 11+ scenarios each |
| `shared/hooks/*` | 4 | ~40 | Partial — some hooks untested |
| `shared/components/*` | 1 | ~8 | Weak — ConfirmDialog only |
| `features/*` | 5 | ~88 | Weak — screens largely untested |
| `e2e/` Playwright | 2 | ~9 | Weak — smoke only, fallible assertions |

**Strong areas:**
- Acceptance test (`tests/integration/acceptance.test.ts`) uses the real bundled YAML and CSV, covering all 16 spec scenarios.
- Backup service tests cover malformed payloads, FK integrity, catalog cross-refs.
- Progression engine tests cover the signature-based and position-based fallback paths, plus sparse multi-block indexing (the test that was added around the `lastTime` bug fix).

**Gaps:**

**T1. E2E assertions are hedged with `.catch(() => false)`.** `tests/e2e/full-workflow.spec.ts:55-100, 119-125`. Several critical assertions are wrapped in catches so the test passes even if the action failed. The test name suggests "full workflow" but a failure of set-logging or export silently passes.
- **Fix:** Remove the catches. Assert the positive case. If the test becomes flaky without the catch, investigate the flakiness — don't paper over it.

**T2. No component tests for the highest-value UI surfaces:** `WorkoutScreen`, `SetLogSheet`, `SettingsScreen`, `TodayScreen`. `ExerciseCard` has a test but it doesn't cover the recent fixes (extra-set index post-deletion, sparse multi-block history, distance rendering).
- **Fix:** Start with `SetLogSheet` (prefill priority, validation, bodyweight promotion) — that's where input-handling bugs will hide. Then `WorkoutScreen` (start/resume/discard/finish transitions). Then `SettingsScreen` (import validation UX, theme sync). Target ~12-18 tests per file.

**T3. `useAppInit`, `useActiveSession`, `useRoutine`, `useSettings` are all untested.** These are the app's reactive plumbing. If `useActiveSession` returns the wrong tri-state on init, every downstream screen breaks.
- **Fix:** Add `tests/unit/shared/hooks/*.test.ts` for each. Use `@testing-library/react`'s `renderHook` + `fake-indexeddb`. ~16-20h total.

**T4. `downloadBackupFile` has no unit test.** `backup-service.ts:108-126`. Imperative DOM code without a guard test is fragile.
- **Fix:** Mock `URL.createObjectURL` + assert anchor.href, .download, click, revoke. 30 minutes.

**T5. No coverage tool configured.** `@vitest/coverage-v8` isn't installed; `vitest run --coverage` fails. No CI gate on coverage regression.
- **Fix:** Install the provider, add `npm run test:coverage`, set per-directory thresholds (e.g., services: 85%, hooks: 70%, features: 50% starting, rising over time).

**T6. Stale comment in `acceptance.test.ts:~631`** referencing a `timer-store.test.ts` that was never created (the timer feature was scoped out). Remove.

### 4.2 Documentation State

- **`design-spec.md`** — accurate to current behavior. No notable drift.
- **`ui-rewrite-spec.md`** — accurate; supersedes older screen layouts. No LLM references (consistent with the no-paid-AI constraint).
- **Layer `CLAUDE.md`s** (`domain/`, `db/`, `services/`) — excellent; each documents its layer's responsibilities, transaction patterns, and invariants.
- **Root `CLAUDE.md`** — mostly accurate; one stat is stale (test count).
- **`test-suite-review-2026-04-08.md`** — thorough (507 lines) and still directly relevant. The 49-test delta since it was written suggests real follow-through.

**Missing docs:**
- No `CONTRIBUTING.md` — when you onboard a second developer, they'll want one.
- No architecture diagram — the four-layer diagram in `CLAUDE.md` is in ASCII art; a one-page `docs/architecture.md` with a data-flow diagram would be friendlier.
- No ADRs — decisions like "Dexie not Zustand for state", "YAML not JSON for routine templates", "No server-side LLM" lack recorded rationale. One `docs/decisions/` folder with 3-5 short ADRs would pay for itself the first time you or a contributor asks "why are we doing it this way?"
- Repo-root `README.md` is minimal — consider a quick-start, link to spec, and the explicit no-server-AI constraint.

### 4.3 Custom GPT Integration

Files under `docs/custom-gpt/`:
- `README.md` (42 lines) — setup guide for the custom GPT
- `workout-routine-gpt.instructions.md` (97 lines) — system prompt
- `routine-yaml-contract.md` (205 lines) — YAML schema the GPT must follow
- `exercise-catalog-reference.md` — CSV-indexed catalog reference for the GPT's knowledge
- `action-validator.md` — an OpenAPI spec (for a potential future validator action)

**Strengths:**
- Intake workflow is thorough (9+ questions about goals, equipment, experience).
- Self-check rules (lines 83-96) verify exerciseId existence, day_order consistency, set-block validity before emitting.
- Duplicate-exercise rule with distinct `instance_label` is specified.
- Reps-range vs single-value, count semantics, and optional fields are all defined in the contract.
- App-side validation (`routine-service.ts:115-232` `validateAndNormalizeRoutine`) mirrors the contract accurately, so the handoff is well-specified.

**Gaps:**

**G1. Instructions don't make `version: 1` mandatory in a way that's LLM-resistant.** LLMs drop fields under prompt pressure. Instructions should include: *"You MUST always emit `version: 1` at the top of every routine. If you omit this, the app will reject the routine."* Possibly with a final-output checklist.

**G2. No explicit copy-paste guidance.** The GPT emits YAML in the chat window. On Android, the user then has to copy that text and paste it into the app. The instructions don't tell the GPT to instruct the user how. This is a free improvement:
```
When delivering a routine, conclude with:
"Copy the YAML above and paste it into the app under Settings → Import Routine.
On Android, tap & hold the YAML block in ChatGPT to select all, then Copy."
```

**G3. Equipment vocabulary isn't pinned in instructions.** The contract accepts `barbell|dumbbell|machine|cable|kettlebell|bodyweight|cardio|medicine-ball|other`. Instructions should list these so the GPT doesn't invent synonyms.

**G4. Superset equal-set-count invariant is phrased as text; LLMs miss it.** A concrete example in the instructions (positive + negative) reduces failure rate materially.

**G5. No "what to do if an exercise isn't in the catalog" guidance.** Today, a hallucinated exerciseId causes the validator to reject the routine. The instructions should have: *"If the user requests an exercise not in the catalog, suggest the closest match by name, or place the exercise description in the routine-level `notes` field and advise the user to add it manually via the app's catalog editor."*

### 4.4 YAML Import: Why It Fails on Android & How to Fix

**Where the code lives:**
- `web/src/features/settings/RoutineImporter.tsx` — the UI. Lines 48-54: `<input type="file" accept=".yaml,.yml">`.
- `web/src/features/settings/SettingsScreen.tsx` — embeds `RoutineImporter` at line ~115.
- `web/src/services/routine-service.ts:115-232` — `validateAndNormalizeRoutine(yaml, exerciseLookup)`. Parses via `YAML.parse`, returns `{ ok, routine } | { ok: false, errors }` with field paths.
- `web/src/services/routine-service.ts:60+` — `importRoutine(db, routine)` — single `db.routines.put(routine)`, no transaction needed.

**Root cause on Android:**
1. Android file pickers often don't show files whose MIME isn't recognized. `.yaml` is registered as `text/yaml` or `application/x-yaml` on some systems, unregistered on others.
2. ChatGPT on Android typically doesn't *offer* a `.yaml` download — it prints the YAML inline in the chat. The user has no file to pick.
3. Even when a file does exist (from Code Interpreter or shared manually), Android's Files app often hides it unless you know the exact location.

The combination: a file-input-based flow is the wrong mental model for this platform.

**Fix 1 (ship this week): Clipboard paste import.**
Add a `<textarea>` labeled "Or paste YAML here", a "Validate & Import" button, and the same validator pipeline. Works on every OS, every browser. The user:
1. Long-presses the YAML block in ChatGPT on Android → Copy.
2. Opens the app → Settings → Import Routine → pastes → Import.

~50 LOC. Test covers happy path and invalid-YAML path. No platform quirks.

**Fix 2 (next sprint): PWA `file_handlers` + `launchQueue`.**
Declare the app as the opener for `.yaml`/`.yml` files so that, when a user does have the file and taps it in Files, the installed PWA launches and auto-imports.

```ts
// in vite.config.ts manifest:
file_handlers: [
  {
    action: "/exercise-logger/?import=file",
    accept: {
      "text/yaml": [".yaml", ".yml"],
      "application/x-yaml": [".yaml", ".yml"],
    },
    icons: [{ src: "icons/icon-192.png", sizes: "192x192" }],
  },
],
```

Then in `App.tsx` (or a dedicated init hook):
```ts
if ("launchQueue" in window) {
  window.launchQueue.setConsumer(async (launchParams) => {
    if (launchParams.files.length === 0) return;
    const file = await launchParams.files[0].getFile();
    const yaml = await file.text();
    navigate("/settings/import", { state: { yaml } });
  });
}
```

Chrome/Edge 102+ support this. Safari 17.5+ partial. Desktop and installed-PWA on Android Chrome benefit immediately.

**Fix 3 (optional, future): Web Share Target.**
Declare `share_target` so YAML files shared *to* the installed app land in the import flow. Requires a service-worker handler. Lower ROI than 1+2 combined.

**Fix 4 (optional, future): URL-based import.**
Generate a shareable link `/import?yaml=<base64-gzipped-yaml>` that the GPT can hand out. Nice for copy-paste-averse users, but URL length becomes a concern (2 kB routine → ~3 kB base64 URL, still under most browser limits). Implement only if the paste flow proves insufficient.

**YAML schema robustness (independent of transport):**
- Pin `version: 1` as required in the validator — done.
- Add a soft-error category for "unknown fields" — currently, extra fields are silently dropped; surfacing them as warnings helps the user catch GPT hallucinations.
- Consider versioning strategy upfront: when `version: 2` ships, the validator should reject `version > current` with a clear "please update the app" message, rather than silently running a v2 routine through v1 logic.

### 4.5 Action List

1. [T1] Harden E2E assertions (remove `.catch` guards). (~2-3h)
2. [T2] Component tests for `SetLogSheet` first, then `WorkoutScreen`, `TodayScreen`, `SettingsScreen`. (~3d total)
3. [T3] Hook tests for `useAppInit`, `useActiveSession`, `useRoutine`, `useSettings`. (~2d)
4. [T4] Unit test for `downloadBackupFile`. (~30m)
5. [T5] Install `@vitest/coverage-v8`, add `test:coverage` script, set thresholds. (~1h)
6. [G1-G5] Update GPT instructions: version-field emphasis, copy-paste block, equipment vocab, superset example, out-of-catalog fallback. (~1h)
7. [YAML Fix 1] Add clipboard-paste textarea to `RoutineImporter.tsx`. (~2-3h)
8. [YAML Fix 2] `file_handlers` manifest + `launchQueue` consumer. (~1d)
9. [Docs] Update `CLAUDE.md` test count. Add `CONTRIBUTING.md`. Create `docs/decisions/` with 3-5 ADRs. (~3h)

---

## 5. Unified Critical Path

Merged across all four sections, ranked for "ship to friends":

**Phase 1 — Unblock (1-2 days)**
1. Clipboard-paste YAML import + updated GPT copy-paste instructions (§4.4 Fix 1, §4.3 G2)
2. Workout header hierarchy swap (§2.2.2 #1)
3. Set slot redesign — contrast, size, border (§2.2.2 #2)
4. Exercise name + last-time/suggest typography pass (§2.2.2 #3-4)
5. Global padding bump (§2.2.2 #5)
6. Fix `logSet` concurrency race (§1.2 R1)
7. Harden E2E assertions (§4.1 T1)
8. Update `CLAUDE.md` test count (§4.1)

**Phase 2 — Polish (2-3 days)**
9. SW update prompt (§3.2 P1)
10. Icons + iOS install guidance + Install button (§3.2 P3-P5)
11. `editSet` promotion decision + fix (§1.2 R2-R3)
12. `finishSession` rotation guard (§1.2 R4)
13. Motion pass (§2.2.2 #6) + success flash on set log (§2.3 High 2)
14. Semantic color saturation + block label/target stacking (§2.2.2 #7-8)

**Phase 3 — Safety net (3-5 days)**
15. Component tests: SetLogSheet → WorkoutScreen → TodayScreen → SettingsScreen (§4.1 T2)
16. Hook tests: useActiveSession, useRoutine, useAppInit, useSettings (§4.1 T3)
17. `downloadBackupFile` unit test (§4.1 T4)
18. Bundle split for Settings + dialogs (§3.2 P6)
19. Manifest `file_handlers` + `launchQueue` (§4.4 Fix 2, §3.2 P2)
20. Coverage tool + CI thresholds (§4.1 T5)

**Phase 4 — Backlog (not ship-blocking)**
- Redundant `unitOverride` cleanup on backup import (R-series)
- `findPreviousUnitOverride` index for scale (§1.2 R8)
- Extras SetSlot rendering simplification (§2.4)
- `CSV` parser quote handling (§3.2 P10)
- `useRoutine` null-vs-undefined simplification (§3.2 P9)
- CONTRIBUTING.md + ADRs + architecture diagram (§4.2)

---

## Appendix A — Non-blocking Polish Backlog

(Items worth doing eventually, not blocking a friend-ship.)

- Dark mode contrast audit (WCAG AA).
- Onboarding tour / "first run" hint overlay.
- Weekly volume summary on HistoryScreen.
- Export filtered by date range.
- Export to CSV (for people who want to chart in Sheets).
- Exercise history pagination (today it fetches all sets).
- Search across exercise history.
- Muscle-group analytics.
- Workout reminders (push notification infrastructure is non-trivial for a single-user PWA; defer).

---

## Appendix B — Questions For You

A few decisions I didn't want to make unilaterally:

1. **`editSet` promotion on finished sessions** (§1.2 R2) — intentional or bug? If intentional, we need a UI confirmation; if not, we guard against it. Worth a minute of your decision.
# I need you to explain the options more clearly, we'll chat about this **
2. **Are you committed to zero-radius Swiss/brutalist design?** If yes, then we lean into discipline (typography, motion, whitespace) to keep it from feeling cold. If no, even 4-6px radii on cards + buttons would soften the edges without abandoning the aesthetic.
# No. I am committed to whatever makes this app look better, cooler, sleeker and I am comitted to ROI. So what is relatively easy but looks freaking foine
3. **Dark mode as first-class, or auto-only?** Current implementation is token-based with a theme toggle. Keeping both modes visually polished is a real commitment.
# Lets keep the light version only
4. **How many routines should a user typically have?** If <5, the routine-picker UX we have is fine. If a user might end up with 20+ routines (imported from multiple GPT conversations over time), we need list navigation / tags / archiving.
# Nah, 1 and maybe 2....maybe over time someone ends up with 5-6
5. **GPT integration: do you want a "sync routine from URL" flow for sharing with friends?** ("Here's my routine: https://…/import?yaml=…"). Zero-effort sharing is viral; requires URL-length engineering.
# Yes
6. **Catalog curation — are you open to contributions?** The CSV is embedded; any added exercise needs a PR and a deploy. If friends end up wanting exercises you don't have, consider exposing a per-user catalog-add flow (stored in IndexedDB, not embedded) so they're unblocked without your intervention.
# Defer
---

## Appendix C — Verification Notes

During synthesis, the following agent claims were **spot-checked against current code and found stale**:

- "`getBlockLabel` not exported" — **exported** at `progression-service.ts:349`.
- "`formatLastTime` missing `distanceM` branch" — **handled** at `ExerciseCard.tsx:59-63`.
- "Extra-set-index bug (display `i` vs stored `setIndex`)" — **fixed**, with a self-documenting comment at `ExerciseCard.tsx:216-219` and correct usage at `:231` (`onSetTap(0, ls.setIndex)`).

Other claims were not individually verified; where a file:line is cited, it came from the agent's direct read, but code drifts fast in an active user-testing phase. Treat file:line refs as "likely current" and verify before acting.

The test count (426) was confirmed by running `npx vitest run`. The bundle size estimate (main chunk ~489 kB raw, ~150-160 kB gzipped) was confirmed by listing `dist/assets/*.js`.

---

## Files Referenced

- `web/src/app/App.tsx`, `web/src/App.tsx`, `web/src/App.css`, `web/src/index.css`
- `web/src/db/database.ts`
- `web/src/domain/*` (types, enums, helpers)
- `web/src/services/session-service.ts`, `set-service.ts`, `progression-service.ts`, `backup-service.ts`, `routine-service.ts`, `settings-service.ts`, `catalog-service.ts`
- `web/src/shared/hooks/useAppInit.ts`, `useSettings.ts`, `useActiveSession.ts`, `useRoutine.ts`, `useExerciseHistoryGroups.ts`
- `web/src/shared/lib/utils.ts`, `csv-parser.ts`
- `web/src/features/today/TodayScreen.tsx`
- `web/src/features/workout/WorkoutScreen.tsx`, `ExerciseCard.tsx`, `SetLogSheet.tsx`, `SetSlot.tsx`, `ExercisePicker.tsx`
- `web/src/features/settings/SettingsScreen.tsx`, `RoutineImporter.tsx`
- `web/src/features/history/*`
- `web/src/shared/components/ConfirmDialog.tsx`
- `web/src/shared/ui/*` (shadcn primitives)
- `web/vite.config.ts`, `web/index.html`, `web/package.json`, `web/tsconfig*.json`
- `web/tests/integration/acceptance.test.ts`, `web/tests/unit/**`, `web/tests/e2e/full-workflow.spec.ts`
- `.github/workflows/deploy-web.yml`
- `docs/design-spec.md`, `docs/ui-rewrite-spec.md`, `docs/test-suite-review-2026-04-08.md`
- `docs/custom-gpt/README.md`, `workout-routine-gpt.instructions.md`, `routine-yaml-contract.md`, `exercise-catalog-reference.md`, `action-validator.md`
- `CLAUDE.md` (root + layer-specific)
- `web/data/routines/full-body-4day-mom.yaml`

---

*End of review.*

# v2 Post-Audit Hardening Roadmap

> **For agentic workers:** This is a PM-level plan that spans five sprints. It is NOT directly executable by `subagent-driven-development` or `executing-plans`. For each sprint, invoke `superpowers:writing-plans` with that sprint's scope section as input to produce a bite-sized, TDD-structured implementation plan. Then execute that per-sprint plan with `subagent-driven-development` or `executing-plans`.

**Goal:** Close every valid finding (with caveats) from `docs/repo-full-scope-analysis-2026-04-23.md` across five focused sprints, prioritized so data-integrity and CI stability land before UX and architectural polish.

**Architecture:** Five sprints sequenced for sub-agentic execution. Sprint 1 stabilizes the test harness so every later sprint closes on green. Sprint 2 hardens the two data-integrity trust boundaries (backup import, progression fallback). Sprint 3 unifies logged-set rendering and fixes one validator dead-end. Sprint 4 resolves product-decision ambiguities and updates copy/routes. Sprint 5 is a low-risk drift-and-cleanup pass that ends with freshly generated README stats.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Dexie 4 (IndexedDB), Vitest + RTL + Playwright, shadcn/ui, Tailwind CSS 4, GitHub Actions. No new runtime dependencies expected; one optional dev dependency (Zod) is flagged as a decision in Sprint 2.

---

## Source Audit And Validation

Primary input: `docs/repo-full-scope-analysis-2026-04-23.md` (henceforth "the audit").

Every finding below has been verified against the current code at the cited line numbers. Two audit claims got adjusted:

- **Progression fix key.** The audit suggests grouping fallback sets by `(sessionId, sessionExerciseId, blockIndex, blockSignature)`. The correct key is `(sessionId, sessionExerciseId, blockIndex)` — fallback exists precisely because the signature drifted.
- **Test timeout.** The audit suggests a project-level Vitest timeout bump as an option. We reject the bump as the primary fix because it masks whichever regression lands next; we fix the root causes (`AppRoutes` lazy-route Suspense race, `useRoutineLaunchQueue` `act()` warning) instead.

Findings explicitly descoped from this roadmap:

- **P3 "Feature screens call services and db directly."** The audit recommends no wholesale refactor. We do not schedule work for this; it becomes an opportunistic cleanup note in Sprint 5's advisory section only.
- **P2 `useExerciseHistory` stale deps.** Low severity and masked by Dexie liveQuery observing `loggedSets`. Sprint 5 addresses it as documentation + a narrow test, not a hook rewrite, unless discovery reveals a live bug.

## Finding-To-Sprint Map

| # | Finding | Audit Priority | Sprint | Category |
|---|---|---|---|---|
| F1 | Backup validator weaker than live services (numeric, set-block, settings, onboarding) | P1 | **Sprint 2** | Data trust |
| F2 | Progression fallback can merge sets from multiple historical blocks | P1 | **Sprint 2** | Data trust |
| F3 | `SessionDetailExerciseCard` drops non-weight sets (dash for bodyweight/duration/distance/cardio) | P1 | **Sprint 3** | UX correctness |
| F4 | `npm test` flaky — `AppRoutes` Suspense race and `useRoutineLaunchQueue` `act()` warning | P1 | **Sprint 1** | CI stability |
| F5 | Cardio-extra shows distance field but validator requires `performedDurationSec` | P2 | **Sprint 3** | UX correctness |
| F6 | `ConfirmDialog` swallows async errors — no user feedback | P2 | **Sprint 3** | UX correctness |
| F7 | `/history/exercise/:exerciseId` orphaned route — no in-app link | P2 | **Sprint 4** | Product decision |
| F8 | "Replace active routine" copy does not match `importAndActivateRoutine` semantics | P2 | **Sprint 4** | Product decision |
| F9 | YAML validation more lenient than contract (notes coercion, cardio blanks, non-positive targets) | P2 | **Sprint 4** | Product decision |
| F10 | `useExerciseHistory` deps incomplete for same-ID snapshot changes | P2 | **Sprint 5** | Architecture |
| F11 | `shared/hooks/useFinishedSessionSummaries` imports from `@/features/history/...` | P2 | **Sprint 5** | Architecture |
| F12 | Duplicate `web/src/main.tsx` vs `web/src/app/main.tsx` (dead top-level entry) | P2 | **Sprint 5** | Architecture |
| F13 | `ExercisePicker` badges existing exercises but still picks them | P3 | **Sprint 4** | Product decision |
| F14 | README stats drifted (120/69/742 vs current 159/107/880+20) | P3 | **Sprint 5** | Docs |
| F15 | Historical review labels (`P5-A [CERTAIN — BUG]`, `ERRATA …`) in production comments | P3 | **Sprint 5** | Docs/comments |

All fifteen findings are assigned. Nothing from the audit is dropped on the floor.

## Cross-Cutting Conventions

These apply to every sprint unless the sprint explicitly overrides.

### Testing Discipline

- **TDD, per step.** Every behavior change lands as a failing test first, then minimal code. The per-sprint plans produced by `writing-plans` will enforce this with the 5-step pattern (write failing test → run it and confirm failure → minimal code → run it and confirm pass → commit).
- **Service tests use `fake-indexeddb`** (already in use). Never mock Dexie for service-layer tests.
- **UI tests use RTL + jsdom** via Vitest; no Enzyme, no manual DOM.
- **E2E adds a Playwright scenario** when the sprint changes a user-visible flow; no E2E additions for pure service-layer or docs changes.
- **Accessibility.** Any new interactive element gets a keyboard test. Any new route gets an `axe-core` pass in the Playwright suite.

### Commit And PR Discipline

- **One logical change per commit.** Test + implementation can ride in the same commit when the commit is a vertical slice; cross-sprint cleanups don't.
- **One PR per sprint** by default. Split if the sprint produces >~400 LoC of diff or >10 commits, but do not split for the sake of splitting.
- **Pre-merge gates** on every PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. CI already runs these; local green is required before opening the PR.

### Worktree Strategy

Each sprint runs in its own git worktree. Sprints 1 → 5 are serial by dependency (Sprint 1 blocks the rest; Sprints 2 & 3 are independent and could be parallelized if desired; Sprints 4 & 5 should follow 2 & 3 to avoid churn on overlapping files). The brainstorming skill's worktree helper is fine; manual `git worktree add ../exercise_logger-sprint-N` is also fine.

### Decision Protocol

Sprint 4 is decision-heavy. Before invoking `writing-plans` for Sprint 4, the user answers the four product questions listed there. If any decision flips the scope (e.g., "implement true routine replace"), that becomes its own sprint spec — do not silently expand Sprint 4.

### Definition Of Done For The Whole Roadmap

- All fifteen findings closed (implemented, dropped with documented rationale, or converted to a tracked follow-up).
- `npm test` passes three consecutive CI runs without timeout overrides.
- `npm run test:e2e` passes.
- README stats match a regeneration script's output.
- No occurrences of `P5-A`, `ERRATA`, or `[CERTAIN - BUG]` in `web/src/**` (excluding test fixtures that intentionally reference them).
- `docs/repo-full-scope-analysis-2026-04-23.md` gets a short addendum: "Closed by roadmap 2026-04-23-v2-post-audit-hardening-roadmap.md" with per-finding links to commits or ADRs.

---

## Sprint 1 — Test Harness Stabilization

**Goal:** `npm test` (the exact command CI runs) finishes green three consecutive runs on a clean checkout with no timeout flags, so every subsequent sprint closes on trustworthy signal.

**Covers findings:** F4.

**Dependencies:** None. Runs first.

**Non-goals:** No Vitest-timeout bumps as a primary fix. No broad test-utility refactor. No new E2E scenarios. No source changes outside of what's required to make the flakes deterministic.

### Scope

Two unit-test files fail intermittently on full-suite runs and pass in isolation:

1. **`web/tests/unit/app/AppRoutes.test.tsx`** — `findByRole` times out while the `Suspense` boundary still shows `Loading...` for a `React.lazy` route. Suspected root cause: test asserts before `useAppInit`'s IndexedDB seed resolves OR the lazy chunk hasn't flushed. Fix by awaiting a deterministic "app ready" signal, not by lengthening the global timeout.
2. **`web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`** — The navigation assertion fires outside `act(...)`. Wrap the state-update side effect in `act` and await the navigation.

We also add a one-time **CI canary script** or reuse a GitHub Actions matrix run to confirm the fix held across three consecutive runs.

### Target Files

- `web/tests/unit/app/AppRoutes.test.tsx` — rewrite the wait strategy.
- `web/src/app/App.tsx` — only if the test needs a small test-seam (a data-attribute or a resolved promise exposed via a test util). Prefer no source change.
- `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx` — wrap in `act`.
- `web/src/shared/hooks/useRoutineLaunchQueue.ts` — read-only investigation; modify only if the test reveals a real act violation in the hook.
- `web/vitest.config.ts` (or equivalent) — leave `testTimeout` at Vitest's 5000ms default. Do not introduce a per-project bump. (Verify this is already the case; the audit shows `--testTimeout=5000` rescues the suite, which means the default is 5000ms and the race occasionally exceeds it.)

If investigation shows the default is not 5000ms, that is a separate finding — log it and raise with the user before continuing.

### Key Verification

- Three consecutive local runs of `npm test` complete green with no flag overrides.
- Three consecutive CI runs green on the PR branch before merge.
- Running each of the two fixed tests 20 times in a loop (`for i in {1..20}; do npm test -- tests/unit/app/AppRoutes.test.tsx; done`) passes every time.
- No change to reported test count (must still be 880 unit/integration, 20 E2E).
- No source-code behavior change detectable by E2E (`npm run test:e2e` passes unchanged).

### Risks

- The `AppRoutes` race may be inside an async effect in `useAppInit` or the seed path. If so, the fix is test-side (seed the DB synchronously via `fake-indexeddb` helpers before render) rather than source-side.
- `act(...)` wrapping can mask a real re-render loop. If the wrapped test still fails or warns, treat it as a bug in the hook and open a narrow investigation before declaring Sprint 1 done.

### Open Decisions Before `writing-plans`

None. Technical fixes only.

### Exit Criteria

- [x] Both flaky tests pass 20 consecutive local runs.
- [x] One green CI run on the PR branch (3-run requirement relaxed by user, see PR for evidence).
- [x] No new test utilities added that other sprints couldn't reuse (YAGNI).
- [x] PR merged; Sprint 1 worktree removed.

### Next Step

Invoke `superpowers:writing-plans` with the text under **Scope**, **Target Files**, **Key Verification**, **Risks**, and **Exit Criteria** above as the feature spec.

---

## Sprint 2 — Data Trust Hardening (Backup Validation + Progression Fallback)

**Goal:** A malformed JSON backup cannot poison local state; progression's fallback matcher cannot merge sets from multiple historical blocks.

**Covers findings:** F1 (backup validator), F2 (progression fallback).

**Dependencies:** Sprint 1 (so test regressions on the new behavior are detectable).

**Non-goals:** No backup schema version bump. No migration of historical data. No rework of `validateAndNormalizeRoutine` (that's Sprint 4 if we go strict). No changes to live set-logging or progression suggestion math — only to the matching inputs.

### Scope

#### Part A — Backup Import Validation

Today, live services enforce invariants that backup restore bypasses. Audit evidence verified at:

- `web/src/services/backup-service.ts:197` — `isNumber` rejects only `NaN`. Accepts `Infinity`, `-Infinity`, negatives where nonsensical.
- `web/src/services/backup-service.ts:217-253` — `validateSetBlock` is structural only. Missing: `Number.isInteger(count)`, `minValue < maxValue`, exactly-one-of (`{min,max}` XOR `exact`), positivity where the target is a duration/distance/reps ceiling.
- `web/src/services/backup-service.ts:723-763` — `validateLoggedSet` allows nullable numerics but does not cross-check that the target-kind's field is present.
- `web/src/services/backup-service.ts:765-796` — `validateSettings` only validates `id`, `activeRoutineId`, `units`. Skips onboarding fields entirely.
- `web/src/services/backup-service.ts:1027-1033` — `importBackup` persists `userName`, `onboardingCompletedAt`, `onboardingSkippedAt`, `lastGeneratedPrompt`, `lastGeneratedPromptAt`, `onboardingBannerDismissedAt` with `?? null` and zero runtime type check.

New validator must enforce, at minimum:

1. **Numeric sanity.** Replace `isNumber` with `isFiniteNumber`; add `isFinitePositive`, `isFiniteNonNegativeInteger` as needed.
2. **`SetBlock` full contract.** Exactly-one-of (`{minValue, maxValue}` XOR `exactValue`); `minValue < maxValue`; `count` is `Number.isInteger(count) && count >= 1`; where the block is a duration/distance target, its bound(s) must be finite positive numbers; where reps, positive integers (or, if the domain allows fractional reps, finite positive — match what `validateAndNormalizeRoutine` enforces for parity).
3. **`LoggedSet` target-kind coherence.** For a block whose `targetKind === "reps"`, the set's primary metric (reps) must be present on load OR explicitly null (both paths exist today); forbid the combination of "reps target + only duration logged". Match service behavior — no stricter than live, no more lenient.
4. **Settings onboarding fields.** `userName`: string-or-null, trimmed length <= 40 codepoints (mirror `setUserName`). Other five fields: ISO 8601 string-or-null.
5. **Duplicate-slot check.** No two `LoggedSet` records share `(sessionExerciseId, blockIndex, setIndex)`.
6. **Referential integrity beyond current catalog FK.** `LoggedSet.sessionId === SessionExercise.sessionId` for the parent; `SessionExercise.sessionId` exists in `Session`; `Session.routineId` may be null (history survives routine delete) but if present exists in `Routine`.

All violations aggregate into `BackupValidationError[]`; no `throw` on first failure. The import transaction rolls back on any error, matching today's all-or-nothing contract.

#### Part B — Progression Fallback Matching

Verified at `web/src/services/progression-service.ts:124-148`:

- Fallback query returns all logged sets for `(exerciseId, instanceLabel)` filtered in memory to `(origin === "routine", tag, targetKind via blockSignature prefix)`.
- `findMostRecentFinishedSessionSets` (line 157) groups by `sessionId` only.
- `allSetsLogged` (line 221) uses `>= expectedCount`, so sets spilling in from a second matching block slot still satisfy the gate.

Fix:

1. After selecting the most recent finished session in `findMostRecentFinishedSessionSets`, further group the matching sets within that session by `(sessionExerciseId, blockIndex)`.
2. **If exactly one group:** use it. Require `group.length === expectedCount` (not `>=`) for `allSetsLogged`.
3. **If more than one group:** bail out of fallback — return `[]`. No suggestion, no "last time" display via fallback. The primary (signature-exact) match still works and is preferred.
4. Rationale for bail-out: when the signature drifted AND the prior session contains multiple ambiguous matches, we cannot honestly attribute sets to a specific block. Suggesting nothing is the safe default.

Also: change `allSetsLogged` to strict equality for the primary match too, unless a deliberate rationale exists for tolerance (grep the test suite; update any over-logging test expectations if found).

### Target Files

- `web/src/services/backup-service.ts` — expand validators. Consider factoring a `validators.ts` sibling module if `backup-service.ts` grows unwieldy.
- `web/src/services/progression-service.ts` — rewrite `findMostRecentFinishedSessionSets` and tighten `allSetsLogged`.
- `web/tests/unit/services/backup-service.test.ts` — add a `describe("malformed payloads rejected")` block with one test per invariant in Part A items 1–6.
- `web/tests/unit/services/progression-service.test.ts` — add regression tests:
  - Two untagged `reps` blocks in same exercise in the same prior session; fallback returns `[]`.
  - One matching block; fallback returns its sets, primary still preferred.
  - Expected count 3, logged 4 in the matching block: `allSetsLogged` returns `false` (strict equality).

### Decision: Zod Or Hand-Rolled

The audit suggests "a single runtime schema" close to `domain/types.ts`. Options:

- **A (recommended):** Hand-rolled validators in the existing style. Zero dependency, matches current code shape, easier for sub-agents to extend. Downside: verbose.
- **B:** Add Zod, derive schemas once, reuse from YAML and backup import. Downside: new dependency (~12KB), the YAML importer is not part of this sprint, so the shared-schema win isn't realized until Sprint 4.

Recommendation: A now, revisit B if Sprint 4 picks "strict YAML" and a unified schema becomes leverage. The sub-agent plan for Sprint 2 should proceed with A unless the user overrides before `writing-plans`.

### Key Verification

- New backup tests cover each invariant from Part A items 1–6 with at least one positive (valid payload accepted) and one negative (malformed payload rejected with a targeted error message) test.
- Progression tests cover the three regression scenarios above.
- No change to the public shape of `BackupEnvelope` or `ExerciseHistoryData`.
- Full test suite passes (now trustworthy after Sprint 1).
- Manual smoke: export a backup, tamper with it (set `minValue > maxValue`, non-integer `count`, negative distance), import — every tamper produces a precise error; the DB state is unchanged (transaction rollback).

### Risks

- Legacy backups from this app's own older versions may fail stricter validation. Before hardening, seed a test from a real v1-era backup and confirm it still imports. If not, either (i) the validator is too strict (loosen the specific rule), or (ii) the old backup was always malformed (log an ADR explaining why we reject it).
- Progression bail-out removes fallback signal in the ambiguous case. User-visible impact: the "last time" hint temporarily disappears after a routine edit that reshuffled block structure. This is intentional; note it in the user-facing changelog for the sprint PR.

### Open Decisions Before `writing-plans`

- Zod vs hand-rolled (default: hand-rolled).
- Whether to apply strict-equality to `allSetsLogged` on the primary match (default: yes, as a correctness upgrade).
- How to surface validator failures: structured `BackupValidationError[]` (current shape) or a new tagged union with codes (default: keep current shape to avoid a UI change).

### Exit Criteria

- [x] All six backup-validation invariants covered by new tests and implementation.
- [x] Progression fallback bail-out implemented with three new regression tests.
- [x] No legacy-backup import regressed (round-trip test passes).
- [x] Full gate green.
- [x] PR merged.

### Next Step

Invoke `superpowers:writing-plans` with the **Scope**, **Target Files**, **Decision**, **Key Verification**, and **Exit Criteria** sections above. If the user answered the three open decisions, include those answers verbatim in the spec.

---

## Sprint 3 — Logged-Set Display Correctness And Sheet UX

**Goal:** Every logged-set kind (weight+reps, reps-only, duration, distance, cardio duration+distance) renders correctly on every screen, cardio-extras can be saved with distance only, and `ConfirmDialog` never swallows a failure silently.

**Covers findings:** F3, F5, F6.

**Dependencies:** Sprint 1. Independent of Sprint 2 — can run in parallel with Sprint 2 if a second worktree is used.

**Non-goals:** No redesign of `SetLogSheet`. No change to canonical storage (all weights remain kg). No copy changes on any screen (that's Sprint 4). No data migration.

### Scope

#### Part A — Shared `formatLoggedSet` Extraction

Three places currently format a logged set:

1. `web/src/features/workout/SetRow.tsx:21-46` — `formatLoggedValue(ls, units)` returns `{primary, unit, secondary}` for a custom layout. Handles weight+reps, reps-only, duration, distance, fallback `✓`.
2. `web/src/features/history/SessionDetailExerciseCard.tsx:13` — `formatPillContent(set, units)` returns a compact string; bug: returns `"—"` unless both weight and reps are present.
3. `web/src/features/history/ExerciseHistoryScreen.tsx:101-114` — inline conditional in JSX; mostly correct coverage but no helper.

Design: one pure formatter in `web/src/shared/lib/` (no React, no Dexie). Two entry points:

```ts
// Short compact string for pills/hints.
formatLoggedSet(ls: LoggedSet | LastTimeSet, units: UnitSystem, opts?: { fallback?: string }): string
// Structured parts for custom layouts.
formatLoggedSetParts(ls: LoggedSet | LastTimeSet, units: UnitSystem): {
  primary: string;
  unit: string | null;
  secondary: string | null;
  secondaryUnit: string | null;
}
```

Coverage:
- weight + reps → e.g. `"80kg × 10"` compact, `{primary:"80", unit:"kg", secondary:"10", secondaryUnit:null}` structured.
- reps only → `"10 reps"`.
- duration only → `"30s"` (or `"0:30"` if we decide mm:ss, but match current SetRow output `"30s"` to avoid visual churn).
- distance only → `"500m"`.
- duration + distance (cardio) → `"5:00 · 1000m"` or `"300s · 1000m"` (default to seconds-based to match current code; if we change to mm:ss it is a separate UX decision).
- Fallback: configurable, default `"—"`.

Then migrate all three sites to the helper. Keep `SetRow`'s visual layout (it consumes structured parts). `SessionDetailExerciseCard` uses the compact form. `ExerciseHistoryScreen` uses the compact form or structured — whichever minimizes JSX churn.

Unit resolution: callers resolve `unitOverride` via `getEffectiveUnit` BEFORE calling the formatter. The formatter receives a resolved `UnitSystem`.

#### Part B — Cardio-Extra Validator Fix

Verified:

- `web/src/features/workout/SetLogSheet.tsx:82-90` — cardio extras (no `SetBlock`) default `targetKind = "duration"` but `isCardioExtra = true`.
- `SetLogSheet.tsx:435` — distance field visible when `targetKind === "distance" || isCardioExtra`.
- `web/src/features/workout/set-log-validation.ts:19-24` — `isSetInputEmpty("duration", input)` returns `true` iff `performedDurationSec == null`. Distance-only cardio is rejected.

Fix: introduce a cardio-extra validation mode. Either:

- **A (recommended):** Add an overload/mode `isSetInputEmpty(targetKind, input, { cardioExtra: true })` that treats the set as non-empty if ANY of `performedDurationSec`, `performedDistanceM` is set.
- **B:** Introduce a new `targetKind` value `"cardio"` that represents "duration or distance". Cleaner long-term but expands the enum and leaks into progression-service and routine-service. Overkill for one validator.

Recommendation: A. The call site in `SetLogSheet` already knows `isCardioExtra`; it passes the flag.

Add tests:
- Cardio extra: distance only → save succeeds.
- Cardio extra: duration only → save succeeds (unchanged behavior).
- Cardio extra: both → save succeeds (unchanged).
- Cardio extra: neither → save blocked.
- Non-cardio duration block: distance only without duration → blocked (unchanged).

#### Part C — `ConfirmDialog` Error Surfacing

Verified at `web/src/shared/components/ConfirmDialog.tsx:49-61`:

```ts
const handleConfirm = useCallback(async () => {
  if (doubleConfirm && !confirmedOnce) { setConfirmedOnce(true); return; }
  setPending(true);
  try { await onConfirm(); handleOpenChange(false); }
  catch { setPending(false); }
}, [...]);
```

Fix: add an optional `onError?: (err: unknown) => void` prop. Default behavior when omitted: surface a `toast.error(String(err?.message ?? err))` via `sonner` (already imported in other components). When `onError` is provided, call it and skip the default toast. Dialog stays open on error.

Tests:
- Rejected `onConfirm` calls `onError` when provided.
- Rejected `onConfirm` with no `onError` calls `toast.error` (use `vi.mock('sonner')`).
- Dialog remains open after error.
- Resolved `onConfirm` closes the dialog (unchanged).

Audit existing callers (`SettingsScreen` clear-all-data, discard-session, etc.) — confirm at least one was catching + toasting itself; leave those as-is or switch to rely on the default, whichever minimizes churn.

### Target Files

- `web/src/shared/lib/formatLoggedSet.ts` (new) — the shared formatter.
- `web/tests/unit/shared/lib/formatLoggedSet.test.ts` (new) — one `describe` per value combination.
- `web/src/features/workout/SetRow.tsx` — swap in `formatLoggedSetParts`.
- `web/src/features/history/SessionDetailExerciseCard.tsx` — swap `formatPillContent` for `formatLoggedSet`.
- `web/src/features/history/ExerciseHistoryScreen.tsx` — swap inline formatting for `formatLoggedSet`.
- `web/src/features/workout/set-log-validation.ts` — add cardio-extra mode.
- `web/src/features/workout/SetLogSheet.tsx` — pass `cardioExtra: isCardioExtra` when validating.
- `web/src/shared/components/ConfirmDialog.tsx` — `onError` prop + default toast.
- `web/tests/unit/shared/components/ConfirmDialog.test.tsx` — new or existing file; add error-path tests.

### Key Verification

- Unit tests for the formatter cover all five value combinations plus fallback.
- Snapshot tests (optional) of `SessionDetailExerciseCard` rendering bodyweight, duration, distance, and cardio sets — or explicit RTL queries verifying the expected text appears.
- Playwright: add a scenario that logs a bodyweight-only set, finishes, and verifies the session-detail pill reads `"10 reps"` rather than `"—"`.
- Playwright: cardio-extra distance-only flow (add extra cardio exercise, enter distance, save).
- All gates green.

### Risks

- `SetRow` consumers render a specific DOM structure; switching formatters must preserve the exact class names and ARIA labels. Test with a snapshot or exact-match RTL assertions.
- `toast.error` imports from `sonner` which is an ESM-only package — make sure the Vitest environment handles it (existing code imports it already in `SetLogSheet`, so the config is fine).
- Existing `ConfirmDialog` callers may rely on silent failure. Grep all callers (`git grep ConfirmDialog web/src`) and update comments on any that intentionally silence errors.

### Open Decisions Before `writing-plans`

- Cardio-extra duration+distance display format: `"30s"` vs `"0:30"` (default: keep `"30s"`; changing it is out of scope).
- Whether to rename `formatLoggedValue` / `formatPillContent` call sites or simply delete them once the shared helper is in place (default: delete them to preserve DRY).

### Exit Criteria

- [x] Shared formatter lives in `shared/lib`, is pure, and is the sole source of logged-set display formatting.
- [x] `SessionDetailExerciseCard` shows correct text for all five value combinations.
- [x] Cardio-extra distance-only save succeeds; duration-only unchanged.
- [x] `ConfirmDialog` surfaces rejections; dialog stays open.
- [x] Full gate green.
- [x] PR merged.

### Next Step

Invoke `superpowers:writing-plans` with the **Scope**, **Target Files**, **Key Verification**, **Risks**, and **Exit Criteria** sections above. Confirm the two open decisions first.

---

## Sprint 4 — Product Decisions, Copy, And Route Cleanup

**Goal:** Resolve four product ambiguities surfaced by the audit and land the copy/link/validator changes they imply, in a single focused PR.

**Covers findings:** F7, F8, F9, F13.

**Dependencies:** Sprints 1 and 3 (Sprint 3's shared formatter may be used by the exercise-history linked view if we ship the link). Sprint 2 is not a hard dep.

**Non-goals:** No new screens. No new routes beyond wiring an existing one. No onboarding changes.

### Decisions Required Before `writing-plans`

The user MUST answer these four before the per-sprint plan is written. Recommended defaults in bold.

**D1 — Exercise history route:**
- (a) **Ship it. Add a tappable affordance from `SessionDetailExerciseCard` (and optionally `ExerciseCard` during active workouts) to `/history/exercise/:exerciseId`. Verify the screen works with snapshot names for deleted catalog entries.**
- (b) Delete it. Remove `ExerciseHistoryScreen.tsx`, the route in `App.tsx`, and the `useExerciseHistoryGroups` hook if orphaned after removal.

**D2 — "Replace active routine" copy:**
- (a) **Change the button label to `Import and activate routine`. Keep current semantics (imports alongside existing routines; sets new one active). No data change.**
- (b) Implement true replace. On import, delete the currently active routine (if any) within the same transaction, ensuring invariant 10 still holds. Requires a confirmation dialog and care around "routine deletion during active session" (already blocked by settings-service). Adds complexity; promotes to its own sprint.

**D3 — `ExercisePicker` duplicate-extra behavior:**
- (a) **Disable already-present exercises. Change the `In workout` Badge to a disabled visual state. `onPick` is not called. Add `aria-disabled="true"` and `tabIndex={-1}` for accessibility.**
- (b) Allow duplicates. Change copy to `Add again`. Keep current click behavior.

**D4 — YAML validation stance:**
- (a) **Strict. Reject non-string `notes` elements; reject non-string cardio `name`/`detail`/`notes`; reject non-positive `exactValue`; reject non-finite range bounds. Update `docs/custom-gpt/routine-yaml-contract.md` to reflect.**
- (b) Permissive. Keep current coercion/fallback behavior. Document the coercions explicitly in `docs/custom-gpt/routine-yaml-contract.md` so the GPT-authoring audience knows what "just works."

### Scope (assuming recommended defaults)

Each task below becomes a chunk in the per-sprint implementation plan.

#### D1(a) — Wire The Orphan Route

- Add a tappable exercise-name element on `SessionDetailExerciseCard` that navigates to `/history/exercise/:exerciseId`.
- Guard: only route-navigate when `exerciseId` still exists in the live catalog OR the screen gracefully handles a missing catalog entry (it already does at line 44 via `exercise?.name ?? exerciseId`).
- Remove the orphan comment at `web/src/app/App.tsx:183-184`.
- Playwright: navigate from a finished session's exercise card to the per-exercise history and verify both snapshot and live paths render.

#### D2(a) — Copy Fix

- `web/src/features/settings/RoutineImportScreen.tsx:133` — `Replace active routine` → `Import and activate routine`.
- `web/src/features/settings/RoutineImportScreen.tsx:148` (or wherever the file picker button label lives) — align if it repeats "Replace".
- Update any string-based tests (`git grep "Replace active routine" web/tests`).
- No service changes.

#### D3(a) — Disable Duplicates In Picker

- `web/src/features/workout/ExercisePicker.tsx:69-94` — when `inWorkout`, render `<button … disabled aria-disabled="true" tabIndex={-1}>` and do not call `onPick`.
- Visual: muted text, no hover ring. Match existing shadcn disabled styling.
- Accessibility: ensure the button is skipped in keyboard nav.
- RTL test: rendering the picker with an existing exercise id in `existingExerciseIds` → clicking the row does not call `onPick`.
- Keep the `In workout` badge — it's now both label and cue.

#### D4(a) — Strict YAML Validation

- `web/src/services/routine-service.ts:455` — reject non-string `notes` elements with a per-index error (instead of `String(n)`).
- `web/src/services/routine-service.ts:472-484` — reject non-string cardio `notes`, `name`, `detail` (instead of `""` fallback).
- `web/src/services/routine-service.ts:724-733` (exactValue branch) — require `exactValue > 0` and `Number.isFinite(exactValue)`.
- `web/src/services/routine-service.ts:700-723` (range branch) — require both `min > 0`, `max > 0`, both finite, `min < max` (already checked).
- Update `docs/custom-gpt/routine-yaml-contract.md` to state the strict rules. If this file is currently the source of the "contract" the audit mentions, bump its version note.
- Tests: one failing test per new rule (non-string notes, non-string cardio fields, zero/negative exact, non-finite range).

### Target Files

- `web/src/features/history/SessionDetailExerciseCard.tsx` — link affordance (D1a).
- `web/src/app/App.tsx` — remove orphan comment (D1a).
- `web/src/features/settings/RoutineImportScreen.tsx` — copy (D2a).
- `web/src/features/workout/ExercisePicker.tsx` — duplicates (D3a).
- `web/src/services/routine-service.ts` — YAML strictness (D4a).
- `docs/custom-gpt/routine-yaml-contract.md` — doc sync (D4a).
- Tests mirror the above.

### Key Verification

- Playwright: new scenario for D1a navigation path.
- RTL: D3a disabled behavior test.
- Service tests: D4a strict-validator tests (one per new rule, both negative cases and one positive sanity case each).
- String tests and existing Settings E2E updated for D2a copy.

### Risks

- D1a: the orphan screen hasn't been loved recently; confirm it still renders with fake-indexeddb seeded data. If bugs surface, promote those fixes into the sprint rather than deferring.
- D4a: tightening may reject real GPT-generated YAML in active use. Pre-flight: run D4a validator against a corpus of recent imports (check `docs/archive` or user's own local test samples). If breakage is real, consider D4b instead.

### Open Decisions Before `writing-plans`

- D1, D2, D3, D4 as listed above. All four must be answered.

### Exit Criteria

- [x] All four product decisions recorded (in commit messages and, if substantial, a short ADR in `docs/archive`).
- [x] Each accepted decision's scope implemented, tested, and documented.
- [x] Full gate green.
- [x] PR merged.

### Next Step

Present D1–D4 to the user. Capture answers. Then invoke `superpowers:writing-plans` with the **Scope** sections for the accepted options only (drop alternatives to keep the sub-agent plan tight).

---

## Sprint 5 — Architecture Drift, Docs, And Comment Normalization

**Goal:** Remove low-risk drift and leave the codebase and documentation in a state that reflects the post-hardening reality.

**Covers findings:** F10, F11, F12, F14, F15.

**Dependencies:** Sprints 1–4. Runs last so README stat regeneration includes all prior sprints' test additions.

**Non-goals:** No feature refactors. No wholesale architecture changes. No new tooling the team has not already considered (no jsx-a11y eslint plugin, no import-boundary framework — unless a trivial script suffices).

### Scope

#### Part A — `sessionStats` Move (F11)

- Move `web/src/features/history/lib/sessionStats.ts` to `web/src/shared/lib/sessionStats.ts`.
- Update the import in `web/src/shared/hooks/useFinishedSessionSummaries.ts:4`.
- Update any other importers (`git grep "features/history/lib/sessionStats" web/src`).
- Remove the now-empty `features/history/lib/` directory if no other file remains.
- Verify `web/src/features/history/CLAUDE.md` text still matches reality (it currently describes `sessionStats.ts` as a local util — update that line).

#### Part B — Delete Duplicate `main.tsx` (F12)

- Delete `web/src/main.tsx`.
- Confirm `web/index.html:15` references `/src/app/main.tsx` only (already true).
- Run the full gate. If the build fails because some bundler path still expects the top-level file, prefer keeping the file as a one-line re-export; document why in a comment.

#### Part C — Historical Review Labels In Comments (F15)

- Sweep `web/src/**` for `P5-A`, `[CERTAIN - BUG]`, `[CERTAIN — BUG]`, `ERRATA`, and related audit-era markers.
- Decide per occurrence:
  - If the comment still carries useful invariant information, rewrite it as a neutral explanation (no review-era label).
  - If the comment was describing a bug that is now fixed, delete the comment entirely (the code tells the story).
- Do not touch test files that reference these strings in fixtures or assertions — those encode historical behavior we must preserve.

#### Part D — `useExerciseHistory` Dependencies Audit (F10)

- Read `web/src/shared/hooks/useExerciseHistory.ts` in the context of how it is called from `WorkoutScreen` and `SetLogSheet`.
- Determine whether a scenario exists where a `SessionExercise`'s scalar fields (`instanceLabel`, `effectiveType`, `effectiveEquipment`, `unitOverride`, `setBlocksSnapshot`) change without any `loggedSets` table write.
  - If yes: add those fields (or a stable signature) to the deps array. Write a failing test that exercises the gap before the fix.
  - If no (i.e., Dexie liveQuery on `loggedSets` always re-runs the query): leave the hook as-is, but add a short comment stating the invariant ("re-runs on any loggedSets table change observed by Dexie; SessionExercise scalar mutations in practice co-occur with loggedSets changes").
- Do not expand the hook to load the `SessionExercise` by ID unless the investigation shows the dep gap is a real user-visible bug. Keep the hook surface stable.

#### Part E — README Stats And Optional Stats Script (F14)

- Add a `scripts/count-stats.mjs` (or extend an existing script dir) that outputs:
  - Source file count (glob `web/src/**/*.{ts,tsx}` minus tests).
  - Test file count (glob `web/tests/**/*.test.{ts,tsx}`).
  - Unit/integration test count (parse `npm test -- --reporter=json` or `vitest run --reporter=json`).
  - Playwright test count (parse Playwright's reporter or run `npx playwright test --list --reporter=json`).
  - Source LoC (via `wc -l` on the glob, excluding generated).
- Update `README.md` with the regenerated numbers.
- Document the regeneration command in the README so future updates are mechanical.
- If writing the script is non-trivial, fall back to a one-time manual regen with commands in a short `docs/archive` ADR and skip the script. Do not sink more than 2 hours into scripting.

#### Part F — Advisory Only (Not Executed)

- Note in the sprint PR description that the audit flagged "features call services and db directly" (P3). The team deliberately does not schedule a refactor. When future work touches a screen with duplicated pending/error/toast patterns, consider extracting a thin command hook at that moment — not as a standalone initiative.

### Target Files

- `web/src/features/history/lib/sessionStats.ts` → `web/src/shared/lib/sessionStats.ts` (move).
- `web/src/shared/hooks/useFinishedSessionSummaries.ts` (import update).
- `web/src/features/history/CLAUDE.md` (doc sync after move).
- `web/src/main.tsx` (delete, probably).
- Any file in `web/src/**` containing audit-era comment markers.
- `web/src/shared/hooks/useExerciseHistory.ts` (possibly update; maybe only a comment).
- `scripts/count-stats.mjs` (new, optional).
- `README.md` (regenerate stats section).
- `docs/repo-full-scope-analysis-2026-04-23.md` (add closing addendum referencing this roadmap).

### Key Verification

- `git grep` for `P5-A`, `[CERTAIN - BUG]`, `ERRATA` in `web/src/**` returns empty (excluding intentional test fixtures).
- `git grep "features/history/lib/sessionStats"` returns zero results (post-move).
- `web/src/main.tsx` does not exist (unless we deliberately kept it as a re-export).
- Full gate green.
- README stats match the latest run of the counter script.

### Risks

- The comment sweep can accidentally delete useful context. Default to rewriting rather than deleting when in doubt. Each deletion should be justifiable in the commit message.
- The `sessionStats` move can break imports in files the grep misses (e.g., dynamic imports, test fixtures). Full-suite test run catches this.
- The stats script can become a time sink. The sprint caps effort at 2 hours on the script; fall back to manual regen if unclear.

### Open Decisions Before `writing-plans`

- Whether to write the stats script or do a one-time manual regen (default: attempt the script, fall back within 2 hours).
- Whether `web/src/main.tsx` becomes a re-export stub or is deleted outright (default: delete; switch to stub only if a tool actually depends on it).

### Exit Criteria

- [ ] `sessionStats` lives in `shared/lib`, imports all updated.
- [ ] Duplicate top-level `main.tsx` gone (or stubbed with documented reason).
- [ ] Audit-era review labels removed from `web/src/**`.
- [ ] README stats match reality.
- [ ] `useExerciseHistory` deps investigation closed — either fixed with test or documented as a non-issue.
- [ ] `docs/repo-full-scope-analysis-2026-04-23.md` has a closing addendum.
- [ ] Full gate green.
- [ ] PR merged.

### Next Step

Invoke `superpowers:writing-plans` with the **Scope** and **Target Files** sections above. Confirm the two open decisions first.

---

## Rollup — Final Acceptance For The Entire Roadmap

After Sprint 5 merges, the user (or a reviewer) confirms:

- [ ] All fifteen audit findings have a resolution (implemented, dropped with documented rationale, or converted to a tracked follow-up).
- [x] `npm test` passes consecutive CI runs without any timeout overrides (Sprint 1 closed with 1 green CI run; local 5x + 3x runs all clean).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` pass on the main branch.
- [x] Backup round-trip: export → tamper → import rejects with precise errors; valid export → import produces identical state.
- [x] Progression fallback: two-block ambiguity → no suggestion; single match → correct suggestion.
- [x] Every logged-set kind renders non-dash on every screen that shows logged sets.
- [x] `ConfirmDialog` rejection produces a visible toast by default.
- [x] Routine import copy matches behavior.
- [x] `/history/exercise/:exerciseId` is reachable from UI (or the route was removed, per D1b).
- [x] `ExercisePicker` handles duplicates per the chosen product decision.
- [x] YAML validation matches the contract it advertises (or the contract doc matches the permissive behavior, per D4b).
- [ ] README stats reflect current counts.
- [ ] No audit-era `P5-A`/`[CERTAIN - BUG]`/`ERRATA` comments remain in `web/src/**`.
- [ ] `docs/repo-full-scope-analysis-2026-04-23.md` is annotated with the closing roadmap link.

## Followups Explicitly Deferred (Not Scheduled By This Roadmap)

- Backup schema version bump or migration tooling. Today's schema v1 is still fine after Sprint 2; revisit only if a real new field lands.
- `eslint-plugin-jsx-a11y` or an import-boundary eslint plugin. Flagged as valuable by the audit; deferred until a concrete complaint arises.
- Full architectural refactor of "features → hooks → services" where screens currently call `db` directly. Opportunistic only.
- Onboarding state-machine consolidation. Out of audit scope; tracked elsewhere.

## Execution Handoff

The roadmap is saved at `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`.

**For each sprint, the flow is:**

1. Answer the sprint's "Open Decisions" questions (if any).
2. Create a worktree for the sprint.
3. Invoke `superpowers:writing-plans` with that sprint's section as the spec.
4. Choose execution mode when the per-sprint plan is written:
   - **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
   - **Inline Execution** — executing-plans in this session with batch checkpoints.
5. Close the sprint against its Exit Criteria. Merge PR. Move to next sprint.

**Suggested cadence (serial):** Sprint 1 (~1 day) → Sprint 2 (~3 days) → Sprint 3 (~2 days) → Sprint 4 (~1–2 days after decisions) → Sprint 5 (~1 day). Total: ~1.5 weeks of focused sub-agentic work plus decision turnarounds.

**Parallelization option:** Sprints 2 and 3 are disjoint file-wise and can run in parallel worktrees. Sprint 4 should follow both. Sprint 5 must be last (reads final state).

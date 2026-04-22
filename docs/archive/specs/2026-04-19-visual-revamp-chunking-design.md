# Visual Revamp — Chunking Design

**Date:** 2026-04-19 (validation-pass edits same day)
**Status:** Approved, ready for per-sprint planning
**Source material:** `docs/claude_design_handoffs/`

---

## 1. Overview

### Goal

Port the Exercise Logger PWA to the visual system defined in `docs/claude_design_handoffs/`: warm-paper surfaces, sage accents, Inter + Instrument Serif typography, oklch-based color tokens, custom SVG icon set, 200–300ms ease motion.

### Scope

**In scope:** full handoff — token/font/icon/primitive rewrite **and** all new features shown in the prototype (streak pill, History stats tile + month grouping, Session Detail set pills, Finish Celebration overlay, custom numeric keypad in SetLogSheet for weight + reps, "Tap to log · last 85×9" hints, Last-session card on Today).

**Out of scope:** items the handoff itself defers (see §5).

### Current state

- Branch `refactor/handoff-theme-and-workout-complete` has already applied the `docs/claude_design_handoffs/handoff/` subfolder drop-ins:
  - `c2cd203` dropped `ThemePreference` from the data model.
  - `be92593` added the "all sets logged" terminal state to `WorkoutFooter`.
- Remaining work is the full visual repaint + new features — everything under §3.
- Baseline: 527 tests passing, Sprint 4 ("Workout Shine") and Sprint 5 ("Open Doors Wide") already merged.

### Approach

Seven sequential sprint-sized chunks, each a single PR to `main` (same cadence as Sprint 4 / Sprint 5). Foundation (tokens + fonts + primitives) lands first as one atomic PR so the app never shows a half-token state. Screens port in order of complexity, riskiest component (SetLogSheet keypad) last-but-one.

---

## 2. Validation findings

Issues surfaced during handoff review. Each is either addressed in a specific sprint or explicitly deferred.

| # | Finding | Disposition |
|---|---|---|
| 1 | `SetLogSheet` moves from native inputs to a custom keypad — biggest risk + a11y surface | Sprint 11 (isolated, late — keypad for weight + reps only; duration/distance keep re-skinned native inputs) |
| 2 | Handoff adds new features, not just re-skin (stats tile, month grouping, streak pill, celebration, set pills, last-session card) | Spread across Sprints 7, 8, 12 |
| 3 | `oklch()` fallback strategy not specified; Safari < 15.4 / Chrome < 111 unsupported | **Resolved: no fallback.** App already ships `oklch()` without fallback. Modern-browser-only. See §4 |
| 4 | Fonts loaded from Google Fonts in prototype; offline-first PWA requires self-hosting | Sprint 6 self-hosts via `@fontsource/inter` + `@fontsource/instrument-serif` npm packages (matches existing repo pattern) |
| 5 | Superset UI under-specified; handoff flags it for user testing | Deferred (permanently out of this revamp) |
| 6 | Custom icon set replaces Lucide; migration strategy needed | Sprint 6 introduces `shared/icons/` set only (no migration); Sprints 7–11 swap as they touch files; Sprint 12 removes `lucide-react` dep |
| 7 | Density / accent / numeralStyle tweaks exposed in prototype; handoff recommends committing `sage / medium / sans` | Commit single values in Sprint 6; no user toggles |
| 8 | Finish Celebration timing (auto-dismiss vs. tap) undefined | Sprint 12 open question |
| 9 | YAML import error messaging not visualised in prototype | Sprint 9 designs inline field-level errors |
| 10 | Classname-sensitive tests (e.g. `flash-logged`) will need updates as primitives re-skin | Each sprint maintains its own tests |

---

## 3. Sprint definitions

### Sprint 6 — Foundation ("Warm Paper")

**Scope**
- Replace tokens in `web/src/app/App.css`: oklch palette (paper, card, ink/ink-2/ink-3, line, line-soft, sage, sage-deep, sage-soft, warm, danger); radius scale (18px cards, 24px sheet top, 12px / 10px set rows, 999px chips); motion tokens (fadeIn, slideUp, popIn, fadeInUp at 200–300ms ease).
- Self-host Inter 400/500/600/700 + Instrument Serif 400 + 400-italic via npm: install `@fontsource/inter` + `@fontsource/instrument-serif`, import the weight-specific CSS files from `App.css` (mirrors the existing `@fontsource/dm-sans` + `@fontsource-variable/urbanist` pattern at `App.css:4-7`). The bundled WOFF2s are auto-picked up by the existing `globPatterns: ["**/*.{js,css,html,png,svg,woff2,ico}"]` glob in `vite.config.ts`, so offline works on first install without extra config. Preload Inter 400/500/600 + Instrument Serif 400 in `index.html`. Remove `@fontsource-variable/urbanist` + `@fontsource/dm-sans` imports once no screen references `--font-heading` / `--font-sans`.
- Rewrite typography utilities: `.text-hero-serif`, `.text-title-serif`, `.text-eyebrow` (11px uppercase, 0.08em tracking), `.text-body` (13–14px), `.text-meta` (12px). Keep `.text-value` family for tabular numerals.
- Create `web/src/shared/icons/` custom SVG set matching the handoff `Icon` object: dumbbell, back, chevron, close, check, play, flame, plus, search, trash, grid, graph. Keep Lucide installed; do NOT migrate Lucide imports in Sprint 6 (except in `Sheet` + `Dialog`, which are re-skinned here anyway). Per-screen sprints (7–11) swap to the custom set as they touch each file. Sprint 12 removes the `lucide-react` dependency.
- Re-skin all shared primitives to new tokens **in place** (no variant renames): `Button` — drop purple `cta` variant, retune `default` = ink primary, `outline` = hairline secondary, `ghost` = text ghost, `destructive` = danger text, `link` = inline link; migrate the 3 existing `variant="cta"` call sites (`TodayScreen.tsx`, `SetLogSheet.tsx`, `WorkoutFooter.tsx`) to `default`. Then: `Card` (18px radius, hairline borders), `Sheet` (24px top radius, slideUp), `Dialog` (popIn), `SectionHeader`, `Stat`, `Pill` (sage-soft selected), `EmptyState` (serif heading), `BlockStripe`.
- Update `index.html` `<meta name="theme-color">` from `#09090b` to the new paper tone (pick an sRGB hex equivalent during planning so iOS PWA status bar matches the app surface).
- Audit `web/src/app/shadcn-compat.css` — keep the `@custom-variant` data-state helpers (non-conflicting) but remove any stale tokens if they exist.
- Refresh `CLAUDE.md` test count (530 → 527) and any stale token / font references in `web/src/*/CLAUDE.md`.

**Out of scope:** screen layouts. Existing screens shift aesthetic wholesale via primitive updates only.

**Open questions for planning session**
- Exact preload set in `index.html`: Inter 400/500/600 + Instrument Serif 400, or narrower?
- Paper-tone `theme-color` sRGB hex: pick the browser-safe equivalent of `oklch(98.8% 0.008 80)` for iOS status bar.
- Icon SVG source: hand-port from `components/screens.jsx` `Icon` object, or regenerate from the handoff HTML?

**Dependencies:** none (but `refactor/handoff-theme-and-workout-complete` should merge first).
**Size:** Large (comparable to Sprint 4).
**Acceptance:** 527 tests pass; no `variant="cta"` usages remain; Inter + Instrument Serif load offline via `@fontsource/*`; `theme-color` meta updated; every screen renders coherently with new palette; lint + build + e2e clean.

---

### Sprint 7 — AppShell + Today ("First Light")

**Scope**
- AppShell polish: safe-area padding, status-bar spacing.
- Bottom tab bar restyled with new icon set, active indicator (sage dot + pill fill), press feedback.
- Route transitions → `fadeInUp` (300ms ease).
- Today screen:
  - Warm eyebrow ("SUNDAY · APR 19" — day name + date).
  - Serif-italic **static greeting** ("Hello" or equivalent generic). No name personalisation.
  - Streak pill (sage-soft background, flame icon, session count from `useTrainingCadence`). Shown only when streak > 0.
  - Hero card: `TODAY · DAY {id}` eyebrow, **no target time**, serif day title, muscle-group chips (derivation TBD), exercise count + "first up: X", ink-black Start CTA.
  - Resume state: CTA swaps to "Resume workout" + sage dot + elapsed meta.
  - Day switcher: A/B/C pills. Tapping non-today does NOT start that day; instead updates a preview card above (or below) the switcher.
  - Last-session summary card.

**Out of scope:** starting workouts from a non-today day; `displayName` in Settings; `targetTimeMin` in routine YAML.

**Open questions for planning session**
- Muscle-group chips: derive from `Exercise.muscleGroup` catalog field, or from routine-day metadata? Multi-group exercises?
- Day-switcher preview: replace hero card in place, or render below?
- Greeting positioning: serif italic above or below the streak pill?

**Dependencies:** Sprint 6.
**Size:** Large.
**Acceptance:** matches `screenshots/1-today.jpg` (minus name + target time); all three current states (no routine / active session / normal preview) still work.

---

### Sprint 8 — History + Session Detail ("Training Log")

**Scope**
- History screen: "TRAINING LOG" eyebrow, serif-italic "History" title.
- Stats tile: Sessions / Sets / Hours with tabular numerals.
- Month grouping with "APRIL 2026" eyebrow; redesigned session row (left date chip, title, meta line, chevron).
- Session Detail screen: back arrow, "APR 17 · 52M" eyebrow + serif title, three-stat tile (Sets / Volume / Time), exercise cards with sage-soft set pills ("30×14").

**Out of scope:** session editing (immutable log per spec), search/filter.

**Open questions for planning session**
- Hours total: sum of session durations? Sum of `endedAt − startedAt`?
- Volume unit: show suffix on big number ("8,240 kg") or rely on column label?
- Session count source: all-time or last 12 weeks?
- Month boundary: user's local timezone or UTC?

**Dependencies:** Sprint 6.
**Size:** Medium.
**Acceptance:** matches `screenshots/3-history.jpg` and `6-session-detail.jpg`; empty state preserved.

---

### Sprint 9 — Settings + Routine Import ("Quiet Corners")

**Scope**
- Settings: serif "Settings" title, Active Routine card, Display group (units pill toggle), Data group (Import / Export / Reset as RowLink with chevron), About section.
- Routine Import: monospace textarea, paste-or-upload, **inline field-level YAML error messaging** (e.g. "Day A → Exercise 3 → sets: must be ≥ 1"), "Replace active routine" primary CTA.

**Out of scope:** theme toggle (already removed); density / accent / numeralStyle toggles (committed in Sprint 6, no UI exposure).

**Open questions for planning session**
- YAML error structure: flat list of field errors, or summary + collapsible detail?
- About content: pull version from `package.json`, define tagline copy now.
- Install prompt: keep existing PWA install card as-is, or restyle to RowLink pattern?

**Dependencies:** Sprint 6.
**Size:** Medium.
**Acceptance:** matches `screenshots/4-settings.jpg` minus theme row; YAML errors surface with field context, not binary valid/invalid.

---

### Sprint 10 — Workout screen cards / header / footer ("Working Weight")

**Scope**
- Sticky header: sage "DAY A · 34:08 ELAPSED" eyebrow, serif day title (truncated), X close.
- Thin sage progress bar with "2/20" set count.
- ExerciseCard redesign: name + target line ("3 × 8–12 · 1 × 12–16 top") + progress chip ("2/4").
- SetRow redesign:
  - Logged: sage-soft fill, ✓ circle, big "70 kg × 14" numerals, optional tag (TOP, ↑ PR).
  - Empty: hairline outline, dim row number, "Tap to log · last 85×9" hint.
- LAST strip ("LAST 85kg × 10 · 85kg × 9 · 85kg × 8").
- Footer restyled. **Preserve** the existing "all sets logged" terminal state (green Finish + success eyebrow) shipped in `be92593`.
- Retire the `flash-logged` keyframe + `.flash-logged` utility from `App.css:179-188` and its usage on `SetSlot`: the new sage-soft logged state + ✓ circle (plus the `save-pulse` on the sheet) already provide the "I logged it" signal. Delete the keyframe, drop the classname, and update or remove classname-sensitive tests that assert on `flash-logged`.
- Superset rendering: keep current `SupersetGroup` wrapper, re-tokenise in place. No redesign.

**Out of scope:** SetLogSheet (Sprint 11), Exercise Picker (Sprint 12), superset UI redesign (permanently deferred).

**Open questions for planning session**
- "TOP" / "↑ PR" tag source: TOP derives from `block.label`; PR from `loggedSet.isPersonalRecord`. Confirm field names against current data model.
- LAST strip: one per exercise (aggregated), or per-block (when target is "Top + Back-off" shape)?
- Target line format: confirm the builder handles all current block shapes.
- `SupersetGroup` wrapper: keep with new tokens, or inline and remove?

**Dependencies:** Sprint 6, **and Sprint 8 must land first** (set-pill styling is shared between Session Detail and the new SetRow; if Sprint 10 ships first, Sprint 8 ends up re-conforming).
**Size:** Large.
**Acceptance:** matches `screenshots/5-workout-active.jpg`; terminal state preserved; `flash-logged` removed; superset rendering still works visually.

---

### Sprint 11 — SetLogSheet custom keypad ("Tap & Log")

**Scope**
- Replace native numeric inputs with a 3×4 grid keypad (1–9, `.`, 0, backspace) for **weight + reps only**.
- ValueBox components with active / inactive states and nudge buttons:
  - Weight: ±2.5 kg nudge (hardcoded, matches prototype); unit toggle (kg / lb) in corner.
  - Reps: ±1 nudge.
- **Duration and distance fields keep native `<Input type="number">`**, re-skinned to Sprint 6 tokens. The prototype never visualises the keypad for these value kinds and inventing a direction is out of scope for this sprint. Duration still supports the current `durationInMinutes` (cardio-extras) vs. seconds split; distance stays in meters.
- Preserve the bodyweight "+ Add weight (permanent for this session)" flow from `SetLogSheet.tsx:246-271`.
- Preserve the "Delete this set" affordance from `SetLogSheet.tsx:331-349` when editing an existing set.
- Set-position indicator (row of circles: done / current / upcoming) at top.
- Context line: "Last: 85kg × 9", "Suggested: 87.5kg ↑" with "Use last" chip.
- Manual PR toggle.
- Save pulse animation.
- Preserve auto-advance logic (re-target next empty set without closing).
- Physical keyboard support: 0–9 + backspace + Tab between fields + Enter to save.
- ARIA labels on all custom controls.

**Out of scope:** automatic PR detection (manual per handoff); keypad for duration/distance value kinds (deferred — see §5).

**Open questions for planning session**
- Nudge increments: hardcoded (2.5 kg / 1 rep) per prototype — or read from `exercise.weightIncrement` when present? Recommend starting hardcoded, upgrade later if the user asks.
- PR toggle persistence: per-set, persisted alongside `LoggedSet.isPersonalRecord`?
- Auto-advance on final set of final block: close sheet, or show completion hint (e.g. "All sets logged — tap Finish")?

**Dependencies:** Sprint 10 (new SetRow design to return to after save).
**Size:** Large. **Highest-risk PR of the revamp.**
**Acceptance:** weight + reps loggable via keypad without a physical keyboard; duration + distance still work via re-skinned native inputs; bodyweight "+ Add weight" and Delete-set flows preserved; auto-advance preserved; a11y audit passes; existing SetLogSheet tests ported.

---

### Sprint 12 — Pickers + Celebration + Polish ("Closing Notes")

**Scope**
- Exercise Picker redesign (sheet styling, search, catalog list — grouped vs. flat TBD).
- ConfirmDialog variants tuned (Finish neutral, Discard / Reset danger).
- Finish Celebration overlay: full-screen sage, sparkle icon, serif "Well done", session stats, `popIn` animation, then navigate to Today.
- Accessibility audit across all screens (focus rings, ARIA, keyboard nav).
- Font-loading tuning (preload, subset if feasible).
- Icon migration wrap-up: remove any remaining Lucide imports, drop dependency.
- PWA checklist: offline verified, SW updates, Lighthouse run.

**Open questions for planning session**
- Exercise Picker layout: search-only flat list, or grouped by muscle with chip filters?
- Finish Celebration duration: auto-dismiss at 1.8s (prototype) or wait for user tap?
- Celebration stats: which fields (sets + volume + duration + PR count?)?
- Accessibility scope: full WCAG 2.1 AA audit, or targeted review of new custom components only?

**Dependencies:** all prior.
**Size:** Medium-Large.
**Acceptance:** all nine handoff screens complete; Finish Celebration runs after confirm dialog; no critical a11y issues; Lucide uninstalled.

---

## 4. Cross-cutting concerns

### Testing strategy
- Preserve all 527 tests. Update classname-sensitive assertions as they break.
- TDD per superpowers rule: write / update component tests alongside implementation, not after.
- Consider adding Playwright screenshot baselines at Sprint 6 and re-baselining per sprint. Value vs. cost — decide in Sprint 6 planning.

### oklch fallback
**Decided: no fallback.** The app already ships `oklch()` without fallback in `App.css` today and has been in user testing since 2026-04-08 without issue. Modern-browser targets only (Safari ≥ 15.4, Chrome ≥ 111, Firefox ≥ 113 — all > 2 years old at ship). This is a single-user PWA running on the user's current phone; adding a PostCSS plugin or `@supports` cascade pays complexity for a risk that does not exist. No Sprint 12 validation step needed.

### Font loading
- Install `@fontsource/inter` + `@fontsource/instrument-serif` and import weight-specific CSS from `App.css`, mirroring the existing `@fontsource/dm-sans` + `@fontsource-variable/urbanist` imports at `App.css:4-7`.
- `@fontsource` packages bundle WOFF2 + `@font-face` with `font-display: swap`, so fallback text paints immediately.
- The existing `globPatterns: ["**/*.{js,css,html,png,svg,woff2,ico}"]` in `vite.config.ts:82` auto-precaches the bundled WOFF2s — offline works on first install without extra config.
- Preload Inter 400 + 500 + 600 and Instrument Serif 400 in `index.html` via `<link rel="preload">`.
- Remove `@fontsource-variable/urbanist` + `@fontsource/dm-sans` imports and `npm uninstall` both once no screen references `--font-heading` / `--font-sans` (Sprint 6 replaces these utility variables).

### Icon migration
- Sprint 6 introduces `shared/icons/` SVG set only — no Lucide import swaps except inside `Sheet` + `Dialog` (re-skinned in Sprint 6 anyway).
- 13 files currently import `lucide-react`: `app/App.tsx`, `shared/components/EmptyState.tsx`, `shared/ui/sheet.tsx`, `shared/ui/dialog.tsx`, `features/today/TodayScreen.tsx`, `features/today/LastSessionCard.tsx`, `features/workout/WorkoutScreen.tsx`, `features/workout/WorkoutFooter.tsx`, `features/workout/ExerciseCard.tsx`, `features/workout/SetSlot.tsx`, `features/history/HistoryScreen.tsx`, `features/history/SessionDetailScreen.tsx`, `features/history/ExerciseHistoryScreen.tsx`.
- Sprints 7–11 swap to the custom set as each screen is touched.
- Sprint 12 verifies zero remaining `lucide-react` imports, removes the dependency.

### Handoff doc vs. prototype
Two cosmetic inconsistencies exist in `docs/claude_design_handoffs/Design Handoff.md` — **the prototype is canonical, the prose is wrong** where they conflict:
- §2.4 calls the SetLogSheet "wheel-style numeric inputs", but `components/screens.jsx:513` labels it "bottom sheet with custom keypad" with a 3×4 grid at L685. Sprint 11 follows the prototype (keypad).
- §7 references `frames/ios_frame.jsx`; only `frames/android-frame.jsx` exists. Irrelevant — the PWA doesn't render a phone frame.

### Scope creep guard
- Handoff-deferred items (§5) stay OUT across all sprints. If user requests one mid-sprint, surface as follow-up, do not absorb.

### PR shipping discipline
- One PR per sprint to `main`.
- Each PR leaves the app coherent — no half-token states, no broken screens.
- Each PR runs `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` before merge.

### Branch strategy
- Current branch `refactor/handoff-theme-and-workout-complete` merges first.
- Each sprint forks a new branch off main: `sprint-6-foundation`, `sprint-7-today`, …

---

## 5. Deferred / permanently out of scope

| Item | Why deferred | Future trigger |
|---|---|---|
| Superset UI redesign | Handoff flagged for user testing | Real-world use reveals preferred pattern |
| PR auto-detection | Handoff kept it manual deliberately | Design of "best-at-rep-range-over-N-weeks" heuristic |
| Streak definition refactor | Assumes Mon-start week | Non-weekly routine onboarding |
| Session editing from detail | Spec is explicit: immutable log | User feedback demands typo fixes |
| Timer UI | `restSecSnapshot` fields stay in data model, no UI | Separate design pass |
| Dark mode | Removed; warm paper is the brand | Not on the roadmap |
| Density / accent / numeralStyle user toggles | Handoff recommends committing `sage / medium / sans` | If users request customisation |
| Greeting name personalisation | User preference: generic "Hello" | Not on the roadmap |
| Target time on Today hero card | User preference: remove | Not on the roadmap |
| Keypad for duration / distance sets | Prototype only visualises keypad for weight + reps; duration/distance UX undefined | User sketches a keypad layout for time-based / distance-based sets, or picks a different entry primitive |

---

## 6. Pre-decided answers

From brainstorming session 2026-04-19:

1. **Scope:** full handoff — repaint + all new features.
2. **Ship cadence:** one PR per sprint to `main`, same as Sprint 4 / Sprint 5.
3. **Greeting name:** generic static greeting (e.g. "Hello"). No `displayName` field.
4. **Target time estimate:** removed from Today hero card. No YAML addition.
5. **Duration + distance in keypad:** **reversed.** Keypad handles weight + reps only. Duration + distance keep re-skinned native inputs (see Sprint 11 + §5).

Added 2026-04-19 (post-validation pass):

6. **Font self-hosting:** via `@fontsource/inter` + `@fontsource/instrument-serif` npm packages (matches existing `@fontsource/dm-sans` + `@fontsource-variable/urbanist` pattern). No `web/public/fonts/` directory, no hand-written `@font-face`.
7. **oklch fallback:** not implemented. App already uses `oklch()` without fallback in production; modern-browser-only targets. No PostCSS plugin, no `@supports` cascade.
8. **Button variant strategy:** reskin in place. Drop `cta` variant, migrate its 3 call sites (`TodayScreen.tsx`, `SetLogSheet.tsx`, `WorkoutFooter.tsx`) to `default`. Keep all other variant names (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`) — tokens do the visual work, no churn across the dozens of button call sites.
9. **Sprint 6 icon scope:** introduce `shared/icons/` set only (plus swap Lucide inside `Sheet` + `Dialog` since those primitives re-skin anyway). No other Lucide migrations in Sprint 6. Sprints 7–11 migrate per-screen; Sprint 12 removes the dependency.
10. **Sprint dependency order:** Sprint 8 **must** land before Sprint 10 (set-pill styling is shared — not a "nice to have").
11. **`theme-color` meta:** updated in Sprint 6 to the new paper tone (exact sRGB hex resolved in planning).

---

## 7. Sequencing summary

```
Sprint 6 Foundation
   └─▶ Sprint 7 Today ──────────────────┐
   └─▶ Sprint 8 History + Session Detail┤
   └─▶ Sprint 9 Settings + Import       │
   └─▶ Sprint 10 Workout screen ──▶ Sprint 11 SetLogSheet keypad ──▶ Sprint 12 Polish
                                                                        ▲
                                                                        │
      All prior sprints feed into Sprint 12 polish/audit ───────────────┘
```

Sprints 7 and 9 can run in any order after Sprint 6. Sprint 8 **must** land before Sprint 10 (set-pill styling shared). Sprint 11 must follow Sprint 10. Sprint 12 must be last.

---

## 8. Next step

Per sprint, invoke `writing-plans` with the spec scope and open-questions list for that sprint. Each plan is a separate document under `docs/superpowers/plans/` alongside existing `2026-04-17-sprint5-open-doors.md`.

Start with Sprint 6 (Foundation) — nothing else can begin until tokens, fonts, and primitives are on the new system.

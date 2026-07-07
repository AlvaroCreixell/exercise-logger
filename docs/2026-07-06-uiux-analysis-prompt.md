# Prompt: In-gym UI/UX analysis → hardening plan

Feed this to a clean Claude Code instance in this repo. Analysis only, no implementation.

---

# Task: In-gym UI/UX analysis → hardening plan (analysis only, no implementation)

You are the UX lead for **Exercise Logger v2**, a local-first PWA gym tracker
(React 19 + Vite + TypeScript in `web/`, Dexie/IndexedDB, deployed to GitHub Pages,
recently re-skinned as a Claude Code terminal theme). Read `CLAUDE.md` and
`web/src/services/CLAUDE.md` first.

## Product goal for this analysis

The app must be a **super simple in-gym companion**: phone on the bench, app shows
what to do next, shows what you did last time, and logging a set costs as close to
one tap as possible. Everything you produce must serve these two planned items:

1. **Guided logging — one tap to accept today's target.** Surface the progression
   engine's per-block suggestion at the point of decision (exercise card + set log
   sheet), and let the user log the expected set in a single tap (undo via toast),
   with the sheet reserved for deviations.
2. **Gym-proof the active screen.** Screen Wake Lock during active sessions,
   haptic/optional-audio cue when the rest timer completes, and flow focus
   (completed exercises collapse to their `⏺` line; current exercise + next set stay
   in the thumb zone).

Your job is NOT to implement these. Your job is to produce the evidence, the friction
inventory, and the concrete design decisions that make their implementation sprints
unambiguous.

## Method (do all of these)

**A. Simulated-workout walkthrough (primary evidence).**
Run the app (`cd web && npm run dev`, base path `/exercise-logger/`) in a mobile
viewport (375×812 / Pixel 7). Complete onboarding with the starter routine, then
simulate one full realistic session tap by tap: 7 exercises including a superset
pair, ~20 sets, at least one weight change vs suggestion, one extra set, one extra
exercise (cardio, duration+distance), one set edit after logging, one rest-timer
skip and one +30s, finish the workout. Then open History → session detail →
exercise history. For EVERY user intention (e.g. "log set 3 of squats same as
planned"), record: taps required, screen distance traveled (top/middle/bottom
third), what information was visible at the decision moment, and what was missing.
Present this as a table. Tap counts are the core currency of the whole report —
be exact, not approximate.

**B. Code-path audit of the suggestion pipeline.**
Trace where progression suggestions are computed vs where they surface:
`web/src/services/progression-service.ts` (`BlockSuggestion`, `getBlockLabel`),
`useExerciseHistory`, `ExerciseCard.tsx` (LAST strip, `emptyHintForBlock`),
`SetRow.tsx` (lastHint), `SetLogSheet.tsx` (what pre-fills the keypad, and when it
pre-fills 0). Answer precisely, with file:line citations: what does the engine
already know per block that the UI never shows? What would one-tap-accept log,
exactly (weight/reps/duration/distance per block type)? Where does auto-PR
detection (`personal-records`) intersect a quick-logged set?

**C. Platform feasibility notes (keep short, decision-grade).**
For Android Chrome PWA (the only real target): Screen Wake Lock API (incl. release
on visibilitychange + re-acquire), Vibration API from a timer that completes while
the tab is possibly backgrounded, and audio-cue autoplay constraints. State what is
reliable, what needs a user-gesture fallback, and what should be a Setting.

**D. Thumb-zone + glanceability pass.**
At 375px, map which interactive elements in the active-workout flow fall outside
the bottom-third thumb zone. Check tap-target sizes (flag anything <44px), the mono
truncation of long labels, and whether a resting user 2 m away can read "what's
next" at a glance. Screenshot evidence where it matters.

## Hard constraints (violating these invalidates a proposal)

- Domain invariants in `CLAUDE.md`, especially: **#7 extra exercises never receive
  progression suggestions** (so quick-log/targets must not appear on extras), **#8
  progression is per set block, not per exercise**, **#9 set logging upserts by
  [sessionExerciseId, blockIndex, setIndex]**.
- Local-first, no server, no accounts. All timestamps ISO UTC strings; weights
  canonical kg.
- The terminal design language is settled: `❯` prompt headings, `⏺` state dots,
  `⎿` connectors, `[TAG]` brackets, Claude orange accent, JetBrains Mono.
  Proposals must speak this language, not fight it. Touch targets stay full-size
  ("themed, not literal").
- 1214 unit tests + 28 Playwright E2E exist. Decorative glyphs are aria-hidden;
  semantic strings/ARIA must stay stable. Flag any proposal that would force test
  rewrites.

## Deliverable

Write `docs/superpowers/specs/2026-07-XX-in-gym-hardening-plan.md` (today's date)
with exactly these sections:

1. **TL;DR** — 10 lines max: current median taps-per-set, projected taps-per-set
   after guided logging, the 3 worst friction points found, go/no-go on wake lock +
   haptics feasibility.
2. **Walkthrough friction inventory** — the table from Method A, ordered by
   (frequency × cost), each row with evidence (file:line or screenshot ref).
3. **Guided logging design** — the decided design, not options: exact card layout
   per block (ASCII mockup in the terminal vocabulary), the one-tap gesture and its
   undo, sheet pre-fill rules per block type (weight×reps / reps-only / duration /
   distance / top-set blocks), what happens on blocks with no history (day one),
   and the invariant-#7/#8 boundaries. Include edge cases: mid-block weight change,
   extra sets on a completed block, superset partners.
4. **Gym-proofing design** — wake-lock lifecycle (acquire/release/re-acquire rules),
   rest-complete cue matrix (visual/haptic/audio × setting states), collapse/focus
   behavior spec (what collapses, what stays, how the user reopens).
5. **Small-fix list** — everything found in the walkthrough that fits in <1 h each
   (known candidates to verify: ExercisePicker has no visible close control; mono
   truncation of day labels; keypad ± nudge steps vs equipment increments).
6. **Acceptance metrics** — measurable, e.g. "common-case set logged in 1 tap",
   "20-set session ≤ N total touches (from M today)", "zero manual unlocks during a
   45-min session", "rest cue perceivable with phone in pocket".
7. **Sprint cut** — split all of the above into two implementable sprints matching
   items 1 and 2, each with file-level scope and risk notes.

Rules of engagement: measure before opining — every claim about friction needs a
tap count, a screenshot, or a file:line. Prefer decisions over option menus; you
are writing a plan an implementer follows without asking questions. Do not modify
any source files; the only file you create is the report. Do not run
`git commit`/`push`.

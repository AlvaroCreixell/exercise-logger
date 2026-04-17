# Exercise Logger v2 — Full-Scope Review & Shine Plan

**Date:** 2026-04-17
**Reviewer:** Claude (Opus 4.7, 1M context)
**Scope:** Entire `web/` tree, docs, GPT integration, PWA surface
**Focus weighting:** UI/UX & visual design ~60%, product polish ~25%, architecture/code health ~15%
**Predecessor:** `docs/archive/reviews/codebase-review-2026-04-16.md` — most backend/invariant findings there were resolved in Sprints 1–3. This review starts from the post-Sprint-3 state and pushes forward.

---

## Status update — 2026-04-17 evening (post Sprint 4 merge)

**Sprint 4 "Workout Shine" shipped as PR #6 (squash-merged `b606d98`).** 14 commits, 503/503 tests, build/lint/typecheck clean.

- ✅ Typography utilities landed (`.text-hero`, `.text-value`, `.text-value-sm`, `.text-eyebrow`).
- ✅ Seven new components: `Stat`, `Pill`, `SectionHeader`, `EmptyState`, `BlockStripe`, `SessionProgress`, `SetDots`.
- ✅ `SetSlot` bumped to 56×80 min + heading-font logged value; `flash-logged` keyframe upgraded to ring-pulse + scale-bounce.
- ✅ `ExerciseCard` redesigned around `BlockStripe` + combined Last/Suggestion line + larger Urbanist heading.
- ✅ `SessionProgress` meter mounted into WorkoutScreen sticky header.
- ✅ `SetLogSheet` redesigned: `SetDots` header, inline Last/Suggested context, tile `h-14` inputs, `save-pulse` animation.
- ✅ `DaySelector` adopted `Pill`.
- ⚠️ Deferred to Sprint 5: `WorkoutScreen.test.tsx` smoke (was S4.8), `SectionHeader`/`Stat` adoption at existing callsites (primitives exist but only `Pill` and `EmptyState` are consumed so far), `SetLogSheet` open-edge prefill refactor.

What's written below is the 2026-04-17 morning review unchanged — ✅/⚠️/❌ markers have been added inline and the Sprint 5 table in §6 has been refined to reflect Sprint 4's shipped state.

---

## 0. TL;DR

**The foundation is excellent.** The codebase is disciplined, well-tested at the service layer, and the three post-review sprints landed every invariant fix, the YAML-paste unblock, the SW update prompt, icons, iOS meta, and an Install button. There's very little architectural debt to pay down before you can focus on making it *feel* like a product instead of a tool.

**The remaining "it does the job but isn't exciting" gap is a design-language gap, not a feature gap.** The app has a decent visual skeleton (Softened Swiss, Urbanist + DM Sans, a single saturated CTA, semantic color tokens) but the skeleton isn't carrying weight. It reads as *restrained* where you want it to read as *sharp and editorial*. There are no moments that feel rewarding, no hierarchy that pulls your eye, no visual memory — nothing you'd screenshot.

**Three bets will drive 80% of the perceived quality uplift:**

1. **Treat the Workout screen as a dashboard, not a form.** Give it a live, visible sense of progress (volume bar, sets-done meter, elapsed time) + a celebratory micro-moment when sets land. Today it's a list of cards; it should feel like a cockpit.
2. **Build a real design system instead of shadcn defaults + tokens.** Introduce a second saturated color, a proper heading scale, iconographic empty states, and deliberate use of the `font-heading` face on *values* (weights, reps, durations — numbers are the content of this app). Numbers should be the stars.
3. **Invest in three micro-moments of delight:** set logged, workout finished, streak continued. Subtle but unmistakable. 100–400ms each. This is what separates utilitarian from "I want to open it."

Everything else in this review supports those three bets or cleans up tail work.

### Top 10 ranked improvements (UI-weighted)

| # | Item | Status | Effort | Impact |
|---|---|---|---|---|
| 1 | **Numeric-first typography pass** — hoist weights/reps/durations into `font-heading` with tighter scale, give them visual weight | ✅ Sprint 4 | 2–3 h | Highest per-hour ROI. Turns every card into a readable dashboard |
| 2 | **Workout-screen progress meter** — "6 / 18 sets · 14 min" at top of scrollable body, updating live; tiny volume sparkline | ✅ Sprint 4 (sparkline deferred) | 3–4 h | Makes the core experience feel alive |
| 3 | **"Set logged" celebratory moment** — the existing 600 ms flash is fine but generic; swap for a spring-tinted ring expansion + haptic-feel scale pulse + numeric count-up | ✅ Sprint 4 (count-up deferred) | 2 h | The single most-tapped action becomes satisfying |
| 4 | **Workout complete screen** — finish shouldn't just toast and navigate; full-sheet summary with total volume, PR badges, session duration, 3 highlight moments | ❌ Sprint 6 | 6–8 h | Closes the loop, converts the hard work into a feel-good payoff |
| 5 | **Empty states with character** — icon + muted accent tint + one-line copy that has personality; replace every "No X" page | ⚠️ Sprint 4 partial (primitive + 1 of 4 callsites) | 2 h | First-run impression; right now it feels like an alert box |
| 6 | **Today screen hero redesign** — push the day label down, make the suggested day a prominent card that previews the first 2 exercises, plus a "streak" / "last trained" ribbon | ❌ Sprint 5 | 4 h | Turns the entry point into a landing page |
| 7 | **Bottom nav polish** — add haptic-feel press state, move to pill-filled active indicator with icon weight swap, optional unread dot when a session finishes | ❌ Sprint 5 | 1 h | Bottom nav is permanent real estate. Should look designed |
| 8 | **Second saturated accent color** — paired with the CTA purple; warm accent for "progress" / "PR" / "streak" distinguished from semantic success green | ❌ Sprint 5 | 1 h token work + 2 h application | Breaks the "grayscale + one accent" flatness |
| 9 | **ExerciseCard visual rhythm** — swap the flat stack for: bold exercise name, quiet target line, vibrant set-slot row, small inline history chart; add a left stripe colored by block type | ✅ Sprint 4 (history chart deferred) | 3 h | The most-viewed unit of the app. Currently the weakest |
| 10 | **Session-detail summary header** — show total volume, top set, duration, PR badges before the scrollable exercise list | ❌ Sprint 6 | 2 h | Makes History feel like it has payoff |

**Ship order:** 1 → 3 → 8 → 9 → 2 → 5 → 6 → 10 → 7 → 4. That sequence builds the design system early (1, 3, 8) and front-loads the screens your user touches most.

**Estimated all-in effort:** ~30–35 focused hours for items 1–10. Doable in two sprints. After that you have something that looks like a product.

---

## 1. State of the Codebase Going In

### 1.1 What the last review unblocked

Per `git log` and `docs/archive/reviews/codebase-review-2026-04-16.md`, Sprints 1–3 shipped:

- **Sprint 1 (visual polish):** clipboard-paste YAML, Workout header hierarchy, saturated set slots, exercise-name typography, `p-5` spacing baseline, test-count docs correction, motion tokens.
- **Sprint 2 (invariant hardening):** `logSet` wrapped in transaction (R1 closed), `editSet` blocks promotion on finished sessions (R2), throws on missing `sessionExercise` (R3), `finishSession` guards corrupt `dayOrderSnapshot` (R4), E2E assertions hardened.
- **Sprint 3 (PWA polish):** SW prompt-mode + `SWUpdatePrompt` toast, full icon set including maskable, iOS meta tags, `useInstallPrompt` hook + Install button in Settings, `yaml` dynamic-import (~50 kB off main), GPT instructions hardened.

**Confirmed still correct** by spot-checking current code:
- `set-service.ts:106–219` — `logSet` wrapped in `db.transaction("rw", sessions + sessionExercises + loggedSets)`. Good.
- `vite.config.ts:30` — `registerType: "prompt"`.
- `index.html:7–10` — iOS meta tags present.
- `App.tsx:140` — `<SWUpdatePrompt />` mounted.

### 1.2 What's still partial from the prior plan

| Item | Status | Notes |
|---|---|---|
| **Android copy-paste guidance in GPT instructions** | pending | Low-cost docs task |
| **`file_handlers` + `launchQueue` consumer** | pending | Long-term Android fix; paste flow is sufficient today |
| **`manualChunks` for Settings + dialogs** | pending | Bundle still heavier than necessary but acceptable for now |
| **Component tests for `WorkoutScreen`, `SetLogSheet`, `SettingsScreen`, `TodayScreen`** | partial | `SetSlot`, `RoutineImporter`, `useInstallPrompt` covered. Main four screens untested |
| **Coverage tool** (`@vitest/coverage-v8`) | not installed | No CI gate yet |

### 1.3 Fresh observations (new since last review)

These were not covered by the 2026-04-16 review:

- **`SessionStatus` still has the dead `"discarded"` branch** in the type union even though it was dropped per R9. Verified: `git log 1896863` shipped the enum removal — confirmed gone. Ignore.
- **`ThemeSync` / `setTheme` infrastructure** — `setTheme` still exists in `settings-service.ts` and `Settings.theme` is still persisted, but there is **no UI exposing it** (Settings removed the toggle in the "drop dark mode" commit `3de5f8c`). That's fine, but the field is now dead weight. A schema-v3 migration to drop it is optional low-priority cleanup.
- **`SetLogSheet` prefill effect has 14 dependencies** (`SetLogSheet.tsx:135`). The comment acknowledges the re-entry bug; moving to an `open`-edge ref would be ~15 LOC and close a real class of "why did my typing get clobbered" reports when they happen.
- **`unitOverride` on extras** — R5 was fixed in `004417d`, but the mechanism is now "extras match extras-only." This is correct but means the *first* time a user adds Bench as an extra, it always falls back to the global unit. Probably fine, worth noting if you ever hear user confusion.
- **`DEFAULT_SETTINGS.theme = "system"`** (`db/database.ts:61`) is stale — `ThemePreference` still allows `"light" | "dark" | "system"` but the UI is light-only. Low-priority cleanup.
- **No `noUncheckedIndexedAccess`** in `tsconfig.app.json`. Reading tests shows plenty of `arr[0]!` patterns that would catch real bugs. Low priority.

None of these block anything.

---

## 2. The UI/UX Deep Dive

This is the section you asked for. I'll separate structural observations from specific fixes.

### 2.1 Diagnosis: why it's good but not striking

The app currently sits at about **7/10 visual execution** — competent, coherent, readable. The gap to 9/10 is composed of the following:

#### 2.1.1 The aesthetic isn't committed

"Softened Swiss" is a fine direction, but what's shipped reads as "generic shadcn with top borders and sans fonts." True Swiss/editorial design does three things *religiously*:

1. **Extreme typographic contrast.** Screaming big headlines next to tiny meta text. Currently: `text-2xl` headlines + `text-sm` body is only a 1.75× ratio. Editorial pages hit 3–5×.
2. **Radical number-forward layouts.** When content is numeric, the numbers are the design. Currently numbers are `text-sm tabular-nums` — treated as text, not as information architecture.
3. **Breathing whitespace + disciplined grid.** Currently `p-5` is fine, but sections are all stacked at equal weight. No breathing room between a hero moment and the supporting detail.

You're closer to "clean admin panel" than "sharp fitness product." The ceiling on where you can go with the current typography + spacing scale is limited.

#### 2.1.2 Color is doing too little

Inventory of saturated color in the live app:
- **Purple CTA** (`oklch(0.546 0.245 262.88)`) — used for: day selector "Day B" label, superset stripe, bottom-nav active underline, start-workout button background.
- **Success green** (`oklch(0.60 0.20 145)`) — logged set slots, progression arrow.
- **Info teal** (`oklch(0.65 0.15 195)`) — Resume-Workout card, maintenance chip.
- **Warning amber** (`oklch(0.75 0.15 85)`) — "Finish workout first" text, TOP badge.
- **Destructive red** — discard, delete, clear.

The purple is the only *memorable* color. It's doing five jobs (day label, superset, nav, CTA, session badges) and reads as "the brand color" because there's nothing else competing. That's fine — but then the success/info/warning/destructive are pale and muted enough that the user's visual system stops associating them with meaning. They read as "slightly tinted neutrals."

**Fix direction:** Either commit fully to mono + one accent (remove the semantic-soft palette; just use opacity + grayscale with purple for all "status") or introduce a **second warm accent** for achievement/progress/PR so `cta` isn't carrying both "brand" and "you did it." A coral/amber warm complement to the cool purple would add a second note without blowing up the system.

#### 2.1.3 Numbers don't feel like numbers

Open the Workout screen during a session. The user's attention during a working set is: *what did I do last time? what am I doing now? what am I supposed to hit?* These are three numeric questions. Right now:

- **Target line** ("3 x 8-12 reps") — `text-xs font-medium tabular-nums` at the top of each block. Small.
- **Last-time line** ("Last: 80kg x 8, 8, 7") — `text-xs text-muted-foreground`. Tiny and muted.
- **Logged set slot** ("80x8") — `text-xs font-medium tabular-nums`. Tiny inside the button.
- **Suggestion** ("82.5kg ↑") — `text-xs text-success font-semibold`. Tiny.

Four tiny, identically-weighted numeric elements in the same card. The eye has nothing to land on. Under the physiological stress of a working set, users scan for the *one* number that matters.

**Fix direction:** Pick one "hero number" per block — probably the logged set value when present, otherwise the target. Make it `font-heading`, `text-lg`–`text-xl`, aligned right in a column layout. Demote the others to support.

#### 2.1.4 Cards are all the same shape, size, and weight

The app has maybe 8 distinct card-like surfaces:
- Resume workout card
- Day preview card
- Last-session card
- Session card (history)
- Exercise card (workout)
- Exercise card (session detail, read-only variant)
- Cardio card
- Settings section card

All of them use the same `<Card>` primitive with `border-t-2 border-border-strong rounded shadow-sm py-4`. The user has no visual hierarchy to lock onto — every card is equally important.

In a good design, there's a *hero* card per screen (the thing the user should tap, the thing that rewards them) and *support* cards (reference info, secondary actions). Today they all look support-tier.

**Fix direction:** Define 3 card types:
- **Hero card** — saturated fill, large padding (`p-6`), prominent title, optional illustration slot. Used for: Resume Workout, Start Workout CTA, workout-complete summary.
- **Content card** — current default. Used for: history list, routine list, day preview.
- **Detail card** — even quieter, no border, just padding + separators. Used for: session-detail exercise cards (which are read-only).

#### 2.1.5 Motion is absent where it matters most

Current motion inventory:
- Button press: `active:translate-y-px` on `Button`, `active:scale-95` on `SetSlot`.
- Sheet open/close: `duration-200` slide.
- Set-slot flash: 600 ms `flash-logged` keyframe (scale 1.05 → 1.00).
- Dialog open: `duration-100` fade + zoom.

Missing:
- Any transition when data changes (a new suggestion appearing, a "Last" line updating).
- Any acknowledgement of *progress* within a session (3 sets done → 4 sets done should feel like something).
- Any animation when navigating between tabs (currently instant, which feels abrupt on mobile).
- Any feedback when a workout is finished beyond a toast.
- Any animation on the day selector when you switch days.

The scale-press on SetSlot is the *most* delightful part of the app. It's a one-liner that feels great. You could multiply that by 10 with another few targeted additions.

#### 2.1.6 Empty states are utilitarian

Current "No Active Routine" (`TodayScreen.tsx:52–65`): centered heading, one line of helper text, an outline button. That's it.

Compare to what the moment deserves: this is the first thing a first-run user sees. Right now it communicates "the app is empty." It should communicate "this is the space where your training lives; let's fill it up."

Same for:
- "No Active Workout" (Workout tab) — user just finished a session, back to empty. A moment to acknowledge ("Nice work. Next session: Day B — Pull.") would be better than "Start a workout from the Today tab."
- "No History Yet" — first-run user has no emotional anchor here.

**Fix direction:** Each empty state gets an icon (Lucide has great options: `CalendarCheck`, `Dumbbell`, `Flame`), a muted background tint, a one-liner with personality, and the action. Minimum 5 minutes per state, so ~20 min for all four. Massive perceived-quality win.

### 2.2 Screen-by-screen

#### 2.2.1 `TodayScreen` (`features/today/TodayScreen.tsx`)

**Current:**
- State A: title + 2 lines of text + outline button, vertically centered. Generic.
- State B (normal): routine name as h1, DaySelector, DayPreview, Cardio card, LastSessionCard, sticky "Start Workout" CTA.
- State C (active session): a simple `info-soft` card with routine/day/elapsed.

**Issues:**
- The "Start Workout" action is the single most important thing on this screen, but it lives at the bottom behind all the content. The user has to scroll on longer days (Day C of the bundled routine has 9 exercises). The user's mental model is "I want to start now" — they should be able to without scrolling.
- **DaySelector pills are ugly.** Small boxy `border-[1.5px]` buttons with a tiny dot for "suggested." Functional but visually dead. The suggested day deserves way more than a 6×6 px dot.
- **DayPreview is a flat list.** Exercise name + "3 x 8-12" per row. No indication of "which muscle group?" "how many sets total?" "how long will this take?" — which are the questions a user asks before starting.
- **LastSessionCard is an afterthought.** Buried below everything else. It should be a source of continuity ("3 days ago, 52 min · nice streak") but currently it's just "Last workout: Day C · 3 days ago · 55 min" in muted text.
- **Cardio card is visually indistinct** from other sections. It's `bg-muted p-3` — same visual weight as a section header.

**Proposed redesign:**

```
┌─────────────────────────────────────┐
│  🔥 3-DAY STREAK     Full Body 3-Day│   <- streak ribbon / routine name
│                                     │
│ ┌─ TODAY: DAY B ────────────────┐  │   <- hero "what's next" card
│ │                                │  │      saturated fill
│ │  Pull                          │  │      body: first 2 exercise names
│ │                                │  │      CTA button in-card
│ │  Deadlift · 3 × 6–8            │  │
│ │  + Rows, Lat Pulldown · 6 more │  │
│ │                                │  │
│ │      ▶  START WORKOUT          │  │
│ │                                │  │
│ │  Est. 45 min                    │  │
│ └────────────────────────────────┘  │
│                                     │
│  Switch day                         │   <- muted label, not tabs
│  [A] [B✓] [C]                       │   <- bigger pills with day names
│                                     │
│  Last session                       │
│  Day A — 3 days ago · 52 min       │
│  ─────                              │
│                                     │
│  Cardio (optional)                  │
│  Walk, rowing, or mix               │
└─────────────────────────────────────┘
```

Keeps all the current information. Reorders so the most important thing (start) is largest and first. Turns the selector into a below-fold affordance (because 90% of the time the user wants the suggested day).

#### 2.2.2 `WorkoutScreen` (`features/workout/WorkoutScreen.tsx`)

**This is the most-viewed screen, so it deserves the most care.**

**Current:**
- Sticky header: day label (small caps, purple) + routine name (h1).
- Scrollable body: `ExerciseCard` per exercise, `SupersetGroup` wrapping pairs.
- Sticky footer: Add Exercise + Finish Workout + Discard link.

**Issues:**
1. **No sense of progress.** User is logging set 7 of 18 and has no visual indication where they are in the session. A sticky progress bar at the top ("7 / 18 sets · 18 min") would be the single biggest functional/visual upgrade on this screen.
2. **No sense of what's next.** Current exercise card doesn't visually distinguish from others. Users lose their place between sets. A "current" marker (subtle colored left border on whichever card has the most recent activity) would cost nothing and help a lot.
3. **The "Finish Workout" CTA is too neutral.** When the user is at the end, hitting finish should feel like the point. It's currently a standard `cta` button next to an outline "Add Exercise." The layout doesn't signal "you're at the end, press this."
4. **`Discard workout` link under the footer** is visually louder than it should be. It's red. Red on a key action surface = accidental tap risk.
5. **Exercise cards don't convey their own progress.** A 3-block, 11-set exercise card should show "0/11 logged" → "5/11 logged" → "11/11 ✓" somewhere. Right now you have to count slots.

**Proposed changes:**

1. **Add session progress header** below the sticky routine header (or inside it):
   ```tsx
   <div className="flex items-baseline justify-between gap-4 px-5 py-2 border-b border-border">
     <span className="text-2xl font-heading font-bold tabular-nums">
       {loggedCount}
       <span className="text-base text-muted-foreground"> / {totalSets}</span>
     </span>
     <span className="text-xs text-muted-foreground tabular-nums">
       {elapsedMin} min · {exerciseCount} exercises
     </span>
   </div>
   <div className="h-0.5 bg-muted relative overflow-hidden">
     <div
       className="absolute inset-y-0 left-0 bg-cta transition-all duration-300"
       style={{ width: `${(loggedCount / totalSets) * 100}%` }}
     />
   </div>
   ```
2. **Exercise card: add per-card progress indicator** — subtle "3/9" in the card header, or even better, a tiny horizontal pip row next to the name.
3. **"Finish workout" treatment when session is complete** — when `loggedCount === totalSets`, swap the button into an attention-seeking state (gradient fill, bigger size, or an "All sets logged ✓ Finish" label).
4. **Move Discard to a menu.** Three-dot icon in the sticky header → dropdown with Discard. Red link on the main surface is a mistake.

#### 2.2.3 `ExerciseCard` (`features/workout/ExerciseCard.tsx`)

**The atomic unit of the workout screen. The biggest UI win is here.**

**Current layout (per block):**
```
[TOP]  3 x 8-12 reps
Last: 80kg x 8, 8, 7
↑ 82.5kg
[set slot 1] [set slot 2] [set slot 3]
```

**Issues:**
- All four rows are small text in a similar weight. No hierarchy.
- Block label ("TOP") is a soft colored chip, easy to miss.
- The prescription ("3 x 8-12 reps") is the same weight as the last-time line but they're different kinds of information.
- The set slots are the only vibrant element, but they're at the bottom, after all the context.
- Multi-block exercises (e.g., Squat: 1 top + 3 back-off) repeat this layout twice, so the card gets visually monotonous.

**Proposed redesign:**

```
┌───────────────────────────────────────────┐
│ DEADLIFT                         [kg] [·] │  <- exercise name, large; unit, menu
│ Deload week — focus on form                │  <- notes (if any)
│                                           │
│ ┃ TOP                                     │  <- left stripe + chip (warning color)
│ │ 1 × 6–8 reps                            │  <- quieter target
│ │ Last 120kg × 7 · ↑ 125kg               │  <- combined, one line
│ │                                          │
│ │  [ 125×6 ✓ ]                            │  <- set slot (bigger, bolder)
│ │                                          │
│ ┃ BACK-OFF                                │  <- different stripe color (neutral)
│ │ 3 × 8–12 reps                           │
│ │ Last 100kg × 10,10,8                     │
│ │                                          │
│ │  [ 1 ] [ 2 ] [ 3 ]                      │
└───────────────────────────────────────────┘
```

Specifically:
- **Exercise name: `text-lg font-heading font-bold tracking-tight`** (not text-base, not uppercase — it's already not uppercase, but it could go bigger).
- **Block stripe** — a 2–3 px left colored border per block, using a different color per block type (top = warning, amrap = info, default = neutral). This gives multi-block cards instant visual rhythm and kills the "two identical blocks" problem.
- **Target line** — make it quieter. `text-xs text-muted-foreground`. The user already knows they're doing 8–12 reps. They need it for reference, not for prominence.
- **Combine Last + Suggestion on one line.** "Last 120kg × 7 · ↑ 125kg" is one thought, not two.
- **Set slot row gets more visual weight.** Currently `flex gap-2`, set slots are `min-w-[4rem] min-h-[48px]`. Bump to `min-w-[5rem] min-h-[56px]` and bump the font inside to `text-sm font-heading`. Make the logged value feel like a trophy, not a data cell.

#### 2.2.4 `SetLogSheet` (`features/workout/SetLogSheet.tsx`)

**Current:** A bottom sheet with a title header, one to three numeric inputs, a Save button, and (when editing) a small red Delete link.

**Issues:**
- **The title is a cramped string:** `"Deadlift — Top — Set 2 of 3"`. Four levels of information glued together with em dashes. Hard to parse.
- **No visual context for which set** you're on. "Set 2 of 3" is text. It could be three small dots with the middle one filled.
- **Labels above inputs feel like an admin form.** "Weight (kg)" → number input. Fine, but the number input itself is only `h-12`. On a workout phone the user wants big friendly fields.
- **Suggestion/last-time aren't shown in the sheet at all.** The parent component (`WorkoutScreen.tsx:334-348`) fetches them but only uses them for prefill. The user who's looking at the sheet doesn't see "↑ 125 kg" anywhere. They have to dismiss the sheet to see the card's suggestion line.
- **The "add weight to bodyweight" flow is buried** as a text link below the fields. The one-time irreversible promotion feels like a footnote.
- **No animation on save.** Sheet dismisses with a standard slide-down. A subtle "saved" flash before dismiss would close the loop.

**Proposed redesign:**

```
┌───────────────────────────────────────────┐
│                                           │
│  DEADLIFT                                 │  <- big heading
│  Top set                                   │  <- chip/subtitle
│                                           │
│  ○ ● ○                                    │  <- visual set indicator
│  Set 2 of 3                                │
│                                           │
│  Last time                                 │  <- context inline
│  120 kg × 7                                 │
│                                           │
│  Suggested:  125 kg ↑                      │
│                                           │
│  ┌────────────────┐ ┌───────────────────┐ │
│  │                │ │                   │ │
│  │      125       │ │         6         │ │
│  │                │ │                   │ │
│  │       kg       │ │       reps        │ │
│  └────────────────┘ └───────────────────┘ │
│                                           │
│  [  S A V E  ]                             │  <- bigger, more prominent
│                                           │
│       Delete this set                      │
└───────────────────────────────────────────┘
```

- Big, tile-style numeric fields (tap the number, keypad opens, decimal).
- Show last/suggested inline so the user has context while entering the value.
- Visual set dots (•) so the user sees "I'm on the middle set of three" without reading.
- Delete stays small and ghost.
- On save: scale-pulse the field, 120 ms flash on the save button, then dismiss.

#### 2.2.5 `HistoryScreen` + `SessionDetailScreen`

**Current `HistoryScreen`:** flat list of session cards, each with routine name, date, exercise/set count.

**Issues:**
- No summary at the top. "You've done 14 sessions, 312 sets, in the last 30 days" would give the screen weight.
- No visual grouping by week/month. A session from yesterday and one from last month look identical.
- No filters or sort (fine for single-user app, but a tiny "this week / this month / all" tab group would help navigation at volume).
- Session cards are visually uniform — a 45-min workout looks the same as a 90-min workout.

**Current `SessionDetailScreen`:** back link + header + read-only exercise list.

**Issues:**
- No summary at the top. "52 min · 9 exercises · 27 sets · 2,430 kg total volume · 2 PRs" would be a powerful payoff for the user who just finished.
- No chart/visual. This is a historical record — it should invite the user to dwell, not just scroll.
- The exercise name is the only link (to ExerciseHistory). The whole row should be tappable.

**Proposed:**
- Both screens get a summary block at the top.
- History screen groups sessions by "This week" / "This month" / "Earlier" with small section headers.
- Session detail gets a "moments" strip ("Best set: Deadlift 125 × 6, estimated PR") above the exercise list.

#### 2.2.6 `ExerciseHistoryScreen`

**Current:** back button, exercise name, session-grouped blocks with raw set values.

**Issues:**
- This screen is *almost* a graph. All the data is there. It just shows it as text.
- No visual indication of progression (are the numbers going up?).
- No sense of volume over time.
- No filter by block signature (top vs back-off — they live in the same stream today).

**Proposed:** Add a 200-px tall bar/line chart at the top showing top-set weight over time, with the set list below it as detail. This is the one place where a chart unambiguously adds value (and doesn't require a chart library — 40 LOC of SVG with the existing data).

#### 2.2.7 `SettingsScreen`

**Current:** header + 3–4 cards (Routines, Preferences, Install, Data).

**Issues:**
- Functional and fine, but the most-visited part of Settings is probably the Import Routine flow, which is nested inside the Routines card after the list. A first-run user has to read past the existing routine to find the import UI.
- The Install card's conditional rendering (`{canInstall && ...}`) is correct but means there's visual jitter — the user sees the card appear/disappear based on state they don't understand.
- "Clear All Data" button has `className="... text-destructive border-destructive/30 hover:bg-destructive-soft"` — custom styling on top of the `outline` variant. Should just be a `destructive` variant (which doesn't exist on the Button primitive in this form; the one that's there is filled red-tinted). Needs a dedicated "destructive outline" variant.

**Proposed:**
- Swap Routines section order: importer first, list second. (Power user who already has a routine can scroll past; first-run user sees the import CTA immediately.)
- Move Install and Data into a single "About" or "System" card to declutter.
- Add a "Theme" section (even if light-only) with a "coming soon" placeholder — or just remove all references to `theme` from the codebase.

### 2.3 Micro-interaction inventory & opportunities

| Interaction | Current | Proposed |
|---|---|---|
| Set slot tap | `active:scale-95` + color transition | Keep. Add subtle ring-pulse (1×) on successful log |
| Save set | Sheet closes, no animation | Scale-pulse save button, 120 ms flash success, then dismiss |
| Switch day | Instant layout change | Fade old day preview out (80 ms), fade new one in (120 ms) |
| Tab nav | Instant | Fade + 4-px slide (120 ms). Active-tab underline grows |
| Resume Workout card tap | Instant | Scale + elevation lift on press |
| Workout finished | Toast + navigate | Dedicated "complete" screen with summary + animation |
| New set logged (cross-tab) | Silent | Brief purple pulse on the affected card |
| Streak increment | N/A | Flame icon appears in Today header |
| New PR | N/A | Golden badge flash on Session Detail + History card |

Everything below the line is net-new feature work but cheap (most items are ≤ 50 LOC each).

### 2.4 Design system opportunities

The best thing you could do for long-term sustainability is codify what you've got into a reusable set. Right now the rules live in comments and designer memory.

**Concrete "design system" artifacts to ship:**

1. **A `<Stat>` component** for displaying a number + label. Every screen uses this pattern (elapsed time, set count, weight, duration). A single component with size variants (`sm | md | lg | hero`) would enforce typography and give you a place to add the "tabular-nums" + "font-heading" pattern by default.
2. **A `<SectionHeader>` component** — the current `text-sm font-semibold uppercase tracking-wider text-muted-foreground` pattern is in 5+ places.
3. **A `<Stripe>` component** for block-label visual bars (top / amrap / default).
4. **A `<Pill>` component** for day-selector-style small tappable choices. Current `DaySelector` has 20 lines of button styling that could be 5.
5. **An `<EmptyState>` component** — icon + heading + body + optional action. Use in all four empty states.
6. **A `<CTAButton>` variant** — larger padding, bigger text, heading font. Distinct from the `cta` variant which is still small. Reserve for "Start Workout" and "Finish Workout" and nothing else.

Total code added: ~300 LOC across 6 components. Code removed: ~600 LOC of duplicated class strings across features. Net negative. And the design language becomes enforceable.

### 2.5 Typography scale proposal

Current scale (empirical, extracted from screens):

| Size | Usage |
|---|---|
| `text-xs` | meta, hints, tabular small |
| `text-sm` | body, buttons, card content, set values |
| `text-base` | exercise names, card titles |
| `text-lg` | form inputs |
| `text-xl` | (unused) |
| `text-2xl` | screen headings |

Problems:
- Only 2.4× range from smallest to largest. Editorial design hits 6–10×.
- `text-sm` is overloaded — does everything from buttons to card content to last-time data.
- Exercise names are at `text-base`, same as any card content. The most-read unit of the app isn't distinguished.
- No scale dedicated to numbers. Numbers are the content.

Proposed scale:

| Role | Class | Font | Usage |
|---|---|---|---|
| Hero value | `text-4xl font-heading font-bold tabular-nums` | Urbanist | Workout summary total volume, set-complete count |
| Screen title | `text-2xl font-heading font-bold tracking-tight` | Urbanist | h1 per screen |
| Card title | `text-lg font-heading font-semibold` | Urbanist | Exercise names, card headers |
| Value | `text-lg font-heading font-bold tabular-nums` | Urbanist | Logged set values, targets in prominent positions |
| Body | `text-sm font-medium` | DM Sans | Card content |
| Meta | `text-xs text-muted-foreground tabular-nums` | DM Sans | Last-time lines, dates, durations |
| Micro | `text-[11px] uppercase tracking-widest` | DM Sans | Badge chips, tiny labels |

This introduces Urbanist as the face of *values* — exercise names, weights, reps. DM Sans stays as the conversational voice. The current setup uses `font-heading` only on screen titles, which wastes 80% of the face's personality.

---

## 3. Architecture & Code Health

**Summary: excellent. The prior review's critical-path items are all shipped. What remains is small, specific, and not blocking "shine."**

### 3.1 Still worth doing (low-priority)

1. **`SetLogSheet` prefill effect: switch to open-edge detection** (`SetLogSheet.tsx:85–135`). Current effect has 14 deps and the inline comment acknowledges a real clobbering bug. Fix:
   ```tsx
   const prevOpen = useRef(false);
   useEffect(() => {
     if (open && !prevOpen.current) {
       // prefill logic
     }
     prevOpen.current = open;
   }, [open, /* stable deps */]);
   ```
   ~15 LOC.
2. **Dead `theme` field** in `Settings` + `DEFAULT_SETTINGS` + `ThemePreference` enum. Not hurting anyone but is a minor trap for future contributors. Schema-v3 migration removes the field. ~30 min.
3. **Export `validateSetInput`** from `set-service.ts` so SetLogSheet can pre-validate. Currently validation happens only when saving — pre-validating on blur would give faster error feedback. ~15 min.
4. **Extract `useExerciseCardData(sessionExercise, globalUnits)`** hook. `WorkoutScreen.tsx:260–354` has two wrapper components (`ExerciseCardWithHistory` and `SetLogSheetWithHistoryForDetail`) that both call `useExerciseHistory` for the same thing. One shared hook reduces duplication. ~20 min.
5. **Extract `<SessionProgress>` component** computed from `loggedSets` / `sessionExercises`. Right now the numerator/denominator logic is recomputed inline in `WorkoutScreen.tsx:100–105`. Will be reused by #2 (progress meter) and by the workout-complete screen.
6. **`DayPreview` "estimated duration"** — probably not worth real computation, but a rough estimate ("45 min") based on set count × 2 min + rest count × 1 min, displayed on Today's hero card, would give the user useful information with minimal effort.

### 3.2 Things the prior review noted that are still not done

Copied with status:

- **`CSV` parser RFC 4180 quoting** — still a latent issue. Not bite today.
- **`useRoutine` null-vs-undefined three-state contract** — still confusing. Fix is 30 min.
- **`noUncheckedIndexedAccess`** — still off. Enable + spend 2 h fixing fallout.
- **`findPreviousUnitOverride` perf** — still loads all finished sessions. Still fine today at any user's volume.
- **`downloadBackupFile` unit test** — still missing. 30 min.

None of these are "shine" blockers.

### 3.3 What I wouldn't touch

- **The service layer.** It's tight.
- **The Dexie schema.** v2 added `unitOverride` correctly; no further changes needed.
- **The folder structure.** Feature folders are well-isolated.
- **The path alias / Vite config.** Done right.

---

## 4. Testing & Tooling

**Current: 440 unit + integration tests + 9 E2E tests. Strong service coverage, weak UI coverage.**

### 4.1 What's new since the prior review

- `SetSlot` tests added.
- `RoutineImporter` tests added.
- `useInstallPrompt` tests added.
- jsdom pointer-capture polyfill added.

That's 3 files and ~25 tests delta.

### 4.2 Still missing from the prior plan

In order of value:

1. **`SetLogSheet.test.tsx`** — cover prefill priority (existing > carryover > suggestion > last-time > empty), bodyweight promotion flow, save validation, cardio extras, edit-vs-create mode. ~15 tests.
2. **`WorkoutScreen.test.tsx`** — integration test with `fake-indexeddb`: start session → log set → edit set → delete set → add extra → finish. One big smoke. ~8 tests.
3. **`TodayScreen.test.tsx`** — state A/B/C transitions, day selector integration, start-session flow. ~10 tests.
4. **`SettingsScreen.test.tsx`** — routine import UX, clear-data confirmation, export download. ~8 tests.
5. **Hook tests** for `useAppInit`, `useActiveSession`, `useRoutine`, `useSettings`. ~4 files, ~20 tests total.
6. **Coverage tool.** Install `@vitest/coverage-v8`, add `test:coverage` script, set per-directory thresholds.

**Effort:** 3–5 days if prioritized. The ROI is "I can refactor UI without fear." You're about to refactor a lot of UI. Do 1 and 2 at minimum before starting.

### 4.3 E2E observation

`full-workflow.spec.ts` is now hardened (assertions real, not `.catch`-hedged). Good. But it still covers *one* happy path. Adding:

- **Routine import from paste** — user pastes YAML, imports, activates.
- **Discard-then-resume** — user starts, discards, starts again, verifies `nextDayId` hasn't advanced.
- **Edit set on finished session** — navigate to session detail, tap logged slot, edit, verify persisted.

…would triple the surface area covered at maybe 2 hours of test work. These are the flows users actually exercise; smoke tests don't.

---

## 5. PWA & Platform

### 5.1 What's shipped

- Service worker in prompt mode with `SWUpdatePrompt` toast — ✅
- Icons at 192/256/384/512 + maskable — ✅
- iOS meta tags — ✅
- `beforeinstallprompt` capture + manual Install button — ✅
- Font preloading via `@fontsource` (bundled, no external fetch) — ✅
- YAML dynamic import — ✅

### 5.2 What's still pending

1. **`file_handlers` manifest entry + `launchQueue` consumer** — still pending from prior plan.
   - Minimum viable: app registers for `.yaml` / `.yml`, `launchQueue.setConsumer` in `App.tsx` routes the file content into the existing import flow via router state or query param.
   - ~1 day of work.
   - Lower priority than last review stated — paste flow works. But adds polish for the future Android install case.
2. **`manualChunks`** for `SettingsScreen` + dialogs in Vite config. Bundle is currently acceptable but not lean. Lower priority.
3. **`visualViewport` keyboard handling.** Not observed as an issue on Pixel 7 preview, but worth validating on a real device. If the bottom nav or footer ever overlaps the numeric keypad, this is what you'd add.
4. **URL-based routine sharing** (per Appendix B.5 of the prior review). "Yes" answer noted. This is future work — a `/import?yaml=<base64-gzipped>` route that decodes and pipes into `validateParseAndImportRoutine`. 2–4 hours plus decisions about URL length and link hygiene.

### 5.3 Performance

Not measured as part of this review. But given:
- Lazy-loaded screens
- Dexie-local data (sub-ms reads)
- Single active session, small set count
- No server

Performance is not a concern. The only observable latency is:
- First paint (SW + fonts cold) — probably ~400 ms on good network, acceptable for PWA.
- IndexedDB cold open — ~50 ms.
- No large lists to virtualize; even the 9-exercise Day C renders instantly.

Don't optimize what isn't slow.

---

## 6. Prioritized Improvement Plan

Organized as three focused sprints. Each sprint is scoped to ~1 week of evenings.

### Sprint 4 — "Make the numbers pop" (visual system + Workout screen) — ✅ SHIPPED 2026-04-17 (PR #6)

**Goal:** by end of sprint, the Workout screen should feel dashboard-y and the core logging moment should feel rewarding.

| # | Task | Status | Notes |
|---|---|---|---|
| S4.1 | Introduce `<Stat>`, `<Pill>`, `<SectionHeader>`, `<EmptyState>` components | ✅ | All four created + unit-tested. `Pill` adopted in `DaySelector`, `EmptyState` adopted in `WorkoutScreen`. `Stat` and `SectionHeader` created-but-unadopted (carry-forward to S5). |
| S4.2 | Typography scale upgrade — apply new scale to `ExerciseCard`, `SetSlot`, `SetLogSheet` | ✅ | `.text-hero` / `.text-value` / `.text-value-sm` / `.text-eyebrow` utilities landed in `App.css`. All three consumers upgraded. |
| S4.3 | `ExerciseCard` redesign — left-stripe per block, combined Last+Suggestion line, larger set-slot row | ✅ | Extracted `BlockStripe` primitive. Urbanist `h3` heading. Set slots bumped to 56×80 min. |
| S4.4 | Workout progress meter (sticky header addition) | ✅ | `SessionProgress` component with N/M sets + minute tick + horizontal bar. Mounted inside sticky header. |
| S4.5 | `SetLogSheet` redesign — tile inputs, inline context, visual set dots | ✅ | `SetDots` header, inline Last/Suggested context block, `h-14` tile inputs. Prefill cascade preserved. |
| S4.6 | "Set logged" micro-interaction — ring pulse + scale-bounce | ✅ | `flash-logged` keyframe upgraded to 4-stop ring-pulse + scale-bounce in OKLCH. Numeric count-up deferred to later sprint. |
| S4.7 | `SetLogSheet` save animation | ✅ | `save-pulse` keyframe + `savePulse` state on the Save button. |
| S4.8 | Component tests: `SetLogSheet` + `WorkoutScreen` | ⚠️ | `SetLogSheet` got 4 new tests (SetDots header, Last-time context, suggestion inline, tile inputs). `WorkoutScreen.test.tsx` still not created — carry-forward to S5. |
| **Actual** | 503/503 tests pass, lint/typecheck/build clean | ✅ | 14 commits on `sprint4-workout-shine`, merged as `b606d98`. |

### Sprint 5 — "Open doors wide" (entry points + empty states + color) — refined 2026-04-17 evening

**Goal:** make the first-run and between-session experience feel like a product that wants you back. Sprint 4 landed the visual primitives (`Stat`, `Pill`, `SectionHeader`, `EmptyState`, `BlockStripe`, `SessionProgress`, `SetDots`); Sprint 5 pays down the "created but unadopted" debt, adds the second accent color, and rebuilds `TodayScreen` so the entry point matches the Workout screen's new bar.

**Ordering rationale:** adoption tasks (S5.1–S5.3) ship first because they're small, low-risk, and make the rest of the sprint easier (`TodayScreen` will consume these primitives). Color + `TodayScreen` (S5.4–S5.6) are the headline changes. Nav/motion polish (S5.7–S5.8) is quick win. Tests and the SetLogSheet refactor close the sprint.

| # | Task | Est. | Area |
|---|---|---|---|
| S5.1 | **Adopt `<EmptyState>` at the remaining three callsites** — `TodayScreen` "No Active Routine", `HistoryScreen` "No sessions yet", `ExerciseHistoryScreen` empty. Use `CalendarCheck`, `History`, `Dumbbell` icons. | 1.5 h | features/{today,history} |
| S5.2 | **Adopt `<SectionHeader>` at the 5 existing duplicated callsites** — `RoutineImporter`, `ExerciseHistoryScreen`, `DaySelector`, `WorkoutScreen`, `SupersetGroup`. Kill ~40 LOC of duplicated class strings. | 1 h | multiple |
| S5.3 | **Adopt `<Stat>` in `SessionProgress` (hero N/M), `DayPreview` (set count), `LastSessionCard` (duration + date)** — enforces the numbers-first pattern and gives Stat its first real consumers. | 2 h | features/{workout,today} |
| S5.4 | **Second accent color (warm)** — add `--accent-warm` + `--accent-warm-soft` tokens, document semantic roles (PR, streak, completion). Paired with cool CTA purple. | 1 h | app/App.css |
| S5.5 | **Apply warm accent** — streak ribbon on Today hero, future PR badge placement in `SessionDetailScreen`, workout-finish toast tint. Do not use on destructive/semantic success. | 1.5 h | multiple |
| S5.6 | **`TodayScreen` hero redesign** — "Today: Day B — Pull" hero card with in-card CTA, first 2 exercise names, estimated duration; day selector demoted below. Use primitives from S5.1–S5.3. Rough ASCII in §2.2.1 of this review. | 4 h | features/today |
| S5.7 | **`LastSessionCard` + streak signal** — inline date/duration, optional "3-day streak" ribbon using warm accent. Streak detection: count consecutive calendar days with ≥1 finished session in the last 14 days. | 1.5 h | features/today + services/progression-service |
| S5.8 | **Bottom nav polish** — pill-filled active state (use `Pill` or a dedicated nav variant), icon weight swap on active tab, 120 ms press scale feedback. | 1 h | app/App.tsx |
| S5.9 | **Day switch + tab nav fade** — 80 ms fade-out / 120 ms fade-in on day change in `DayPreview`; same on route change. Use CSS transitions keyed on a route/dayId ref. | 1.5 h | features/today, app/App.tsx |
| S5.10 | **`SetLogSheet` open-edge prefill refactor** (carry-forward from Sprint 4 risk watch-list) — replace the 14-dep effect with `useRef<boolean>` edge detection on `open`. Closes a known clobber bug. ~15 LOC. | 1 h | features/workout |
| S5.11 | **`TodayScreen.test.tsx` component tests** — state A (no routines) / B (normal) / C (active session) transitions, day selector integration, start-session happy path. | 3.5 h | tests |
| S5.12 | **`WorkoutScreen.test.tsx` smoke** (carry-forward from S4.8) — integration test with `fake-indexeddb`: start → log set → edit → delete → add extra → finish. One big smoke. | 3 h | tests |
| **Total** | | **~22.5 h** | |

**What changed vs the morning proposal:**
- Added S5.1–S5.3 (adoption of shipped primitives) — wasn't needed morning-of because the primitives hadn't shipped yet.
- Added S5.10 — carries forward the `SetLogSheet` prefill edge-detection refactor from §3.1 and §7 as an explicit sprint item.
- Added S5.12 — carries forward the `WorkoutScreen.test.tsx` smoke from S4.8.
- Merged the original S5.7 + S5.8 (day switch / tab fade) into one item (S5.9) since they share an implementation pattern.
- Kept all design direction from the morning's S5.3–S5.6; renumbered for clarity.

**Out of scope for Sprint 5 (→ Sprint 6):**
- Workout-complete screen (top-10 item #4). Needs S5's streak/PR infra first.
- `SessionDetail` / `ExerciseHistory` chart work (top-10 items #10 + §2.2.6).
- PR detection (S6 of the original plan).

### Sprint 6 — "Close the loop" (History, Session Detail, Celebration)

**Goal:** give the user a reason to look back at what they've done.

| # | Task | Est. | Area |
|---|---|---|---|
| S6.1 | `SessionDetailScreen` summary header — volume, duration, sets, top set | 3 h | features/history |
| S6.2 | `HistoryScreen` grouping by time window + summary stat at top | 2 h | features/history |
| S6.3 | `ExerciseHistoryScreen` inline bar chart for top-set weight | 4 h | features/history |
| S6.4 | Workout-complete screen — after `finishSession`, show summary + animation before navigating | 6 h | features/workout |
| S6.5 | PR detection on finish — compare top set to all prior top sets for that exerciseId + blockSignature, tag session as having a PR | 3 h | services/progression-service |
| S6.6 | Streak detection on Today screen — count consecutive days where a finished session exists within some window (spec TBD) | 2 h | features/today |
| S6.7 | `SettingsScreen` + `SessionDetailScreen` tests | 4 h | tests |
| **Total** | | **~24 h** | |

### Sprint 7+ — Backlog (not this cycle)

- URL-based routine sharing (`/import?yaml=...`)
- `file_handlers` + `launchQueue` for Android file handoff
- Bundle `manualChunks` for Settings + dialogs
- `visualViewport` keyboard handler
- `noUncheckedIndexedAccess` TS flag + fallout
- `useRoutine` three-state simplification
- CSV RFC 4180 parser (or swap to `papaparse`)
- ADRs + `CONTRIBUTING.md`
- Charts library evaluation (if ExerciseHistory chart goes beyond SVG)

---

## 7. Risk & Watch List

Not blocking, but worth keeping in the back of your mind while you work:

- **`SetLogSheet` prefill clobbering bug** (section 3.1 #1) — if a user types while the sheet is open and another render triggers, typed input could be overwritten. Has not been reported but is real. Ship an open-edge fix before promoting the app to more users.
- **Second tab / second device use case** — the app is single-user but the user might have two tabs open. Transaction guards handle the data integrity side; `useLiveQuery` keeps UI fresh. But the *mental model* gets weird if a user starts a workout on their phone and sees "No Active Workout" on desktop. Probably acceptable but worth noting.
- **`routine-service.ts` at 879 LOC** is the largest single service file. Validator logic could be split into `validation.ts` + `normalization.ts` if it grows further. Not urgent.
- **Dependency on a single ChatGPT custom GPT** as the primary routine-authoring pipeline. If OpenAI ever drops the custom-GPT feature or changes the interface, the whole flow is stuck. Long-term, consider offering a minimal web form for routine creation inside the app as a fallback. Not this cycle.

---

## Appendix A — Creative directions worth prototyping

These are speculative, not on the critical path, but would define the product if they landed:

1. **"Warm-up recommendation" on start** — once the routine day is selected, suggest 2 warm-up sets at progressively lighter weights based on the top target. Auto-logged as warm-ups, don't count toward progression.
2. **Session tempo** — the app already captures `loggedAt` timestamps per set. You could infer "rest period" (time between sets) and show a running average. No rest-timer needed (you dropped that for good reason), but a passive "Avg rest 2:15" stat gives users insight into their pace without asking them to do anything.
3. **Per-exercise "vibe" indicator** — a tiny 3-step mood selector after the last set of an exercise ("Smooth / Tough / Rough"). Stored as session metadata. Over time you can surface "You've had 3 tough sessions in a row on Deadlift — deload?" No metrics, no science, just user self-reporting. Low-cost, high-retention signal.
4. **Subtle typography "shadow"** — a barely-visible second copy of the hero number, offset 2 px, at 6% opacity. Classic editorial move; makes numbers feel like headlines.
5. **"Ready to start" animation on Today hero card** — a slow-breathing (2.5 s) subtle pulse on the "Start Workout" CTA after the screen has been idle for 3 seconds. Invites the tap without being annoying. Kill it when the user interacts.
6. **End-of-week email-style summary** (in-app, not email). Sunday-evening card on the Today screen: "This week: 3 sessions, 2 new PRs, 18,450 kg total volume." Drives re-engagement. Requires nothing new data-wise.
7. **Design-direction wild card: magazine-style workout header.** Instead of a plain sticky header, go full editorial on the Workout screen: massive display-size day name (60–80 px type), routine name underneath, numbers in a serif or condensed heading face. Controversial but memorable.

None of these are urgent. They're the kind of ideas you should prototype once the base is solid, pick one or two, and ship them as "the feature" that makes the v2.1 announcement (if you ever do one).

---

## Appendix B — References verified during this review

- `web/src/app/App.tsx` — shell, routes, nav, Toaster, SWUpdatePrompt ✓
- `web/src/app/App.css` — tokens, fonts, motion vars, flash-logged keyframe ✓
- `web/src/app/SWUpdatePrompt.tsx` — prompt-mode handler ✓
- `web/src/features/**/*.tsx` — all 16 feature files read
- `web/src/shared/ui/*.tsx` — 12 primitives (button, card, sheet, dialog, input, etc.) ✓
- `web/src/shared/components/ConfirmDialog.tsx` ✓
- `web/src/shared/hooks/*.ts` — all 12 hooks ✓
- `web/src/services/set-service.ts`, `session-service.ts`, `progression-service.ts`, `routine-service.ts`, `backup-service.ts`, `settings-service.ts`, `catalog-service.ts` ✓
- `web/src/db/database.ts` + layer CLAUDE.md ✓
- `web/src/domain/types.ts` + layer CLAUDE.md ✓
- `web/vite.config.ts`, `web/index.html`, `web/package.json` ✓
- `web/tests/e2e/full-workflow.spec.ts`, `smoke.spec.ts` (partial) ✓
- `docs/design-spec.md`, `docs/ui-rewrite-spec.md` ✓
- `docs/archive/reviews/codebase-review-2026-04-16.md` ✓

Spot-checked claims from the prior review against current code:
- `logSet` transaction wrap (R1) — **shipped** at `set-service.ts:106–219`. Verified.
- `editSet` finished-session guard (R2) — **shipped**. Verified in `set-service.ts:237+`.
- `finishSession` rotation guard (R4) — **shipped**. Git log confirms.
- Icons 192/256/384/512 — **shipped**. Present in `vite.config.ts` manifest.
- iOS meta tags — **shipped**. Verified in `index.html`.
- SW prompt mode — **shipped**. Verified `vite.config.ts:30`.
- Paste-YAML import — **shipped**. Verified in `RoutineImporter.tsx`.
- `getBlockLabel` exported — **still exported**. Used by `ExerciseCard.tsx` and `SetLogSheet.tsx`. Good.

---

*End of review. Ready when you are to pick a sprint and start pushing.*

*Addendum 2026-04-17 evening: Sprint 4 shipped as PR #6 (merged `b606d98`). Sprint 5 proposal refined above in §6. The visual primitives are in place; the next sprint adopts them and rebuilds the entry point.*

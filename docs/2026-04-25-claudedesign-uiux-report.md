# Exercise Logger — UX Analysis & 5-Sprint Roadmap

> **Purpose:** Team discussion doc. Companion to `UX Analysis & Roadmap.html`.
> **Author:** Design (acting PM)
> **Date:** Apr 25, 2026
> **Cadence assumed:** 2-week sprints, ~Q2

---

## 0. TL;DR

The product is good. The seams are showing.

The core loop — open app, see today's day, log sets, finish — is genuinely tight. Warm paper + Instrument Serif + sage gives the thing a personality almost no other gym app has, and the local-first architecture is the right wager for a single-user tool.

The trouble is concentrated in three places:

1. **State during a workout.** No rest timing, no superset rhythm. The most-used screen is the least supported.
2. **History that won't render its own data.** Cardio, bodyweight, isometric sets show as `—` even though the values are stored.
3. **Trust-edge bugs.** Backup import and progression fallback can quietly corrupt the experience over time.

| Dimension       | Score | Note |
|---|---:|---|
| Daily-use loop  | 7/10  | Logging is fast. Active-workout screen is missing rhythm tools. |
| Data fidelity   | 5/10  | Cardio + bodyweight + isometric sets render as a dash in History. |
| Visual system   | 8/10  | Tokens clean, type pairing earns its keep, motion restrained. Don't touch — extend. |

**Posture:** Hardening before features. Two sprints to fix what's broken, one to deepen the workout screen, then explore.

**North star:** A user mid-workout, one-handed, sweaty, between sets. Every decision asked against this user.

**Guardrails:** Local-first. No accounts. No charts-as-dashboards. No dark mode (yet). Warm paper stays.

---

## 1. The five problems I'd fix first

Ranked by user pain, not by effort. Each is grounded in either the live prototype, the design handoff, or the codebase audit dated Apr 23, 2026.

### Problem 01 — No rest timer, no superset rhythm `P0 · Daily friction`

**Surface:** Workout · Active

The handoff explicitly removes the timer ("we don't read `restSecSnapshot`"), and the workout screen treats supersets as one stacked card. In practice, a lifter's tempo *is* the rest interval — without it, the app is a passive ledger, not a coaching surface. Supersets in particular need an alternating-set affordance: row A1 → B1 → A2 → B2, not "A and B as a unit."

- **Affects:** every workout
- **Severity:** kills retention
- **Effort:** medium

**Evidence**
- `design-handoff.md §4 — "What's intentionally not here"`: "No timer UI. `restSecSnapshot` fields still exist in the data model but nothing reads them."
- `design-handoff.md §8 — open question 1`: superset card "treats a superset as one card with two stacked exercise sub-rows."

---

### Problem 02 — Bodyweight, cardio, isometric sets render as `—` `P0 · Data invisible`

**Surface:** History · Session detail

The Apr 23 audit (P1 finding 3) is unambiguous: `SessionDetailExerciseCard.formatPillContent` returns a dash unless both `performedWeightKg` *and* `performedReps` are present. Cardio (duration + distance), bodyweight (reps only), isometric (duration only) all silently disappear from history while still appearing on the active-workout row. Users who do anything other than barbell work will think the app dropped their data.

- **Affects:** any non-barbell user
- **Severity:** trust-killing
- **Effort:** small

**Evidence**
- `repo-full-scope-analysis-2026-04-23.md · P1 finding 3`
- `web/src/features/history/SessionDetailExerciseCard.tsx:14` returns `-` unless both performed values present
- Fix path: extract a shared formatter; `SetRow` and `ExerciseHistoryScreen` already handle more value types

---

### Problem 03 — Backup import is the soft underbelly `P1 · Trust edge`

**Surface:** Settings · Data

JSON backup restore validates less strictly than YAML routine import — the audit lists eight specific cases where a malformed backup will write data the live services would reject. Because import is a full overwrite and we have no server-side undo, a single bad backup permanently corrupts a user's history. Not a daily-use bug, but it's the worst kind of bug we have: silent and irreversible.

- **Affects:** anyone restoring
- **Severity:** data-loss class
- **Effort:** medium-large

**Evidence**
- `backup-service.ts:217` — structural-only validation on set blocks
- `backup-service.ts:765` — only `id`, `activeRoutineId`, `units` validated on settings
- `backup-service.ts:1027` — onboarding fields persisted via `?? null` without type checks

---

### Problem 04 — Empty states are honest, but they don't teach `P1 · Onboarding`

**Surface:** Today · First-run + empty states

The Workout-empty screen says "No active workout" with a "Go to Today" button. That's correct. It's also a missed teaching moment for a single-user app where the user's mental model has to come from the UI itself — there's no marketing site, no tutorial. Same on first-run Today: if your routine isn't loaded yet, you bounce to Settings → Import YAML, which is a real cliff for anyone who didn't read the GitHub README.

- **Affects:** new users only
- **Severity:** activation cliff
- **Effort:** small

**Evidence**
- `Exercise Logger.html · EmptyWorkout L478–497` — single CTA "Go to Today"
- `features/onboarding` exists in code but isn't reachable from the prototype shell

---

### Problem 05 — History is a log. After 30 sessions it's a wall. `P2 · Scale`

**Surface:** History · Browse

The handoff is explicit: "history is a log, not a dashboard," and I agree with the principle. But the prototype shows three sessions; at **47 sessions / 1,284 sets** (the demo data on the History stats tile) you need at minimum: filter by day-letter (A/B/C), search by exercise name, and a drill-in to "this exercise across time." The exercise-history route already exists in the codebase but is described in the audit as orphaned. Wire it up; don't replace the log model.

- **Affects:** users past month 2
- **Severity:** usability tax
- **Effort:** small-medium

**Evidence**
- `Exercise Logger.html · HistoryScreen` shows 47/1,284/38 in stats tile
- `repo-full-scope-analysis-2026-04-23.md · P2`: orphan exercise-history route already implemented; not linked from session detail

---

## 2. Roadmap — first ten weeks

Sprint 1 is non-negotiable hardening — anything that ships on top of broken history rendering or a leaky import inherits the bug. Sprint 2 deepens the screen people actually use. Sprints 3–5 expand surface area in priority order.

### Sprint 01 — Hardening: stop bleeding trust
**Window:** Apr 27 → May 8
**One-liner:** *The data we have should render. The data we accept should be valid.*

| | |
|---|---|
| **Goal** | Zero `—` placeholders on screens that have data. Backup import as strict as live services. |
| **Ships** | • Shared logged-set formatter (weight+reps, reps-only, duration, distance, hybrid)<br>• Backup-schema runtime validator (one source, used by JSON + YAML paths)<br>• Vitest timeout fix to unflake CI |
| **Design surface** | Set-pill component spec covering all five value-types. Error-toast pattern for rejected backups. |
| **Risks** | Migration: pre-existing rounded weight values stay rounded. Document on the data screen. |
| **DoD** | Cardio + bodyweight session renders correctly end-to-end. Adversarial backup tests in CI. |

---

### Sprint 02 — Workout screen, properly
**Window:** May 11 → May 22
**One-liner:** *Make the screen we stare at the most actually help us train.*

| | |
|---|---|
| **Goal** | Rest timing + working superset rhythm without breaking the calm aesthetic. |
| **Ships** | • Inline rest counter — reads `restSecSnapshot`, lives below the just-logged set<br>• Superset cards: alternating affordance, A1 → B1 → A2 → B2 ordering<br>• Auto-detect PR (default; manual still available) |
| **Design surface** | Two timer treatments to A/B: ambient (passive ring) vs assertive (sage-soft fill that pulses at target). Tweak. |
| **Risks** | PWA notifications + haptics are uneven across browsers. Ship visual-only first; sound/haptic behind a Setting in S5. |
| **DoD** | User can complete a superset workout without leaving the app to start a phone timer. |

**Sketch — workout row, before/after:**

```
BEFORE                              AFTER
────────────────────────            ────────────────────────
✓ 70kg × 14   TOP                   ✓ 70kg × 14   TOP
✓ 85kg × 10   ↑ PR                  ✓ 85kg × 10   ↑ PR (auto)
③ Tap to log · last 85×9            ⏱ 0:42 / 1:30 ──────────
④ Tap to log · last 85×8            ③ Tap to log · last 85×9
                                     ④ Tap to log · last 85×8
```

---

### Sprint 03 — First-run that earns its place
**Window:** May 25 → Jun 5
**One-liner:** *From install to first logged set in under 60 seconds, with no docs.*

| | |
|---|---|
| **Goal** | A new user lands on Today with a real, reasonable routine without ever opening Settings. |
| **Ships** | • Three preset routines (3-day full body / 4-day upper-lower / 5-day PPL)<br>• 2-question questionnaire: how often, what equipment<br>• "Use this for now, change later" exit on every step |
| **Design surface** | Wire the existing `features/onboarding` module into the shell. Don't rebuild — it's already there. |
| **Risks** | Presets need real lifter review before shipping. Budget two days for that. |
| **DoD** | Cold-install → first logged set, measured. Target: P50 under 60s. |

---

### Sprint 04 — History at scale
**Window:** Jun 8 → Jun 19
**One-liner:** *Make the log searchable without making it a dashboard.*

| | |
|---|---|
| **Goal** | Find any past session in <3 taps. See an exercise's arc over time without leaving the log model. |
| **Ships** | • Filter chips at top of History: `All · A · B · C`<br>• Search field (exercise name, lazy-revealed under stats tile)<br>• Wire orphan exercise-history route from session-detail set pills |
| **Design surface** | Exercise-history screen: spark-line of top-set weight × reps. *One* chart, not a dashboard. |
| **Risks** | "One chart" creep — explicitly defer per-muscle volume, frequency heatmaps, etc., to v2. |
| **DoD** | Tap any set pill in session detail → see that exercise's last 12 sessions on one screen. |

---

### Sprint 05 — Resilience & quiet polish
**Window:** Jun 22 → Jul 3
**One-liner:** *Pay down the small stuff while we have the focus.*

| | |
|---|---|
| **Goal** | Buy ourselves a clean foundation before the next feature push. No single user-feature; lots of small wins. |
| **Ships** | • Progression fallback fix (block-signature grouping — audit P1 #2)<br>• Cardio-extra distance-only validation (audit P2)<br>• Self-host Inter + Instrument Serif for true offline-first<br>• Haptics + optional sound for rest-timer completion<br>• Edit-from-history (one-tap correction of a past set) |
| **Design surface** | Edit-past-set sheet: same `SetLogSheet` visual language, with a "logged Apr 17" eyebrow so the user knows they're editing history, not present. |
| **Risks** | Edit-from-history is the only thing here that touches an invariant ("immutable log"). Worth a spec doc, not just a ticket. |
| **DoD** | Zero P1/P2 items from the Apr 23 audit remain open. App works fully offline. |

---

## 3. What I won't ship in Q2 (and why)

A roadmap is also a list of things you've decided not to do.

| Status | Item | Reason |
|---|---|---|
| Deferred | Dark mode | Warm paper is the brand. Auto-flip lands at "generic system UI" and fights the serif. If we want a low-light mode it should be a separately-designed palette, not a token swap. Revisit Q3. |
| Declined | Social / sharing | Local-first means local-only. The premise — your data lives on your device — is the differentiator. Sharing is a different product. |
| Declined | AI coaching overlay | Auto-PR detection is enough automation for now. "AI suggests your next workout" betrays the local-first contract (needs server inference) and the disciplined-team aesthetic. |
| Declined | Gamification (badges, streaks v2) | "3 sessions this week" is the right amount. More badges punish honesty about rest weeks. Lifters who want streaks will see streaks; we don't need to wave them. |
| Deferred | Charts & analytics dashboard | One spark-line per exercise (Sprint 4) is the cap. Volume-by-muscle-by-week, frequency heatmaps, fatigue scoring — all real asks, all out of scope until we hear them from at least three users unprompted. |
| Deferred | Apple Watch / wearable | Lovely. Massive scope. PWA-on-wrist isn't a thing yet, and a native companion blows up the "no servers, no accounts" story. Q4 conversation, earliest. |

---

## 4. Open questions for the team

These are things I'd want to settle in the kickoff for Sprint 1.

1. **Timer assertiveness.** Visual-only is the safe default. Do we have a strong opinion on sound/haptics out of the gate, or are we comfortable shipping silent and following up in S5?
2. **Edit-from-history vs. immutable log.** The current invariant is "Finished sessions are immutable." Sprint 5 proposes one-tap correction. Two options: (a) add an audit field (`editedAt`) and embrace it, or (b) keep the invariant and only allow same-day correction. I lean (a). Worth a spec.
3. **Auto-PR definition.** "Best set at this rep range across last N sessions" — what's N? Lifetime is generous and slow; last 8 weeks is opinionated. Pick one.
4. **Streak math.** Hardcoded Mon-start week today. If we ship a weekly-cadence routine, this needs to be relative to the user's routine cycle. Decide before Sprint 3, since onboarding will surface the streak immediately.
5. **First-run presets.** Who reviews them? I want at least one experienced lifter on the team to sign off, and I want to write the YAML for at least one of the three myself so we feel the import path.

---

## 5. References

- `Design Handoff.md` — design system + interaction inventory for the prototype
- `Exercise Logger.html` — shipping prototype
- `docs/repo-full-scope-analysis-2026-04-23.md` — full codebase audit (lint, typecheck, build, E2E all pass; P1 findings catalogued)
- `docs/design-spec.md` — original product spec + drift log
- `web/src/features/onboarding/` — onboarding module already implemented, not yet wired

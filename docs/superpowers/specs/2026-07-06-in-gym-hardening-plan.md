# In-Gym Hardening Plan — Guided Logging + Gym-Proofing

**Date:** 2026-07-06
**Method:** Simulated Day-A workout at 375×812 (fresh onboard → seed session → instrumented full session → history drill-down), code-path audit of the suggestion pipeline, tap-target/thumb-zone measurement via bounding rects, platform feasibility review.
**Evidence caveat:** the preview harness could not capture screenshots (renderer capture hung; CSS transitions frozen). Every visual claim below is instead backed by measured geometry (`getBoundingClientRect`), computed styles, `elementFromPoint` probes, or IndexedDB ground truth — noted per row as *(measured)*. All tap counts are exact, recorded per interaction.

---

## 1. TL;DR

- Today a set that matches the plan costs **2 taps** (row → Save) — but only after the first set of each exercise. The **first set of every exercise costs 11–14 touches** because the sheet pre-fills the *previous* exercise's numbers (race bug, W1). Median taps/set = 2, mean = 5.9, p90 = 12.
- Full measured session (20 prescribed + 1 extra set + 1 cardio extra, incl. 1 edit + 4 timer ops): **~152 touches**. Projected after guided logging: **~58 touches**, common-case set = **1 tap**.
- Worst three frictions: **(1)** sheet prefill races history load → wrong values offered, and on cardio extras silently **saves hidden weight/reps from the previous exercise** (confirmed in IndexedDB); **(2)** the progression target is computed but invisible until the sheet is open — the card shows only LAST; **(3)** rest-timer controls are 46×28 px at y≈123 (top zone) and rest-complete has no haptic/audio cue and no scheduled callback at all.
- Wake lock + haptics: **GO.** Screen Wake Lock is reliable on Android Chrome (re-acquire on `visibilitychange`); vibration works whenever the page is visible, which wake lock guarantees for the on-bench case. Audio: ship default-off, gesture-primed. Screen-off/in-pocket cues are **out of scope** for a local-first PWA (no server push) — state this openly.
- Found in passing, must fix: ExercisePicker sheet height rule `h-[85dvh]` is dead CSS (loses specificity to `data-[side=bottom]:h-auto`) → the sheet renders content-height (5741 px) with its header/search stranded ~4900 px above the viewport.

---

## 2. Walkthrough friction inventory

Sessions: **S1** = day-one seed (no history), **S2** = instrumented session with history + suggestions armed. Zones: top < 271 px, middle 271–541, bottom > 541 (of 812). Ordered by frequency × cost.

| # | User intention | Taps (exact) | Screen travel | Visible at decision moment | Missing at decision moment | Evidence |
|---|---|---|---|---|---|---|
| W1 | Log the **first set of an exercise** at today's target | **11–14** (row + clear both fields 2–4 backspaces each + retype + Save). First exercise of session: 6–7 (fields prefill `0`/min instead) | row mid → keypad bottom | Sheet: "Last time · 40kg × 12", "Suggested · 45kg ↑" *(correct)*; keypad fields: **previous exercise's values** (measured: Leg Curl prefilled 62.5×16 from Squat; Adductor prefilled 45×12 from Leg Curl; superset B prefilled A's 24×12) | An honest prefill. Root cause: prefill runs once on the open edge ([SetLogSheet.tsx:119-183](../../web/src/features/workout/SetLogSheet.tsx)) while `useExerciseHistory` still returns the previous exercise's live-query result ([useExerciseHistory.ts:35-43](../../web/src/shared/hooks/useExerciseHistory.ts)); sheet not keyed by exercise ([WorkoutScreen.tsx:374-387](../../web/src/features/workout/WorkoutScreen.tsx)) | *(measured, 3 exercises + superset partner; second open of same exercise prefills correctly — 62.5×16)* |
| W1b | Same race, **cardio extra** | 10 visible touches — but corrupt save | — | Duration/Distance inputs only | Weight/reps fields are hidden yet their **stale state saves**: rowing-machine set stored `{w:20, r:12, dur:1200, dist:5000}`; renders as "20kg × 12" in workout row and history, hiding the real 20min/5000m | IndexedDB dump *(measured)*; `parseCurrentInput` reads all four fields regardless of visibility ([SetLogSheet.tsx:221-231](../../web/src/features/workout/SetLogSheet.tsx)); only luck keeps it out of PR baselines ([personal-records.ts:60](../../web/src/domain/personal-records.ts)) |
| W2 | Log a set **exactly as planned** (carryover working) | **2** (row + Save) | row mid/bottom → Save bottom (y=780) | Row: "Tap to log · last 50×12"; sheet: prefilled weight+reps, Last time, Suggested | Nothing — this is the good path; it's just gated behind opening a sheet | *(measured ×11 in S2)* |
| W3 | Know **what to lift next** while resting | 1 tap + 1 close (must open sheet to see target) | mid → sheet → back | Card: exercise name, `1 × 12–16 top · 3 × 8–12`, "last 60×16" hint, LAST strip | **The target itself.** Engine computes `BlockSuggestion {suggestedWeightKg, isProgression, previousWeightKg}` per block ([progression-service.ts:47-56](../../web/src/services/progression-service.ts), consumed only at [WorkoutScreen.tsx:508-511](../../web/src/features/workout/WorkoutScreen.tsx) and [SessionDetailScreen.tsx:267](../../web/src/features/history/SessionDetailScreen.tsx)); `ExerciseCard` receives `historyData` but reads only `.lastTime` ([ExerciseCard.tsx:113-126](../../web/src/features/workout/ExerciseCard.tsx)) | grep: `.suggestions` never referenced in ExerciseCard.tsx *(code)* |
| W4 | **Honest rep count** on an otherwise-accepted set | **7** (row + reps field + back×2 + 2 digits + Save) | mid → bottom | Prefilled reps = *last time's* reps — on a progression this is the old ceiling (16), a number the user probably won't hit at the new weight; mindless Save logs fake reps | Select-on-focus/pristine-replace semantics; progression-aware rep default | *(measured ×2)*; prefill rule [SetLogSheet.tsx:175](../../web/src/features/workout/SetLogSheet.tsx) |
| W5 | **Deviate weight** from suggestion | **3** when ± step matches (52.5→50), else 6–8 via keypad | mid | ValueBox + ± nudges (34×38 px) | Nudge step is hardcoded ±2.5 ([SetLogSheet.tsx:434-435](../../web/src/features/workout/SetLogSheet.tsx)) — wrong for machines (5 kg), dumbbells (2 kg), and all lbs equipment; `getIncrement()` exists unused ([unit-conversion](../../web/src/domain/CLAUDE.md)) | *(measured)* |
| W6 | **Skip rest / +30s** | **1** each — but at y=123, **top zone**, buttons 46×28 px | bottom (just saved) → **top** | m:ss countdown, label | Reachability; any completion cue beyond a quiet text swap ([RestTimerBar.tsx:27-40](../../web/src/features/workout/RestTimerBar.tsx)); no `vibrate`/audio anywhere in `web/src` (grep: 0 hits) | *(measured ×4)* |
| W7 | **Add extra set** to a done block | **3** (control + row + Save; prefill = carryover × block min) | control 65×24 px, below block | "Extra set" text control | 44 px hit area | *(measured)*; [ExerciseCard.tsx:215-231](../../web/src/features/workout/ExerciseCard.tsx) |
| W8 | **Add cardio extra + log it** | **16 touches** (footer + search focus + 3 chars + pick + row + 2 field focuses + 6 OS-keyboard digits + Save) | bottom → picker → bottom of list → sheet | Picker list + search *(in code)* | The picker itself: `h-[85dvh]` is defeated by `data-[side=bottom]:h-auto` (specificity 0-2-0 vs 0-1-0) → sheet = content height **5741 px**, header/search ~4900 px above viewport; removing `data-side` snaps it to 690 px *(measured)*. Also `showCloseButton={false}` and no cancel control ([ExercisePicker.tsx:46](../../web/src/features/workout/ExercisePicker.tsx)). Cardio sheet uses native inputs → OS keyboard, no custom keypad ([SetLogSheet.tsx:480-508](../../web/src/features/workout/SetLogSheet.tsx)) | *(measured + computed-style proof)* |
| W9 | **Edit a logged set** | **7** (row + field + back×2 + 2 digits + Save) | any → bottom | Edit sheet prefilled from the record (no race — `existingSet` comes via props); Delete link 375×24 px | Pristine-replace typing (backspace tax) | *(measured)*; edit prefill [SetLogSheet.tsx:135-149](../../web/src/features/workout/SetLogSheet.tsx) |
| W10 | Start / finish workout | Start **1** (**2** with day override); Finish **2**, celebration auto-dismisses at 1.8 s | start mid; finish bottom → confirm mid | "TODAY · DAY A", 7 exercises · 20 sets | Day chips are 29×22 px | *(measured)*; [FinishCelebration.tsx:21](../../web/src/features/workout/FinishCelebration.tsx) |
| W11 | Review history | list **1**, session detail **2**, exercise history **3** (from bottom nav) | bottom nav → top content | Trend, All-time/This-month/Last-session bests, PR markers | Exercise-name link is a 151×20 px target; poisoned cardio row shows "20kg × 12" | *(measured)* |
| W12 | Read "what's next" from 2 m away | n/a | — | 24 px mono day label (truncated to 178 of 469 px — "heavy squat…"), 18 px exercise names | Next-set info lives in 12–14 px text (hint 14 px, LAST strip 12 px): ≈3.6–4.2 arcmin at 2 m on a 65 mm-wide display — below the ~5 arcmin legibility threshold. Only the section headers are glanceable | *(measured font sizes + truncation widths)*; truncate at [PromptHeading.tsx:33](../../web/src/shared/components/PromptHeading.tsx) |

**Session totals (S2, today's UI, as-designed prefill):** start 2 + squat 24 + leg curl 16 + adductor 16 + superset 32 + pushdown 17 + pallof 16 + timer ops 4 + cardio extra 16 + one edit 7 + finish 2 = **~152 touches**; set-intention distribution: median **2**, mean **5.9**, p90 **12**.

Other verified behaviors (all correct): rest starts only on create-path saves and only after a completed superset round (A1 → no new timer; B1 → "Rest — Superset round 1"); edits/deletes never restart timers; extra sets don't inflate the card badge (2/2) — but they **do** inflate the session header ("21 of 20 sets logged", [WorkoutScreen.tsx:252](../../web/src/features/workout/WorkoutScreen.tsx)); auto-PR fired live on the progressed top set ("PR ✓ auto") and every first progressed set will do so by construction (best-ever + monotonic progression).

---

## 3. Guided logging design (decided)

### 3.1 Principle

The progression engine already produces, per block: `suggestedWeightKg`, `isProgression`, `previousWeightKg` ([progression-service.ts:47-56](../../web/src/services/progression-service.ts)) plus per-set last-time values ([BlockLastTime](../../web/src/services/progression-service.ts)). The card already holds all of it in `historyData` — it just doesn't render it. **Guided logging = move the accept decision onto the card, and make the card's data the single source for the tap payload.** No new engine work; the fix for W1 falls out structurally (the tap carries its own numbers; the sheet stops depending on racing props).

### 3.2 Card layout per block type (terminal vocabulary)

Exactly one **primed row** per exercise card: its lowest-index empty prescribed slot. All other empty rows keep today's look and sheet behavior. Logged rows unchanged.

Weight × reps (range or exact), including top-set blocks:

```
⏺ Barbell Back Squat                          1/4   kg
  1 × 12–16 top · 3 × 8–12
  [✓] 62.5 × 12                            TOP  ↑ PR
  ❯ 52.5 kg × 8                       [LOG]      ✎        ← primed
  [3] tap to log · last 50×12
  [4] tap to log · last 50×12
```

- `❯` marks the primed row (aria-label: `"Set 2: log 52.5 kg × 8"`).
- `[LOG]` bracket-tag is the row's action verb; the whole row (302×44) is the tap target.
- `✎` is a separate ≥44×44 trailing target that opens today's sheet ("deviate").
- If `isProgression`, the value renders in the success tone with `↑` (same treatment as the sheet's Suggested line, [SetLogSheet.tsx:415-421](../../web/src/features/workout/SetLogSheet.tsx)); repeats render in the info tone.
- The `LAST …` strip is **dropped from single-block exercises** (it duplicates every row hint verbatim — measured; compare [ExerciseCard.tsx:239-243](../../web/src/features/workout/ExerciseCard.tsx) vs row hints) and kept on multi-block exercises where rows outnumber hints.

Reps-only (bodyweight): `❯ 12 reps            [LOG]  ✎`
Duration block: `❯ 45s                 [LOG]  ✎`
Distance block: `❯ 2000m               [LOG]  ✎`
Cardio/extra-origin exercises and day-one blocks: **no primed row** (see 3.4/3.5).

### 3.3 The one-tap gesture and its undo

- **Tap primed row** → `logSet(db, seId, blockIndex, setIndex, target)` through the existing `handleSave` create path in WorkoutScreen (so rest-timer rules, superset round completion, and stale-slot guards at [WorkoutScreen.tsx:181-234](../../web/src/features/workout/WorkoutScreen.tsx) are reused verbatim, not re-implemented).
- Row flips to its logged state; **sonner toast** (already a dependency): `⏺ logged 52.5 × 8 — UNDO`, 8 s. UNDO = `deleteSet(loggedSetId)` + cancel the rest timer *iff* it was started by that save (extend `ActiveRestTimer` with the originating `loggedSetId`).
- Double-tap protection: primed row disables while the save promise is in flight (same `saving` pattern as the sheet).

### 3.4 Target computation per block type (pure function, new `lib/quick-target.ts`)

Inputs: `block`, `blockIndex`, `suggestion` (per-block, invariant 8), `lastTime`, in-session `blockSets` (carryover), `effectiveType`.

| Block type | Weight | Reps / duration / distance |
|---|---|---|
| weight × reps, range | in-session carryover (latest logged weight in this block, same rule as [SetLogSheet.tsx:153-160](../../web/src/features/workout/SetLogSheet.tsx)) → else `suggestion.suggestedWeightKg` | `isProgression` → **`block.minValue`** (restart at the floor — fixes W4's fake-reps default); repeat → `lastTime.sets[setIndex].reps` → else `minValue` |
| weight × reps, exact | same | `block.exactValue` |
| reps-only (bodyweight) | none (never auto-adds weight → can never trigger weighted-bodyweight promotion) | `lastTime.sets[setIndex].reps` → else min/exact |
| duration | none | `lastTime.sets[setIndex].durationSec` → else `minValue`/`exactValue` |
| distance | none | `lastTime.sets[setIndex].distanceM` → else min/exact |
| top-set block | identical to weight × reps (it *is* a range block; label via `getBlockLabel`, [progression-service.ts:379-399](../../web/src/services/progression-service.ts)) | same |

If the computed target is incomplete (weight-eligible block with no weight source), there is **no primed row** — the slot renders as today and taps open the sheet.

`isPersonalRecord`: quick-log computes `isNewPersonalBest(target, personalBests)` ([personal-records.ts:139-170](../../web/src/domain/personal-records.ts)) before calling `logSet` — hoist `useExercisePersonalBests` from the sheet wrapper to the card wrapper. `SetLogInput.isPersonalRecord` already exists ([set-service.ts:28](../../web/src/services/set-service.ts)); no service change. Cardio shapes never auto-PR (helper rule). This keeps quick-logged PRs identical to sheet-logged ones.

### 3.5 Day one (no history)

No suggestion + no last-time → no primed row anywhere. Rows read `[1] tap to log · 8–12 reps` (show the **prescription** instead of the today-empty hint — [SetRow.tsx:94-96](../../web/src/features/workout/SetRow.tsx) gets the block target as fallback hint). Sheet prefill on day one: weight `""` (not `"0"` — [SetLogSheet.tsx:172](../../web/src/features/workout/SetLogSheet.tsx)), reps = `minValue` (unchanged). One-tap logging never invents numbers the user hasn't seen.

### 3.6 Sheet prefill rules (the deviation path, fixed)

1. **Key the sheet by exercise**: `<SetLogSheetWithHistory key={sheetExercise.id} …>` at [WorkoutScreen.tsx:375](../../web/src/features/workout/WorkoutScreen.tsx) — state can never leak across exercises (kills W1b's hidden-field poisoning).
2. **Gate prefill on loaded data**: don't run the open-edge prefill until `historyData !== undefined` for the *current* exercise id (loading state: fields render `—`, keypad disabled; in practice a single frame). The anti-clobber open-edge guard stays.
3. **Null hidden measures on save**: `parseCurrentInput` returns `null` for any measure whose field isn't rendered ([SetLogSheet.tsx:221-231](../../web/src/features/workout/SetLogSheet.tsx)) — cardio extras can never save weight/reps again.
4. Prefill priority per measure unchanged (edit > carryover > suggestion > last > empty), with one change: **progression → reps prefill = `block.minValue`** (match 3.4).
5. Keypad becomes **pristine-replace**: first digit after a field gains focus (or after prefill) replaces the whole value; backspace/nudge switch to append mode (reducer flag in [keypad-reducer.ts](../../web/src/features/workout/lib/keypad-reducer.ts)). W4 drops 7 → 5 touches, W1-class retyping drops ~14 → ~8 even before the race fix.
6. Weight ± nudges use `getIncrement(effectiveEquipment, units)` (W5).

### 3.7 Invariant boundaries

- **#7 (extras never get suggestions):** primed rows exist only for `origin === "routine"` cards. Structural: targets derive from `historyData.suggestions`, and `getExerciseHistoryData` returns `{lastTime: [], suggestions: []}` for extras ([progression-service.ts:424-427](../../web/src/services/progression-service.ts)). Extra-origin cards keep plain rows; their sheet keeps only the `extraHistory` display hint.
- **#8 (per set block):** target lookup is `suggestions.find(s => s.blockIndex === bi)` — a top block's +5% can never leak into its back-off block; each primed row resolves against its own block only.
- **#9 (upsert by [seId, blockIndex, setIndex]):** quick-log calls the same `logSet` with the primed slot's indices. If the slot got logged elsewhere between render and tap, `logSet` upserts and the existing stale-slot guard suppresses a duplicate rest timer.

### 3.8 Edge cases

- **Mid-block weight change:** user quick-logs set 1 (52.5), deviates set 2 via sheet to 50 → set 3's primed target = 50 (carryover outranks suggestion, same as the sheet today). The primed row always shows what the tap will log — no hidden divergence.
- **Extra sets on a completed block:** the `Extra set` control and its rows are never primed (no prescribed target; extras are deviations by definition). Sheet opens with carryover weight + `minValue` reps, as measured today (25×8). Card badge and totals logic untouched ([ExerciseCard.tsx:60-111](../../web/src/features/workout/ExerciseCard.tsx)).
- **Superset partners:** both A and B cards show primed rows; the rail ([SupersetRoundRail](../../web/src/features/workout/SupersetRoundRail.tsx)) still indicates whose turn it is. Quick-logging B's slot routes through `handleSave` → `isRoundComplete` → superset rest starts exactly as measured. Partner-first-open poisoning disappears with 3.6(1).
- **Unit override:** primed value renders via `toDisplayWeight(kg, effectiveUnits)`; the stored target stays canonical kg.
- **Same-slot re-tap:** a logged row is never primed; tapping it edits via sheet (unchanged).

### 3.9 Test impact (flagged)

Empty-row semantics change for exactly one row per card: aria-label goes from `"Set 2: empty, tap to log, last 50×12"` to `"Set 2: log 52.5 kg × 8"`, and its tap now writes data. Unit tests asserting the empty-row label/behavior on that first slot, and any Playwright flow that taps the first empty row expecting a sheet, must switch to the `✎` affordance or later rows. All other row labels, `⏺` glyph semantics (aria-hidden), and sheet ARIA stay stable.

---

## 4. Gym-proofing design (decided)

### 4.1 Wake lock lifecycle

New `useWakeLock(enabled: boolean)` in `shared/hooks/`:

- **Acquire** when: `/workout` mounted ∧ active session exists ∧ `settings.keepScreenOn` (new field, default `true`). `navigator.wakeLock.request('screen')` — no user-gesture requirement when the document is visible.
- **Release** when: route unmounts, session finishes or is discarded, or the setting turns off. (Finish → celebration → navigate happens in <2 s; releasing on unmount is sufficient.)
- **Re-acquire** on `document.visibilitychange → visible` while conditions hold (the UA force-releases on hide — this is the API contract, not an error), and on the lock's `release` event if conditions still hold (covers battery-saver revocations that later clear).
- **Failure** (`NotAllowedError`: battery saver, unsupported): silent no-op. No status pixel, no toast — terminal-quiet. `navigator.wakeLock` guard makes it a no-op on unsupported browsers.
- Not persisted, no DB interaction, no invariant contact. New module + mocked-navigator unit tests only; zero existing-test churn.

### 4.2 Rest-complete cue matrix

Two new settings: `restCueHaptic` (default **on**), `restCueSound` (default **off**). Today's timer has *no completion callback at all* — done-ness is derived at render from the 1 s tick ([WorkoutScreen.tsx:95-97](../../web/src/features/workout/WorkoutScreen.tsx)). Add a real `setTimeout` scheduled in `handleSave` when a timer starts; `+30s` reschedules; Skip/Dismiss/unmount cancels. Cue fires only if `document.visibilityState === 'visible'`.

| Timer completes while… | Visual | Haptic (on) | Haptic (off) | Sound (on) | Sound (off) |
|---|---|---|---|---|---|
| App visible (wake-locked normal case) | existing done bar, `aria-live="polite"` ([RestTimerBar.tsx:31](../../web/src/features/workout/RestTimerBar.tsx)) + one accent pulse on the bar | `navigator.vibrate([200,100,200])` | — | ~200 ms square-wave beep via pre-primed `AudioContext` | — |
| App hidden / screen off | done bar is already correct on return (state derives from `startedAtMs`) | suppressed (platform ignores hidden-page vibrate) — accepted | — | not attempted | — |
| Skipped / dismissed | bar clears | never | — | never | — |

- Vibration needs sticky user activation — trivially present mid-workout (every save is a tap). Fire-and-forget; `'vibrate' in navigator` guard.
- Audio autoplay policy: create + `resume()` the `AudioContext` inside the first Save tap of the session (a user gesture), keep it; the later timer callback may then start a sound. Default **off** — gyms don't need another beeping phone.
- **Explicit non-goal:** cueing with the screen off / phone in pocket. Reliable delivery would need scheduled notifications or push — either unsupported (Notification Triggers never shipped) or server-dependent (violates local-first). The wake lock makes "phone on bench, screen on" the designed state; the acceptance metric targets that state.

### 4.3 Flow focus (collapse + thumb zone)

- **Collapse rule:** an exercise card whose prescribed slots are all logged collapses to two lines: its `⏺ name n/n` header (dot already renders success-tinted when complete, [ExerciseCard.tsx:137-146](../../web/src/features/workout/ExerciseCard.tsx)) + one `⎿` summary line (`⎿ 62.5×12 ↑PR · 52.5×12 · 52.5×10 · 50×10`, truncated). Exception: the card containing the most recent save stays expanded until the *next* save elsewhere (protects the just-finished-block → extra-set intention, W7).
- **Superset pairs collapse as a unit** (the bordered group, [SupersetGroup.tsx:27](../../web/src/features/workout/SupersetGroup.tsx)) only when both partners are complete.
- **Reopen:** header tap toggles (`aria-expanded` on the header button; collapsed content unmounts). Collapsed is never a dead end — expanded cards retain the Extra-set control and editable rows.
- **Current exercise** = first card with an unlogged prescribed slot: always expanded; after a save that completes a card, auto-scroll the next primed row to the center band (`scrollIntoView({block:"center"})`) so the next decision sits mid-screen, one thumb-move from the bottom. (Measured today: by mid-session the active row can be >1500 px below the fold.)
- **Rest bar moves to the bottom**, docked directly above `WorkoutFooter` — Skip/+30s land in the thumb zone (from y≈123 to y≈650+), sized ≥44 px. The countdown also becomes the "what's next" anchor: append the primed target to the label — `Rest 1:12 — next: 52.5 × 8` — in ≥16 px so the resting glance (W3/W12) needs no scroll and no sheet.
- **Test impact (flagged):** RestTimerBar's DOM position changes (component subtree unchanged — low risk); collapse unmounts logged rows, so any test that queries a completed exercise's set rows must expand the card first. The 28-E2E suite logs sets into *incomplete* (expanded) cards, so the main flows survive; audit `finish`-flow specs that re-read logged rows afterwards.

---

## 5. Small-fix list (each <1 h, verified in this walkthrough)

1. **ExercisePicker height is broken** — `h-[85dvh]` on [ExercisePicker.tsx:46](../../web/src/features/workout/ExercisePicker.tsx) loses to `data-[side=bottom]:h-auto` from the sheet base (specificity 0-2-0 vs 0-1-0). Sheet renders 5741 px tall, header/search unreachable. Fix: `data-[side=bottom]:h-[85dvh]` (or `!h-[85dvh]`). *(Proven: removing `data-side` snaps computed height 5741 → 690 px.)*
2. **ExercisePicker has no close control** — `showCloseButton={false}` and no Cancel; the grabber bar is decorative only ([ExercisePicker.tsx:46-50](../../web/src/features/workout/ExercisePicker.tsx)). Dismissal today = tapping the ~15 % scrim. Add the sheet close button or a Cancel chip (match SetLogSheet's, [SetLogSheet.tsx:350-356](../../web/src/features/workout/SetLogSheet.tsx)).
3. **Session progress overflows its denominator** — header showed "21 of 20 sets logged" after one extra set: [WorkoutScreen.tsx:252](../../web/src/features/workout/WorkoutScreen.tsx) counts all routine-origin sets; card badges already exclude overruns ([ExerciseCard.tsx:106-111](../../web/src/features/workout/ExerciseCard.tsx)). Mirror that filter.
4. **± nudge steps ≠ equipment increments** — hardcoded ±2.5 at [SetLogSheet.tsx:434-435, 459-460](../../web/src/features/workout/SetLogSheet.tsx); use `getIncrement(effectiveEquipment, units)`. (Rides along in Sprint 1 anyway; listed for independence.)
5. **Day-label truncation on the workout header** — "Heavy Squat + Horizontal Push/Pull" shows 178 of 469 px at 24 px mono ([PromptHeading.tsx:33](../../web/src/shared/components/PromptHeading.tsx) `truncate` via [SessionHeader.tsx:31](../../web/src/features/workout/SessionHeader.tsx)). Allow two-line wrap on the workout screen (`line-clamp-2`), keep truncate elsewhere.
6. **Day-one weight prefill "0"** → `""` ([SetLogSheet.tsx:172](../../web/src/features/workout/SetLogSheet.tsx)); `—` placeholder reads as "not set", prevents plausible-looking 0 kg saves.
7. **Sub-44 px tap targets** (all measured): Day chips 29×22 ([DaySelector](../../web/src/features/today/DaySelector.tsx)); rest bar +30s/Skip 46×28; unit toggle 31×21; Extra-set 65×24; exercise-history link 151×20 (SessionDetail). Pad hit areas (padding/min-h, not visual size — "themed, not literal").
8. **Poisoned-set display precedence** — a set with all four measures renders as `w × r` only (formatLoggedSet), hiding dur+dist (seen on the corrupted rowing set in workout + history + detail). After Sprint 1's fix such records can't be created; add a defensive tertiary render or leave as data-migration note.

---

## 6. Acceptance metrics

1. **Common-case set = 1 tap**: any prescribed slot on a routine exercise whose block has history logs with a single tap, including the first set of each exercise (today: 2 best-case, 11–14 on first sets).
2. **20-set Day-A session ≤ 60 total touches** (from ~152 measured), same scenario mix: 1 weight deviation, 2 honest-reps adjustments, 1 extra set, 1 cardio extra, 1 edit, 4 timer ops.
3. **Honest-reps deviation ≤ 5 touches** (from 7); single-increment weight deviation ≤ 4 (nudge correct per equipment/unit).
4. **Zero cross-exercise prefill**: opening any sheet never shows another exercise's values (verified by scripted first-open sweep across all 7 Day-A exercises); **zero non-null weight/reps stored on cardio extras** going forward (DB assertion in integration tests).
5. **Zero manual screen unlocks in a 45-min session** with the setting on: wake lock held or re-acquired within 1 s of every `visibilitychange → visible` (manual device test, 10/10 re-acquisitions).
6. **Rest cue perceivable without looking**: vibration fires within 1 s of countdown end while the app is visible, 10/10 timers on-device; phone-in-pocket is explicitly out of scope (documented in Settings copy).
7. **Quick-log parity**: a quick-logged set is byte-identical (minus timestamps/id) to the same set logged via the sheet — weight/reps/PR flag/rest-timer side effects (integration test through `handleSave`).
8. **Glanceable next target**: during rest, the next target is on screen in ≥16 px without scrolling (rest-bar "next:" suffix), and the primed row is auto-scrolled into the middle band after each card completion.
9. **Suite health**: 1214 unit + 28 E2E green; only the flagged specs change (primed-row aria, rest-bar position, collapse expansion helpers).

---

## 7. Sprint cut

### Sprint 1 — Guided logging (product item 1)

**Scope (files):**
- `web/src/features/workout/lib/quick-target.ts` **(new)** — pure per-block target resolution (§3.4) + unit tests.
- `web/src/features/workout/ExerciseCard.tsx` — primed-row selection, target line, `LOG`/`✎` affordances, drop redundant LAST strip on single-block cards.
- `web/src/features/workout/SetRow.tsx` — primed variant (new props; existing variants untouched), day-one prescription hint fallback.
- `web/src/features/workout/WorkoutScreen.tsx` — quick-log handler routed through `handleSave`; undo toast (`deleteSet` + timer cancel via `loggedSetId` on `ActiveRestTimer`); `key={sheetExercise.id}` on the sheet wrapper; hoist `useExercisePersonalBests` to the card wrapper.
- `web/src/features/workout/SetLogSheet.tsx` — prefill gating on loaded history, hidden-measure nulling in `parseCurrentInput`, progression reps = `minValue`, `""` weight prefill, increment-aware nudges.
- `web/src/features/workout/lib/keypad-reducer.ts` — pristine-replace flag + tests.
- `web/src/features/workout/lib/rest-timer.ts` — `loggedSetId` on the timer type (pure change).

**Risks:** behavior flip on one row per card (mitigate: only the primed row changes; aria-label states the action and payload); undo must not advance any rotation/promotion state (it can't — `deleteSet` is a hard delete and promotion is one-way, [set-service CLAUDE.md](../../web/src/services/CLAUDE.md) — but assert in tests); test churn concentrated in ExerciseCard/SetRow/SetLogSheet specs (flagged in §3.9). No service-layer changes at all — invariants 7/8/9 enforced by existing code paths.

### Sprint 2 — Gym-proof the active screen (product item 2)

**Scope (files):**
- `web/src/shared/hooks/useWakeLock.ts` **(new)** + tests (mocked `navigator.wakeLock`).
- `web/src/shared/lib/cues.ts` **(new)** — guarded `vibrate()` / primed-`AudioContext` beep.
- `web/src/services/settings-service.ts` + `web/src/domain/types.ts` — `keepScreenOn`, `restCueHaptic`, `restCueSound` (defaults true/true/false); settings screen toggles (`web/src/features/settings/…`).
- `web/src/features/workout/WorkoutScreen.tsx` — wake-lock wiring; completion `setTimeout` schedule/reschedule/cancel; collapse-state orchestration; auto-scroll after card completion.
- `web/src/features/workout/RestTimerBar.tsx` — relocate above `WorkoutFooter`, ≥44 px controls, `next:` target suffix (consumes the Sprint-1 target resolver).
- `web/src/features/workout/ExerciseCard.tsx` — collapsed variant (header + `⎿` summary, `aria-expanded`).
- Small fixes riding along: picker height + close control (`ExercisePicker.tsx`, `shared/ui/sheet.tsx` audit), day-label wrap (`SessionHeader.tsx`), session-progress cap (`WorkoutScreen.tsx:252`), tap-target padding (DaySelector, unit toggle, extra-set, history links).

**Risks:** settings schema addition (backup export/import round-trip must include the three fields — extend `backup-service` validation fixtures); collapse unmounting rows breaks any spec that reads completed cards without expanding (add an `expandCard` test helper; audit finish-flow E2E); timer `setTimeout` must never double-fire after +30s (reschedule = clear + set; unit-test the schedule math against `getRestRemainingSec`); wake lock is inert in unsupported/battery-saver contexts by design — no UI depends on it succeeding.

**Sequencing note:** Sprint 1 before Sprint 2 — the rest-bar "next:" suffix and collapse logic both consume `quick-target.ts`, and the W1 race fix must land before one-tap accept makes prefills trustworthy enough to commit blind.

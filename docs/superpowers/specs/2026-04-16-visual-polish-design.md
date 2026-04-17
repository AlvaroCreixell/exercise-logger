# Visual Polish Pass — Design Spec

**Date:** 2026-04-16
**Plan this feeds:** Phase 1 Plan A (items #3-5, #8) from `docs/codebase-review-2026-04-16.md`
**Revision:** 2 — verified against current code; stale findings corrected and scope sharpened per independent review.
**Goal:** Resolve the user's "visuals are clunky, does the job but not exciting" complaint with a focused refinement pass. No redesign — refine the existing Swiss-leaning direction with softened edges, motion, and sharper hierarchy.
**Target:** Ship to a few friends. Phone-first (Pixel 7 Chromium installed PWA).

## Scope adjustments since the codebase review

- **Plan A item #2 (Workout header hierarchy swap) is ALREADY IMPLEMENTED** in `web/src/features/workout/WorkoutScreen.tsx:157-162`. Drop from scope.
- **Stale/orphaned files in repo**: `web/src/App.tsx` (9-line Vite template stub) and `web/src/App.css` exist as untracked orphans. The live app imports from `web/src/app/App.tsx` and `web/src/app/App.css` via `main.tsx:3-4`. All path references below target the **live** `app/*` files. The orphans should be deleted in a housekeeping commit (not part of Plan A).

## Direction

The app currently executes a Swiss/brutalist-adjacent language (0 border-radius, strong top borders, monochrome + CTA purple, tight tracking) but reads as cold/generic rather than editorial. We're keeping the typography and palette discipline while allowing **four concessions**: small radii (4-6px), subtle card shadows, sentence-case exercise names, and a saturated success color for logged sets. Motion graduates from "not a goal" to **full tier**: hover + active-press feedback on every interactive element, plus a flash-green animation on successful set log.

Softened Swiss is the baseline **end-to-end** — cards, buttons, slots, inputs, AND dialogs/sheets/toasts all follow the same radius/shadow language. Mixed-edge UI would read worse than either pure state.

This is a one-way door within Plan A — once implemented, these tokens are the baseline for future UI work.

---

## Section 1 — Design tokens

**File:** `web/src/app/App.css` (the live CSS file imported by `main.tsx:4`).

### Radii

```css
--radius-sm: 4px;     /* slots, chips, small buttons */
--radius:    6px;     /* cards, sheets, medium buttons, dialogs */
--radius-lg: 8px;     /* rare — reserved for future full-screen sheets */
```

Previous values were all 0. Tailwind 4 reads these as the `rounded-sm` / `rounded` (default) / `rounded-lg` utilities. Verify the exact var names in the existing `App.css` during execution — Tailwind 4's CSS-first config may use a different convention (e.g., `--radius-md`); adapt to what's there rather than overwriting.

**Button primitive follow-up (required, not optional):** `web/src/shared/ui/button.tsx:7` currently has `rounded-lg` hardcoded in the base variant class. With the new token mapping that would put buttons at 8px (large radius, inconsistent with cards at 6px). Change the base class to `rounded-md` (or `rounded` if there's no `-md` variant) so buttons land on the medium 6px token alongside cards. Audit other hardcoded `rounded-lg` usages in the codebase and decide case-by-case; most should follow the button.

### Color saturation

Bump `--success` only (info/warning/destructive stay as-is).

```css
/* light mode */
--success:             oklch(0.60 0.20 145);   /* was oklch(0.65 0.17 145) */
--success-foreground:  #ffffff;                 /* new token — white on saturated green */

/* dark mode */
--success:             oklch(0.78 0.20 145);   /* was ~0.75 0.17 — proportional brighten */
--success-foreground:  #ffffff;
```

`--success-soft` stays as-is for ambient uses (empty-state tints, subtle strokes). The bolder `--success` is reserved for logged-slot backgrounds and the suggestion-text color.

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
```

Applied via Tailwind `shadow-sm` on cards and dialogs. Buttons do NOT get a default shadow. Before writing this, grep for existing `shadow-sm` to confirm no conflict.

### Motion tokens

```css
--ease-out-soft: cubic-bezier(0.22, 0.61, 0.36, 1);
--dur-fast: 120ms;
--dur-base: 180ms;
--dur-slow: 600ms;
```

Use `var(--dur-base)` for color transitions, `var(--dur-fast)` for transforms, `var(--dur-slow)` for the flash-logged animation.

### `@keyframes flash-logged`

```css
@keyframes flash-logged {
  0%   { background: var(--success); color: white; transform: scale(1.05); }
  60%  { background: var(--success); color: white; transform: scale(1); }
  100% { background: var(--success); color: white; transform: scale(1); }
}

.flash-logged {
  animation: flash-logged var(--dur-slow) var(--ease-out-soft);
}
```

Lives in `App.css` alongside other global styles.

---

## Section 2 — Workout surfaces

### 2.1 `SetSlot.tsx` redesign

**File:** `web/src/features/workout/SetSlot.tsx`. **Important:** this is a raw `<button>` (line 48), NOT the shared `button.tsx` primitive — so focus-visible styles must be declared explicitly, not inherited.

**Sizing:** `min-w-[4rem] min-h-[48px]` (was `min-w-[3.5rem] min-h-[44px]`).

**Radius:** `rounded-sm` on all states.

**Logged state:**
- `bg-success text-white` (was `bg-success-soft text-success`)
- `border-l-2 border-l-success/60` for edge accent (keep — currently exists on line 54, retain)
- Existing `Check` icon inline with the value text (retain)

**Unlogged state:**
- `bg-background border-[1.5px] border-border-strong text-muted-foreground`

**Both states — add explicitly:**
- `transition-colors duration-[var(--dur-base)]` (already in class list, retain)
- `hover:border-cta`
- `active:scale-95`
- `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30` **(required — this button does not inherit from the shared primitive)**

**Flash-on-log mechanism:**

Trigger: whenever the slot's logged set is **created** (`undefined → defined`) OR **edited** (`updatedAt` changes) — NOT on initial mount of a slot that already has a logged set.

Pattern (inside `SetSlot`):
```tsx
import { useEffect, useRef, useState } from "react";

const [flashing, setFlashing] = useState(false);
const prevUpdatedAtRef = useRef<string | undefined>(loggedSet?.updatedAt);
const hasMountedRef = useRef(false);

useEffect(() => {
  const current = loggedSet?.updatedAt;
  const prev = prevUpdatedAtRef.current;

  // Skip the initial mount — we don't flash pre-existing state.
  if (!hasMountedRef.current) {
    hasMountedRef.current = true;
    prevUpdatedAtRef.current = current;
    return;
  }

  // Flash only when updatedAt actually changed and we now have a logged set.
  if (current && current !== prev) {
    setFlashing(true);
    const t = window.setTimeout(() => setFlashing(false), 600);
    prevUpdatedAtRef.current = current;
    return () => window.clearTimeout(t);
  }

  prevUpdatedAtRef.current = current;
}, [loggedSet?.updatedAt]);
```

Then conditionally append `flash-logged` to the className when `flashing === true`.

Rationale: `loggedSet.id` alone misses edits (id stable across updates). `loggedSet?.updatedAt` changes on both create and edit. The `hasMountedRef` guard suppresses the initial-render firestorm when a user opens a workout with many already-logged sets.

**Note:** this assumes `LoggedSet.updatedAt` is bumped by `logSet` / `editSet` in `set-service.ts`. Verify during execution; if the service currently only sets `createdAt`, add an `updatedAt: nowISO()` write to both `logSet` (upsert path) and `editSet`. This is a tiny service edit, include in the plan.

### 2.2 `ExerciseCard.tsx` typography

**File:** `web/src/features/workout/ExerciseCard.tsx`.

**Exercise name (currently line ~123, verify during execution):**
```tsx
{/* before */}
<h3 className="text-sm font-semibold uppercase tracking-wide truncate">{se.exerciseNameSnapshot}</h3>
{/* after */}
<h3 className="text-base font-semibold tracking-tight truncate">{se.exerciseNameSnapshot}</h3>
```
Drop `uppercase`, flip tracking wide → tight, bump size `sm` → `base`. Names become more scannable under effort.

**Last-time + suggestion stack (lines ~171-191):**

**Before:** horizontal `flex flex-wrap` puts them on the same line; reflows.

**After:** vertical stack, color-differentiated:

```tsx
<div className="space-y-1 tabular-nums">
  {lastTime && (
    <p className="text-xs text-muted-foreground">
      Last: {formatLastTime(lastTime, units)}
    </p>
  )}
  {suggestion && (
    <p className="text-xs text-success font-semibold inline-flex items-center gap-1">
      <ArrowUp className="h-3 w-3" />
      Suggest: {formatSuggest(suggestion, units)}
    </p>
  )}
</div>
```

Both lines `text-xs tabular-nums`; last-time muted gray; suggestion in saturated `text-success` with Lucide `ArrowUp`.

### 2.3 Shared `Card` primitive

**File:** `web/src/shared/ui/card.tsx`. Consumed by `ExerciseCard` (workout), `TodayScreen`, `SettingsScreen` — changes here spread. This is **intentional**: Softened Swiss is the baseline, so Today/Settings cards should match Workout cards.

**Base `Card` changes (line ~15):**
- Add `rounded shadow-sm` to the base class list.
- **Retain** `border-t-2 border-border-strong` — one moment of Swiss discipline per card.

**`readOnly` variant exemption in `ExerciseCard.tsx:118`:**
```tsx
{/* before */}
<Card className={readOnly ? "border-t border-border bg-transparent" : undefined}>
{/* after */}
<Card className={readOnly ? "border-t border-border bg-transparent shadow-none rounded-none" : undefined}>
```
The readOnly history variant is already intentionally stripped; we add `shadow-none rounded-none` so it doesn't inherit the new defaults and look odd against the history list's flatter layout.

---

## Section 3 — Global pass

### 3.1 Spacing rhythm (narrowed from the review — most screens are already on p-5)

Already on `p-5`: `TodayScreen.tsx:107`, `SettingsScreen.tsx:99`, `SessionDetailScreen.tsx:120`, `ExerciseHistoryScreen.tsx:43`. Leave those alone.

**Remaining outliers — change these:**

| File | Line | Before | After | Why |
|------|------|--------|-------|-----|
| `WorkoutScreen.tsx` | 166 | `p-5 space-y-3` | `p-5 space-y-4` | Cards are the unit; `space-y-3` compresses adjacent cards into one wall |
| `HistoryScreen.tsx` | 21 | `p-5 space-y-2` | `p-5 space-y-4` | Same — list rhythm wants breathing room |
| `ExerciseCard.tsx` CardContent | ~119 | `py-3 space-y-3` | `py-4 space-y-3` | Card internal vertical padding was cramped |
| `card.tsx` `CardHeader` | ~28 | `px-4 pt-4` | `px-5 pt-5` | Primitive default nudged up one step |
| `card.tsx` `CardContent` | ~76 | `px-4` | `px-5` | Primitive default nudged up one step |

Leave `CardFooter` as-is (it's already `p-4` with a contrasting background — that pattern reads clearly).

### 3.2 Motion defaults

- `web/src/shared/ui/button.tsx:7` — `buttonVariants` base: add `transition-colors duration-[var(--dur-base)]`. The existing `active:not-aria-[haspopup]:translate-y-px` stays. Don't add `active:scale-95` to the shared primitive — some buttons (destructive discard) should feel deliberate, not bouncy.
- Nav links (`app/App.tsx:87` NavLink), tab buttons, picker rows: same `transition-colors duration-[var(--dur-base)]` in their className.
- Tappable slots/cards: `active:scale-95` explicitly per-component.
- Sheets use Base UI's built-in `data-open:animate-in` / `data-closed:animate-out` — no changes.

### 3.3 Dialogs, sheets, alert-dialogs, toasts — match the new language

All currently render with hard edges. To keep the softened Swiss language coherent end-to-end, update the surfaces on each primitive's content panel:

| File | Surface | Add |
|------|---------|-----|
| `web/src/shared/ui/dialog.tsx` (~line 54) | DialogContent | `rounded shadow-sm` |
| `web/src/shared/ui/alert-dialog.tsx` (~line 55) | AlertDialogContent | `rounded shadow-sm` |
| `web/src/shared/ui/sheet.tsx` (~line 54) | SheetContent | top-edge `rounded-t` (keep bottom flush to viewport edge) |
| `web/src/app/App.tsx` Toaster (~line 153) | `toastOptions.classNames.toast` or equivalent | `rounded shadow-sm` |

Verify actual line numbers and prop shapes during execution; these are references, not exact locations.

### 3.4 `CLAUDE.md` test count

`CLAUDE.md:43`: `391` → `436`. Search for other references to 391 in docs/ and update.

---

## Scope boundary

**Explicitly in Plan A:**
- Section 1 token + button-class edits
- Section 2 workout-surface edits (SetSlot, ExerciseCard typography, Card primitive + readOnly exemption)
- Section 3 spacing outliers + motion defaults + dialog/sheet/alert-dialog/toaster softening + `CLAUDE.md` update

**Explicitly NOT in Plan A (defer to Phase 2):**
- Empty-state redesign (codebase review §2.2.2 #9)
- Resume-card recolor (§2.2.2 #10)
- Block label + target stacking (UX High #3)
- Semantic color audit beyond `--success`
- Dark-mode WCAG contrast audit
- Settings segmented-control focus ring
- Double-confirm on Discard button
- Deletion of orphaned `web/src/App.tsx` / `web/src/App.css` (housekeeping, not visual polish)

---

## Success criteria

- On Pixel 7 emulator: workout screen loads with the existing (correct) header hierarchy.
- Tapping an unlogged set slot produces visible press feedback (scale); saving the set triggers a 600ms green flash on that specific slot only.
- Editing an existing set also triggers the flash.
- Reopening a finished workout does NOT trigger a flash cascade across already-logged slots.
- Card surfaces have visible but subtle shadows and 6px rounded corners across Today, Workout, Settings.
- ReadOnly history cards remain flat (no shadow, no radius).
- Exercise names render in sentence case with tight tracking.
- Last-time and suggestion stack vertically; suggestion is saturated green with an up-arrow icon.
- `WorkoutScreen` and `HistoryScreen` card lists breathe (`space-y-4`).
- Button primitive rounds on `--radius` (6px), not `--radius-lg` (8px).
- All `<Button>` interactions have a ≤200ms color transition on hover.
- Dialogs, alert-dialogs, sheets, and toasts carry matching radii + soft shadows.
- Full test suite still passes (436+ tests).
- Manual smoke on `npm run dev`: no visual regressions outside the above surfaces.

---

## Risks & notes

- **Tailwind 4 CSS-first config token names:** the exact var names above (`--radius-sm`, `--shadow-sm`, etc.) must match what the existing `App.css` declares. If the project uses a different convention, adapt during execution rather than overwriting.
- **`shadow-sm` pre-existing usage:** grep before redefining; avoid breaking any existing consumer relying on the old default.
- **`LoggedSet.updatedAt` presence:** the flash mechanism reads `loggedSet.updatedAt`. If `logSet` / `editSet` in `set-service.ts` don't already maintain this field, add `updatedAt: nowISO()` writes to both. One-line change per function, no schema migration (field is optional in the type but will be set going forward). Document in the task.
- **Active sessions during upgrade:** the PWA auto-update rolls out mid-session. Changes are purely presentational, no data model changes, so an in-progress workout transitioning mid-session will just look different, not break.
- **Scope creep signal:** if execution reveals that softening dialogs/sheets/toasts requires fighting Base UI primitives, drop them from Plan A and add a follow-up note. Don't let primitive wrangling block the core workout-surface improvements.

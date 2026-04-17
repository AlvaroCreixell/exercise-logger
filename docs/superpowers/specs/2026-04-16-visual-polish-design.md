# Visual Polish Pass — Design Spec

**Date:** 2026-04-16
**Plan this feeds:** Phase 1 Plan A (items #2-5, #8) from `docs/codebase-review-2026-04-16.md`
**Goal:** Resolve the user's "visuals are clunky, does the job but not exciting" complaint with a focused refinement pass. No redesign — refine the existing Swiss-leaning direction with softened edges, motion, and sharper hierarchy.
**Target:** Ship to a few friends. Phone-first (Pixel 7 Chromium installed PWA).

## Direction

The app currently executes a Swiss/brutalist-adjacent language (0 border-radius, strong top borders, monochrome + CTA purple, tight tracking) but reads as cold/generic rather than editorial. We're keeping the typography and palette discipline while allowing **four concessions**: small radii (4-6px), subtle card shadows, sentence-case exercise names, and a saturated success color for logged sets. Motion graduates from "not a goal" to **full tier**: hover + active-press feedback on every interactive element, plus a flash-green animation on successful set log.

This is a one-way door within Plan A — once implemented, these tokens are the baseline for future UI work.

---

## Section 1 — Design tokens

File: `web/src/App.css` (or wherever CSS vars live — audit during execution).

### Radii

```css
--radius-sm: 4px;     /* slots, chips, small buttons */
--radius: 6px;        /* cards, sheets, medium buttons */
--radius-lg: 8px;     /* modal corners */
```

Previous values were all 0. Tailwind 4 reads these as the `rounded-sm` / `rounded` / `rounded-lg` utilities automatically — verify during execution. If Tailwind 4's CSS-first config uses different var names, adapt.

### Color saturation

Bump `--success` only (info/warning/destructive stay as-is).

```css
/* light mode */
--success: oklch(0.60 0.20 145);         /* was oklch(0.65 0.17 145) */
--success-foreground: #ffffff;            /* new token — white on saturated green */

/* dark mode */
--success: oklch(0.78 0.20 145);         /* was ~0.75 0.17 — proportional brighten */
--success-foreground: #ffffff;
```

`--success-soft` stays as-is for ambient uses (empty-state tints, subtle strokes). The bolder `--success` is reserved for logged-slot backgrounds and the suggestion-text color.

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
```

Applied via Tailwind `shadow-sm` on cards. Buttons do NOT get a default shadow.

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

### 2.1 `WorkoutScreen.tsx` header hierarchy swap

**File:** `web/src/features/workout/WorkoutScreen.tsx`, lines ~160-162.

**Before:**
```tsx
<h1 className="text-lg font-bold truncate">{session.dayLabelSnapshot}</h1>
<p className="text-sm text-muted-foreground truncate">{session.routineNameSnapshot}</p>
```

**After:**
```tsx
<p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
  {session.dayLabelSnapshot}
</p>
<h1 className="text-2xl font-extrabold font-heading truncate">
  {session.routineNameSnapshot}
</h1>
```

Rationale: on the app's most-viewed screen, users should read the routine name first (primary context) and the day label second (secondary context). Current code has the hierarchy inverted.

### 2.2 `SetSlot.tsx` redesign

**File:** `web/src/features/workout/SetSlot.tsx`.

**Sizing:** `min-w-[4rem] min-h-[48px]` (was `min-w-[3.5rem] min-h-[44px]`).

**Radius:** `rounded-sm` on all states.

**Logged state:**
- `bg-success text-white` (was `bg-success-soft text-success`)
- `border-l-2 border-l-success/60` for an edge accent (optional — visual flourish, review during execution)
- Small `CheckIcon` (Lucide `Check`) inline with the value text

**Unlogged state:**
- `bg-background border-[1.5px] border-border-strong text-muted-foreground`
- Shows index number only (current behavior)

**Both states:**
- `transition-colors duration-[var(--dur-base)]`
- `hover:border-cta`
- `active:scale-95`
- Focus ring unchanged (inherits from button base)

**Flash-on-log:**
- New prop `justLogged?: boolean`. Parent decides when it's true.
- When `true`, slot gets the `flash-logged` class — the 600ms animation runs.
- Parent removes the prop (via `setTimeout(() => setJustLogged(false), 600)`) so the class detaches.

Simpler pattern: `SetSlot` tracks its own `justLogged` via a `useEffect` that watches `loggedSet?.id` for changes. On change (new log), flip the flag, auto-reset after 600ms. No parent changes, no service changes, no prop churn.

### 2.3 `ExerciseCard.tsx` typography

**File:** `web/src/features/workout/ExerciseCard.tsx`.

**Line ~97 — exercise name:**
```tsx
{/* before */}
<h3 className="text-base font-semibold uppercase tracking-wide">{exerciseName}</h3>
{/* after */}
<h3 className="text-base font-semibold tracking-tight">{exerciseName}</h3>
```
Drop `uppercase` and flip tracking from wide → tight. Names become more scannable under effort.

**Lines ~171-191 — last-time + suggestion stack:**

**Before:** horizontal `flex flex-wrap` puts last-time and suggestion on the same line; reflows unpredictably.

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

Both lines use `text-xs tabular-nums`; last-time is muted gray; suggestion is success green with an up-arrow.

### 2.4 Card container

**File:** whatever renders the `Card` shell for exercise cards (`web/src/shared/ui/card.tsx` if it's the shadcn primitive, or inline in `ExerciseCard.tsx` — audit).

**Change:**
- Add `rounded shadow-sm` to the card surface.
- Keep the `border-t-2 border-border-strong` top border — one moment of Swiss discipline per card, and it's a useful structural signal.
- Internal padding: `p-5 space-y-3` (was `p-4 space-y-3`).

---

## Section 3 — Global pass

### 3.1 Padding rhythm

Audit across feature screens. Replace:

| Where | Before | After |
|-------|--------|-------|
| Feature screen outer wrapper | `p-4` | `p-5` |
| Between major sections in a screen | `space-y-3` or `space-y-4` | `space-y-6` |
| Between cards in a list | `space-y-3` | `space-y-4` |
| Inside card | `p-4 space-y-3` | `p-5 space-y-3` |

Files to audit: `TodayScreen.tsx`, `WorkoutScreen.tsx`, `HistoryScreen.tsx`, `SessionDetailScreen.tsx`, `SettingsScreen.tsx`, `ExerciseHistoryScreen.tsx`.

### 3.2 Motion defaults

- All `<Button>` variants get `transition-colors duration-[var(--dur-base)] active:translate-y-px` as part of `buttonVariants` in `web/src/shared/ui/button.tsx`. Audit the current variants — some of this may already be present (the `active:not-aria-[haspopup]:translate-y-px` line at `button.tsx:7` is partial).
- Nav links (`App.tsx:87` `NavLink`), tab buttons, picker rows: same `transition-colors duration-[var(--dur-base)]`.
- Tappable slots/cards: `active:scale-95`.
- **Exception:** the "Discard" button and other destructive confirmations should NOT use `active:scale-95` — they should feel deliberate, not bouncy. Use `active:translate-y-px` only.
- Sheets use Base UI's built-in `data-open:animate-in` / `data-closed:animate-out` — no changes needed.

### 3.3 `CLAUDE.md` test count

`CLAUDE.md:43` (or wherever the claim lives): `391` → `436`. Search for any other references to 391 in docs and update.

---

## Scope boundary

**Explicitly in Plan A:**
- Section 1 token changes
- Section 2 workout-surface edits
- Section 3 global pass + test-count update

**Explicitly NOT in Plan A (defer to Phase 2):**
- Empty-state redesign (codebase review §2.2.2 #9)
- Resume-card recolor (§2.2.2 #10)
- Block label + target stacking (UX High #3)
- Semantic color audit beyond `--success`
- Dark-mode WCAG contrast audit
- Settings segmented-control focus ring
- Double-confirm on Discard button

---

## Success criteria

- On Pixel 7 emulator: workout screen loads, routine name is the prominent heading, day label is the small CTA subtitle.
- Tapping a set slot produces a visible press feedback (scale) and, on successful log, a 600ms green flash.
- Card surfaces have visible but subtle shadows and 6px rounded corners.
- Exercise names render in sentence case with tight tracking.
- Last-time and suggestion stack vertically; suggestion is green with an up-arrow.
- All feature screens have `p-5` baseline padding.
- All `<Button>` interactions have a ≤200ms color transition on hover and an active press response.
- Full suite still passes (436+ tests).
- Manual smoke on `npm run dev`: no visual regressions outside these surfaces.

---

## Risks & notes

- **Tailwind 4 CSS-first config:** the token names above (`--radius-sm`, `--shadow-sm`, etc.) need to match whatever the existing `App.css` declares. If the project uses a different var-naming convention, adapt during execution rather than overwriting.
- **`shadow-sm` pre-existing usage:** a search should confirm that the existing codebase doesn't already use `shadow-sm` for a different effect that would break if we redefine the token.
- **Flash animation on re-renders:** `SetSlot` currently renders frequently (every set logged anywhere re-renders its siblings). The `useEffect` trigger for flash must watch `loggedSet?.id` (not `loggedSet` object identity) so unrelated re-renders don't spuriously trigger the animation.
- **Active sessions during upgrade:** the PWA auto-update will roll out mid-session. The visual changes are backward-compatible (no data model changes), so an in-progress workout transitioning to the new UI should just look different, not break.

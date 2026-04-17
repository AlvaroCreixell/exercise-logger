# Visual Makeover — Strict Swiss Design

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Pure visual reskin — no behavior, logic, or data changes
**Canonical target:** All changes are in `web/src/app/` and `web/src/shared/` and `web/src/features/`. The files `web/src/App.tsx`, `web/src/App.css`, and `web/src/main.tsx` in the root `src/` are dead placeholders — do not modify them.

## Direction

Strict Swiss / International Typographic Style. Sharp rectangles, heavy rules, typographic hierarchy, generous whitespace. Monochrome palette with a single blue accent. Zero border-radius across the entire app.

## Typography

| Role | Font | Weight | Size | Extras |
|---|---|---|---|---|
| Screen title | Urbanist | 800 | `text-2xl` (24px) | `tracking-tight` |
| Group/day title | DM Sans | 600 | `text-base` (16px) | — |
| Section header | DM Sans | 600 | `text-xs` (12px) | `uppercase tracking-widest` |
| Exercise name | DM Sans | 600 | `text-sm` (14px) | `uppercase tracking-wide` |
| Body / values | DM Sans | 500 | `text-sm` (14px) | `tabular-nums` for numbers |
| Meta / hints | DM Sans | 500 | `text-xs` (12px) | muted color |
| Small tags | DM Sans | 400 | `text-[10px]` | muted color (e.g., block tag labels in exercise history) |
| CTA buttons | Urbanist | 700 | `text-sm` | `uppercase tracking-widest` |

Font sources:
- Display: `@fontsource-variable/urbanist` (replaces `@fontsource-variable/geist`)
- Body: `@fontsource/dm-sans` (weights 400, 500, 600)

CSS variables:
- `--font-heading`: `'Urbanist Variable', sans-serif`
- `--font-sans`: `'DM Sans', sans-serif`

## Color Palette

Keep the existing OKLCH token architecture. Change these values:

### Light Mode

| Token | Current | New | Notes |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(1 0 0)` | No change — pure white |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0 0 0)` | Pure black |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0 0 0)` | Pure black |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(1 0 0)` | Pure white |
| `--card` | `oklch(1 0 0)` | `oklch(1 0 0)` | No change |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.97 0 0)` | No change |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.556 0 0)` | No change |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.922 0 0)` | Thin separators |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.97 0 0)` | No change |

New tokens:
- `--border-strong`: `oklch(0.07 0 0)` — structural 2px borders (#111)
- `--cta`: `oklch(0.546 0.245 262.88)` — blue-600 (#2563eb) for primary CTA and active states

### Dark Mode

| Token | Current | New | Notes |
|---|---|---|---|
| `--background` | `oklch(0.145 0 0)` | `oklch(0 0 0)` | Pure black |
| `--foreground` | `oklch(0.985 0 0)` | `oklch(1 0 0)` | Pure white |
| `--primary` | `oklch(0.922 0 0)` | `oklch(1 0 0)` | Pure white |
| `--primary-foreground` | `oklch(0.205 0 0)` | `oklch(0 0 0)` | Pure black |
| `--card` | `oklch(0.205 0 0)` | `oklch(0.05 0 0)` | Near-black surface |
| `--border` | `oklch(1 0 0 / 10%)` | `oklch(1 0 0 / 12%)` | Subtle light separators |
| `--border-strong` | — | `oklch(0.85 0 0)` | Structural rules (light on dark) |
| `--cta` | — | `oklch(0.637 0.237 261.35)` | blue-500 (#3b82f6) — passes WCAG AA on black |

Status colors (success, info, warning, destructive): **no change** — they are functional, not decorative.

### Token Registration

New tokens must be registered in the `@theme inline` block in `web/src/app/App.css` alongside the existing `--color-*` mappings:

```css
@theme inline {
  --color-border-strong: var(--border-strong);
  --color-cta: var(--cta);
}
```

This allows standard Tailwind utility classes: `bg-cta`, `text-cta`, `border-cta`, `border-border-strong` — consistent with the existing pattern (`bg-primary`, `text-foreground`, etc.). Do NOT use bracket notation like `bg-[--cta]`.

### Accent Policy

The blue accent (`--cta`) is used for:
- CTA button backgrounds (Start Workout, Save, Finish)
- Day subtitle text on Today screen
- Superset left border accent (`border-l-2 border-cta`)
- Active badge on routines
- Focus ring color on inputs, buttons, pills

The blue accent is NOT used for:
- `--info` semantic states — those keep the existing info token for functional meaning (AMRAP labels, suggested day dots, resume card)
- General decorative purposes

If a surface is blue because it means "active/selected/CTA" → use `--cta`. If it's blue because it means "informational status" → keep `--info`.

## Spacing

| Context | Current | New |
|---|---|---|
| Screen padding | `p-4` (16px) | `p-5` (20px) |
| Section gaps | `gap-6` (24px) | `gap-8` (32px) |
| Card internal gaps | `gap-4` (16px) | `gap-4` (no change) |
| Superset left padding | `pl-3` (12px) | `pl-4` (16px) |

## Borders & Radius

**Global rule: `border-radius: 0` on every component.** No exceptions.

Override the Tailwind/shadcn radius scale in CSS:
```css
:root {
  --radius: 0px;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
  --radius-2xl: 0px;
  --radius-3xl: 0px;
  --radius-4xl: 0px;
}
```

Border hierarchy:
- **Major structural dividers**: `border-t-2 border-border-strong` — screen section tops, nav bar, sticky headers/footers, section group separators
- **Exercise card separators** (within Workout/History): `border-t border-border-strong` (1px, lighter than structural 2px) — gives rhythm without noise
- **Row separators**: `border-b border-border` (1px, existing token) — between list items within a section. All row separators use this single weight consistently.
- **Input borders**: `border-[1.5px] border-border-strong`
- **No shadows anywhere** — remove all `shadow-*` classes
- **No ring-based card borders** — replace `ring-1 ring-foreground/10` on cards with structural top borders

## Focus, Disabled, and Interactive States

### Focus States
All interactive elements get a visible focus indicator. No soft shadows — sharp, Swiss-style:
- **Inputs**: `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30`
- **Buttons** (all variants): `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30`
- **Day pills**: `focus-visible:ring-2 focus-visible:ring-cta/30` (blue ring on focused pill)
- **Nav tabs**: `focus-visible:ring-2 focus-visible:ring-cta/30`
- **Tabs (ExercisePicker)**: `focus-visible:ring-2 focus-visible:ring-cta/30`

### Disabled States
- `opacity-50 pointer-events-none` — same as current, no change needed.

## Components

### Buttons
- All variants: `rounded-none` (inherited from radius reset)
- Default: black bg, white text
- CTA: `bg-cta text-white font-heading font-bold uppercase tracking-widest`
- Outline: `border-[1.5px] border-border-strong`
- Ghost: no border, `hover:bg-muted`
- Destructive: keep red tones, sharp rectangle
- Sizes unchanged (h-6 through h-9)
- Focus: `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30`

### Cards
- Remove `ring-1 ring-foreground/10` and `rounded-xl`
- Background: transparent (inherits page)
- Group via `border-t-2 border-border-strong`
- CardHeader: remove `rounded-t-xl`, add top border + `pt-4`
- CardFooter: remove `rounded-b-xl`

### Inputs
- `rounded-none`, `border-[1.5px] border-border-strong`
- Focus: `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30`
- Heights and padding unchanged

### Badges
- `rounded-none` — rectangular chips
- "Active" badge: `bg-cta text-white`
- Status badges: keep semantic colors

### Day Selector Pills
- `rounded-none`, butted together with shared borders (remove `gap-2`)
- Each pill: `border-[1.5px] border-border-strong`, negative right margin to collapse borders
- All pills show **short label only** (day letter: "A", "B", "C") — the full day label ("Push", "Pull") moves to the new subtitle element above the selector
- Active: `bg-primary text-primary-foreground`
- Suggested day indicator: small blue square (not circle)
- Focus: `focus-visible:ring-2 focus-visible:ring-cta/30`

### Bottom Nav
- `border-t-2 border-border-strong` (up from 1px)
- Active tab: primary color text, Lucide icons stay as-is
- Inactive: muted-foreground
- Active indicator: small blue square below icon (replaces current dot/highlight)

### Sheets (Bottom Modals)
- `rounded-none` top edge
- `border-t-2 border-border-strong`
- Overlay: `bg-black/10 backdrop-blur-xs` (unchanged)

### Dialogs
- `rounded-none`
- `border-2 border-border-strong` (all sides)
- No shadow
- Content structure unchanged

### AlertDialog / ConfirmDialog
- AlertDialogOverlay: remove `rounded-xl`
- AlertDialogContent: `rounded-none`, replace `ring-1 ring-foreground/10` with `border-2 border-border-strong`
- AlertDialogFooter: remove `rounded-b-xl`
- ConfirmDialog: inherits AlertDialog changes, no additional work

### Tabs
- Line variant: `border-b-2 border-primary` on active
- Inactive: muted text, no underline

### Segmented Controls (Settings — Units, Theme)
- Same pattern as day pills: butted rectangular buttons, shared borders
- Active: `bg-primary text-primary-foreground`
- Inactive: bordered, transparent bg

### Toaster (Sonner)
- Configure Sonner's `toastOptions` to match the Swiss system:
  - `className`: no border-radius, `border-2 border-border-strong`, `font-sans`
  - Remove any default shadows or rounded corners from Sonner's default styling
  - Keep `richColors` for semantic success/error/warning coloring

## Screen-by-Screen Visual Changes

All behaviors, data flow, interactions, and component structure remain identical. Only visual treatment changes.

### Today Screen
- Title: Urbanist 800, text-2xl, tracking-tight
- **Day subtitle** (new DOM element): DM Sans 600, text-xs, uppercase tracking-widest, `text-cta`. Shows the selected day's full label (e.g., "DAY B — PULL"). Currently the selected pill shows "B — Pull" inline — the label moves here instead, keeping pills short.
- 2px structural rule between subtitle and day selector
- Day pills: rectangular, butted, no gaps. Show day letter only ("A", "B", "C")
- DayPreview rows: `border-b border-border` separators, exercise names uppercase tracking-wide
- Superset group: `border-l-2 border-cta`, pl-4
- LastSessionCard: no `bg-muted/30` — `border-t-2 border-border-strong`, white bg
- **Resume Workout card** (active session state): remove `rounded-lg`. Keep `border-info bg-info-soft` (semantic, not decorative). Add sharp edges.
- **Cardio block**: remove `rounded-lg`. Keep `bg-muted` for surface distinction. Sharp edges.
- Start Workout: full-width CTA button (blue, Urbanist uppercase)
- No-routine empty state: Urbanist title, DM Sans body

### Workout Screen
- Sticky header: `border-b-2 border-border-strong`. Day label in `text-cta` uppercase, routine name in Urbanist 800
- ExerciseCard: no card chrome — `border-t border-border-strong` (1px) per exercise. Name uppercase DM Sans 600. First exercise in a group gets `border-t-2` (structural), subsequent ones get `border-t` (rhythm).
- Block labels: rectangular badges, semantic colors
- SetSlot: sharp rectangles. Logged = 2px green left-border + success-soft bg. Unlogged = `border border-border-strong`
- SetLogSheet: sharp sheet, square inputs, blue CTA save button
- SupersetGroup: `border-l-2 border-cta`, label `text-cta` uppercase tracking-widest. The superset container itself has no top border — the top border belongs to the first ExerciseCard inside it (avoids blue-left + black-top corner collision).
- ExercisePicker: sharp sheet, square search input, 2px active tab underline, `border-b border-border` row separators
- WorkoutFooter: `border-t-2 border-border-strong`, sharp buttons

### History Screen
- Title: Urbanist 800
- SessionCard: `border-t border-border-strong` (1px) per card. Day badge rectangular `bg-cta text-white`. Routine+day in DM Sans 600 text-base. Meta text-xs muted tabular-nums
- Empty state: Urbanist title, DM Sans body

### Session Detail Screen
- Back button: ghost, sharp rectangle
- Header: Urbanist 800 day label, DM Sans meta
- Read-only ExerciseCards: `border-t border-border` top borders (quieter than active workout — uses light border token)
- Logged slots: green left-border. Unlogged: solid `border border-border opacity-40` (not dashed — dashed conflicts with the Swiss vocabulary of solid rules)
- Exercise name: underline on hover

### Exercise History Screen
- Urbanist title
- Session groups: `border-t-2 border-border-strong` separators
- Group header: DM Sans text-xs uppercase tracking-widest muted
- Set values: DM Sans 500 tabular-nums, `border-b border-border` row separators

### Settings Screen
- Three sections, each with `border-t-2 border-border-strong`
- Section headers: DM Sans 600 text-xs uppercase tracking-widest
- RoutineList: `border-b border-border` row separators, no rounded borders on items
- Unit/Theme selectors: rectangular segmented controls (day-pill pattern)
- Action buttons: full-width sharp outline
- Clear All Data: sharp destructive outline, red border
- **Warning callouts** (active session blocks): remove `rounded-lg` from warning/error blocks. Keep `border-warning bg-warning-soft`. Sharp edges.
- **Import error panels**: same treatment — remove radius, keep semantic colors, sharp edges.

## Migration Notes

### Package Changes
- Remove: `@fontsource-variable/geist`
- Add: `@fontsource-variable/urbanist`, `@fontsource/dm-sans` (weights 400, 500, 600)

### CSS Changes (`web/src/app/App.css`)
- Replace `@import "@fontsource-variable/geist"` with Urbanist + DM Sans imports
- Update `--font-sans` and `--font-heading` variables
- Set all `--radius-*` variables to `0px`
- Add `--border-strong` and `--cta` tokens (both light and dark mode sections)
- Register `--color-border-strong` and `--color-cta` in the `@theme inline` block
- Update `--foreground`, `--primary`, `--background` values per palette table

### Component Changes (`web/src/shared/ui/` and `web/src/shared/components/`)
- Every shadcn component: remove hardcoded `rounded-*` classes (inherited from radius reset, but some have explicit `rounded-xl` etc.)
- Card (`card.tsx`): replace `ring-1 ring-foreground/10` with `border-t-2 border-border-strong`. Remove `rounded-xl` from Card, `rounded-t-xl` from CardHeader (add `pt-4`), `rounded-b-xl` from CardFooter.
- Button (`button.tsx`): add new `cta` variant (`bg-cta text-white font-heading font-bold uppercase tracking-widest`). Update focus ring to use `--cta`.
- Input (`input.tsx`): update border weight to `border-[1.5px] border-border-strong` and focus ring.
- Badge (`badge.tsx`): inherits radius reset.
- Sheet (`sheet.tsx`): update border treatment.
- Dialog (`dialog.tsx`): replace shadow with `border-2 border-border-strong`, remove `rounded-xl`.
- AlertDialog (`alert-dialog.tsx`): remove `rounded-xl` from overlay and content, `rounded-b-xl` from footer. Replace `ring-1 ring-foreground/10` with `border-2 border-border-strong`.
- ConfirmDialog (`ConfirmDialog.tsx`): inherits AlertDialog changes.
- Toaster: configure Sonner's `toastOptions` in `web/src/app/App.tsx` for sharp styling.

### Feature Changes
- DaySelector (`features/today/DaySelector.tsx`): rewrite pill layout (butted, no gaps, short labels only). Add subtitle element.
- Settings selectors: adopt day-pill pattern for Units and Theme controls.
- All screens: update `p-4` to `p-5`, update section gaps.

### What Does NOT Change
- All hooks, services, domain logic
- Component props and API surface
- Route structure
- Data flow
- Interaction behaviors (tap targets, sheets, dialogs, navigation)
- Status color semantics (success/info/warning/destructive soft variants)
- PWA configuration
- Test suite (visual changes only — existing tests should pass)

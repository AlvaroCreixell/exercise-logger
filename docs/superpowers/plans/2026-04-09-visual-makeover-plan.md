# Visual Makeover — Strict Swiss Design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire PWA with a Strict Swiss typographic design — zero border-radius, Urbanist + DM Sans fonts, monochrome + blue accent, heavy structural rules — without changing any behavior, logic, or data flow.

**Architecture:** Two-phase execution. Phase 1 (Tasks 1-4) is a single sequential agent that changes the design system foundation: CSS tokens, font packages, and all shared UI components. Phase 2 (Tasks 5-8) dispatches 4 parallel agents that each reskin a feature directory. Zero file overlap between Phase 2 agents.

**Tech Stack:** React 19, Tailwind CSS 4 (CSS-first config), shadcn/ui (base-nova), Vite 7, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-04-09-visual-makeover-design.md`

**IMPORTANT:** This is a visual-only reskin. Do NOT modify any hooks, services, domain logic, route structure, data flow, or interaction behaviors. The files `web/src/App.tsx`, `web/src/App.css`, and `web/src/main.tsx` in root `src/` are dead placeholders — do NOT touch them. All work targets `web/src/app/`, `web/src/shared/`, and `web/src/features/`.

---

## Phase 1: Foundation (Sequential — Single Agent)

### Task 1: Install Fonts and Update CSS Tokens

**Files:**
- Modify: `web/package.json` (dependencies)
- Modify: `web/src/app/App.css` (full rewrite of tokens and imports)

- [ ] **Step 1: Install new font packages and remove old one**

```bash
cd web
npm uninstall @fontsource-variable/geist
npm install @fontsource-variable/urbanist @fontsource/dm-sans
```

- [ ] **Step 2: Verify package.json changes**

```bash
cd web && cat package.json | grep -E "fontsource|urbanist|dm-sans"
```

Expected: `@fontsource-variable/urbanist` and `@fontsource/dm-sans` present, `@fontsource-variable/geist` absent.

- [ ] **Step 3: Update App.css — font imports**

In `web/src/app/App.css`, replace line 4:

```css
/* OLD */
@import "@fontsource-variable/geist";

/* NEW */
@import "@fontsource-variable/urbanist";
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
@import "@fontsource/dm-sans/600.css";
```

- [ ] **Step 4: Update App.css — @theme inline block**

Replace the `--font-heading` and `--font-sans` lines (lines 9-10) and add new color token registrations:

```css
@theme inline {
    --font-heading: 'Urbanist Variable', sans-serif;
    --font-sans: 'DM Sans', sans-serif;
    --color-border-strong: var(--border-strong);
    --color-cta: var(--cta);
    /* ... rest of existing --color-* mappings unchanged ... */
```

Add `--color-border-strong` and `--color-cta` lines right after the font lines, before `--color-sidebar-ring`.

- [ ] **Step 5: Update App.css — radius scale to zero**

Replace all `--radius-*` lines in the `@theme inline` block (lines 53-59):

```css
    --radius-sm: 0px;
    --radius-md: 0px;
    --radius-lg: 0px;
    --radius-xl: 0px;
    --radius-2xl: 0px;
    --radius-3xl: 0px;
    --radius-4xl: 0px;
```

And in `:root`, replace `--radius: 0.625rem;` (line 97) with:

```css
    --radius: 0px;
```

- [ ] **Step 6: Update App.css — :root light mode token values**

In the `:root` block, update these values:

```css
    --foreground: oklch(0 0 0);
    --card-foreground: oklch(0 0 0);
    --popover-foreground: oklch(0 0 0);
    --primary: oklch(0 0 0);
    --primary-foreground: oklch(1 0 0);
    --secondary-foreground: oklch(0 0 0);
    --accent-foreground: oklch(0 0 0);
```

Add the new tokens at the end of `:root`, before the closing `}`:

```css
    --border-strong: oklch(0.07 0 0);
    --cta: oklch(0.546 0.245 262.88);
```

- [ ] **Step 7: Update App.css — .dark mode token values**

In the `.dark` block, update these values:

```css
    --background: oklch(0 0 0);
    --foreground: oklch(1 0 0);
    --card: oklch(0.05 0 0);
    --card-foreground: oklch(1 0 0);
    --popover: oklch(0.05 0 0);
    --popover-foreground: oklch(1 0 0);
    --primary: oklch(1 0 0);
    --primary-foreground: oklch(0 0 0);
    --secondary-foreground: oklch(1 0 0);
    --accent-foreground: oklch(1 0 0);
    --border: oklch(1 0 0 / 12%);
```

Add the new tokens at the end of `.dark`, before the closing `}`:

```css
    --border-strong: oklch(0.85 0 0);
    --cta: oklch(0.637 0.237 261.35);
```

- [ ] **Step 8: Verify the build compiles**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
cd web && git add -A && git commit -m "feat(css): swap fonts to Urbanist + DM Sans, add Swiss tokens"
```

---

### Task 2: Update Shared UI Components — Button, Card, Input, Badge

**Files:**
- Modify: `web/src/shared/ui/button.tsx`
- Modify: `web/src/shared/ui/card.tsx`
- Modify: `web/src/shared/ui/input.tsx`
- Modify: `web/src/shared/ui/badge.tsx`

- [ ] **Step 1: Update button.tsx — add CTA variant, update focus ring**

In the base classes string of `buttonVariants` (line 7), replace:

```
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

with:

```
focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30
```

Add the `cta` variant to the `variant` object after `destructive` (line 19):

```typescript
cta: "bg-cta text-white font-heading font-bold uppercase tracking-widest [a]:hover:bg-cta/80",
```

In the `xs` and `sm` size variants (lines 25-26), remove the `rounded-[min(var(--radius-md),10px)]` and `rounded-[min(var(--radius-md),12px)]` — these will resolve to `rounded-[0px]` due to the CSS variable change but the explicit classes are now unnecessary. Replace them with nothing (delete those `rounded-*` fragments from the size strings). Same for `icon-xs` (line 30) and `icon-sm` (line 31).

Also in the `outline` variant (line 12), replace `border-border` with `border-[1.5px] border-border-strong`. Remove `dark:border-input dark:bg-input/30 dark:hover:bg-input/50` — the Swiss system doesn't use separate dark input borders:

```typescript
outline:
  "border-[1.5px] border-border-strong bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
```

- [ ] **Step 2: Update card.tsx — remove ring/rounded, add structural border**

In the `Card` component (line 15), replace the entire className string:

```typescript
"group/card flex flex-col gap-4 overflow-hidden py-4 text-sm text-card-foreground border-t-2 border-border-strong has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0"
```

Key changes: removed `rounded-xl`, removed `ring-1 ring-foreground/10`, removed `bg-card` (cards are now transparent containers), added `border-t-2 border-border-strong`, removed `*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl`.

In `CardHeader` (line 28), remove `rounded-t-xl` from the className. Add `pt-4` to the existing classes:

```typescript
"group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-4 pt-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3"
```

In `CardFooter` (line 87), remove `rounded-b-xl`:

```typescript
"flex items-center border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3"
```

- [ ] **Step 3: Update input.tsx — border weight and focus ring**

In the `Input` component (line 12), replace the className. Key changes:

- Remove `rounded-lg`
- Replace `border border-input` with `border-[1.5px] border-border-strong`
- Replace `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` with `focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30`
- Remove `dark:bg-input/30 dark:disabled:bg-input/80`

```typescript
"h-8 w-full min-w-0 border-[1.5px] border-border-strong bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
```

- [ ] **Step 4: Update badge.tsx — remove rounded-4xl**

In `badgeVariants` (line 8), replace `rounded-4xl` with nothing (remove it — the global radius reset handles this, but `rounded-4xl` would still compute to `0px`. Cleaner to remove it explicitly).

Replace the base string:

```typescript
"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!"
```

(Only change: removed `rounded-4xl`)

- [ ] **Step 5: Verify the build compiles**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/shared/ui/button.tsx src/shared/ui/card.tsx src/shared/ui/input.tsx src/shared/ui/badge.tsx && git commit -m "feat(ui): update Button, Card, Input, Badge for Swiss design"
```

---

### Task 3: Update Shared UI Components — Sheet, Dialog, AlertDialog, Tabs

**Files:**
- Modify: `web/src/shared/ui/sheet.tsx`
- Modify: `web/src/shared/ui/dialog.tsx`
- Modify: `web/src/shared/ui/alert-dialog.tsx`
- Modify: `web/src/shared/ui/tabs.tsx`

- [ ] **Step 1: Update sheet.tsx — border treatment**

In `SheetContent` (line 54), within the className string, make these changes:
- Replace `shadow-lg` with nothing (remove it)
- Replace `data-[side=bottom]:border-t` with `data-[side=bottom]:border-t-2 data-[side=bottom]:border-border-strong`

The key fragment to find and replace within the long className:

Find: `shadow-lg`
Replace with: (empty — delete it)

Find: `data-[side=bottom]:border-t `
Replace with: `data-[side=bottom]:border-t-2 data-[side=bottom]:border-border-strong `

- [ ] **Step 2: Update dialog.tsx — border treatment, remove shadow and rounded**

In `DialogContent` (line 54), replace the className:

```typescript
"fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 bg-popover p-4 text-sm text-popover-foreground border-2 border-border-strong duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

Key changes: removed `rounded-xl`, removed `ring-1 ring-foreground/10`, added `border-2 border-border-strong`.

In `DialogFooter` (line 103), remove `rounded-b-xl`:

```typescript
"-mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-muted/50 p-4 sm:flex-row sm:justify-end"
```

- [ ] **Step 3: Update alert-dialog.tsx — remove rounded and ring**

In `AlertDialogContent` (line 55), replace the className:

```typescript
"group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 bg-popover p-4 text-popover-foreground border-2 border-border-strong duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

Key changes: removed `rounded-xl`, removed `ring-1 ring-foreground/10`, added `border-2 border-border-strong`.

In `AlertDialogFooter` (line 88), remove `rounded-b-xl`:

```typescript
"-mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end"
```

In `AlertDialogMedia` (line 104), remove `rounded-md`:

```typescript
"mb-2 inline-flex size-10 items-center justify-center bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6"
```

- [ ] **Step 4: Update tabs.tsx — active underline to primary**

In `tabsListVariants` (line 25), in the base string, remove `rounded-lg`:

```typescript
"group/tabs-list inline-flex w-fit items-center justify-center p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none"
```

(Remove `rounded-lg` — the radius reset covers it, but `data-[variant=line]:rounded-none` can stay for specificity.)

In `TabsTrigger` (line 59), make these changes in the className:

- Remove `rounded-md`
- Replace `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` with `focus-visible:ring-2 focus-visible:ring-cta/30`
- Remove `group-data-[variant=default]/tabs-list:data-active:shadow-sm` (no shadows in Swiss system)
- Remove `focus-visible:outline-1 focus-visible:outline-ring`

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd web && git add src/shared/ui/sheet.tsx src/shared/ui/dialog.tsx src/shared/ui/alert-dialog.tsx src/shared/ui/tabs.tsx && git commit -m "feat(ui): update Sheet, Dialog, AlertDialog, Tabs for Swiss design"
```

---

### Task 4: Update App Shell (Nav, Toaster, ScrollArea) and Verify Full Foundation

**Files:**
- Modify: `web/src/app/App.tsx`
- Modify: `web/src/shared/ui/scroll-area.tsx`

- [ ] **Step 1: Update bottom nav — border, focus, active indicator**

In `Shell` (line 76), replace the `<nav>` className:

```tsx
<nav
  className="border-t-2 border-border-strong bg-background pb-[env(safe-area-inset-bottom)]"
  role="navigation"
  aria-label="Main navigation"
>
```

Update the `NavLink` className function (line 87) to add focus ring and blue square indicator:

```tsx
className={({ isActive }) =>
  `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-cta/30 outline-none ${
    isActive
      ? "text-primary font-semibold"
      : "text-muted-foreground hover:text-foreground"
  }`
}
```

After the `<span>{label}</span>` inside each NavLink (line 96), add the active indicator:

```tsx
<Icon className="h-5 w-5" />
<span>{label}</span>
```

becomes:

```tsx
{({ isActive }) => (
  <>
    <Icon className="h-5 w-5" />
    <span>{label}</span>
    {isActive && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-3 bg-cta" />}
  </>
)}
```

Note: NavLink accepts a render function as children. The current code uses static children, so refactor the NavLink to use the render-function form for both `className` and `children`.

- [ ] **Step 2: Update scroll-area.tsx — remove rounded thumb**

In `ScrollArea` viewport (line 18), remove `rounded-[inherit]`:

```tsx
className="size-full transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
```

In `ScrollBar` thumb (line 46), remove `rounded-full`:

```tsx
className="relative flex-1 bg-border"
```

- [ ] **Step 2: Update Toaster with Swiss styling**

In the `App` component (line 146), update the `Toaster`:

```tsx
<Toaster
  position="top-center"
  richColors
  closeButton
  duration={3000}
  toastOptions={{
    className: "!rounded-none !border-2 !border-border-strong !shadow-none font-sans",
  }}
/>
```

The `!` prefix ensures these Tailwind utilities override Sonner's default inline styles.

- [ ] **Step 3: Run full build and lint**

```bash
cd web && npm run build && npm run lint
```

Expected: Both pass with no errors.

- [ ] **Step 4: Run the test suite**

```bash
cd web && npx vitest --run
```

Expected: All tests pass. These are visual-only changes — no logic was modified.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/app/App.tsx && git commit -m "feat(shell): update nav border and toaster for Swiss design"
```

---

## Phase 2: Feature Screens (Parallel — 4 Independent Agents)

> **Dispatch all 4 tasks as parallel agents.** Zero file overlap between tasks.

---

### Task 5: Today Screen (Agent A)

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/features/today/DaySelector.tsx`
- Modify: `web/src/features/today/DayPreview.tsx`
- Modify: `web/src/features/today/LastSessionCard.tsx`

- [ ] **Step 1: Update DaySelector.tsx — butted rectangular pills with subtitle**

Replace the entire `DaySelector` component. The pills now show only day IDs (letters), are butted together with shared borders, and a subtitle is added above:

```tsx
import type { Routine } from "@/domain/types";

interface DaySelectorProps {
  routine: Routine;
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DaySelector({
  routine,
  selectedDayId,
  onSelectDay,
}: DaySelectorProps) {
  const selectedDay = routine.days[selectedDayId];
  const selectedLabel = selectedDay?.label ?? selectedDayId;

  return (
    <div className="space-y-3">
      {/* Day subtitle */}
      <p className="text-xs font-semibold uppercase tracking-widest text-cta">
        Day {selectedDayId} — {selectedLabel}
      </p>

      {/* Structural rule */}
      <div className="border-t-2 border-border-strong" />

      {/* Day pills — butted together */}
      <div className="flex overflow-x-auto scrollbar-none -mx-5 px-5">
        {routine.dayOrder.map((dayId, i) => {
          const isSelected = dayId === selectedDayId;
          const isSuggested = dayId === routine.nextDayId;

          return (
            <button
              key={dayId}
              onClick={() => onSelectDay(dayId)}
              className={`relative shrink-0 px-4 py-2 text-sm font-semibold transition-colors border-[1.5px] border-border-strong focus-visible:ring-2 focus-visible:ring-cta/30 ${
                i > 0 ? "-ml-[1.5px]" : ""
              } ${
                isSelected
                  ? "bg-primary text-primary-foreground z-10"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{dayId}</span>
              {isSuggested && !isSelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cta" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Key changes: pills show day ID only, subtitle shows full label with `text-cta`, structural 2px rule added, pills are butted with `-ml-[1.5px]`, `rounded-full` removed, suggested dot → square, `bg-info` → `bg-primary`, padding updated to `p-5` width (`-mx-5 px-5`).

- [ ] **Step 2: Update DayPreview.tsx — exercise names and borders**

In `DayPreview` (line 35), add row separators and change exercise row classes:

Exercise row div (line 35): Add `border-b border-border` to the className:

Find: `flex items-baseline justify-between gap-2`
Replace with: `flex items-baseline justify-between gap-2 border-b border-border py-1`

Exercise name (line 36):

Find: `text-sm font-medium truncate`
Replace with: `text-sm font-semibold uppercase tracking-wide truncate`

Find: `border-l-2 border-info/30 pl-3 space-y-1` (line 47)
Replace with: `border-l-2 border-cta pl-4 space-y-1`

In the superset items (line 50), same exercise name change:

Find the second `text-sm font-medium truncate` (line 51)
Replace with: `text-sm font-semibold uppercase tracking-wide truncate`

Replace `<Card>` wrapping with plain div (card chrome handled by top border):

Find: `<Card>` (line 30) and `</Card>` (line 63)
Replace with: `<div className="border-t border-border-strong pt-3">` and `</div>`

Remove the `CardContent` wrapper — replace with plain div:

Find: `<CardContent className="py-3 space-y-1.5">` (line 31) and `</CardContent>` (line 61)
Replace with: `<div className="space-y-1.5">` and `</div>`

Remove the Card and CardContent imports (line 2).

- [ ] **Step 3: Update LastSessionCard.tsx — border treatment**

Replace the container div className (line 26):

Find: `rounded-lg border bg-muted/30 px-3 py-2`
Replace with: `border-t-2 border-border-strong px-3 py-2`

- [ ] **Step 4: Update TodayScreen.tsx — typography, spacing, resume card, cardio block**

Screen padding: Replace `p-4 space-y-4` (line 107) with `p-5 space-y-4`.

Title typography (line 108): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Repeat for the empty state title (line 56): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Empty state padding (line 55): Replace `gap-4 p-4` with `gap-4 p-5`.

Active session (Resume Workout card) — line 74: The Card component no longer has ring-based borders from Task 2. Update the Card's className to add explicit info border: Replace `className="border-info bg-info-soft hover:bg-info-soft/80 transition-colors"` with `className="border border-info bg-info-soft hover:bg-info-soft/80 transition-colors"`. The explicit `border` adds 1px on all sides with the info color. The Card's base `border-t-2 border-border-strong` is overridden by `border border-info` via Tailwind Merge.

Cardio block (line 119): Replace `rounded-lg bg-muted p-3` with `bg-muted p-3` (remove `rounded-lg`).

Start Workout button (line 145): Replace the `<Button>` with the CTA variant:

```tsx
<Button variant="cta" className="w-full" size="lg" onClick={handleStart} disabled={starting}>
  {starting ? "Starting..." : "Start Workout"}
</Button>
```

Footer border (line 144): Replace `border-t bg-background p-4` with `border-t-2 border-border-strong bg-background p-5`.

Active session container padding (line 72): Replace `p-4` with `p-5`.

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd web && git add src/features/today/ && git commit -m "feat(today): apply Swiss design to Today screen"
```

---

### Task 6: Workout Screen (Agent B)

**Files:**
- Modify: `web/src/features/workout/WorkoutScreen.tsx`
- Modify: `web/src/features/workout/ExerciseCard.tsx`
- Modify: `web/src/features/workout/SetSlot.tsx`
- Modify: `web/src/features/workout/SupersetGroup.tsx`
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/src/features/workout/ExercisePicker.tsx`
- Modify: `web/src/features/workout/WorkoutFooter.tsx`

- [ ] **Step 1: Update WorkoutScreen.tsx — header and spacing**

Empty state title (line 43): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Empty state padding (line 42): Replace `gap-2 p-4` with `gap-2 p-5`.

Sticky header (line 156): Replace `bg-background border-b px-4 py-3` with `bg-background border-b-2 border-border-strong px-5 py-3`.

Header — **swap the visual hierarchy**. Currently the `<h1>` shows `dayLabelSnapshot` and the `<p>` shows `routineNameSnapshot`. Per spec, the routine name should be the big Urbanist title and the day label should be the small blue uppercase subtitle. Replace:

```tsx
<h1 className="text-lg font-bold truncate">
  {session.dayLabelSnapshot}
</h1>
<p className="text-xs text-muted-foreground truncate">
  {session.routineNameSnapshot}
</p>
```

with:

```tsx
<p className="text-xs font-semibold uppercase tracking-widest text-cta truncate">
  {session.dayLabelSnapshot}
</p>
<h1 className="text-2xl font-extrabold tracking-tight font-heading truncate">
  {session.routineNameSnapshot}
</h1>
```

Scrollable body (line 166): Replace `p-4 space-y-3` with `p-5 space-y-3`.

- [ ] **Step 2: Update ExerciseCard.tsx — exercise names, block labels, card treatment**

Card className (line 91): Replace `readOnly ? "border-0 shadow-none bg-transparent" : undefined` with `readOnly ? "border-t border-border bg-transparent" : undefined`. This gives read-only cards (Session Detail) a lighter 1px separator instead of the structural 2px. The Card's base `border-t-2 border-border-strong` is overridden via Tailwind Merge.

Exercise name (line 97): Replace `text-base font-semibold truncate` with `text-sm font-semibold uppercase tracking-wide truncate`.

Unit toggle button (line 104): Replace `rounded-md border border-border px-2 py-0.5` with `border border-border-strong px-2 py-0.5`.

Block label span (line 134): Replace `rounded-md px-1.5 py-0.5` with `px-1.5 py-0.5` (remove rounded-md).

- [ ] **Step 3: Update SetSlot.tsx — sharp rectangles, green left-border**

Disabled empty slot (line 40): Replace `rounded-lg px-2` with `px-2`. Remove `rounded-lg`.

Active button (line 52): Replace `rounded-lg px-2` with `px-2`. Remove `rounded-lg`.

Logged state classes (line 53): Replace:
```
border border-success bg-success-soft text-success
```
with:
```
border-l-2 border-l-success border border-border bg-success-soft text-success
```

Unlogged state classes (line 55): Replace:
```
border border-border text-muted-foreground hover:bg-muted/50
```
with:
```
border border-border-strong text-muted-foreground hover:bg-muted/50
```

- [ ] **Step 4: Update SupersetGroup.tsx — cta border, uppercase label**

Replace the entire component (it's only 14 lines):

```tsx
import type { ReactNode } from "react";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-cta pl-4 space-y-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-cta">Superset</span>
      {children}
    </div>
  );
}
```

Changes: `border-info` → `border-cta`, `pl-3` → `pl-4`, `text-info font-medium` → `font-semibold uppercase tracking-widest text-cta`.

- [ ] **Step 5: Update SetLogSheet.tsx — CTA save button**

Save button (line 254): Add CTA variant:

```tsx
<Button variant="cta" className="w-full" size="lg" onClick={handleSave} disabled={saving}>
  Save
</Button>
```

- [ ] **Step 6: Update ExercisePicker.tsx — exercise rows, search input**

Exercise row button (line 87): Replace `rounded-lg hover:bg-muted/50` with `hover:bg-muted/50 border-b border-border` (remove rounded-lg, add row separator).

- [ ] **Step 7: Update WorkoutFooter.tsx — structural border**

Container (line 15): Replace `border-t bg-background p-4` with `border-t-2 border-border-strong bg-background p-5`.

Finish button — change to CTA variant:

```tsx
<Button variant="cta" className="flex-1" onClick={onFinish}>
  Finish Workout
</Button>
```

- [ ] **Step 8: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 9: Commit**

```bash
cd web && git add src/features/workout/ && git commit -m "feat(workout): apply Swiss design to Workout screen"
```

---

### Task 7: History Screens (Agent C)

**Files:**
- Modify: `web/src/features/history/HistoryScreen.tsx`
- Modify: `web/src/features/history/SessionCard.tsx`
- Modify: `web/src/features/history/SessionDetailScreen.tsx`
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx`

- [ ] **Step 1: Update HistoryScreen.tsx — typography, spacing**

Empty state title (line 12): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Empty state padding (line 11): Replace `gap-2 p-4` with `gap-2 p-5`.

List padding (line 21): Replace `p-4 space-y-2` with `p-5 space-y-2`.

List title (line 22): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

- [ ] **Step 2: Update SessionCard.tsx — sharp card, badge colors**

Card link (line 30): Replace `rounded-lg border p-3` with `border-t border-border-strong p-3` (remove rounded-lg, change to top border).

Day badge (line 34): Replace `bg-info-soft text-info` with `bg-cta text-white`.

Routine name text (line 38): Replace `text-sm font-medium truncate` with `text-base font-semibold truncate`.

- [ ] **Step 3: Update SessionDetailScreen.tsx — typography, spacing, unlogged slots**

Padding (line 124): Replace `p-4 space-y-4` with `p-5 space-y-4`.

Not-found padding (line 32): Replace `p-4` with `p-5`.

Title (line 130): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Exercise name link (line 205): Replace `text-base font-semibold hover:underline` with `text-sm font-semibold uppercase tracking-wide hover:underline`.

- [ ] **Step 4: Update ExerciseHistoryScreen.tsx — typography, spacing, structural borders**

Padding (line 45): Replace `p-4 space-y-4` with `p-5 space-y-4`.

Title (line 53): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Session group header (line 63): Replace `text-xs text-muted-foreground tabular-nums` with `text-xs font-semibold uppercase tracking-widest text-muted-foreground tabular-nums`.

Session group container (line 62): Add a top border. Replace `className="space-y-1"` with `className="space-y-1 border-t-2 border-border-strong pt-2"`.

Block separator (line 87): Replace `border-t border-border/50` with `border-t border-border`.

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd web && git add src/features/history/ && git commit -m "feat(history): apply Swiss design to History screens"
```

---

### Task 8: Settings Screen (Agent D)

**Files:**
- Modify: `web/src/features/settings/SettingsScreen.tsx`
- Modify: `web/src/features/settings/RoutineList.tsx`
- Modify: `web/src/features/settings/RoutineImporter.tsx`

- [ ] **Step 1: Update SettingsScreen.tsx — typography, spacing, segmented controls, error blocks**

Padding (line 99): Replace `p-4 space-y-6` with `p-5 space-y-8`.

Title (line 100): Replace `text-xl font-bold` with `text-2xl font-extrabold tracking-tight font-heading`.

Units segmented control (line 128): Replace `flex rounded-lg border overflow-hidden` with `flex overflow-hidden`:

```tsx
<div className="flex overflow-hidden">
  {unitOptions.map((u, i) => (
    <button
      key={u}
      onClick={() => handleUnits(u)}
      className={`flex-1 py-2 text-sm font-medium transition-colors border-[1.5px] border-border-strong ${
        i > 0 ? "-ml-[1.5px]" : ""
      } ${
        settings.units === u
          ? "bg-primary text-primary-foreground z-10"
          : "hover:bg-muted"
      }`}
    >
      {u}
    </button>
  ))}
</div>
```

Theme segmented control (line 146): Same pattern:

```tsx
<div className="flex overflow-hidden">
  {themeOptions.map((t, i) => (
    <button
      key={t}
      onClick={() => handleTheme(t)}
      className={`flex-1 py-2 text-sm font-medium capitalize transition-colors border-[1.5px] border-border-strong ${
        i > 0 ? "-ml-[1.5px]" : ""
      } ${
        settings.theme === t
          ? "bg-primary text-primary-foreground z-10"
          : "hover:bg-muted"
      }`}
    >
      {t}
    </button>
  ))}
</div>
```

Import error block (line 196): Replace `rounded-lg border border-warning` with `border border-warning` (remove rounded-lg).

- [ ] **Step 2: Update RoutineList.tsx — row layout, badges**

Routine row (line 48): Replace `rounded-lg border p-3` with `border-b border-border p-3` (remove rounded-lg, change to bottom border separator).

Active badge (line 55): Replace `bg-info-soft text-info` with `bg-cta text-white`.

- [ ] **Step 3: Update RoutineImporter.tsx — error block**

Error block (line 64): Replace `rounded-lg border border-warning` with `border border-warning` (remove rounded-lg).

- [ ] **Step 4: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 5: Run full test suite**

```bash
cd web && npx vitest --run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/features/settings/ && git commit -m "feat(settings): apply Swiss design to Settings screen"
```

---

## Post-Phase 2: Final Verification

After all 4 parallel agents complete:

- [ ] **Run full build**: `cd web && npm run build`
- [ ] **Run full test suite**: `cd web && npx vitest --run`
- [ ] **Run lint**: `cd web && npm run lint`
- [ ] **Residue audit** — search for leftover old-style classes that should have been removed:

```bash
cd web && npx rg -n "rounded-xl|rounded-lg|rounded-full|rounded-md|rounded-4xl|shadow-sm|shadow-lg|ring-1 ring-foreground|focus-visible:border-ring|focus-visible:ring-3|focus-visible:ring-ring" src/app src/shared src/features
```

Expected: No matches (or only in scroll-area thumb / contexts that are intentionally unchanged).

- [ ] **Visual spot-check**: `cd web && npm run dev` — open on localhost:5173 and check light + dark modes on all 4 main tabs

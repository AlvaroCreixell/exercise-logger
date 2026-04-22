# Sprint 6 — Foundation ("Warm Paper") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Exercise Logger visual foundation to the warm-paper/sage oklch palette, Inter + Instrument Serif fonts, a custom SVG icon set, and re-skinned shared primitives — delivered as one atomic PR to `main`. After Sprint 6, every screen renders coherently on the new tokens without any screen-level redesign.

**Architecture:** Replace the shadcn/Urbanist/DM Sans foundation in `web/src/app/App.css` with the handoff oklch palette + Inter/Instrument Serif via `@fontsource/*` npm packages (matches existing `@fontsource/dm-sans` pattern). Introduce `web/src/shared/icons/` with 12 custom SVG components hand-ported from `docs/claude_design_handoffs/components/screens.jsx`. Swap Lucide imports only inside the primitives that are already being re-skinned here (`Sheet`, `Dialog`); leave all other Lucide call sites for per-screen sprints 7–11. Reskin shared primitives (`Button`, `Card`, `Sheet`, `Dialog`, `SectionHeader`, `Stat`, `Pill`, `EmptyState`, `BlockStripe`) **in place** — no variant renames — and migrate the 3 `variant="cta"` call sites to `default`. Re-point the legacy shadcn token roles (`--primary`, `--card`, `--foreground`, …) at the new palette values so non-primitive screens keep working on their pre-Sprint-7 layouts until their own sprints land.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Tailwind 4 (CSS-first config), `@base-ui/react`, `@fontsource/*`, Vitest + React Testing Library, Playwright, vite-plugin-pwa.

**Source spec:** `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` (§3 Sprint 6, §4 cross-cutting, §6 pre-decisions).

**Baseline:** 527 tests passing on `refactor/handoff-theme-and-workout-complete`. That branch merges first; Sprint 6 forks `sprint-6-foundation` off `main`.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `web/src/shared/icons/index.ts` | Barrel export of all 12 custom icons + shared `<IconSvg>` primitive |
| `web/src/shared/icons/IconSvg.tsx` | Shared SVG wrapper: accepts `size`, `strokeWidth`, `className`, `aria-label`; sets `role="img"` when labelled, `aria-hidden="true"` otherwise |
| `web/src/shared/icons/Check.tsx` | Check icon (16px default, stroke 3) |
| `web/src/shared/icons/Close.tsx` | X icon (18px default, stroke 2) |
| `web/src/shared/icons/Chevron.tsx` | Chevron with `direction` prop: `"right"` \| `"left"` \| `"up"` \| `"down"` (18px default, stroke 2) |
| `web/src/shared/icons/Back.tsx` | Left-arrow + line (22px default, stroke 1.8) |
| `web/src/shared/icons/Plus.tsx` | Plus (20px default, stroke 2) |
| `web/src/shared/icons/Play.tsx` | Filled triangle (14px default) |
| `web/src/shared/icons/Flame.tsx` | Filled flame (13px default) |
| `web/src/shared/icons/Dumbbell.tsx` | Dumbbell outline (18px default, stroke 1.6) |
| `web/src/shared/icons/Search.tsx` | Magnifier (18px default, stroke 1.8) |
| `web/src/shared/icons/Trash.tsx` | Trash-can outline (16px default, stroke 1.8) |
| `web/src/shared/icons/Grid.tsx` | 2×2 grid (18px default, stroke 1.6) |
| `web/src/shared/icons/Graph.tsx` | Bar/line chart glyph (18px default, stroke 1.6) |
| `web/tests/unit/shared/icons/icons.test.tsx` | Shape: every icon renders an `<svg>`, respects `size`, sets a11y attrs |

### Modified files

| Path | Change |
|---|---|
| `web/package.json` | Add `@fontsource/inter`, `@fontsource/instrument-serif`; remove `@fontsource-variable/urbanist`, `@fontsource/dm-sans` |
| `web/src/app/App.css` | Replace `:root` palette, add motion + radius tokens, rewrite typography utilities, swap `--font-sans` + `--font-heading`, remove `--cta`, keep legacy-role tokens re-pointed at new palette, retire `flash-logged`? **No — retire in Sprint 10** |
| `web/src/app/shadcn-compat.css` | Audit — no changes expected (helpers are behavioural, not palette) |
| `web/index.html` | Update `<meta name="theme-color">` from `#09090b` → `#FCFAF5`; add `<link rel="preload">` for Inter 400/500/600 + Instrument Serif 400 |
| `web/src/shared/ui/button.tsx` | Drop `cta` variant, retune `default`/`outline`/`secondary`/`ghost`/`destructive`/`link` using new tokens; adjust `size` radii to 12px |
| `web/src/shared/ui/card.tsx` | 18px radius, hairline `--line` border, `--card` background |
| `web/src/shared/ui/sheet.tsx` | 24px top radius, `slideUp` animation, swap Lucide `X` for `Close` icon from `@/shared/icons` |
| `web/src/shared/ui/dialog.tsx` | `popIn` animation, swap Lucide `X` for `Close` icon from `@/shared/icons` |
| `web/src/shared/components/SectionHeader.tsx` | Eyebrow typography (11px uppercase, 0.08em tracking); serif title option |
| `web/src/shared/components/Stat.tsx` | Tabular numerals, ink + ink-3 split, 18px radius |
| `web/src/shared/components/Pill.tsx` | Sage-soft selected state, 999px radius |
| `web/src/shared/components/EmptyState.tsx` | Serif heading, paper background, swap Lucide Dumbbell for custom icon (only if it's the only icon used — otherwise defer) |
| `web/src/features/workout/BlockStripe.tsx` | Use `--line` + `--ink-3`; keep behaviour |
| `web/src/features/today/TodayScreen.tsx` | Migrate `variant="cta"` → `variant="default"` |
| `web/src/features/workout/SetLogSheet.tsx` | Migrate `variant="cta"` → `variant="default"` |
| `web/src/features/workout/WorkoutFooter.tsx` | Migrate `variant="cta"` → `variant="default"` |
| `CLAUDE.md` | Test count 530 → 527; refresh any token/font refs |
| `web/src/domain/CLAUDE.md`, `web/src/db/CLAUDE.md`, `web/src/services/CLAUDE.md` | Scan for token/font drift — likely no-op |

### Out of scope for this plan (spec §3 Sprint 6 "Out of scope")

- Screen layouts — every screen keeps its current layout; only its primitives re-skin.
- Lucide import swaps outside `Sheet` and `Dialog` — deferred to Sprints 7–11 as each screen is touched.
- SetLogSheet keypad redesign — Sprint 11.
- `flash-logged` animation retirement — Sprint 10.

---

## Task 0: Branch setup + baseline check

**Files:** none

- [ ] **Step 1: Confirm `refactor/handoff-theme-and-workout-complete` has merged to `main`**

Run: `git fetch origin && git log --oneline origin/main | head -5`
Expected: top of log shows `be92593 feat(workout): add "all sets logged" terminal state to footer` (or a merge commit that contains it).

If not yet merged, stop and merge that branch first. Sprint 6 forks off `main`, not off the open branch.

- [ ] **Step 2: Fork `sprint-6-foundation` off `main`**

Run:
```bash
git checkout main
git pull --ff-only origin main
git checkout -b sprint-6-foundation
```

- [ ] **Step 3: Run the full test suite to confirm a green baseline**

Run (from `web/`):
```bash
npm test
```
Expected: `Tests  527 passed (527)`. If this count differs, stop and investigate before proceeding — every subsequent task uses 527 as the reference.

- [ ] **Step 4: Commit nothing — this is an orientation task**

No commit.

---

## Task 1: Install Inter + Instrument Serif via @fontsource

**Files:**
- Modify: `web/package.json`
- Modify: `web/package-lock.json` (auto)
- Modify: `web/src/app/App.css` (add imports; legacy imports remain until Task 13)

- [ ] **Step 1: Install the new font packages**

Run (from `web/`):
```bash
npm install @fontsource/inter @fontsource/instrument-serif
```

Expected: two packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Add the weight-specific CSS imports to App.css**

Edit `web/src/app/App.css`. Add after the existing `@fontsource` imports (around line 7):

```css
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";
@import "@fontsource/instrument-serif/400.css";
@import "@fontsource/instrument-serif/400-italic.css";
```

Keep the existing `@fontsource-variable/urbanist` and `@fontsource/dm-sans` imports in place for now — Task 13 removes them.

- [ ] **Step 3: Verify the dev build loads without font errors**

Run (from `web/`):
```bash
npm run build
```
Expected: build succeeds; no `Failed to resolve import "@fontsource/inter/400.css"` error in output.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/src/app/App.css
git commit -m "feat(fonts): install Inter + Instrument Serif via @fontsource"
```

---

## Task 2: Add the new oklch palette alongside the legacy tokens

**Files:** Modify: `web/src/app/App.css`

This task adds the new palette but does NOT remove the legacy tokens yet. Nothing visual changes in this commit — we're just making the new values available to the primitives in later tasks.

- [ ] **Step 1: Write the new palette block into `:root`**

Edit `web/src/app/App.css`. In the existing `:root { … }` block (around line 68), **add** these declarations at the top (before the existing `--background`):

```css
    /* ─── Sprint 6: warm-paper palette (oklch) ─── */
    /* Surface */
    --paper: oklch(98.8% 0.008 80);
    --card-paper: oklch(96.8% 0.01 80);

    /* Ink */
    --ink: oklch(22% 0.012 55);
    --ink-2: oklch(38% 0.012 55);
    --ink-3: oklch(58% 0.01 60);

    /* Hairlines */
    --line: oklch(88% 0.012 75);
    --line-soft: oklch(93% 0.01 75);

    /* Accent — sage */
    --sage: oklch(55% 0.055 160);
    --sage-deep: oklch(40% 0.06 160);
    --sage-soft: oklch(93% 0.03 160);

    /* Semantic */
    --warm: oklch(55% 0.09 55);
    --danger: oklch(55% 0.15 25);
```

> **Why `--card-paper` instead of `--card`?** The legacy shadcn token `--card` is already defined in this `:root` and is consumed by Tailwind's `bg-card`. We'll re-point `--card` at `var(--card-paper)` in Task 3 once the new palette is in place. Using a separate name here avoids a redeclaration conflict inside the same block.

- [ ] **Step 2: Add Tailwind `@theme inline` mappings for the new tokens**

In the `@theme inline { … }` block (starts around line 9), **add** these entries (order doesn't matter; group at the top for readability):

```css
    /* Sprint 6: warm-paper palette */
    --color-paper: var(--paper);
    --color-card-paper: var(--card-paper);
    --color-ink: var(--ink);
    --color-ink-2: var(--ink-2);
    --color-ink-3: var(--ink-3);
    --color-line: var(--line);
    --color-line-soft: var(--line-soft);
    --color-sage: var(--sage);
    --color-sage-deep: var(--sage-deep);
    --color-sage-soft: var(--sage-soft);
    --color-warm: var(--warm);
    --color-danger: var(--danger);
```

These expose the new tokens as `bg-paper`, `text-ink`, `border-line`, `bg-sage-soft`, etc. throughout the app.

- [ ] **Step 3: Run the test suite to confirm nothing regresses**

Run (from `web/`):
```bash
npm test
```
Expected: `Tests  527 passed (527)`. (No tests consume these tokens yet — we're only adding.)

- [ ] **Step 4: Run lint to confirm CSS parses**

Run (from `web/`):
```bash
npm run lint && npm run build
```
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/App.css
git commit -m "feat(tokens): add warm-paper oklch palette alongside legacy shadcn tokens"
```

---

## Task 3: Re-point legacy shadcn token roles at the new palette

**Files:** Modify: `web/src/app/App.css`

Now every `bg-primary`, `bg-card`, `text-muted-foreground` in the codebase starts rendering with warm-paper colors, without any component file changing.

- [ ] **Step 1: Replace the values of the legacy `:root` tokens**

Edit `web/src/app/App.css`. In the existing `:root { … }` block, **replace** these specific declarations (keep all other lines untouched):

```css
    --background: var(--paper);
    --foreground: var(--ink);
    --card: var(--card-paper);
    --card-foreground: var(--ink);
    --popover: var(--paper);
    --popover-foreground: var(--ink);
    --primary: var(--ink);
    --primary-foreground: var(--paper);
    --secondary: var(--card-paper);
    --secondary-foreground: var(--ink);
    --muted: var(--card-paper);
    --muted-foreground: var(--ink-3);
    --accent: var(--sage-soft);
    --accent-foreground: var(--sage-deep);
    --destructive: var(--danger);
    --destructive-foreground: var(--paper);
    --destructive-soft: color-mix(in oklch, var(--danger) 10%, var(--paper));
    --border: var(--line);
    --input: var(--line);
    --ring: var(--sage);
    --success: var(--sage);
    --success-foreground: var(--paper);
    --success-soft: var(--sage-soft);
    --warning: var(--warm);
    --warning-foreground: var(--ink);
    --warning-soft: color-mix(in oklch, var(--warm) 12%, var(--paper));
    --accent-warm: var(--warm);
    --accent-warm-foreground: var(--ink);
    --accent-warm-soft: color-mix(in oklch, var(--warm) 12%, var(--paper));
    --border-strong: var(--ink);
```

Leave `--chart-1` through `--chart-5`, `--sidebar-*`, `--info*`, and `--radius` lines alone — no screen uses the chart/sidebar tokens in this app, and we'll touch `--radius` in Task 4.

- [ ] **Step 2: Delete the purple CTA token**

In the same `:root` block, **delete** the line:

```css
    --cta: oklch(0.546 0.245 262.88);
```

And **delete** its mapping inside `@theme inline { … }`:

```css
    --color-cta: var(--cta);
```

(Task 6 will remove the `Button` usage of `--color-cta`. Deleting here is safe because nothing reads these tokens outside that one variant, which renders correctly until Task 6 — the variant just uses the wrong color for one commit. If that's not acceptable, reorder: do Task 6 before Task 3 Step 2.)

- [ ] **Step 3: Run tests — classname-sensitive assertions may break**

Run (from `web/`):
```bash
npm test
```
Expected: most tests still pass. If some fail because they assert on literal color values (e.g. `toContain("oklch(0.546 0.245 262.88)")`), those assertions are now stale — update them to match the new values or convert to role-based assertions (e.g. `toHaveClass("bg-primary")`).

- [ ] **Step 4: Visually smoke-test**

Run:
```bash
npm run dev
```
Open `http://localhost:5173/exercise-logger/`. Expected: every screen now looks warm-paper-toned — white backgrounds replaced with `#fcfaf5`-ish cream, black text replaced with warm near-black, blue/purple accents replaced with sage. Primitives are unstyled at their new semantic level (borders may still be wrong radius; the Button still uses `cta` styling if the variant is invoked). Close the dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/App.css
git commit -m "feat(tokens): re-point legacy shadcn roles at warm-paper palette; drop --cta"
```

---

## Task 4: Add motion + radius tokens, rewrite typography utilities, swap font families

**Files:** Modify: `web/src/app/App.css`

- [ ] **Step 1: Add motion + radius tokens**

Edit `web/src/app/App.css`. After the existing `:root { --ease-out-soft: …; }` block (around line 171), **add** a new `:root` block (CSS allows multiple):

```css
/* Sprint 6 motion + radius */
:root {
  --dur-fadeIn: 300ms;
  --dur-fadeInUp: 300ms;
  --dur-slideUp: 250ms;
  --dur-popIn: 250ms;
  --ease-handoff: ease;

  --radius-card: 18px;
  --radius-sheet-top: 24px;
  --radius-set-logged: 12px;
  --radius-set-empty: 10px;
  --radius-pill: 999px;
  --radius-button: 12px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes fadeInUp { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp  { from, to { transform: none; } }
  @keyframes popIn    { from { opacity: 0; } to { opacity: 1; } }
}
```

- [ ] **Step 2: Swap the font-family variables**

In the `@theme inline { … }` block (around line 10-11), **replace**:

```css
    --font-heading: 'Urbanist Variable', sans-serif;
    --font-sans: 'DM Sans', sans-serif;
```

with:

```css
    --font-heading: 'Instrument Serif', ui-serif, Georgia, serif;
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
```

- [ ] **Step 3: Rewrite typography utilities in the `@layer utilities` block**

In the `@layer utilities { … }` block (around line 132), **replace** the whole block's contents with:

```css
  .text-hero-serif {
    font-family: var(--font-heading);
    font-weight: 400;
    font-size: 2rem;          /* 32px */
    line-height: 1.1;
    letter-spacing: -0.005em;
  }

  .text-title-serif {
    font-family: var(--font-heading);
    font-weight: 400;
    font-size: 1.375rem;      /* 22px */
    line-height: 1.15;
    letter-spacing: -0.005em;
  }

  .text-eyebrow {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.6875rem;     /* 11px */
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .text-body {
    font-family: var(--font-sans);
    font-weight: 400;
    font-size: 0.875rem;      /* 14px */
    line-height: 1.45;
  }

  .text-meta {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 0.75rem;       /* 12px */
    line-height: 1.3;
    color: var(--ink-3);
  }

  /* Preserved from pre-Sprint-6 — tabular numerals family for stat tiles + set rows */
  .text-value {
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 1.125rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  .text-value-sm {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.875rem;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  /* Back-compat alias — pre-Sprint-6 screens still reference .text-hero;
     now renders as serif hero. Delete in Sprint 7 once Today migrates. */
  .text-hero {
    font-family: var(--font-heading);
    font-weight: 400;
    font-size: 2.25rem;
    line-height: 1;
    letter-spacing: -0.005em;
  }
```

> **Why keep `.text-hero` as an alias?** Several screens still call `className="text-hero"`. Removing it before those screens migrate (Sprints 7–10) would blow up layouts mid-sprint. The alias re-points it to the new serif family; its removal rides along with Sprint 7's Today redesign.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 527 pass. If `.text-eyebrow` tracking change (0.12em → 0.08em) breaks any letter-spacing assertion, update the assertion.

- [ ] **Step 5: Smoke-test typography in the browser**

```bash
npm run dev
```
Verify: every screen now renders in Inter; any `.text-hero` usage renders in Instrument Serif. Close the server.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/App.css
git commit -m "feat(tokens): add motion + radius tokens, new typography utilities, swap fonts to Inter + Instrument Serif"
```

---

## Task 5: Scaffold `shared/icons/` with the shared `IconSvg` wrapper + smoke test

**Files:**
- Create: `web/src/shared/icons/IconSvg.tsx`
- Create: `web/tests/unit/shared/icons/icons.test.tsx`

We're adopting a shared wrapper so every icon renders identically (default props, accessibility) and the individual icon files stay small.

- [ ] **Step 1: Write the failing icon smoke test**

Create `web/tests/unit/shared/icons/icons.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IconSvg } from "@/shared/icons/IconSvg";

describe("IconSvg", () => {
  it("renders an svg element", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24" size={16}>
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("sets aria-hidden when no label is provided", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24">
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets role=img and aria-label when labelled", () => {
    const { container } = render(
      <IconSvg viewBox="0 0 24 24" aria-label="Close">
        <line x1="0" y1="0" x2="24" y2="24" />
      </IconSvg>
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Close");
    expect(svg?.getAttribute("aria-hidden")).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/unit/shared/icons/icons.test.tsx
```
Expected: FAIL with `Cannot find module '@/shared/icons/IconSvg'`.

- [ ] **Step 3: Implement `IconSvg`**

Create `web/src/shared/icons/IconSvg.tsx`:

```tsx
import type { ReactNode, SVGProps } from "react";

export interface IconSvgProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  strokeWidth?: number;
  viewBox: string;
  children: ReactNode;
}

export function IconSvg({
  size = 18,
  strokeWidth,
  viewBox,
  children,
  "aria-label": ariaLabel,
  ...rest
}: IconSvgProps) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
    >
      {children}
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/shared/icons/icons.test.tsx
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/icons/IconSvg.tsx web/tests/unit/shared/icons/icons.test.tsx
git commit -m "feat(icons): add shared IconSvg wrapper with a11y + tests"
```

---

## Task 6: Port the 12 custom icons from the handoff prototype

**Files:**
- Create: `web/src/shared/icons/{Check,Close,Chevron,Back,Plus,Play,Flame,Dumbbell,Search,Trash,Grid,Graph}.tsx`
- Create: `web/src/shared/icons/index.ts`
- Modify: `web/tests/unit/shared/icons/icons.test.tsx` (add a barrel-export shape test)

Source icons live in `docs/claude_design_handoffs/components/screens.jsx` around line 21 (`const Icon = { … }`). Grep for `const Icon = {` to find them. The spec lists: dumbbell, back, chevron, close, check, play, flame, plus, search, trash, grid, graph (12 icons). Source-object key → file name mapping:

| Source key | File | Notes |
|---|---|---|
| `dumb` | `Dumbbell.tsx` | stroke 1.6 |
| `back` | `Back.tsx` | stroke 1.8 |
| `chev(d)` | `Chevron.tsx` | Accepts `direction` prop (`right` default) |
| `x` | `Close.tsx` | stroke 2 |
| `check` | `Check.tsx` | stroke 3 |
| `play` | `Play.tsx` | filled |
| `flame` | `Flame.tsx` | filled |
| `plus` | `Plus.tsx` | stroke 2 |
| `search` | `Search.tsx` | stroke 1.8 |
| `del` | `Trash.tsx` | stroke 1.8 |
| `grid` | `Grid.tsx` | stroke 1.6 (see note below) |
| `history` or chart glyph | `Graph.tsx` | stroke 1.6 — see note |

> **`grid` / `graph` source paths.** The `Icon` object in `screens.jsx` is long; some entries may be after the lines we previewed. Run `grep -n "grid:\|graph:\|history:" docs/claude_design_handoffs/components/screens.jsx` to locate them. If the prototype uses `history` for the History tab and `graph` isn't defined, use the `history` SVG for `Graph.tsx` and a simple 2×2 squares grid for `Grid.tsx`.

- [ ] **Step 1: Write the barrel-export shape test first**

Append to `web/tests/unit/shared/icons/icons.test.tsx`:

```tsx
import * as Icons from "@/shared/icons";

describe("icon barrel", () => {
  it("exports all 12 custom icons + IconSvg", () => {
    const expected = [
      "IconSvg",
      "Check", "Close", "Chevron", "Back", "Plus", "Play",
      "Flame", "Dumbbell", "Search", "Trash", "Grid", "Graph",
    ];
    for (const name of expected) {
      expect(Icons).toHaveProperty(name);
      expect(typeof (Icons as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/shared/icons/icons.test.tsx
```
Expected: FAIL with `Cannot find module '@/shared/icons'`.

- [ ] **Step 3: Create `Check.tsx` as the reference implementation**

Create `web/src/shared/icons/Check.tsx`:

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Check({ size = 16, strokeWidth = 3, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <polyline points="20 6 9 17 4 12" />
    </IconSvg>
  );
}
```

- [ ] **Step 4: Create the remaining 11 icon files**

Follow the same shape. Port the exact SVG body from `screens.jsx` (the inner elements — `<line>`, `<path>`, `<polygon>`, `<rect>`, `<circle>`, etc. — and the default `size` / `strokeWidth`). Paths are inside the `Icon` object as inline JSX; copy the children verbatim into the `IconSvg` body.

**`Close.tsx`** (key `x` in source):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Close({ size = 18, strokeWidth = 2, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </IconSvg>
  );
}
```

**`Chevron.tsx`** (key `chev(d)` in source — the source takes a `direction` arg):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Direction = "right" | "left" | "up" | "down";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
  direction?: Direction;
};

const POINTS: Record<Direction, string> = {
  right: "9 18 15 12 9 6",
  left:  "15 18 9 12 15 6",
  down:  "6 9 12 15 18 9",
  up:    "18 15 12 9 6 15",
};

export function Chevron({
  size = 18,
  strokeWidth = 2,
  direction = "right",
  ...rest
}: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <polyline points={POINTS[direction]} />
    </IconSvg>
  );
}
```

**`Back.tsx`** (key `back`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Back({ size = 22, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconSvg>
  );
}
```

**`Plus.tsx`** (key `plus`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Plus({ size = 20, strokeWidth = 2, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </IconSvg>
  );
}
```

**`Play.tsx`** (key `play` — filled):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children">;

export function Play({ size = 14, ...rest }: Props) {
  return (
    <IconSvg size={size} viewBox="0 0 24 24" stroke="none" {...rest}>
      <polygon points="6 3 21 12 6 21 6 3" fill="currentColor" />
    </IconSvg>
  );
}
```

**`Flame.tsx`** (key `flame` — filled; path is long, copy verbatim from `screens.jsx`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children">;

export function Flame({ size = 13, ...rest }: Props) {
  return (
    <IconSvg size={size} viewBox="0 0 24 24" stroke="none" {...rest}>
      <path
        fill="currentColor"
        d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
      />
    </IconSvg>
  );
}
```

**`Dumbbell.tsx`** (key `dumb`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Dumbbell({ size = 18, strokeWidth = 1.6, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
    </IconSvg>
  );
}
```

**`Search.tsx`** — port from the `search` key in `screens.jsx`. If the source path is not visible in your local copy, use this fallback (feather-style magnifier):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Search({ size = 18, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" />
    </IconSvg>
  );
}
```

**`Trash.tsx`** (key `del`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Trash({ size = 16, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </IconSvg>
  );
}
```

**`Grid.tsx`** — 2×2 tiles (use this shape if no `grid` key exists in `screens.jsx`):

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Grid({ size = 18, strokeWidth = 1.6, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </IconSvg>
  );
}
```

**`Graph.tsx`** — use the prototype's `history` key (curved arrow + clock hand) if it maps to the History tab; otherwise use this line-chart fallback:

```tsx
import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Graph({ size = 18, strokeWidth = 1.6, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </IconSvg>
  );
}
```

- [ ] **Step 5: Create the barrel export**

Create `web/src/shared/icons/index.ts`:

```ts
export { IconSvg, type IconSvgProps } from "./IconSvg";
export { Check } from "./Check";
export { Close } from "./Close";
export { Chevron } from "./Chevron";
export { Back } from "./Back";
export { Plus } from "./Plus";
export { Play } from "./Play";
export { Flame } from "./Flame";
export { Dumbbell } from "./Dumbbell";
export { Search } from "./Search";
export { Trash } from "./Trash";
export { Grid } from "./Grid";
export { Graph } from "./Graph";
```

- [ ] **Step 6: Run the icon tests**

```bash
npx vitest run tests/unit/shared/icons/icons.test.tsx
```
Expected: all 4 tests pass (3 `IconSvg` behavioural + 1 barrel-export shape).

- [ ] **Step 7: Run full tests + build**

```bash
npm test && npm run build
```
Expected: 531 pass (527 previous + 4 new icon tests), build succeeds.

- [ ] **Step 8: Commit**

```bash
git add web/src/shared/icons/ web/tests/unit/shared/icons/
git commit -m "feat(icons): add 12 custom SVG icons ported from handoff prototype"
```

---

## Task 7: Reskin `Button` — drop `cta` variant, retune remaining variants

**Files:** Modify: `web/src/shared/ui/button.tsx`

- [ ] **Step 1: Update a classname-sensitive Button test first (TDD guard)**

Search for tests that assert on the `cta` variant:

```bash
grep -rn "variant=\"cta\"\|cta:" web/tests web/src --include="*.tsx" --include="*.ts"
```

If any test asserts the Button renders with `bg-cta` / `text-white` / `uppercase tracking-widest`, update it now to expect the new default styling (`bg-primary text-primary-foreground`) — or convert it to a semantic check (`toHaveAttribute("data-slot", "button")`). Commit the test change as part of this task so fail-first is visible.

If no such test exists, skip to Step 2.

- [ ] **Step 2: Reskin `button.tsx`**

Replace the contents of `web/src/shared/ui/button.tsx`:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-[var(--dur-base)] outline-none select-none focus-visible:ring-2 focus-visible:ring-sage/60 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Ink-on-paper primary — replaces the old purple CTA.
        default:
          "bg-primary text-primary-foreground [a]:hover:bg-primary/90 active:bg-primary/85",
        // Hairline outline on paper/card.
        outline:
          "border-[1px] border-line bg-background text-foreground hover:bg-card aria-expanded:bg-card",
        // Subtle filled chip (card tone).
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85 aria-expanded:bg-secondary",
        // Text-only, hover tints to card.
        ghost:
          "text-foreground hover:bg-card aria-expanded:bg-card",
        // Destructive text treatment — danger color, no fill.
        destructive:
          "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
        // Inline link inside body text.
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-4 text-[0.9rem]",
        icon: "size-10",
        "icon-xs":
          "size-7 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
```

Note the deliberate changes:
- Removed `cta` variant entirely.
- `default` now renders ink-on-paper, replacing the old purple CTA look.
- Radii moved to `rounded-[var(--radius-button)]` (12px token).
- Focus ring is sage.
- `size="default"` / `lg` / `icon` all grew 2px taller to hit 44pt touch targets and match the handoff's chunkier buttons.
- Removed dark-mode selectors (app is light-only).

- [ ] **Step 3: Verify TypeScript rejects `variant="cta"`**

Run:
```bash
npx tsc -b
```
Expected: **fails** with a TypeScript error at each of the 3 call sites (`TodayScreen.tsx`, `SetLogSheet.tsx`, `WorkoutFooter.tsx`) — something like `Type '"cta"' is not assignable to type '"default" | "outline" | … | null | undefined'`. **This is intentional** — Task 8 will migrate those call sites.

- [ ] **Step 4: Leave test suite running locally; do NOT commit yet**

Run `npm test` — expect failures from the typecheck-adjacent tests and from the 3 files that still pass `variant="cta"`. This is expected; Task 8 fixes them before commit.

Do NOT commit here — a broken intermediate state is fine within a task but not across task boundaries.

---

## Task 8: Migrate the 3 `variant="cta"` call sites to `variant="default"`

**Files:**
- Modify: `web/src/features/today/TodayScreen.tsx`
- Modify: `web/src/features/workout/SetLogSheet.tsx`
- Modify: `web/src/features/workout/WorkoutFooter.tsx`

- [ ] **Step 1: Replace `variant="cta"` with `variant="default"` in each file**

For each of the three files, run:

```bash
grep -n "variant=\"cta\"" web/src/features/today/TodayScreen.tsx \
  web/src/features/workout/SetLogSheet.tsx \
  web/src/features/workout/WorkoutFooter.tsx
```

Edit each line, replacing `variant="cta"` with `variant="default"`. If a call site also passes an explicit `className="bg-cta text-white uppercase"` or similar, delete that className — the new default variant ships these styles.

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b
```
Expected: clean (no errors).

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 531 pass (527 baseline + 4 icon tests). If any test asserts the CTA's old purple background or uppercase styling, update the assertion to reflect the new default appearance.

- [ ] **Step 4: Smoke-test in browser**

```bash
npm run dev
```
Walk through: Today's Start button, SetLogSheet's Save button, WorkoutFooter's Finish button. All three should render as ink-on-paper primary buttons with 12px radius. Close the server.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/ui/button.tsx \
        web/src/features/today/TodayScreen.tsx \
        web/src/features/workout/SetLogSheet.tsx \
        web/src/features/workout/WorkoutFooter.tsx
git commit -m "feat(button): drop cta variant, reskin primitive, migrate call sites"
```

---

## Task 9: Reskin `Card` primitive

**Files:** Modify: `web/src/shared/ui/card.tsx`

- [ ] **Step 1: Read the current Card**

```bash
cat web/src/shared/ui/card.tsx
```
Note the current classNames so you can swap them without breaking composition slots.

- [ ] **Step 2: Reskin the root Card element**

Edit `web/src/shared/ui/card.tsx`. Find the main card className string (the one applied to the root `div` / `section`) and replace its radius + border tokens:

```tsx
// Before (typical shadcn):
"bg-card text-card-foreground rounded-xl border shadow-sm"

// After:
"bg-card text-card-foreground rounded-[var(--radius-card)] border border-line"
```

Key changes:
- Radius: `rounded-xl` (14px in this project's `@theme`) → `rounded-[var(--radius-card)]` (18px).
- Border: explicit `border-line` hairline instead of default.
- Drop `shadow-sm` — the handoff design leans on hairlines, not elevation.

If the Card exposes variants (`ghost`, `elevated`, etc.), keep them but adjust:
- `elevated` (if present) stays at 18px radius but gains a very subtle shadow: `shadow-[0_2px_10px_rgba(30,25,18,0.06)]`.
- Do NOT add new variants.

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 531 pass. If any test asserts `rounded-xl` or `shadow-sm` on a Card, update the assertion.

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/ui/card.tsx
git commit -m "feat(card): 18px radius, hairline border, drop shadow"
```

---

## Task 10: Reskin `Sheet` primitive + swap Lucide X for custom `Close` icon

**Files:** Modify: `web/src/shared/ui/sheet.tsx`

- [ ] **Step 1: Inspect the current Sheet to find the Lucide import and content className**

```bash
grep -n "lucide-react\|rounded-\|slideUp\|slide-up\|side=\"bottom\"" web/src/shared/ui/sheet.tsx
```

The shadcn Sheet uses `lucide-react` for the built-in close button and Tailwind `data-[state=open]:slide-in-from-…` for entry animations. We need both to change.

- [ ] **Step 2: Swap Lucide `X` for the custom `Close` icon**

At the top of `web/src/shared/ui/sheet.tsx`:

```tsx
// Before
import { X } from "lucide-react"

// After
import { Close } from "@/shared/icons"
```

Find the `<X />` usage inside the SheetContent's close button and replace:

```tsx
// Before
<X className="size-4" />

// After
<Close size={18} aria-label="Close" />
```

- [ ] **Step 3: Update the bottom-sheet radius + animation**

Locate the `SheetContent` className string for `side="bottom"`. Adjust:

```tsx
// radius — bottom sheets
// Before: "rounded-t-[10px]" or similar
// After:  "rounded-t-[var(--radius-sheet-top)]"

// animation — bottom sheets
// Before: "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300"
// After:  "data-[state=open]:animate-[slideUp_var(--dur-slideUp)_var(--ease-handoff)] data-[state=closed]:animate-[slideUp_var(--dur-slideUp)_var(--ease-handoff)_reverse]"
```

Keep `side="top" | "left" | "right"` variants untouched — they aren't used by any user-facing sheet today and reskinning them is out of scope.

- [ ] **Step 4: Run tests + smoke-test**

```bash
npm test
```
Expected: 531 pass. If a test asserts `slide-in-from-bottom` or `lucide-react` on the Sheet, update it.

Smoke:
```bash
npm run dev
```
Open any screen that triggers a sheet (tap an empty set row to open SetLogSheet). Confirm: the sheet slides up with the new animation, has a 24px top radius, and the close button shows the custom X icon. Close the dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/ui/sheet.tsx
git commit -m "feat(sheet): 24px top radius, slideUp animation, swap Lucide X for custom Close"
```

---

## Task 11: Reskin `Dialog` primitive + swap Lucide X for custom `Close` icon

**Files:** Modify: `web/src/shared/ui/dialog.tsx`

- [ ] **Step 1: Swap Lucide `X` for custom `Close`**

At the top of `web/src/shared/ui/dialog.tsx`:

```tsx
// Before
import { X } from "lucide-react"

// After
import { Close } from "@/shared/icons"
```

Find the `<X />` usage in `DialogContent`'s close button and replace:

```tsx
// Before
<X className="size-4" />

// After
<Close size={16} aria-label="Close" />
```

- [ ] **Step 2: Update DialogContent animation to `popIn`**

Locate the `DialogContent` className string. Replace the zoom-in entry animation:

```tsx
// Before (typical shadcn):
"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"

// After:
"data-[state=open]:animate-[popIn_var(--dur-popIn)_var(--ease-handoff)] data-[state=closed]:opacity-0"
```

And update the radius/border to match the Card:

```tsx
// rounded-lg → rounded-[var(--radius-card)]
// border → border border-line
```

- [ ] **Step 3: Run tests + smoke-test**

```bash
npm test
```
Expected: 531 pass.

Smoke: open any ConfirmDialog (Workout Finish confirm). Confirm it pops in with scale(0.96→1) + fade, has 18px radius and hairline border.

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/ui/dialog.tsx
git commit -m "feat(dialog): popIn animation, hairline border, swap Lucide X for custom Close"
```

---

## Task 12: Reskin `SectionHeader`, `Stat`, `Pill`, `EmptyState`, `BlockStripe`

**Files:**
- Modify: `web/src/shared/components/SectionHeader.tsx`
- Modify: `web/src/shared/components/Stat.tsx`
- Modify: `web/src/shared/components/Pill.tsx`
- Modify: `web/src/shared/components/EmptyState.tsx`
- Modify: `web/src/features/workout/BlockStripe.tsx`

These are smaller primitives; reskin each in place without changing its public API.

- [ ] **Step 1: `SectionHeader.tsx` — eyebrow typography**

Open the file, identify the title className, and replace letter-spacing + size to match the new `.text-eyebrow`:

```tsx
// Before:
"text-xs font-semibold uppercase tracking-wider text-muted-foreground"

// After:
"text-eyebrow text-ink-3"
```

If the component supports a `serif` variant (or should gain one for the new Settings / History headings), add it:

```tsx
variant="serif": "text-title-serif text-foreground"
```

Expose via a `variant` prop or a boolean `serif` — match whatever pattern the component already uses.

- [ ] **Step 2: `Stat.tsx` — tabular numerals + ink/ink-3 split**

Ensure the value uses `.text-value` (already exists) and the label uses `.text-eyebrow text-ink-3`. Apply the 18px radius (`rounded-[var(--radius-card)]`) and hairline border if the Stat is a tile-shaped component:

```tsx
// Tile container:
"rounded-[var(--radius-card)] border border-line bg-card p-4"
```

- [ ] **Step 3: `Pill.tsx` — 999px radius, sage-soft selected state**

```tsx
// Base:
"inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium"
// Unselected:
"border border-line bg-background text-foreground"
// Selected (sage-soft):
"bg-sage-soft text-sage-deep"
```

Keep the selection-state API identical; only the class tokens change.

- [ ] **Step 4: `EmptyState.tsx` — serif heading**

Replace the existing `<h2>`/`<h3>` className with `.text-title-serif`. Keep the Lucide icon import **for now** — swapping it is Sprint 7's job when Today/Workout empty states are redesigned (per spec §4 Icon migration). If the component currently imports a Lucide icon, leave the import; do NOT swap it here.

Background: if the EmptyState currently uses `bg-muted` or similar, leave it — `bg-muted` now maps to `--card-paper` via Task 3's remap.

- [ ] **Step 5: `BlockStripe.tsx` — re-tokenise**

Find any hardcoded color values or `border-border` usages and confirm they already resolve to the new palette via the token remap. If the stripe uses explicit grey shades (`bg-zinc-200` etc.), replace with `bg-line` or `bg-ink-3/40`. If the existing tests (`BlockStripe.test.tsx` — 6 tests) assert on specific class names, update them.

- [ ] **Step 6: Run tests + lint + build**

```bash
npm test && npm run lint && npm run build
```
Expected: 531 pass. Fix any classname-assertion failures inline.

- [ ] **Step 7: Commit**

```bash
git add web/src/shared/components/ web/src/features/workout/BlockStripe.tsx
git commit -m "feat(primitives): reskin SectionHeader / Stat / Pill / EmptyState / BlockStripe to warm-paper tokens"
```

---

## Task 13: Update `index.html` — `theme-color` + font preloads

**Files:** Modify: `web/index.html`

- [ ] **Step 1: Update `theme-color` meta**

Find line 6 (`<meta name="theme-color" content="#09090b" />`) and replace:

```html
<meta name="theme-color" content="#FCFAF5" />
```

`#FCFAF5` is the sRGB approximation of `oklch(98.8% 0.008 80)` — the `--paper` value. If after the end-to-end check in Task 17 it reads visibly off against the in-app paper surface, tweak by ±2 units per channel and re-verify on an iOS PWA install.

- [ ] **Step 2: Add font preload links**

After the existing `<meta>` tags and before the `<title>`, add:

```html
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/exercise-logger/assets/inter-latin-400-normal.woff2"
  crossorigin="anonymous"
/>
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/exercise-logger/assets/inter-latin-500-normal.woff2"
  crossorigin="anonymous"
/>
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/exercise-logger/assets/inter-latin-600-normal.woff2"
  crossorigin="anonymous"
/>
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/exercise-logger/assets/instrument-serif-latin-400-normal.woff2"
  crossorigin="anonymous"
/>
```

> **Note on hashed filenames.** Vite emits content-hashed font filenames (`inter-latin-400-normal.a1b2c3.woff2`) in production builds, which breaks the exact preload hrefs above. Run `npm run build` and inspect `dist/assets/` to get the actual filenames. If hashing is an issue, drop the preloads here and rely on `font-display: swap` in the `@fontsource` CSS — fonts will still paint swiftly, just not on the first critical paint.

For this plan, try the preloads first. If `npm run build` shows hashed font names that won't match the `href`s, delete the four `<link rel="preload">` lines and commit only the `theme-color` change.

- [ ] **Step 3: Run build to verify**

```bash
npm run build
```
Check `dist/index.html` — confirm `theme-color` is `#FCFAF5` and (if you kept preloads) the `href`s resolve.

- [ ] **Step 4: Commit**

```bash
git add web/index.html
git commit -m "feat(shell): set paper theme-color, preload Inter + Instrument Serif"
```

---

## Task 14: Remove legacy font packages (DM Sans + Urbanist)

**Files:**
- Modify: `web/src/app/App.css` (remove imports)
- Modify: `web/package.json` (uninstall)

Only do this after Task 4 has swapped `--font-sans` and `--font-heading` to Inter / Instrument Serif, which means no screen is reading DM Sans or Urbanist WOFFs anymore.

- [ ] **Step 1: Confirm no screen consumes DM Sans or Urbanist directly**

```bash
grep -rn "DM Sans\|Urbanist\|@fontsource-variable/urbanist\|@fontsource/dm-sans" web/src web/index.html
```
Expected output: only the import lines in `App.css`. If any `.tsx` / `.ts` file hardcodes `'DM Sans'` or `'Urbanist'`, replace those references with `var(--font-sans)` / `var(--font-heading)` before uninstalling.

- [ ] **Step 2: Remove the imports from App.css**

Edit `web/src/app/App.css`. Delete these four lines (around lines 4-7):

```css
@import "@fontsource-variable/urbanist";
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
@import "@fontsource/dm-sans/600.css";
```

- [ ] **Step 3: Uninstall the packages**

```bash
cd web && npm uninstall @fontsource-variable/urbanist @fontsource/dm-sans
```

- [ ] **Step 4: Run tests + build**

```bash
npm test && npm run build
```
Expected: 531 pass, build succeeds, bundle size shrinks by ~200KB.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/src/app/App.css
git commit -m "chore(fonts): remove DM Sans + Urbanist, superseded by Inter + Instrument Serif"
```

---

## Task 15: Audit `shadcn-compat.css`

**Files:** Read-only: `web/src/app/shadcn-compat.css`

The file was flagged in spec §3 for auditing. Based on inspection, it only contains `@custom-variant` helpers for `data-state` semantics — these are non-conflicting with the new palette and should stay.

- [ ] **Step 1: Confirm no palette tokens live here**

```bash
grep -n "oklch\|--color-\|--primary\|--cta" web/src/app/shadcn-compat.css
```
Expected: no output. The file only defines keyframes and `@custom-variant`s.

- [ ] **Step 2: Record the audit outcome as a one-line comment at the top of the file**

Edit `web/src/app/shadcn-compat.css`. Add as the first line:

```css
/* Sprint 6 audit (2026-04-19): palette-neutral — keep. */
```

- [ ] **Step 3: Commit**

```bash
git add web/src/app/shadcn-compat.css
git commit -m "chore(css): audit shadcn-compat.css — palette-neutral, retained"
```

---

## Task 16: Refresh `CLAUDE.md` test count + token / font refs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `web/src/domain/CLAUDE.md` (only if drift exists)
- Modify: `web/src/db/CLAUDE.md` (only if drift exists)
- Modify: `web/src/services/CLAUDE.md` (only if drift exists)

- [ ] **Step 1: Update the root `CLAUDE.md`**

Edit `CLAUDE.md`. Find the commands block and change:

```markdown
npm test              # 530 unit+integration tests (Vitest)
```

to:

```markdown
npm test              # 531 unit+integration tests (Vitest)
```

(531 = 527 pre-Sprint-6 baseline + 4 new IconSvg + barrel tests added in Tasks 5–6.)

- [ ] **Step 2: Scan nested CLAUDE.md files for token/font drift**

```bash
grep -rn "DM Sans\|Urbanist\|shadcn/ui\|bg-cta\|--cta\|font-heading: 'Urbanist" web/src/*/CLAUDE.md
```

If any hits: update them to reference the new tokens (`Inter + Instrument Serif`, `ink/paper/sage palette`). If no hits: skip.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md web/src/*/CLAUDE.md
git commit -m "docs: refresh CLAUDE.md test count + token references post-Sprint-6"
```

---

## Task 17: Full verification + PR prep

**Files:** none — pure verification

- [ ] **Step 1: Run the full unit test suite**

```bash
cd web && npm test
```
Expected: `Tests  531 passed (531)`.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 3: Run TypeScript build**

```bash
npm run build
```
Expected: clean build, `dist/` populated, bundle includes Inter + Instrument Serif WOFF2s.

- [ ] **Step 4: Run Playwright E2E**

```bash
npm run test:e2e
```
Expected: all E2E tests pass. If any E2E screenshot baseline fails because colors shifted, re-baseline:

```bash
npm run test:e2e -- --update-snapshots
```

and commit the new baselines in a separate commit:

```bash
git add web/tests/e2e/**/*.png
git commit -m "chore(e2e): update Playwright baselines for warm-paper palette"
```

- [ ] **Step 5: Manual smoke walk through every screen on `npm run preview`**

```bash
npm run preview
```

Open `http://localhost:4173/exercise-logger/` on a phone-sized viewport (DevTools → Device toolbar → iPhone 14). Confirm for each screen:

- **Today:** paper background, ink text, sage accent for Start CTA (now ink-on-paper primary), no purple anywhere.
- **Workout (empty):** EmptyState renders serif heading, paper background.
- **Workout (active):** cards are 18px radius with hairline borders, buttons hit-testable at 44pt, Finish button is ink primary.
- **SetLogSheet:** opens with `slideUp` animation, 24px top radius, close button shows custom X.
- **History:** Stats tile renders with tabular numerals; session rows show sage-soft pills.
- **Settings:** rows have hairline dividers; primary Import button is ink.
- **ConfirmDialog (tap Finish):** pops in with scale animation, hairline border.

Close the preview server.

- [ ] **Step 6: Diff the branch against `main`**

```bash
git log --oneline main..HEAD
git diff main --stat
```

Expected: 12–15 commits, touching ~20 files (App.css, index.html, package.json, button/card/sheet/dialog/4 primitives, 3 cta call sites, 12 icon files + index + test, CLAUDE.md).

- [ ] **Step 7: Push the branch**

```bash
git push -u origin sprint-6-foundation
```

- [ ] **Step 8: Open the PR**

```bash
gh pr create --title "Sprint 6: Warm Paper foundation — tokens, fonts, icons, primitives" --body "$(cat <<'EOF'
## Summary
- Port `App.css` to warm-paper oklch palette + Inter/Instrument Serif via `@fontsource/*`
- Introduce `web/src/shared/icons/` with 12 custom SVG icons (hand-ported from the handoff prototype)
- Reskin shared primitives in place: Button (drop `cta`, migrate 3 call sites), Card, Sheet, Dialog, SectionHeader, Stat, Pill, EmptyState, BlockStripe
- Swap Lucide `X` → custom `Close` icon inside Sheet + Dialog only; other Lucide imports stay for per-screen sprints 7–11
- Update `theme-color` meta + preload fonts in `index.html`
- Remove `@fontsource-variable/urbanist` + `@fontsource/dm-sans` packages

See `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 6 + §6 Pre-decided answers 6–11.

## Test plan
- [ ] `npm test` — 531 pass (527 baseline + 4 new icon tests)
- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean, bundle includes `@fontsource/*` WOFF2s
- [ ] `npm run test:e2e` — clean (baselines may need regenerating for palette shift)
- [ ] Manual: walk through Today / Workout / History / Settings on phone viewport — no purple, paper surfaces, sage accents, hairline borders, 18px card radius, 44pt touch targets
- [ ] Manual: iOS PWA install — status bar matches `#FCFAF5`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL in output. Paste it back to the user.

---

## Self-Review

**1. Spec coverage.** Walking §3 Sprint 6 scope bullets against tasks:

| Spec bullet | Covered by |
|---|---|
| Replace tokens in `App.css` (oklch palette + radii + motion) | Tasks 2, 3, 4 |
| Self-host Inter + Instrument Serif via `@fontsource/*`; preload in `index.html`; remove legacy fonts | Tasks 1, 4, 13, 14 |
| Rewrite typography utilities (`.text-hero-serif`, `.text-title-serif`, `.text-eyebrow`, `.text-body`, `.text-meta`); keep `.text-value` | Task 4 |
| Create `shared/icons/` with 12 custom SVGs; keep Lucide, migrate only in Sheet + Dialog | Tasks 5, 6, 10, 11 |
| Reskin primitives in place; drop `cta`; migrate 3 call sites | Tasks 7, 8, 9, 10, 11, 12 |
| Update `theme-color` meta | Task 13 |
| Audit `shadcn-compat.css` | Task 15 |
| Refresh CLAUDE.md test count | Task 16 |

All covered. Spec §6 pre-decisions 6–11 all reflected in the approach.

**2. Placeholder scan.** Zero TODOs, "implement later", "similar to Task N", or bare "add tests here" strings. Every code block is complete. The two places where the plan says "port from `screens.jsx`" (Task 6 `Search` and `Grid` / `Graph`) give the engineer a specific source line to port from **plus** a concrete fallback implementation — never a bare "port it yourself".

**3. Type consistency.** The `IconSvgProps` interface defined in Task 5 is consumed identically by all 12 icons in Task 6. `variant="default"` replaces `variant="cta"` consistently across Button (Task 7) and the 3 call sites (Task 8). `--radius-card` / `--radius-button` / `--radius-sheet-top` / `--radius-pill` defined in Task 4 are consumed without redefinition in Tasks 9, 10, 12.

One nit fixed inline: Task 2 introduces `--card-paper` (not `--card`) to avoid conflicting with the legacy `--card` in the same `:root` block; Task 3 re-points `--card` at `var(--card-paper)`. Without this two-step, Step 1 of Task 2 would have silently overwritten the shadcn `--card` mid-block and broken intermediate builds.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-sprint6-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for long plans where each task is self-contained (which is the case here).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Claude Code Terminal Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the entire PWA as a Claude Code / CLI terminal — dark warm palette, JetBrains Mono, `❯`/`⏺`/`⎿`/`[TAG]` chrome — with zero behavior change.

**Architecture:** Token-layer flip in `App.css` first (all 218+ semantic-token usages recolor automatically via kept variable names + sage→accent aliases), then a chrome pass over primitives → shared components → nav → each feature, then cleanup. Spec: `docs/superpowers/specs/2026-07-06-claude-code-theme-design.md`.

**Tech Stack:** React 19, Tailwind CSS 4 (CSS-first config), @fontsource/jetbrains-mono, vite-plugin-pwa, sharp (icon generation only).

## Global Constraints

- **No behavior changes.** ARIA roles, accessible names, and semantic strings unchanged.
- **Decorative glyphs (`❯ ⏺ ⎿ ✻ ▌`, brackets) always in `aria-hidden="true"` spans.**
- **Case styling via CSS `text-transform`, never by editing strings.**
- **Touch targets keep current sizes** (themed, not literal).
- **Regression gate per task:** `cd web && npm test` green (742 tests) before commit.
- All work happens under `web/` except docs.
- Accent = Claude orange `oklch(68% 0.115 45)` (~`#D97757`). Background hex for PWA metadata = `#1F1E1B`.

---

### Task 1: Foundation — fonts, token flip, PWA metadata

**Files:**
- Modify: `web/package.json` (deps via npm)
- Modify: `web/src/app/App.css` (full rewrite of imports, `@theme inline`, `:root`, utilities, keyframes)
- Modify: `web/index.html:6`
- Modify: `web/vite.config.ts:45-46`

**Interfaces:**
- Produces CSS vars/classes later tasks rely on: `--accent`, `--accent-bright`, `--accent-soft` (+ Tailwind classes `text-accent-cli`, `bg-accent-cli-soft`, `text-accent-cli-bright`, `border-accent-cli` via `@theme` names below), keyframes `cursor-blink`, `glyph-pulse`, radius tokens flattened, `--font-mono` global.
- Keeps working: every existing `bg-paper/text-ink*/border-line/bg-sage-soft/text-sage-deep/text-sage` class (sage aliases point at accent).

- [ ] **Step 1: Swap font dependencies**

```powershell
cd web
npm remove @fontsource/inter @fontsource/instrument-serif
npm install @fontsource/jetbrains-mono
```

- [ ] **Step 2: Rewrite `App.css` head — imports and fonts**

Replace lines 1–14 (imports + font comment) with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./shadcn-compat.css";
/* Single global face: JetBrains Mono (400/500/600/700 latin). The CSS bundle
   importing these @font-face rules is preloaded by Vite; font-display: swap. */
@import "@fontsource/jetbrains-mono/latin-400.css";
@import "@fontsource/jetbrains-mono/latin-500.css";
@import "@fontsource/jetbrains-mono/latin-600.css";
@import "@fontsource/jetbrains-mono/latin-700.css";
```

- [ ] **Step 3: Update `@theme inline` block**

In the `@theme inline` block: replace the three font lines and the sage color lines; add accent-cli names; flatten radii. The block keeps all other `--color-*` mappings as-is.

```css
    --color-accent-cli: var(--accent);
    --color-accent-cli-bright: var(--accent-bright);
    --color-accent-cli-soft: var(--accent-soft);
    /* sage aliases — removed in cleanup task */
    --color-sage: var(--accent);
    --color-sage-deep: var(--accent-bright);
    --color-sage-soft: var(--accent-soft);
    --font-heading: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
    --font-sans: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
    --font-serif: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
    --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
```

- [ ] **Step 4: Replace the `:root` palette**

Replace the whole Sprint-6 `:root` palette block with:

```css
:root {
    /* ─── Claude Code terminal palette (oklch, warm-hued dark) ─── */
    /* Surface */
    --paper: oklch(22% 0.005 80);        /* terminal bg ≈ #1F1E1B */
    --card-paper: oklch(25.5% 0.006 80); /* raised panel */

    /* Ink (ivory tiers) */
    --ink: oklch(96% 0.005 90);
    --ink-2: oklch(76% 0.008 85);
    --ink-3: oklch(62% 0.01 80);

    /* Hairlines */
    --line: oklch(34% 0.008 80);
    --line-soft: oklch(28.5% 0.007 80);

    /* Accent — Claude orange */
    --accent-cli: oklch(68% 0.115 45);
    --accent-bright: oklch(78% 0.10 50);
    --accent-soft: color-mix(in oklch, var(--accent-cli) 16%, var(--paper));

    /* Semantic */
    --terminal-green: oklch(72% 0.13 150);
    --warm: oklch(75% 0.13 80);
    --danger: oklch(66% 0.17 27);

    --background: var(--paper);
    --foreground: var(--ink);
    --card: var(--card-paper);
    --card-foreground: var(--ink);
    --popover: var(--card-paper);
    --popover-foreground: var(--ink);
    --primary: var(--accent-cli);
    --primary-foreground: oklch(16% 0.005 80);
    --secondary: var(--card-paper);
    --secondary-foreground: var(--ink);
    --muted: var(--card-paper);
    --muted-foreground: var(--ink-3);
    --accent: var(--accent-soft);
    --accent-foreground: var(--accent-bright);
    --destructive: var(--danger);
    --destructive-foreground: var(--ink);
    --destructive-soft: color-mix(in oklch, var(--danger) 15%, var(--paper));
    --border: var(--line);
    --input: var(--line);
    --ring: var(--accent-cli);
    --success: var(--terminal-green);
    --success-foreground: oklch(16% 0.005 80);
    --success-soft: color-mix(in oklch, var(--terminal-green) 14%, var(--paper));
    --info: oklch(70% 0.11 230);
    --info-foreground: oklch(16% 0.005 80);
    --info-soft: color-mix(in oklch, oklch(70% 0.11 230) 14%, var(--paper));
    --warning: var(--warm);
    --warning-foreground: oklch(16% 0.005 80);
    --warning-soft: color-mix(in oklch, var(--warm) 14%, var(--paper));
    --accent-warm: var(--warm);
    --accent-warm-foreground: var(--ink);
    --accent-warm-soft: color-mix(in oklch, var(--warm) 14%, var(--paper));
    --chart-1: var(--accent-cli);
    --chart-2: var(--terminal-green);
    --chart-3: var(--ink-3);
    --chart-4: var(--ink-2);
    --chart-5: var(--line);
    --radius: 6px;
    --sidebar: var(--paper);
    --sidebar-foreground: var(--ink);
    --sidebar-primary: var(--accent-cli);
    --sidebar-primary-foreground: oklch(16% 0.005 80);
    --sidebar-accent: var(--accent-soft);
    --sidebar-accent-foreground: var(--accent-bright);
    --sidebar-border: var(--line);
    --sidebar-ring: var(--accent-cli);
    --border-strong: var(--ink-2);

    /* sage → accent migration aliases (removed in cleanup task) */
    --sage: var(--accent-cli);
    --sage-deep: var(--accent-bright);
    --sage-soft: var(--accent-soft);
}
```

Note: `--accent` in the shadcn mapping keeps its shadcn meaning (soft tint bg); the raw orange lives in `--accent-cli`. In `@theme inline` (Step 3), `--color-accent-cli` must point at `var(--accent-cli)` — fix the Step 3 snippet accordingly when writing (`--color-accent-cli: var(--accent-cli);`).

- [ ] **Step 5: Remap typography utilities + radii + keyframes**

In `@layer utilities`: `.text-hero-serif` → `font-family: var(--font-mono); font-weight: 600; font-size: 1.5rem; line-height: 1.15; letter-spacing: -0.02em;` and `.text-title-serif` → same family, `font-weight: 600; font-size: 1.125rem; line-height: 1.2; letter-spacing: -0.01em;` (keep class names — call sites untouched). Keep `.text-eyebrow/.text-meta/.text-body/.text-value*` scales, only family inherits mono automatically.

Radius token block becomes:

```css
  --radius-card: 8px;
  --radius-sheet-top: 12px;
  --radius-set-logged: 6px;
  --radius-set-empty: 6px;
  --radius-pill: 6px;
  --radius-button: 6px;
```

Append keyframes (with reduced-motion guards alongside the existing ones):

```css
@keyframes cursor-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes glyph-pulse {
  0%, 100% { opacity: 1; transform: rotate(0deg); }
  50% { opacity: 0.5; transform: rotate(90deg); }
}
@media (prefers-reduced-motion: reduce) {
  .animate-cursor-blink, .animate-glyph-pulse { animation: none; }
}
.animate-cursor-blink { animation: cursor-blink 1.1s step-end infinite; }
.animate-glyph-pulse { animation: glyph-pulse 1.4s ease-in-out infinite; }
```

- [ ] **Step 6: PWA metadata**

`web/index.html:6`: `<meta name="theme-color" content="#1F1E1B" />`.
`web/vite.config.ts`: manifest `theme_color: "#1F1E1B"`, `background_color: "#1F1E1B"`.

- [ ] **Step 7: Verify**

Run: `cd web && npm test` → all pass. `npm run build` → succeeds. `npm run dev` → visual check: dark bg, mono type everywhere, orange accents where sage was.

- [ ] **Step 8: Commit** — `git commit -m "feat(theme): Claude Code dark palette + JetBrains Mono token flip"`

---

### Task 2: Primitives + app-level chrome (Toaster, LoadingState)

**Files:**
- Modify: `web/src/shared/ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `sheet.tsx`, `alert-dialog.tsx`, `badge.tsx`, `dialog.tsx`, `tabs.tsx`, `label.tsx`, `scroll-area.tsx`, `separator.tsx`
- Modify: `web/src/app/App.tsx:52-62` (LoadingState), `App.tsx:228-236` (Toaster)

**Interfaces:**
- Produces: same component APIs (variants/sizes unchanged); visual-only edits.

- [ ] **Step 1: Button** — in `buttonVariants` base: focus ring `focus-visible:ring-accent-cli/60`. Variants: `default` unchanged (primary now = orange via tokens); `outline` keep; `destructive` keep. No size changes.
- [ ] **Step 2: Card** — border `border-line`, radius `rounded-[var(--radius-card)]` (now 8px via token — verify card.tsx uses the token; if hardcoded, switch to token), remove any shadow classes (`shadow-*` → none).
- [ ] **Step 3: Inputs/textarea** — `bg-paper` fields with `border-line`, focus `ring-accent-cli/50`, `font-mono` inherited (no change needed), caret color: add `caret-[var(--accent-cli)]` to input + textarea class strings.
- [ ] **Step 4: Sheet/dialog/alert-dialog** — overlay `bg-black/70`; content panels `bg-card border border-line`; sheet top radius uses `--radius-sheet-top` (now 12px).
- [ ] **Step 5: Toaster (App.tsx)** — add `theme="dark"`, className → `` `!rounded-[var(--radius-card)] !border !border-line !bg-card !text-foreground font-sans` ``, drop `richColors`.
- [ ] **Step 6: LoadingState (App.tsx)** — keep the `Loading...` string; prepend glyph:

```tsx
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="inline-block text-accent-cli animate-glyph-pulse">✻</span>
        Loading...
      </p>
```

- [ ] **Step 7: Verify + commit** — `npm test` green; dev-server check of buttons/dialogs/toasts. `git commit -m "feat(theme): terminal chrome for ui primitives, toaster, loading state"`

---

### Task 3: Shared components — PromptHeading (new), SectionHeader, Pill, Stat, EmptyState, ConfirmDialog

**Files:**
- Create: `web/src/shared/components/PromptHeading.tsx`
- Modify: `web/src/shared/components/SectionHeader.tsx`, `Pill.tsx`, `Stat.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`

**Interfaces:**
- Produces: `PromptHeading({ command, detail?, className?, as? })` — renders `❯ command` with blinking cursor; `command` is the semantic string (rendered lowercase via CSS). `detail` is an optional dim mono suffix (e.g. `--active`), aria-hidden decorative.
- `SectionHeader` keeps its `variant` prop; `default` variant now renders a `#`-prefixed comment-style label.

- [ ] **Step 1: Create `PromptHeading.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface PromptHeadingProps {
  command: React.ReactNode;
  detail?: string;
  className?: string;
  as?: "h1" | "h2" | "p";
}

export function PromptHeading({
  command,
  detail,
  className,
  as: Tag = "h1",
}: PromptHeadingProps) {
  return (
    <Tag
      className={cn(
        "flex items-baseline gap-2 text-2xl font-semibold lowercase tracking-tight text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="text-accent-cli select-none">
        ❯
      </span>
      <span>{command}</span>
      {detail && (
        <span aria-hidden="true" className="text-sm font-medium text-ink-3">
          {detail}
        </span>
      )}
      <span
        aria-hidden="true"
        className="inline-block select-none text-accent-cli animate-cursor-blink"
      >
        ▌
      </span>
    </Tag>
  );
}
```

- [ ] **Step 2: SectionHeader** — `default` variant classes become `` "text-eyebrow text-ink-3" `` plus a `#` prefix glyph; `serif` variant keeps `text-title-serif text-foreground` (now mono via utility remap):

```tsx
    <p id={id} className={cn(
        variant === "serif" ? "text-title-serif text-foreground" : "text-eyebrow text-ink-3",
        className,
      )}>
      {variant === "default" && (
        <span aria-hidden="true" className="mr-1.5 text-accent-cli/70 select-none">#</span>
      )}
      {children}
    </p>
```

- [ ] **Step 3: Pill** — squared chip (radius token already 6px, no class change needed); selected → `bg-accent-cli-soft text-accent-cli-bright border border-accent-cli/40`; unselected → `border border-line bg-transparent text-ink-2 hover:border-ink-3`; focus ring `ring-accent-cli/40`; indicator dot `bg-accent-cli`.
- [ ] **Step 4: Stat / EmptyState / ConfirmDialog** — Stat: no structural change (tabular mono inherited). EmptyState: icon container `bg-accent-cli-soft` → keep via alias or rename now; heading class untouched. ConfirmDialog: destructive button stays `--danger`; panel styling comes from alert-dialog primitive.
- [ ] **Step 5: Verify + commit** — `npm test`; dev check. `git commit -m "feat(theme): prompt heading + terminal shared components"`

---

### Task 4: Status-line navigation (App.tsx)

**Files:**
- Modify: `web/src/app/App.tsx:86-124`

- [ ] **Step 1: Restyle NavLink** — remove the sage pill background span entirely; active state = orange text; labels lowercase via CSS:

```tsx
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs lowercase transition-all duration-[var(--dur-base)] focus-visible:ring-2 focus-visible:ring-accent-cli/40 outline-none active:scale-95 rounded-[var(--radius-button)] ${
                  isActive
                    ? "text-accent-cli font-semibold"
                    : "text-ink-3 hover:text-foreground"
                }`
              }
```

Inside the render-prop children, delete the `isActive && <span … bg-sage-soft />` block; keep icon + label spans (drop the now-unneeded `relative z-10` classes).

- [ ] **Step 2: Verify + commit** — `npm test`; check all four tabs (active orange, no pill). `git commit -m "feat(theme): status-line bottom nav"`

---

### Tasks 5–9: Feature chrome passes

Common transformation rules for every screen file (this is the "code" for these tasks — apply mechanically, adapting to each file's structure):

1. **Headings:** top-of-screen `text-hero-serif` headings → `PromptHeading` with the existing string as `command` (e.g. Today greeting keeps greeting text in a dim line below; the command is the screen name already present). Where a heading is data (session title), keep text, restyle only.
2. **Class renames:** `bg-sage-soft`→`bg-accent-cli-soft`, `text-sage-deep`→`text-accent-cli-bright`, `text-sage`/`bg-sage`/`stroke-sage*`/`fill-sage*`→ accent-cli equivalents, `ring-sage/*`→`ring-accent-cli/*`.
3. **List rows** (exercises, sessions, routines): prepend `<span aria-hidden="true">⏺</span>` state-colored (orange active, `text-success` done/PR, `text-ink-3` pending); indent sub-detail lines with `<span aria-hidden="true" className="text-ink-3">⎿</span>`.
4. **Badges/labels:** bracket style — wrap existing label text with aria-hidden `[` `]` spans, `text-eyebrow` mono, no fill.
5. **Cards/tiles:** ensure `border border-line`, no shadows, radius via tokens.
6. **Progress bars:** track `bg-line-soft`, fill `bg-accent-cli`, radius ≤2px, counters keep tabular nums.
7. Never alter semantic strings, ARIA, handlers, or layout structure beyond the above.

Each task: apply rules → `npm test` → dev-server visual check of that screen (mobile viewport) → commit.

### Task 5: Today pass

**Files:** `web/src/features/today/TodayScreen.tsx`, `TodayHeroCard.tsx`, `DaySelector.tsx`, `LastSessionCard.tsx`, `StreakPill.tsx`, `OnboardingBanner.tsx`

- [ ] Apply rules; hero card: day summary framed as panel with `# TODAY` section label; StreakPill → bracket tag with flame icon. Commit `feat(theme): today screen terminal pass`.

### Task 6: Workout pass (largest)

**Files:** `web/src/features/workout/WorkoutScreen.tsx`, `SessionHeader.tsx`, `SessionProgress.tsx`, `RestTimerBar.tsx`, `ExerciseCard.tsx`, `SetRow.tsx`, `SetDots.tsx`, `SetLogSheet.tsx`, `Keypad.tsx`, `ValueBox.tsx`, `PrToggle.tsx`, `SupersetGroup.tsx`, `SupersetRoundRail.tsx`, `ExercisePicker.tsx`, `WorkoutFooter.tsx`, `FinishCelebration.tsx`

- [ ] Apply rules. Specifics: SessionHeader → `PromptHeading command={dayLabel} detail="--active"`; elapsed timer mono dim. ExerciseCard title row gets `⏺` state dot (done = green when all sets logged); set rows get `⎿` connector. SetDots → small squares instead of circles (`rounded-[2px]`), filled orange. Keypad buttons: bordered mono keys. RestTimerBar: orange countdown + dim `tap to skip`-style hint (keep existing accessible button text). FinishCelebration: `✓` green + stats panel. Commit `feat(theme): workout screen terminal pass`.

### Task 7: History pass

**Files:** `web/src/features/history/HistoryScreen.tsx`, `HistoryStatsTile.tsx`, `HistoryFilters.tsx`, `SessionRow.tsx`, `SessionDetailScreen.tsx`, `SessionDetailHeader.tsx`, `SessionDetailStatsTile.tsx`, `SessionDetailExerciseCard.tsx`, `ExerciseHistoryScreen.tsx`, `TrendSparkline.tsx`

- [ ] Apply rules. SessionRow: `⏺` green + mono date; month group headers → `# APRIL 2026` style. TrendSparkline: line `stroke-accent-cli`, latest dot `fill-accent-cli`, PR markers `fill-success`; grid/baseline `stroke-line-soft`. Commit `feat(theme): history screens terminal pass`.

### Task 8: Settings + import pass

**Files:** `web/src/features/settings/SettingsScreen.tsx`, `ActiveRoutineCard.tsx`, `RoutineList.tsx`, `RowLink.tsx`, `SettingRow.tsx`, `UnitsToggle.tsx`, `AboutCard.tsx`, `RoutineImportScreen.tsx`, `YamlErrorList.tsx`

- [ ] Apply rules. Section labels → `# ROUTINE`, `# DATA` etc. (SectionHeader already does this). YAML textarea: `bg-paper border-line`, mono (inherited), error list rows `text-danger` with `✗` aria-hidden prefix. UnitsToggle: bracket-tag segmented control. Commit `feat(theme): settings + import terminal pass`.

### Task 9: Onboarding pass

**Files:** `web/src/features/onboarding/OnboardingWelcomeScreen.tsx`, `QuestionnaireScreen.tsx`, `HandoffScreen.tsx`, `components/WizardShell.tsx`, `ChipRow.tsx`, `ChipMulti.tsx`, `ChipWithDescription.tsx`, `StepTextArea.tsx`, `LastPromptCard.tsx`, `StarterRoutineSummary.tsx`, all 11 `steps/*.tsx`

- [ ] Apply rules. WizardShell progress → `n/11` mono counter + squared bar. Chips use restyled `Pill`. Welcome heading → `PromptHeading command="exercise logger" detail="--init"` style treatment (keep accessible name). Commit `feat(theme): onboarding terminal pass`.

---

### Task 10: PWA icons

**Files:**
- Create: `web/scripts/generate-icons.mjs`, `web/public/icons/icon-source.svg`
- Modify (generated): `web/public/icons/icon-{192,256,384,512}.png`

- [ ] **Step 1: SVG source** — 512×512: bg `#1F1E1B` rounded rect (radius 96), Claude-orange prompt chevron as *paths* (no font dependency) + ivory cursor block:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1F1E1B"/>
  <path d="M150 166 L 254 256 L 150 346" fill="none" stroke="#D97757" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="296" y="316" width="86" height="34" rx="6" fill="#FAF9F5"/>
</svg>
```

- [ ] **Step 2: Generator** — `npm i -D sharp`; script reads the SVG, emits the four PNG sizes with `sharp(svg).resize(n, n).png()`. Run it; verify PNGs regenerate.
- [ ] **Step 3: Verify + commit** — `npm run build` (PWA assets include icons); commit `feat(theme): dark terminal PWA icons`.
- **Fallback (from spec):** if sharp install/generation fails on this machine, keep old icons, ship metadata colors, and note follow-up.

---

### Task 11: Cleanup + full verification

**Files:**
- Modify: `web/src/app/App.css` (remove sage aliases), any straggler files

- [ ] **Step 1: Sweep** — `grep -rn "sage\|serif\|Inter\|Instrument" web/src` → rename stragglers to accent-cli tokens; then delete the sage alias lines from `:root` and `@theme inline`.
- [ ] **Step 2: Full gate** — `npm test` (742 green), `npm run lint`, `npm run build`, `npm run test:e2e`. Visual sweep of every screen at mobile viewport, including dialogs, sheets, toasts, rest timer, onboarding wizard.
- [ ] **Step 3: Contrast check** — verify `--ink-3` on `--paper` ≥ 4.5:1 (adjust `--ink-3` lightness up if needed).
- [ ] **Step 4: Commit** — `git commit -m "chore(theme): remove sage aliases, cleanup pass"`.

## Self-Review Notes

- Spec coverage: tokens (T1), typography (T1), chrome vocabulary (T2–T9), test safety (global constraints), PWA (T1 metadata + T10 icons), cleanup/contrast (T11). No gaps found.
- `--accent` name collision between spec shorthand and shadcn's existing `--accent` resolved by introducing `--accent-cli` (noted inline in Task 1 Step 4).
- Screen passes intentionally specify transformation rules + exact file lists rather than full file dumps: the transformations are mechanical and file-shape-dependent; global constraints pin the invariants.

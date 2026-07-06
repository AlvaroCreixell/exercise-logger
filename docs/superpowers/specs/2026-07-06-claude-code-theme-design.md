# Claude Code Terminal Theme — Design Spec

**Date:** 2026-07-06
**Status:** Approved (palette, literalness, and scope confirmed by owner)

## Overview

Complete cosmetic redesign of the Exercise Logger PWA to look like a Claude Code / CLI
screen. Pure re-skin: no behavior, routing, data, or service changes. The app stays a
phone-first touch app — terminal *themed*, not a literal text terminal. Buttons, inputs,
and tap targets keep their current sizes.

## Decisions (owner-confirmed)

1. **Literalness:** Themed, not literal. Claude Code look with full-size touch controls.
2. **Colors:** Claude Code dark only. No light variant.
3. **Scope:** Full chrome reshape — panels, prompt headings, bracket tags, status-line
   nav — not just a palette/font swap.

## Non-goals

- No light theme, no theme toggle.
- No behavior/markup-semantics changes: ARIA roles, accessible names, and user-visible
  semantic strings stay as-is (see Test Safety).
- No new UI libraries. Existing shadcn/Base UI primitives are restyled, not replaced.

## 1. Design tokens (`web/src/app/App.css`)

The existing semantic token layer is kept — same variable names, new values — so the
218+ token usages across 70 TSX files flip automatically.

### Palette (oklch, warm-hued dark)

| Token | New value (approx) | Role |
|---|---|---|
| `--paper` | `oklch(22% 0.005 80)` ≈ `#1F1E1B` | Terminal background |
| `--card-paper` | `oklch(26% 0.006 80)` | Raised panel |
| `--ink` | `oklch(96% 0.005 90)` ≈ ivory `#FAF9F5` | Primary text |
| `--ink-2` | `oklch(75% 0.008 85)` | Secondary text |
| `--ink-3` | `oklch(60% 0.01 80)` | Muted/meta text |
| `--line` | `oklch(34% 0.008 80)` | Panel borders |
| `--line-soft` | `oklch(29% 0.007 80)` | Faint hairlines |
| `--accent` | `oklch(68% 0.12 45)` = Claude orange `#D97757` | Primary accent |
| `--accent-bright` | `oklch(78% 0.10 50)` | Accent text on tinted panels |
| `--accent-soft` | `color-mix(accent 15%, paper)` | Tinted panel/selection bg |
| `--success` | `oklch(72% 0.14 150)` terminal green | Done/PR/success |
| `--warm` (warning) | `oklch(75% 0.13 80)` amber | Warnings |
| `--danger` | `oklch(65% 0.19 27)` | Destructive |

Migration note: `--sage`, `--sage-deep`, `--sage-soft` become **aliases** of
`--accent`, `--accent-bright`, `--accent-soft` so untouched files render correctly
immediately. Class usages (`bg-sage-soft` etc.) are renamed to accent-named classes
during the chrome pass; aliases are removed at the end.

shadcn mappings update accordingly: `--primary` = accent (orange fill buttons),
`--primary-foreground` = near-black, `--ring` = accent, `--destructive-soft` etc.
recomputed against the dark paper.

### Radii (flattened, terminal-panel feel)

`--radius-card: 8px`, `--radius-sheet-top: 12px`, `--radius-button: 6px`,
`--radius-set-logged/empty: 6px`, `--radius-pill: 6px` (pills become squared chips).

### Motion

Existing keyframes/durations kept. Add `cursor-blink` (step-end opacity blink, 1.1s)
for the heading block cursor, and `spin-glyph` for the `✻` loading spinner.
Both respect `prefers-reduced-motion`.

## 2. Typography

- **JetBrains Mono** becomes the single global face: add
  `@fontsource/jetbrains-mono` (latin 400/500/600/700); remove Inter and
  Instrument Serif imports and dependencies.
- `--font-sans`, `--font-heading`, `--font-serif` all map to
  `'JetBrains Mono', ui-monospace, Consolas, monospace` — remapping `--font-serif`
  restyles every `.text-hero-serif` / `.text-title-serif` call site for free.
- Utility remaps: `.text-hero-serif` → mono 1.5rem/600 (prompt-heading scale);
  `.text-title-serif` → mono 1.125rem/600. `.text-eyebrow`, `.text-meta`,
  `.text-body`, `.text-value*` keep their scales (already terminal-friendly);
  tabular numerals kept.
- Global body size stays 14–16px equivalent; mono runs wide, so a few long labels
  may need truncation checks during the screen pass.

## 3. Chrome vocabulary

A small, consistent glyph system matching the actual Claude Code CLI. Implemented as
tiny shared components in `web/src/shared/components/`:

| Element | Treatment |
|---|---|
| Screen heading | `PromptHeading`: orange `❯` + lowercase command + blinking `▌` cursor. e.g. `❯ today`, `❯ workout --active`, `❯ history`, `❯ settings` |
| Section header | `SectionHeader` restyled: muted mono uppercase preceded by `#` (comment-style), e.g. `# ACTIVE ROUTINE` |
| List bullet | `StatusDot` glyph `⏺` — orange = active/in-progress, green = done, `--ink-3` = pending |
| Sub-detail line | `⎿` connector glyph before set details / nested rows |
| Badge/tag | `[UPPERCASE]` bracket tags (mono, no fill, colored text) — `Badge` + `Pill` restyle |
| Card | Bordered terminal panel: 1px `--line` border, 8px radius, `--card-paper` bg, no shadow |
| Bottom nav | Status-line bar: top border, mono lowercase labels under icons, active = orange text (no pill highlight) |
| Buttons | Primary = orange fill/dark text; outline = 1px border; ghost/destructive keep shape, recolored. Sizes unchanged |
| Progress bars | Squared (2px radius), orange fill on `--line-soft` track, mono `n/m` counter |
| Rest timer | Same bar language; mono countdown; skip affordance styled as a dim hint (`tap to skip`) |
| Loading | `✻` spinner (rotating/pulsing glyph) + dim mono `loading…` |
| Toasts (sonner) | Dark bordered panel, mono, `✓` / `✗` prefix via icons, orange accent |
| Dialogs/sheets | Dark panels, 1px border, flattened radii; overlay dims to near-black |
| Sparkline/charts | Recolor via existing semantic SVG classes (orange line, green PR dots) |
| Icons | Keep custom stroke icon set (inherits `currentColor`) |

Glyphs used: `❯` (U+276F), `⏺` (U+23FA), `⎿` (U+23BF), `✻` (U+273B), `▌` (U+258C).
These may fall back to system symbol fonts on Android — acceptable; they are
decorative only.

## 4. Test safety (hard rules for the whole pass)

The 742 unit/integration tests and Playwright E2E must keep passing without
behavioral rewrites:

1. Decorative glyphs (`❯ ⏺ ⎿ ✻ ▌`, brackets) live in `aria-hidden="true"` spans —
   never concatenated into semantic strings.
2. Lowercase/uppercase styling is CSS `text-transform`, never string changes.
3. ARIA roles, labels, and test-visible text content are unchanged.
4. Any test that asserts on class names or colors (rare) may be updated to the new
   token names, but assertions on behavior/text must not need changes.

## 5. PWA identity

- `index.html`: `theme-color` → `#1F1E1B`; apple status bar stays `black-translucent`.
- `vite.config.ts` manifest: `theme_color` and `background_color` → `#1F1E1B`.
- Icons: regenerate `icon-192/256/384/512.png` (+ maskable) as a dark
  `#1F1E1B` rounded tile with an orange `❯` prompt glyph. Generated from an SVG
  source checked into `web/public/icons/`; conversion via a one-off script (e.g.
  `sharp` as a devDependency). If PNG generation proves awkward on this machine,
  ship the color/metadata changes and keep existing icons as a follow-up — do not
  block the retheme on icon rendering.

## 6. Implementation approach

**Token flip first, then chrome pass feature-by-feature.**

1. **Foundation:** App.css rewrite (palette, fonts, radii, new keyframes, utility
   remaps), fonts swap in package.json, PWA metadata. → App is instantly ~80% themed.
2. **Primitives:** `shared/ui/*` (button, card, input, textarea, sheet, dialog,
   badge, etc.) + sonner config in App.tsx.
3. **Shared components:** `PromptHeading` (new), `SectionHeader`, `Pill`, `Stat`,
   `EmptyState`, `ConfirmDialog`, nav/status-line in App.tsx, LoadingState spinner.
4. **Screen passes (verify each in browser before moving on):** today → workout
   (biggest: 18 files — ExerciseCard, SetRow, SetDots, Keypad, SetLogSheet,
   SupersetGroup, RestTimerBar, SessionProgress) → history (3 screens +
   sparkline) → settings (+ import screen) → onboarding (wizard, 17 files).
5. **Cleanup:** remove sage aliases and dead font imports; sweep for missed
   `sage`/serif references; run full test suite + build + E2E; visual check on
   mobile viewport (Pixel 7 dimensions).

Each phase ends with `npm test` green and a dev-server visual check.

## 7. Risks

- **Mono width:** long exercise names / labels wrap or truncate differently —
  checked per screen during the pass.
- **Glyph rendering on Android:** decorative-only, so a fallback glyph face is
  cosmetically imperfect but harmless.
- **RTL tests asserting styles:** a handful may reference sage classes; updated to
  new tokens as encountered.
- **Contrast:** orange-on-dark and dim text tiers are checked against WCAG AA for
  body text (`--ink-3` on `--paper` must stay ≥ 4.5:1 for meta text it's used on).

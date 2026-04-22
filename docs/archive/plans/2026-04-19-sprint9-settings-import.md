# Sprint 9 — Settings + Routine Import ("Quiet Corners") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Settings screen and Routine Import flow to the warm-paper visual system per spec §3 Sprint 9. Settings gets a "PREFERENCES" eyebrow + italic serif "Settings" title + `ActiveRoutineCard` + Display group with `UnitsToggle` + Data group as `RowLink`s (Import routine / Export / Import backup / Clear all data) + About card. Routine Import moves to its own `/settings/import` route with a monospace textarea, paste-or-upload entry points, a "Replace active routine" primary CTA, and inline field-level YAML error messages (e.g. "Day A · Entry 3 · sets: must be ≥ 1").

**Architecture:** The current `SettingsScreen` composes everything inline in a single 220-line file using legacy tokens (`bg-cta`, `border-border-strong`, Badge variants). Sprint 9 extracts four presentational primitives (`UnitsToggle`, `RowLink`, `SettingRow`, `ActiveRoutineCard`) plus a card (`AboutCard`) and a formatter (`YamlErrorList`) into `features/settings/`. `SettingsScreen` becomes a pure composition file. `RoutineImporter` moves from inline-inside-Settings to a full-page route at `/settings/import`, reached via a `RowLink`. Field-level YAML error UI re-uses the existing `ValidationError[]` return from `routine-service`; we add a `formatErrorPath` util that turns `days.A.entries[2].sets` into a breadcrumb "Day A · Entry 3 · sets".

**Tech Stack:** React 19, Vite 7 (with a new `define` for `__APP_VERSION__`), TypeScript 5, Tailwind 4 (CSS-first), `@base-ui/react`, `react-router`, Vitest + React Testing Library, Playwright, Sprint 6 foundation tokens + Sprint 8 `features/history/` pattern.

**Source spec:** `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 9.

**Design canon:** `docs/claude_design_handoffs/screenshots/4-settings.jpg`. Per spec §4 "Handoff doc vs. prototype" the prototype is authoritative.

**Baseline:** 599 tests passing on `main` (HEAD `3a44e08`, Sprint 8 merged). Sprint 9 forks `sprint-9-settings` off `main`.

---

## Resolved open questions (pre-decided for this plan)

Three open questions existed from the spec; pre-decided here:

1. **YAML error structure:** flat list of field-level errors, each rendered as its own row inside a danger-tinted card. Rows show: path (breadcrumb format via `formatErrorPath`) as eyebrow, message as body. Example: `days.A.entries[2].sets` → "Day A · Entry 3 · sets", paired with message "must be ≥ 1". No summary/collapse — every error visible at once. The existing `validateAndNormalizeRoutine` already returns `ValidationError[]` with `{ path, message }`, so we're improving presentation, not validation.

2. **About content:** version pulled at build time from `package.json` via a Vite `define` exposing `__APP_VERSION__` as a global string. Copy:
   - Title: "Exercise Logger"
   - Tagline: "Offline-first gym logger"
   - Body: "Your workouts stay on this device. No account, no sync, no tracking."
   - Footer: "Version " + `__APP_VERSION__`

   No repo link, no build hash — the app is single-user and install-once.

3. **Install prompt:** restyled to `RowLink` pattern, placed in a dedicated "APP" group above "DATA". Only rendered when `useInstallPrompt().canInstall` is true. Tap triggers `promptInstall()`. Matches handoff's row-based rhythm.

Also pre-decided:
- **Import UI route:** `/settings/import`. SettingsScreen "DATA" group has a `RowLink` labelled "Import routine (YAML) · Load a new plan" that navigates there. The route renders a dedicated full-screen component (`RoutineImportScreen`) with its own back-to-Settings header + reskinned textarea + "Replace active routine" primary CTA + `YamlErrorList`.
- **Existing JSON-backup import/export stays inline** inside SettingsScreen's Data group as `RowLink`s (Export data, Import backup, Clear all data). Different from routine YAML — backup is the "restore all state" path, routine YAML is the "load a new plan" path. Both preserved.
- **Other routines (multi-routine management):** `RoutineList` stays, reskinned minimally, rendered as a subtle "Other routines" section **below** the `ActiveRoutineCard`, shown only when `routines.length > 1`. Removes the big "Active" badge from RoutineList (the card above already communicates that). Keeps activate + delete affordances for operational users.
- **"Replace active routine" CTA:** wording change from "Import from text" / "Import from file". The CTA fires the same service (`validateParseAndImportRoutine`) — importing a routine replaces whichever routine was previously active (`importRoutine` puts over the record).

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `web/src/features/settings/lib/formatErrorPath.ts` | `formatErrorPath(path)` → breadcrumb string. Handles YAML path shapes like `days.A.entries[2].sets`, `days.A.entries[2].items[0].exercise`, `name`, `version`. |
| `web/src/features/settings/UnitsToggle.tsx` | Two-segment pill toggle (KG / LBS). Sage-soft selected state. |
| `web/src/features/settings/RowLink.tsx` | Row primitive: label + sublabel + right-side affordance (chevron by default, custom `<slot>` accepted). Accepts `onClick` OR `to` — renders `<button>` or `<Link>` accordingly. |
| `web/src/features/settings/SettingRow.tsx` | Display-group row: label + sublabel + right-side control slot (UnitsToggle, etc.). Static container — no click handler. |
| `web/src/features/settings/ActiveRoutineCard.tsx` | Active routine card: eyebrow "ACTIVE ROUTINE" + routine name + meta line `{n} days · A · B · C · rest {restDefaultSec}s`. |
| `web/src/features/settings/AboutCard.tsx` | Title + tagline + description + version. Reads `__APP_VERSION__`. |
| `web/src/features/settings/YamlErrorList.tsx` | Renders `ValidationError[]` as a stacked list inside a danger-tinted card. |
| `web/src/features/settings/RoutineImportScreen.tsx` | Full-screen route for routine YAML import. Replaces the old inline `RoutineImporter` (which is deleted). Header with back-to-Settings link + eyebrow + serif "Import routine" + paste/file UI + `YamlErrorList`. |
| `web/src/vite-env.d.ts` (or extend existing) | `declare const __APP_VERSION__: string;` — TS ambient declaration for the Vite define. |
| Tests for each: `web/tests/unit/features/settings/lib/formatErrorPath.test.ts`, `UnitsToggle.test.tsx`, `RowLink.test.tsx`, `SettingRow.test.tsx`, `ActiveRoutineCard.test.tsx`, `AboutCard.test.tsx`, `YamlErrorList.test.tsx` |

### Modified files

| Path | Change |
|---|---|
| `web/vite.config.ts` | Add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`. Import pkg at top. |
| `web/src/app/App.tsx` | Register new route `/settings/import` → lazy-loaded `RoutineImportScreen`. |
| `web/src/features/settings/SettingsScreen.tsx` | Rewrite: eyebrow + serif title + ActiveRoutineCard + "Other routines" (conditional RoutineList below) + DISPLAY group (UnitsToggle via SettingRow) + APP group (conditional Install RowLink) + DATA group (4 RowLinks: Import routine → `/settings/import`, Export, Import backup, Clear all data) + AboutCard. |
| `web/src/features/settings/RoutineList.tsx` | Minimal reskin: drop `bg-cta` badge, drop `border-border-strong` → `border-line`, drop the "Active" badge entirely (active card above owns that signal), rename header ("Other routines"). Wrap in a `<Card>` for visual consistency. Preserve activate / delete behaviour. |
| `web/src/features/settings/RoutineImporter.tsx` | **Deleted** — replaced by `RoutineImportScreen.tsx`. (The service calls remain in the new screen.) |
| `CLAUDE.md` | Update test count. |

### Deleted files

| Path | Reason |
|---|---|
| `web/src/features/settings/RoutineImporter.tsx` | Moved into standalone `RoutineImportScreen.tsx` route. |

### Out of scope for this plan (per spec §3 Sprint 9)

- Theme toggle — permanently removed in a prior sprint; do not reintroduce.
- Density / accent / numeralStyle user-facing toggles — committed to `sage / medium / sans` in Sprint 6, no UI exposure.
- Lucide → custom-icon migration — Sprint 12 handles the sweep.
- New routines-management flow (e.g. dedicated "Manage routines" screen) — keep the inline `RoutineList` below the active card for now.

### Branch note

`feat/hero-muscle-summary` (origin-only, unmerged) modifies `TodayHeroCard`. Sprint 9 does not touch Today; no collision risk. Sprint 10 planning will need to resolve that branch's fate.

---

## Task 0: Branch setup + baseline check

**Files:** none

- [ ] **Step 1: Confirm `main` is at Sprint 8's merge commit (or later)**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -3
```
Expected top commit: `3a44e08 docs(plans): Sprint 8 history + session detail implementation plan` (or a hotfix successor).

- [ ] **Step 2: Create the Sprint 9 worktree**

```bash
git worktree add "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings" -b sprint-9-settings main
```

Expected: worktree created at the sibling path on branch `sprint-9-settings`.

- [ ] **Step 3: Install deps in the worktree**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings/web"
npm install --no-audit --no-fund
```
Expected: `added ~818 packages`. No errors.

- [ ] **Step 4: Baseline unit test run**

```bash
npx vitest run --reporter=default 2>&1 | tail -6
```
Expected: `Tests  599 passed (599)`. If not, stop.

- [ ] **Step 5: Baseline lint + build**

```bash
npm run lint && npm run build
```
Expected: both clean. `dist/` contains Inter + Instrument Serif WOFF2s.

- [ ] **Step 6: No commit — orientation only.**

---

## Task 9.1: `formatErrorPath` util

**Files:**
- Create: `web/src/features/settings/lib/formatErrorPath.ts`
- Create: `web/tests/unit/features/settings/lib/formatErrorPath.test.ts`

TDD. End state: 609 tests passing (599 + 10 new), one commit.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/lib/formatErrorPath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatErrorPath } from "@/features/settings/lib/formatErrorPath";

describe("formatErrorPath", () => {
  it("returns 'Root' for empty path (top-level error)", () => {
    expect(formatErrorPath("")).toBe("Root");
  });

  it("returns a top-level field name capitalized", () => {
    expect(formatErrorPath("name")).toBe("Name");
    expect(formatErrorPath("version")).toBe("Version");
  });

  it("formats a day entry path as 'Day A · Entry N · field'", () => {
    expect(formatErrorPath("days.A.entries[0].sets")).toBe("Day A · Entry 1 · sets");
  });

  it("1-indexes entries (entries[2] renders as 'Entry 3')", () => {
    expect(formatErrorPath("days.B.entries[2].exercise")).toBe("Day B · Entry 3 · exercise");
  });

  it("formats superset item paths", () => {
    expect(formatErrorPath("days.A.entries[1].items[0].exercise")).toBe(
      "Day A · Entry 2 · Item 1 · exercise"
    );
  });

  it("formats set-block paths", () => {
    expect(formatErrorPath("days.A.entries[0].set_blocks[1].count")).toBe(
      "Day A · Entry 1 · set block 2 · count"
    );
  });

  it("formats cardio section paths", () => {
    expect(formatErrorPath("cardio.options[0].name")).toBe("Cardio · Option 1 · name");
  });

  it("formats day_order paths", () => {
    expect(formatErrorPath("day_order")).toBe("Day order");
  });

  it("falls back gracefully for unrecognised paths", () => {
    expect(formatErrorPath("foo.bar.baz")).toBe("foo · bar · baz");
  });

  it("handles bracket-only paths like 'entries[0]' stripped of parent", () => {
    // Defensive: if validation ever emits a partial path, we don't crash.
    expect(formatErrorPath("entries[0]")).toBe("Entry 1");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/settings/lib/formatErrorPath.test.ts
```
Expected: FAIL with "Cannot find module '@/features/settings/lib/formatErrorPath'".

- [ ] **Step 3: Implement**

Create `web/src/features/settings/lib/formatErrorPath.ts`:

```ts
/**
 * Turn a machine-readable YAML validation path (e.g. "days.A.entries[2].sets")
 * into a user-readable breadcrumb (e.g. "Day A · Entry 3 · sets").
 *
 * Conversions:
 *   - ""                                      → "Root"
 *   - "name" / "version" / "day_order"        → title-cased
 *   - "days.X..."                             → "Day X · ..."
 *   - "entries[N]..."                         → "Entry {N+1} · ..."  (1-indexed)
 *   - "items[N]..."                           → "Item {N+1} · ..."
 *   - "set_blocks[N]..."                      → "set block {N+1} · ..."
 *   - "cardio.options[N]..."                  → "Cardio · Option {N+1} · ..."
 *   - any unknown token                       → kept verbatim, joined with " · "
 */
export function formatErrorPath(path: string): string {
  if (path === "") return "Root";

  const TOP_LEVEL: Record<string, string> = {
    name: "Name",
    version: "Version",
    day_order: "Day order",
    rest_default_sec: "Rest default",
    rest_superset_sec: "Rest superset",
    notes: "Notes",
  };
  if (TOP_LEVEL[path] !== undefined) return TOP_LEVEL[path]!;

  const segments: string[] = [];

  // Split on dots but keep bracketed indices attached to their token.
  // "days.A.entries[2].sets" → ["days", "A", "entries[2]", "sets"]
  const parts = path.split(".");

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const bracketMatch = part.match(/^([a-z_]+)\[(\d+)\]$/);

    if (bracketMatch) {
      const [, name, idxStr] = bracketMatch;
      const idx = Number(idxStr) + 1;
      if (name === "entries") segments.push(`Entry ${idx}`);
      else if (name === "items") segments.push(`Item ${idx}`);
      else if (name === "set_blocks") segments.push(`set block ${idx}`);
      else if (name === "options") segments.push(`Option ${idx}`);
      else segments.push(`${name} ${idx}`);
      continue;
    }

    if (part === "days" && i + 1 < parts.length) {
      // Consume the next segment as the day ID.
      const dayId = parts[i + 1]!;
      segments.push(`Day ${dayId}`);
      i++;
      continue;
    }

    if (part === "cardio") {
      segments.push("Cardio");
      continue;
    }

    // Unknown segment — keep as-is.
    segments.push(part);
  }

  return segments.join(" · ");
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/settings/lib/formatErrorPath.test.ts
```
Expected: 10 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 609 passing (599 + 10).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/lib/formatErrorPath.ts \
        web/tests/unit/features/settings/lib/formatErrorPath.test.ts
git commit -m "feat(settings): add formatErrorPath util for YAML error breadcrumbs"
```

---

## Task 9.2: `UnitsToggle` component

**Files:**
- Create: `web/src/features/settings/UnitsToggle.tsx`
- Create: `web/tests/unit/features/settings/UnitsToggle.test.tsx`

Two-segment pill toggle for kg/lbs. End state: 614 tests passing (+5), one commit.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/UnitsToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitsToggle } from "@/features/settings/UnitsToggle";

describe("UnitsToggle", () => {
  it("renders both kg and lbs segments", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /kg/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /lbs/i })).toBeVisible();
  });

  it("marks the selected segment with aria-pressed='true'", () => {
    render(<UnitsToggle value="lbs" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /kg/i }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /lbs/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("applies sage-soft styling to the selected segment", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    const kg = screen.getByRole("button", { name: /kg/i });
    expect(kg.className).toMatch(/bg-sage-soft|bg-primary/);
  });

  it("calls onChange('lbs') when LBS is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<UnitsToggle value="kg" onChange={spy} />);
    await user.click(screen.getByRole("button", { name: /lbs/i }));
    expect(spy).toHaveBeenCalledWith("lbs");
  });

  it("does not call onChange when the already-selected value is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<UnitsToggle value="kg" onChange={spy} />);
    await user.click(screen.getByRole("button", { name: /kg/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/features/settings/UnitsToggle.test.tsx
```

- [ ] **Step 3: Implement**

Create `web/src/features/settings/UnitsToggle.tsx`:

```tsx
import type { UnitSystem } from "@/domain/enums";

interface UnitsToggleProps {
  value: UnitSystem;
  onChange: (next: UnitSystem) => void;
}

const OPTIONS: readonly UnitSystem[] = ["kg", "lbs"];

export function UnitsToggle({ value, onChange }: UnitsToggleProps) {
  return (
    <div
      role="group"
      aria-label="Units"
      className="inline-flex items-center rounded-[var(--radius-pill)] bg-card p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onChange(option);
            }}
            className={
              "inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 " +
              (selected
                ? "bg-primary text-primary-foreground"
                : "text-ink-3 hover:text-foreground")
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
```

> **Note on selected styling:** `bg-primary` (which points at `--ink`) gives the dark pill on paper look from `screenshots/4-settings.jpg`. The alternative (`bg-sage-soft`) would be lighter and less intentional here. The screenshot confirms dark ink pill.

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/features/settings/UnitsToggle.test.tsx
```
Expected: 5 passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 614.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/UnitsToggle.tsx \
        web/tests/unit/features/settings/UnitsToggle.test.tsx
git commit -m "feat(settings): add UnitsToggle pill component"
```

---

## Task 9.3: `RowLink` primitive

**Files:**
- Create: `web/src/features/settings/RowLink.tsx`
- Create: `web/tests/unit/features/settings/RowLink.test.tsx`

Row primitive — rendered as `<button>` (when `onClick`) or `<Link>` (when `to`). Shows label + sublabel + right-side chevron by default. `variant="destructive"` tints the label red. End state: 621 tests passing (+7), one commit.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/RowLink.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { RowLink } from "@/features/settings/RowLink";

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("RowLink", () => {
  it("renders label and sublabel", () => {
    renderInRouter(<RowLink label="Export data" sublabel="Download JSON backup" onClick={() => {}} />);
    expect(screen.getByText("Export data")).toBeVisible();
    expect(screen.getByText("Download JSON backup")).toBeVisible();
  });

  it("renders a <button> when onClick is provided", () => {
    renderInRouter(<RowLink label="Export" onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /export/i })).toBeVisible();
  });

  it("renders a <Link> when to is provided", () => {
    renderInRouter(<RowLink label="Import routine" to="/settings/import" />);
    const link = screen.getByRole("link", { name: /import routine/i });
    expect(link.getAttribute("href")).toBe("/settings/import");
  });

  it("calls onClick when the button is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    renderInRouter(<RowLink label="Export" onClick={spy} />);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    renderInRouter(<RowLink label="Import" onClick={spy} disabled />);
    const btn = screen.getByRole("button", { name: /import/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
    await user.click(btn);
    expect(spy).not.toHaveBeenCalled();
  });

  it("tints the label red when variant='destructive'", () => {
    renderInRouter(<RowLink label="Clear all data" onClick={() => {}} variant="destructive" />);
    const label = screen.getByText("Clear all data");
    expect(label.className).toMatch(/text-destructive|text-danger/);
  });

  it("renders a chevron by default", () => {
    const { container } = renderInRouter(<RowLink label="Export" onClick={() => {}} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

- [ ] **Step 3: Implement**

Create `web/src/features/settings/RowLink.tsx`:

```tsx
import { Link } from "react-router";
import { Chevron } from "@/shared/icons";

type RowLinkVariant = "default" | "destructive";

interface BaseProps {
  label: string;
  sublabel?: string;
  variant?: RowLinkVariant;
  disabled?: boolean;
}

interface ButtonRowLinkProps extends BaseProps {
  onClick: () => void;
  to?: never;
}

interface LinkRowLinkProps extends BaseProps {
  to: string;
  onClick?: never;
}

type RowLinkProps = ButtonRowLinkProps | LinkRowLinkProps;

const BASE_CLASSES =
  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:pointer-events-none disabled:opacity-50 hover:bg-sage-soft/40";

export function RowLink(props: RowLinkProps) {
  const { label, sublabel, variant = "default", disabled } = props;
  const labelClass =
    variant === "destructive"
      ? "text-sm font-semibold text-destructive"
      : "text-sm font-semibold text-foreground";

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className={labelClass}>{label}</p>
        {sublabel && <p className="text-meta">{sublabel}</p>}
      </div>
      <Chevron direction="right" className="shrink-0 text-ink-3" />
    </>
  );

  if ("to" in props && props.to !== undefined) {
    return (
      <Link to={props.to} className={BASE_CLASSES} aria-disabled={disabled || undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      className={BASE_CLASSES}
    >
      {content}
    </button>
  );
}
```

- [ ] **Step 4: Run tests — expect 7 passing.**

- [ ] **Step 5: Full suite — 621 passing.**

- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/RowLink.tsx \
        web/tests/unit/features/settings/RowLink.test.tsx
git commit -m "feat(settings): add RowLink primitive (button or link with chevron)"
```

---

## Task 9.4: `SettingRow` primitive

**Files:**
- Create: `web/src/features/settings/SettingRow.tsx`
- Create: `web/tests/unit/features/settings/SettingRow.test.tsx`

Static row: label + sublabel + right-side control slot. Used inside Display group to pair labels with toggles. End state: 625 tests passing (+4).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/SettingRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingRow } from "@/features/settings/SettingRow";

describe("SettingRow", () => {
  it("renders label and sublabel", () => {
    render(
      <SettingRow label="Units" sublabel="Weight display">
        <button>toggle</button>
      </SettingRow>
    );
    expect(screen.getByText("Units")).toBeVisible();
    expect(screen.getByText("Weight display")).toBeVisible();
  });

  it("renders the control slot on the right", () => {
    render(
      <SettingRow label="Units" sublabel="Weight display">
        <button data-testid="control">toggle</button>
      </SettingRow>
    );
    expect(screen.getByTestId("control")).toBeVisible();
  });

  it("omits the sublabel node when sublabel is not provided", () => {
    const { container } = render(
      <SettingRow label="Units">
        <button>toggle</button>
      </SettingRow>
    );
    // Only one <p> should render (the label), no sublabel <p>.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("label typography is sm semibold foreground", () => {
    render(
      <SettingRow label="Units">
        <span>x</span>
      </SettingRow>
    );
    const label = screen.getByText("Units");
    expect(label.className).toMatch(/text-sm/);
    expect(label.className).toMatch(/font-semibold/);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

- [ ] **Step 3: Implement**

Create `web/src/features/settings/SettingRow.tsx`:

```tsx
import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  sublabel?: string;
  children: ReactNode;
}

export function SettingRow({ label, sublabel, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {sublabel && <p className="text-meta">{sublabel}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Tests — 4 pass.**
- [ ] **Step 5: Full suite — 625.**
- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/SettingRow.tsx \
        web/tests/unit/features/settings/SettingRow.test.tsx
git commit -m "feat(settings): add SettingRow primitive (label + sublabel + control slot)"
```

---

## Task 9.5: `ActiveRoutineCard`

**Files:**
- Create: `web/src/features/settings/ActiveRoutineCard.tsx`
- Create: `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx`

Card showing active routine: eyebrow "ACTIVE ROUTINE" + name + meta. End state: 631 (+6).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/ActiveRoutineCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveRoutineCard } from "@/features/settings/ActiveRoutineCard";
import type { Routine } from "@/domain/types";

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Full Body 3-Day Rotation",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A", "B", "C"],
    nextDayId: "A",
    days: {
      A: { id: "A", label: "Heavy", entries: [] },
      B: { id: "B", label: "Moderate", entries: [] },
      C: { id: "C", label: "Unilateral", entries: [] },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("ActiveRoutineCard", () => {
  it("renders the 'ACTIVE ROUTINE' eyebrow", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText(/active routine/i)).toBeVisible();
  });

  it("renders the routine name", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText("Full Body 3-Day Rotation")).toBeVisible();
  });

  it("renders a meta line with day count, day labels, and rest", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText(/3 days · A · B · C · rest 90s/)).toBeVisible();
  });

  it("singularises '1 day' when there's only one day", () => {
    render(<ActiveRoutineCard routine={makeRoutine({ dayOrder: ["A"] })} />);
    expect(screen.getByText(/1 day · A · rest 90s/)).toBeVisible();
  });

  it("renders null when routine is undefined (loading state)", () => {
    const { container } = render(<ActiveRoutineCard routine={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when routine is null (no active routine)", () => {
    const { container } = render(<ActiveRoutineCard routine={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

- [ ] **Step 3: Implement**

Create `web/src/features/settings/ActiveRoutineCard.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";
import type { Routine } from "@/domain/types";

interface ActiveRoutineCardProps {
  routine: Routine | null | undefined;
}

export function ActiveRoutineCard({ routine }: ActiveRoutineCardProps) {
  if (!routine) return null;

  const dayCount = routine.dayOrder.length;
  const dayPart = `${dayCount} ${dayCount === 1 ? "day" : "days"}`;
  const dayList = routine.dayOrder.join(" · ");
  const meta = `${dayPart} · ${dayList} · rest ${routine.restDefaultSec}s`;

  return (
    <Card className="py-0">
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-eyebrow text-ink-3">Active Routine</p>
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {routine.name}
        </h2>
        <p className="text-meta tabular-nums">{meta}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Tests — 6 pass.**
- [ ] **Step 5: Full suite — 631.**
- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/ActiveRoutineCard.tsx \
        web/tests/unit/features/settings/ActiveRoutineCard.test.tsx
git commit -m "feat(settings): add ActiveRoutineCard (eyebrow + name + meta)"
```

---

## Task 9.6: `YamlErrorList` component

**Files:**
- Create: `web/src/features/settings/YamlErrorList.tsx`
- Create: `web/tests/unit/features/settings/YamlErrorList.test.tsx`

Renders `ValidationError[]` as a list of breadcrumb-path + message rows inside a danger-tinted card. End state: 636 (+5).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/YamlErrorList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YamlErrorList } from "@/features/settings/YamlErrorList";

describe("YamlErrorList", () => {
  it("renders nothing when errors is empty", () => {
    const { container } = render(<YamlErrorList errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each error with breadcrumb path and message", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "days.A.entries[2].sets", message: "must be ≥ 1" },
          { path: "name", message: "must be a non-empty string" },
        ]}
      />
    );
    expect(screen.getByText(/Day A · Entry 3 · sets/)).toBeVisible();
    expect(screen.getByText(/must be ≥ 1/)).toBeVisible();
    expect(screen.getByText(/Name/)).toBeVisible();
    expect(screen.getByText(/must be a non-empty string/)).toBeVisible();
  });

  it("wraps the list in role='alert' with aria-live='assertive'", () => {
    const { container } = render(
      <YamlErrorList errors={[{ path: "name", message: "required" }]} />
    );
    const alert = container.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
  });

  it("shows a summary count in the header", () => {
    render(
      <YamlErrorList
        errors={[
          { path: "name", message: "required" },
          { path: "version", message: "must be 1" },
        ]}
      />
    );
    expect(screen.getByText(/2 errors/i)).toBeVisible();
  });

  it("uses singular 'error' when there's one", () => {
    render(<YamlErrorList errors={[{ path: "name", message: "required" }]} />);
    expect(screen.getByText(/1 error/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

- [ ] **Step 3: Implement**

Create `web/src/features/settings/YamlErrorList.tsx`:

```tsx
import type { ValidationError } from "@/services/routine-service";
import { formatErrorPath } from "./lib/formatErrorPath";

interface YamlErrorListProps {
  errors: ValidationError[];
}

export function YamlErrorList({ errors }: YamlErrorListProps) {
  if (errors.length === 0) return null;

  const summary = `${errors.length} ${errors.length === 1 ? "error" : "errors"}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3"
    >
      <p className="text-eyebrow text-destructive">
        {summary}
      </p>
      <ul className="space-y-2">
        {errors.map((err, i) => (
          <li key={i} className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {formatErrorPath(err.path)}
            </p>
            <p className="text-sm text-foreground">{err.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> **Note on import:** `ValidationError` is exported from `@/services/routine-service` (checked in current source). No new type file needed.

- [ ] **Step 4: Tests — 5 pass.**
- [ ] **Step 5: Full suite — 636.**
- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/YamlErrorList.tsx \
        web/tests/unit/features/settings/YamlErrorList.test.tsx
git commit -m "feat(settings): add YamlErrorList with field-level breadcrumb paths"
```

---

## Task 9.7: Vite `define __APP_VERSION__` + TS declaration

**Files:**
- Modify: `web/vite.config.ts`
- Create: `web/src/globals.d.ts` (or extend existing `vite-env.d.ts` if present)

Wires the `package.json` version into a build-time constant. End state: 636 passing (no new tests — this is build infra), one commit.

- [ ] **Step 1: Check for an existing `vite-env.d.ts`**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings/web/src/vite-env.d.ts" 2>&1
```

If it exists, open it and append the declaration in Step 3. If it does not, create `web/src/globals.d.ts` in Step 3.

- [ ] **Step 2: Update `vite.config.ts`**

Add a package.json import and a `define` block. The minimal change is:

Open `web/vite.config.ts`. Near the top, add:

```ts
import pkg from "./package.json" with { type: "json" };
```

Inside the `defineConfig({ ... })` object, add the `define` key (alongside `base`, `plugins`, `resolve`, `test`):

```ts
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
```

Full diff example (illustrative — your actual file may have different surrounding config):

```ts
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  base: "/exercise-logger/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    // ... existing plugins
  ],
  // ... rest unchanged
});
```

- [ ] **Step 3: Declare the ambient constant for TypeScript**

If `web/src/vite-env.d.ts` exists, append:

```ts
declare const __APP_VERSION__: string;
```

If it does not exist, create `web/src/globals.d.ts` with:

```ts
/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc -b
```
Expected: clean. If `pkg.version` triggers a `resolveJsonModule` complaint, the `with { type: "json" }` import assertion handles it in Node ≥ 21; if it fails, fall back to `import pkg from "./package.json";` and ensure `tsconfig.json` has `resolveJsonModule: true` (it does by default).

- [ ] **Step 5: Build to confirm Vite replaces the token**

```bash
npm run build 2>&1 | tail -5
```
Expected: clean. The build output should not contain the literal `__APP_VERSION__` — it should be replaced by `"1.0.0"` (or current version). Quick verification:

```bash
grep -r "__APP_VERSION__" web/dist 2>/dev/null | head -3
```
Expected: no matches (Vite replaced every occurrence).

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: 636 pass (Vitest's jsdom environment will need the define at config level — Vitest inherits `define` from the Vite config by default, so no Vitest-specific setup needed).

- [ ] **Step 7: Commit**

```bash
git add web/vite.config.ts web/src/globals.d.ts web/src/vite-env.d.ts 2>/dev/null
git commit -m "build(vite): expose package.json version as __APP_VERSION__"
```

(`git add` will silently skip any of the paths that don't exist.)

---

## Task 9.8: `AboutCard`

**Files:**
- Create: `web/src/features/settings/AboutCard.tsx`
- Create: `web/tests/unit/features/settings/AboutCard.test.tsx`

About section: title + tagline + description + version. End state: 640 (+4).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/unit/features/settings/AboutCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

// Declare the Vite define so the component can read it in tests.
// Vitest inherits `define` from vite.config.ts, but we also set it here
// for defensive resilience if the config hasn't been reloaded.
declare const globalThis: typeof global & { __APP_VERSION__?: string };

beforeAll(() => {
  globalThis.__APP_VERSION__ = "9.9.9-test";
});
afterAll(() => {
  delete globalThis.__APP_VERSION__;
});

describe("AboutCard", () => {
  it("renders the title 'Exercise Logger'", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText("Exercise Logger")).toBeVisible();
  });

  it("renders the tagline", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText(/offline-first gym logger/i)).toBeVisible();
  });

  it("renders the description", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(
      screen.getByText(/your workouts stay on this device/i)
    ).toBeVisible();
  });

  it("renders the version from __APP_VERSION__", async () => {
    const { AboutCard } = await import("@/features/settings/AboutCard");
    render(<AboutCard />);
    expect(screen.getByText(/version 9\.9\.9-test/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

- [ ] **Step 3: Implement**

Create `web/src/features/settings/AboutCard.tsx`:

```tsx
import { Card, CardContent } from "@/shared/ui/card";

export function AboutCard() {
  return (
    <Card className="py-0">
      <CardContent className="space-y-2 px-5 py-4">
        <p className="font-heading text-base font-bold text-foreground">
          Exercise Logger
        </p>
        <p className="text-sm italic text-ink-2">Offline-first gym logger</p>
        <p className="text-meta">
          Your workouts stay on this device. No account, no sync, no tracking.
        </p>
        <p className="text-meta tabular-nums">Version {__APP_VERSION__}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Tests — 4 pass.**
- [ ] **Step 5: Full suite — 640.**
- [ ] **Step 6: Commit**

```bash
git add web/src/features/settings/AboutCard.tsx \
        web/tests/unit/features/settings/AboutCard.test.tsx
git commit -m "feat(settings): add AboutCard (title + tagline + version)"
```

---

## Task 9.9: `RoutineImportScreen` + register route

**Files:**
- Create: `web/src/features/settings/RoutineImportScreen.tsx`
- Modify: `web/src/app/App.tsx` — register route `/settings/import`
- **Delete:** `web/src/features/settings/RoutineImporter.tsx`

Full-page route for YAML routine import. Uses `YamlErrorList` and the "Replace active routine" primary CTA. End state: 640 passing (no new unit tests; RoutineImporter didn't have tests — it was only e2e-covered).

- [ ] **Step 1: Grep for existing imports of `RoutineImporter`**

```bash
grep -rn "RoutineImporter" web/src web/tests --include="*.ts" --include="*.tsx" 2>/dev/null
```

Expected: only one match — in `SettingsScreen.tsx`. If there are others, they'll need updating in Step 6 or the import will be dead.

- [ ] **Step 2: Create `RoutineImportScreen.tsx`**

```tsx
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Back } from "@/shared/icons";
import { db } from "@/db/database";
import {
  validateAndNormalizeRoutine,
  importRoutine,
  type ValidationError,
} from "@/services/routine-service";
import { YamlErrorList } from "./YamlErrorList";
import { toast } from "sonner";

const GPT_URL =
  "https://chatgpt.com/g/g-69d6e3c4c12881919a761d49dd32d373-ace-logger-routine-maker";

export default function RoutineImportScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [pastedYaml, setPastedYaml] = useState("");
  const navigate = useNavigate();

  async function runImport(yamlText: string): Promise<boolean> {
    if (!yamlText.trim()) {
      setErrors([{ path: "", message: "YAML is empty" }]);
      return false;
    }
    setErrors([]);
    setImporting(true);
    try {
      const exercises = await db.exercises.toArray();
      const lookup = new Map(exercises.map((ex) => [ex.id, ex]));
      const result = await validateAndNormalizeRoutine(yamlText, lookup);
      if (!result.ok) {
        setErrors(result.errors);
        return false;
      }
      await importRoutine(db, result.routine);
      toast.success(`Routine "${result.routine.name}" imported`);
      navigate("/settings");
      return true;
    } catch (err) {
      setErrors([
        {
          path: "",
          message: err instanceof Error ? err.message : "Import failed",
        },
      ]);
      return false;
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const yaml = await file.text();
    await runImport(yaml);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste() {
    await runImport(pastedYaml);
  }

  const canImport = !importing && pastedYaml.trim().length > 0;

  return (
    <div className="space-y-5 p-5 pb-8">
      <Link
        to="/settings"
        aria-label="Back to Settings"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-foreground hover:bg-sage-soft/50 transition-colors"
      >
        <Back />
      </Link>

      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Routine</p>
        <h1 className="text-hero-serif text-foreground">Import routine</h1>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">
        Go to{" "}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sage-deep underline underline-offset-2"
        >
          Ace Logger Routine Maker
        </a>{" "}
        and chat with the GPT about your personalised routine. Copy the YAML
        answer and paste it below.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="routine-yaml-paste"
          className="text-eyebrow text-ink-3"
        >
          Paste YAML
        </label>
        <textarea
          id="routine-yaml-paste"
          rows={10}
          placeholder="version: 1&#10;name: ..."
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          disabled={importing}
          className="w-full rounded-[var(--radius-card)] border border-line bg-card px-3 py-2 font-mono text-sm text-foreground transition-colors focus-visible:border-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:opacity-50"
        />
      </div>

      <Button
        variant="default"
        size="lg"
        className="w-full"
        disabled={!canImport}
        onClick={handlePaste}
      >
        {importing ? "Importing…" : "Replace active routine"}
      </Button>

      <div className="space-y-2">
        <p className="text-meta">Or import a file on your device:</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? "Importing…" : "Import from file"}
        </Button>
      </div>

      <YamlErrorList errors={errors} />
    </div>
  );
}
```

> **Note on service usage:** We call `validateAndNormalizeRoutine` + `importRoutine` directly rather than `validateParseAndImportRoutine` because the latter flattens `ValidationError[]` to `string[]`. We want the structured `ValidationError[]` to feed `YamlErrorList`. Same semantics, one less abstraction.

- [ ] **Step 3: Register the route in `App.tsx`**

Open `web/src/app/App.tsx`. Add a `lazy` import near the other screen imports:

```tsx
const RoutineImportScreen = lazy(
  () => import("@/features/settings/RoutineImportScreen"),
);
```

Inside the `<Routes>` block, add the new route (before the `<Route path="*" />` catch-all):

```tsx
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/import" element={<RoutineImportScreen />} />
```

While here, add a clarifying TODO comment above the `/history/exercise/:exerciseId` route to mark it orphaned per the Sprint 8 review:

```tsx
          <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
          {/* Orphaned as of Sprint 8 — no in-app link; Sprint 12 reintroduces navigation. */}
          <Route
            path="/history/exercise/:exerciseId"
            element={<ExerciseHistoryScreen />}
          />
```

- [ ] **Step 4: Delete `RoutineImporter.tsx`**

```bash
rm web/src/features/settings/RoutineImporter.tsx
```

(`SettingsScreen.tsx` will be rewritten in Task 9.10 so its `RoutineImporter` import is removed then. In the meantime, running the app from this commit would fail — that's fine inside a single sprint's sequential tasks. If you want to keep main green at every commit, defer the `rm` to Task 9.10; your call.)

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

If `SettingsScreen.tsx` still imports `RoutineImporter`, TS will complain. That's expected — move the `rm` into the beginning of Task 9.10 if you prefer a clean commit here, and commit the screen + route addition alone in Task 9.9.

**Recommended order for cleanest commits:**
- Task 9.9: add `RoutineImportScreen.tsx`, register route, do NOT yet delete `RoutineImporter.tsx`.
- Task 9.10: rewrite `SettingsScreen.tsx` (removes the import) and `git rm RoutineImporter.tsx` in the same commit.

Adjust accordingly. Below assumes the deferred-delete ordering.

- [ ] **Step 6: Tests + lint**

```bash
npm test && npm run lint
```
Expected: 640 pass, lint clean. If any e2e test selects the inline routine importer DOM, those will break in Task 9.10's verification; fix there.

- [ ] **Step 7: Commit**

```bash
git add web/src/features/settings/RoutineImportScreen.tsx \
        web/src/app/App.tsx
git commit -m "feat(settings): add /settings/import route and RoutineImportScreen"
```

---

## Task 9.10: Rewrite `SettingsScreen` + restyle `RoutineList` + delete old `RoutineImporter`

**Files:**
- Modify: `web/src/features/settings/SettingsScreen.tsx` (complete rewrite)
- Modify: `web/src/features/settings/RoutineList.tsx` (minimal reskin)
- **Delete:** `web/src/features/settings/RoutineImporter.tsx`

End state: 640 unit tests (no new unit tests; flow is integration-level). One commit.

- [ ] **Step 1: Rewrite `SettingsScreen.tsx`**

Replace the entire contents with:

```tsx
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSettings } from "@/shared/hooks/useSettings";
import { useAllRoutines, useRoutine } from "@/shared/hooks/useRoutine";
import { useActiveSession } from "@/shared/hooks/useActiveSession";
import { useInstallPrompt } from "@/shared/hooks/useInstallPrompt";
import { db } from "@/db/database";
import { setUnits } from "@/services/settings-service";
import {
  exportBackup,
  downloadBackupFile,
  importBackup,
  clearAllData,
  readJsonFile,
  validateBackupPayload,
  type BackupEnvelope,
} from "@/services/backup-service";
import type { UnitSystem } from "@/domain/enums";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ActiveRoutineCard } from "./ActiveRoutineCard";
import { AboutCard } from "./AboutCard";
import { RoutineList } from "./RoutineList";
import { RowLink } from "./RowLink";
import { SettingRow } from "./SettingRow";
import { UnitsToggle } from "./UnitsToggle";
import { Card } from "@/shared/ui/card";
import { toast } from "sonner";

export default function SettingsScreen() {
  const settings = useSettings();
  const routines = useAllRoutines();
  const activeRoutine = useRoutine(settings?.activeRoutineId);
  const activeSession = useActiveSession();
  const { canInstall, promptInstall } = useInstallPrompt();
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  if (!settings || routines === undefined) return null;

  const hasActive = activeSession !== undefined && activeSession !== null;
  const otherRoutines = routines.filter((r) => r.id !== settings.activeRoutineId);

  function handleUnits(units: UnitSystem) {
    setUnits(db, units);
  }

  async function handleExport() {
    const envelope = await exportBackup(db);
    downloadBackupFile(envelope);
    toast.success("Backup exported");
  }

  async function handleJsonImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors([]);
    try {
      const raw = await readJsonFile(file);
      const exercises = await db.exercises.toArray();
      const catalogIds = new Set(exercises.map((ex) => ex.id));
      const errors = validateBackupPayload(raw, catalogIds);
      if (errors.length > 0) {
        setImportErrors(errors.map((err) => `${err.field}: ${err.message}`));
        return;
      }
      const result = await importBackup(db, raw as BackupEnvelope);
      if (result.hasActiveSession) {
        toast.success("Data imported. Resuming active session…");
        navigate("/workout");
      } else {
        toast.success("Data imported successfully.");
      }
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  }

  async function handleClear() {
    await clearAllData(db);
    toast.success("All data cleared");
    navigate("/");
  }

  return (
    <div className="space-y-6 p-5 pb-8">
      <div className="space-y-1">
        <p className="text-eyebrow text-ink-3">Preferences</p>
        <h1 className="text-hero-serif italic text-foreground">Settings</h1>
      </div>

      {/* Routines */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Routine</p>
        <ActiveRoutineCard routine={activeRoutine ?? null} />
        {otherRoutines.length > 0 && (
          <RoutineList
            routines={otherRoutines}
            activeRoutineId={settings.activeRoutineId}
            hasActiveSession={hasActive}
          />
        )}
      </div>

      {/* Display */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Display</p>
        <Card className="py-0">
          <SettingRow label="Units" sublabel="Weight display">
            <UnitsToggle value={settings.units} onChange={handleUnits} />
          </SettingRow>
        </Card>
      </div>

      {/* App (install) */}
      {canInstall && (
        <div className="space-y-3">
          <p className="text-eyebrow text-ink-3">App</p>
          <Card className="py-0">
            <RowLink
              label="Install app"
              sublabel="Faster launch, works offline"
              onClick={() => {
                void promptInstall();
              }}
            />
          </Card>
        </div>
      )}

      {/* Data */}
      <div className="space-y-3">
        <p className="text-eyebrow text-ink-3">Data</p>
        <Card className="py-0 divide-y divide-line">
          <RowLink
            label="Import routine (YAML)"
            sublabel="Load a new plan"
            to="/settings/import"
          />
          <RowLink
            label="Export data"
            sublabel="Download a JSON backup"
            onClick={handleExport}
          />
          <RowLink
            label="Import data"
            sublabel="Restore from JSON backup"
            onClick={() => jsonInputRef.current?.click()}
            disabled={hasActive}
          />
          <RowLink
            label="Clear all data"
            sublabel="Delete every routine, workout, and setting"
            onClick={() => setClearOpen(true)}
            disabled={hasActive}
            variant="destructive"
          />
        </Card>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          onChange={handleJsonImport}
          className="hidden"
        />
        {hasActive && (
          <p className="text-meta">
            Finish or discard your current workout before importing or clearing.
          </p>
        )}
        {importErrors.length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-1">
            {importErrors.map((err, i) => (
              <p key={i} className="text-sm text-foreground">{err}</p>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <AboutCard />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all data?"
        description="This will permanently delete all routines, workouts, and history. This cannot be undone."
        confirmText="Clear All Data"
        onConfirm={handleClear}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    </div>
  );
}
```

> **Note on `useRoutine`:** `useRoutine(activeRoutineId)` is expected to exist in `@/shared/hooks/useRoutine`. The `TodayScreen` uses it already. If the hook only returns `Routine | null | undefined`, that's exactly what `ActiveRoutineCard` accepts.

- [ ] **Step 2: Reskin `RoutineList.tsx`**

Replace the entire contents with:

```tsx
import { useState } from "react";
import type { Routine } from "@/domain/types";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { db } from "@/db/database";
import { setActiveRoutine, deleteRoutine } from "@/services/settings-service";
import { toast } from "sonner";

interface RoutineListProps {
  routines: Routine[];
  activeRoutineId: string | null;
  hasActiveSession: boolean;
}

export function RoutineList({
  routines,
  activeRoutineId,
  hasActiveSession,
}: RoutineListProps) {
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);

  async function handleActivate(routineId: string) {
    await setActiveRoutine(db, routineId);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRoutine(db, deleteTarget.id);
    toast.success("Routine deleted");
    setDeleteTarget(null);
  }

  if (routines.length === 0) return null;

  return (
    <>
      <p className="text-eyebrow text-ink-3">Other routines</p>
      <Card className="py-0 divide-y divide-line">
        {routines.map((routine) => (
          <div
            key={routine.id}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {routine.name}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={hasActiveSession}
                onClick={() => handleActivate(routine.id)}
              >
                Set active
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={hasActiveSession}
                onClick={() => setDeleteTarget(routine)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </Card>
      {hasActiveSession && (
        <p className="text-meta">
          Finish or discard your current workout first.
        </p>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete routine?"
        description={
          deleteTarget?.id === activeRoutineId
            ? routines.length > 1
              ? "This routine will be deleted. Your next routine will be automatically activated."
              : "This is your only routine. Deleting it will leave you with no active routine."
            : "This routine will be permanently deleted."
        }
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
```

Changes from the old RoutineList:
- Drops `bg-cta text-white` Badge (used for "Active") — the parent `ActiveRoutineCard` now owns that signal.
- Wraps the list in `<Card>` for visual consistency with other sections.
- Uses `divide-y divide-line` for hairline row separators instead of `border-b border-border` per row.
- Shorter button labels ("Set active" vs. "Set as active routine").
- Returns `null` when `routines` is empty (parent decides whether to render at all).

- [ ] **Step 3: Delete the old `RoutineImporter.tsx`**

```bash
rm web/src/features/settings/RoutineImporter.tsx
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc -b
```
Expected: clean.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 640 pass. No existing unit test imports `RoutineImporter`; if one does, delete/update it.

- [ ] **Step 6: Lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 7: Visual smoke**

```bash
npm run dev
```

Navigate to `/settings`. Confirm:
- Eyebrow "PREFERENCES" + italic serif "Settings" hero.
- "ROUTINE" eyebrow → `ActiveRoutineCard` with eyebrow/name/meta → (if ≥ 2 routines) "OTHER ROUTINES" eyebrow + RoutineList.
- "DISPLAY" eyebrow → Card with "Units / Weight display" row + KG/LBS pill toggle.
- "APP" eyebrow (only if PWA install available) → Card with "Install app" row.
- "DATA" eyebrow → Card with 4 rows (Import routine, Export, Import backup, Clear all data). Clear all data row is red.
- `AboutCard` at bottom with Title + tagline + description + version.

Click "Import routine (YAML)" → should navigate to `/settings/import`. Click the back arrow → return to `/settings`.

- [ ] **Step 8: Commit**

```bash
git add web/src/features/settings/SettingsScreen.tsx \
        web/src/features/settings/RoutineList.tsx
git rm web/src/features/settings/RoutineImporter.tsx
git commit -m "feat(settings): rewrite Settings screen with warm-paper groups + RowLinks"
```

---

## Task 9.11: Full verification + PR

**Files:** `CLAUDE.md` (test count bump), otherwise verification only.

- [ ] **Step 1: Update `CLAUDE.md` test count**

Find the line:

```
npm test              # 599 unit+integration tests (Vitest)
```

Replace with the actual count from `npm test`. Expected: 640.

- [ ] **Step 2: Full unit test suite**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint9-settings/web"
npm test
```
Expected: `Tests  640 passed (640)`.

- [ ] **Step 3: Lint + build**

```bash
npm run lint && npm run build
```
Both clean.

- [ ] **Step 4: E2E**

```bash
npm run test:e2e
```
Expected: all pass. The Sprint 9 changes may break any e2e test that clicks the old "Import from text" button or asserts on the old Settings DOM. Fix those selectors in the same commit to use the new `/settings/import` route + "Replace active routine" CTA copy.

Likely affected: `tests/e2e/full-workflow.spec.ts` (YAML import flow). Grep:

```bash
grep -n "Import from text\|Import from file\|Paste YAML\|routine-yaml" web/tests/e2e 2>/dev/null
```

If matches appear, update the test to:
1. Click a nav element to reach `/settings`.
2. Click the "Import routine (YAML)" RowLink (navigates to `/settings/import`).
3. Fill the textarea by `id="routine-yaml-paste"`.
4. Click the "Replace active routine" button.
5. Expect navigation to `/settings` + toast or similar.

- [ ] **Step 5: Manual phone-viewport smoke**

```bash
npm run preview
```

DevTools → Device toolbar → iPhone 14. Walk:

| Screen | Expected |
|---|---|
| Settings (normal) | Eyebrow + serif "Settings" + ActiveRoutineCard + (optional Other routines) + Display/UnitsToggle + (optional App/Install) + Data/4 RowLinks + AboutCard |
| Settings (no active routine) | No ActiveRoutineCard, no Other routines. Everything else renders. |
| /settings/import | Back arrow → "Routine" eyebrow + serif "Import routine" → paragraph w/ GPT link → YAML textarea → "Replace active routine" CTA → "Import from file" button |
| /settings/import with bad YAML | YamlErrorList appears below buttons showing breadcrumb paths + messages |
| /settings/import with good YAML | Toast "Routine … imported", navigates to /settings |
| Units toggle | Tapping kg/lbs swaps the selected segment; Settings.units persists after reload |
| Clear all data | Opens ConfirmDialog; double-tap to confirm; wipes data; navigates to / |

- [ ] **Step 6: Diff summary**

```bash
git log --oneline main..HEAD
git diff main --stat
```

- [ ] **Step 7: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs: refresh Sprint 9 test count in CLAUDE.md"
```

- [ ] **Step 8: Push branch**

```bash
git push -u origin sprint-9-settings
```

- [ ] **Step 9: Open PR**

```bash
gh pr create --title "Sprint 9: Quiet Corners — Settings + Routine Import" --body "$(cat <<'EOF'
## Summary
Port the Settings screen and Routine Import flow to the warm-paper visual system per spec §3 Sprint 9. Settings gets a "PREFERENCES" eyebrow + italic serif "Settings" hero, an ActiveRoutineCard, a Display group with a new kg/lbs UnitsToggle, an App group with an Install RowLink (conditional), a Data group of four RowLinks (Import routine, Export data, Import backup, Clear all data), and an AboutCard showing the version from package.json. Routine Import moves to its own `/settings/import` route with a monospace textarea, a "Replace active routine" primary CTA, and inline field-level YAML error messages via YamlErrorList.

- **Settings** — `SettingsScreen.tsx` rewrite. Six new primitives: `ActiveRoutineCard`, `UnitsToggle`, `RowLink`, `SettingRow`, `AboutCard`, `YamlErrorList`. Legacy `bg-cta`, `border-border-strong`, and Badge-as-active-indicator patterns removed.
- **Routine Import** — new `/settings/import` route. `RoutineImportScreen` replaces the inline `RoutineImporter` (deleted). "Replace active routine" primary CTA. Field-level errors show breadcrumbs via `formatErrorPath` ("Day A · Entry 3 · sets: must be ≥ 1").
- **Build** — `__APP_VERSION__` global exposed via Vite `define` (reads `package.json`). AboutCard displays the version.
- **Minor** — added clarifying TODO near the `/history/exercise/:exerciseId` route noting Sprint 12 reintroduces the link (Sprint 8 review item).

See `docs/superpowers/specs/2026-04-19-visual-revamp-chunking-design.md` §3 Sprint 9 and the pre-decided answers at the top of `docs/superpowers/plans/2026-04-19-sprint9-settings-import.md`.

## Test plan
- [x] `npm test` — 640 pass (599 baseline + 41 new across 7 component/util files)
- [x] `npm run lint` — clean
- [x] `npm run build` — clean; dist contains replaced `__APP_VERSION__` literal
- [x] `npm run test:e2e` — clean (updated YAML-import e2e to use new route + CTA)
- [ ] Phone-viewport walk: Settings (with/without active routine, with/without install prompt, with active session), RoutineImportScreen (paste good/bad YAML, file picker), Units toggle persistence, Clear all data double-confirm flow

## Notes
- Theme toggle stays out of scope (spec §3 Sprint 9 "Out of scope"). No reintroduction planned.
- `RoutineList` kept but now only renders "other routines" below the ActiveRoutineCard; drops its own "Active" badge since the card above owns that signal.
- Backup JSON import/export still lives inline in Data group (different from routine YAML import). Both paths preserved.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report the PR URL back to the user.

---

## Self-Review

**1. Spec coverage.** Sprint 9 spec §3 scope bullets mapped to tasks:

| Spec bullet | Covered by |
|---|---|
| Settings: serif "Settings" title | Task 9.10 |
| Settings: Active Routine card | Task 9.5 + 9.10 |
| Settings: Display group with units pill toggle | Task 9.2 + 9.4 + 9.10 |
| Settings: Data group (Import / Export / Reset) as RowLinks | Task 9.3 + 9.10 |
| Settings: About section | Task 9.7 + 9.8 + 9.10 |
| Routine Import: monospace textarea, paste-or-upload | Task 9.9 |
| Routine Import: inline field-level YAML error messaging | Task 9.1 + 9.6 + 9.9 |
| Routine Import: "Replace active routine" primary CTA | Task 9.9 |
| Out of scope: theme toggle | Not added |
| Out of scope: density / accent / numeralStyle UI | Not added |
| Open question — YAML error structure | Pre-decided (flat field-level list) |
| Open question — About content | Pre-decided (tagline + description + version) |
| Open question — Install prompt | Pre-decided (RowLink in "APP" group) |

All covered.

**2. Placeholder scan.** No "TBD", "add appropriate validation", "similar to Task N", etc. Every step has concrete code. The "optional ordering" note in Task 9.9 Step 4/5 gives explicit guidance on two orderings — not a placeholder.

**3. Type consistency.** Signatures used consistently:
- `formatErrorPath(path: string): string` — defined Task 9.1, used Tasks 9.6 + 9.9.
- `ValidationError` — imported from `@/services/routine-service` in Tasks 9.6, 9.9 (pre-existing service export).
- `UnitsToggle({ value: UnitSystem; onChange: (next: UnitSystem) => void })` — defined Task 9.2, consumed Task 9.10.
- `RowLink` discriminated union props (`onClick` XOR `to`) — defined Task 9.3, consumed Task 9.10 (both variants used).
- `SettingRow` children slot — defined Task 9.4, consumed Task 9.10 with `UnitsToggle` inside.
- `ActiveRoutineCard({ routine: Routine | null | undefined })` — defined Task 9.5, consumed Task 9.10 with `activeRoutine ?? null`.
- `YamlErrorList({ errors: ValidationError[] })` — defined Task 9.6, consumed Task 9.9.
- `AboutCard()` — no props — defined Task 9.8, consumed Task 9.10.
- `__APP_VERSION__` global — defined Task 9.7, consumed Task 9.8.

**4. Existing service compatibility.** The plan uses `validateAndNormalizeRoutine` + `importRoutine` directly (not `validateParseAndImportRoutine`) because the user-facing screen wants `ValidationError[]` (not flattened `string[]`). Both service functions are already exported — no service changes needed.

**5. Potential regressions.** Current `SettingsScreen` inlines `RoutineImporter`. Sprint 9 removes that — any e2e that clicks "Import from text" inside Settings breaks. Task 9.11 Step 4 explicitly catches + fixes those selectors. Current `RoutineList` exposes an "Active" badge — anything depending on that badge's presence breaks. Quick grep surfaced no tests on `Active` badge in the current codebase, but Task 9.11 Step 2 (`npm test`) will catch anything missed.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-sprint9-settings-import.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for the 12-task length here where each task is self-contained.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

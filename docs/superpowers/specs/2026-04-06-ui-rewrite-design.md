# Exercise Logger UI Rewrite -- Design Spec

## 1. Design Principles and Non-Goals

### Principles

1. **Workout-first optimization.** The Workout screen is where the user spends 95% of their time. Every design decision prioritizes one-thumb mobile use during a gym session: large tap targets, minimal typing, fast scanning.
2. **Data layer is the source of truth.** The UI is a thin layer over existing services and hooks. No business logic in components. No local state for data that belongs in Dexie.
3. **Semantic color, not decoration.** Colors carry meaning: green = progress/logged, teal = active/selected, amber = warning/attention, red = destructive. Nothing else gets a non-neutral color.
4. **Show, don't configure.** Pre-fill from history. Show suggestions inline. Default to the suggested day. Minimize decisions the user has to make.
5. **Feature folders.** Each screen owns its components. Shared code lives in `shared/`. No cross-feature imports between feature folders.

### Non-Goals (explicitly out of scope)

- **Rest timer / auto-timer.** All timer code has been removed. No Zustand store. No rest timing between sets. No superset round detection. This is a permanent scope reduction, not a deferral.
- **Animations and transitions.** CSS transitions on hover/focus states only. No page transitions, no spring animations, no gesture-driven UI. Can be added later without architectural changes.
- **Desktop/tablet optimization.** Mobile-first, phone-only. No responsive breakpoints beyond ensuring nothing breaks on wider screens.
- **Onboarding / tutorial.** Empty states provide guidance. No first-run wizard.
- **Social / sharing features.** Single-user app.
- **Offline-specific UI.** PWA handles caching. No explicit offline indicators or sync UI.

---

## 2. Design System Tokens and Typography

### Color Tokens

Extend the existing shadcn neutral palette with four semantic color families. Each family defines three tokens for consistent component usage.

| Family | Token | Purpose | Light mode (oklch) | Dark mode (oklch) |
|---|---|---|---|---|
| Success | `--success` | Progress, logged state, suggestions | `oklch(0.65 0.17 145)` | `oklch(0.75 0.17 145)` |
| | `--success-foreground` | Text on success bg | `oklch(0.98 0 0)` | `oklch(0.15 0 0)` |
| | `--success-soft` | Subtle success bg | `oklch(0.95 0.05 145)` | `oklch(0.25 0.08 145)` |
| Info | `--info` | Active state, selected items | `oklch(0.65 0.15 195)` | `oklch(0.75 0.15 195)` |
| | `--info-foreground` | Text on info bg | `oklch(0.98 0 0)` | `oklch(0.15 0 0)` |
| | `--info-soft` | Subtle info bg | `oklch(0.95 0.05 195)` | `oklch(0.25 0.08 195)` |
| Warning | `--warning` | Blocked actions, validation, attention | `oklch(0.75 0.15 85)` | `oklch(0.80 0.15 85)` |
| | `--warning-foreground` | Text on warning bg | `oklch(0.15 0 0)` | `oklch(0.15 0 0)` |
| | `--warning-soft` | Subtle warning bg | `oklch(0.95 0.05 85)` | `oklch(0.30 0.08 85)` |
| Destructive | (existing) | Delete, discard, clear | (keep current) | (keep current) |

Add `--destructive-soft` to the existing destructive family: `oklch(0.95 0.05 27)` light / `oklch(0.25 0.08 27)` dark.

Register all tokens as Tailwind theme extensions in `app/App.css` using the same `@theme inline` pattern already in use.

### Typography

Font: Geist Variable (already installed via `@fontsource-variable/geist`).

| Role | Classes | Usage |
|---|---|---|
| Screen title | `text-xl font-bold` | "Day B - Pull", "Settings" |
| Exercise name | `text-base font-semibold` | Card headers in workout/history |
| Section header | `text-sm font-semibold uppercase tracking-wider text-muted-foreground` | Settings sections, History grouping. Use sparingly on Workout/Today. |
| Body / values | `text-sm font-medium` | General content, logged values |
| Meta / hints | `text-xs text-muted-foreground` | Last-time data, dates, durations, helper text |
| Numeric display | Add `tabular-nums` class | All weights, reps, durations, distances, set counts, dates |

### Spacing and Layout

- Screen padding: `p-4`
- Section gaps: `gap-6`
- Card gaps: `gap-3`
- Card internal: `p-4` with `gap-2` between elements
- Bottom nav height: ~56px
- Safe area: `pb-[env(safe-area-inset-bottom)]` on bottom nav container

---

## 3. Navigation and Information Architecture

### Route Structure

| Route | Screen | Feature folder |
|---|---|---|
| `/` | TodayScreen | `features/today/` |
| `/workout` | WorkoutScreen | `features/workout/` |
| `/history` | HistoryScreen | `features/history/` |
| `/history/:sessionId` | SessionDetailScreen | `features/history/` |
| `/history/exercise/:exerciseId` | ExerciseHistoryScreen | `features/history/` |
| `/settings` | SettingsScreen | `features/settings/` |
| `*` | Redirect to `/` | `app/App.tsx` |

### Navigation

- Bottom tab bar with 4 tabs: Today, Workout, History, Settings
- Uses `NavLink` with `end` prop on `/` to prevent false active state
- Active tab: `text-primary font-semibold`. Inactive: `text-muted-foreground`
- `role="navigation"` and `aria-label="Main navigation"` on nav element
- Icons: lucide-react (CalendarDays, Dumbbell, History, Settings)
- Safe-area bottom padding on nav container

### App Shell

`app/App.tsx` owns:
- BrowserRouter with `basename="/exercise-logger"`
- `useAppInit()` gate (loading/error states)
- Shell layout (Outlet + bottom nav)
- Route definitions

---

## 4. Screen-by-Screen Behavior

### 4.1 Today Screen

**File:** `features/today/TodayScreen.tsx`

**State A -- No active routine:**
- Centered vertically
- Heading: "No Active Routine" (`text-xl font-bold`)
- Helper text: "Import a routine in Settings to get started." (`text-sm text-muted-foreground`)
- Button: "Go to Settings" (outline, links to `/settings`)

**State B -- Routine active, no active session:**
- Routine name as screen title
- **Day selector** (`features/today/DaySelector.tsx`): Horizontal scrollable row of pill buttons. Selected day: `bg-info text-info-foreground`. Suggested day (from `routine.nextDayId`): small dot indicator below the pill. Non-selected: outline/ghost style. Tapping a day updates the preview below.
- **Day preview** (`features/today/DayPreview.tsx`): Compact card listing exercises for the selected day.
  - Each exercise row: name + set summary (e.g. "1 top + 3 x 8-12")
  - Superset pairs: connected with left border accent (`border-l-2 border-info/30`)
  - Notes: `text-xs text-muted-foreground`, truncated to 1 line. If truncated, subtle expand affordance.
  - Instance labels shown when present (e.g. "Squat (close stance)")
- **Cardio notes card** (if routine has cardio section): Secondary card below day preview. Shows `routine.cardio.notes` and options list. Quieter styling (`bg-muted/50`).
- **Start Workout button**: Sticky at bottom of scroll area (above nav). Full-width, `bg-primary text-primary-foreground`. Text: "Start Workout".
- **Last session card** (`features/today/LastSessionCard.tsx`): If a finished session exists for this routine, small card showing day label, relative date ("2 days ago"), duration. Positioned between preview and start button.

**State C -- Active session exists:**
- **Resume Workout card**: Prominent card showing day label, routine name, elapsed time, exercise count. Single tap navigates to `/workout`. `border-info bg-info-soft`.
- No day selector, no start button, no preview. Resume is the only action.

**Data sources:**
- `useSettings()` for `activeRoutineId`
- `useRoutine(activeRoutineId)` for routine data
- `useActiveSession()` for active session detection
- `db.sessions` query for last finished session (new hook or inline query)

### 4.2 Workout Screen

**File:** `features/workout/WorkoutScreen.tsx`

**Empty state (no active session):** Centered heading "No Active Workout", helper text "Start a workout from the Today tab."

**Active session layout:**

- **Sticky header**: Day label + routine name (`"Day B - Pull"`), left-aligned, compact. `bg-background border-b`.
- **Scrollable body**: Exercise cards in `orderIndex` order, supersets grouped.
- **Sticky footer** (`features/workout/WorkoutFooter.tsx`): "Add Exercise" (outline), "Finish Workout" (primary), "Discard" (ghost text, destructive color). On small screens, if 3 buttons feel cramped, Discard becomes a small text action below the main buttons or moves to an overflow menu.

**Exercise Card** (`features/workout/ExerciseCard.tsx`):
- Exercise name (`text-base font-semibold`)
- Notes (if any): single line, truncated, `text-xs text-muted-foreground`
- Per set block:
  - **Block label**: Badge/chip from `getBlockLabel()`. "Top" = `bg-warning-soft text-warning`, "AMRAP" = `bg-info-soft text-info`, "Back-off" = neutral badge. No label for single-block exercises.
  - **Last-time line**: `"Last: 80kg x 8, 8, 7"` in `text-xs text-muted-foreground tabular-nums`. If suggestion: `"Suggested: 82.5kg"` in `text-success text-xs` with small up-arrow icon.
  - **Set slot row**: Horizontally scrollable row. Overflow scrolls, does not compress.
- For extras (origin="extra"): No block labels, no suggestions. Show `useExtraHistory` data if available. "Extra" badge on card header.

**Set Slot** (`features/workout/SetSlot.tsx`):
- Minimum 44px height, comfortable width for content
- **Unlogged**: Set number ("1", "2"), `border border-border text-muted-foreground bg-background`
- **Logged**: Abbreviated value ("80x8"), `bg-success-soft border-success text-success-foreground` with small checkmark icon. `tabular-nums`.
- Tapping opens SetLogSheet for that slot

**Superset Group** (`features/workout/SupersetGroup.tsx`):
- Container with `border-l-2 border-info pl-3`
- Small "Superset" label at top: `text-xs text-info font-medium`
- Two ExerciseCards stacked inside

**Set Log Sheet** (`features/workout/SetLogSheet.tsx`):
- Bottom sheet, content-sized up to ~70% viewport height
- Header: Exercise name, block label (if any), set number (e.g. "Set 2 of 3")
- **Pre-fill priority**: (1) current logged value if editing, (2) suggestion weight + last-time reps, (3) blank
- **Fields driven by `targetKind`**:
  - `"reps"`: Reps number input. Weight input if `effectiveType === "weight"`. Optional expandable weight toggle if `effectiveType === "bodyweight"`.
  - `"duration"`: Duration (seconds) number input. Weight if applicable.
  - `"distance"`: Distance (meters) number input. Weight if applicable.
  - For extras (no `targetKind`): Fall back to `effectiveType`-driven fields.
- All inputs: `text-lg tabular-nums`, `inputmode="decimal"`, large touch targets
- "Save" button: full-width, primary
- "Delete" button: only shown when editing existing set, small destructive text below save
- Dismiss without saving = no change

**Exercise Picker** (`features/workout/ExercisePicker.tsx`):
- Full-height sheet triggered by "Add Exercise" footer button
- Tabs: All, Legs, Chest, Back, Shoulders, Arms, Core, Cardio (muscle group filter)
- Search bar at top
- Exercise rows: name + equipment badge
- Already-in-workout exercises: "In workout" badge but still tappable (adds as extra)
- Tapping adds as extra via `addExtraExercise()` and closes sheet

**Finish Workout dialog**:
- Confirmation dialog
- If unlogged sets exist: "X sets not logged -- they will remain empty." in `text-warning`
- "Cancel" / "Finish Workout" buttons

**Discard Workout dialog**:
- Double-confirmation: first click shows warning, second confirms
- "This will permanently delete this workout and all logged sets."
- "Cancel" / "Discard" (destructive)

**Data sources:**
- `useActiveSession()` for session + exercises + sets
- `useExerciseHistory(sessionExercise, units)` per exercise for last-time/suggestions
- `useExtraHistory(exerciseId)` for extra exercises
- `useSettings()` for units
- Services called directly: `logSet`, `editSet`, `deleteSet`, `addExtraExercise`, `finishSession`, `discardSession`

### 4.3 History Screen

**File:** `features/history/HistoryScreen.tsx`

**Empty state:** Centered heading "No History Yet", helper text "Complete a workout to see it here."

**Session list:** Reverse-chronological cards. Each card (`features/history/SessionCard.tsx`):
- Leading day badge/chip (`bg-info-soft text-info`, e.g. "B")
- Routine name + day label ("Full Body 3-Day -- Pull")
- Date + duration (`text-xs text-muted-foreground tabular-nums`)
- Exercise count + total logged set count
- Card is tappable, navigates to `/history/:sessionId`

**Data sources:**
- `db.sessions.where("status").equals("finished")` sorted by `startedAt` desc (new query, either in a hook or inline)

### 4.4 Session Detail Screen

**File:** `features/history/SessionDetailScreen.tsx`

- Back button top-left, navigates to `/history`
- Header: Day label, routine name, date, duration
- Exercise cards: Read-only variant of workout ExerciseCard
  - Quieter surface (no card border or lighter border)
  - Only logged set slots are rendered and tappable (no empty prescribed slots shown)
  - Tapping a logged slot opens SetLogSheet in edit mode (`editSet` / `deleteSet`)
  - Exercise name is tappable, navigates to `/history/exercise/:exerciseId`
  - Block labels and block structure preserved for context

**Data sources:**
- `useSessionExercises(sessionId)` for exercises + sets
- `useRoutine()` not needed (snapshots contain all display data)

### 4.5 Exercise History Screen

**File:** `features/history/ExerciseHistoryScreen.tsx`

- Back button to previous screen
- Exercise name as title
- **Note:** This screen aggregates across all instance labels for the given exerciseId. When instance labels or block types vary, they are shown per-row for disambiguation. The UI does not claim this is a single progression stream.
- Session groups (reverse-chronological):
  - Group header: Date, day label, routine name (`text-xs text-muted-foreground`)
  - Instance label shown if non-empty (`text-xs`, inline with group header)
  - Set rows: weight x reps (or duration/distance as appropriate), with block signature context where relevant
  - `tabular-nums` on all values
  - Equipment-appropriate weight formatting via `effectiveEquipment`

**Data sources:**
- `db.loggedSets` queried by exerciseId, joined with session data for context

### 4.6 Settings Screen

**File:** `features/settings/SettingsScreen.tsx`

Single scrollable page with three card sections.

**Section 1 -- Routines:**
- Header: "Routines" (section header style)
- **Routine list** (`features/settings/RoutineList.tsx`):
  - Each row: Routine name, "Active" badge if active (`bg-info-soft text-info`)
  - Primary action area: Inactive routines show "Set as active" button. The active routine shows "Delete" button (cannot delete active routine while it's active -- must activate another first, or delete if it's the only routine which clears activeRoutineId). One primary action visible per row, not multiple small buttons.
  - During active session: action buttons disabled with inline helper text "Finish or discard your current workout first" (`text-warning text-xs`). No tooltips.
- **Import** (`features/settings/RoutineImporter.tsx`):
  - "Import Routine" button (outline, full-width)
  - File picker for `.yaml` / `.yml`
  - On success: routine appears in list, toast "Routine imported"
  - On validation failure: dedicated error panel below import button. Shows all errors with field paths from `validateAndNormalizeRoutine`. `bg-warning-soft border-warning` styling.
- Empty state: "No routines imported yet." with import button

**Section 2 -- Preferences:**
- Header: "Preferences"
- Units: Segmented control "kg" / "lbs". Selected: `bg-primary text-primary-foreground`.
- Theme: Segmented control "Light" / "Dark" / "System". Same style.
- Changes apply immediately via services + class toggle

**Section 3 -- Data:**
- Header: "Data"
- "Export Data" button (outline). Triggers `downloadBackupFile`. Toast on success.
- "Import Data" button (outline). File picker for JSON. Blocked during active session (inline warning text). On success: toast with note if imported data contains an active session.
- "Clear All Data" button (destructive outline, restrained). Double-confirmation dialog. Blocked during active session. On success: toast, redirect to Today (which shows empty state).

**Data sources:**
- `useAllRoutines()` for routine list
- `useSettings()` for active routine, units, theme
- `useActiveSession()` for blocking checks
- Services called directly: `setActiveRoutine`, `deleteRoutine`, `importRoutine`, `validateAndNormalizeRoutine`, `setUnits`, `setTheme`, `exportBackup`, `importBackup`, `clearAllData`

---

## 5. Shared Components and Interaction Patterns

### shadcn/ui Primitives (`shared/ui/`)

Install as needed via `npx shadcn add`. Expected components:
- `button` -- primary, outline, ghost, destructive variants
- `card` -- routine cards, session cards, preview cards
- `dialog` -- confirmation dialogs (finish, discard, delete, clear)
- `sheet` -- bottom sheet for SetLogSheet and ExercisePicker
- `input` -- number inputs in SetLogSheet
- `badge` -- day badges, "Active", "Extra", "In workout", block labels
- `tabs` -- muscle group filter in ExercisePicker
- `separator` -- section dividers in Settings
- `scroll-area` -- exercise picker list

### Shared Components (`shared/components/`)

**ConfirmDialog:** Reusable confirmation with optional double-confirm step. Props: `title`, `description`, `confirmText`, `onConfirm`, `variant` (default/destructive), `doubleConfirm` (boolean).

**Toast provider:** Sonner or similar. Configured once in App.tsx. Used for: routine imported, workout finished, backup exported/imported/restored, destructive actions completed. NOT used for per-set logging.

### Interaction Patterns

- **Loading states:** All hooks return `undefined` while loading. Screens show nothing (or skeleton if appropriate) until data resolves. No "Loading..." text except the initial app boot.
- **Optimistic updates:** Not needed. Dexie writes are local and near-instant. `useLiveQuery` re-renders reactively after writes.
- **Form submission:** SetLogSheet calls service functions directly. On success, sheet closes. On error (shouldn't happen with local DB), show inline error.
- **Navigation:** React Router `Link` / `NavLink` for all navigation. `useNavigate()` for programmatic redirects (e.g. after clear data).

---

## 6. States: Empty, Error, Loading

### Per-Screen Empty States

| Screen | Condition | Display |
|---|---|---|
| Today | No active routine | "No Active Routine" + link to Settings |
| Today | Routine active, no sessions ever | Normal preview, no "last session" card |
| Workout | No active session | "No Active Workout" + hint to start from Today |
| History | No finished sessions | "No History Yet" + hint to complete a workout |
| Session Detail | Invalid sessionId | Back button + "Session not found" |
| Exercise History | No sets for exerciseId | Back button + "No history for this exercise" |
| Settings > Routines | No routines | "No routines imported yet." + import button |

### Error States

- **App init failure:** Full-screen centered error message: "Failed to initialize: {error}". This covers IndexedDB unavailability.
- **YAML import validation:** Inline error panel under import button with all field-path errors.
- **JSON import validation:** Inline error list under import button.
- **Active session blocks:** Inline warning text on blocked controls, not disabled-without-explanation.

### Loading States

- **App boot:** "Loading..." text while `useAppInit` runs (brief, covers DB seed).
- **Subsequent screens:** No explicit loading indicators. Hooks return `undefined` briefly; screens render nothing until defined. Dexie queries are sub-millisecond locally.

---

## 7. Accessibility and Mobile Constraints

### Touch Targets
- All interactive elements: minimum 44px height (per WCAG 2.5.8)
- Set slots: 44px height minimum, comfortable width for content
- Bottom nav links: full tab-width touch area, minimum 48px height
- Form inputs in SetLogSheet: `text-lg` for readability, generous padding

### Semantic HTML
- Bottom nav: `<nav role="navigation" aria-label="Main navigation">`
- Screen titles: `<h1>` for primary heading per screen
- Set slots: `<button>` elements with descriptive `aria-label` (e.g. "Set 2, not logged" or "Set 2, 80kg x 8 reps")
- Dialogs: proper `<dialog>` or aria-modal pattern via shadcn
- Form inputs: associated `<label>` elements

### Mobile Layout
- `h-dvh` for full viewport height (accounts for mobile browser chrome)
- `env(safe-area-inset-bottom)` padding on bottom nav (notch/gesture bar)
- No horizontal scroll on page level; horizontal scroll only within set slot rows
- Sticky header and footer use `position: sticky` with appropriate z-index
- All content reachable with one thumb from bottom-right grip

### Color
- Never rely on color alone for state. Logged set slots use checkmark icon + color + text change.
- Sufficient contrast ratios maintained between `-soft` backgrounds and foreground text.
- Dark mode tokens chosen for readability, not just inversion.

---

## 8. Implementation Notes

### Existing Infrastructure (do not modify)

| Layer | Status |
|---|---|
| `domain/` (types, enums, helpers) | Complete, unchanged |
| `db/database.ts` | Complete, StrictMode bug fixed |
| `services/` (7 files) | Complete, unchanged |
| `shared/hooks/` (7 hooks) | Complete, moved from old `hooks/` |
| `data/catalog.csv` | Complete, unchanged |
| `shared/lib/` (csv-parser, utils) | Complete, moved from old `lib/` |

### Service-to-Screen Mapping

| Screen | Services used | Hooks used |
|---|---|---|
| TodayScreen | `startSessionWithCatalog` | `useSettings`, `useRoutine`, `useActiveSession` |
| WorkoutScreen | `logSet`, `editSet`, `deleteSet`, `addExtraExercise`, `finishSession`, `discardSession` | `useActiveSession`, `useExerciseHistory`, `useExtraHistory`, `useSettings` |
| HistoryScreen | (none, read-only) | New hook or inline query for finished sessions |
| SessionDetailScreen | `editSet`, `deleteSet` | `useSessionExercises` |
| ExerciseHistoryScreen | (none, read-only) | New hook or inline query |
| SettingsScreen | `setActiveRoutine`, `deleteRoutine`, `importRoutine`, `validateAndNormalizeRoutine`, `setUnits`, `setTheme`, `exportBackup`, `importBackup`, `clearAllData`, `downloadBackupFile` | `useAllRoutines`, `useSettings`, `useActiveSession` |

### New Hooks Needed

- **`useFinishedSessions()`**: Returns finished sessions sorted by `startedAt` desc. For HistoryScreen.
- **`useLastSession(routineId)`**: Returns the most recent finished session for a routine. For TodayScreen's last session card.
- **`useExerciseSessions(exerciseId)`**: Returns all logged sets for an exercise across finished sessions, with session context. For ExerciseHistoryScreen.

These follow the same `useLiveQuery` pattern as existing hooks.

### Component File Map

```
features/today/
  TodayScreen.tsx
  DaySelector.tsx
  DayPreview.tsx
  LastSessionCard.tsx

features/workout/
  WorkoutScreen.tsx
  ExerciseCard.tsx
  SetSlot.tsx
  SetLogSheet.tsx
  SupersetGroup.tsx
  ExercisePicker.tsx
  WorkoutFooter.tsx

features/history/
  HistoryScreen.tsx
  SessionCard.tsx
  SessionDetailScreen.tsx
  ExerciseHistoryScreen.tsx

features/settings/
  SettingsScreen.tsx
  RoutineList.tsx
  RoutineImporter.tsx

shared/components/
  ConfirmDialog.tsx
  ToastProvider.tsx (or integrated in App.tsx)

shared/ui/
  (shadcn primitives, installed via CLI)
```

### E2E Test Compatibility

The smoke tests (`smoke.spec.ts`) expect:
- `role="heading"` with name "No Active Routine" on Today (empty state)
- `role="navigation"` with `aria-label="Main navigation"`
- Headings "No Active Workout", "No History Yet", "Settings" on their respective screens

The full workflow test (`full-workflow.spec.ts`) expects:
- Settings: YAML file upload, routine name visible, "Set as active routine" button, "Active" text
- Today: "Start Workout" text/button
- Workout: "Finish Workout" text, `data-testid="set-slot"` on set slots, number inputs for weight/reps, save button
- History: routine name visible after finishing
- Settings: "Export Data" button that triggers download

These test selectors should be preserved or updated alongside the UI rewrite.

### Timer Removal

All previous timer requirements and acceptance criteria are removed. This includes:
- `restDefaultSec` and `restSupersetSec` fields still exist in the Routine and Session types but are not used by the UI
- No Zustand store
- No RestTimer component
- No superset round detection logic
- No timer-related E2E test expectations

The `restDefaultSecSnapshot` and `restSupersetSecSnapshot` fields on Session are harmlessly snapshotted by `startSessionWithCatalog` and ignored by the UI.

# Gym Routine Tracker — Design Spec

## Overview

A local-first Progressive Web App for tracking gym workouts with structured routine templates, double progression logic, and practical logging UX. Designed for personal use at the gym — simple, fast, offline-capable.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React + Vite | Fast dev, small bundle, PWA plugin ecosystem |
| UI Components | shadcn/ui + Tailwind CSS | Own the components, accessible, Tailwind-native |
| State Management | Zustand | Tiny (~1KB), ergonomic shared state (active workout, timer, rotation) |
| Database | Dexie.js (IndexedDB) | Local-first, no server, fast queries, offline by default |
| PWA | vite-plugin-pwa | Service worker, installable, offline caching |
| Deployment | GitHub Pages | Free, HTTPS, existing CI infrastructure |
| Language | TypeScript | Type safety across data model and components |

## Data Model

Five tables in IndexedDB via Dexie.

### `exercises` — catalog (seeded from CSV)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Slug: `barbell-back-squat` |
| `name` | string | Display name |
| `type` | enum | `weight`, `bodyweight`, `isometric`, `cardio` |
| `equipment` | string | Barbell, Dumbbell, Machine, Cable, Kettlebell, Bodyweight, Cardio |
| `muscleGroup` | string | For off-routine exercise picker filter |

### `routines` — loaded from YAML templates

| Field | Type | Notes |
|---|---|---|
| `id` | string | Auto-generated UUID |
| `name` | string | e.g., "Full Body 3-Day Rotation" |
| `restDefault` | number | Seconds between normal sets (e.g., 90) |
| `restSuperset` | number | Seconds between superset rounds (e.g., 60) |
| `days` | object | Full day → exercise structure (see Routine Template Format) |
| `loadedAt` | date | When the template was imported |

### `sessions` — one per workout

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `routineId` | string | FK to routine |
| `dayId` | string | "A", "B", "C", etc. |
| `startedAt` | date | |
| `finishedAt` | date | null while in progress |

### `loggedSets` — individual set logs (flat, one row per set)

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `sessionId` | string | FK to session |
| `exerciseId` | string | FK to exercise catalog |
| `setIndex` | number | Order within the exercise for this session (0, 1, 2...) |
| `weight` | number | Always stored in kg. Converted to lbs for display when user preference is lbs. Null for bodyweight/isometric |
| `reps` | number | Null for isometric/cardio |
| `duration` | number | Seconds. For isometric holds, cardio intervals |
| `distance` | number | Meters. For rowing 2K, runs, etc. |
| `tag` | string | `top`, `amrap`, `extra`, or null for normal sets |
| `loggedAt` | date | Timestamp of when the set was logged |

### `settings` — user preferences (single record)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Always `"user"` |
| `activeRoutineId` | string | FK to routine |
| `nextDayId` | string | Current position in the rotation |
| `units` | enum | `kg`, `lbs` |
| `theme` | enum | `light`, `dark`, `system` |

### Indexing strategy

- `loggedSets`: compound index on `[exerciseId+loggedAt]` for "last time" queries
- `loggedSets`: index on `sessionId` for loading a full session
- `sessions`: index on `routineId` and `startedAt` for history listing

### Design notes

- **loggedSets is flat** — no nesting. Every set is one row. Makes per-exercise history queries trivial.
- **`tag` field** handles special set types (top, AMRAP, off-routine extras) without separate tables.
- **Weight is always stored in kg.** When the user's preference is lbs, input and display are converted. This avoids ambiguity when switching units — all historical data is in one canonical unit.
- **Rotation state** (`nextDayId`) lives in settings. Updated when a session starts.

## Screens & Navigation

Three-tab bottom navigation + settings accessible via gear icon in the header.

### Tab 1: Today (home)

- Shows the next workout day from rotation (e.g., "Day B — Moderate Hinge + Vertical Push/Pull")
- Preview list of exercises for that day
- "Start Workout" button
- Day override: pick a different day if desired
- Last session summary (date and what was done)

### Tab 2: Workout (active session)

- **When no session is active:** simple message — "No active workout. Start one from Today."
- **When active:** scrollable list of all exercises for the day
- Each exercise card shows:
  - Exercise name
  - Prescribed sets and rep range
  - Last session data (e.g., "Last: 60kg × 12, 12, 10")
  - Weight suggestion (if applicable)
  - Set slots to tap and log
- Superset pairs rendered together, visually connected
- Logged sets show checkmark with recorded values
- "Add Exercise" button at bottom → opens catalog picker filtered by muscle group
- "Finish Workout" button → saves `finishedAt`, shows brief summary, returns to Today

### Tab 3: History

- Chronological list of past sessions (date, day letter, duration, exercise count)
- Tap a session → full log of all sets
- Per-exercise history: tap any exercise name → all logged sets across all sessions, ordered by date

### Settings (gear icon, top-right header)

- **Routines section:**
  - List of loaded routines, active one highlighted
  - Tap to set as active
  - "Import Routine" → file picker for YAML → validates → adds to list
  - Delete routine (with confirmation)
- **Preferences:**
  - Units toggle: kg / lbs
  - Theme toggle: light / dark / system
- **Data:**
  - Export Data → downloads JSON file (all sessions, sets, settings, routines)
  - Import Data → file picker → loads JSON → confirmation before overwriting
  - Clear All Data → double confirmation

## Routine Template Format (YAML)

### Structure

```yaml
name: "Full Body 3-Day Rotation"
rest_default: 90
rest_superset: 60

days:
  A:
    label: "Heavy Squat + Horizontal Push/Pull"
    exercises:
      - id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 3 }
        notes: "Warm up with 2 lighter sets"

      - id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
        notes: "Slow eccentric, 2-3 sec"

      - id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }
        notes: "Squeeze and hold 1 sec at close"

      - superset:
          - id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Each arm"

      - id: tricep-pushdown
        sets:
          - { reps: [8, 12], count: 2 }

      - id: pallof-press
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Slow rotation at full extension"

  B:
    label: "Moderate Hinge + Vertical Push/Pull"
    exercises:
      - id: dumbbell-romanian-deadlift
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 2 }
        notes: "Top set of 6, then drop weight for back-off sets"

      - id: dumbbell-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Walking lunges, moderate weight, control the step"

      - id: leg-extension
        sets:
          - { reps: [8, 12], count: 2 }
        notes: "Squeeze at top, 1 sec hold"

      - superset:
          - id: dumbbell-shoulder-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Seated or standing"
          - id: lat-pulldown
            sets:
              - { reps: [8, 12], count: 3 }

      - id: dumbbell-curl
        sets:
          - { reps: [8, 12], count: 2 }

      - id: cable-woodchop
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Alternate high-to-low / low-to-high weekly"

      - id: wrist-roller
        sets:
          - { duration: [30, 60], count: 2 }
        notes: "One set rolling up (flexion), one rolling down (extension)"

  C:
    label: "Unilateral + Accessories"
    exercises:
      - id: single-leg-romanian-deadlift
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg. Hold DB opposite to working leg"

      - id: reverse-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }

      - superset:
          - id: incline-dumbbell-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "30-45 degree incline"
          - id: seated-cable-row
            sets:
              - { reps: [8, 12], count: 3 }

      - id: dumbbell-pullover
        sets:
          - { reps: [8, 12], count: 2 }
        notes: "Slight elbow bend, stretch at bottom"

      - id: medicine-ball-rotational-slam
        sets:
          - { reps: 8, count: 3 }
        notes: "Each side. Explosive rotational power"

cardio:
  notes: "After lifting, or separate session"
  options:
    - { name: "Walk", detail: "20-30 min brisk pace" }
    - { name: "Rowing 2K Sprints", detail: "3 x 2K with 3-4 min rest" }
    - { name: "Mix", detail: "1-2 rowing sprints + 10-15 min walk" }

notes:
  - "Rotation is continuous: A-B-C-A-B-C regardless of days per week."
  - "Supersets: rest after both exercises, not between them."
  - "Top sets: one heavier set at lower reps, then back off for volume."
  - "Leg intensity is staggered: A heavy, B moderate, C lighter/unilateral."
  - "Progression: work up to top of rep range across all sets, then increase weight and reset to bottom."
  - "Adductors appear on A and C given importance for riding."
```

### Conventions

- `reps: [8, 12]` — range for double progression. `reps: 5` — fixed target.
- `count` — number of sets at this prescription.
- `tag: top` — top set (heavier, lower reps). `tag: amrap` — as many reps as possible.
- `superset` — always exactly 2 exercises.
- `duration: [30, 45]` — seconds, for isometric holds (supports range for progression).
- `distance: 2000` with logged `duration` — for rowing 2K intervals and similar.
- `notes` — free text, displayed to the user during the workout.
- `cardio` and `notes` at the root level are informational, displayed in the Today screen or routine preview.
- Exercise type defaults from catalog but routine can override (e.g., marking bodyweight Dips as `type: weight` for weighted dips).

### Validation on load

- Every exercise `id` must exist in the catalog
- Rep/duration ranges must be valid (min < max)
- Supersets must have exactly 2 exercises
- Day IDs must be unique
- Reject with clear error messages on failure

## Workout Flow

### Starting a workout

1. Today screen shows the next day from `settings.nextDayId`
2. User taps "Start Workout" (or overrides to a different day)
3. New `session` created with `startedAt = now`
4. `settings.nextDayId` advances to the next day in the rotation

### Day override logic

If rotation is A→B→C and the app suggests B, but the user picks A:
- Session logs as day A
- `nextDayId` becomes B (the day after the override pick, in rotation order)
- Next time the app opens, it suggests B

### Logging a set

1. Exercise card shows prescribed sets, last session data, and weight suggestion
2. User taps a set slot → input appears pre-filled with last session values or suggestion
3. User confirms → `loggedSet` row saved, rest timer starts
4. Set slot updates to show logged values with a visual indicator

### Supersets

- Both exercises in the pair render together, visually connected
- User alternates: log set of exercise 1, log set of exercise 2, rest timer starts (using `rest_superset`)
- No enforcement — user can do them in any order

### Off-routine exercises

- "Add Exercise" button at bottom of workout screen
- Opens catalog picker with muscle group filter tabs (Legs, Chest, Back, Shoulders, Arms, Core, Full Body, Cardio). Exercises with compound groups (e.g., "Back / Legs") appear under all matching tabs.
- Select an exercise → it appears at the bottom of the workout list
- Log sets freely — no prescribed target, just enter weight/reps
- All sets tagged as `extra`

### Finishing

- User taps "Finish Workout"
- `session.finishedAt = now`
- Brief summary: exercises logged, total sets, session duration
- Navigate to Today tab

## Progression & Suggestions

### Double progression

The core progression model for weight exercises:

1. Exercise is prescribed at a rep range (e.g., 3×8-12)
2. Start at the bottom of the range (8 reps) with a manageable weight
3. Over sessions, work up to the top of the range across all sets (12, 12, 12)
4. Once all sets hit the ceiling → increase weight, reset to bottom of range (8, 8, 8)

### Weight suggestion logic

1. Find the most recent `loggedSets` for this exercise (excluding `tag: extra` and `tag: amrap`)
2. Get the prescribed rep range from the active routine
3. If ALL routine sets hit the top of the range → suggest `lastWeight * 1.05`, rounded to nearest practical increment
4. Otherwise → suggest same weight as last time

### Practical rounding for weight increases

5% increase rounded to the nearest increment by equipment type:

| Equipment | kg increment | lbs increment |
|---|---|---|
| Barbell | 2.5 kg | 5 lbs |
| Dumbbell | 2 kg | 5 lbs |
| Machine / Cable | 5 kg | 10 lbs |

Rounding uses the increment for the user's current unit preference. The 5% calculation is done on the stored kg value, then rounded to the appropriate increment in the display unit.

### "Last time" display

- Shows the most recent logged sets for this exercise, **regardless of which day or session**
- Format: "Last: 60kg × 12, 12, 10" — weight and reps for each set at a glance
- This lets the user make informed decisions rather than blindly following suggestions
- If exercise was never logged before, no "last time" data shown

### Isometric progression

- Can progress by increasing hold duration (within the prescribed range)
- Can also progress by adding sets
- Same double progression concept: hit the top of the duration range across all sets → increase (add a set or extend the range)

## Rest Timer

- **Trigger:** auto-starts when a set is logged
- **Duration:** `rest_default` (90s) for normal sets, `rest_superset` (60s) for superset rounds
- **Display:** countdown with progress indicator, visible but non-blocking — user can scroll and browse other exercises while timer runs
- **Alert:** vibration when timer reaches zero
- **Controls:** skip (dismiss early), +30s (extend)
- **Scope:** between sets of the same exercise only. No timer for exercise-to-exercise transitions.
- **Non-blocking:** timer does not prevent logging another set early

## Exercise Catalog

### Source

`docs/exercises/gym_exercises_catalog.csv` — the authoritative list of available exercises.

### Fields

- `Name` — display name
- `Type` — `Weight`, `Bodyweight`, `Isometric`, `Cardio`
- `Equipment` — `Barbell`, `Dumbbell`, `Machine`, `Cable`, `Kettlebell`, `Bodyweight`, `Cardio`
- `Muscle Group` — primary group for filtering in the exercise picker

### ID generation

Slug derived from name: "Barbell Back Squat" → `barbell-back-squat`. Used as the primary key in the `exercises` table and referenced in routine templates.

### Missing exercises to add

The following exercises from the current routine template are not in the catalog and must be added:

| Name | Type | Equipment | Muscle Group |
|---|---|---|---|
| Pallof Press | Weight | Cable | Core |
| Cable Woodchop | Weight | Cable | Core |
| Medicine Ball Rotational Slam | Weight | Medicine Ball | Core |
| Wrist Roller | Weight | Other | Arms |
| Reverse Lunge | Bodyweight | Bodyweight | Legs |
| Dumbbell Reverse Lunge | Weight | Dumbbell | Legs |
| Single-Leg Romanian Deadlift | Weight | Dumbbell | Legs |
| Dumbbell Pullover | Weight | Dumbbell | Chest |

### Name normalization

Template names must match catalog IDs exactly. Normalize during catalog cleanup:

| Routine JSX name | Catalog name (normalized) |
|---|---|
| Leg Curl (machine) | Leg Curl |
| One-Arm Dumbbell Row | Dumbbell Row |
| Dumbbell Overhead Press | Dumbbell Shoulder Press |
| Cable Row (seated) | Seated Cable Row |
| Walking Lunges (dumbbells) | Dumbbell Lunge |

## Export / Import

### Data export

- Single JSON file containing: all sessions, all loggedSets, settings, loaded routines
- Does NOT include the exercise catalog (that's seeded from CSV on app init)
- Filename format: `exercise-logger-backup-YYYY-MM-DD.json`

### Data import

- File picker for JSON
- Confirmation dialog showing what will be imported (session count, date range)
- Full overwrite — replaces all existing data
- Validates structure before applying

### Routine import

- Separate from data import
- File picker for YAML
- Validates against exercise catalog
- Adds to routine list (does not replace existing routines)

## Future Considerations

These are explicitly out of scope for v1 but the data model supports them without schema changes:

- **WearOS companion app** — read today's workout, log sets, control rest timer from the watch
- **Cloud sync / backup** — automatic backup to Google Drive, Dropbox, or a simple backend
- **Volume and progress charts** — total weight lifted per session/week, strength curves over time
- **Personal records tracking** — automatic PR detection and display
- **Muscle group heatmaps** — weekly volume distribution across muscle groups
- **Share/export workout summaries** — post session summaries to social or send to a coach
- **Plate calculator** — given a target weight, show which plates to load on the bar

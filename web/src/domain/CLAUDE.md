# Domain Layer

Pure TypeScript — no React, no Dexie, no side effects (except `generateId` and `nowISO`). This is the foundational contract layer that all other layers depend on.

## Files

### `types.ts` — All entity interfaces

The single source of truth for the data model. 6 Dexie table types + supporting types:

- **Exercise** — Catalog entry (seeded from CSV). ID is a slug of the name.
- **Routine** — Imported from YAML. Contains `days` (record of RoutineDay), `dayOrder`, `nextDayId`.
- **Session** — One per workout attempt. Snapshots routine name, day label, day order, rest timers.
- **SessionExercise** — Per-exercise snapshot within a session. Snapshots set blocks, effective type/equipment, notes.
- **LoggedSet** — One per logged set slot. Denormalizes exerciseId, instanceLabel, blockSignature for query performance.
- **Settings** — Single record (id="user"). Holds activeRoutineId, units, theme.

Key supporting types:
- **SetBlock** — Prescription: `targetKind` (reps/duration/distance) + value range or exact + count + tag
- **RoutineEntry** — Discriminated union: `kind: "exercise"` or `kind: "superset"` (exactly 2 items)
- **RoutineCardio** — Optional cardio section with notes and options

**Critical:** `instanceLabel` is `string` (not `string | null`) on SessionExercise and LoggedSet. Use `""` as the null sentinel. Dexie silently excludes null from compound indexes.

### `enums.ts` — Union type constants

All domain enums as TypeScript string union types. 9 types total. No runtime values — these are compile-time only. If you need runtime validation sets, define them in the service that validates.

### `block-signature.ts` — `generateBlockSignature(block: SetBlock) => string`

Deterministic string for progression matching. Format: `{targetKind}:{valueSpec}:count{count}:tag{tagValue}`

Examples: `reps:6-8:count1:tagtop`, `reps:8-12:count3:tagnormal`, `duration:30-60:count2:tagnormal`

`tagnormal` is the sentinel for "no tag" — intentional, matches spec.

### `unit-conversion.ts` — Weight conversion and rounding

- `kgToLbs(kg)`, `lbsToKg(lbs)` — Canonical conversion using `KG_PER_LB = 0.45359237`
- `roundToIncrement(value, equipment, units)` — Round to nearest practical increment
- `getIncrement(equipment, units)` — Get the increment step for an equipment/unit pair
- `toDisplayWeight(kg, units)` — Convert canonical kg to display value (floating-point cleanup only, no equipment rounding)
- `toCanonicalKg(displayValue, units)` — Convert display input back to canonical kg (pure conversion, no equipment rounding)

Increment table covers all 9 equipment types x 2 unit systems. Barbell: 2.5kg/5lbs. Dumbbell: 2kg/5lbs. Machine/cable: 5kg/10lbs.

### `slug.ts` — `slugify(name: string) => string`

Lowercase, replace spaces/underscores with hyphens, strip non-alphanumeric (except hyphens), collapse consecutive hyphens, trim edges. Example: `Barbell Back Squat` → `barbell-back-squat`.

### `uuid.ts` — `generateId() => string`

`crypto.randomUUID()` with manual v4 fallback for test environments.

### `timestamp.ts` — `nowISO() => string`

`new Date().toISOString()` — UTC always.

## Dependencies

None. This layer is imported by everything else but imports nothing from the project.

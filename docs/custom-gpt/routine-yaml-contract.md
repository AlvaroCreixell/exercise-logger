# Exercise Logger Routine YAML Contract

This is the contract the GPT must follow when generating workout routines for this project.

## Required Top-Level Keys

```yaml
version: 1
name: "Routine Name"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B]

days:
  A:
    label: "Day A Label"
    entries:
      - exercise_id: example-exercise-id
        sets:
          - { reps: [8, 12], count: 3 }

  B:
    label: "Day B Label"
    entries:
      - superset:
          - exercise_id: first-exercise-id
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: second-exercise-id
            sets:
              - { reps: [8, 12], count: 3 }

cardio:
  notes: "Optional cardio guidance"
  options:
    - { name: "Walk", detail: "20-30 min" }

notes:
  - "Optional top-level note"
```

## Required Rules

- `version` is required and must be `1`.
- `name` must be a non-empty string.
- `rest_default_sec` must be a non-negative number.
- `rest_superset_sec` must be a non-negative number.
- `day_order` must be a non-empty array.
- Every day ID listed in `day_order` must exist under `days`.
- Every day under `days` must appear in `day_order`.
- Every day must have:
  - `label`: non-empty string
  - `entries`: non-empty array

## Entry Shapes

Each item in `entries` must be exactly one of these:

### Single Exercise Entry

```yaml
- exercise_id: dumbbell-bench-press
  sets:
    - { reps: [8, 12], count: 3 }
```

### Superset Entry

```yaml
- superset:
    - exercise_id: incline-dumbbell-press
      sets:
        - { reps: [8, 12], count: 3 }
    - exercise_id: seated-cable-row
      sets:
        - { reps: [8, 12], count: 3 }
```

Superset rules:

- `superset` must be an array.
- It must contain exactly 2 exercise items.
- Both items must have the same total number of working sets.

## Exercise Item Keys

Required:

- `exercise_id`
- `sets`

Optional:

- `instance_label`
- `type_override`
- `equipment_override`
- `notes`

## Allowed Override Values

Valid `type_override` values:

- `weight`
- `bodyweight`
- `isometric`
- `cardio`

Valid `equipment_override` values:

- `barbell`
- `dumbbell`
- `machine`
- `cable`
- `kettlebell`
- `bodyweight`
- `cardio`
- `medicine-ball`
- `other`

## Set Block Rules

Each set block must define exactly one target kind:

- `reps`
- `duration`
- `distance`

Examples:

```yaml
- { reps: [8, 12], count: 3 }
- { reps: 8, count: 3 }
- { duration: [30, 60], count: 2 }
- { distance: 2000, count: 1 }
- { reps: [6, 8], count: 1, tag: top }
```

Rules:

- a range must be `[min, max]`
- range values must be numbers
- `min` must be less than `max`
- exact values must be numbers
- `count` is required
- `count` must be an integer `>= 1`
- `tag` is optional
- valid `tag` values are `top` and `amrap`

## Duplicate Exercise Rule

The same `exercise_id` may appear more than once in the same day only if each occurrence uses a distinct `instance_label`.

Valid example:

```yaml
- exercise_id: dumbbell-row
  instance_label: heavy
  sets:
    - { reps: [6, 8], count: 1 }

- exercise_id: dumbbell-row
  instance_label: light
  sets:
    - { reps: [10, 15], count: 2 }
```

## Optional Sections

### `cardio`

```yaml
cardio:
  notes: "After lifting or on off days"
  options:
    - { name: "Walk", detail: "20-30 min brisk pace" }
    - { name: "Bike", detail: "15-20 min easy pace" }
```

### `notes`

```yaml
notes:
  - "Rotation is continuous."
  - "Rest after both exercises in a superset round."
```

## Common Failure Cases

The generated YAML is invalid if any of these happen:

- missing required top-level keys
- `day_order` does not match `days`
- unknown `exercise_id`
- empty `entries`
- entry has neither `exercise_id` nor `superset`
- superset has fewer or more than 2 items
- superset items have unequal total set counts
- set block defines more than one of `reps`, `duration`, or `distance`
- range uses `min >= max`
- `count` is missing, non-integer, or `< 1`
- unsupported `tag`
- unsupported `type_override`
- unsupported `equipment_override`
- duplicate same-day exercise without distinct `instance_label`

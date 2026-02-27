from __future__ import annotations

import sqlite3


def seed_sample_routine(conn: sqlite3.Connection) -> None:
    """Insert a 3-day Push/Pull/Legs routine for Phase 1 testing.

    Safe to call multiple times — does nothing if an active routine exists.
    """
    existing = conn.execute(
        "SELECT id FROM routines WHERE is_active = 1 LIMIT 1"
    ).fetchone()
    if existing:
        return

    # --- Exercises ---
    exercises = [
        ("Bench Press", "weight", "barbell", "chest"),
        ("Overhead Press", "weight", "barbell", "shoulders"),
        ("Tricep Pushdown", "weight", "machine", "triceps"),
        ("Pull-Up", "weight", "bodyweight", "back"),
        ("Barbell Row", "weight", "barbell", "back"),
        ("Barbell Curl", "weight", "barbell", "biceps"),
        ("Squat", "weight", "barbell", "legs"),
        ("Romanian Deadlift", "weight", "barbell", "legs"),
        ("Leg Press", "weight", "machine", "legs"),
    ]
    exercise_ids: dict[str, int] = {}
    for name, category, equipment, muscle in exercises:
        cur = conn.execute(
            "INSERT OR IGNORE INTO exercises (name, category, equipment, muscle_group)"
            " VALUES (?, ?, ?, ?)",
            (name, category, equipment, muscle),
        )
        if cur.lastrowid:
            exercise_ids[name] = cur.lastrowid
        else:
            row = conn.execute(
                "SELECT id FROM exercises WHERE name = ?", (name,)
            ).fetchone()
            exercise_ids[name] = row["id"]

    # --- Routine ---
    cur = conn.execute(
        "INSERT INTO routines (name, description, is_active) VALUES (?, ?, 1)",
        ("Push / Pull / Legs", "Sample PPL routine for Phase 1 testing"),
    )
    routine_id = cur.lastrowid

    # --- Days ---
    days = [
        (0, "Push Day"),
        (1, "Pull Day"),
        (2, "Leg Day"),
    ]
    day_ids: dict[int, int] = {}
    for day_index, day_name in days:
        cur = conn.execute(
            "INSERT INTO routine_days (routine_id, day_index, name) VALUES (?, ?, ?)",
            (routine_id, day_index, day_name),
        )
        day_ids[day_index] = cur.lastrowid

    # --- Exercises per day ---
    day_exercises = {
        0: [  # Push
            ("Bench Press", 3, 8, 135.0),
            ("Overhead Press", 3, 8, 95.0),
            ("Tricep Pushdown", 3, 12, 50.0),
        ],
        1: [  # Pull
            ("Pull-Up", 3, 8, None),
            ("Barbell Row", 3, 8, 115.0),
            ("Barbell Curl", 3, 12, 45.0),
        ],
        2: [  # Legs
            ("Squat", 3, 8, 185.0),
            ("Romanian Deadlift", 3, 10, 135.0),
            ("Leg Press", 3, 12, 270.0),
        ],
    }
    for day_index, ex_list in day_exercises.items():
        day_id = day_ids[day_index]
        for sort_order, (ex_name, sets, reps, weight) in enumerate(ex_list):
            conn.execute(
                "INSERT INTO routine_day_exercises"
                " (routine_day_id, exercise_id, sort_order,"
                "  target_sets, target_reps, target_weight)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (day_id, exercise_ids[ex_name], sort_order, sets, reps, weight),
            )

    # --- Cycle state ---
    conn.execute(
        "INSERT INTO routine_cycle_state (routine_id, current_day_index)"
        " VALUES (?, 0)",
        (routine_id,),
    )

    conn.commit()

"""Weight and distance unit conversion utilities."""

LBS_TO_KG = 0.45359237
KG_TO_LBS = 1.0 / LBS_TO_KG
KM_TO_MILES = 0.621371
MILES_TO_KM = 1.0 / KM_TO_MILES


def lbs_to_kg(lbs: float) -> float:
    """Convert pounds to kilograms, rounded to 2 decimal places."""
    return round(lbs * LBS_TO_KG, 2)


def kg_to_lbs(kg: float) -> float:
    """Convert kilograms to pounds, rounded to 2 decimal places."""
    return round(kg * KG_TO_LBS, 2)


def km_to_miles(km: float) -> float:
    """Convert kilometers to miles, rounded to 2 decimal places."""
    return round(km * KM_TO_MILES, 2)


def miles_to_km(miles: float) -> float:
    """Convert miles to kilometers, rounded to 2 decimal places."""
    return round(miles * MILES_TO_KM, 2)


def convert_all_weights(conn, from_unit: str, to_unit: str) -> int:
    """Convert ALL weight values in the database in a single transaction.

    Converts weights in: exercise_set_targets, logged_sets, benchmark_definitions,
    benchmark_results (reference_weight_snapshot).

    Args:
        conn: SQLite connection
        from_unit: 'lbs' or 'kg'
        to_unit: 'lbs' or 'kg'

    Returns:
        Total number of rows updated across all tables.
    """
    if from_unit == to_unit:
        return 0

    if from_unit == "lbs" and to_unit == "kg":
        factor = LBS_TO_KG
    elif from_unit == "kg" and to_unit == "lbs":
        factor = KG_TO_LBS
    else:
        raise ValueError(f"Invalid conversion: {from_unit} -> {to_unit}")

    total = 0

    # exercise_set_targets.target_weight
    cursor = conn.execute(
        "UPDATE exercise_set_targets SET target_weight = ROUND(target_weight * ?, 2) WHERE target_weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # logged_sets.weight
    cursor = conn.execute(
        "UPDATE logged_sets SET weight = ROUND(weight * ?, 2) WHERE weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_definitions.reference_weight
    cursor = conn.execute(
        "UPDATE benchmark_definitions SET reference_weight = ROUND(reference_weight * ?, 2) WHERE reference_weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.reference_weight_snapshot
    cursor = conn.execute(
        "UPDATE benchmark_results SET reference_weight_snapshot = ROUND(reference_weight_snapshot * ?, 2) WHERE reference_weight_snapshot IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.result_value for max_weight method (result_value stores weight)
    cursor = conn.execute(
        "UPDATE benchmark_results SET result_value = ROUND(result_value * ?, 2) WHERE method_snapshot = 'max_weight'",
        (factor,),
    )
    total += cursor.rowcount

    conn.commit()
    return total

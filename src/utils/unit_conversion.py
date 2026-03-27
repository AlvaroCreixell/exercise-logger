"""Weight and distance unit conversion utilities."""

LBS_TO_KG = 0.45359237
KG_TO_LBS = 1.0 / LBS_TO_KG

# v2 canonical names
LB_TO_KG = LBS_TO_KG
KG_TO_LB = KG_TO_LBS


def lbs_to_kg(lbs: float) -> float:
    return round(lbs * LBS_TO_KG, 2)


def kg_to_lbs(kg: float) -> float:
    return round(kg * KG_TO_LBS, 2)


# v2 aliases
def lb_to_kg(lb: float) -> float:
    """Convert pounds to kilograms, rounded to 2 decimal places."""
    return round(lb * LB_TO_KG, 2)


def kg_to_lb(kg: float) -> float:
    """Convert kilograms to pounds, rounded to 2 decimal places."""
    return round(kg * KG_TO_LB, 2)


def convert_all_weights_v2(conn, from_unit: str, to_unit: str) -> int:
    """Convert ALL weight values in the v2 database.

    Converts:
    - logged_sets.weight (all non-NULL)
    - benchmark_results.result_value (max_weight method only)
    - benchmark_results.bodyweight (all non-NULL)

    Returns total rows updated.

    NOTE: Does NOT commit. The caller is responsible for committing after
    both the weight conversion AND the setting update succeed, so that
    both changes are applied atomically.
    """
    if from_unit == to_unit:
        return 0

    if from_unit == "lb" and to_unit == "kg":
        factor = LB_TO_KG
    elif from_unit == "kg" and to_unit == "lb":
        factor = KG_TO_LB
    else:
        raise ValueError(f"Invalid conversion: {from_unit} -> {to_unit}")

    total = 0

    # logged_sets.weight
    cursor = conn.execute(
        "UPDATE logged_sets SET weight = ROUND(weight * ?, 2) "
        "WHERE weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.result_value (max_weight only)
    cursor = conn.execute(
        "UPDATE benchmark_results SET result_value = ROUND(result_value * ?, 2) "
        "WHERE method = 'max_weight'",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.bodyweight
    cursor = conn.execute(
        "UPDATE benchmark_results SET bodyweight = ROUND(bodyweight * ?, 2) "
        "WHERE bodyweight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    return total

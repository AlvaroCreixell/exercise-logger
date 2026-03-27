"""Weight and distance unit conversion utilities."""

LBS_TO_KG = 0.45359237
KG_TO_LBS = 1.0 / LBS_TO_KG


def lbs_to_kg(lbs: float) -> float:
    return round(lbs * LBS_TO_KG, 2)


def kg_to_lbs(kg: float) -> float:
    return round(kg * KG_TO_LBS, 2)

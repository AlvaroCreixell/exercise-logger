"""SettingsService — app settings and weight unit management."""
import sqlite3
from typing import Optional

from src.repositories.settings_repo import SettingsRepo
from src.utils.unit_conversion import convert_all_weights_v2


class SettingsService:
    def __init__(
        self,
        settings_repo: SettingsRepo,
        conn: sqlite3.Connection,
    ):
        self._repo = settings_repo
        self._conn = conn

    # ------------------------------------------------------------------
    # Generic get/set
    # ------------------------------------------------------------------

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        value = self._repo.get(key)
        return value if value is not None else default

    def set(self, key: str, value: str) -> None:
        self._repo.set(key, value)
        self._repo.commit()

    def get_all(self) -> dict:
        return self._repo.get_all()

    # ------------------------------------------------------------------
    # Weight unit
    # ------------------------------------------------------------------

    def get_weight_unit(self) -> str:
        """Return current weight unit. Default: 'lb'."""
        return self.get("weight_unit", "lb")

    def set_weight_unit(self, unit: str) -> int:
        """Set weight unit and convert all DB weights.

        Returns number of rows converted. 0 if already the target unit.
        convert_all_weights_v2 does NOT commit; we commit here after both
        the weight conversion and the setting update succeed atomically.
        """
        current = self.get_weight_unit()
        if current == unit:
            return 0

        total = convert_all_weights_v2(self._conn, current, unit)
        self._repo.set("weight_unit", unit)
        self._repo.commit()  # single commit covers both conversion and setting update
        return total

    def toggle_weight_unit(self) -> dict:
        """Toggle between lb and kg. Converts all historical weights.

        Returns: {new_unit, rows_converted}
        """
        current = self.get_weight_unit()
        new_unit = "kg" if current == "lb" else "lb"
        rows = self.set_weight_unit(new_unit)
        return {"new_unit": new_unit, "rows_converted": rows}

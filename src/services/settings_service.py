"""Settings service — app configuration and unit management."""
from typing import Optional
from src.repositories.settings_repo import SettingsRepo
from src.utils.unit_conversion import convert_all_weights


class SettingsService:
    def __init__(self, settings_repo: SettingsRepo, conn):
        self._repo = settings_repo
        self._conn = conn

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        value = self._repo.get(key)
        return value if value is not None else default

    def set(self, key: str, value: str) -> None:
        self._repo.set(key, value)
        self._repo.commit()

    def get_weight_unit(self) -> str:
        return self.get("weight_unit", "lbs")

    def set_weight_unit(self, unit: str) -> int:
        """Change weight unit and convert all DB weights. Returns rows converted."""
        current = self.get_weight_unit()
        if current == unit:
            return 0
        total = convert_all_weights(self._conn, current, unit)
        self._repo.set("weight_unit", unit)
        self._repo.commit()
        return total

    def get_all(self) -> dict:
        return self._repo.get_all()

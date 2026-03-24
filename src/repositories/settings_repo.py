"""Settings repository — key-value CRUD."""
from typing import Optional
from src.models.settings import Setting
from src.repositories.base import BaseRepository


class SettingsRepo(BaseRepository):

    def get(self, key: str) -> Optional[str]:
        row = self._fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def set(self, key: str, value: str) -> None:
        self._execute(
            """INSERT INTO settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = ?""",
            (key, value, value),
        )

    def delete(self, key: str) -> None:
        self._execute("DELETE FROM settings WHERE key = ?", (key,))

    def get_all(self) -> dict:
        rows = self._fetchall("SELECT key, value FROM settings ORDER BY key")
        return {r["key"]: r["value"] for r in rows}

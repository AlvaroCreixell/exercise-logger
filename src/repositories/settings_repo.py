"""Settings repository — key-value CRUD."""
from typing import Optional
from src.repositories.base import BaseRepository


class SettingsRepo(BaseRepository):

    def get(self, key: str) -> Optional[str]:
        """Get a setting value by key, or None if not set."""
        row = self._fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def set(self, key: str, value: str) -> None:
        """Set a setting value (upsert)."""
        self._execute(
            """INSERT INTO settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
            (key, value),
        )

    def delete(self, key: str) -> None:
        """Delete a setting by key."""
        self._execute("DELETE FROM settings WHERE key = ?", (key,))

    def get_all(self) -> dict[str, str]:
        """Get all settings as a dict."""
        rows = self._fetchall("SELECT key, value FROM settings ORDER BY key")
        return {r["key"]: r["value"] for r in rows}

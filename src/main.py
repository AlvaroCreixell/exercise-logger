from __future__ import annotations

import flet as ft

from config import APP_NAME


def main(page: ft.Page) -> None:
    page.title = APP_NAME
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 20

    page.add(
        ft.Column(
            controls=[
                ft.Text(
                    APP_NAME,
                    size=32,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.WHITE,
                ),
                ft.Text(
                    "Phase 0 — scaffold verified.",
                    size=16,
                    color=ft.Colors.WHITE70,
                ),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
            expand=True,
        )
    )


if __name__ == "__main__":
    ft.app(target=main)

from __future__ import annotations

from typing import Optional

import flet as ft


def build_settings_view(page: ft.Page) -> ft.View:
    """Settings screen — navigation hub for sub-screens."""

    def tile(
        title: str,
        subtitle: str,
        icon: str,
        route: Optional[str] = None,
        disabled: bool = False,
    ) -> ft.ListTile:
        def on_tap(e: ft.ControlEvent) -> None:
            if route:
                page.go(route)

        return ft.ListTile(
            leading=ft.Icon(icon, color=ft.Colors.WHITE70 if not disabled else ft.Colors.WHITE24),
            title=ft.Text(title, color=ft.Colors.WHITE if not disabled else ft.Colors.WHITE38),
            subtitle=ft.Text(subtitle, color=ft.Colors.WHITE54 if not disabled else ft.Colors.WHITE24, size=12),
            trailing=ft.Icon(ft.Icons.CHEVRON_RIGHT, color=ft.Colors.WHITE38) if route else None,
            on_click=on_tap if route else None,
        )

    body = ft.ListView(
        controls=[
            ft.Container(height=8),
            ft.Container(
                content=ft.Text("ROUTINE", size=11, color=ft.Colors.WHITE38, weight=ft.FontWeight.W_600),
                padding=ft.padding.only(left=16, bottom=4, top=8),
            ),
            ft.Card(
                content=ft.Column(
                    controls=[
                        tile(
                            "Routine Editor",
                            "Create routines, add days and exercises",
                            ft.Icons.FITNESS_CENTER,
                            route="/settings/routine",
                        ),
                        ft.Divider(height=1, color=ft.Colors.WHITE12),
                        tile(
                            "Exercise Catalog",
                            "Add or archive exercises",
                            ft.Icons.LIST_ALT_OUTLINED,
                            route="/settings/exercises",
                        ),
                    ],
                    spacing=0,
                ),
                margin=ft.margin.symmetric(horizontal=0),
            ),
            ft.Container(height=8),
            ft.Container(
                content=ft.Text("DATA", size=11, color=ft.Colors.WHITE38, weight=ft.FontWeight.W_600),
                padding=ft.padding.only(left=16, bottom=4, top=8),
            ),
            ft.Card(
                content=ft.Column(
                    controls=[
                        tile(
                            "Weight Unit",
                            "lbs / kg — coming in Phase 4",
                            ft.Icons.SCALE_OUTLINED,
                            disabled=True,
                        ),
                        ft.Divider(height=1, color=ft.Colors.WHITE12),
                        tile(
                            "Export Data",
                            "JSON export — coming in Phase 4",
                            ft.Icons.DOWNLOAD_OUTLINED,
                            disabled=True,
                        ),
                    ],
                    spacing=0,
                ),
                margin=ft.margin.symmetric(horizontal=0),
            ),
        ],
        padding=ft.padding.all(16),
        expand=True,
    )

    return ft.View(
        route="/settings",
        controls=[
            ft.AppBar(
                title=ft.Text("Settings", weight=ft.FontWeight.BOLD),
                bgcolor=ft.Colors.SURFACE,
                automatically_imply_leading=False,
            ),
            body,
        ],
        bgcolor=ft.Colors.BACKGROUND,
        padding=0,
    )

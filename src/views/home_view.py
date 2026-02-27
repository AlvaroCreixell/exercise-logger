from __future__ import annotations

from typing import Optional

import flet as ft

from models.routine import Routine, RoutineDay
from models.workout import WorkoutSession
from services.cycle_service import CycleService
from services.workout_service import WorkoutService


def build_home_view(
    page: ft.Page,
    routine: Optional[Routine],
    current_day: Optional[RoutineDay],
    all_days: Optional[list[RoutineDay]],
    in_progress: Optional[WorkoutSession],
    workout_svc: WorkoutService,
    cycle_svc: CycleService,
) -> ft.View:
    """Build and return the Home ft.View."""

    def _do_start_new_session() -> None:
        """Start a fresh session — caller must ensure no in-progress session exists."""
        if routine is None or current_day is None:
            page.open(ft.SnackBar(ft.Text("No active routine. Set one up in Settings.")))
            page.update()
            return
        session = workout_svc.start_session(
            routine_id=routine.id,
            routine_day_id=current_day.id,
        )
        page.go(f"/workout/{session.id}")

    def on_start_workout(e: ft.ControlEvent) -> None:
        if routine is None or current_day is None:
            page.open(ft.SnackBar(ft.Text("No active routine. Set one up in Settings.")))
            page.update()
            return
        if in_progress:
            # Prompt the user to resolve the existing session first.
            def do_resume(e2: ft.ControlEvent) -> None:
                page.close(dlg)
                page.go(f"/workout/{in_progress.id}")

            def do_abandon(e2: ft.ControlEvent) -> None:
                page.close(dlg)
                workout_svc.abandon_session(in_progress.id)
                _do_start_new_session()

            dlg = ft.AlertDialog(
                modal=True,
                title=ft.Text("Workout already in progress"),
                content=ft.Text(
                    "You have an unfinished workout. Resume it, or abandon it to start a new one."
                ),
                actions=[
                    ft.TextButton("Cancel", on_click=lambda e: page.close(dlg)),
                    ft.OutlinedButton(
                        "Abandon & start new",
                        on_click=do_abandon,
                        style=ft.ButtonStyle(color=ft.Colors.RED_400),
                    ),
                    ft.ElevatedButton("Resume", on_click=do_resume),
                ],
            )
            page.open(dlg)
            return
        _do_start_new_session()

    def on_resume_workout(e: ft.ControlEvent) -> None:
        if in_progress:
            page.go(f"/workout/{in_progress.id}")

    def on_abandon_from_banner(e: ft.ControlEvent) -> None:
        def do_abandon(e2: ft.ControlEvent) -> None:
            page.close(confirm_dlg)
            workout_svc.abandon_session(in_progress.id)
            page.go("/home")

        confirm_dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Abandon workout?"),
            content=ft.Text("Sets logged so far will be saved. The cycle will NOT advance."),
            actions=[
                ft.TextButton("Keep it", on_click=lambda e: page.close(confirm_dlg)),
                ft.ElevatedButton(
                    "Abandon",
                    on_click=do_abandon,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.RED_700),
                ),
            ],
        )
        page.open(confirm_dlg)

    # ── resume banner ────────────────────────────────────────────
    resume_banner: list[ft.Control] = []
    if in_progress:
        resume_banner.append(
            ft.Container(
                content=ft.Row(
                    controls=[
                        ft.Icon(ft.Icons.WARNING_AMBER_ROUNDED, color=ft.Colors.AMBER),
                        ft.Text(
                            "Workout in progress",
                            color=ft.Colors.AMBER,
                            weight=ft.FontWeight.BOLD,
                            expand=True,
                        ),
                        ft.TextButton(
                            "Resume",
                            on_click=on_resume_workout,
                            style=ft.ButtonStyle(color=ft.Colors.AMBER),
                        ),
                        ft.TextButton(
                            "Abandon",
                            on_click=on_abandon_from_banner,
                            style=ft.ButtonStyle(color=ft.Colors.RED_400),
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.START,
                ),
                bgcolor=ft.Colors.with_opacity(0.15, ft.Colors.AMBER),
                border_radius=8,
                padding=ft.padding.symmetric(horizontal=16, vertical=12),
            )
        )

    # ── day info card ─────────────────────────────────────────────
    if routine and current_day:
        day_info: ft.Control = ft.Card(
            content=ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Text(
                            routine.name,
                            size=13,
                            color=ft.Colors.WHITE54,
                            weight=ft.FontWeight.W_500,
                        ),
                        ft.Text(
                            current_day.name,
                            size=26,
                            weight=ft.FontWeight.BOLD,
                            color=ft.Colors.WHITE,
                        ),
                        ft.Text(
                            f"Day {current_day.day_index + 1}",
                            size=13,
                            color=ft.Colors.WHITE54,
                        ),
                    ],
                    spacing=4,
                ),
                padding=ft.padding.all(20),
            ),
            elevation=2,
        )
    else:
        day_info = ft.Container(
            content=ft.Column(
                controls=[
                    ft.Icon(ft.Icons.FITNESS_CENTER, size=48, color=ft.Colors.WHITE38),
                    ft.Text(
                        "No routine set up yet",
                        size=16,
                        color=ft.Colors.WHITE54,
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Text(
                        "Go to Settings → Routine Editor to create one.",
                        size=13,
                        color=ft.Colors.WHITE38,
                        text_align=ft.TextAlign.CENTER,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=12,
            ),
            padding=ft.padding.all(32),
            alignment=ft.alignment.center,
        )

    # ── day selector ──────────────────────────────────────────────
    day_selector: list[ft.Control] = []
    if routine and all_days and len(all_days) > 1:
        chips = []
        for d in all_days:
            is_current = current_day is not None and d.id == current_day.id

            def on_chip_tap(e: ft.ControlEvent, day=d) -> None:
                cycle_svc.override_day(routine.id, day.day_index)
                page.go("/home")

            chips.append(
                ft.ActionChip(
                    label=ft.Text(
                        d.name,
                        size=12,
                        color=ft.Colors.WHITE if is_current else ft.Colors.WHITE70,
                        weight=ft.FontWeight.BOLD if is_current else ft.FontWeight.NORMAL,
                    ),
                    bgcolor=ft.Colors.BLUE_900 if is_current else ft.Colors.with_opacity(0.12, ft.Colors.WHITE),
                    on_click=on_chip_tap,
                )
            )
        day_selector.append(
            ft.Column(
                controls=[
                    ft.Text("Switch Day", size=11, color=ft.Colors.WHITE38, weight=ft.FontWeight.W_600),
                    ft.Row(controls=chips, wrap=True, spacing=6, run_spacing=6),
                ],
                spacing=6,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            )
        )

    # ── start button ──────────────────────────────────────────────
    start_btn = ft.ElevatedButton(
        text="Start Workout",
        icon=ft.Icons.PLAY_ARROW_ROUNDED,
        on_click=on_start_workout,
        disabled=routine is None,
        style=ft.ButtonStyle(
            bgcolor=ft.Colors.GREEN_700,
            color=ft.Colors.WHITE,
            shape=ft.RoundedRectangleBorder(radius=12),
            padding=ft.padding.symmetric(horizontal=32, vertical=18),
        ),
        width=280,
    )

    body = ft.Column(
        controls=[
            *resume_banner,
            ft.Container(height=24),
            day_info,
            *([ft.Container(height=16), *day_selector] if day_selector else []),
            ft.Container(height=32),
            start_btn,
        ],
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        scroll=ft.ScrollMode.AUTO,
        expand=True,
    )

    return ft.View(
        route="/home",
        controls=[
            ft.AppBar(
                title=ft.Text("Exercise Logger", weight=ft.FontWeight.BOLD),
                bgcolor=ft.Colors.SURFACE,
                center_title=False,
                automatically_imply_leading=False,
            ),
            body,
        ],
        bgcolor=ft.Colors.BACKGROUND,
        padding=ft.padding.all(16),
    )

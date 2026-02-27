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
    in_progress: Optional[WorkoutSession],
    workout_svc: WorkoutService,
    cycle_svc: CycleService,
) -> ft.View:
    """Build and return the Home ft.View."""

    def on_start_workout(e: ft.ControlEvent) -> None:
        if routine is None or current_day is None:
            page.open(ft.SnackBar(ft.Text("No active routine. Set one up in Settings.")))
            page.update()
            return
        try:
            session = workout_svc.start_session(
                routine_id=routine.id,
                routine_day_id=current_day.id,
            )
            page.go(f"/workout/{session.id}")
        except RuntimeError as exc:
            page.open(ft.SnackBar(ft.Text(str(exc))))
            page.update()

    def on_resume_workout(e: ft.ControlEvent) -> None:
        if in_progress:
            page.go(f"/workout/{in_progress.id}")

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
                        ),
                        ft.TextButton(
                            "Resume",
                            on_click=on_resume_workout,
                            style=ft.ButtonStyle(color=ft.Colors.AMBER),
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
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

    # ── start button ──────────────────────────────────────────────
    start_btn = ft.ElevatedButton(
        text="Start Workout" if not in_progress else "New Workout",
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

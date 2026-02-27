from __future__ import annotations

from typing import Optional

import flet as ft

from models.exercise import ExerciseCategory
from models.routine import Routine, RoutineDay
from services.exercise_service import ExerciseService
from services.routine_service import RoutineService

_CAT_LABELS = {ExerciseCategory.WEIGHT: "Weight", ExerciseCategory.CARDIO: "Cardio"}


def build_routine_editor_view(
    page: ft.Page,
    routine_svc: RoutineService,
    exercise_svc: ExerciseService,
) -> ft.View:
    """Full routine editor: create routine, manage days and exercises."""

    main_col = ft.Column(spacing=12, scroll=ft.ScrollMode.AUTO, expand=True)

    # ── Helpers ───────────────────────────────────────────────────

    def rebuild() -> None:
        """Refresh the entire editor from DB state."""
        main_col.controls.clear()
        routine = routine_svc.get_active_routine()
        _render_editor(routine)
        main_col.update()

    def _render_editor(routine: Optional[Routine]) -> None:
        if routine is None:
            _render_no_routine()
        else:
            _render_active_routine(routine)

    # ── No-routine state ──────────────────────────────────────────

    def _render_no_routine() -> None:
        def on_create(e: ft.ControlEvent) -> None:
            _open_create_dialog()

        main_col.controls.append(
            ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Icon(ft.Icons.FITNESS_CENTER, size=56, color=ft.Colors.WHITE24),
                        ft.Text(
                            "No routine set up yet",
                            size=18,
                            color=ft.Colors.WHITE54,
                            text_align=ft.TextAlign.CENTER,
                        ),
                        ft.Text(
                            "Create a routine to define your workout days and exercises.",
                            size=13,
                            color=ft.Colors.WHITE38,
                            text_align=ft.TextAlign.CENTER,
                        ),
                        ft.ElevatedButton(
                            "Create Routine",
                            icon=ft.Icons.ADD,
                            on_click=on_create,
                            style=ft.ButtonStyle(
                                bgcolor=ft.Colors.BLUE_700,
                                color=ft.Colors.WHITE,
                                shape=ft.RoundedRectangleBorder(radius=10),
                            ),
                        ),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=16,
                ),
                alignment=ft.alignment.center,
                expand=True,
                padding=ft.padding.all(32),
            )
        )

    # ── Active routine ────────────────────────────────────────────

    def _render_active_routine(routine: Routine) -> None:
        # Header card
        def on_rename_routine(e: ft.ControlEvent) -> None:
            _open_rename_dialog(
                title="Rename Routine",
                current=routine.name,
                on_confirm=lambda name: (
                    routine_svc.rename_routine(routine.id, name),
                    rebuild(),
                ),
            )

        def on_create_new(e: ft.ControlEvent) -> None:
            _open_create_dialog()

        main_col.controls.append(
            ft.Card(
                content=ft.Container(
                    content=ft.Row(
                        controls=[
                            ft.Column(
                                controls=[
                                    ft.Text("ACTIVE ROUTINE", size=10, color=ft.Colors.WHITE38, weight=ft.FontWeight.W_600),
                                    ft.Text(routine.name, size=20, weight=ft.FontWeight.BOLD, color=ft.Colors.WHITE),
                                ],
                                spacing=2,
                                expand=True,
                            ),
                            ft.IconButton(
                                icon=ft.Icons.EDIT_OUTLINED,
                                icon_color=ft.Colors.WHITE54,
                                tooltip="Rename routine",
                                on_click=on_rename_routine,
                            ),
                            ft.TextButton(
                                text="New",
                                icon=ft.Icons.ADD,
                                on_click=on_create_new,
                                style=ft.ButtonStyle(color=ft.Colors.BLUE_400),
                            ),
                        ],
                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                    padding=ft.padding.all(16),
                ),
            )
        )

        # Days
        days = routine_svc.get_days(routine.id)
        total = len(days)

        for idx, day in enumerate(days):
            main_col.controls.append(
                _build_day_card(routine, day, idx, total)
            )

        # Add day button
        def on_add_day(e: ft.ControlEvent) -> None:
            _open_add_day_dialog(routine)

        main_col.controls.append(
            ft.Container(
                content=ft.OutlinedButton(
                    "Add Day",
                    icon=ft.Icons.ADD,
                    on_click=on_add_day,
                    style=ft.ButtonStyle(color=ft.Colors.WHITE70),
                ),
                alignment=ft.alignment.center,
                padding=ft.padding.symmetric(vertical=8),
            )
        )

    # ── Day card ──────────────────────────────────────────────────

    def _build_day_card(
        routine: Routine, day: RoutineDay, idx: int, total: int
    ) -> ft.Card:
        exercises = routine_svc.get_day_exercises(day.id)

        def on_rename(e: ft.ControlEvent) -> None:
            _open_rename_dialog(
                title=f"Rename Day {idx + 1}",
                current=day.name,
                on_confirm=lambda name: (
                    routine_svc.rename_day(day.id, name),
                    rebuild(),
                ),
            )

        def on_delete(e: ft.ControlEvent) -> None:
            def do_delete(e2: ft.ControlEvent) -> None:
                page.close(confirm_dlg)
                routine_svc.delete_day(day.id)
                rebuild()

            confirm_dlg = ft.AlertDialog(
                modal=True,
                title=ft.Text(f"Delete {day.name}?"),
                content=ft.Text("This will remove the day and all its exercises from the template."),
                actions=[
                    ft.TextButton("Cancel", on_click=lambda e: page.close(confirm_dlg)),
                    ft.ElevatedButton(
                        "Delete",
                        on_click=do_delete,
                        style=ft.ButtonStyle(bgcolor=ft.Colors.RED_700),
                    ),
                ],
            )
            page.open(confirm_dlg)

        def on_move_up(e: ft.ControlEvent) -> None:
            routine_svc.move_day_up(routine.id, day.id)
            rebuild()

        def on_move_down(e: ft.ControlEvent) -> None:
            routine_svc.move_day_down(routine.id, day.id)
            rebuild()

        def on_add_exercise(e: ft.ControlEvent) -> None:
            _open_add_exercise_dialog(day)

        # Exercise rows
        exercise_rows: list[ft.Control] = []
        for rde, ex in exercises:
            target_parts = []
            if rde.target_sets:
                target_parts.append(f"{rde.target_sets} sets")
            if rde.target_reps:
                target_parts.append(f"{rde.target_reps} reps")
            if rde.target_weight:
                target_parts.append(f"@ {rde.target_weight:.0f}")
            target_str = " · ".join(target_parts) if target_parts else "No targets"

            def on_remove_ex(e: ft.ControlEvent, rde_id=rde.id) -> None:
                routine_svc.remove_exercise_from_day(rde_id)
                rebuild()

            exercise_rows.append(
                ft.Row(
                    controls=[
                        ft.Column(
                            controls=[
                                ft.Text(ex.name, size=14, color=ft.Colors.WHITE, weight=ft.FontWeight.W_500),
                                ft.Text(target_str, size=11, color=ft.Colors.WHITE54),
                            ],
                            spacing=2,
                            expand=True,
                        ),
                        ft.IconButton(
                            icon=ft.Icons.REMOVE_CIRCLE_OUTLINE,
                            icon_color=ft.Colors.RED_400,
                            icon_size=20,
                            tooltip="Remove exercise",
                            on_click=on_remove_ex,
                        ),
                    ],
                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                )
            )

        if not exercises:
            exercise_rows.append(
                ft.Text("No exercises yet", size=12, color=ft.Colors.WHITE38)
            )

        controls = [
            # Day header
            ft.Row(
                controls=[
                    ft.Text(
                        f"Day {idx + 1}",
                        size=11,
                        color=ft.Colors.WHITE38,
                        weight=ft.FontWeight.W_600,
                    ),
                    ft.Text(day.name, size=16, weight=ft.FontWeight.BOLD, color=ft.Colors.WHITE, expand=True),
                    ft.IconButton(
                        icon=ft.Icons.EDIT_OUTLINED,
                        icon_color=ft.Colors.WHITE38,
                        icon_size=18,
                        tooltip="Rename",
                        on_click=on_rename,
                    ),
                    ft.IconButton(
                        icon=ft.Icons.ARROW_UPWARD,
                        icon_color=ft.Colors.WHITE38 if idx > 0 else ft.Colors.WHITE12,
                        icon_size=18,
                        tooltip="Move up",
                        on_click=on_move_up if idx > 0 else None,
                    ),
                    ft.IconButton(
                        icon=ft.Icons.ARROW_DOWNWARD,
                        icon_color=ft.Colors.WHITE38 if idx < total - 1 else ft.Colors.WHITE12,
                        icon_size=18,
                        tooltip="Move down",
                        on_click=on_move_down if idx < total - 1 else None,
                    ),
                    ft.IconButton(
                        icon=ft.Icons.DELETE_OUTLINE,
                        icon_color=ft.Colors.RED_400,
                        icon_size=18,
                        tooltip="Delete day",
                        on_click=on_delete,
                    ),
                ],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            ft.Divider(height=1, color=ft.Colors.WHITE12),
            *exercise_rows,
            ft.TextButton(
                text="Add Exercise",
                icon=ft.Icons.ADD_CIRCLE_OUTLINE,
                on_click=on_add_exercise,
                style=ft.ButtonStyle(color=ft.Colors.BLUE_400),
            ),
        ]

        return ft.Card(
            content=ft.Container(
                content=ft.Column(controls=controls, spacing=6),
                padding=ft.padding.all(14),
            ),
            elevation=2,
            margin=ft.margin.symmetric(vertical=2),
        )

    # ── Dialogs ───────────────────────────────────────────────────

    def _open_create_dialog() -> None:
        field = ft.TextField(
            label="Routine name",
            autofocus=True,
            bgcolor=ft.Colors.SURFACE,
            color=ft.Colors.WHITE,
            border_color=ft.Colors.WHITE24,
            focused_border_color=ft.Colors.BLUE_400,
            label_style=ft.TextStyle(color=ft.Colors.WHITE54),
            capitalization=ft.TextCapitalization.WORDS,
        )

        def do_create(e: ft.ControlEvent) -> None:
            name = (field.value or "").strip()
            if not name:
                field.error_text = "Required"
                field.update()
                return
            page.close(dlg)
            routine = routine_svc.create_routine(name)
            routine_svc.set_active_routine(routine.id)
            rebuild()

        dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Create Routine"),
            content=field,
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: page.close(dlg)),
                ft.ElevatedButton(
                    "Create",
                    on_click=do_create,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_700),
                ),
            ],
        )
        page.open(dlg)

    def _open_rename_dialog(
        title: str, current: str, on_confirm
    ) -> None:
        field = ft.TextField(
            value=current,
            label="Name",
            autofocus=True,
            bgcolor=ft.Colors.SURFACE,
            color=ft.Colors.WHITE,
            border_color=ft.Colors.WHITE24,
            focused_border_color=ft.Colors.BLUE_400,
            label_style=ft.TextStyle(color=ft.Colors.WHITE54),
        )

        def do_rename(e: ft.ControlEvent) -> None:
            name = (field.value or "").strip()
            if not name:
                field.error_text = "Required"
                field.update()
                return
            page.close(dlg)
            on_confirm(name)

        dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text(title),
            content=field,
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: page.close(dlg)),
                ft.ElevatedButton(
                    "Save",
                    on_click=do_rename,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_700),
                ),
            ],
        )
        page.open(dlg)

    def _open_add_day_dialog(routine: Routine) -> None:
        field = ft.TextField(
            label="Day name (e.g. Push Day, Pull Day, Legs)",
            autofocus=True,
            bgcolor=ft.Colors.SURFACE,
            color=ft.Colors.WHITE,
            border_color=ft.Colors.WHITE24,
            focused_border_color=ft.Colors.BLUE_400,
            label_style=ft.TextStyle(color=ft.Colors.WHITE54),
            capitalization=ft.TextCapitalization.WORDS,
        )

        def do_add(e: ft.ControlEvent) -> None:
            name = (field.value or "").strip()
            if not name:
                field.error_text = "Required"
                field.update()
                return
            page.close(dlg)
            routine_svc.add_day(routine.id, name)
            rebuild()

        dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Add Day"),
            content=field,
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: page.close(dlg)),
                ft.ElevatedButton(
                    "Add",
                    on_click=do_add,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_700),
                ),
            ],
        )
        page.open(dlg)

    def _open_add_exercise_dialog(day: RoutineDay) -> None:
        all_exercises = exercise_svc.get_all()
        if not all_exercises:
            page.open(ft.SnackBar(
                ft.Text("No exercises in catalog. Add some first."),
                duration=3000,
            ))
            return

        ex_dropdown = ft.Dropdown(
            label="Exercise",
            options=[ft.dropdown.Option(key=str(ex.id), text=ex.name) for ex in all_exercises],
            value=str(all_exercises[0].id),
            bgcolor=ft.Colors.SURFACE,
            color=ft.Colors.WHITE,
            border_color=ft.Colors.WHITE24,
            focused_border_color=ft.Colors.BLUE_400,
            expand=True,
        )

        def _int_field(label: str, hint: str = "") -> ft.TextField:
            return ft.TextField(
                label=label,
                hint_text=hint,
                keyboard_type=ft.KeyboardType.NUMBER,
                width=90,
                bgcolor=ft.Colors.SURFACE,
                color=ft.Colors.WHITE,
                border_color=ft.Colors.WHITE24,
                focused_border_color=ft.Colors.BLUE_400,
                label_style=ft.TextStyle(color=ft.Colors.WHITE54),
            )

        sets_field = _int_field("Sets", "3")
        reps_field = _int_field("Reps", "8")
        weight_field = _int_field("Weight", "0")

        def do_add(e: ft.ControlEvent) -> None:
            ex_id = int(ex_dropdown.value)
            try:
                target_sets = int(sets_field.value) if sets_field.value else None
                target_reps = int(reps_field.value) if reps_field.value else None
                target_weight = float(weight_field.value) if weight_field.value else None
            except ValueError:
                return

            page.close(dlg)
            routine_svc.add_exercise_to_day(
                day.id,
                ex_id,
                target_sets=target_sets,
                target_reps=target_reps,
                target_weight=target_weight,
            )
            rebuild()

        dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text(f"Add Exercise to {day.name}"),
            content=ft.Column(
                controls=[
                    ex_dropdown,
                    ft.Row(
                        controls=[sets_field, reps_field, weight_field],
                        spacing=8,
                    ),
                ],
                spacing=12,
                tight=True,
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: page.close(dlg)),
                ft.ElevatedButton(
                    "Add",
                    on_click=do_add,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_700),
                ),
            ],
        )
        page.open(dlg)

    # ── Initial render ────────────────────────────────────────────

    rebuild()

    return ft.View(
        route="/settings/routine",
        controls=[
            ft.AppBar(
                title=ft.Text("Routine Editor", weight=ft.FontWeight.BOLD),
                bgcolor=ft.Colors.SURFACE,
                leading=ft.IconButton(
                    icon=ft.Icons.ARROW_BACK,
                    on_click=lambda e: page.go("/settings"),
                    tooltip="Back to Settings",
                ),
                automatically_imply_leading=False,
            ),
            ft.Container(
                content=main_col,
                expand=True,
                padding=ft.padding.all(16),
            ),
        ],
        bgcolor=ft.Colors.SURFACE,
        padding=0,
    )

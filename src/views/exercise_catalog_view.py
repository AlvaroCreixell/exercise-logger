from __future__ import annotations

import flet as ft

from models.exercise import ExerciseCategory
from services.exercise_service import ExerciseService

_CATEGORIES = [ExerciseCategory.WEIGHT, ExerciseCategory.CARDIO]
_CAT_LABELS = {ExerciseCategory.WEIGHT: "Weight", ExerciseCategory.CARDIO: "Cardio"}


def build_exercise_catalog_view(
    page: ft.Page,
    exercise_svc: ExerciseService,
) -> ft.View:
    """Exercise catalog: add exercises, archive / unarchive."""

    show_archived_ref = ft.Ref[bool]()
    show_archived = [False]  # mutable container so nested functions can write

    list_col = ft.Column(spacing=0, scroll=ft.ScrollMode.AUTO, expand=True)

    # ── Add-exercise form ────────────────────────────────────────
    name_field = ft.TextField(
        label="Exercise name",
        expand=True,
        bgcolor=ft.Colors.SURFACE,
        border_color=ft.Colors.WHITE24,
        focused_border_color=ft.Colors.BLUE_400,
        color=ft.Colors.WHITE,
        label_style=ft.TextStyle(color=ft.Colors.WHITE54),
        capitalization=ft.TextCapitalization.WORDS,
    )
    cat_dropdown = ft.Dropdown(
        label="Category",
        width=130,
        options=[ft.dropdown.Option(key=c.value, text=_CAT_LABELS[c]) for c in _CATEGORIES],
        value=ExerciseCategory.WEIGHT.value,
        bgcolor=ft.Colors.SURFACE,
        color=ft.Colors.WHITE,
        border_color=ft.Colors.WHITE24,
        focused_border_color=ft.Colors.BLUE_400,
    )

    def do_add(e: ft.ControlEvent) -> None:
        name = (name_field.value or "").strip()
        if not name:
            name_field.error_text = "Required"
            name_field.update()
            return
        name_field.error_text = None
        cat = ExerciseCategory(cat_dropdown.value)
        exercise_svc.create(name, cat)
        name_field.value = ""
        name_field.update()
        cat_dropdown.value = ExerciseCategory.WEIGHT.value
        cat_dropdown.update()
        rebuild()

    add_btn = ft.ElevatedButton(
        text="Add",
        icon=ft.Icons.ADD,
        on_click=do_add,
        style=ft.ButtonStyle(
            bgcolor=ft.Colors.BLUE_700,
            color=ft.Colors.WHITE,
            shape=ft.RoundedRectangleBorder(radius=8),
        ),
    )

    add_form = ft.Container(
        content=ft.Row(
            controls=[name_field, cat_dropdown, add_btn],
            vertical_alignment=ft.CrossAxisAlignment.START,
            spacing=8,
        ),
        padding=ft.padding.all(12),
    )

    # ── List ─────────────────────────────────────────────────────

    def rebuild() -> None:
        exercises = exercise_svc.get_all(include_archived=show_archived[0])
        list_col.controls.clear()

        if not exercises:
            list_col.controls.append(
                ft.Container(
                    content=ft.Text(
                        "No exercises yet. Add one above.",
                        color=ft.Colors.WHITE54,
                        text_align=ft.TextAlign.CENTER,
                    ),
                    padding=ft.padding.all(32),
                    alignment=ft.alignment.center,
                )
            )
            list_col.update()
            return

        active = [ex for ex in exercises if not ex.is_archived]
        archived = [ex for ex in exercises if ex.is_archived]

        def make_tile(ex, is_archived_item: bool) -> ft.ListTile:
            cat_chip = ft.Container(
                content=ft.Text(
                    _CAT_LABELS.get(ex.category, ex.category.value),
                    size=11,
                    color=ft.Colors.WHITE70,
                ),
                bgcolor=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
                border_radius=4,
                padding=ft.padding.symmetric(horizontal=6, vertical=2),
            )

            def on_toggle(e: ft.ControlEvent, eid=ex.id, archived=is_archived_item) -> None:
                if archived:
                    exercise_svc.unarchive(eid)
                else:
                    exercise_svc.archive(eid)
                rebuild()

            action_btn = ft.TextButton(
                text="Restore" if is_archived_item else "Archive",
                on_click=on_toggle,
                style=ft.ButtonStyle(
                    color=ft.Colors.BLUE_400 if is_archived_item else ft.Colors.WHITE54,
                ),
            )

            return ft.ListTile(
                title=ft.Row(
                    controls=[ft.Text(ex.name, color=ft.Colors.WHITE if not is_archived_item else ft.Colors.WHITE38), cat_chip],
                    spacing=8,
                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                trailing=action_btn,
                content_padding=ft.padding.symmetric(horizontal=16, vertical=4),
            )

        for ex in active:
            list_col.controls.append(make_tile(ex, False))
            list_col.controls.append(ft.Divider(height=1, color=ft.Colors.WHITE12))

        if archived:
            list_col.controls.append(
                ft.Container(
                    content=ft.Text(
                        f"ARCHIVED ({len(archived)})" if show_archived[0] else f"Archived: {len(archived)} hidden",
                        size=11,
                        color=ft.Colors.WHITE38,
                        weight=ft.FontWeight.W_600,
                    ),
                    padding=ft.padding.only(left=16, top=16, bottom=8),
                )
            )
            if show_archived[0]:
                for ex in archived:
                    list_col.controls.append(make_tile(ex, True))
                    list_col.controls.append(ft.Divider(height=1, color=ft.Colors.WHITE12))

        list_col.update()

    def on_toggle_archived(e: ft.ControlEvent) -> None:
        show_archived[0] = not show_archived[0]
        toggle_btn.text = "Hide archived" if show_archived[0] else "Show archived"
        toggle_btn.update()
        rebuild()

    toggle_btn = ft.TextButton(
        text="Show archived",
        icon=ft.Icons.VISIBILITY_OUTLINED,
        on_click=on_toggle_archived,
        style=ft.ButtonStyle(color=ft.Colors.WHITE54),
    )

    rebuild()

    return ft.View(
        route="/settings/exercises",
        controls=[
            ft.AppBar(
                title=ft.Text("Exercise Catalog", weight=ft.FontWeight.BOLD),
                bgcolor=ft.Colors.SURFACE,
                leading=ft.IconButton(
                    icon=ft.Icons.ARROW_BACK,
                    on_click=lambda e: page.go("/settings"),
                    tooltip="Back to Settings",
                ),
                automatically_imply_leading=False,
                actions=[toggle_btn],
            ),
            ft.Column(
                controls=[
                    ft.Card(content=add_form, margin=ft.margin.all(0)),
                    ft.Divider(height=1, color=ft.Colors.WHITE12),
                    list_col,
                ],
                expand=True,
                spacing=0,
            ),
        ],
        bgcolor=ft.Colors.BACKGROUND,
        padding=ft.padding.all(16),
    )

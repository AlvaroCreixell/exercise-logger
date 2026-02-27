from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import flet as ft

from models.exercise import Exercise, ExerciseCategory
from models.routine import RoutineDayExercise
from models.workout import LoggedSet, WorkoutSession
from repositories.routine_repo import RoutineRepo
from services.cycle_service import CycleService
from services.workout_service import WorkoutService


@dataclass
class ExerciseState:
    """Mutable UI state for a single exercise card."""
    rde: RoutineDayExercise
    exercise: Exercise
    reps: int
    weight: float
    logged_sets: list[LoggedSet] = field(default_factory=list)
    prev_sets: list[LoggedSet] = field(default_factory=list)


def _default_reps(rde: RoutineDayExercise) -> int:
    return rde.target_reps if rde.target_reps is not None else 8


def _default_weight(rde: RoutineDayExercise) -> float:
    return rde.target_weight if rde.target_weight is not None else 0.0


def build_workout_view(
    page: ft.Page,
    session: WorkoutSession,
    workout_svc: WorkoutService,
    cycle_svc: CycleService,
    routine_repo: RoutineRepo,
) -> ft.View:
    """Build the workout logging view for the given session."""

    if session.routine_day_id is None:
        exercises_with_rde: list[tuple[RoutineDayExercise, Exercise]] = []
    else:
        exercises_with_rde = routine_repo.get_day_exercises_with_detail(
            session.routine_day_id
        )

    # Build mutable state per exercise
    states: list[ExerciseState] = []
    for rde, ex in exercises_with_rde:
        prev = workout_svc.get_previous_sets(ex.id, exclude_session_id=session.id)
        # Pre-fill from previous session if available, else use targets
        if prev:
            default_reps = prev[-1].reps or _default_reps(rde)
            default_weight = prev[-1].weight or _default_weight(rde)
        else:
            default_reps = _default_reps(rde)
            default_weight = _default_weight(rde)

        states.append(
            ExerciseState(
                rde=rde,
                exercise=ex,
                reps=default_reps,
                weight=default_weight,
                logged_sets=workout_svc.get_session_sets(session.id),
                prev_sets=prev,
            )
        )

    cards_column = ft.Column(spacing=12, scroll=ft.ScrollMode.AUTO, expand=True)

    def rebuild_cards() -> None:
        cards_column.controls.clear()
        for state in states:
            cards_column.controls.append(_build_exercise_card(state))
        cards_column.update()

    def _build_exercise_card(state: ExerciseState) -> ft.Card:
        ex = state.exercise
        rde = state.rde

        # Previous sets summary
        if state.prev_sets:
            prev_text = "Prev: " + "  ".join(
                f"{s.reps}×{s.weight:.0f}" if s.weight else f"{s.reps} reps"
                for s in state.prev_sets
                if not s.is_warmup
            )
        else:
            prev_text = "No previous data"

        # Sets logged this session for this exercise
        session_sets = [
            s for s in workout_svc.get_session_sets(session.id)
            if s.exercise_id == ex.id
        ]
        logged_chips = ft.Row(
            controls=[
                ft.Chip(
                    label=ft.Text(
                        f"Set {i+1}: {s.reps}×{s.weight:.0f}" if s.weight
                        else f"Set {i+1}: {s.reps} reps",
                        size=12,
                    ),
                    bgcolor=ft.Colors.GREEN_900,
                )
                for i, s in enumerate(session_sets)
            ],
            wrap=True,
            spacing=4,
            run_spacing=4,
        )

        # ── +/- stepper helper ────────────────────────────────────
        def make_stepper(
            label: str,
            get_val: callable,
            set_val: callable,
            step: float,
            fmt: str = "{:.0f}",
        ) -> ft.Row:
            value_text = ft.Text(fmt.format(get_val()), size=20, width=64,
                                 text_align=ft.TextAlign.CENTER,
                                 weight=ft.FontWeight.BOLD)

            def on_dec(e: ft.ControlEvent) -> None:
                new = max(0.0, get_val() - step)
                set_val(new)
                value_text.value = fmt.format(new)
                value_text.update()

            def on_inc(e: ft.ControlEvent) -> None:
                new = get_val() + step
                set_val(new)
                value_text.value = fmt.format(new)
                value_text.update()

            return ft.Row(
                controls=[
                    ft.Text(label, size=12, color=ft.Colors.WHITE54, width=56),
                    ft.IconButton(
                        icon=ft.Icons.REMOVE_CIRCLE_OUTLINE,
                        icon_color=ft.Colors.WHITE70,
                        icon_size=28,
                        on_click=on_dec,
                        tooltip=f"Decrease {label}",
                    ),
                    value_text,
                    ft.IconButton(
                        icon=ft.Icons.ADD_CIRCLE_OUTLINE,
                        icon_color=ft.Colors.WHITE70,
                        icon_size=28,
                        on_click=on_inc,
                        tooltip=f"Increase {label}",
                    ),
                ],
                alignment=ft.MainAxisAlignment.START,
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            )

        reps_stepper = make_stepper(
            "Reps",
            lambda: state.reps,
            lambda v: setattr(state, "reps", int(v)),
            step=1,
        )
        weight_stepper = make_stepper(
            "Weight",
            lambda: state.weight,
            lambda v: setattr(state, "weight", v),
            step=5.0,
            fmt="{:.1f}",
        )

        def on_log_set(e: ft.ControlEvent) -> None:
            workout_svc.log_set(
                session_id=session.id,
                exercise_id=ex.id,
                reps=state.reps,
                weight=state.weight if ex.category == ExerciseCategory.WEIGHT else None,
                routine_day_exercise_id=rde.id,
            )
            rebuild_cards()

        log_btn = ft.ElevatedButton(
            text="Log Set",
            icon=ft.Icons.CHECK_CIRCLE_OUTLINE,
            on_click=on_log_set,
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.BLUE_700,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                padding=ft.padding.symmetric(horizontal=20, vertical=14),
            ),
        )

        target_str = ""
        if rde.target_sets and rde.target_reps:
            target_str = f"{rde.target_sets}×{rde.target_reps}"
            if rde.target_weight:
                target_str += f" @ {rde.target_weight:.0f}"

        return ft.Card(
            content=ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Row(
                            controls=[
                                ft.Text(
                                    ex.name,
                                    size=17,
                                    weight=ft.FontWeight.BOLD,
                                    color=ft.Colors.WHITE,
                                    expand=True,
                                ),
                                ft.Text(
                                    target_str,
                                    size=12,
                                    color=ft.Colors.WHITE38,
                                ),
                            ],
                        ),
                        ft.Text(prev_text, size=12, color=ft.Colors.WHITE54),
                        ft.Divider(height=1, color=ft.Colors.WHITE12),
                        reps_stepper,
                        weight_stepper,
                        ft.Container(height=4),
                        log_btn,
                        logged_chips if session_sets else ft.Container(height=0),
                    ],
                    spacing=8,
                ),
                padding=ft.padding.all(16),
            ),
            elevation=2,
            margin=ft.margin.symmetric(vertical=2),
        )

    def on_finish(e: ft.ControlEvent) -> None:
        def do_finish(e2: ft.ControlEvent) -> None:
            page.close(confirm_dlg)
            workout_svc.finish_session(session.id)
            if session.routine_id:
                cycle_svc.advance(session.routine_id, session.id)
            page.go("/home")

        confirm_dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Finish Workout?"),
            content=ft.Text("This will mark the workout complete and advance to the next day."),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: page.close(confirm_dlg)),
                ft.ElevatedButton(
                    "Finish",
                    on_click=do_finish,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.GREEN_700),
                ),
            ],
        )
        page.open(confirm_dlg)

    def on_abandon(e: ft.ControlEvent) -> None:
        def do_abandon(e2: ft.ControlEvent) -> None:
            page.close(confirm_dlg)
            workout_svc.abandon_session(session.id)
            page.go("/home")

        confirm_dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Abandon Workout?"),
            content=ft.Text("Sets logged so far will be saved, but the cycle will NOT advance."),
            actions=[
                ft.TextButton("Keep going", on_click=lambda e: page.close(confirm_dlg)),
                ft.ElevatedButton(
                    "Abandon",
                    on_click=do_abandon,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.RED_700),
                ),
            ],
        )
        page.open(confirm_dlg)

    # Initial render
    for state in states:
        cards_column.controls.append(_build_exercise_card(state))

    bottom_row = ft.Row(
        controls=[
            ft.OutlinedButton(
                text="Abandon",
                icon=ft.Icons.CANCEL_OUTLINED,
                on_click=on_abandon,
                style=ft.ButtonStyle(color=ft.Colors.RED_400),
            ),
            ft.ElevatedButton(
                text="Finish Workout",
                icon=ft.Icons.DONE_ALL_ROUNDED,
                on_click=on_finish,
                style=ft.ButtonStyle(
                    bgcolor=ft.Colors.GREEN_700,
                    color=ft.Colors.WHITE,
                    shape=ft.RoundedRectangleBorder(radius=12),
                    padding=ft.padding.symmetric(horizontal=24, vertical=16),
                ),
            ),
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
    )

    return ft.View(
        route=f"/workout/{session.id}",
        controls=[
            ft.AppBar(
                title=ft.Text("Workout", weight=ft.FontWeight.BOLD),
                bgcolor=ft.Colors.SURFACE,
                automatically_imply_leading=False,
                actions=[
                    ft.IconButton(
                        icon=ft.Icons.CLOSE,
                        on_click=on_abandon,
                        tooltip="Abandon workout",
                    )
                ],
            ),
            ft.Column(
                controls=[
                    cards_column,
                    ft.Divider(height=1, color=ft.Colors.WHITE12),
                    bottom_row,
                ],
                expand=True,
            ),
        ],
        bgcolor=ft.Colors.BACKGROUND,
        padding=ft.padding.all(16),
    )

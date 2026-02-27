from __future__ import annotations

import flet as ft

from config import APP_NAME
from db.connection import get_connection
from db.schema import init_db
from db.seed import seed_sample_routine
from repositories.routine_repo import RoutineRepo
from repositories.workout_repo import WorkoutRepo
from services.cycle_service import CycleService
from services.workout_service import WorkoutService
from views.home_view import build_home_view
from views.workout_view import build_workout_view


def main(page: ft.Page) -> None:
    page.title = APP_NAME
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 0

    # ── Bootstrap DB ─────────────────────────────────────────────
    conn = get_connection()
    init_db(conn)
    seed_sample_routine(conn)  # No-op if data already exists

    # ── Services / repos ─────────────────────────────────────────
    workout_svc = WorkoutService(conn)
    cycle_svc = CycleService(conn)
    routine_repo = RoutineRepo(conn)
    workout_repo = WorkoutRepo(conn)

    # ── Navigation ───────────────────────────────────────────────
    def route_change(e: ft.RouteChangeEvent) -> None:
        page.views.clear()
        route = e.route

        if route in ("/", "/home"):
            routine = routine_repo.get_active()
            current_day = cycle_svc.get_current_day(routine.id) if routine else None
            in_progress = workout_svc.get_in_progress_session()
            view = build_home_view(
                page=page,
                routine=routine,
                current_day=current_day,
                in_progress=in_progress,
                workout_svc=workout_svc,
                cycle_svc=cycle_svc,
            )
            page.views.append(view)

        elif route.startswith("/workout/"):
            try:
                session_id = int(route.split("/")[-1])
            except ValueError:
                page.go("/home")
                return
            session = workout_repo.get_by_id(session_id)
            if session is None:
                page.go("/home")
                return
            from models.workout import SessionStatus
            if session.status != SessionStatus.IN_PROGRESS:
                page.go("/home")
                return
            view = build_workout_view(
                page=page,
                session=session,
                workout_svc=workout_svc,
                cycle_svc=cycle_svc,
                routine_repo=routine_repo,
            )
            page.views.append(view)

        elif route == "/progress":
            page.views.append(
                ft.View(
                    route="/progress",
                    controls=[
                        ft.AppBar(
                            title=ft.Text("Progress"),
                            bgcolor=ft.Colors.SURFACE,
                            automatically_imply_leading=False,
                        ),
                        ft.Container(
                            content=ft.Text(
                                "Progress charts — coming in Phase 4",
                                color=ft.Colors.WHITE54,
                            ),
                            alignment=ft.alignment.center,
                            expand=True,
                        ),
                    ],
                    bgcolor=ft.Colors.BACKGROUND,
                )
            )

        elif route == "/settings":
            page.views.append(
                ft.View(
                    route="/settings",
                    controls=[
                        ft.AppBar(
                            title=ft.Text("Settings"),
                            bgcolor=ft.Colors.SURFACE,
                            automatically_imply_leading=False,
                        ),
                        ft.Container(
                            content=ft.Text(
                                "Routine editor & settings — coming in Phase 2",
                                color=ft.Colors.WHITE54,
                            ),
                            alignment=ft.alignment.center,
                            expand=True,
                        ),
                    ],
                    bgcolor=ft.Colors.BACKGROUND,
                )
            )

        else:
            page.go("/home")
            return

        _inject_nav_bar(page)
        page.update()

    def view_pop(e: ft.ViewPopEvent) -> None:
        page.views.pop()
        top_view = page.views[-1]
        page.go(top_view.route)

    def _inject_nav_bar(p: ft.Page) -> None:
        if not p.views:
            return
        route = p.views[-1].route
        # No nav bar during an active workout
        if route and route.startswith("/workout/"):
            return

        selected = 0
        if route == "/progress":
            selected = 1
        elif route == "/settings":
            selected = 2

        def on_nav_change(e: ft.ControlEvent) -> None:
            destinations = ["/home", "/progress", "/settings"]
            p.go(destinations[e.control.selected_index])

        nav_bar = ft.NavigationBar(
            selected_index=selected,
            on_change=on_nav_change,
            bgcolor=ft.Colors.SURFACE,
            destinations=[
                ft.NavigationBarDestination(
                    icon=ft.Icons.HOME_OUTLINED,
                    selected_icon=ft.Icons.HOME,
                    label="Home",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.SHOW_CHART_OUTLINED,
                    selected_icon=ft.Icons.SHOW_CHART,
                    label="Progress",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.SETTINGS_OUTLINED,
                    selected_icon=ft.Icons.SETTINGS,
                    label="Settings",
                ),
            ],
        )
        p.views[-1].controls.append(nav_bar)

    page.on_route_change = route_change
    page.on_view_pop = view_pop
    page.go("/home")


if __name__ == "__main__":
    ft.app(target=main)

# Hardening Pass 1: Fix Broken Behavior & Surface Errors

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three highest-priority issues from the consolidated audit: dashboard false empty state, missing confirmation on Home "End" button, and silent validation swallow in the target editor.

**Architecture:** All three fixes are UI-layer changes to existing screen files. No new files. No service/repo/model changes. Task 1 adds a service-level regression test to lock in the `get_session_count()` invariant that the UI fix depends on. Tasks 2-3 are pure screen fixes using existing `AppBottomSheet` patterns.

**Testing note:** The current test suite does not import any screen files (per project convention: "test services and repos, not screens"). `pytest` alone cannot catch syntax errors in modified screens. Every verification step therefore includes `python -m compileall src` to catch import/syntax errors. In a Kivy-enabled environment, also run `python -c "from src.main import ExerciseLoggerApp"` as an import smoke test.

**Tech Stack:** Python 3.10+, Kivy + KivyMD, pytest, SQLite (in-memory for tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `tests/test_stats_service.py` | Modify | Add regression test for dashboard empty-state edge case |
| `src/screens/dashboard/dashboard_screen.py` | Modify | Fix empty-state gate to use all-time session count |
| `src/screens/home/home_screen.py` | Modify | Add confirmation bottom sheet before ending session |
| `src/screens/manage/routine_editor_screen.py` | Modify | Surface validation errors in target editor instead of swallowing |

---

### Task 1: Fix Dashboard False Empty State

**Bug:** `dashboard_screen.py:79` gates the entire dashboard on `get_sessions_this_week() == 0 and get_sessions_this_month() == 0`. A user who logged workouts last week but not this week sees "No workouts yet" — a false empty state.

**Fix:** Check all-time session count for the empty state. Show "0 sessions" in stat cards when week/month are zero but history exists.

**Files:**
- Modify: `tests/test_stats_service.py` (add regression test)
- Modify: `src/screens/dashboard/dashboard_screen.py:75-101`

- [ ] **Step 1: Write the regression test (service-level only)**

This test locks the service-level invariant: `get_session_count()` with no `since` parameter returns all-time counts even when `get_sessions_this_week()` and `get_sessions_this_month()` return 0. This does NOT test the dashboard UI decision directly — that logic lives in `dashboard_screen.py` which is not importable without Kivy. The UI fix in Step 3 depends on this invariant holding.

Add to the `TestStatsService` class in `tests/test_stats_service.py`:

```python
def test_session_count_all_time_includes_old_sessions(self, stats_service, workout_service, make_exercise, routine_service):
    """All-time count includes sessions outside current week/month.

    Regression: dashboard used week+month counts to gate empty state,
    hiding the dashboard when history existed but not in current period.
    """
    ex = make_exercise("Bench Press")
    r = routine_service.create_routine("Test")
    routine_service.activate_routine(r.id)
    day = routine_service.add_day(r.id, "A", "Push")
    routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

    session = workout_service.start_routine_session(day.id)
    se = workout_service.add_exercise_to_session(session.id, ex.id)
    workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135)
    workout_service.finish_session(session.id)

    # Backdate the session to 2 months ago so it falls outside this week/month
    from datetime import datetime, timezone, timedelta
    old_date = (datetime.now(timezone.utc) - timedelta(days=70)).isoformat()
    workout_service._repo._execute(
        "UPDATE workout_sessions SET started_at = ?, finished_at = ? WHERE id = ?",
        (old_date, old_date, session.id),
    )
    workout_service._repo.commit()

    # This week and this month should be 0
    assert stats_service.get_sessions_this_week() == 0
    assert stats_service.get_sessions_this_month() == 0

    # But all-time count should still be 1
    assert stats_service.get_session_count() == 1
```

- [ ] **Step 2: Run the test to verify it passes**

This test should pass immediately — it validates existing service behavior, not new code. We're locking in the invariant.

Run: `pytest tests/test_stats_service.py::TestStatsService::test_session_count_all_time_includes_old_sessions -v`
Expected: PASS

- [ ] **Step 3: Fix the dashboard empty-state logic**

In `src/screens/dashboard/dashboard_screen.py`, replace lines 75-101. The key change: use `get_session_count()` (all-time, no `since` parameter) for the empty-state gate, and always show stat cards when history exists.

Replace this block (lines 75-101):

```python
        # Check if there are any sessions
        week_count = self.app.stats_service.get_sessions_this_week()
        month_count = self.app.stats_service.get_sessions_this_month()

        if week_count == 0 and month_count == 0:
            # --- Empty state ---
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=[0, dp(48), 0, 0])
            empty.add_widget(MDLabel(
                text="No workouts yet",
                halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Headline", role="small",
                adaptive_height=True,
            ))
            start_btn = MDButton(
                style="outlined",
                size_hint_x=None, width=dp(200),
                pos_hint={"center_x": 0.5},
            )
            start_btn.add_widget(MDButtonText(text="Start Workout"))
            start_btn.bind(on_release=lambda *a: self.app.go_tab("workout"))
            empty.add_widget(start_btn)
            content.add_widget(empty)
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self._overview.add_widget(layout)
            return

        # --- Stat cards row ---
        stat_row = MDBoxLayout(
```

With:

```python
        # Check if there are any sessions — all-time for empty state, period for cards
        total_sessions = self.app.stats_service.get_session_count()
        week_count = self.app.stats_service.get_sessions_this_week()
        month_count = self.app.stats_service.get_sessions_this_month()

        if total_sessions == 0:
            # --- True empty state: user has never completed a workout ---
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=[0, dp(48), 0, 0])
            empty.add_widget(MDLabel(
                text="No workouts yet",
                halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Headline", role="small",
                adaptive_height=True,
            ))
            start_btn = MDButton(
                style="outlined",
                size_hint_x=None, width=dp(200),
                pos_hint={"center_x": 0.5},
            )
            start_btn.add_widget(MDButtonText(text="Start Workout"))
            start_btn.bind(on_release=lambda *a: self.app.go_tab("workout"))
            empty.add_widget(start_btn)
            content.add_widget(empty)
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self._overview.add_widget(layout)
            return

        # --- Stat cards row (shown even if this week/month are 0) ---
        stat_row = MDBoxLayout(
```

- [ ] **Step 4: Verify — tests + compile check**

```bash
pytest tests/ -v --tb=short && python -m compileall src/screens/dashboard/dashboard_screen.py -q
```
Expected: All 169 tests pass (168 existing + 1 new). Compile check exits 0.

- [ ] **Step 5: Commit**

```bash
git add tests/test_stats_service.py src/screens/dashboard/dashboard_screen.py
git commit -m "fix: dashboard empty state uses all-time count, not week/month"
```

---

### Task 2: Add Confirmation Sheet to Home "End" Button

**Bug:** `home_screen.py:101-106` has a TODO comment admitting this: tapping "End" on the in-progress session banner immediately calls `end_early()` with no confirmation. Every other destructive action in the app uses a bottom sheet confirmation. This is inconsistent and dangerous — one accidental tap ends a workout.

**Fix:** Add a confirmation `AppBottomSheet` before ending the session.

**Design decision — destructive button style:** The spec (L872) says destructive actions in bottom sheets use text or outlined style, never filled red. Most screens follow this (routine delete, benchmark delete, exercise archive). The workout screen's "End Early" (`workout_screen.py:456`) is an outlier using `style="filled", destructive=True`. This fix follows the spec standard: **text-style destructive** (red text, no fill). This is consistent with how "Delete" actions work everywhere else in the app.

**Files:**
- Modify: `src/screens/home/home_screen.py:1-2,101-106`

- [ ] **Step 1: Add the bottom_sheet import**

In `src/screens/home/home_screen.py`, add the import at the top of the file. After line 2 (`from kivy.lang import Builder`), the existing imports continue. We need to add the bottom sheet and theme imports.

Add after line 8 (`from src.theme import SECONDARY`):

```python
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import TEXT_SECONDARY as _TEXT_SECONDARY
```

Note: `SECONDARY` is already imported for benchmark alerts. We need `TEXT_SECONDARY` for the sheet body text. Import it as `_TEXT_SECONDARY` to avoid shadowing the existing `SECONDARY` import.

- [ ] **Step 2: Replace `end_session` with confirmation flow**

Replace lines 101-106 in `src/screens/home/home_screen.py`:

```python
    def end_session(self):
        # TODO: Phase 3B — replace with confirmation bottom sheet per spec L876.
        # Direct end_early() is an intentional temporary deviation for 3A scaffolding.
        if self._in_progress_session_id:
            self.app.workout_service.end_early(self._in_progress_session_id)
            self._refresh()
```

With:

```python
    def end_session(self):
        """End in-progress session with confirmation bottom sheet."""
        if not self._in_progress_session_id:
            return

        sheet = AppBottomSheet(title="End workout early?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text="Your session will be saved. Cycle advances only if you logged at least one set.",
            theme_text_color="Custom",
            text_color=_TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*a):
            sheet.dismiss()

        def on_confirm(*a):
            sheet.dismiss()
            self.app.workout_service.end_early(self._in_progress_session_id)
            self._refresh()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("End Early", on_confirm, destructive=True)
        sheet.open()
```

- [ ] **Step 3: Verify — tests + compile check**

```bash
pytest tests/ -v --tb=short && python -m compileall src/screens/home/home_screen.py -q
```
Expected: All tests pass (no backend changes, pure UI fix). Compile check exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/screens/home/home_screen.py
git commit -m "fix: home End button uses confirmation sheet instead of immediate end"
```

---

### Task 3: Surface Validation Errors in Target Editor

**Bug:** `routine_editor_screen.py:1034` has `except ValueError: pass` — when the user saves targets that fail validation (e.g., cardio without duration or distance), the error is silently swallowed. The sheet dismisses, nothing changes, no feedback. The user has no idea why their save didn't work.

**Fix:** Add an error label widget to the target editor sheet (same pattern used in create-routine and benchmark-setup sheets), and display the validation error message instead of swallowing it. Keep the sheet open so the user can fix the issue.

**Files:**
- Modify: `src/screens/manage/routine_editor_screen.py:756,992-1038`

- [ ] **Step 1: Add error label to the target sheet**

In `src/screens/manage/routine_editor_screen.py`, inside the `_open_target_editor` method, add an error label after the content_box and before the action buttons. Find line 784 (`sheet.add_content(content_box)`) and add the error label after it.

After line 784 (`sheet.add_content(content_box)`), add:

```python
        # Error display
        error_label = MDLabel(
            text="",
            theme_text_color="Custom",
            text_color=DESTRUCTIVE,
            font_style="Body",
            role="small",
            adaptive_height=True,
        )
        sheet.add_content(error_label)
```

This uses `DESTRUCTIVE` from the theme module for color consistency. Check existing imports at the top of the file — `MDLabel` is already imported at line 11, and `DESTRUCTIVE` is already imported:
```python
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY
```
Update this import line to include `DESTRUCTIVE`:
```python
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY, DESTRUCTIVE
```

- [ ] **Step 2: Clear stale error text on save attempts and scheme toggles**

The error label must be cleared in two places to avoid stale messages lingering:

**2a.** In the `on_save` closure (line 993), add `error_label.text = ""` as the first line of the function body, before the `set_kind = ...` line. This clears any previous error when the user retries.

**2b.** In the `_rebuild_content` closure (line 822), add `error_label.text = ""` as the first line of the function body, before `content_box.clear_widgets()`. This clears the error when the user toggles between Uniform/Progressive, since the inputs change and the old error no longer applies.

- [ ] **Step 3: Replace the silent error swallow with error display**

Replace lines 1034-1035 in `src/screens/manage/routine_editor_screen.py`:

```python
            except ValueError:
                pass  # Validation failure silently ignores for now
```

With:

```python
            except ValueError as e:
                error_label.text = str(e)
                return
```

The `return` is critical — it prevents `sheet.dismiss()` on line 1037 from executing, keeping the sheet open so the user sees the error and can fix their input.

- [ ] **Step 4: Verify — tests + compile check**

```bash
pytest tests/ -v --tb=short && python -m compileall src/screens/manage/routine_editor_screen.py -q
```
Expected: All tests pass (no backend changes, pure UI fix). Compile check exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/screens/manage/routine_editor_screen.py
git commit -m "fix: target editor surfaces validation errors instead of silently swallowing"
```

---

## Verification Checkpoint

After all three tasks:

```bash
pytest tests/ -v --tb=short && python -m compileall src -q
```

Expected: 169 tests pass (168 existing + 1 new regression test from Task 1). All `.py` files under `src/` compile cleanly.

In a Kivy-enabled environment, also run:
```bash
python -c "from src.main import ExerciseLoggerApp"
```
Expected: Imports without error (does not launch the app).

### Manual Smoke Test Checklist

Since these are UI changes that can't be automated without Kivy installed, verify these manually when the app is running:

- [ ] **Dashboard empty state:** Create a routine, log a workout, finish it. Wait for next week (or backdate in DB). Open Dashboard tab — should show stat cards with "0" for this week, NOT "No workouts yet."
- [ ] **Dashboard true empty:** Fresh DB with no sessions. Dashboard should show "No workouts yet" + "Start Workout" button.
- [ ] **Home End button:** Start a workout, go to Home tab. Banner shows "Unfinished workout" with Resume/End. Tap "End" — a bottom sheet appears with "End workout early?" title, "Cancel" and "End Early" buttons. Cancel dismisses sheet. "End Early" ends the session.
- [ ] **Target editor validation:** Create a routine with a cardio exercise. Edit targets. Set duration to 0 and distance to 0. Tap Save. Red error text should appear in the sheet. Sheet stays open. Tap Save again — error text should refresh (not duplicate). Fix the values, tap Save — should succeed.
- [ ] **Target editor error clears on toggle:** Trigger a validation error, then toggle from Uniform to Progressive (or vice versa). Error text should clear.

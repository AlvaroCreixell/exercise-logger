# Phase 3B: Workout Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the routine workout screen — start a session for the current cycle day, log sets via exercise cards with steppers, finish/end early. This is the app's core UX loop.

**Scope:** This plan covers **routine sessions only**. The spec's Workout Tab also includes a day picker for manual override and benchmark session UI (spec L385, L395). Those are deferred to Phase 3C along with the benchmark screen, because they add significant scope (day selection UI, benchmark exercise picker, different logging flow) and the routine session is the 90% use case. Phase 3C will add: overrideable day picker, benchmark session start/logging, and ad-hoc exercise picker dialog.

**Architecture:** The workout tab replaces Phase 3A's placeholder. It has two states: pre-session (current day info + start button) and active session (exercise cards + bottom bar). Exercise cards use accordion pattern — one expanded at a time. Components are split into focused files: `set_chip.py` (logged/target chip widget), `stepper.py` (reps/weight +/- controls), `exercise_card.py` (accordion card combining chips + steppers), `bottom_sheet.py` (reusable bottom sheet per spec). Session bootstrap (create session + populate exercises) is handled by WorkoutService in a single method — the screen just calls it and renders.

**Tech Stack:** Kivy 2.3+, KivyMD 2.0+, existing Phase 1+2 services.

**Spec reference:** `docs/superpowers/specs/2026-03-23-exercise-logger-greenfield-design.md` — Workout Tab (L384-395), Workout Screen Notes (L770-798), Set Chips (L837-850), Confirmation Dialogs (L874-879), Transitions (L881-893).

**Phase 3A code reference:** `src/main.py` (service wiring, `go_tab()`), `src/screens/base_screen.py` (`app` property), `src/theme.py` (colors).

---

## Task Decomposition

```
Task 0: Reusable BottomSheet component  → spec requires bottom sheets exclusively (L860-879)
Task 1: Set Chip component              → standalone widget, no screen deps
Task 2: Stepper component               → standalone widget, no screen deps
Task 3: Exercise Card component         → uses chips + steppers
Task 4: Service additions               → WorkoutService.start_routine_session_with_exercises(), RoutineService.get_day_exercise()
Task 5: Workout Screen                  → pre-session + active session, uses cards + services
Task 6: Edit/Delete + Confirmation sheets → chip tap opens edit sheet, end early/finish use confirmation sheet
Task 7: Wire into main.py              → replace placeholder, integration test
```

---

## File Structure

```
src/screens/
├── components/
│   ├── __init__.py                  # NEW
│   ├── bottom_sheet.py              # NEW — Reusable bottom sheet (spec L860-879)
│   ├── set_chip.py                  # NEW — SetChip widget (logged/target states)
│   ├── set_chip.kv                  # NEW
│   ├── stepper.py                   # NEW — ValueStepper widget (+/- with value)
│   ├── stepper.kv                   # NEW
│   ├── exercise_card.py             # NEW — ExerciseCard (accordion, chips, steppers, log/repeat)
│   └── exercise_card.kv             # NEW
├── workout/
│   ├── __init__.py                  # NEW
│   ├── workout_screen.py            # NEW — WorkoutScreen (pre-session + active states)
│   └── workout_screen.kv            # NEW
src/services/
├── workout_service.py               # MODIFY — add start_routine_session_with_exercises()
└── routine_service.py               # MODIFY — add get_day_exercise()
src/main.py                          # MODIFY — replace PlaceholderScreen("workout") with real WorkoutScreen
```

---

## Design Reference

### Set Chips
| State | Style | Text format |
|-------|-------|-------------|
| Logged (reps_weight) | Filled green `#4ADE80`, dark text | `135×10` |
| Logged (duration) | Filled green | `60s` |
| Logged (cardio) | Filled green | `20m / 2.0km` |
| Logged (AMRAP) | Filled green | `135×AMRAP 12` |
| Target (upcoming) | Outlined gray `#9CA3AF` | `135×10` |
| Target (AMRAP) | Outlined gray | `135×AMRAP` |

Chip height: 32dp, horizontal padding: 12dp. Tap logged chip → edit/delete sheet.

### Stepper
- Large `-` / value / `+` layout
- Value is Headline Medium (biggest text in the area)
- Tapping value opens keyboard for direct entry
- +/- buttons: 56dp diameter (sweaty fingers)
- Reps step: ±1. Weight step: ±5.

### Exercise Card (Accordion)
- **Collapsed:** exercise name (left) + chip row (right) + progress "3/4"
- **Expanded:** name + progress → chip row → stepper row → action row (Repeat Last + LOG SET)
- Only one expanded at a time. Tapping collapsed card expands it, collapses current.

### Bottom Bar (Active Session)
- "+ Add Exercise" (left, outlined)
- "End Early" (right, text-only, muted)
- "Finish Workout" (right, filled green)

---

## Task 0: Reusable Bottom Sheet Component

**Files:**
- Create: `src/screens/components/bottom_sheet.py`

The spec requires bottom sheets exclusively (L860-879). This creates a reusable helper that all callsites use: chip edit/delete, confirmation dialogs, stepper direct entry. It overlays from the bottom of the screen using Kivy's ModalView with custom positioning.

- [ ] **Step 1: Create `src/screens/components/bottom_sheet.py`**

```python
"""Reusable bottom sheet component per spec L860-879.

The spec says: use bottom sheets exclusively, no centered dialogs.
- 12dp rounded top corners
- Slight backdrop dim (40% black overlay)
- Drag handle: small centered pill
- Full-width action buttons pinned to bottom

Usage:
    sheet = AppBottomSheet(title="Edit Set")
    sheet.add_content(my_widget)
    sheet.add_action("Cancel", on_cancel)
    sheet.add_action("Save", on_save, style="filled")
    sheet.open()
"""
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.properties import StringProperty
from kivy.uix.modalview import ModalView
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText
from kivymd.uix.label import MDLabel

from src.theme import SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND, PRIMARY, DESTRUCTIVE


class AppBottomSheet(ModalView):
    """A bottom-aligned sheet that slides up from the bottom.

    Uses ModalView for the backdrop dim + dismiss-on-tap-outside behavior,
    positioned at the bottom of the screen.
    """

    title = StringProperty("")

    def __init__(self, title="", **kwargs):
        super().__init__(**kwargs)
        self.title = title
        self.size_hint = (1, None)
        self.height = dp(320)
        self.pos_hint = {"bottom": 1}
        self.background_color = (0, 0, 0, 0)  # Transparent — we draw our own bg
        self.overlay_color = (0, 0, 0, 0.4)  # 40% black backdrop per spec

        # Main container
        self._container = MDBoxLayout(
            orientation="vertical",
            md_bg_color=SURFACE,
            radius=[dp(12), dp(12), 0, 0],
            padding=[dp(16), dp(8), dp(16), dp(16)],
            spacing=dp(12),
        )

        # Drag handle
        handle_row = MDBoxLayout(size_hint_y=None, height=dp(20))
        handle_row.add_widget(Widget())
        handle = Widget(size_hint=(None, None), size=(dp(32), dp(4)))
        handle.canvas.before.add(
            self._make_handle_bg(handle)
        )
        handle_row.add_widget(handle)
        handle_row.add_widget(Widget())
        self._container.add_widget(handle_row)

        # Title
        if title:
            self._container.add_widget(MDLabel(
                text=title,
                theme_text_color="Custom",
                text_color=TEXT_PRIMARY,
                font_style="Title",
                role="large",
                bold=True,
                adaptive_height=True,
            ))

        # Content area (caller adds widgets here)
        self._content_area = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(8),
        )
        self._container.add_widget(self._content_area)

        # Spacer
        self._container.add_widget(Widget(size_hint_y=1))

        # Action button row
        self._action_row = MDBoxLayout(
            size_hint_y=None,
            height=dp(48),
            spacing=dp(8),
        )
        self._container.add_widget(self._action_row)

        super().add_widget(self._container)

    @staticmethod
    def _make_handle_bg(widget):
        """Create a rounded rectangle for the drag handle."""
        from kivy.graphics import Color, RoundedRectangle

        def update_rect(instance, value):
            rect.pos = instance.pos
            rect.size = instance.size

        color = Color(*TEXT_SECONDARY)
        rect = RoundedRectangle(pos=widget.pos, size=widget.size, radius=[dp(2)])
        widget.bind(pos=update_rect, size=update_rect)
        return color

    def add_content(self, widget):
        """Add a widget to the content area."""
        self._content_area.add_widget(widget)

    def add_action(self, text, callback, style="text", color=None, destructive=False):
        """Add an action button to the bottom row.

        Args:
            text: Button label
            callback: on_release callback (receives button instance)
            style: "text", "outlined", or "filled"
            color: Override text/bg color (RGBA tuple)
            destructive: If True, uses DESTRUCTIVE color
        """
        btn_text = MDButtonText(text=text)

        if destructive:
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = DESTRUCTIVE if style == "text" else [1, 1, 1, 1]

        if color and style == "text":
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = color

        btn_kwargs = {"style": style, "on_release": callback}

        if style == "filled":
            btn_kwargs["theme_bg_color"] = "Custom"
            if destructive:
                btn_kwargs["md_bg_color"] = DESTRUCTIVE
            elif color:
                btn_kwargs["md_bg_color"] = color
            else:
                btn_kwargs["md_bg_color"] = PRIMARY
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = BACKGROUND

        btn = MDButton(btn_text, **btn_kwargs)
        self._action_row.add_widget(btn)

    def add_spacer(self):
        """Add a flexible spacer to the action row (pushes buttons apart)."""
        self._action_row.add_widget(Widget())

    def set_height(self, height_dp):
        """Override the sheet height."""
        self.height = dp(height_dp)
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/components/__init__.py src/screens/components/bottom_sheet.py
git commit -m "feat: reusable AppBottomSheet component per spec bottom-sheet requirement"
```

---

## Task 1: Set Chip Component

**Files:**
- Create: `src/screens/components/__init__.py`, `src/screens/components/set_chip.py`, `src/screens/components/set_chip.kv`

A self-contained chip widget that displays a logged set or an upcoming target. It formats text based on set_kind and emits an `on_chip_tap` event for logged chips.

- [ ] **Step 1: Create `src/screens/components/__init__.py`** (empty)

- [ ] **Step 2: Create `src/screens/components/set_chip.kv`**

```yaml
#:import PRIMARY src.theme.PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import BACKGROUND src.theme.BACKGROUND
#:import dp kivy.metrics.dp

<SetChip>:
    size_hint: None, None
    height: dp(32)
    width: self.minimum_width
    padding: [dp(12), dp(4), dp(12), dp(4)]
    radius: [dp(16)]
    md_bg_color: PRIMARY if root.is_logged else [0, 0, 0, 0]
    line_color: TEXT_SECONDARY if not root.is_logged else [0, 0, 0, 0]
    line_width: 1

    MDLabel:
        text: root.chip_text
        theme_text_color: "Custom"
        text_color: BACKGROUND if root.is_logged else TEXT_SECONDARY
        font_style: "Label"
        role: "medium"
        adaptive_width: True
        halign: "center"
```

- [ ] **Step 3: Create `src/screens/components/set_chip.py`**

```python
"""Set Chip — displays a logged set or upcoming target.

Usage:
    chip = SetChip(is_logged=True, set_kind="reps_weight", reps=10, weight=135.0)
    chip.bind(on_chip_tap=my_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import BooleanProperty, NumericProperty, StringProperty, ObjectProperty
from kivy.uix.behaviors import ButtonBehavior
from kivymd.uix.boxlayout import MDBoxLayout

Builder.load_file(os.path.join(os.path.dirname(__file__), "set_chip.kv"))


class SetChip(ButtonBehavior, MDBoxLayout):
    """A chip representing a logged set or a planned target."""

    is_logged = BooleanProperty(False)
    set_kind = StringProperty("reps_weight")
    reps = NumericProperty(0)
    weight = NumericProperty(0)
    duration_seconds = NumericProperty(0)
    distance = NumericProperty(0)
    chip_text = StringProperty("")
    set_id = NumericProperty(0)  # DB id, for edit/delete

    # Event dispatched when a logged chip is tapped
    __events__ = ("on_chip_tap",)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_text()

    def on_is_logged(self, *args):
        self._update_text()

    def on_set_kind(self, *args):
        self._update_text()

    def on_reps(self, *args):
        self._update_text()

    def on_weight(self, *args):
        self._update_text()

    def on_duration_seconds(self, *args):
        self._update_text()

    def on_distance(self, *args):
        self._update_text()

    def _update_text(self):
        sk = self.set_kind
        if sk == "reps_weight":
            w = int(self.weight) if self.weight == int(self.weight) else self.weight
            self.chip_text = f"{w}×{int(self.reps)}"
        elif sk == "reps_only":
            self.chip_text = f"{int(self.reps)}"
        elif sk == "duration":
            self.chip_text = f"{int(self.duration_seconds)}s"
        elif sk == "cardio":
            parts = []
            if self.duration_seconds:
                mins = int(self.duration_seconds) // 60
                parts.append(f"{mins}m")
            if self.distance:
                parts.append(f"{self.distance}km")
            self.chip_text = " / ".join(parts) if parts else "—"
        elif sk == "amrap":
            if self.is_logged and self.reps:
                w = int(self.weight) if self.weight and self.weight == int(self.weight) else self.weight
                prefix = f"{w}×" if w else ""
                self.chip_text = f"{prefix}AMRAP {int(self.reps)}"
            else:
                w = int(self.weight) if self.weight and self.weight == int(self.weight) else self.weight
                prefix = f"{w}×" if w else ""
                self.chip_text = f"{prefix}AMRAP"
        else:
            self.chip_text = "—"

    def on_release(self):
        if self.is_logged:
            self.dispatch("on_chip_tap", self)

    def on_chip_tap(self, chip):
        """Default handler — override or bind externally."""
        pass
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/components/
git commit -m "feat: SetChip component for logged/target set display"
```

---

## Task 2: Stepper Component

**Files:**
- Create: `src/screens/components/stepper.py`, `src/screens/components/stepper.kv`

A +/- value stepper with large touch targets. Tapping the value opens a text input for direct entry.

- [ ] **Step 1: Create `src/screens/components/stepper.kv`**

```yaml
#:import SURFACE src.theme.SURFACE
#:import PRIMARY src.theme.PRIMARY
#:import TEXT_PRIMARY src.theme.TEXT_PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import dp kivy.metrics.dp

<ValueStepper>:
    size_hint_y: None
    height: dp(56)
    spacing: dp(8)
    padding: [dp(4), 0, dp(4), 0]

    MDIconButton:
        icon: "minus"
        theme_icon_color: "Custom"
        icon_color: TEXT_PRIMARY
        style: "outlined"
        size_hint: None, None
        size: [dp(48), dp(48)]
        on_release: root.decrement()
        pos_hint: {"center_y": 0.5}

    MDButton:
        style: "text"
        size_hint_x: 1
        on_release: root.open_input()
        pos_hint: {"center_y": 0.5}

        MDButtonText:
            text: root.display_text
            theme_text_color: "Custom"
            text_color: TEXT_PRIMARY
            font_style: "Headline"
            role: "medium"
            bold: True
            halign: "center"

    MDIconButton:
        icon: "plus"
        theme_icon_color: "Custom"
        icon_color: TEXT_PRIMARY
        style: "outlined"
        size_hint: None, None
        size: [dp(48), dp(48)]
        on_release: root.increment()
        pos_hint: {"center_y": 0.5}

    MDLabel:
        text: root.label
        theme_text_color: "Custom"
        text_color: TEXT_SECONDARY
        font_style: "Body"
        role: "small"
        size_hint_x: None
        width: dp(40)
        halign: "center"
        pos_hint: {"center_y": 0.5}
```

- [ ] **Step 2: Create `src/screens/components/stepper.py`**

```python
"""Value Stepper — +/- control with large touch targets for gym use.

Usage:
    stepper = ValueStepper(value=135.0, step=5.0, min_val=0, label="lbs")
    stepper.bind(on_value_change=my_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import BooleanProperty, NumericProperty, StringProperty
from kivymd.uix.boxlayout import MDBoxLayout

Builder.load_file(os.path.join(os.path.dirname(__file__), "stepper.kv"))


class ValueStepper(MDBoxLayout):
    """A +/- stepper with a large tappable value display."""

    value = NumericProperty(0)
    step = NumericProperty(1)
    min_val = NumericProperty(0)
    max_val = NumericProperty(9999)
    label = StringProperty("")
    display_text = StringProperty("0")
    is_integer = BooleanProperty(True)

    __events__ = ("on_value_change",)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_display()

    def on_value(self, *args):
        self._update_display()

    def _update_display(self):
        if self.is_integer or self.value == int(self.value):
            self.display_text = str(int(self.value))
        else:
            self.display_text = f"{self.value:.1f}"

    def increment(self):
        new_val = min(self.value + self.step, self.max_val)
        if new_val != self.value:
            self.value = new_val
            self.dispatch("on_value_change", self.value)

    def decrement(self):
        new_val = max(self.value - self.step, self.min_val)
        if new_val != self.value:
            self.value = new_val
            self.dispatch("on_value_change", self.value)

    def open_input(self):
        """Open a bottom sheet with text input for direct value entry."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

        sheet = AppBottomSheet(title=f"Enter {self.label or 'value'}")
        sheet.set_height(220)

        text_field = MDTextField(
            text=self.display_text,
            input_filter="float",
        )
        text_field.add_widget(MDTextFieldHintText(text=self.label or "Value"))
        sheet.add_content(text_field)

        def on_confirm(*args):
            try:
                val = float(text_field.text)
                val = max(self.min_val, min(val, self.max_val))
                self.value = val
                self.dispatch("on_value_change", self.value)
            except ValueError:
                pass
            sheet.dismiss()

        def on_cancel(*args):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("OK", on_confirm, style="filled")
        sheet.open()

    def on_value_change(self, value):
        """Default handler."""
        pass
```

Note: The `BooleanProperty` import in `__init__` is a workaround — the proper fix is to import it at module level. The implementer should import `BooleanProperty` from `kivy.properties` at the top of the file alongside the other property imports.

- [ ] **Step 3: Commit**

```bash
git add src/screens/components/stepper.py src/screens/components/stepper.kv
git commit -m "feat: ValueStepper component with +/- buttons, direct entry dialog"
```

---

## Task 3: Exercise Card Component

**Files:**
- Create: `src/screens/components/exercise_card.py`, `src/screens/components/exercise_card.kv`

The accordion exercise card. Collapsed: name + chips + progress. Expanded: name + chips + steppers + action buttons. Only one expanded at a time (managed by the parent workout screen).

- [ ] **Step 1: Create `src/screens/components/exercise_card.kv`**

```yaml
#:import BACKGROUND src.theme.BACKGROUND
#:import SURFACE src.theme.SURFACE
#:import PRIMARY src.theme.PRIMARY
#:import TEXT_PRIMARY src.theme.TEXT_PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import dp kivy.metrics.dp

<ExerciseCard>:
    orientation: "vertical"
    size_hint_y: None
    height: self.minimum_height
    md_bg_color: SURFACE if root.is_expanded else BACKGROUND
    padding: [dp(16), dp(12), dp(16), dp(12)]
    radius: [dp(8)] if root.is_expanded else [0]

    # Header row — tappable for accordion expand/collapse
    CardHeader:
        size_hint_y: None
        height: dp(40)
        spacing: dp(8)
        on_release: root.dispatch("on_toggle")

        MDLabel:
            text: root.exercise_name
            theme_text_color: "Custom"
            text_color: TEXT_PRIMARY
            font_style: "Title"
            role: "small"
            bold: True
            size_hint_x: 0.5
            shorten: True
            shorten_from: "right"

        MDLabel:
            text: root.progress_text
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            font_style: "Body"
            role: "small"
            halign: "right"
            size_hint_x: None
            width: dp(40)

    # Chip row — always visible
    MDBoxLayout:
        id: chip_row
        size_hint_y: None
        height: dp(36)
        spacing: dp(6)
        padding: [0, dp(4), 0, 0]

    # Expanded content — only visible when is_expanded
    MDBoxLayout:
        id: expanded_content
        orientation: "vertical"
        size_hint_y: None
        height: self.minimum_height if root.is_expanded else 0
        opacity: 1 if root.is_expanded else 0
        spacing: dp(8)
        padding: [0, dp(8), 0, 0]

        # Stepper row(s) — populated from Python based on exercise type
        MDBoxLayout:
            id: stepper_container
            orientation: "vertical"
            adaptive_height: True
            spacing: dp(4)

        # Action buttons
        MDBoxLayout:
            size_hint_y: None
            height: dp(48)
            spacing: dp(8)

            MDButton:
                style: "filled"
                theme_bg_color: "Custom"
                md_bg_color: PRIMARY
                size_hint_x: 0.6
                on_release: root.repeat_last()

                MDButtonText:
                    text: "Repeat Last"
                    theme_text_color: "Custom"
                    text_color: [0.071, 0.071, 0.071, 1]
                    bold: True

            MDButton:
                style: "outlined"
                size_hint_x: 0.4
                on_release: root.log_current()

                MDButtonText:
                    text: "LOG SET"
                    theme_text_color: "Custom"
                    text_color: TEXT_PRIMARY
```

- [ ] **Step 2: Create `src/screens/components/exercise_card.py`**

```python
"""Exercise Card — accordion card for workout logging.

Displays exercise name, chips (logged/target), steppers, and log/repeat buttons.
Only one card is expanded at a time (managed by parent).

Usage:
    card = ExerciseCard(
        session_exercise_id=42,
        exercise_name="Bench Press",
        exercise_type="reps_weight",
        set_scheme="uniform",
    )
    card.bind(on_set_logged=my_callback)
    card.bind(on_chip_tapped=my_chip_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import (
    BooleanProperty, NumericProperty, StringProperty, ListProperty,
)
from kivy.uix.behaviors import ButtonBehavior
from kivymd.uix.boxlayout import MDBoxLayout

from src.screens.components.set_chip import SetChip
from src.screens.components.stepper import ValueStepper
from src.theme import PRIMARY, TEXT_SECONDARY

Builder.load_file(os.path.join(os.path.dirname(__file__), "exercise_card.kv"))


class CardHeader(ButtonBehavior, MDBoxLayout):
    """Tappable header row for the exercise card. Provides on_release."""
    pass


class ExerciseCard(MDBoxLayout):
    """An exercise card in the workout screen."""

    session_exercise_id = NumericProperty(0)
    exercise_id = NumericProperty(0)
    exercise_name = StringProperty("")
    exercise_type = StringProperty("reps_weight")  # ExerciseType.value
    set_scheme = StringProperty("uniform")
    is_expanded = BooleanProperty(False)
    progress_text = StringProperty("0/0")

    # Current stepper values
    current_reps = NumericProperty(10)
    current_weight = NumericProperty(0)
    current_duration = NumericProperty(60)
    current_distance = NumericProperty(0)

    # Target info (for pre-filling steppers)
    targets = ListProperty([])  # List of SetTarget-like dicts
    logged_sets = ListProperty([])  # List of LoggedSet-like dicts

    __events__ = ("on_set_logged", "on_chip_tapped", "on_toggle")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._reps_stepper = None
        self._weight_stepper = None
        self._duration_stepper = None
        self._distance_stepper = None

    def on_is_expanded(self, *args):
        if self.is_expanded:
            self._setup_steppers()
            self._prefill_steppers()

    def refresh_chips(self):
        """Rebuild chip row from current logged_sets and targets."""
        chip_row = self.ids.chip_row
        chip_row.clear_widgets()

        # Logged sets as green chips
        for ls in self.logged_sets:
            chip = SetChip(
                is_logged=True,
                set_kind=ls.get("set_kind", "reps_weight"),
                reps=ls.get("reps") or 0,
                weight=ls.get("weight") or 0,
                duration_seconds=ls.get("duration_seconds") or 0,
                distance=ls.get("distance") or 0,
                set_id=ls.get("id", 0),
            )
            chip.bind(on_chip_tap=lambda inst, c: self.dispatch("on_chip_tapped", c))
            chip_row.add_widget(chip)

        # Remaining targets as gray chips
        logged_count = len(self.logged_sets)
        for i, target in enumerate(self.targets):
            if i < logged_count:
                continue  # Already covered by a logged set
            chip = SetChip(
                is_logged=False,
                set_kind=target.get("set_kind", "reps_weight"),
                reps=target.get("target_reps_min") or target.get("target_reps_max") or 0,
                weight=target.get("target_weight") or 0,
                duration_seconds=target.get("target_duration_seconds") or 0,
                distance=target.get("target_distance") or 0,
            )
            chip_row.add_widget(chip)

        # Update progress
        total = max(len(self.targets), logged_count)
        self.progress_text = f"{logged_count}/{total}" if total else ""

    def _setup_steppers(self):
        """Create steppers based on exercise type."""
        container = self.ids.stepper_container
        container.clear_widgets()

        et = self.exercise_type
        if et in ("reps_weight", "reps_only"):
            self._reps_stepper = ValueStepper(
                value=self.current_reps, step=1, min_val=1,
                label="reps", is_integer=True,
            )
            container.add_widget(self._reps_stepper)

        if et == "reps_weight":
            self._weight_stepper = ValueStepper(
                value=self.current_weight, step=5, min_val=0,
                label="lbs", is_integer=False,
            )
            container.add_widget(self._weight_stepper)

        if et in ("time", "duration"):
            self._duration_stepper = ValueStepper(
                value=self.current_duration, step=5, min_val=1,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)

        if et == "cardio":
            self._duration_stepper = ValueStepper(
                value=self.current_duration, step=30, min_val=0,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)
            self._distance_stepper = ValueStepper(
                value=self.current_distance, step=0.1, min_val=0,
                label="km", is_integer=False,
            )
            container.add_widget(self._distance_stepper)

    def _prefill_steppers(self):
        """Pre-fill steppers from next target or last logged set."""
        logged_count = len(self.logged_sets)

        # Try next target first
        if logged_count < len(self.targets):
            target = self.targets[logged_count]
            if self._reps_stepper and target.get("target_reps_min"):
                self._reps_stepper.value = target["target_reps_min"]
            if self._weight_stepper and target.get("target_weight") is not None:
                self._weight_stepper.value = target["target_weight"]
            if self._duration_stepper and target.get("target_duration_seconds"):
                self._duration_stepper.value = target["target_duration_seconds"]
            if self._distance_stepper and target.get("target_distance"):
                self._distance_stepper.value = target["target_distance"]
            return

        # Fall back to last logged set
        if self.logged_sets:
            last = self.logged_sets[-1]
            if self._reps_stepper and last.get("reps"):
                self._reps_stepper.value = last["reps"]
            if self._weight_stepper and last.get("weight") is not None:
                self._weight_stepper.value = last["weight"]
            if self._duration_stepper and last.get("duration_seconds"):
                self._duration_stepper.value = last["duration_seconds"]
            if self._distance_stepper and last.get("distance"):
                self._distance_stepper.value = last["distance"]

    def _get_stepper_values(self) -> dict:
        """Read current values from steppers."""
        vals = {}
        if self._reps_stepper:
            vals["reps"] = int(self._reps_stepper.value)
        if self._weight_stepper:
            vals["weight"] = self._weight_stepper.value
        if self._duration_stepper:
            vals["duration_seconds"] = int(self._duration_stepper.value)
        if self._distance_stepper:
            vals["distance"] = self._distance_stepper.value
        return vals

    def log_current(self):
        """Log a set with current stepper values."""
        vals = self._get_stepper_values()
        self.dispatch("on_set_logged", self.session_exercise_id, vals)

    def repeat_last(self):
        """Log a set copying the last set's values (or stepper values if no previous)."""
        if self.logged_sets:
            last = self.logged_sets[-1]
            vals = {
                "reps": last.get("reps"),
                "weight": last.get("weight"),
                "duration_seconds": last.get("duration_seconds"),
                "distance": last.get("distance"),
            }
        else:
            vals = self._get_stepper_values()
        self.dispatch("on_set_logged", self.session_exercise_id, vals)

    def on_set_logged(self, se_id, vals):
        """Default handler."""
        pass

    def on_chip_tapped(self, chip):
        """Default handler."""
        pass

    def on_toggle(self):
        """Default handler — dispatched when header is tapped."""
        pass
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/components/exercise_card.py src/screens/components/exercise_card.kv
git commit -m "feat: ExerciseCard accordion component with chips, steppers, log/repeat"
```

---

## Task 4: Service Additions

**Files:**
- Modify: `src/services/routine_service.py` (add `get_day_exercise()`)
- Modify: `src/services/workout_service.py` (add `start_routine_session_with_exercises()`)

Two service-layer additions needed before the workout screen:

- [ ] **Step 1: Add `get_day_exercise()` to `RoutineService`**

Append to `src/services/routine_service.py`:

```python
    def get_day_exercise(self, rde_id: int) -> Optional[RoutineDayExercise]:
        """Get a single day exercise by ID (for UI display of set_scheme etc.)."""
        return self._repo.get_day_exercise(rde_id)
```

- [ ] **Step 2: Add `start_routine_session_with_exercises()` to `WorkoutService`**

This moves session bootstrap logic out of the screen layer. Append to `src/services/workout_service.py`:

```python
    def start_routine_session_with_exercises(self, routine_day_id: int) -> WorkoutSession:
        """Start a session AND populate it with the day's planned exercises.

        This is the primary entry point for the UI. Creates the session,
        adds all exercises from the routine day plan, and commits once
        at the end (single transaction).
        Returns the created session.
        """
        # Block if another session is in progress
        existing = self._repo.get_in_progress_session()
        if existing:
            raise ValueError("Another session is already in progress")

        day = self._routine_repo.get_day(routine_day_id)
        if not day:
            raise ValueError(f"Routine day {routine_day_id} not found")

        routine = self._routine_repo.get_routine(day.routine_id)
        from src.models.workout import WorkoutSession, SessionExercise, SessionStatus, SessionType

        session = WorkoutSession(
            id=None,
            routine_id=day.routine_id,
            routine_day_id=routine_day_id,
            session_type=SessionType.ROUTINE,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            day_label_snapshot=day.label,
            day_name_snapshot=day.name,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)

        # Add all planned exercises in one transaction
        rdes = self._routine_repo.get_day_exercises(routine_day_id)
        for i, rde in enumerate(rdes):
            exercise = self._exercise_repo.get_by_id(rde.exercise_id)
            if not exercise:
                continue
            se = SessionExercise(
                id=None,
                session_id=session.id,
                exercise_id=rde.exercise_id,
                routine_day_exercise_id=rde.id,
                sort_order=i,
                exercise_name_snapshot=exercise.name,
            )
            self._repo.add_session_exercise(se)

        self._repo.commit()  # Single commit for entire bootstrap
        return session
```

- [ ] **Step 3: Verify tests pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 4: Commit**

```bash
git add src/services/routine_service.py src/services/workout_service.py
git commit -m "feat: add get_day_exercise and start_routine_session_with_exercises service methods"
```

---

## Task 5: Workout Screen

**Files:**
- Create: `src/screens/workout/__init__.py`, `src/screens/workout/workout_screen.py`, `src/screens/workout/workout_screen.kv`

The main workout screen with two states:
1. **Pre-session:** Shows current cycle day info + Start Workout button
2. **Active session:** Shows exercise cards (scrollable), bottom bar (Add Exercise, End Early, Finish)

- [ ] **Step 1: Create `src/screens/workout/__init__.py`** (empty)

- [ ] **Step 2: Create `src/screens/workout/workout_screen.kv`**

```yaml
#:import BACKGROUND src.theme.BACKGROUND
#:import SURFACE src.theme.SURFACE
#:import PRIMARY src.theme.PRIMARY
#:import TEXT_PRIMARY src.theme.TEXT_PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import DESTRUCTIVE src.theme.DESTRUCTIVE
#:import dp kivy.metrics.dp

<WorkoutScreen>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"

        # Header
        MDBoxLayout:
            size_hint_y: None
            height: dp(56)
            padding: [dp(16), 0, dp(16), 0]

            MDLabel:
                id: header_label
                text: "Workout"
                theme_text_color: "Custom"
                text_color: TEXT_PRIMARY
                font_style: "Headline"
                role: "small"
                pos_hint: {"center_y": 0.5}

        # Pre-session view
        MDBoxLayout:
            id: pre_session_view
            orientation: "vertical"
            padding: [dp(16), dp(16), dp(16), dp(16)]
            spacing: dp(16)

            Widget:
                size_hint_y: 0.2

            MDLabel:
                id: day_info_label
                text: "No active routine"
                halign: "center"
                theme_text_color: "Custom"
                text_color: TEXT_SECONDARY
                font_style: "Headline"
                role: "small"
                adaptive_height: True

            MDButton:
                id: start_session_btn
                style: "filled"
                theme_bg_color: "Custom"
                md_bg_color: PRIMARY
                size_hint_x: 1
                height: dp(56)
                on_release: root.start_session()

                MDButtonText:
                    text: "Start Workout"
                    theme_text_color: "Custom"
                    text_color: [0.071, 0.071, 0.071, 1]
                    font_style: "Title"
                    role: "medium"
                    bold: True

            Widget:
                size_hint_y: 0.5

        # Active session view (hidden by default)
        MDBoxLayout:
            id: active_session_view
            orientation: "vertical"
            opacity: 0
            size_hint_y: 0 if self.opacity == 0 else 1

            # Scrollable exercise cards
            ScrollView:
                MDBoxLayout:
                    id: card_container
                    orientation: "vertical"
                    adaptive_height: True
                    spacing: dp(8)
                    padding: [dp(8), dp(8), dp(8), dp(8)]

            # Bottom action bar
            MDBoxLayout:
                size_hint_y: None
                height: dp(56)
                padding: [dp(12), dp(4), dp(12), dp(4)]
                spacing: dp(8)
                md_bg_color: SURFACE

                MDButton:
                    style: "outlined"
                    size_hint_x: None
                    on_release: root.add_exercise()

                    MDButtonText:
                        text: "+ Add Exercise"
                        theme_text_color: "Custom"
                        text_color: TEXT_SECONDARY

                Widget:

                MDButton:
                    style: "text"
                    on_release: root.end_early()

                    MDButtonText:
                        text: "End Early"
                        theme_text_color: "Custom"
                        text_color: TEXT_SECONDARY

                MDButton:
                    style: "filled"
                    theme_bg_color: "Custom"
                    md_bg_color: PRIMARY
                    on_release: root.finish_workout()

                    MDButtonText:
                        text: "Finish"
                        theme_text_color: "Custom"
                        text_color: [0.071, 0.071, 0.071, 1]
                        bold: True
```

- [ ] **Step 3: Create `src/screens/workout/workout_screen.py`**

```python
"""Workout screen — pre-session day picker and active session with exercise cards.

Two states:
1. Pre-session: shows day info + Start button
2. Active session: exercise cards + bottom bar (add, end early, finish)
"""
import os
from kivy.lang import Builder
from kivy.properties import NumericProperty, ObjectProperty
from kivymd.uix.boxlayout import MDBoxLayout

from src.screens.base_screen import BaseScreen
from src.screens.components.exercise_card import ExerciseCard
from src.models.routine import SetKind

Builder.load_file(os.path.join(os.path.dirname(__file__), "workout_screen.kv"))


class WorkoutScreen(BaseScreen):

    current_session_id = NumericProperty(0)
    _expanded_card = ObjectProperty(None, allownone=True)

    def on_enter(self):
        """Check for in-progress session or show pre-session view."""
        self._refresh_state()

    def _refresh_state(self):
        if not self.app:
            return

        session = self.app.workout_service.get_in_progress_session()
        if session:
            self.current_session_id = session.id
            self._show_active_session(session)
        else:
            self.current_session_id = 0
            self._show_pre_session()

    def _show_pre_session(self):
        """Show day picker + start button."""
        self.ids.pre_session_view.opacity = 1
        self.ids.pre_session_view.size_hint_y = 1
        self.ids.active_session_view.opacity = 0
        self.ids.active_session_view.size_hint_y = 0

        routine = self.app.routine_service.get_active_routine()
        if not routine:
            self.ids.day_info_label.text = "No active routine"
            self.ids.start_session_btn.disabled = True
            self.ids.start_session_btn.opacity = 0.3
            return

        self.ids.start_session_btn.disabled = False
        self.ids.start_session_btn.opacity = 1

        current_day = self.app.cycle_service.get_current_day(routine.id)
        if current_day:
            self.ids.day_info_label.text = f"Day {current_day.label} — {current_day.name}"
            self._current_day_id = current_day.id
        else:
            self.ids.day_info_label.text = routine.name
            self._current_day_id = None

    def _show_active_session(self, session):
        """Show exercise cards and bottom bar."""
        self.ids.pre_session_view.opacity = 0
        self.ids.pre_session_view.size_hint_y = 0
        self.ids.active_session_view.opacity = 1
        self.ids.active_session_view.size_hint_y = 1

        if session.day_label_snapshot and session.day_name_snapshot:
            self.ids.header_label.text = f"Day {session.day_label_snapshot} — {session.day_name_snapshot}"
        else:
            self.ids.header_label.text = "Workout"

        self._rebuild_cards()

    def _rebuild_cards(self):
        """Rebuild exercise cards from session data."""
        container = self.ids.card_container
        container.clear_widgets()
        self._expanded_card = None

        if not self.current_session_id:
            return

        session_exercises = self.app.workout_service.get_session_exercises(self.current_session_id)

        for se in session_exercises:
            exercise = self.app.exercise_service.get_exercise(se.exercise_id)
            if not exercise:
                continue

            # Get targets if linked to a plan exercise
            targets_data = []
            if se.routine_day_exercise_id:
                targets = self.app.routine_service.get_targets(se.routine_day_exercise_id)
                targets_data = [
                    {
                        "id": t.id,  # DB id for plan-vs-actual linking
                        "set_kind": t.set_kind.value,
                        "target_reps_min": t.target_reps_min,
                        "target_reps_max": t.target_reps_max,
                        "target_weight": t.target_weight,
                        "target_duration_seconds": t.target_duration_seconds,
                        "target_distance": t.target_distance,
                    }
                    for t in targets
                ]

            # Get logged sets
            logged = self.app.workout_service.get_logged_sets(se.id)
            logged_data = [
                {
                    "id": ls.id,
                    "set_kind": ls.set_kind.value,
                    "reps": ls.reps,
                    "weight": ls.weight,
                    "duration_seconds": ls.duration_seconds,
                    "distance": ls.distance,
                }
                for ls in logged
            ]

            # Determine set_scheme via public service method
            set_scheme = "uniform"
            if se.routine_day_exercise_id:
                rde = self.app.routine_service.get_day_exercise(se.routine_day_exercise_id)
                if rde:
                    set_scheme = rde.set_scheme.value

            card = ExerciseCard(
                session_exercise_id=se.id,
                exercise_id=se.exercise_id,
                exercise_name=se.exercise_name_snapshot,
                exercise_type=exercise.type.value,
                set_scheme=set_scheme,
                targets=targets_data,
                logged_sets=logged_data,
            )
            card.bind(on_set_logged=self._on_set_logged)
            card.bind(on_chip_tapped=self._on_chip_tapped)
            card.refresh_chips()

            # Bind card's on_toggle event for accordion behavior
            card.bind(on_toggle=lambda inst: self._on_card_toggle(inst))

            container.add_widget(card)

        # Auto-expand first card
        if container.children:
            first_card = container.children[-1]  # children are reversed
            self._expand_card(first_card)

    def _expand_card(self, card):
        """Expand a card and collapse the previously expanded one."""
        if self._expanded_card and self._expanded_card != card:
            self._expanded_card.is_expanded = False
        card.is_expanded = True
        self._expanded_card = card

    def _on_card_toggle(self, card):
        """Handle card header tap for accordion."""
        if card.is_expanded:
            card.is_expanded = False
            self._expanded_card = None
        else:
            self._expand_card(card)

    def _on_set_logged(self, card_instance, se_id, vals):
        """Handle set logged from exercise card."""
        exercise = self.app.exercise_service.get_exercise(card_instance.exercise_id)
        if not exercise:
            return

        # Determine set_kind: use target's kind if available, else derive from exercise type
        logged_count = len(card_instance.logged_sets)
        target_id = None

        if logged_count < len(card_instance.targets):
            target = card_instance.targets[logged_count]
            set_kind = SetKind(target.get("set_kind", exercise.type.value))
            # Link to plan target for plan-vs-actual
            target_id = target.get("id")
        else:
            # Ad-hoc / extra set — derive from exercise type
            type_to_kind = {
                "reps_weight": "reps_weight",
                "reps_only": "reps_only",
                "time": "duration",
                "cardio": "cardio",
            }
            set_kind = SetKind(type_to_kind.get(exercise.type.value, "reps_weight"))

        try:
            self.app.workout_service.log_set(
                session_exercise_id=se_id,
                set_kind=set_kind,
                exercise_set_target_id=target_id,
                reps=vals.get("reps"),
                weight=vals.get("weight"),
                duration_seconds=vals.get("duration_seconds"),
                distance=vals.get("distance"),
            )
        except ValueError as e:
            print(f"[Workout] Failed to log set: {e}")
            return

        # Refresh the card's data
        self._refresh_card(card_instance)

    def _refresh_card(self, card):
        """Refresh a single card's logged sets and chips."""
        logged = self.app.workout_service.get_logged_sets(card.session_exercise_id)
        card.logged_sets = [
            {
                "id": ls.id,
                "set_kind": ls.set_kind.value,
                "reps": ls.reps,
                "weight": ls.weight,
                "duration_seconds": ls.duration_seconds,
                "distance": ls.distance,
            }
            for ls in logged
        ]
        card.refresh_chips()
        if card.is_expanded:
            card._prefill_steppers()

    def _on_chip_tapped(self, card_instance, chip):
        """Handle tapping a logged chip — open edit/delete dialog (Task 5)."""
        # Placeholder — Task 5 replaces this with a real edit/delete dialog
        print(f"[Workout] Chip tapped: set_id={chip.set_id}")
        self._edit_chip_card = card_instance
        self._edit_chip_set_id = chip.set_id

    # --- Session actions ---

    def start_session(self):
        """Start a new workout session for the current cycle day."""
        if not hasattr(self, "_current_day_id") or not self._current_day_id:
            return

        try:
            session = self.app.workout_service.start_routine_session_with_exercises(
                self._current_day_id
            )
        except ValueError as e:
            print(f"[Workout] Failed to start session: {e}")
            return

        self.current_session_id = session.id
        self._show_active_session(session)

    def add_exercise(self):
        """Open exercise picker to add an ad-hoc exercise.

        TODO: Phase 3C will implement an exercise picker dialog.
        For now, just print a placeholder message.
        """
        print("[Workout] Add exercise — picker not yet implemented")

    def end_early(self):
        """End the session early (confirmation in Task 6)."""
        if not self.current_session_id:
            return
        # TODO: Task 6 adds confirmation sheet
        self.app.workout_service.end_early(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()

    def finish_workout(self):
        """Finish the workout (confirmation in Task 6)."""
        if not self.current_session_id:
            return
        # TODO: Task 6 adds confirmation sheet
        self.app.workout_service.finish_session(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()
```

- [ ] **Step 4: Verify tests still pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/workout/
git commit -m "feat: workout screen with pre-session view, active session, exercise cards"
```

---

## Task 6: Edit/Delete + Confirmation Sheets

**Files:**
- Modify: `src/screens/workout/workout_screen.py` (implement `_on_chip_tapped`)

When a logged chip is tapped, open a bottom sheet with edit fields and Save/Delete/Cancel buttons.

- [ ] **Step 1: Add `_on_chip_tapped` implementation to `workout_screen.py`**

Replace the placeholder `_on_chip_tapped` method with one using `AppBottomSheet`:

```python
    def _on_chip_tapped(self, card_instance, chip):
        """Open edit/delete bottom sheet for a logged set."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from src.screens.components.stepper import ValueStepper

        set_id = chip.set_id
        # Find the set data from the card's loaded list (no repo access needed)
        set_data = None
        for ls in card_instance.logged_sets:
            if ls.get("id") == set_id:
                set_data = ls
                break
        if not set_data:
            return

        sheet = AppBottomSheet(title="Edit Set")
        edit_steppers = {}

        if set_data.get("reps") is not None:
            s = ValueStepper(value=set_data["reps"], step=1, min_val=1, label="reps", is_integer=True)
            sheet.add_content(s)
            edit_steppers["reps"] = s
        if set_data.get("weight") is not None:
            s = ValueStepper(value=set_data["weight"], step=5, min_val=0, label="lbs", is_integer=False)
            sheet.add_content(s)
            edit_steppers["weight"] = s
        if set_data.get("duration_seconds") is not None:
            s = ValueStepper(value=set_data["duration_seconds"], step=5, min_val=1, label="sec", is_integer=True)
            sheet.add_content(s)
            edit_steppers["duration_seconds"] = s
        if set_data.get("distance") is not None:
            s = ValueStepper(value=set_data["distance"], step=0.1, min_val=0, label="km", is_integer=False)
            sheet.add_content(s)
            edit_steppers["distance"] = s

        def on_save(*args):
            vals = {}
            if "reps" in edit_steppers:
                vals["reps"] = int(edit_steppers["reps"].value)
            if "weight" in edit_steppers:
                vals["weight"] = edit_steppers["weight"].value
            if "duration_seconds" in edit_steppers:
                vals["duration_seconds"] = int(edit_steppers["duration_seconds"].value)
            if "distance" in edit_steppers:
                vals["distance"] = edit_steppers["distance"].value
            try:
                self.app.workout_service.update_set(set_id, **vals)
            except ValueError as e:
                print(f"[Workout] Failed to update: {e}")
            sheet.dismiss()
            self._refresh_card(card_instance)

        def on_delete(*args):
            self.app.workout_service.delete_set(set_id)
            sheet.dismiss()
            self._refresh_card(card_instance)

        def on_cancel(*args):
            sheet.dismiss()

        sheet.add_action("Delete", on_delete, destructive=True)
        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/workout/workout_screen.py
git commit -m "feat: edit/delete bottom sheet for logged set chips"
```

---

### Confirmation Sheets (same task, continued)

**Files:**
- Modify: `src/screens/workout/workout_screen.py`

Replace the direct `end_early()` and `finish_workout()` calls with confirmation bottom sheets per spec L874-879.

- [ ] **Step 1: Add confirmation methods**

Replace the `end_early` and `finish_workout` methods:

```python
    def end_early(self):
        """Confirm before ending session early."""
        if not self.current_session_id:
            return
        self._show_confirmation(
            title="End workout early?",
            description="Your session will be saved. Cycle advances only if you logged at least one set.",
            confirm_text="End Early",
            is_destructive=True,
            on_confirm=self._do_end_early,
        )

    def finish_workout(self):
        """Confirm before finishing workout."""
        if not self.current_session_id:
            return
        self._show_confirmation(
            title="Finish workout?",
            description="Your session will be saved and the cycle will advance to the next day.",
            confirm_text="Finish",
            is_destructive=False,
            on_confirm=self._do_finish,
        )

    def _do_end_early(self):
        self.app.workout_service.end_early(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()

    def _do_finish(self):
        self.app.workout_service.finish_session(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()

    def _show_confirmation(self, title, description, confirm_text, is_destructive, on_confirm):
        """Show a confirmation bottom sheet per spec L874-879."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from kivymd.uix.label import MDLabel
        from src.theme import TEXT_SECONDARY

        sheet = AppBottomSheet(title=title)
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=description,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*args):
            sheet.dismiss()

        def on_ok(*args):
            sheet.dismiss()
            on_confirm()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action(confirm_text, on_ok, style="filled", destructive=is_destructive)
        sheet.open()
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/workout/workout_screen.py
git commit -m "feat: confirmation bottom sheets for end early and finish workout"
```

---

## Task 7: Wire WorkoutScreen into main.py

**Files:**
- Modify: `src/main.py`

Replace the workout placeholder with the real WorkoutScreen.

- [ ] **Step 1: Update `src/main.py`**

In `_build_ui()`, replace `PlaceholderScreen("workout")` with:

```python
from src.screens.workout.workout_screen import WorkoutScreen
```

And change:
```python
self.tab_manager.add_widget(PlaceholderScreen("workout"))
```
to:
```python
self.tab_manager.add_widget(WorkoutScreen(name="workout"))
```

- [ ] **Step 2: Verify app launches with workout screen**

```bash
python -m src.main
```

Verify:
- Home → tap dumbbell → Workout tab shows day info + Start Workout button
- Tap Start → exercise cards appear (if routine has exercises)
- Tap card header → accordion expand/collapse
- Stepper +/- works
- "Repeat Last" and "LOG SET" log sets (green chips appear)
- Tap green chip → edit/delete sheet
- "End Early" → confirmation sheet → confirms → returns to pre-session
- "Finish" → confirmation → returns to pre-session, cycle advances

- [ ] **Step 3: Verify tests pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 4: Commit**

```bash
git add src/main.py
git commit -m "feat: wire WorkoutScreen into main app, replacing placeholder"
```

---

## Verification Checkpoint

After completing all 7 tasks:

1. **Tests:** all existing tests pass (UI screens aren't unit tested — manual verification on device/desktop)
2. **App launch:** workout tab shows pre-session or active session state
3. **Full workout flow:** Start → log sets (stepper + repeat last) → finish → cycle advances
4. **Chip interaction:** tap logged chip → edit/delete bottom sheet
5. **Confirmation sheets:** end early and finish both show confirmation bottom sheets
6. **Accordion:** only one card expanded at a time
7. **Pre-fill:** steppers pre-fill from targets or last set
8. **Resume unfinished workout:** Start a session, log a set, switch to Home tab, verify banner shows, tap Resume → returns to active workout with logged sets preserved
9. **End Early with zero sets:** Start a session, immediately tap End Early → confirm → verify cycle does NOT advance (check Home screen still shows same day)

**Known limitations for Phase 3C:**
- Add Exercise picker is a placeholder (prints to console)
- No exercise type picker when adding ad-hoc exercises
- No benchmark session UI (benchmark tab is placeholder)
- Day picker for manual day override not yet implemented
- Stepper label shows "lbs" hardcoded — should use settings_service.get_weight_unit()
- Plan-vs-actual target linking works for plan exercises but not for ad-hoc/extra sets (target_id=None)

"""Import/Export screen — routine export and two-step import flow.

Sections:
  Export: list routines with "Export" button per row. Tap → JSON in copyable text area.
  Import: paste JSON → Preview → show name/days/exercises/warnings/unmatched.
          If unmatched exercises: map to existing or create new.
          "Import as Draft" / "Import and Activate" buttons.
  Full backup/restore: disabled section with "Coming soon" message.
"""
import json

from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText, MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.screens.components.exercise_picker import ExercisePickerSheet
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY, BACKGROUND


class ImportExportScreen(ManageDetailScreen):
    """Import/Export screen with routine export and two-step import flow."""

    def __init__(self, **kwargs):
        super().__init__(title="Import / Export", **kwargs)

    def build_content(self, container):
        container.clear_widgets()

        scroll = MDScrollView()
        main_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            padding=[dp(16), dp(8), dp(16), dp(16)],
            spacing=dp(24),
        )

        # ── Export Section ──────────────────────────────────────────────────────
        main_layout.add_widget(self._build_section_header("Export Routine"))

        routines = self.app.routine_service.list_routines()
        if not routines:
            main_layout.add_widget(MDLabel(
                text="No routines to export.",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="medium",
                size_hint_y=None,
                height=dp(40),
            ))
        else:
            for routine in routines:
                main_layout.add_widget(self._build_export_row(routine))

        # ── Import Section ──────────────────────────────────────────────────────
        main_layout.add_widget(self._build_divider())
        main_layout.add_widget(self._build_section_header("Import Routine"))
        main_layout.add_widget(MDLabel(
            text="Paste exported JSON below, then tap Preview.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            size_hint_y=None,
            height=dp(32),
        ))

        # JSON text area
        import_field = MDTextField(
            multiline=True,
            size_hint_y=None,
            height=dp(120),
        )
        import_field.add_widget(MDTextFieldHintText(text="Paste JSON here..."))
        main_layout.add_widget(import_field)

        preview_btn = MDButton(style="outlined", size_hint_x=None)
        preview_btn.add_widget(MDButtonText(text="Preview Import"))

        # Result container — rebuilt after preview
        preview_container = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(8),
        )

        def on_preview(*a):
            preview_container.clear_widgets()
            raw = import_field.text.strip()
            if not raw:
                preview_container.add_widget(MDLabel(
                    text="Paste JSON above first.",
                    theme_text_color="Custom",
                    text_color=TEXT_SECONDARY,
                    font_style="Body",
                    role="small",
                    adaptive_height=True,
                ))
                return
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as e:
                preview_container.add_widget(MDLabel(
                    text=f"Invalid JSON: {e}",
                    theme_text_color="Custom",
                    text_color=(0.97, 0.44, 0.44, 1),
                    font_style="Body",
                    role="small",
                    adaptive_height=True,
                ))
                return
            self._build_preview(data, preview_container)

        preview_btn.bind(on_release=on_preview)
        main_layout.add_widget(preview_btn)
        main_layout.add_widget(preview_container)

        # ── Full Backup Section (deferred) ──────────────────────────────────────
        main_layout.add_widget(self._build_divider())
        main_layout.add_widget(self._build_section_header("Full Backup"))
        main_layout.add_widget(MDLabel(
            text="Full database backup and restore coming soon.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            size_hint_y=None,
            height=dp(32),
        ))
        # Disabled backup button
        backup_btn = MDButton(style="outlined", size_hint_x=None, disabled=True)
        backup_btn.add_widget(MDButtonText(text="Full Backup (Coming Soon)"))
        main_layout.add_widget(backup_btn)

        scroll.add_widget(main_layout)
        container.add_widget(scroll)

    # ── Section helpers ──────────────────────────────────────────────────────

    def _build_section_header(self, title: str):
        label = MDLabel(
            text=title,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Title",
            role="medium",
            size_hint_y=None,
            height=dp(36),
        )
        return label

    def _build_divider(self):
        divider = MDBoxLayout(
            size_hint_y=None,
            height=dp(1),
            md_bg_color=DIVIDER,
        )
        return divider

    # ── Export ────────────────────────────────────────────────────────────────

    def _build_export_row(self, routine):
        """Build a single routine export row."""
        row = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[0, dp(4), 0, dp(4)],
            spacing=dp(8),
            md_bg_color=SURFACE,
        )

        # Active indicator
        indicator = " (active)" if routine.is_active else ""
        row.add_widget(MDLabel(
            text=f"{routine.name}{indicator}",
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        ))

        export_btn = MDButton(style="outlined", size_hint_x=None)
        export_btn.add_widget(MDButtonText(text="Export"))
        export_btn.bind(on_release=lambda *a, r=routine: self._export_routine(r))
        row.add_widget(export_btn)

        return row

    def _export_routine(self, routine):
        """Export routine to JSON and show in a copyable bottom sheet."""
        try:
            data = self.app.import_export_service.export_routine(routine.id)
            json_str = json.dumps(data, indent=2)
        except Exception as e:
            self._show_error_sheet(f"Export failed: {e}")
            return

        sheet = AppBottomSheet(title=f"Export: {routine.name}")
        sheet.set_height(460)

        sheet.add_content(MDLabel(
            text="Copy the JSON below to share or back up this routine.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        ))

        # Scrollable text area showing the JSON
        json_scroll = MDScrollView(size_hint_y=None, height=dp(280))
        json_field = MDTextField(
            text=json_str,
            multiline=True,
            readonly=True,
            size_hint_y=None,
        )
        # Approximate height: ~20px per line
        line_count = json_str.count("\n") + 1
        json_field.height = max(dp(20 * line_count), dp(280))
        json_scroll.add_widget(json_field)
        sheet.add_content(json_scroll)

        def on_close(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Close", on_close)
        sheet.open()

    # ── Import ────────────────────────────────────────────────────────────────

    def _build_preview(self, data: dict, container):
        """Run preview_import and populate the preview container."""
        try:
            preview = self.app.import_export_service.preview_import(data)
        except Exception as e:
            container.add_widget(MDLabel(
                text=f"Preview error: {e}",
                theme_text_color="Custom",
                text_color=(0.97, 0.44, 0.44, 1),
                font_style="Body",
                role="small",
                adaptive_height=True,
            ))
            return

        if not preview.is_valid:
            container.add_widget(MDLabel(
                text="Validation errors:",
                theme_text_color="Custom",
                text_color=(0.97, 0.44, 0.44, 1),
                font_style="Body",
                role="medium",
                adaptive_height=True,
            ))
            for err in preview.errors:
                container.add_widget(MDLabel(
                    text=f"  • {err}",
                    theme_text_color="Custom",
                    text_color=(0.97, 0.44, 0.44, 1),
                    font_style="Body",
                    role="small",
                    adaptive_height=True,
                ))
            return

        # Summary
        container.add_widget(MDLabel(
            text=f"Routine: {preview.name}",
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        ))
        container.add_widget(MDLabel(
            text=f"{preview.day_count} day(s)",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        # Day/exercise summary
        for day_idx, ex_names in enumerate(preview.exercises_per_day):
            container.add_widget(MDLabel(
                text=f"  Day {day_idx + 1}: {', '.join(ex_names)}",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="small",
                adaptive_height=True,
            ))

        # Warnings
        for warning in preview.warnings:
            container.add_widget(MDLabel(
                text=f"Warning: {warning}",
                theme_text_color="Custom",
                text_color=(1.0, 0.75, 0.0, 1),
                font_style="Body",
                role="small",
                adaptive_height=True,
            ))

        # Unmatched exercises — with mapping options
        # exercise_mapping: dict mapping name -> exercise_id (or None = create new)
        exercise_mapping = {}  # name -> int id, or absent = create new

        if preview.unmatched_exercises:
            container.add_widget(MDLabel(
                text="Unmatched exercises (will be created as new):",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Label",
                role="large",
                adaptive_height=True,
            ))
            for unmatched in preview.unmatched_exercises:
                ex_name = unmatched["name"]
                self._build_unmatched_row(container, ex_name, exercise_mapping)

        # Import action buttons
        btn_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))

        draft_btn = MDButton(style="outlined", size_hint_x=None)
        draft_btn.add_widget(MDButtonText(text="Import as Draft"))
        draft_btn.bind(on_release=lambda *a: self._do_import(data, exercise_mapping, False, container))
        btn_row.add_widget(draft_btn)

        activate_btn = MDButton(style="filled", size_hint_x=None)
        activate_btn.add_widget(MDButtonText(text="Import and Activate"))
        activate_btn.bind(on_release=lambda *a: self._do_import(data, exercise_mapping, True, container))
        btn_row.add_widget(activate_btn)

        container.add_widget(btn_row)

    def _build_unmatched_row(self, container, ex_name: str, exercise_mapping: dict):
        """Build a row for an unmatched exercise with 'Create New' / 'Pick Existing' options."""
        row = MDBoxLayout(
            size_hint_y=None,
            height=dp(48),
            spacing=dp(8),
            padding=[dp(8), 0, 0, 0],
        )

        # Label showing exercise name and current mapping status
        mapping_state = {"label": None}

        name_label = MDLabel(
            text=ex_name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        )
        row.add_widget(name_label)

        status_label = MDLabel(
            text="→ create new",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            size_hint_x=None,
            width=dp(100),
            adaptive_height=True,
        )
        row.add_widget(status_label)
        mapping_state["label"] = status_label

        pick_btn = MDButton(style="text", size_hint_x=None)
        pick_btn.add_widget(MDButtonText(text="Pick Existing"))

        def on_exercise_picked(ex_id, picked_name, name=ex_name):
            exercise_mapping[name] = ex_id
            mapping_state["label"].text = f"→ {picked_name}"

        def open_picker(*a, n=ex_name):
            picker = ExercisePickerSheet(
                self.app,
                on_select=lambda eid, ename: on_exercise_picked(eid, ename, n),
                title="Map to Existing Exercise",
            )
            picker.open()

        pick_btn.bind(on_release=open_picker)
        row.add_widget(pick_btn)

        container.add_widget(row)

    def _do_import(self, data: dict, exercise_mapping: dict, activate: bool, container):
        """Perform the actual import and show result."""
        try:
            routine_id = self.app.import_export_service.import_routine(
                data,
                exercise_mapping=exercise_mapping if exercise_mapping else None,
                activate=activate,
            )
        except Exception as e:
            container.clear_widgets()
            container.add_widget(MDLabel(
                text=f"Import failed: {e}",
                theme_text_color="Custom",
                text_color=(0.97, 0.44, 0.44, 1),
                font_style="Body",
                role="medium",
                adaptive_height=True,
            ))
            return

        action = "imported and activated" if activate else "imported as draft"
        container.clear_widgets()
        container.add_widget(MDLabel(
            text=f"Routine {action} successfully (id={routine_id}).",
            theme_text_color="Custom",
            text_color=PRIMARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))
        # Refresh the full screen to show updated export list
        self.build_content(self._content_area)

    # ── Error helper ──────────────────────────────────────────────────────────

    def _show_error_sheet(self, message: str):
        sheet = AppBottomSheet(title="Error")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=message,
            theme_text_color="Custom",
            text_color=(0.97, 0.44, 0.44, 1),
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_close(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Close", on_close)
        sheet.open()

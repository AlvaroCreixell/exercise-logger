# Hardening Pass 2: Complete Spec Fidelity (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 6 remaining spec-vs-implementation gaps where the backend supports features the UI doesn't expose, plus fix export round-trip data loss and make analytics exercise-type-aware.

**Architecture:** Tasks 1, 4a, and 5 are backend with TDD tests. Tasks 2, 3, 4b, and 6 are UI screen changes. Task 4 is split into 4a (extract testable payload builder) and 4b (wire UI), giving automated coverage for the riskiest logic. Task ordering: 1→2 (export before preview); 4a→4b (tests before UI); 5→6 (stats before detail screen).

**Key design decisions (from review):**
- **AMRAP in progressive mode:** Per-row, not global. Enables spec-valid mixed targets like "3×8 then 1 AMRAP."
- **Rep ranges in progressive mode:** Per-row implicit — always show min/max steppers; set min=max for exact reps.
- **Rep ranges in uniform mode:** Global toggle — shows one or two steppers.
- **Cardio best set:** Prefer distance when present and >0, fall back to duration. Show both in personal best card.
- **PvA formatting:** Branch on `row["set_kind"]` per row, not just exercise type. AMRAP planned shows "weight × AMRAP."
- **Export frequency_weeks:** Derive from most common item frequency, not hardcoded 6.

**Testing note:** Screen files are not imported by the test suite. Every UI verification step includes `python -m compileall <file> -q`.

**Tech Stack:** Python 3.10+, Kivy + KivyMD, pytest, SQLite (in-memory for tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/services/import_export_service.py` | Modify | Add benchmarking section to export |
| `tests/test_import_export.py` | Modify | Test export with benchmarks, round-trip |
| `src/screens/manage/import_export_screen.py` | Modify | Render benchmark summary in import preview |
| `src/screens/manage/benchmark_setup_screen.py` | Modify | Add reference_weight field + show in list row |
| `src/services/validation.py` | Modify | Add `DEFAULT_SET_KIND` + `build_targets_payload` (no Kivy deps) |
| `src/screens/manage/routine_editor_screen.py` | Modify | Import payload builder, remove local dict, add AMRAP/range UI |
| `tests/test_target_payload.py` | Create | Test the pure payload builder function (imports from validation.py) |
| `src/services/stats_service.py` | Modify | Type-aware history, best set, and PRs |
| `tests/test_stats_service.py` | Modify | Test type-aware stats for all exercise types |
| `src/screens/dashboard/exercise_detail_screen.py` | Modify | Render type-appropriate charts, best set, PvA |
| `src/screens/dashboard/dashboard_screen.py` | Modify | PR section uses type-aware formatting |

---

### Task 1: Add Benchmarking Section to Export

**Audit issue #7.** Export loses benchmarks on round-trip.

**Files:**
- Modify: `tests/test_import_export.py`
- Modify: `src/services/import_export_service.py:62-105`

- [ ] **Step 1: Write test — export includes benchmarking section**

Add to `TestExportRoutine` in `tests/test_import_export.py`:

```python
def test_export_includes_benchmarks(self, import_export_service, routine_service, make_exercise, benchmark_service):
    """Export includes benchmarking section when exercises have benchmark definitions."""
    r = routine_service.create_routine("Bench Routine")
    day = routine_service.add_day(r.id, "A", "Push")
    ex = make_exercise("Bench Press")
    routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

    benchmark_service.create_definition(
        ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper",
        reference_weight=100.0, frequency_weeks=8,
    )

    exported = import_export_service.export_routine(r.id)

    assert "benchmarking" in exported
    bm = exported["benchmarking"]
    assert bm["enabled"] is True
    assert bm["frequency_weeks"] == 8  # derived from items, not hardcoded
    assert len(bm["items"]) == 1
    item = bm["items"][0]
    assert item["exercise_name"] == "Bench Press"
    assert item["method"] == "max_weight"
    assert item["reference_weight"] == 100.0
    assert item["muscle_group_label"] == "Upper"
    assert item["frequency_weeks"] == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_import_export.py::TestExportRoutine::test_export_includes_benchmarks -v`
Expected: FAIL

- [ ] **Step 3: Write test — no benchmarks omits section**

```python
def test_export_no_benchmarks_omits_section(self, import_export_service, routine_service, make_exercise):
    r = routine_service.create_routine("No BM")
    day = routine_service.add_day(r.id, "A", "Push")
    ex = make_exercise("Squat")
    routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

    exported = import_export_service.export_routine(r.id)
    assert "benchmarking" not in exported
```

- [ ] **Step 4: Write test — round-trip preserves benchmarks**

```python
def test_round_trip_with_benchmarks(self, import_export_service, routine_service, make_exercise, benchmark_service, benchmark_repo):
    r = routine_service.create_routine("BM Round Trip")
    day = routine_service.add_day(r.id, "A", "Push")
    ex = make_exercise("OHP")
    routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
    routine_service.set_uniform_targets(
        routine_service.get_day_exercises(day.id)[0].id,
        num_sets=3, set_kind=SetKind.REPS_WEIGHT,
        reps_min=10, reps_max=10, weight=60,
    )
    benchmark_service.create_definition(
        ex.id, BenchmarkMethod.MAX_REPS, "Upper",
        reference_weight=50.0, frequency_weeks=4,
    )

    exported = import_export_service.export_routine(r.id)
    new_id = import_export_service.import_routine(exported)

    new_rdes = routine_service.get_day_exercises(
        routine_service.get_days(new_id)[0].id
    )
    defns = benchmark_repo.get_definitions_for_exercise(new_rdes[0].exercise_id)
    assert len(defns) >= 1
    assert defns[0].method == BenchmarkMethod.MAX_REPS
    assert defns[0].reference_weight == 50.0
```

- [ ] **Step 5: Implement export benchmarking**

In `src/services/import_export_service.py`, replace lines 100-105 (the `return` block) with:

```python
        # Collect benchmark definitions for exercises in this routine
        benchmark_items = []
        seen_exercise_ids = set()
        for day in days:
            rdes = self._routine_repo.get_day_exercises(day.id)
            for rde in rdes:
                if rde.exercise_id in seen_exercise_ids:
                    continue
                seen_exercise_ids.add(rde.exercise_id)
                defns = self._benchmark_repo.get_definitions_for_exercise(rde.exercise_id)
                if not defns:
                    continue
                exercise = self._exercise_repo.get_by_id(rde.exercise_id)
                for defn in defns:
                    benchmark_items.append({
                        "exercise_name": exercise.name,
                        "method": defn.method.value,
                        "reference_weight": defn.reference_weight,
                        "muscle_group_label": defn.muscle_group_label,
                        "frequency_weeks": defn.frequency_weeks,
                    })

        result = {
            "schema_version": 1,
            "name": routine.name,
            "days": days_data,
        }

        if benchmark_items:
            # Derive default frequency from mode of item frequencies
            from collections import Counter
            freq_counts = Counter(item["frequency_weeks"] for item in benchmark_items)
            default_freq = freq_counts.most_common(1)[0][0]
            result["benchmarking"] = {
                "enabled": True,
                "frequency_weeks": default_freq,
                "items": benchmark_items,
            }

        return result
```

- [ ] **Step 6: Run all import/export tests**

```bash
pytest tests/test_import_export.py -v --tb=short
```
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/import_export_service.py tests/test_import_export.py
git commit -m "feat: export includes benchmarking section with derived default frequency"
```

---

### Task 2: Render Benchmark Summary in Import Preview

**Audit issue #9.** `preview.benchmark_summary` computed by service but never rendered.

**Files:**
- Modify: `src/screens/manage/import_export_screen.py:304-313`

- [ ] **Step 1: Add benchmark summary rendering**

In `_build_preview`, after the warnings loop (after line 313), before the unmatched exercises section (line 315), add:

```python
        # Benchmark summary
        if preview.benchmark_summary:
            bm = preview.benchmark_summary
            container.add_widget(MDLabel(
                text=f"Benchmarks: {bm['item_count']} definition(s), every {bm['default_frequency_weeks']}w default",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="small",
                adaptive_height=True,
            ))
            for item in bm.get("items", []):
                method_label = item.get("method", "").replace("_", " ")
                container.add_widget(MDLabel(
                    text=f"  \u2022 {item.get('exercise_name', '?')} ({method_label})",
                    theme_text_color="Custom",
                    text_color=TEXT_SECONDARY,
                    font_style="Body",
                    role="small",
                    adaptive_height=True,
                ))
```

- [ ] **Step 2: Verify**

```bash
python -m compileall src/screens/manage/import_export_screen.py -q && pytest tests/ -q --tb=short
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/manage/import_export_screen.py
git commit -m "feat: import preview renders benchmark summary"
```

---

### Task 3: Benchmark Setup — Reference Weight + List Display

**Audit issue #6.** `reference_weight` not exposed in UI. Also: once set, it's invisible in the list row.

**Files:**
- Modify: `src/screens/manage/benchmark_setup_screen.py`

- [ ] **Step 1: Add reference_weight stepper to create sheet**

In `_open_create_sheet` (line 190), after line 259 (`sheet.add_content(method_row)`), add:

```python
        # Reference weight (most relevant for max_reps: "max reps at X lbs")
        ref_weight_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        ref_weight_row.add_widget(MDLabel(
            text="Reference weight:",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Body", role="medium", adaptive_height=True,
        ))
        ref_weight_stepper = ValueStepper(
            value=0, step=5, min_val=0, max_val=999,
            label="kg/lbs", is_integer=False,
        )
        ref_weight_row.add_widget(ref_weight_stepper)
        sheet.add_content(ref_weight_row)
```

In `on_save` (line 319), update the `create_definition` call (lines 325-330) to pass reference_weight:

```python
                ref_wt = ref_weight_stepper.value if ref_weight_stepper.value > 0 else None
                self.app.benchmark_service.create_definition(
                    exercise_id=state["exercise_id"],
                    method=state["method"],
                    muscle_group_label=group,
                    frequency_weeks=int(freq_stepper.value),
                    reference_weight=ref_wt,
                )
```

- [ ] **Step 2: Add reference_weight stepper to edit sheet**

In `_open_edit_sheet` (line 344), after method selection (line 418), before frequency stepper (line 420), add:

```python
        # Reference weight
        ref_weight_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        ref_weight_row.add_widget(MDLabel(
            text="Reference weight:",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Body", role="medium", adaptive_height=True,
        ))
        ref_weight_stepper = ValueStepper(
            value=defn.reference_weight or 0,
            step=5, min_val=0, max_val=999,
            label="kg/lbs", is_integer=False,
        )
        ref_weight_row.add_widget(ref_weight_stepper)
        sheet.add_content(ref_weight_row)
```

In `on_save` (line 486), after line 491 (`defn.muscle_group_label = group`), add:

```python
            defn.reference_weight = ref_weight_stepper.value if ref_weight_stepper.value > 0 else None
```

- [ ] **Step 3: Surface reference_weight in list row**

In `_build_defn_row` (line 132), replace the subtitle label (lines 159-167):

```python
        method_label = _METHOD_LABELS.get(defn.method, defn.method.value)
        info_col.add_widget(MDLabel(
            text=f"{method_label} \u00b7 every {defn.frequency_weeks}w",
```

With:

```python
        method_label = _METHOD_LABELS.get(defn.method, defn.method.value)
        ref_text = f" at {defn.reference_weight}" if defn.reference_weight else ""
        info_col.add_widget(MDLabel(
            text=f"{method_label}{ref_text} \u00b7 every {defn.frequency_weeks}w",
```

- [ ] **Step 4: Verify**

```bash
python -m compileall src/screens/manage/benchmark_setup_screen.py -q && pytest tests/ -q --tb=short
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/manage/benchmark_setup_screen.py
git commit -m "feat: benchmark setup exposes reference_weight in create/edit/list"
```

---

### Task 4a: Extract Testable Target Payload Builder

**Audit issues #3, #4 — backend half.** Extract the state→target-payload mapping into a pure function with tests. This gives automated coverage for the riskiest logic in the editor before touching the UI.

**Critical: isolation from Kivy.** The function must live in a module with no Kivy/KivyMD imports, so tests can run without the UI framework installed. `src/services/validation.py` already exists for this purpose — it imports only models, no Kivy. The `_DEFAULT_SET_KIND` dict (currently in `routine_editor_screen.py`) must also move there, since the payload builder depends on it.

**Design:**
- Uniform mode: global `is_amrap` and `use_rep_range` apply to all sets
- Progressive mode: per-row `is_amrap` and per-row `reps_max` (no global range toggle — always min/max)

**Files:**
- Create: `tests/test_target_payload.py`
- Modify: `src/services/validation.py` (add `DEFAULT_SET_KIND` dict + `build_targets_payload` function)
- Modify: `src/screens/manage/routine_editor_screen.py` (remove `_DEFAULT_SET_KIND`, import from validation)

- [ ] **Step 1: Write tests for the payload builder**

Create `tests/test_target_payload.py`:

```python
"""Tests for build_targets_payload — the pure function that maps editor state to target dicts."""
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetKind


# Import will fail until Step 3 creates the function
from src.services.validation import build_targets_payload


class TestBuildTargetsPayload:

    def test_uniform_reps_weight(self):
        state = {
            "scheme": "uniform", "num_sets": 3,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 135.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 3
        for entry in result:
            assert entry["set_kind"] == SetKind.REPS_WEIGHT
            assert entry["reps_min"] == 10
            assert entry["reps_max"] == 10
            assert entry["weight"] == 135.0

    def test_uniform_amrap_reps_weight(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": True, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 70.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 1
        assert result[0]["set_kind"] == SetKind.AMRAP
        assert result[0]["weight"] == 70.0
        assert "reps_min" not in result[0]
        assert "reps_max" not in result[0]

    def test_uniform_rep_range(self):
        state = {
            "scheme": "uniform", "num_sets": 3,
            "is_amrap": False, "use_rep_range": True,
            "uniform_reps": 8, "uniform_reps_max": 12,
            "uniform_weight": 100.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert result[0]["reps_min"] == 8
        assert result[0]["reps_max"] == 12

    def test_uniform_reps_only_amrap(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": True, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 0.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_ONLY)
        assert result[0]["set_kind"] == SetKind.AMRAP
        assert "reps_min" not in result[0]

    def test_uniform_time(self):
        state = {
            "scheme": "uniform", "num_sets": 2,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 8, "uniform_reps_max": 8,
            "uniform_weight": 0.0, "uniform_duration": 90, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.TIME)
        assert result[0]["set_kind"] == SetKind.DURATION
        assert result[0]["duration_seconds"] == 90

    def test_uniform_cardio(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 8, "uniform_reps_max": 8,
            "uniform_weight": 0.0, "uniform_duration": 1800, "uniform_distance": 5.0,
        }
        result = build_targets_payload(state, ExerciseType.CARDIO)
        assert result[0]["set_kind"] == SetKind.CARDIO
        assert result[0]["duration_seconds"] == 1800
        assert result[0]["distance"] == 5.0

    def test_progressive_mixed_amrap(self):
        """Spec-valid: 3x8 reps_weight + 1 AMRAP at end."""
        state = {
            "scheme": "progressive",
            "progressive_rows": [
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 0, "reps_max": 0, "weight": 70.0, "duration": 0, "distance": 0.0, "is_amrap": True},
            ],
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 4
        assert result[0]["set_kind"] == SetKind.REPS_WEIGHT
        assert result[0]["reps_min"] == 8
        assert result[3]["set_kind"] == SetKind.AMRAP
        assert result[3]["weight"] == 70.0
        assert "reps_min" not in result[3]

    def test_progressive_per_row_rep_range(self):
        """Progressive mode: per-row reps_min != reps_max."""
        state = {
            "scheme": "progressive",
            "progressive_rows": [
                {"reps": 10, "reps_max": 12, "weight": 50.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 6, "reps_max": 8, "weight": 70.0, "duration": 0, "distance": 0.0, "is_amrap": False},
            ],
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert result[0]["reps_min"] == 10
        assert result[0]["reps_max"] == 12
        assert result[1]["reps_min"] == 6
        assert result[1]["reps_max"] == 8

    def test_cardio_duration_only(self):
        """Cardio with duration but no distance."""
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 0, "uniform_reps_max": 0,
            "uniform_weight": 0.0, "uniform_duration": 1800, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.CARDIO)
        assert result[0]["duration_seconds"] == 1800
        assert result[0]["distance"] is None  # 0.0 → None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_target_payload.py -v
```
Expected: ImportError — `build_targets_payload` doesn't exist yet.

- [ ] **Step 3: Add `DEFAULT_SET_KIND` and `build_targets_payload` to `validation.py`**

In `src/services/validation.py`, add after the existing `validate_amrap_fields` function (line 39):

```python
# Default SetKind per ExerciseType (used by target editor payload builder)
DEFAULT_SET_KIND = {
    ExerciseType.REPS_WEIGHT: SetKind.REPS_WEIGHT,
    ExerciseType.REPS_ONLY: SetKind.REPS_ONLY,
    ExerciseType.TIME: SetKind.DURATION,
    ExerciseType.CARDIO: SetKind.CARDIO,
}


def build_targets_payload(state: dict, ex_type: ExerciseType) -> list:
    """Convert editor state to a list of target dicts for routine_service.

    Pure function — no side effects, no service calls. Testable independently.

    Args:
        state: Editor state dict with scheme, num_sets, is_amrap, use_rep_range,
               uniform_* fields, and progressive_rows.
        ex_type: The exercise's ExerciseType.

    Returns:
        List of dicts suitable for set_uniform_targets kwargs or
        set_progressive_targets targets_data.
    """
    default_kind = DEFAULT_SET_KIND.get(ex_type, SetKind.REPS_WEIGHT)

    def _build_entry(is_amrap, reps, reps_max, weight, duration, distance):
        set_kind = SetKind.AMRAP if is_amrap else default_kind
        entry = {"set_kind": set_kind}

        if ex_type == ExerciseType.REPS_WEIGHT:
            if not is_amrap:
                entry["reps_min"] = reps
                entry["reps_max"] = reps_max
            entry["weight"] = weight
        elif ex_type == ExerciseType.REPS_ONLY:
            if not is_amrap:
                entry["reps_min"] = reps
                entry["reps_max"] = reps_max
        elif ex_type == ExerciseType.TIME:
            entry["duration_seconds"] = duration
        elif ex_type == ExerciseType.CARDIO:
            entry["duration_seconds"] = duration or None
            entry["distance"] = distance or None

        return entry

    if state.get("scheme") == "uniform":
        is_amrap = state.get("is_amrap", False)
        reps = state.get("uniform_reps", 8)
        reps_max = state.get("uniform_reps_max", reps) if state.get("use_rep_range") else reps
        weight = state.get("uniform_weight", 0.0)
        duration = state.get("uniform_duration", 60)
        distance = state.get("uniform_distance", 0.0)

        entry = _build_entry(is_amrap, reps, reps_max, weight, duration, distance)
        return [dict(entry) for _ in range(state.get("num_sets", 3))]
    else:
        targets = []
        for row in state.get("progressive_rows", []):
            entry = _build_entry(
                is_amrap=row.get("is_amrap", False),
                reps=row.get("reps", 8),
                reps_max=row.get("reps_max", row.get("reps", 8)),
                weight=row.get("weight", 0.0),
                duration=row.get("duration", 60),
                distance=row.get("distance", 0.0),
            )
            targets.append(entry)
        return targets
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_target_payload.py -v --tb=short
```
Expected: All pass.

- [ ] **Step 5: Update `routine_editor_screen.py` to import from validation**

In `src/screens/manage/routine_editor_screen.py`:

Remove the `_DEFAULT_SET_KIND` dict (lines 27-32):
```python
_DEFAULT_SET_KIND = {
    ExerciseType.REPS_WEIGHT: SetKind.REPS_WEIGHT,
    ExerciseType.REPS_ONLY: SetKind.REPS_ONLY,
    ExerciseType.TIME: SetKind.DURATION,
    ExerciseType.CARDIO: SetKind.CARDIO,
}
```

Replace with an import from validation:
```python
from src.services.validation import DEFAULT_SET_KIND, build_targets_payload
```

Then find-and-replace `_DEFAULT_SET_KIND` → `DEFAULT_SET_KIND` throughout the file (it's used in the `on_save` closure and `_describe_target`). There should be ~2 remaining references after removing the dict definition.

- [ ] **Step 6: Verify — tests + compile**

```bash
pytest tests/test_target_payload.py tests/ -v --tb=short && python -m compileall src/screens/manage/routine_editor_screen.py -q
```
Expected: All tests pass. Compile clean.

- [ ] **Step 7: Commit**

```bash
git add src/services/validation.py src/screens/manage/routine_editor_screen.py tests/test_target_payload.py
git commit -m "feat: extract build_targets_payload into validation.py (no Kivy deps)"
```

---

### Task 4b: Target Editor UI — AMRAP Toggle + Rep Ranges + Per-Row Progressive

**Audit issues #3, #4 — UI half.** Wire the AMRAP and rep range toggles into the editor, using per-row state in progressive mode.

**Files:**
- Modify: `src/screens/manage/routine_editor_screen.py` (inside `_open_target_editor`, lines 745-1060)

- [ ] **Step 1: Update state dict and pre-fill**

Replace state dict (line 798) with:

```python
        state = {
            "num_sets": 3,
            "uniform_reps": 8,
            "uniform_reps_max": 8,
            "uniform_weight": 0.0,
            "uniform_duration": 60,
            "uniform_distance": 0.0,
            "progressive_rows": [],
            "is_amrap": False,
            "use_rep_range": False,
        }
```

Replace pre-fill block (lines 808-823) with:

```python
        if existing_targets:
            first = existing_targets[0]
            state["num_sets"] = len(existing_targets)
            state["is_amrap"] = first.set_kind == SetKind.AMRAP
            state["use_rep_range"] = (
                first.target_reps_min is not None
                and first.target_reps_max is not None
                and first.target_reps_min != first.target_reps_max
            )
            state["uniform_reps"] = first.target_reps_min or 8
            state["uniform_reps_max"] = first.target_reps_max or state["uniform_reps"]
            state["uniform_weight"] = first.target_weight or 0.0
            state["uniform_duration"] = first.target_duration_seconds or 60
            state["uniform_distance"] = first.target_distance or 0.0
            state["progressive_rows"] = [
                {
                    "reps": t.target_reps_min or 8,
                    "reps_max": t.target_reps_max or (t.target_reps_min or 8),
                    "weight": t.target_weight or 0.0,
                    "duration": t.target_duration_seconds or 60,
                    "distance": t.target_distance or 0.0,
                    "is_amrap": t.set_kind == SetKind.AMRAP,
                }
                for t in existing_targets
            ]
```

Update progressive rows seed (lines 826-831):

```python
        if not state["progressive_rows"]:
            state["progressive_rows"] = [
                {"reps": state["uniform_reps"], "reps_max": state["uniform_reps"],
                 "weight": state["uniform_weight"],
                 "duration": state["uniform_duration"], "distance": state["uniform_distance"],
                 "is_amrap": False}
                for _ in range(state["num_sets"])
            ]
```

- [ ] **Step 2: Add toggle rows in `_rebuild_content`**

In `_rebuild_content` (line 833), after button style updates (line 838), before the `if scheme_state` branch (line 840), add:

```python
            # AMRAP + rep range toggles (only for reps_weight / reps_only)
            supports_amrap = ex_type in (ExerciseType.REPS_WEIGHT, ExerciseType.REPS_ONLY)
            if supports_amrap and scheme_state["value"] == SetScheme.UNIFORM:
                toggle_row = MDBoxLayout(size_hint_y=None, height=dp(40), spacing=dp(8))

                amrap_btn = MDButton(
                    style="filled" if state["is_amrap"] else "outlined",
                    size_hint_x=None,
                )
                amrap_btn.add_widget(MDButtonText(text="AMRAP"))
                def toggle_amrap(*a):
                    state["is_amrap"] = not state["is_amrap"]
                    if state["is_amrap"]:
                        state["use_rep_range"] = False
                    _rebuild_content()
                amrap_btn.bind(on_release=toggle_amrap)
                toggle_row.add_widget(amrap_btn)

                if not state["is_amrap"]:
                    range_btn = MDButton(
                        style="filled" if state["use_rep_range"] else "outlined",
                        size_hint_x=None,
                    )
                    range_btn.add_widget(MDButtonText(text="Rep Range"))
                    def toggle_range(*a):
                        state["use_rep_range"] = not state["use_rep_range"]
                        if state["use_rep_range"] and state["uniform_reps_max"] == state["uniform_reps"]:
                            state["uniform_reps_max"] = state["uniform_reps"] + 4
                        _rebuild_content()
                    range_btn.bind(on_release=toggle_range)
                    toggle_row.add_widget(range_btn)

                content_box.add_widget(toggle_row)
```

- [ ] **Step 3: Modify `_build_uniform_content` for AMRAP and rep ranges**

Replace the reps_weight branch (lines 869-876):

```python
            if ex_type == ExerciseType.REPS_WEIGHT:
                if not state["is_amrap"]:
                    if state["use_rep_range"]:
                        min_s = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="min reps")
                        min_s.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                        box.add_widget(min_s)
                        max_s = ValueStepper(value=state["uniform_reps_max"], step=1, min_val=1, max_val=100, label="max reps")
                        max_s.bind(on_value_change=lambda inst, v: state.update({"uniform_reps_max": int(v)}))
                        box.add_widget(max_s)
                    else:
                        reps_stepper = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="reps")
                        reps_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                        box.add_widget(reps_stepper)

                weight_stepper = ValueStepper(value=state["uniform_weight"], step=2.5, min_val=0, max_val=999, label="kg/lbs", is_integer=False)
                weight_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_weight": v}))
                box.add_widget(weight_stepper)
```

Replace the reps_only branch (lines 878-881):

```python
            elif ex_type == ExerciseType.REPS_ONLY:
                if not state["is_amrap"]:
                    if state["use_rep_range"]:
                        min_s = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="min reps")
                        min_s.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                        box.add_widget(min_s)
                        max_s = ValueStepper(value=state["uniform_reps_max"], step=1, min_val=1, max_val=100, label="max reps")
                        max_s.bind(on_value_change=lambda inst, v: state.update({"uniform_reps_max": int(v)}))
                        box.add_widget(max_s)
                    else:
                        reps_stepper = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="reps")
                        reps_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                        box.add_widget(reps_stepper)
```

TIME and CARDIO branches stay unchanged.

- [ ] **Step 4: Update progressive rows for per-row AMRAP + min/max reps**

Replace the `_add_set_row` inner function's reps_weight branch (lines 922-929):

```python
                if ex_type == ExerciseType.REPS_WEIGHT:
                    if not row_data.get("is_amrap"):
                        min_s = ValueStepper(value=row_data["reps"], step=1, min_val=1, max_val=100, label="min")
                        min_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps": int(v)}))
                        row_box.add_widget(min_s)
                        max_s = ValueStepper(value=row_data.get("reps_max", row_data["reps"]), step=1, min_val=1, max_val=100, label="max")
                        max_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps_max": int(v)}))
                        row_box.add_widget(max_s)

                    weight_s = ValueStepper(value=row_data["weight"], step=2.5, min_val=0, max_val=999, label="wt", is_integer=False)
                    weight_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"weight": v}))
                    row_box.add_widget(weight_s)

                    # Per-row AMRAP toggle
                    amrap_btn = MDButton(
                        style="filled" if row_data.get("is_amrap") else "outlined",
                        size_hint_x=None,
                    )
                    amrap_btn.add_widget(MDButtonText(text="A"))
                    def _toggle_row_amrap(*a, r=row_ref):
                        r["is_amrap"] = not r.get("is_amrap", False)
                        _rebuild_content()
                    amrap_btn.bind(on_release=_toggle_row_amrap)
                    row_box.add_widget(amrap_btn)
```

Replace the reps_only branch (lines 931-934):

```python
                elif ex_type == ExerciseType.REPS_ONLY:
                    if not row_data.get("is_amrap"):
                        min_s = ValueStepper(value=row_data["reps"], step=1, min_val=1, max_val=100, label="min")
                        min_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps": int(v)}))
                        row_box.add_widget(min_s)
                        max_s = ValueStepper(value=row_data.get("reps_max", row_data["reps"]), step=1, min_val=1, max_val=100, label="max")
                        max_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps_max": int(v)}))
                        row_box.add_widget(max_s)

                    # Per-row AMRAP toggle
                    amrap_btn = MDButton(
                        style="filled" if row_data.get("is_amrap") else "outlined",
                        size_hint_x=None,
                    )
                    amrap_btn.add_widget(MDButtonText(text="A"))
                    def _toggle_row_amrap(*a, r=row_ref):
                        r["is_amrap"] = not r.get("is_amrap", False)
                        _rebuild_content()
                    amrap_btn.bind(on_release=_toggle_row_amrap)
                    row_box.add_widget(amrap_btn)
```

- [ ] **Step 5: Fix `on_add_set` fallback dict**

In `_build_progressive_content`, replace the `on_add_set` fallback (lines 964-965):

```python
                last = state["progressive_rows"][-1] if state["progressive_rows"] else {
                    "reps": 8, "weight": 0.0, "duration": 60, "distance": 0.0
                }
```

With:

```python
                last = state["progressive_rows"][-1] if state["progressive_rows"] else {
                    "reps": 8, "reps_max": 8, "weight": 0.0, "duration": 60, "distance": 0.0, "is_amrap": False,
                }
```

- [ ] **Step 6: Replace `on_save` with `build_targets_payload`**

Replace the entire save logic (lines 1006-1046) with:

```python
        def on_save(*a):
            error_label.text = ""
            new_scheme = scheme_state["value"]
            self.app.routine_service.update_day_exercise_scheme(rde.id, new_scheme)

            # Build state snapshot for the payload builder
            save_state = dict(state)
            save_state["scheme"] = new_scheme.value

            payload = build_targets_payload(save_state, ex_type)

            try:
                if new_scheme == SetScheme.UNIFORM:
                    # Uniform: all entries identical, pass first entry's fields
                    first = payload[0] if payload else {}
                    kwargs = {"rde_id": rde.id, "num_sets": len(payload), "set_kind": first.get("set_kind", SetKind.REPS_WEIGHT)}
                    for key in ("reps_min", "reps_max", "weight", "duration_seconds", "distance"):
                        if key in first:
                            kwargs[key] = first[key]
                    self.app.routine_service.set_uniform_targets(**kwargs)
                else:
                    self.app.routine_service.set_progressive_targets(rde.id, payload)
            except ValueError as e:
                error_label.text = str(e)
                return

            sheet.dismiss()
            self.build_content(container)
```

- [ ] **Step 7: Verify — compile + tests**

```bash
python -m compileall src/screens/manage/routine_editor_screen.py -q && pytest tests/ -v --tb=short
```
Expected: Compile clean. All tests pass, including the `test_target_payload.py` tests from Task 4a.

- [ ] **Step 8: Commit**

```bash
git add src/screens/manage/routine_editor_screen.py
git commit -m "feat: target editor supports per-row AMRAP and rep ranges in progressive mode"
```

---

### Task 5: Exercise-Type-Aware Stats + PRs

**Audit issue #8 — backend half.** Stats are weight-centric. Also: `get_recent_prs` filters on weight, excluding non-weight exercises.

**Cardio analytics rule:**
- Best set: prefer distance when >0, fall back to duration
- History: primary metric = distance when any row has it, else duration

**Files:**
- Modify: `tests/test_stats_service.py`
- Modify: `src/services/stats_service.py`

- [ ] **Step 1: Write tests for type-aware stats**

Add to `tests/test_stats_service.py`:

```python
class TestStatsServiceTypeAware:

    def _create_typed_session(self, workout_service, routine_service, make_exercise,
                              name, ex_type, set_kind, finish=True, **set_kwargs):
        routines = routine_service.list_routines()
        if routines:
            r = routines[0]
            days = routine_service.get_days(r.id)
            day = days[0]
        else:
            r = routine_service.create_routine("Test")
            day = routine_service.add_day(r.id, "A", "Push")
            routine_service.activate_routine(r.id)
        ex = make_exercise(name, type=ex_type)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        ls = workout_service.log_set(se.id, set_kind, **set_kwargs)
        if finish:
            workout_service.finish_session(session.id)
        return ex, session, se, ls

    def test_best_set_reps_only(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pullup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=15,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best is not None
        assert best["reps"] == 15
        assert best["exercise_type"] == "reps_only"

    def test_best_set_time(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Plank", ExerciseType.TIME, SetKind.DURATION, duration_seconds=120,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["duration_seconds"] == 120
        assert best["exercise_type"] == "time"

    def test_best_set_cardio_with_distance(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Treadmill", ExerciseType.CARDIO, SetKind.CARDIO,
            duration_seconds=1800, distance=5.0,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["distance"] == 5.0
        assert best["duration_seconds"] == 1800

    def test_best_set_cardio_duration_only(self, stats_service, workout_service, routine_service, make_exercise):
        """Cardio without distance falls back to duration as primary metric."""
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Bike", ExerciseType.CARDIO, SetKind.CARDIO,
            duration_seconds=2400,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["duration_seconds"] == 2400
        assert best.get("distance") is None or best.get("distance") == 0

    def test_history_reps_only(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pushup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=20,
        )
        history = stats_service.get_exercise_history(ex.id)
        assert len(history) == 1
        assert history[0]["max_reps"] == 20

    def test_history_time(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Wall Sit", ExerciseType.TIME, SetKind.DURATION, duration_seconds=90,
        )
        history = stats_service.get_exercise_history(ex.id)
        assert history[0]["max_duration"] == 90

    def test_recent_prs_includes_non_weight(self, stats_service, workout_service, routine_service, make_exercise):
        """PRs should include reps_only, time, and cardio exercises."""
        self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pullup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=20,
        )
        prs = stats_service.get_recent_prs(10)
        assert len(prs) >= 1
        pr = next(p for p in prs if p["exercise_name"] == "Pullup")
        assert pr["reps"] == 20
        assert pr["exercise_type"] == "reps_only"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_stats_service.py::TestStatsServiceTypeAware -v
```
Expected: FAIL

- [ ] **Step 3: Implement `get_exercise_history` (type-aware)**

Add to `StatsService` after `get_exercise_weight_history` (line 80):

```python
    def get_exercise_history(self, exercise_id: int) -> List[dict]:
        """Type-aware exercise history for charts.

        Returns list of dicts with session_date and type-appropriate metrics:
        - reps_weight: max_weight, total_volume
        - reps_only: max_reps, total_reps
        - time: max_duration
        - cardio: max_duration, max_distance
        """
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            return []

        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        from src.models.exercise import ExerciseType
        ex_type = exercise.type

        sessions = {}
        for row in rows:
            date = row["session_started_at"][:10]
            if date not in sessions:
                sessions[date] = {}
            d = sessions[date]

            if ex_type == ExerciseType.REPS_WEIGHT:
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                d["max_weight"] = max(d.get("max_weight", 0), w)
                d["total_volume"] = d.get("total_volume", 0) + w * r
            elif ex_type == ExerciseType.REPS_ONLY:
                r = row.get("reps") or 0
                d["max_reps"] = max(d.get("max_reps", 0), r)
                d["total_reps"] = d.get("total_reps", 0) + r
            elif ex_type == ExerciseType.TIME:
                dur = row.get("duration_seconds") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
            elif ex_type == ExerciseType.CARDIO:
                dur = row.get("duration_seconds") or 0
                dist = row.get("distance") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
                d["max_distance"] = max(d.get("max_distance", 0), dist)

        return [{"session_date": date, **data} for date, data in sorted(sessions.items())]
```

- [ ] **Step 4: Modify `get_exercise_best_set` to be type-aware**

Replace lines 82-97:

```python
    def get_exercise_best_set(self, exercise_id: int) -> Optional[dict]:
        """Type-aware best set for an exercise.

        Sorts by: reps_weight→weight, reps_only→reps, time→duration,
        cardio→distance (if any >0) else duration.
        """
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            return None
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        if not rows:
            return None

        from src.models.exercise import ExerciseType
        ex_type = exercise.type
        best = None

        for row in rows:
            date = row["session_started_at"][:10]
            if ex_type == ExerciseType.REPS_WEIGHT:
                val = row.get("weight") or 0
                if best is None or val > best.get("weight", 0):
                    best = {"weight": val, "reps": row.get("reps"), "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.REPS_ONLY:
                val = row.get("reps") or 0
                if best is None or val > best.get("reps", 0):
                    best = {"reps": val, "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.TIME:
                val = row.get("duration_seconds") or 0
                if best is None or val > best.get("duration_seconds", 0):
                    best = {"duration_seconds": val, "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.CARDIO:
                dist = row.get("distance") or 0
                dur = row.get("duration_seconds") or 0
                # Prefer distance when available, fall back to duration
                if dist > 0:
                    if best is None or dist > best.get("distance", 0):
                        best = {"distance": dist, "duration_seconds": dur, "session_date": date, "exercise_type": ex_type.value}
                else:
                    if best is None or dur > best.get("duration_seconds", 0):
                        best = {"duration_seconds": dur, "distance": None, "session_date": date, "exercise_type": ex_type.value}

        return best
```

- [ ] **Step 5: Fix `get_recent_prs` for all exercise types**

Replace lines 137-155:

```python
    def get_recent_prs(self, limit: int = 5) -> List[dict]:
        """Personal records across all exercise types, most recent first.

        Returns list of dicts: {exercise_name, exercise_type, session_date, ...type-specific fields}
        """
        exercises = self._exercise_repo.list_all()
        prs = []
        for ex in exercises:
            best = self.get_exercise_best_set(ex.id)
            if not best:
                continue
            # Skip if best is empty/zero-valued
            from src.models.exercise import ExerciseType
            ex_type = ex.type
            if ex_type == ExerciseType.REPS_WEIGHT and not best.get("weight"):
                continue
            if ex_type == ExerciseType.REPS_ONLY and not best.get("reps"):
                continue
            if ex_type == ExerciseType.TIME and not best.get("duration_seconds"):
                continue
            if ex_type == ExerciseType.CARDIO and not best.get("distance") and not best.get("duration_seconds"):
                continue

            entry = {"exercise_name": ex.name, **best}
            prs.append(entry)

        prs.sort(key=lambda x: x["session_date"], reverse=True)
        return prs[:limit]
```

- [ ] **Step 6: Run all stats tests**

```bash
pytest tests/test_stats_service.py -v --tb=short
```
Expected: All pass. Existing `test_exercise_best_set` still passes (reps_weight default path now includes `exercise_type` key).

- [ ] **Step 7: Commit**

```bash
git add src/services/stats_service.py tests/test_stats_service.py
git commit -m "feat: type-aware stats, best set, and PRs for all exercise types"
```

---

### Task 6: Exercise Detail + Dashboard — Type-Aware Rendering

**Audit issue #8 — UI half.** Exercise detail only renders weight/rep data. PvA table branches on exercise type but doesn't handle AMRAP set_kind.

**Files:**
- Modify: `src/screens/dashboard/exercise_detail_screen.py`
- Modify: `src/screens/dashboard/dashboard_screen.py` (PR section)

- [ ] **Step 1: Get exercise type in detail screen**

In `_build` (line 34), after `self.clear_widgets()` (line 35), add:

```python
        exercise = self.app.exercise_service.get_exercise(self.exercise_id)
        ex_type = exercise.type if exercise else None
        from src.models.exercise import ExerciseType
```

- [ ] **Step 2: Replace weight-centric charts with type-aware**

Replace lines 65-105 (history + charts) with:

```python
        history = self.app.stats_service.get_exercise_history(self.exercise_id)

        if not history:
            content.add_widget(Widget(size_hint_y=None, height=dp(48)))
            content.add_widget(MDLabel(
                text="No data yet", halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="large", adaptive_height=True,
            ))
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self.add_widget(layout)
            return

        dates = [d["session_date"] for d in history]

        if ex_type == ExerciseType.REPS_WEIGHT:
            content.add_widget(self._section_label("Weight Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_weight", 0) for d in history], ylabel="kg/lbs")
            content.add_widget(c1)
            content.add_widget(self._section_label("Volume Over Time"))
            c2 = ChartWidget()
            c2.plot_bar(dates, [d.get("total_volume", 0) for d in history], ylabel="Volume")
            content.add_widget(c2)
        elif ex_type == ExerciseType.REPS_ONLY:
            content.add_widget(self._section_label("Max Reps Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_reps", 0) for d in history], ylabel="Reps")
            content.add_widget(c1)
        elif ex_type == ExerciseType.TIME:
            content.add_widget(self._section_label("Max Duration Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_duration", 0) for d in history], ylabel="Seconds")
            content.add_widget(c1)
        elif ex_type == ExerciseType.CARDIO:
            has_distance = any(d.get("max_distance", 0) > 0 for d in history)
            if has_distance:
                content.add_widget(self._section_label("Max Distance Over Time"))
                c1 = ChartWidget()
                c1.plot_line(dates, [d.get("max_distance", 0) for d in history], ylabel="km")
                content.add_widget(c1)
            else:
                content.add_widget(self._section_label("Max Duration Over Time"))
                c1 = ChartWidget()
                c1.plot_line(dates, [d.get("max_duration", 0) for d in history], ylabel="Seconds")
                content.add_widget(c1)
```

- [ ] **Step 3: Replace personal best with type-aware**

Replace lines 107-136 with:

```python
        best = self.app.stats_service.get_exercise_best_set(self.exercise_id)
        if best:
            content.add_widget(self._section_label("Personal Best"))
            pb_card = MDBoxLayout(
                size_hint_y=None, height=dp(64), md_bg_color=SURFACE,
                padding=[dp(16), dp(8), dp(16), dp(8)], spacing=dp(8),
            )
            if ex_type == ExerciseType.REPS_WEIGHT:
                reps_text = f" \u00d7 {best['reps']} reps" if best.get("reps") else ""
                pb_text = f"{best.get('weight', 0)}{reps_text}"
            elif ex_type == ExerciseType.REPS_ONLY:
                pb_text = f"{best.get('reps', 0)} reps"
            elif ex_type == ExerciseType.TIME:
                secs = best.get("duration_seconds", 0)
                pb_text = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
            elif ex_type == ExerciseType.CARDIO:
                parts = []
                if best.get("distance"):
                    parts.append(f"{best['distance']} km")
                if best.get("duration_seconds"):
                    parts.append(f"{best['duration_seconds'] // 60}m")
                pb_text = " / ".join(parts) if parts else "\u2014"
            else:
                pb_text = "\u2014"
            pb_card.add_widget(MDLabel(
                text=pb_text, theme_text_color="Custom", text_color=PRIMARY,
                font_style="Headline", role="small", adaptive_height=True,
            ))
            pb_card.add_widget(MDLabel(
                text=best.get("session_date", ""), theme_text_color="Custom",
                text_color=TEXT_SECONDARY, font_style="Body", role="medium",
                adaptive_height=True, halign="right",
            ))
            content.add_widget(pb_card)
```

- [ ] **Step 4: Add `_section_label` helper**

Add before `_go_back`:

```python
    def _section_label(self, text):
        return MDLabel(
            text=text, theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large", adaptive_height=True,
        )
```

- [ ] **Step 5: Update PvA table to branch on `set_kind` per row**

Change `_build_pva_table` signature to accept `ex_type`:

```python
    def _build_pva_table(self, pva_rows, ex_type=None):
```

Update the call site (around line 147):

```python
            content.add_widget(self._build_pva_table(pva, ex_type))
```

Replace the data row formatting (lines 178-200) inside the `for row in pva_rows:` loop:

```python
            set_num = row.get("set_number", "?")
            row_kind = row.get("set_kind", "")

            # Format by set_kind (handles mixed progressive targets)
            if row_kind == "amrap":
                pw = row.get("planned_weight")
                planned_text = f"{pw} \u00d7 AMRAP" if pw is not None else "AMRAP"
                ar = row.get("actual_reps")
                aw = row.get("actual_weight")
                if aw is not None and ar is not None:
                    actual_text = f"{aw} \u00d7 {ar}"
                elif ar is not None:
                    actual_text = f"{ar} reps"
                else:
                    actual_text = "\u2014"
            elif row_kind in ("reps_weight", "reps_only"):
                pr_min = row.get("planned_reps_min")
                pr_max = row.get("planned_reps_max")
                pw = row.get("planned_weight")
                if pr_min is not None:
                    reps_str = f"{pr_min}" if pr_min == pr_max else f"{pr_min}-{pr_max}"
                    planned_text = f"{pw} \u00d7 {reps_str}" if pw is not None else reps_str
                else:
                    planned_text = "\u2014"
                ar = row.get("actual_reps")
                aw = row.get("actual_weight")
                if aw is not None and ar is not None:
                    actual_text = f"{aw} \u00d7 {ar}"
                elif ar is not None:
                    actual_text = str(ar)
                else:
                    actual_text = "\u2014"
            elif row_kind == "duration":
                pd = row.get("planned_duration")
                planned_text = f"{pd}s" if pd is not None else "\u2014"
                ad = row.get("actual_duration")
                actual_text = f"{ad}s" if ad is not None else "\u2014"
            elif row_kind == "cardio":
                parts_p, parts_a = [], []
                if row.get("planned_duration") is not None:
                    parts_p.append(f"{row['planned_duration']}s")
                if row.get("planned_distance") is not None:
                    parts_p.append(f"{row['planned_distance']}km")
                planned_text = " / ".join(parts_p) if parts_p else "\u2014"
                if row.get("actual_duration") is not None:
                    parts_a.append(f"{row['actual_duration']}s")
                if row.get("actual_distance") is not None:
                    parts_a.append(f"{row['actual_distance']}km")
                actual_text = " / ".join(parts_a) if parts_a else "\u2014"
            else:
                planned_text = "\u2014"
                actual_text = "\u2014"
```

- [ ] **Step 6: Update dashboard PR section for type-aware formatting**

In `src/screens/dashboard/dashboard_screen.py`, the PR rendering (around line 136-150) currently formats as `weight×reps`. Update to handle all types.

Replace the PR text formatting inside the `for pr in prs:` loop:

```python
            for pr in prs:
                pr_row = MDBoxLayout(
                    size_hint_y=None, height=dp(40),
                    md_bg_color=SURFACE,
                    padding=[dp(12), 0, dp(12), 0],
                )
                et = pr.get("exercise_type", "reps_weight")
                if et == "reps_weight":
                    reps_text = f"\u00d7{pr['reps']}" if pr.get("reps") else ""
                    val_text = f"{pr.get('weight', 0)}{reps_text}"
                elif et == "reps_only":
                    val_text = f"{pr.get('reps', 0)} reps"
                elif et == "time":
                    secs = pr.get("duration_seconds", 0)
                    val_text = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
                elif et == "cardio":
                    parts = []
                    if pr.get("distance"):
                        parts.append(f"{pr['distance']}km")
                    if pr.get("duration_seconds"):
                        parts.append(f"{pr['duration_seconds'] // 60}m")
                    val_text = " / ".join(parts) if parts else "\u2014"
                else:
                    val_text = "\u2014"

                pr_text = f"{pr['exercise_name']} \u2014 {val_text} \u2014 {pr['session_date']}"
                pr_row.add_widget(MDLabel(
                    text=pr_text,
                    theme_text_color="Custom", text_color=TEXT_PRIMARY,
                    font_style="Body", role="medium", adaptive_height=True,
                ))
                content.add_widget(pr_row)
```

- [ ] **Step 7: Verify**

```bash
python -m compileall src/screens/dashboard/ -q && pytest tests/ -v --tb=short
```

- [ ] **Step 8: Commit**

```bash
git add src/screens/dashboard/exercise_detail_screen.py src/screens/dashboard/dashboard_screen.py
git commit -m "feat: exercise detail and dashboard PRs render all exercise types correctly"
```

---

## Verification Checkpoint

After all tasks:

```bash
pytest tests/ -v --tb=short && python -m compileall src -q
```

Expected: All tests pass (169 existing + ~15 new). All source files compile.

### Manual Smoke Test Checklist

- [ ] **Export with benchmarks:** Export a routine with benchmark definitions. JSON has `"benchmarking"` section. `frequency_weeks` matches items.
- [ ] **Import preview benchmarks:** Paste export with benchmarks. Preview shows "Benchmarks: N definition(s)."
- [ ] **Round-trip:** Export → import. Benchmarks preserved.
- [ ] **Benchmark reference weight:** Create max_reps benchmark with reference weight. List row shows "Max Reps at 100 · every 6w". Edit — value pre-filled.
- [ ] **Uniform AMRAP:** reps_weight exercise → edit targets → tap "AMRAP". Reps stepper disappears, weight stays. Save. Reopen — AMRAP pre-selected.
- [ ] **Uniform rep range:** AMRAP off → tap "Rep Range". Two steppers (min/max). Set 8-12. Save. Reopen — 8 and 12 pre-filled.
- [ ] **Progressive mixed AMRAP:** Progressive mode. 3 rows. Toggle "A" on row 4. Row 4 hides reps steppers. Save. Reopen — row 4 is AMRAP, rows 1-3 are normal.
- [ ] **Progressive per-row reps:** Each progressive row shows min/max steppers. Set different ranges per row.
- [ ] **Detail reps_only:** Log a reps_only exercise. Dashboard → detail. "Max Reps Over Time" chart. Best: "15 reps".
- [ ] **Detail time:** Log time exercise. "Max Duration Over Time" chart. Best: "2m 0s".
- [ ] **Detail cardio with distance:** "Max Distance Over Time" chart. Best: "5.0 km / 30m".
- [ ] **Detail cardio duration-only:** "Max Duration Over Time" chart (no distance chart).
- [ ] **Dashboard PRs:** Log different exercise types. PR section shows type-appropriate values.
- [ ] **PvA with AMRAP:** Log against a plan with AMRAP target. PvA shows "70 × AMRAP" for planned.

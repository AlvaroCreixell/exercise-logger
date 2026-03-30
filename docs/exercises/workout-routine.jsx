import { useState } from "react";

const routineData = {
  overview: {
    structure: "3 Full-Body Workouts (A / B / C) — Continuous Rotation",
    duration: "~50 min per session (before cardio)",
    frequency: "3×/week, occasionally 4. Keep rotating A→B→C→A→B→C regardless of days per week.",
    rest: "60–90s between sets. Superset where noted to save time.",
  },
  days: [
    {
      id: "A",
      label: "Workout A",
      accent: "#D4533B",
      emphasis: "Heavy Squat + Horizontal Push/Pull",
      blocks: [
        {
          title: "Legs — Heavy",
          exercises: [
            { name: "Barbell Back Squat", sets: "1×5 + 3×8–12", notes: "Warm up with 2 lighter sets. Top set of 5, then drop 10–15% for back-off sets" },
            { name: "Leg Curl (machine)", sets: "2×8–12", notes: "Slow eccentric, 2–3 sec" },
            { name: "Adductor Machine", sets: "3×12–15", notes: "Squeeze and hold 1 sec at close" },
          ],
        },
        {
          title: "Upper Push + Pull",
          exercises: [
            { name: "Dumbbell Bench Press", sets: "3×8–12", notes: "Superset with rows" },
            { name: "One-Arm Dumbbell Row", sets: "3×8–12 each", notes: "" },
            { name: "Tricep Pushdown (cable)", sets: "2×8–12", notes: "" },
          ],
        },
        {
          title: "Core",
          exercises: [
            { name: "Pallof Press w/ Rotation", sets: "3×8–12 each side", notes: "Slow and controlled rotation at full extension" },
          ],
        },
      ],
    },
    {
      id: "B",
      label: "Workout B",
      accent: "#3B7DD4",
      emphasis: "Moderate Hinge + Vertical Push/Pull",
      blocks: [
        {
          title: "Legs — Moderate",
          exercises: [
            { name: "Romanian Deadlift (dumbbells)", sets: "1×6 + 2×8–12", notes: "Top set of 6, then drop weight for back-off sets" },
            { name: "Walking Lunges (dumbbells)", sets: "3×8–12 each leg", notes: "Moderate weight, control the step" },
            { name: "Leg Extension (machine)", sets: "2×8–12", notes: "Squeeze at top, 1 sec hold" },
          ],
        },
        {
          title: "Upper Push + Pull",
          exercises: [
            { name: "Dumbbell Overhead Press", sets: "3×8–12", notes: "Seated or standing. Superset with pulldowns" },
            { name: "Lat Pulldown", sets: "3×8–12", notes: "" },
            { name: "Dumbbell Curl", sets: "2×8–12", notes: "Dumbbell or EZ bar, your pick" },
          ],
        },
        {
          title: "Core + Finisher",
          exercises: [
            { name: "Cable Woodchop", sets: "3×8–12 each side", notes: "Alternate high-to-low / low-to-high weekly" },
            { name: "Wrist Roller", sets: "2 × up and down", notes: "One set rolling up (flexion), one rolling down (extension)" },
          ],
        },
      ],
    },
    {
      id: "C",
      label: "Workout C",
      accent: "#3BAD6B",
      emphasis: "Unilateral + Accessories",
      blocks: [
        {
          title: "Legs — Lighter / Unilateral",
          exercises: [
            { name: "Single-Leg Romanian Deadlift (dumbbell)", sets: "3×8–12 each leg", notes: "Hold DB opposite to working leg" },
            { name: "Reverse Lunges (dumbbells)", sets: "3×8–12 each leg", notes: "" },
            { name: "Adductor Machine", sets: "3×12–15", notes: "" },
          ],
        },
        {
          title: "Upper Push + Pull",
          exercises: [
            { name: "Incline Dumbbell Press", sets: "3×8–12", notes: "30–45° incline. Superset with cable rows" },
            { name: "Cable Row (seated)", sets: "3×8–12", notes: "" },
            { name: "Dumbbell Pullover", sets: "2×8–12", notes: "Slight elbow bend, stretch at bottom" },
          ],
        },
        {
          title: "Core",
          exercises: [
            { name: "Medicine Ball Rotational Slam", sets: "3×8 each side", notes: "Explosive rotational power" },
          ],
        },
      ],
    },
  ],
  cardio: {
    title: "Cardio (after lifting, or separate session)",
    options: [
      { name: "Walk", detail: "20–30 min at a brisk pace" },
      { name: "Rowing 2K Sprints", detail: "3 × 2K with 3–4 min rest between" },
      { name: "Mix", detail: "1–2 rowing sprints + 10–15 min walk to cool down" },
    ],
  },
  notes: [
    "Rotation is continuous: if you train Mon/Wed/Fri one week doing A/B/C, the next week starts with A again. If you add a 4th day, you just keep going — that week might be A/B/C/A, then next week picks up at B.",
    "Supersets are paired to save time — rest after completing both exercises, not between them.",
    "Top sets: Squat (Day A) and RDL (Day B) start with one heavier set at lower reps, then back off for volume. This builds strength without grinding every set heavy.",
    "Leg intensity is staggered: A is heavy (squat), B is moderate (RDL + lunges), C is lighter/unilateral. This manages fatigue across the rotation, especially if you're rowing on some of those days.",
    "Core is one movement per session, rotated: Pallof press (stability) → Woodchop (rotational power) → Med ball slams (explosive rotation).",
    "Progression: all working sets use 8–12 reps (exceptions: top sets, adductors, med ball slams, wrist roller). Start at 8, work up to 12 across all sets, then increase weight and reset to 8.",
    "Adductors appear twice in the rotation (A and C) given their importance for riding.",
    "Watch for hamstring/lower back fatigue if stacking rowing sprints with RDL or single-leg RDL days. If things feel tight, dial back RDL volume that session.",
  ],
};

export default function WorkoutRoutine() {
  const [activeDay, setActiveDay] = useState("A");
  const [expandedCardio, setExpandedCardio] = useState(false);

  const currentDay = routineData.days.find((d) => d.id === activeDay);

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: "#0E0E10",
      color: "#E8E6E1",
      minHeight: "100vh",
      padding: "24px 16px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#666", textTransform: "uppercase", marginBottom: 6 }}>
          Full Body — 3-Day Rotation
        </div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: "#fff",
          margin: 0,
          lineHeight: 1.2,
        }}>
          Workout Program
        </h1>
        <div style={{ fontSize: 11, color: "#777", marginTop: 6 }}>
          ~50 min per session · Rotate A→B→C continuously
        </div>
      </div>

      {/* Day Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {routineData.days.map((day) => (
          <button
            key={day.id}
            onClick={() => setActiveDay(day.id)}
            style={{
              flex: 1,
              padding: "12px 8px",
              background: activeDay === day.id ? day.accent + "18" : "#161618",
              border: `1px solid ${activeDay === day.id ? day.accent + "66" : "#222"}`,
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              color: activeDay === day.id ? day.accent : "#555",
              fontFamily: "inherit",
            }}>
              {day.id}
            </span>
            <span style={{
              fontSize: 8,
              letterSpacing: 1.5,
              color: activeDay === day.id ? "#aaa" : "#444",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}>
              {day.emphasis.split(" + ")[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Day Emphasis */}
      <div style={{
        padding: "10px 14px",
        background: currentDay.accent + "10",
        border: `1px solid ${currentDay.accent}22`,
        borderRadius: 6,
        marginBottom: 20,
        fontSize: 11,
        color: currentDay.accent,
        letterSpacing: 0.5,
      }}>
        Emphasis: {currentDay.emphasis}
      </div>

      {/* Exercise Blocks */}
      {currentDay.blocks.map((block, bi) => (
        <div key={bi} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 9,
            letterSpacing: 3,
            color: "#555",
            textTransform: "uppercase",
            marginBottom: 10,
            paddingLeft: 2,
          }}>
            {block.title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {block.exercises.map((ex, ei) => (
              <div
                key={ei}
                style={{
                  padding: "12px 14px",
                  background: "#161618",
                  borderRadius: 6,
                  border: "1px solid #1E1E22",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#E8E6E1", lineHeight: 1.3, flex: 1 }}>
                    {ex.name}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: currentDay.accent,
                    whiteSpace: "nowrap",
                    marginLeft: 12,
                    fontFamily: "inherit",
                  }}>
                    {ex.sets}
                  </span>
                </div>
                {ex.notes && (
                  <span style={{ fontSize: 10, color: "#666", lineHeight: 1.4 }}>
                    {ex.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Cardio */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setExpandedCardio(!expandedCardio)}
          style={{
            width: "100%",
            padding: "14px",
            background: "#161618",
            border: "1px solid #1E1E22",
            borderRadius: expandedCardio ? "6px 6px 0 0" : 6,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 9, letterSpacing: 3, color: "#555", textTransform: "uppercase" }}>
            Cardio Options
          </span>
          <span style={{ fontSize: 14, color: "#444", transform: expandedCardio ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            ▾
          </span>
        </button>
        {expandedCardio && (
          <div style={{
            padding: "12px 14px",
            background: "#131315",
            border: "1px solid #1E1E22",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {routineData.cardio.options.map((opt, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#ccc" }}>{opt.name}</span>
                <span style={{ fontSize: 10, color: "#666" }}>{opt.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{
        padding: "16px 14px",
        background: "#131315",
        borderRadius: 6,
        border: "1px solid #1A1A1E",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", textTransform: "uppercase", marginBottom: 12 }}>
          Notes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {routineData.notes.map((note, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, color: "#333", flexShrink: 0, lineHeight: 1.5 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>
                {note}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

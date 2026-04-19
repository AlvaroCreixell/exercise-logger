// Exercise Logger — seed data

const ROUTINE = {
  name: 'Full Body 3-Day Rotation',
  dayOrder: ['A', 'B', 'C'],
  nextDayId: 'A',
  restDefaultSec: 90,
  days: {
    A: {
      label: 'Heavy Squat + Horizontal Push/Pull',
      shortLabel: 'Squat day',
      totalExercises: 7,
      totalSets: 18,
      bodyParts: [
        { name: 'Quads', primary: true },
        { name: 'Chest', primary: true },
        { name: 'Back', primary: true },
        { name: 'Hamstrings' },
        { name: 'Triceps' },
        { name: 'Core' },
      ],
      entries: [
        { kind: 'exercise', name: 'Barbell Back Squat' },
        { kind: 'exercise', name: 'Leg Curl' },
        { kind: 'exercise', name: 'Adductor Machine' },
        { kind: 'superset', items: [{ name: 'Dumbbell Bench Press' }, { name: 'Dumbbell Row' }] },
        { kind: 'exercise', name: 'Tricep Pushdown' },
        { kind: 'exercise', name: 'Pallof Press' },
      ],
    },
    B: {
      label: 'Moderate Hinge + Vertical Push/Pull',
      shortLabel: 'Hinge day',
      totalExercises: 7,
      totalSets: 17,
      bodyParts: [
        { name: 'Hamstrings', primary: true },
        { name: 'Glutes', primary: true },
        { name: 'Shoulders', primary: true },
        { name: 'Back' },
        { name: 'Biceps' },
        { name: 'Core' },
      ],
      entries: [],
    },
    C: {
      label: 'Unilateral + Accessories',
      shortLabel: 'Unilateral',
      totalExercises: 6,
      totalSets: 15,
      bodyParts: [
        { name: 'Legs', primary: true },
        { name: 'Chest', primary: true },
        { name: 'Back' },
        { name: 'Core' },
      ],
      entries: [],
    },
  },
};

// Active session state — mid-workout snapshot of Day A
const ACTIVE_EXERCISES = [
  {
    id: 'squat',
    kind: 'exercise',
    name: 'Barbell Back Squat',
    target: '3 × 8–12 · 1 × 12–16 top',
    unit: 'kg',
    lastTime: '85kg × 10 · 85kg × 9 · 85kg × 8',
    done: 2,
    sets: [
      { tag: 'top', weight: 70, reps: 14, done: true, prev: '70×12' },
      { weight: 85, reps: 10, done: true, progression: 'up', prev: '82.5×10' },
      { weight: null, reps: null, prev: '85×9' },
      { weight: null, reps: null, prev: '85×8' },
    ],
  },
  {
    id: 'leg-curl',
    kind: 'exercise',
    name: 'Leg Curl',
    target: '2 × 8–12',
    unit: 'kg',
    lastTime: '45kg × 10 · 45kg × 9',
    done: 0,
    sets: [
      { weight: null, reps: null, prev: '45×10' },
      { weight: null, reps: null, prev: '45×9' },
    ],
  },
  {
    id: 'adductor',
    kind: 'exercise',
    name: 'Adductor Machine',
    target: '3 × 12–15',
    unit: 'lb',
    lastTime: '120lb × 15 · 120lb × 13 · 120lb × 12',
    done: 0,
    sets: [
      { weight: null, reps: null, prev: '55×15' },
      { weight: null, reps: null, prev: '55×13' },
      { weight: null, reps: null, prev: '55×12' },
    ],
  },
  {
    id: 'ss-1',
    kind: 'superset',
    items: [
      {
        name: 'Dumbbell Bench Press',
        target: '3 × 8–12',
        unit: 'lb',
        done: 0,
        sets: [
          { weight: null, reps: null, prev: '55×10' },
          { weight: null, reps: null, prev: '55×9' },
          { weight: null, reps: null, prev: '55×8' },
        ],
      },
      {
        name: 'Dumbbell Row',
        target: '3 × 8–12 · each arm',
        unit: 'lb',
        done: 0,
        sets: [
          { weight: null, reps: null, prev: '60×10' },
          { weight: null, reps: null, prev: '60×10' },
          { weight: null, reps: null, prev: '60×9' },
        ],
      },
    ],
  },
  {
    id: 'tricep',
    kind: 'exercise',
    name: 'Tricep Pushdown',
    target: '2 × 8–12',
    unit: 'kg',
    lastTime: '30kg × 12 · 30kg × 10',
    done: 0,
    sets: [
      { weight: null, reps: null, prev: '30×12' },
      { weight: null, reps: null, prev: '30×10' },
    ],
  },
  {
    id: 'pallof',
    kind: 'exercise',
    name: 'Pallof Press',
    target: '3 × 8–12 · each side',
    unit: 'kg',
    done: 0,
    sets: [
      { weight: null, reps: null, prev: '15×10' },
      { weight: null, reps: null, prev: '15×10' },
      { weight: null, reps: null, prev: '15×9' },
    ],
  },
];

const CATALOG = [
  { id: 'bb-squat', name: 'Barbell Back Squat', type: 'Weight', muscle: 'Legs' },
  { id: 'front-squat', name: 'Front Squat', type: 'Weight', muscle: 'Legs' },
  { id: 'deadlift', name: 'Deadlift', type: 'Weight', muscle: 'Back · Legs' },
  { id: 'bench', name: 'Barbell Bench Press', type: 'Weight', muscle: 'Chest' },
  { id: 'ohp', name: 'Overhead Press', type: 'Weight', muscle: 'Shoulders' },
  { id: 'pullup', name: 'Pull-up', type: 'Bodyweight', muscle: 'Back' },
  { id: 'dip', name: 'Dip', type: 'Bodyweight', muscle: 'Chest · Triceps' },
  { id: 'plank', name: 'Plank', type: 'Isometric', muscle: 'Core' },
  { id: 'row', name: 'Rowing 2K', type: 'Cardio', muscle: 'Full body' },
  { id: 'face-pull', name: 'Face Pull', type: 'Weight', muscle: 'Shoulders' },
];

const HISTORY = [
  {
    id: 'h1', month: 'April 2026', mon: 'APR', day: '17',
    label: 'Moderate Hinge + Vertical Push/Pull',
    duration: '52m', sets: 17, volume: '8,240 kg',
    exercises: [
      { name: 'Dumbbell Romanian Deadlift', sets: [{ weight: 30, reps: 14 }, { weight: 32, reps: 11 }, { weight: 32, reps: 10 }] },
      { name: 'Dumbbell Lunge', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 11 }, { weight: 20, reps: 10 }] },
      { name: 'Leg Extension', sets: [{ weight: 50, reps: 12 }, { weight: 50, reps: 10 }] },
      { name: 'DB Shoulder Press ↔ Lat Pulldown', sets: [{ weight: 18, reps: 10 }, { weight: 18, reps: 9 }, { weight: 18, reps: 8 }] },
    ],
  },
  {
    id: 'h2', month: 'April 2026', mon: 'APR', day: '15',
    label: 'Heavy Squat + Horizontal Push/Pull',
    duration: '58m', sets: 18, volume: '9,120 kg',
    exercises: [
      { name: 'Barbell Back Squat', sets: [{ weight: 70, reps: 14 }, { weight: 82.5, reps: 10 }, { weight: 85, reps: 9 }, { weight: 85, reps: 8 }] },
    ],
  },
  {
    id: 'h3', month: 'April 2026', mon: 'APR', day: '13',
    label: 'Unilateral + Accessories',
    duration: '46m', sets: 15, volume: '6,480 kg',
    exercises: [],
  },
  {
    id: 'h4', month: 'April 2026', mon: 'APR', day: '10',
    label: 'Moderate Hinge + Vertical Push/Pull',
    duration: '55m', sets: 17, volume: '8,100 kg',
    exercises: [],
  },
  {
    id: 'h5', month: 'March 2026', mon: 'MAR', day: '29',
    label: 'Heavy Squat + Horizontal Push/Pull',
    duration: '62m', sets: 18, volume: '8,920 kg',
    exercises: [],
  },
  {
    id: 'h6', month: 'March 2026', mon: 'MAR', day: '27',
    label: 'Unilateral + Accessories',
    duration: '44m', sets: 15, volume: '6,210 kg',
    exercises: [],
  },
];

const LAST_SESSION = {
  label: 'Unilateral + Accessories',
  relative: '2 days ago',
  stats: [
    { v: '46', l: 'min' },
    { v: '15', l: 'sets' },
    { v: '6.5k', l: 'kg' },
  ],
};

Object.assign(window, { ROUTINE, ACTIVE_EXERCISES, CATALOG, HISTORY, LAST_SESSION });

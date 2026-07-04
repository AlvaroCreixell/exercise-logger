# OpenAI-Native Exercise Logger Rebuild Spec

Status: planning/spec document  
Date: 2026-05-05  
Author: Codex repo analysis  
Target audience: a fresh Codex run tasked with one-shotting a stronger version of this app

## 1. Purpose

This document captures what the current Exercise Logger app does, what it is trying to become, and the spec for a better implementation that removes the current questionnaire -> generated prompt -> external Custom GPT -> YAML copy/paste workflow.

The next version should keep the best parts of the current app:

- local-first workout logging
- fast phone-first set entry
- structured routine schema
- exercise catalog validation
- session snapshots
- progression suggestions
- offline workout access
- export/import ownership of user data

But routine generation should happen natively inside the app through the OpenAI API. The user should answer the same or similar onboarding questions, tap a generate button, review a routine draft, and import or activate it without leaving the app.

## 2. Current Repo Analysis

### 2.1 Repository shape

The active app lives in `web/`.

Current stack:

- React 19
- TypeScript 5
- Vite 7
- React Router 7
- Dexie 4 over IndexedDB
- dexie-react-hooks for live local data
- shadcn/ui plus Tailwind CSS 4
- vite-plugin-pwa for install/offline behavior
- Vitest, React Testing Library, fake-indexeddb, Playwright

Current architecture is documented as:

```text
Features -> Hooks -> Services -> Dexie
```

Important files:

- `web/src/app/App.tsx`: routes, shell, first-run guards.
- `web/src/db/database.ts`: Dexie database, migrations, default settings.
- `web/src/domain/types.ts`: Exercise, Routine, Session, SessionExercise, LoggedSet, Settings.
- `web/src/services/routine-service.ts`: YAML parsing, routine validation, import/activate.
- `web/src/services/session-service.ts`: start, resume, finish, discard, add extra exercise.
- `web/src/services/set-service.ts`: log, edit, delete sets.
- `web/src/services/progression-service.ts`: last-time matching and weight suggestions.
- `web/src/services/backup-service.ts`: JSON backup export/import validation.
- `web/src/features/onboarding/`: questionnaire and Custom GPT handoff.
- `docs/custom-gpt/`: current external GPT instructions and YAML contract.

The active source inventory is roughly:

- 159 source files under `web/src`
- 113 test files under `web/tests`
- 89 exercise rows in `web/src/data/catalog.csv`

### 2.2 What the app does today

Exercise Logger is a single-user local-first progressive web app for gym workout logging.

Core flows:

1. App initializes local settings.
2. App seeds the exercise catalog from CSV.
3. If no routine exists, app seeds `web/data/routines/full-body-3day.yaml` and activates it.
4. Today screen shows the next routine day and a start-workout CTA.
5. Starting a workout creates a session and snapshots every routine exercise into `sessionExercises`.
6. Workout screen renders exercise cards, set slots, supersets, extras, last-time hints, progression suggestions, and a set-log bottom sheet.
7. Logging a set persists one `LoggedSet` per `(sessionExerciseId, blockIndex, setIndex)`.
8. Finishing a session marks it finished and advances the source routine rotation.
9. History lists finished sessions, session details, and per-exercise history.
10. Settings supports routines, active routine selection, YAML routine import, JSON backup export/import, units, app install, clear data, and profile name.

Important current behaviors:

- Workouts are fully local and continue offline after assets are cached.
- Sessions snapshot routine and exercise data so history survives routine deletion.
- One active workout is allowed at a time.
- Routine activation, deletion, import, backup import, and clear-all are blocked while a workout is active.
- The app stores canonical weights in kg and displays kg or lbs.
- Per-exercise unit override is stored on `SessionExercise.unitOverride`.
- Weighted bodyweight movements can be promoted to weight-based during an active session.
- Progression is per set block, not per exercise.
- Extras can be logged, but they do not feed routine progression.
- YAML imports are strict and field-specific.
- Backup import is versioned and transactional.

### 2.3 Current routine generation flow

The current personalized-routine flow is implemented under `features/onboarding`.

It asks 11 intake topics:

1. Primary goal
2. Experience level
3. Injuries, pain, or restrictions
4. Days per week
5. Session length
6. Number of distinct training days
7. Equipment
8. Muscle priorities
9. Favorite exercises and exercises to avoid
10. Superset preference
11. Cardio preference

The app then builds a prompt with `buildPrompt(answers)`.

Current handoff:

1. User completes questionnaire.
2. App builds and saves a text prompt.
3. App copies the prompt to clipboard.
4. App opens an external Custom GPT URL.
5. User pastes the prompt into ChatGPT.
6. Custom GPT generates YAML.
7. User copies YAML.
8. User returns to the app.
9. User pastes YAML into the app.
10. App validates and imports the routine.

This workflow is clunky because it crosses app boundaries, depends on clipboard reliability, depends on a separate Custom GPT, and treats YAML as a manual transport layer.

### 2.4 Current strengths to preserve

Preserve these exactly or improve them conservatively:

- Local-first architecture for workout data.
- No account requirement for normal logging.
- Phone-first fast logging.
- Existing routine schema concepts: days, entries, supersets, set blocks, notes, cardio.
- Closed exercise catalog with canonical `exercise_id` values.
- Strict routine validation with field-specific errors.
- Session snapshots.
- Per-block progression and last-time display.
- JSON backup ownership.
- PWA install/offline behavior.
- High test coverage and fake-indexeddb service tests.

### 2.5 Current weaknesses the rebuild should fix

Product gaps:

- Personalized routine generation leaves the app.
- A user can end on a paste-only recovery screen without seeing the saved prompt.
- First-run starts with the questionnaire/name flow instead of making the ready starter routine obvious.
- Today does not always make the active routine name obvious.
- Workout screen still lacks the intended rest-timer/superset rhythm.
- There is no native "regenerate this routine with changes" workflow.
- There is no routine preview/approval screen before activation.

Architecture gaps:

- YAML is the only generation transport, even though in-app AI should use structured JSON.
- Prompt and GPT docs are external artifacts that can drift from code.
- The current static GitHub Pages deployment cannot safely call OpenAI directly from browser code.
- AI generation has no API-side validation/repair loop.
- There is no persisted generation history or draft state.

## 3. Product Vision

Exercise Logger should be an offline-capable, local-first gym training app with native AI-assisted routine creation.

The user experience should be:

```text
Open app -> choose starter or personalized -> answer concise questions -> generate routine -> review -> activate -> train
```

No Custom GPT visit. No manual prompt copy. No YAML paste for the normal path.

YAML should remain available for power users and backups, but not as the primary AI workflow.

## 4. Product Principles

1. Local-first for workout data.
   Workout history, routines, settings, and active sessions live in IndexedDB and remain usable offline.

2. Server only for AI generation.
   The only required network path is generating or repairing a routine through the OpenAI API. Workout logging must not depend on network.

3. Never expose the OpenAI API key to the browser.
   Current official OpenAI help explicitly says API keys should not be deployed in client-side environments like browsers or mobile apps, and requests should route through a backend server where the key can be kept secure:
   https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

4. Structured output, not prompt theater.
   The model should produce schema-constrained JSON that the app validates. OpenAI docs recommend Structured Outputs for matching a supplied JSON Schema:
   https://developers.openai.com/api/docs/guides/structured-outputs

5. Validate twice.
   Validate on the API server before returning a draft, then validate again in the client before importing.

6. User remains in control.
   Show assumptions, substitutions, warnings, and a routine preview before activation.

7. Fitness safety is conservative.
   The model must not diagnose injuries or override medical advice. Serious restrictions should produce conservative substitutions and a consult-professional warning.

8. Preserve data ownership.
   Continue to support JSON backups and YAML export/import.

## 5. Target Users

Primary user:

- Individual lifter using the app during workouts on a phone.
- Wants a sensible routine without becoming a programmer or prompt engineer.
- Values fast set logging more than analytics dashboards.
- May train at home, in a commercial gym, or with limited equipment.

Secondary user:

- Power user comfortable editing YAML.
- Wants to import/export routines and backups.
- May regenerate routines periodically as goals/equipment change.

## 6. Non-Goals

Do not build these in the first OpenAI-native version:

- Social sharing.
- Coach collaboration.
- Accounts for normal logging.
- Cloud sync.
- Multi-device conflict resolution.
- Wearable companion.
- Full routine editor with drag/drop programming.
- Charts dashboard.
- Nutrition planning.
- Medical diagnosis.
- AI coaching overlay during every set.

Accounts may become necessary later for billing, sync, or abuse control, but the core local logging app should not require them.

## 7. Target User Flows

### 7.1 First run: use starter routine

1. User opens the app.
2. App initializes catalog and starter routine.
3. User sees a first-run screen explaining that a starter routine is ready.
4. Screen shows routine name, next day label, exercise count, set count, and first exercise.
5. User can optionally enter a name.
6. User taps `Use starter routine`.
7. App marks onboarding skipped/seen.
8. App routes to Today.
9. User taps `Start workout`.
10. User logs first set.

This path must not require AI or network.

### 7.2 First run: build personalized routine

1. User opens the app.
2. User taps `Build personalized routine`.
3. User answers the questionnaire.
4. App shows a review screen of answers.
5. User taps `Generate routine`.
6. App calls its backend `/api/routines/generate`.
7. Backend calls OpenAI using a structured output schema.
8. Backend validates the model output against the routine contract.
9. If output fails validation, backend attempts one repair call using validation errors.
10. App shows routine preview with assumptions, substitutions, warnings, days, exercises, set blocks, and estimated session length.
11. User taps `Activate routine`.
12. App imports and activates the routine in IndexedDB.
13. App routes to Today.

### 7.3 Generate another routine from Settings

1. User opens Settings.
2. User taps `Create personalized routine`.
3. App asks whether to start from:
   - blank questionnaire
   - previous answers
   - current active routine plus changes
4. User generates a routine.
5. App previews the draft.
6. User can activate it or keep current routine.

### 7.4 Revise routine draft

After generation, user can type a short revision:

- "Make sessions 45 minutes."
- "No deadlifts."
- "Use machines instead of barbells."
- "More glutes and less arms."
- "Make it 4 days."

The app sends:

- original answers
- current generated draft
- revision instruction
- catalog
- schema

The API returns a full replacement routine draft, not a patch.

### 7.5 Manual YAML import remains

Power users can still:

1. Open Settings.
2. Tap `Import routine YAML`.
3. Paste or select YAML.
4. Validate and activate.

This path should use the same validation core as AI output.

## 8. Information Architecture

Main app routes:

- `/`: Today
- `/workout`: active workout
- `/history`: session history
- `/history/:sessionId`: session detail
- `/history/exercise/:exerciseId`: exercise history
- `/settings`: settings
- `/settings/routines`: routine management if split out
- `/settings/import`: YAML import
- `/onboarding`: first-run choice
- `/routine-builder`: builder questionnaire
- `/routine-builder/review`: answer review
- `/routine-builder/generating`: generation progress
- `/routine-builder/draft/:draftId`: routine preview and activation

Onboarding and routine builder should not show the bottom app nav. Normal app routes should.

## 9. Routine Builder Intake

The builder should keep the current 11 topics, but model them as structured data instead of prompt text.

### 9.1 Required fields

Required:

- primaryGoal
- experienceLevel
- daysPerWeek
- sessionLengthMinutes
- distinctTrainingDays
- equipment
- supersets
- includeCardio

Optional:

- userName
- restrictions
- musclePriorities
- favoriteExercises
- avoidedExercises
- notes

### 9.2 Suggested TypeScript type

```ts
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type SupersetPreference = "yes" | "only_if_time_crunched" | "no";

export interface RoutineBuilderAnswers {
  userName: string | null;
  primaryGoal: string;
  experienceLevel: ExperienceLevel;
  restrictions: string | null;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionLengthMinutes: 30 | 45 | 60 | 75 | 90;
  distinctTrainingDays: 1 | 2 | 3 | 4 | 5;
  equipment: string[];
  musclePriorities: string[];
  favoriteExercises: string | null;
  avoidedExercises: string | null;
  supersets: SupersetPreference;
  includeCardio: boolean;
  freeformNotes: string | null;
}
```

### 9.3 Input constraints

- Free text fields must have length limits.
- Normalize whitespace before API submission.
- Keep option values controlled.
- Equipment must include at least one item.
- `distinctTrainingDays` should not exceed practical session frequency without warning. Example: 5 distinct days with 2 weekly training days is allowed only if the user explicitly wants a long rotation.
- If restrictions mention acute injury, surgery, severe pain, dizziness, fainting, pregnancy, heart condition, or other high-risk states, show a caution and instruct the model to be conservative.

## 10. OpenAI API Architecture

### 10.1 Required backend

The app must not call OpenAI directly from browser code.

Add a minimal backend surface:

```text
POST /api/routines/generate
POST /api/routines/repair
```

The backend stores `OPENAI_API_KEY` in environment variables or a secrets manager.

Recommended hosting choices:

- Vercel static app plus serverless API routes.
- Netlify static app plus functions.
- Cloudflare Pages plus Worker/Functions.
- Keep GitHub Pages only if `VITE_ROUTINE_API_BASE_URL` points to a separately deployed API service.

### 10.2 OpenAI API choice

Use the OpenAI Responses API for new work. OpenAI docs describe Responses as the recommended API primitive for new projects and an evolution of Chat Completions:
https://developers.openai.com/api/docs/guides/migrate-to-responses

Model should be environment-configurable:

```text
OPENAI_ROUTINE_MODEL=gpt-5.4-mini
```

Default recommendation:

- Use `gpt-5.4-mini` for the normal routine builder to balance quality, latency, and cost.
- Allow `gpt-5.5` through env config for highest-quality generations.

OpenAI model docs as of this spec say `gpt-5.5` is the flagship model for complex reasoning and coding, while `gpt-5.4-mini` or `gpt-5.4-nano` are smaller options for latency/cost:
https://developers.openai.com/api/docs/models

### 10.3 API request contract

Client sends:

```ts
export interface GenerateRoutineRequest {
  answers: RoutineBuilderAnswers;
  activeRoutine?: RoutineAuthoringPayload | null;
  revisionInstruction?: string | null;
  catalogVersion: string;
  catalog: ExerciseCatalogItem[];
  appRoutineSchemaVersion: 1;
}
```

Backend validates request before calling OpenAI.

Backend should derive `catalog` from server-side trusted code when possible. If the app sends catalog data, backend must verify it against its own catalog copy or hash.

### 10.4 API response contract

Backend returns:

```ts
export interface GenerateRoutineResponse {
  ok: true;
  draftId: string;
  routine: RoutineAuthoringPayload;
  assumptions: string[];
  substitutions: Array<{
    requested: string;
    usedExerciseId: string;
    reason: string;
  }>;
  warnings: string[];
  validation: {
    passed: true;
    repaired: boolean;
  };
  model: string;
  generatedAt: string;
}
```

Failure:

```ts
export interface GenerateRoutineErrorResponse {
  ok: false;
  code:
    | "bad_request"
    | "safety_refusal"
    | "model_validation_failed"
    | "rate_limited"
    | "network_error"
    | "server_error";
  message: string;
  fieldErrors?: Array<{ path: string; message: string }>;
  retryable: boolean;
}
```

### 10.5 Structured output schema

The model should return JSON matching a schema, not Markdown and not YAML.

Top-level generation result:

```ts
export interface RoutineGenerationResult {
  routine: RoutineAuthoringPayload;
  assumptions: string[];
  substitutions: Array<{
    requested: string;
    usedExerciseId: string;
    reason: string;
  }>;
  warnings: string[];
}
```

`RoutineAuthoringPayload` mirrors the current YAML authoring format:

```ts
export interface RoutineAuthoringPayload {
  version: 1;
  name: string;
  rest_default_sec: number;
  rest_superset_sec: number;
  day_order: string[];
  days: Record<string, RoutineAuthoringDay>;
  cardio: RoutineAuthoringCardio | null;
  notes: string[];
}

export interface RoutineAuthoringDay {
  label: string;
  entries: RoutineAuthoringEntry[];
}

export type RoutineAuthoringEntry =
  | RoutineAuthoringExerciseEntry
  | { superset: [RoutineAuthoringExerciseEntry, RoutineAuthoringExerciseEntry] };

export interface RoutineAuthoringExerciseEntry {
  exercise_id: string;
  instance_label?: string;
  type_override?: "weight" | "bodyweight" | "isometric" | "cardio";
  equipment_override?:
    | "barbell"
    | "dumbbell"
    | "machine"
    | "cable"
    | "kettlebell"
    | "bodyweight"
    | "cardio"
    | "medicine-ball"
    | "other";
  notes?: string;
  sets: RoutineAuthoringSetBlock[];
}

export type RoutineAuthoringSetBlock =
  | { reps: number | [number, number]; count: number; tag?: "top" | "amrap" }
  | { duration: number | [number, number]; count: number; tag?: "top" | "amrap" }
  | { distance: number | [number, number]; count: number; tag?: "top" | "amrap" };

export interface RoutineAuthoringCardio {
  notes: string;
  options: Array<{ name: string; detail: string }>;
}
```

Implementation should use Zod or a JSON Schema generated from TypeScript to avoid schema/type drift.

OpenAI docs specifically warn against schema/type divergence and recommend native Pydantic/Zod SDK support or CI rules to keep schemas synchronized:
https://developers.openai.com/api/docs/guides/structured-outputs

### 10.6 Server validation and repair loop

The backend must run this pipeline:

1. Validate request shape.
2. Build model input with:
   - system/developer instructions
   - routine schema summary
   - closed exercise catalog
   - user answers
   - optional active routine and revision instruction
3. Call OpenAI with Structured Outputs.
4. Validate returned `routine` against the app's routine validator.
5. If validation passes, return draft.
6. If validation fails, make one repair call that includes:
   - original generation result
   - exact validation errors
   - instruction to return the complete corrected JSON result
7. Validate repaired result.
8. If repaired result fails, return `model_validation_failed` with field errors.

Do not import or activate invalid output.

### 10.7 Store and privacy settings

For routine generation calls, default to not storing model responses if the current SDK/API supports it for the selected endpoint. Include only data needed for routine creation.

Do not send:

- workout history by default
- backup payloads
- device identifiers
- precise location
- user name unless needed for copy personalization

If future versions use workout history for adaptive routines, add an explicit opt-in screen.

### 10.8 Abuse and safety controls

OpenAI safety best-practice docs recommend red-teaming, constraining inputs and outputs, human review where possible, and safety identifiers:
https://developers.openai.com/api/docs/guides/safety-best-practices

For this app:

- Constrain questionnaire inputs.
- Limit free text and output tokens.
- Use structured outputs.
- Add per-session or per-install rate limiting on the backend.
- Add `safety_identifier` where supported, using a random local install ID or hash that does not identify the user.
- Never let user free text override system instructions.
- Treat injuries/restrictions conservatively.
- Show warnings before activation.

## 11. Routine Generation Instructions

The server-side prompt should replace `docs/custom-gpt/workout-routine-gpt.instructions.md`.

Instruction requirements:

- You are generating routines for Exercise Logger.
- Output must match the structured schema exactly.
- Use only exercise IDs from the provided catalog.
- Exercise IDs are opaque. Copy them exactly.
- Do not invent exercises.
- If a requested exercise is unavailable, substitute the closest available catalog exercise and list it in `substitutions`.
- Respect available equipment.
- Respect avoided exercises and restrictions.
- Prefer simple movements for beginners.
- Keep volume realistic for session length.
- Use supersets only when allowed or time-constrained.
- Supersets must have exactly 2 exercises and equal total set counts.
- Every set block must define exactly one target: reps, duration, or distance.
- Ranges must be finite positive `[min, max]` with `min < max`.
- Exact targets must be finite positive numbers.
- `count` must be an integer >= 1.
- Top-level `notes` must be strings.
- `cardio` must be null unless requested or clearly useful as optional guidance.
- For injury or pain restrictions, include conservative warnings and avoid provocative exercises.
- Return the complete routine every time; no diffs.
- Do not include Markdown.
- Do not include YAML in the structured result.

## 12. Programming Heuristics For Generated Routines

These are product rules, not hard validation rules.

### 12.1 Days and splits

- 1 distinct day: full-body template repeated.
- 2 distinct days: upper/lower or full-body A/B depending on goals.
- 3 distinct days: full-body A/B/C, push/pull/legs, or upper/lower/full depending on goal and experience.
- 4 distinct days: upper/lower A/B, push/pull/lower/full, or goal-specific split.
- 5 distinct days: body-part or PPL plus accessories only for intermediate/advanced users with enough weekly frequency.

If `daysPerWeek` is lower than `distinctTrainingDays`, the routine is a rotation, not a calendar week.

### 12.2 Volume

Approximate targets:

- Beginner: 3 to 5 exercises per session, 8 to 16 working sets.
- Intermediate: 5 to 7 exercises per session, 14 to 24 working sets.
- Advanced: 6 to 8 exercises per session, 18 to 30 working sets only if session length supports it.

Respect session length:

- 30 min: 3 to 5 movements; supersets helpful if allowed.
- 45 min: 4 to 6 movements.
- 60 min: 5 to 7 movements.
- 75 to 90 min: 6 to 8 movements, but avoid junk volume.

### 12.3 Rep ranges

Default:

- Strength focus: 4 to 8 on primary lifts, 8 to 12 accessories.
- Hypertrophy/build muscle: 6 to 10 primary, 8 to 15 accessories.
- Fat loss/general fitness: 8 to 15 with optional cardio.
- Conditioning: more bodyweight, carries, cardio, duration work.
- Beginners: avoid very low rep max-effort blocks.

### 12.4 Rest

Default:

- `rest_default_sec`: 90 for general/hypertrophy, 120 for strength, 60 to 75 for conditioning/time-limited plans.
- `rest_superset_sec`: 60 to 90.

### 12.5 Supersets

Use sensible pairings:

- push/pull
- upper/lower accessory
- isolation/core

Avoid high-fatigue pairings for beginners:

- heavy squat plus heavy hinge
- two spinal-loading lifts
- two high-skill compound lifts

### 12.6 Cardio

When included, use the optional `cardio` section unless cardio is part of the actual routine day.

Good options:

- walk
- stationary bike
- rowing machine
- run-walk

Use catalog cardio exercises only when placing cardio inside a workout day entry.

## 13. Data Model Changes

The next version may reuse the current Dexie model, but should add AI-generation concepts cleanly.

### 13.1 Routine metadata

Extend `Routine`:

```ts
source: "bundled" | "yaml" | "ai" | "manual";
sourceModel?: string | null;
sourceDraftId?: string | null;
builderAnswersSnapshot?: RoutineBuilderAnswers | null;
assumptions?: string[];
substitutions?: Array<{ requested: string; usedExerciseId: string; reason: string }>;
warnings?: string[];
```

Keep fields optional for backward compatibility if migrating current data.

### 13.2 Routine drafts table

Add a `routineDrafts` table:

```ts
export interface RoutineDraft {
  id: string;
  status: "draft" | "activated" | "discarded" | "failed";
  routineAuthoringPayload: RoutineAuthoringPayload;
  normalizedRoutineId: string | null;
  answersSnapshot: RoutineBuilderAnswers;
  assumptions: string[];
  substitutions: Array<{ requested: string; usedExerciseId: string; reason: string }>;
  warnings: string[];
  validationErrors: Array<{ path: string; message: string }>;
  model: string;
  generatedAt: string;
  activatedAt: string | null;
}
```

Use this for review, recovery, and "regenerate/revise" flows.

### 13.3 Builder settings

Replace or supersede the current prompt-oriented fields:

Current fields:

- `lastGeneratedPrompt`
- `lastGeneratedPromptAt`
- `onboardingBannerDismissedAt`

Better fields:

```ts
lastRoutineDraftId: string | null;
lastBuilderAnswers: RoutineBuilderAnswers | null;
routineBuilderBannerDismissedAt: string | null;
```

If migrating, keep old fields as ignored legacy fields until backup import/export can strip them safely.

### 13.4 Shared validation core

Refactor current routine validation:

Current:

```ts
validateAndNormalizeRoutine(yamlString, exerciseLookup)
```

Target:

```ts
parseRoutineYaml(yamlString): unknown
validateAndNormalizeRoutineObject(raw, exerciseLookup): ValidateRoutineResult
validateAndNormalizeRoutineYaml(yamlString, exerciseLookup): Promise<ValidateRoutineResult>
```

Benefits:

- YAML import can parse then validate.
- AI JSON output can validate without YAML serialization.
- Tests can target parsed objects directly.
- Backend and frontend can share the same validation package.

## 14. UI Requirements

### 14.1 First-run choice screen

Screen must show:

- starter routine is ready
- starter routine name
- next day label
- number of exercises and sets
- primary CTA `Use starter routine`
- secondary CTA `Build personalized routine`
- optional name input
- no bottom nav

### 14.2 Routine builder questionnaire

Keep the existing chip-based flow but make it more explicit:

- required steps cannot advance without answer
- optional text steps can skip
- progress indicator
- exit preserves progress
- explicit start-over destructive action
- no bottom nav

### 14.3 Answer review

Before generation, show:

- goal
- experience
- schedule
- equipment
- restrictions
- priorities
- favorites/avoid
- supersets
- cardio

Actions:

- `Generate routine`
- `Edit answers`

### 14.4 Generation state

Show:

- "Building your routine"
- current phase: validating answers, designing routine, checking catalog, validating routine
- cancel/back affordance
- retry on failure

Do not block normal workout logging if user leaves the builder.

### 14.5 Routine preview

Preview must show:

- routine name
- assumptions
- substitutions
- warnings
- day order
- per-day label
- exercise cards
- set prescriptions
- supersets clearly labeled
- estimated set count and session length
- optional cardio
- notes

Actions:

- `Activate routine`
- `Regenerate`
- `Revise`
- `Export YAML`
- `Discard draft`

### 14.6 Activation

On activation:

- Validate draft again client-side.
- Block activation if there is an active workout.
- Insert routine.
- Set it active.
- Mark draft activated.
- Route to Today.
- Show success toast.

### 14.7 Settings

Routine section should support:

- active routine card
- create personalized routine
- view saved draft
- import YAML
- export active routine YAML
- list routines
- delete routine
- activate routine

Data section should support:

- export JSON backup
- import JSON backup
- clear all data

## 15. Workout Requirements To Preserve Or Improve

### 15.1 Today

Show:

- greeting
- active routine name
- next day ID and label
- day summary
- start/resume CTA
- day selector
- last session summary
- optional saved-draft/banner if builder has an unfinished draft

### 15.2 Workout

Show:

- header with day ID, day label, routine name, elapsed time
- progress
- exercise cards
- supersets grouped
- set rows
- last-time hints
- suggestions
- unit toggle per exercise
- add extra exercise
- finish/discard

Should add:

- rest timer using `restDefaultSecSnapshot` and `restSupersetSecSnapshot`
- explicit superset A/B round flow
- visible set-sheet cancel
- less noisy extra-set affordance

### 15.3 History

Must show:

- finished sessions
- stats summary
- session detail
- all logged set kinds: weight+reps, reps only, duration, distance, duration+distance
- exercise-history links from session detail

Should add:

- search/filter eventually, but not required for OpenAI-native rebuild.

## 16. Validation Rules

The routine contract remains the current contract.

Hard rules:

- `version` is required and must be `1`.
- `name` non-empty.
- `rest_default_sec` non-negative finite number.
- `rest_superset_sec` non-negative finite number.
- `day_order` non-empty array.
- Every day in `day_order` exists in `days`.
- Every day in `days` appears in `day_order`.
- Each day has non-empty `label` and non-empty `entries`.
- Each entry is exactly one of:
  - single exercise
  - superset of exactly 2 exercise items
- Every `exercise_id` exists in catalog.
- Every exercise item has non-empty `sets`.
- Set block defines exactly one target: reps, duration, or distance.
- Target exact values are finite positive numbers.
- Target ranges are `[min, max]`, finite positive, and `min < max`.
- `count` integer >= 1.
- `tag` only `top` or `amrap`.
- Superset sides have equal total working set count.
- Duplicate `exercise_id` on same day requires distinct `instance_label` on every occurrence.
- `notes` values are strings.
- `cardio.notes` and `cardio.options[].name/detail` are strings.
- Overrides are valid enum values only.

## 17. Error Handling

User-visible error classes:

- No network for generation.
- API unavailable.
- Rate limited.
- Model refused or could not create safe routine.
- Model output failed validation.
- Active session blocks routine activation/import.
- Unknown exercise ID in YAML import.
- Invalid backup.

Errors should be specific and actionable.

Examples:

- "Routine generation needs internet. Your workouts still work offline."
- "The model returned exercises that are not in the catalog. Try regenerating."
- "Finish or discard your active workout before activating a new routine."
- "YAML is invalid: days.A.entries[2].exercise_id does not exist in the catalog."

## 18. Offline Behavior

Offline must work for:

- app shell
- Today
- Workout
- active session
- set logging
- history
- settings
- YAML import if the file/text is local
- backup export

Offline cannot work for:

- AI routine generation
- AI routine revision

When offline in builder:

- show offline state
- offer starter routine
- offer manual YAML import
- preserve answers locally for later generation

## 19. Testing Requirements

### 19.1 Unit tests

Add or preserve tests for:

- builder reducer/state
- answer validation
- structured request builder
- routine authoring schema
- parsed-object routine validator
- YAML parser delegates to object validator
- AI response validation
- repair-loop failure behavior
- routine import/activation transaction
- draft persistence
- settings migration
- all service invariants

### 19.2 API tests

Backend tests should mock OpenAI.

Cases:

- valid generation output returns draft
- invalid model output triggers repair call
- invalid repaired output returns `model_validation_failed`
- unknown exercise ID rejected
- unsafe/irrelevant prompt returns refusal-style error
- rate limit maps to retryable response
- API key missing fails clearly at startup or first call
- free text cannot override system instruction

### 19.3 Integration tests

Cases:

- first-run use starter -> Today -> start workout
- first-run personalized -> generate -> preview -> activate
- revise draft -> full replacement routine -> activate
- saved draft recovery from Today/Settings
- YAML import still works
- active session blocks activation
- backup round trip includes AI metadata

### 19.4 E2E tests

Use Playwright.

Required flows:

- cold install to first logged starter set
- personalized routine mocked generation to activation
- mocked validation failure shown in UI
- offline generation disabled but workout logging works
- active session blocks new routine activation

### 19.5 Contract tests

Keep a corpus:

- bundled routines
- generated routine fixtures
- invalid generated outputs
- backup fixtures from current version

All bundled and generated fixtures must validate.

## 20. Deployment Requirements

Minimum environment variables:

```text
OPENAI_API_KEY=...
OPENAI_ROUTINE_MODEL=gpt-5.4-mini
ROUTINE_GENERATION_RATE_LIMIT_PER_HOUR=...
ALLOWED_ORIGINS=...
```

Frontend:

```text
VITE_ROUTINE_API_BASE_URL=/api
```

If deployed on GitHub Pages:

- frontend remains static
- backend must be separate
- configure `VITE_ROUTINE_API_BASE_URL` to the backend URL
- backend CORS must allow only the production app origin and localhost dev origins

If deployed on Vercel/Netlify/Cloudflare:

- serve frontend and API under same origin if possible

## 21. Security And Privacy

Must:

- keep OpenAI key only on backend
- never commit keys
- use environment variables or secrets manager
- validate all incoming API request bodies
- rate limit generation
- set CORS narrowly
- avoid sending workout history by default
- strip unnecessary PII
- handle model refusals
- keep backups local
- make it clear generation requires sending questionnaire details to the API provider

Should:

- let user opt into including current routine when revising
- let user delete saved drafts
- support local-only mode with starter routine and YAML import

## 22. Migration From Current App

The robust version should support existing users.

Requirements:

- Current JSON backups should import successfully.
- Current routines should render unchanged.
- Current settings should migrate to new settings shape.
- Old `lastGeneratedPrompt` can be ignored or converted into a legacy saved prompt note.
- Current YAML routines should import.
- Existing session history must remain renderable.

If building in-place:

- add Dexie version migration for new tables/fields
- preserve `DEFAULT_SETTINGS`
- keep null/sentinel rules for compound indexes
- do not break current backup import

If building greenfield:

- provide a backup import path from current `exercise-logger` schemaVersion 1
- provide a migration test with a real current backup fixture

## 23. Acceptance Criteria

The next version is acceptable when:

- User can use starter routine without network.
- User can build a personalized routine without leaving the app.
- No Custom GPT URL is needed.
- No prompt/YAML copy-paste is needed for the normal AI path.
- OpenAI API key is not present in frontend code or built assets.
- AI output uses structured JSON and validates against the same routine contract.
- Invalid AI output never imports.
- Backend repair loop is implemented and tested.
- Routine preview shows assumptions, substitutions, warnings, and full day details.
- User can activate generated routine.
- User can revise/regenerate before activation.
- YAML import remains available.
- JSON backup/restore remains available.
- Workout logging remains fully offline.
- Current session/history/progression invariants remain covered by tests.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and Playwright E2E pass.

## 24. Suggested Fresh Codex Prompt

Use this prompt with a fresh Codex instance.

```text
You are working in the Exercise Logger repo. Your task is to build the next version of the app described in `docs/openai-native-routine-builder-spec.md`.

First, read these files:

- `docs/openai-native-routine-builder-spec.md`
- `README.md`
- `CLAUDE.md`
- `docs/design-spec.md`
- `docs/custom-gpt/routine-yaml-contract.md`
- `docs/custom-gpt/workout-routine-gpt.instructions.md`
- `web/src/domain/types.ts`
- `web/src/db/database.ts`
- `web/src/services/routine-service.ts`
- `web/src/services/session-service.ts`
- `web/src/services/set-service.ts`
- `web/src/services/progression-service.ts`
- `web/src/features/onboarding/`
- `web/src/features/settings/RoutineImportScreen.tsx`

Goal:

Replace the external Custom GPT handoff with native in-app routine generation using the OpenAI API. Preserve the local-first workout logger. The user should answer the same or similar questions, tap Generate, review a structured routine draft, and activate it without leaving the app. YAML remains only as a compatibility/manual import/export path.

Non-negotiable architecture:

1. Do not expose `OPENAI_API_KEY` in frontend code or Vite env. Browser code must call an app backend endpoint.
2. Add a minimal backend API for routine generation. If you keep GitHub Pages as frontend hosting, make the API base URL configurable with `VITE_ROUTINE_API_BASE_URL`. If you choose a same-origin host such as Vercel, document that decision.
3. Use the OpenAI Responses API with structured output. Confirm the exact SDK syntax from current official docs while implementing.
4. Make model configurable with `OPENAI_ROUTINE_MODEL`; default to `gpt-5.4-mini` unless current docs strongly indicate a better default.
5. The model must return structured JSON matching a schema, not Markdown and not YAML.
6. Refactor routine validation so YAML import and AI JSON output share the same validation core.
7. Backend must validate model output. If invalid, perform one repair call with exact validation errors. If still invalid, return a clear error and do not import.
8. Client must validate again before activation.
9. AI generation requires network; all existing workout logging must continue offline.
10. Preserve current session snapshot, progression, unit, backup, and active-session invariants.

Product requirements:

- First-run screen offers `Use starter routine` and `Build personalized routine`.
- Routine builder captures: goal, experience, restrictions, days per week, session duration, distinct workout days, equipment, priorities, favorites, avoids, supersets, and cardio.
- Show an answer review before generation.
- Show a generation state with retry/error handling.
- Show a routine preview with assumptions, substitutions, warnings, day cards, exercise IDs/names, set blocks, supersets, cardio, and notes.
- Support `Activate routine`, `Regenerate`, `Revise`, `Export YAML`, and `Discard draft`.
- Settings must allow creating another personalized routine and recovering an unfinished draft.
- Manual YAML import must still work.
- JSON backup import/export must still work and include any new AI metadata safely.

Implementation guidance:

- Prefer extending the existing React/Vite/Dexie app rather than rewriting unrelated working screens.
- Keep business rules in services or pure libraries, not embedded inside components.
- Add `routineDrafts` or equivalent local draft persistence.
- Add AI-generation metadata to routines using backward-compatible optional fields or a Dexie migration.
- Keep the exercise catalog closed. The model may only use catalog IDs.
- Do not invent exercises. Substitutions must be listed.
- Keep UI phone-first and consistent with the existing warm paper/sage visual system.
- Do not add accounts, sync, social features, nutrition, or a dashboard.

Testing:

- Add unit tests for the routine authoring schema, parsed-object validator, AI response validation, repair loop, builder state, and draft activation.
- Mock OpenAI calls in API tests. Do not hit the live API in tests.
- Add integration tests for personalized generation -> preview -> activate.
- Add E2E with mocked API for first-run personalized routine activation.
- Preserve or update existing tests for YAML import, session lifecycle, set logging, progression, backup import, and onboarding.
- Run: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and Playwright E2E. Report any command you cannot run.

Deliverables:

- Working app changes.
- New/updated tests.
- Updated documentation explaining local dev env vars, backend deployment, and the routine generation flow.
- A short final summary listing changed files, test results, and any remaining risks.
```


Full Audit Report: Spec + Master Plan + Phases 1–7

  Part 1: CERTAIN ISSUES (Mechanical, definitively wrong)

  These need to be fixed before or during implementation. No judgment calls needed.

  Data & Types

  #: C1
  Phase: CSV
  Issue: Lat Pulldown has Equipment = Machine / Cable, Farmer's Carry has Kettlebell / Dumbbell. Spec's    
    equipment is a single enum, not multi-value.
  Impact: Catalog seeding will either crash or silently store invalid data. Need a "first value wins" or   
    explicit mapping strategy decided before Phase 2 types freeze.
  ────────────────────────────────────────
  #: C2
  Phase: CSV
  Issue: Line 83: Burpees,,, — empty Type/Equipment/Muscle Group, duplicate of line 70 Burpee.
  Impact: CSV parser will throw or produce garbage. Must delete this row.
  ────────────────────────────────────────
  #: C3
  Phase: CSV
  Issue: All 8 required exercises missing from CSV.
  Impact: Confirmed — Phase 3 correctly scopes this work, but it's a hard blocker for routine import.      
  ────────────────────────────────────────
  #: C4
  Phase: P2
  Issue: Dexie compound index [exerciseId+instanceLabel+blockSignature+loggedAt] silently drops rows where 
    instanceLabel is null.
  Impact: Most loggedSets rows (any exercise without instanceLabel) become invisible to this index. The    
    Phase 2 test that queries with "" for a row inserted with null will fail. Must normalize null → "" at  
    the type/storage level in Phase 2, not defer to Phase 4.
  ────────────────────────────────────────
  #: C5
  Phase: P2→P3
  Issue: Routine.cardio type (RoutineCardio) and Routine.notes: string[] not explicitly listed in Phase 2's

    type scope.
  Impact: Phase 3 will have to invent these types, violating spec section 17's "shared contracts must land
    first" rule.
  ────────────────────────────────────────
  #: C6
  Phase: P3→P5
  Issue: Slug for Run/walk produces runwalk, but Phase 5 references it as run-walk.
  Impact: Cross-phase lookup miss at runtime. Either fix the CSV name or update Phase 5's reference.       
  ────────────────────────────────────────
  #: C7
  Phase: P3
  Issue: parseExerciseCatalog has no equipment enum validation — uses as ExerciseEquipment cast.
  Impact: Any garbage equipment string silently passes. The VALID_EQUIPMENT set exists but is only used in 
    YAML validation, not CSV parsing.

  Session & Progression Logic

  ┌─────┬───────┬──────────────────────────────────────────────┬───────────────────────────────────────┐   
  │  #  │ Phase │                    Issue                     │                Impact                 │   
  ├─────┼───────┼──────────────────────────────────────────────┼───────────────────────────────────────┤   
  │     │       │ Dead startSession function remains alongside │ If accidentally imported/called,      │   
  │ C8  │ P4    │  startSessionWithCatalog, with placeholder   │ sessions get silently wrong snapshot  │   
  │     │       │ values ("" name, "weight" type, "barbell"    │ data. Must remove or unexport.        │   
  │     │       │ equipment).                                  │                                       │   
  ├─────┼───────┼──────────────────────────────────────────────┼───────────────────────────────────────┤   
  │     │       │ setActiveRoutine and deleteRoutine check     │ TOCTOU race: a session could start    │   
  │ C9  │ P4    │ hasActiveSession outside the Dexie           │ between the check and the mutation,   │   
  │     │       │ transaction.                                 │ violating invariant 13. Both checks   │   
  │     │       │                                              │ must be inside the transaction.       │   
  ├─────┼───────┼──────────────────────────────────────────────┼───────────────────────────────────────┤   
  │     │       │ deleteRoutine reads settings.activeRoutineId │ Stale data risk — another operation   │   
  │ C10 │ P4    │  before the transaction starts.              │ could change activeRoutineId between  │   
  │     │       │                                              │ the read and the transaction.         │   
  ├─────┼───────┼──────────────────────────────────────────────┼───────────────────────────────────────┤   
  │     │       │ allSetsHitCeiling only checks performedReps, │ A weight exercise with a              │   
  │ C11 │ P5    │  ignoring performedDurationSec and           │ duration-range block (e.g., farmer's  │   
  │     │       │ performedDistanceM.                          │ walk 30-60s) would always return      │   
  │     │       │                                              │ false. Must inspect block.targetKind. │   
  ├─────┼───────┼──────────────────────────────────────────────┼───────────────────────────────────────┤   
  │     │       │ Minimum increment guard: roundToIncrement(1, │ When 5% rounds back to the same       │   
  │ C12 │ P5    │  "barbell", "kg") = Math.round(1/2.5)*2.5 =  │ weight, the fallback branch adds 0    │   
  │     │       │ 0.                                           │ instead of one increment. Must use    │   
  │     │       │                                              │ getIncrement() directly.              │   
  └─────┴───────┴──────────────────────────────────────────────┴───────────────────────────────────────┘   

  UI

  #: C13
  Phase: P6
  Issue: Superset timer checks (blockIndex, setIndex) pairs between two sides, not flat round index.       
  Impact: Breaks when superset sides have different block decompositions (which is legal per spec — only   
    total set count must match).
  ────────────────────────────────────────
  #: C14
  Phase: P6
  Issue: ExerciseHistoryScreen hardcodes "barbell" for toDisplayWeight().
  Impact: All weights in per-exercise history display barbell-rounded values regardless of actual
  equipment.
  ────────────────────────────────────────
  #: C15
  Phase: P6
  Issue: SetLogForm pre-fill only sets suggestedWeightKg — reps/duration/distance from last-time data are  
    never consulted.
  Impact: Reps field is always blank for new sets even when last-time data exists. Spec says prefill from  
    "most recent finished matching block."
  ────────────────────────────────────────
  #: C16
  Phase: P6
  Issue: RestTimer rendered in both WorkoutScreen and AppShell.
  Impact: Double rendering when on the Workout tab. Remove the one in WorkoutScreen.
  ────────────────────────────────────────
  #: C17
  Phase: P6
  Issue: Settings screen handleDeleteRoutine delegates to service but doesn't verify
    auto-activation-on-delete logic exists.
  Impact: Spec requires "automatically activate the earliest remaining routine by importedAt ASC" — if     
  Phase
    4's deleteRoutine doesn't implement this, the behavior is silently wrong.

  Backup & Validation

  ┌─────┬───────┬────────────────────────────────────────────────┬─────────────────────────────────────┐   
  │  #  │ Phase │                     Issue                      │               Impact                │   
  ├─────┼───────┼────────────────────────────────────────────────┼─────────────────────────────────────┤   
  │     │       │ validateRoutine during import doesn't check    │ Routines with references to         │   
  │ C18 │ P7    │ exerciseId references inside                   │ deleted/renamed exercises would     │   
  │     │       │ routine.days[*].entries[*] against the         │ import successfully but break at    │   
  │     │       │ catalog.                                       │ runtime.                            │   
  ├─────┼───────┼────────────────────────────────────────────────┼─────────────────────────────────────┤   
  │     │       │ validateRoutine doesn't deeply validate        │ Malformed routine entries (missing  │   
  │ C19 │ P7    │ RoutineDay or RoutineEntry internal structure. │ entries array, invalid kind, broken │   
  │     │       │                                                │  setBlocks) pass import validation. │   
  └─────┴───────┴────────────────────────────────────────────────┴─────────────────────────────────────┘   

  Scaffolding

  ┌─────┬───────┬───────────────────────────────────────────┬──────────────────────────────────────────┐   
  │  #  │ Phase │                   Issue                   │                  Impact                  │   
  ├─────┼───────┼───────────────────────────────────────────┼──────────────────────────────────────────┤   
  │ C20 │ P1    │ Missing @types/node devDependency.        │ TypeScript errors on import path from    │   
  │     │       │                                           │ "path" and __dirname in vite.config.ts.  │   
  ├─────┼───────┼───────────────────────────────────────────┼──────────────────────────────────────────┤   
  │     │       │ tailwindcss, @tailwindcss/vite,           │ Build-time tools don't belong in         │   
  │ C21 │ P1    │ vite-plugin-pwa installed as dependencies │ production deps. Use -D flag.            │   
  │     │       │  instead of devDependencies.              │                                          │   
  ├─────┼───────┼───────────────────────────────────────────┼──────────────────────────────────────────┤   
  │     │       │ PWA icon purpose: "any maskable" on a     │ Maskable icons need a safe-zone crop;    │   
  │ C22 │ P1    │ single image is a documented              │ any icons are edge-to-edge. Must split   │   
  │     │       │ anti-pattern.                             │ into two separate icon entries.          │   
  └─────┴───────┴───────────────────────────────────────────┴──────────────────────────────────────────┘   

  ---
  Part 2: POTENTIAL ISSUES (Design decisions / pros-cons)

  These require judgment calls or clarification. Not definitively wrong, but worth resolving before        
  implementation.

  Semantic Ambiguities

  #: P1
  Phase: P2/P5
  Issue: blockSignature uses tagnormal for blocks with no tag, but SetBlock.tag is `"top"
  Options: "amrap"
  ────────────────────────────────────────
  #: P2
  Phase: P5
  Issue: Spec contradicts itself on exact-rep blocks: "suggest same weight" (line 703) vs "show history    
    only, no suggestion" (line 721).
  Options: A) Return suggestion with isProgression: false (plan's approach) — pre-fills weight, useful UX. 
    B) Return null, show history only — strict spec compliance. Recommend A — pragmatic for a gym app.     
  ────────────────────────────────────────
  #: P3
  Phase: P5
  Issue: getBlockLabel produces "Set block 2" for untagged blocks, but spec example shows "Back-off: 70kg x

    12, 11, 10".
  Options: A) Heuristic: if a block follows a top-tagged block and has no tag, label it "Back-off". B)     
    Accept "Set block 2" as good enough. C) Add an optional label field to SetBlock. Recommend A — small   
    heuristic, big UX win.
  ────────────────────────────────────────
  #: P4
  Phase: Spec
  Issue: Routine schemaVersion (on routines table) and backup schemaVersion (in JSON envelope) are
    independent versioning tracks.
  Options: Just needs explicit documentation to avoid implementor confusion. Both start at 1 in v1.        
  ────────────────────────────────────────
  #: P5
  Phase: Spec
  Issue: Dumbbell Reverse Lunge is in the 8 required additions but never referenced by the target routine  
    YAML.
  Options: Likely future-proofing. Keep it — it's harmless in the catalog.

  Logic Edge Cases

  #: P6
  Phase: P4
  Issue: Weighted bodyweight promotion is one-way (bodyweight→weight on first non-null weight log). Editing

    a set to null weight doesn't demote.
  Trade-off: Spec says "the user logs a non-null performedWeightKg" — once triggered, irreversible per     
    session. This is correct but no test verifies demotion doesn't happen. Add a negative test.
  ────────────────────────────────────────
  #: P7
  Phase: P4
  Issue: logSet doesn't validate setIndex against block's count.
  Trade-off: A caller could log setIndex: 99 for a count: 3 block. UI prevents this, but service layer is  
    undefended. Add a guard or document the contract.
  ────────────────────────────────────────
  #: P8
  Phase: P4
  Issue: editSet doesn't trigger weighted bodyweight promotion.
  Trade-off: If a user edits a bodyweight set to add weight, effectiveType stays bodyweight. Spec is       
    ambiguous on whether edit counts as "logging." Recommend: promote on edit too.
  ────────────────────────────────────────
  #: P9
  Phase: P5
  Issue: Fallback matching extracts targetKind by string-splitting blockSignature.
  Trade-off: Couples fallback logic to signature format. Fragile but functional since the format is frozen 
    in v1.
  ────────────────────────────────────────
  #: P10
  Phase: P5
  Issue: Progression uses matchingSets[0].performedWeightKg as reference, assuming all sets in a block use 
    the same weight.
  Trade-off: True for typical usage but not enforced. Drop sets would get a surprise suggestion. Acceptable

    for v1.
  ────────────────────────────────────────
  #: P11
  Phase: P5
  Issue: lbs conversion uses hardcoded / 2.20462 instead of Phase 2's lbsToKg helper.
  Trade-off: Precision drift risk. Should use the helper for single source of truth. Easy fix.

  UI/UX Concerns

  #: P12
  Phase: P6
  Issue: Superset round detection reads activeSession.loggedSets before the new set is reflected in the    
    reactive hook.
  Trade-off: Race condition — timer may never start because data is always one step behind. Fix: re-query  
    after logSet completes, or pass the updated set list directly.
  ────────────────────────────────────────
  #: P13
  Phase: P6
  Issue: optionalWeightExpanded state persists across SetLogForm reopens.
  Trade-off: If user logs weighted set → closes → opens for unweighted set, weight field stays expanded.   
  Add
    reset in useEffect on open change.
  ────────────────────────────────────────
  #: P14
  Phase: P6
  Issue: Day preview converts exercise IDs to names via slug-splitting heuristic instead of catalog lookup.
  Trade-off: Works for most names but fails for abbreviations or special cases. Catalog lookup is more     
    correct but adds a query.
  ────────────────────────────────────────
  #: P15
  Phase: P6
  Issue: ExercisePicker disables already-added exercises entirely.
  Trade-off: Spec allows duplicate exercises with distinct instance_label. Disabling prevents adding the   
    same exercise as an extra. Consider warning instead of blocking.
  ────────────────────────────────────────
  #: P16
  Phase: P6
  Issue: Timer restarts on set edit (re-logging existing slot), not just new sets.
  Trade-off: Spec says "editing does not affect the timer automatically." Need to distinguish create vs    
    update in logSet return value.
  ────────────────────────────────────────
  #: P17
  Phase: P6
  Issue: Theme "system" option removes light/dark classes but doesn't add matchMedia listener.
  Trade-off: OS theme changes won't be detected in real-time after switching to "system." Needs a listener.
  ────────────────────────────────────────
  #: P18
  Phase: P6
  Issue: History screen has N+1 query pattern — loads all sessions, then queries each one individually.    
  Trade-off: Fine for early users, degrades with hundreds of sessions. Defer pagination to post-v1 or add  
    virtual scrolling.
  ────────────────────────────────────────
  #: P19
  Phase: P7
  Issue: No explicit post-import resume navigation — user stays on Settings screen after importing a backup

    with an active session.
  Trade-off: Spec says "the app must resume it after import." Either navigate to Workout or show a
  prominent
    toast.

  Scaffolding Uncertainties

  ┌─────┬───────┬─────────────────────────────────────┬────────────────────────────────────────────────┐   
  │  #  │ Phase │                Issue                │                   Trade-off                    │   
  ├─────┼───────┼─────────────────────────────────────┼────────────────────────────────────────────────┤   
  │     │       │ Vite 8 released ~4 days ago.        │ Add a compatibility check step after install.  │   
  │ P20 │ P1    │ vite-plugin-pwa may not be          │ Consider pinning to Vite 7 if issues arise.    │   
  │     │       │ compatible yet.                     │                                                │   
  ├─────┼───────┼─────────────────────────────────────┼────────────────────────────────────────────────┤   
  │     │       │ shadcn init -t vite -y on an        │ Drop the -t vite flag and let CLI auto-detect, │   
  │ P21 │ P1    │ existing project may overwrite      │  or test the exact behavior first.             │   
  │     │       │ files.                              │                                                │   
  ├─────┼───────┼─────────────────────────────────────┼────────────────────────────────────────────────┤   
  │     │       │ Playwright webServer uses npm run   │ npx playwright test alone serves stale dist/.  │   
  │ P22 │ P1    │ preview without building first.     │ Change test:e2e script to npm run build &&     │   
  │     │       │                                     │ playwright test.                               │   
  └─────┴───────┴─────────────────────────────────────┴────────────────────────────────────────────────┘   

  ---
  Part 3: OBSERVATIONS (Fine, but worth noting)

  1. Phase dependency chain is strictly linear — conservative but safe for AI-agent execution. No
  parallelization opportunity without risk.
  2. All 16 acceptance scenarios have homes — scenarios 5, 9, 14 span multiple phases, final assertion in  
  Phase 7 is correct.
  3. File structure covers all spec functionality — every requirement maps to at least one planned file.   
  4. distance target kind gets minimal testing — the routine YAML doesn't use it, so it'll have the least  
  coverage. Consider adding a test fixture.
  5. Phase 6 is the largest phase — 4 screens + timer + picker. Consider breaking into sub-phases during   
  execution.
  6. Phase 6 test coverage is thin for screens (2 tests each for Today/Workout/History) — component tests  
  are better. The plan acknowledges this.
  7. No loading/skeleton states — all screens show "Loading..." text. Fine for v1 but impacts perceived    
  performance.
  8. No ESLint configuration in Phase 1 tasks, though scaffold may include it implicitly.
  9. CI only triggers on main — v2-rewrite branch won't trigger deploys until merged.

  ---
  Priority Summary

  Fix before starting Phase 1 (3 items):
  - C20–C22: @types/node, devDependencies, icon purpose split

  Fix before freezing Phase 2 types (4 items):
  - C1: Compound equipment strategy for CSV
  - C4: instanceLabel null → "" normalization
  - C5: Add Routine.cardio and Routine.notes types
  - P1: Confirm tagnormal sentinel for blockSignature

  Fix before Phase 4 implementation (3 items):
  - C8: Remove dead startSession function
  - C9–C10: TOCTOU race in routine activation/deletion

  Fix before Phase 5 implementation (3 items):
  - C6: runwalk vs run-walk slug inconsistency
  - C11: allSetsHitCeiling must check targetKind
  - C12: Minimum increment guard math bug

  Fix before Phase 6 implementation (5 items):
  - C13: Superset timer flat round index
  - C14: Hardcoded "barbell" in history screen
  - C15: Pre-fill reps from last-time data
  - C16: Remove duplicate RestTimer
  - C17: Verify auto-activation-on-delete exists

  Fix before Phase 7 implementation (2 items):
  - C18–C19: Deep routine validation during import

  Total: 22 certain issues, 22 potential issues, 9 observations.

  The plans are detailed and well-structured overall — the issues are mostly edge cases and cross-phase    
  consistency gaps, not fundamental architecture problems. The spec is solid and the phase sequencing is   
  correct.
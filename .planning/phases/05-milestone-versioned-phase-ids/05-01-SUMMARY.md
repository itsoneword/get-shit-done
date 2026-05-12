---
phase: 05-milestone-versioned-phase-ids
plan: 01
subsystem: tooling
tags: [partition, milestone, cli, refactor, backward-compat]

# Dependency graph
requires: []
provides:
  - "phasesDir(cwd) helper resolving .planning/{milestone}/phases/ vs legacy .planning/phases/"
  - "relPhasesPath(cwd) helper returning posix-style relative phases path"
  - "buildMilestoneContext(cwd) helper returning {milestone_root, partition_root, legacy_layout_detected}"
  - "planningPaths(cwd).phases is now a partition-aware getter (auto-cascades to all callers)"
  - "init JSON contract extended (additive): milestone_root, partition_root, legacy_layout_detected, prior_milestones[]"
  - "Partition-aware test fixtures (createPartitionedFixture, createLegacyLayoutFixture, withStateMilestone)"
affects:
  - "05-02 (migration retrofit)"
  - "05-03 (milestone-complete distillation writer)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-chokepoint phasesDir(cwd) reads STATE.md milestone field + filesystem to decide layout"
    - "JSON contract is additive: new fields (milestone_root, partition_root, legacy_layout_detected, prior_milestones) spread into result objects; existing fields untouched"
    - "Test fixtures parameterize layout: legacy vs partitioned, both with milestone STATE.md"

key-files:
  created:
    - ".planning/phases/05-milestone-versioned-phase-ids/deferred-items.md"
  modified:
    - "get-shit-done/bin/lib/core.cjs (added phasesDir, relPhasesPath, buildMilestoneContext; planningPaths.phases is now a getter; findPhaseInternal uses helper)"
    - "get-shit-done/bin/lib/init.cjs (8 literal sites refactored; 6 init commands now emit milestone context; cmdInitProgress adds prior_milestones[])"
    - "get-shit-done/bin/lib/phase.cjs (10 literal sites refactored; cmdPhaseAdd/cmdPhaseInsert ensure partitioned parent dir exists)"
    - "get-shit-done/bin/lib/uat.cjs (5 literal sites refactored; error message uses relPhasesPath)"
    - "get-shit-done/bin/lib/verify.cjs (2 literal sites refactored)"
    - "get-shit-done/bin/lib/commands.cjs (1 JSON-emit literal refactored)"
    - "tests/helpers.cjs (added createPartitionedFixture, createLegacyLayoutFixture, withStateMilestone)"
    - "tests/core.test.cjs (added 7 phasesDir partition-aware tests)"
    - "tests/init.test.cjs (added 6 partitioned-layout tests including cross-milestone exclusion + prior_milestones[])"
    - "tests/phase.test.cjs (added partition-aware decimal resolution test)"

key-decisions:
  - "Single helper phasesDir(cwd) is the chokepoint — planningPaths().phases is a getter that delegates to it, cascading the partition-awareness to ~13 indirect callers automatically"
  - "Backward compat: when STATE.md milestone is set but partitioned dir doesn't exist AND legacy dir exists, return legacy path (lets retrofit migration run later without breakage)"
  - "Local var renamed from phasesDir to phasesRoot inside each function body to avoid shadowing the imported phasesDir() helper"
  - "buildMilestoneContext fields (milestone_root, partition_root, legacy_layout_detected) spread into each init command's result object — additive, never replacing existing fields"
  - "cmdInitProgress.prior_milestones[] field is wave-1-shipped but empty until 05-03 produces SUMMARY.md files in each closed milestone partition"

patterns-established:
  - "Chokepoint helper cascade: turning planningPaths().phases into a getter makes all 13 indirect consumers partition-aware without per-file edits"
  - "Additive JSON contract: spread ...buildMilestoneContext(cwd) at top of each result object — guarantees no rename, no breakage"
  - "Test fixture parameterization: createLegacyLayoutFixture(milestone) vs createPartitionedFixture(milestone) — single matrix to exercise both layouts"

requirements-completed: [SC-1, SC-6, SC-7]

# Metrics
duration: 27min
completed: 2026-05-12
---

# Phase 05 Plan 01: Partition-aware phasesDir helper and CLI refactor Summary

**Partition-aware phasesDir(cwd) helper introduced in core.cjs and cascaded across 23 callsites; planningPaths().phases is now a getter, init JSON output gains milestone_root/partition_root/legacy_layout_detected/prior_milestones[] fields — all backward-compatible with the legacy .planning/phases/ layout.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-05-12T13:52:59Z
- **Completed:** 2026-05-12T14:20:40Z
- **Tasks:** 3
- **Files modified:** 11 (5 lib files + 4 test files + 1 helpers + 1 deferred-items)

## Accomplishments

- Introduced single chokepoint helper `phasesDir(cwd)` in core.cjs with 4-case resolution logic (partitioned exists → use it; only legacy → fallback; neither + milestone set → writer-creates partitioned; no milestone → legacy default)
- Converted `planningPaths(cwd).phases` from a literal to a getter delegating to `phasesDir(cwd)`, auto-cascading partition-awareness to ~13 indirect consumers in state.cjs/roadmap.cjs/commands.cjs/milestone.cjs
- Refactored all 12 direct-literal `.planning/phases` sites enumerated in 05-RESEARCH.md §2 across init.cjs, phase.cjs, uat.cjs, verify.cjs, commands.cjs — zero literals remain in lib/ outside the fallback branch inside `phasesDir` itself
- Extended init JSON contracts (additive, no renames) with `milestone_root`, `partition_root`, `legacy_layout_detected`, `prior_milestones[]` fields across 6 init commands (cmdInitExecutePhase, cmdInitPlanPhase, cmdInitPhaseOp, cmdInitMilestoneOp, cmdInitDocument, cmdInitProgress)
- Built three new test fixtures (`createLegacyLayoutFixture`, `createPartitionedFixture`, `withStateMilestone`) and added 14 new test cases covering partition resolution, legacy fallback, cross-milestone exclusion (two-partition fixture), decimal-phase resolution in partitioned layout, and `prior_milestones[]` population
- Verified backward compatibility end-to-end: 852 pre-existing tests still pass; `node get-shit-done/bin/gsd-tools.cjs phases list` in this very (legacy-layout) repo returns the same 5 directories it did before the refactor

## Task Commits

1. **Task 1: phasesDir + relPhasesPath helpers in core.cjs; test fixtures in helpers.cjs** — `e7d9730` (feature)
2. **Task 2: refactor 12 literal `.planning/phases` sites across init/phase/uat/verify/commands** — `395895b` (refactor)
3. **Task 3: emit milestone_root/partition_root/legacy_layout_detected/prior_milestones[] in init JSON** — `2e99f51` (feature)

_Note: All three tasks committed atomically. `node bin/install.js --claude --global` was run after each task to refresh the gitignored runtime mirror at `.claude/get-shit-done/bin/lib/`._

## Files Created/Modified

- `get-shit-done/bin/lib/core.cjs` — added `phasesDir`, `relPhasesPath`, `buildMilestoneContext`; converted `planningPaths.phases` to a getter; `findPhaseInternal` uses the helper
- `get-shit-done/bin/lib/init.cjs` — refactored 8 literal sites; 6 init commands spread `buildMilestoneContext(cwd)` into their result objects; cmdInitProgress emits `prior_milestones[]`
- `get-shit-done/bin/lib/phase.cjs` — refactored 10 literal sites; cmdPhaseAdd/cmdPhaseInsert add `mkdirSync(phasesDir(cwd), {recursive:true})` before creating the per-phase subdir so the partition root is auto-created
- `get-shit-done/bin/lib/uat.cjs` — refactored 5 literal sites (2 path joins + 2 JSON file_path emissions + 1 error string)
- `get-shit-done/bin/lib/verify.cjs` — refactored 2 literal sites (cmdValidateConsistency, cmdValidateHealth)
- `get-shit-done/bin/lib/commands.cjs` — refactored 1 JSON-emit literal in cmdScaffold
- `tests/helpers.cjs` — exported `createPartitionedFixture`, `createLegacyLayoutFixture`, `withStateMilestone`
- `tests/core.test.cjs` — added 7 `phasesDir partition-aware resolution` tests
- `tests/init.test.cjs` — added 6 `Phase 05 partitioned-layout init` tests including cross-milestone exclusion and prior_milestones[] population
- `tests/phase.test.cjs` — added `phase next-decimal works inside .planning/{milestone}/phases/ partition (decimal partition)` test
- `.planning/phases/05-milestone-versioned-phase-ids/deferred-items.md` — logged pre-existing claude-md test failure as out-of-scope

## Decisions Made

- **phasesDir resolution order (4 cases):** (1) partitioned dir exists → return it; (2) partitioned dir absent + legacy exists → return legacy (back-compat fallback letting retrofit run later); (3) neither exists + milestone set → return partitioned (writer creates); (4) no milestone in STATE.md → return legacy
- **Local-variable rename pattern:** Inside each lib function, the literal `const phasesDir = path.join(cwd, '.planning', 'phases')` was renamed to `const phasesRoot = phasesDir(cwd)` to avoid shadowing the imported helper of the same name. All in-function references updated via scoped sed to `phasesRoot`
- **JSON contract: additive only.** `buildMilestoneContext(cwd)` returns `{milestone_root, partition_root, legacy_layout_detected}` and is spread into each init command's result via `...buildMilestoneContext(cwd)`. Existing keys (`phase_dir`, `phase_number`, `padded_phase`, `phases[].directory`, `recent_summaries[].path`, etc.) are unchanged in shape — Plan 05-02 reads `milestone_root` + `legacy_layout_detected` to decide whether to run the retrofit migration
- **cmdInitProgress.prior_milestones[] is wave-1-shipped:** the field exists and is empty until 05-03 produces SUMMARY.md files in `.planning/{ver}/`, then auto-populates. SC-6 is verifiable now (cross-milestone exclusion test + field existence)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Local-variable name collision with imported helper**
- **Found during:** Task 2 (refactoring phase.cjs)
- **Issue:** Many functions in phase.cjs/init.cjs/verify.cjs declared `const phasesDir = path.join(cwd, '.planning', 'phases')` as a local variable. Importing `phasesDir` from core.cjs would have been shadowed by these locals, defeating the refactor.
- **Fix:** Renamed all local variables to `phasesRoot` and update in-body usages via scoped sed (per function line-range). The imported `phasesDir` helper is now accessible inside each function for the `const phasesRoot = phasesDir(cwd)` initializer.
- **Files modified:** init.cjs, phase.cjs, verify.cjs
- **Verification:** `grep "phasesDir" lib/*.cjs` shows only import lines + helper call sites — no remaining local-variable declarations colliding with the helper.
- **Committed in:** 395895b (Task 2)

**2. [Rule 2 - Missing critical functionality] cmdPhaseAdd/cmdPhaseInsert must auto-create partition root**
- **Found during:** Task 2 (refactoring phase.cjs)
- **Issue:** When `phasesDir(cwd)` returns the partitioned path `.planning/v1.4/phases/` but `.planning/v1.4/` doesn't yet exist, `fs.mkdirSync(path.join(phasesDir(cwd), dirName))` would fail (parent missing).
- **Fix:** Added `fs.mkdirSync(phasesRoot, { recursive: true })` immediately before the per-phase subdir creation in both `cmdPhaseAdd` and `cmdPhaseInsert`. The `recursive: true` flag makes this a no-op on legacy layouts where the dir already exists.
- **Files modified:** phase.cjs
- **Verification:** Pre-existing 852-test suite still green; the new partition-aware decimal-resolution test exercises this path implicitly via createPartitionedFixture.
- **Committed in:** 395895b (Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical functionality)
**Impact on plan:** Both fixes essential for correctness of the partition-aware refactor. No scope creep — both were inevitable consequences of introducing the helper without renaming locals.

## Issues Encountered

- **Pre-existing test failure (out of scope):** `tests/claude-md.test.cjs` — "new-project artifacts mention CLAUDE.md" — fails with `ENOENT: docs/COMMANDS.md`. Verified pre-existing on `main` HEAD (14a3a10) before any Plan 05-01 changes were applied via `git stash && npm test`. Unrelated to milestone partitioning. Logged in `deferred-items.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for Plan 05-02 (retrofit migration):** Plan 05-02 will read `init progress` output → check `milestone_root` and `legacy_layout_detected` → on `true`, run the `git mv .planning/phases .planning/{milestone}/phases` migration, then sweep references in PROJECT.md/STATE.md/ROADMAP.md/cross-phase-notes.md/todos/quick. All read-side support is now in place; 05-02 only needs to add the write path.
- **Ready for Plan 05-03 (milestone-complete distillation writer):** 05-03 will write `.planning/{ver}/SUMMARY.md` files at milestone close. The `prior_milestones[]` field in `init progress` is wave-1-shipped and ready to surface those summaries as soon as they exist.
- **Cross-milestone isolation verified:** The two-partition test fixture proves `cmdInitProgress.phases[]` only includes the active milestone — load-bloat reduction goal for `/gsd2:progress` is structurally in place.

## Self-Check: PASSED

Verified:
- All 3 task commits exist in git log (`e7d9730`, `395895b`, `2e99f51`)
- 14 new test cases (7 core + 6 init + 1 phase) all pass under `npm test`
- Full suite: 866 pass / 1 fail (pre-existing, logged in deferred-items.md)
- CLI smoke-test in this (legacy-layout) repo: `init phase-op 04` emits `milestone_root: v1.4`, `legacy_layout_detected: true`
- Zero literal `path.join(cwd, '.planning', 'phases')` sites remain in lib/ outside core.cjs's `phasesDir` definition itself
- Zero literal JSON-emit strings `'.planning/phases/'` remain in lib/

---
*Phase: 05-milestone-versioned-phase-ids*
*Completed: 2026-05-12*

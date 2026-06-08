---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: 03
subsystem: testing, infra
tags: [health-check, symmetry, drift-detection, settings-parity, tdd]

# Dependency graph
requires:
  - phase: 06-skill-self-sufficiency-audit-and-port-superpo
    provides: PATH-TOKEN RULE decision (source agents/ use ~/.claude/ token, runtime uses absolute path)
provides:
  - checkSourceRuntimeSymmetry exported from verify.cjs for execute-phase reuse (07-06)
  - validate health reports source↔runtime file-tree drift (E-DRIFT) and settings.json parity drift (E-SETTINGS-DRIFT) in one invocation
  - --repair re-syncs drifted source→runtime files, excludes agents/
  - health.md documents the two-part symmetry-check and PATH-TOKEN exclusion
affects: [07-06, any consumer of verify.cjs exports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "checkSourceRuntimeSymmetry: Node.js file-walk (not shell diff) for testability; returns {fileMismatches, settingsMismatches, runtimeAbsent, settingsAbsent}"
    - "Expected hooks derived from install.js constants — no hardcoded invented list"
    - "Source→runtime mirror: write source, cp to runtime, assert diff -q"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/verify.cjs
    - .claude/get-shit-done/bin/lib/verify.cjs
    - get-shit-done/workflows/health.md
    - .claude/get-shit-done/workflows/health.md
    - tests/verify-health.test.cjs

key-decisions:
  - "Expected hooks list derived from install.js install path, not invented; matches what installer writes to settings.json"
  - "settings.json parity is report-only (E-SETTINGS-DRIFT, repairable=false) — installer owns settings.json; file-tree drift is repairable (E-DRIFT, repairable=true)"
  - "runtimeAbsent and settingsAbsent both skip cleanly (info, not error) — uninstalled checkout is not broken"
  - "checkSourceRuntimeSymmetry exported from verify.cjs for 07-06 post-merge reuse"

patterns-established:
  - "TDD: write failing tests first (RED commit), then implement to GREEN commit"
  - "Symmetry check uses Node.js fs walk, not shell diff — deterministic, portable, testable in isolation"

requirements-completed: [SC4]

# Metrics
duration: 25min
completed: 2026-06-08
---

# Phase 7 Plan 03: Source↔Runtime Symmetry Check Summary

**`/gsd2:health` now reports source↔runtime file-tree drift (E-DRIFT, excluding agents/) and settings.json hook/statusLine parity drift (E-SETTINGS-DRIFT) in one invocation, with `--repair` re-syncing file drift and `checkSourceRuntimeSymmetry` exported for execute-phase post-merge reuse.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-08T08:XX:00Z
- **Completed:** 2026-06-08
- **Tasks:** 2 (Task 1: TDD implementation, Task 2: documentation)
- **Files modified:** 5

## Accomplishments

- Implemented `checkSourceRuntimeSymmetry(cwd)` with SUB-CHECK A (file-tree, agents/ excluded) and SUB-CHECK B (settings.json hooks/statusLine parity) folded into `cmdValidateHealth` as Check 9
- Exported `checkSourceRuntimeSymmetry` from `verify.cjs` for Plan 07-06 post-merge drift step
- Added `syncSourceRuntime` repair action: copies source→runtime, preserving PATH-TOKEN exclusion for agents/
- Added 8 new tests (TDD: RED commit first, then GREEN) covering drift, no-drift, agents/ exclusion, settings parity, repair, and skip-clean branches
- Documented the two-part symmetry-check in health.md including PATH-TOKEN exclusion, /gsd2:doctor name reservation, and --repair behavior table

## Task Commits

1. **Task 1 RED: add failing symmetry-check tests** - `c821894` (test)
2. **Task 1 GREEN: implement checkSourceRuntimeSymmetry** - `0c3eece` (feat)
3. **Task 2: document symmetry-check in health.md** - `9deb007` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/verify.cjs` — added `checkSourceRuntimeSymmetry`, Check 9 block in `cmdValidateHealth`, `syncSourceRuntime` repair case, export
- `.claude/get-shit-done/bin/lib/verify.cjs` — mirror copy (byte-identical)
- `get-shit-done/workflows/health.md` — added error codes E-DRIFT/E-SETTINGS-DRIFT/I003/I004 to table, added `<symmetry_check>` section
- `.claude/get-shit-done/workflows/health.md` — mirror copy (byte-identical)
- `tests/verify-health.test.cjs` — new `describe('source-runtime symmetry check')` block, 8 tests

## Decisions Made

- Expected hooks list is derived from the install.js install path (not invented). Parity check is grep-verifiable: the hook script names appear explicitly in the code.
- Settings parity is not auto-repairable — installer owns settings.json. File-tree drift IS repairable via cp.
- Both skip-clean branches (runtime absent, settings absent) emit info codes, not errors — an uninstalled source checkout is not broken.
- Repair action name is `syncSourceRuntime` (consistent with the check name pattern).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Running `validate health` against the real repo revealed genuine pre-existing drift (~50 files where `.claude/get-shit-done/` runtime lags behind `get-shit-done/` source). This is correct behavior — the check is detecting real drift, not a false positive. Settings parity showed no drift (all hooks correctly registered). The drift does not block this plan; it will be repaired when `--repair` is run or files are synced.

## Next Phase Readiness

- Plan 07-06 can `require('./verify.cjs').checkSourceRuntimeSymmetry` directly to call the post-merge drift step without spawning a new health invocation.
- The check is tested and exported; 07-06 only needs to wire the call site.

## Self-Check: PASSED

Files confirmed:
- `get-shit-done/bin/lib/verify.cjs` — function exists, exported, agents/ exclusion, settings.json/hooks/statusLine references present
- `.claude/get-shit-done/bin/lib/verify.cjs` — diff -q passes
- `get-shit-done/workflows/health.md` — symmetry/source-runtime, settings.json, agents, doctor references all present
- `.claude/get-shit-done/workflows/health.md` — diff -q passes
- Commits c821894, 0c3eece, 9deb007 — all in git log

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-08*

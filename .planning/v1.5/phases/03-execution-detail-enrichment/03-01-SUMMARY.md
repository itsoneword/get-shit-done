---
phase: 03-execution-detail-enrichment
plan: 01
subsystem: tooling
tags: [reference-docs, bug-patterns, python, verifier, dual-tree]

# Dependency graph
requires: []
provides:
  - common-bug-patterns.md reference doc (11 language-agnostic categories + Python-Specific Bugs section)
  - Eager-load wiring of common-bug-patterns.md into verify-phase.md required_reading block
affects: [verify-phase, future-python-projects]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port-then-extend: source doc ported verbatim, Python section appended before closing XML tag"
    - "Byte-identical dual-tree via cp: write source once, cp to runtime to guarantee diff -q passes"
    - "Per-tree path forms: source uses tilde token (~/.claude/), runtime uses absolute path"

key-files:
  created:
    - get-shit-done/references/common-bug-patterns.md
    - .claude/get-shit-done/references/common-bug-patterns.md (runtime, gitignored)
  modified:
    - get-shit-done/workflows/verify-phase.md
    - .claude/get-shit-done/workflows/verify-phase.md (runtime, gitignored)

key-decisions:
  - "cp after Write for byte-identity: write source once, cp to runtime — avoids any whitespace divergence"
  - "Python section placed immediately before </patterns> closing tag, after the 11 language-agnostic categories"
  - "Integer division entry kept (historical note) as it is useful context, not excess"

patterns-established:
  - "Dual-tree write: write source file, cp to runtime; never hand-write twice"
  - "verify-phase.md diff exemption: tilde vs absolute path forms legitimately differ; do not diff -q those files"

requirements-completed: [GUIDE-01, GUIDE-02]

# Metrics
duration: 16min
completed: 2026-06-04
---

# Phase 03 Plan 01: Common Bug Patterns Reference Summary

**common-bug-patterns.md ported from gsd-core (11 categories verbatim), extended with Python-Specific Bugs section, and eager-loaded into verify-phase.md in both trees**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-04T20:28:51Z
- **Completed:** 2026-06-04T20:45:33Z
- **Tasks:** 2
- **Files modified:** 4 (2 source-committed, 2 runtime-gitignored)

## Accomplishments

- Created common-bug-patterns.md (125 lines, under 150 limit) by porting the 11-category gsd-core source verbatim, then appending a Python-Specific Bugs section with 8 patterns (mutable default argument, late-binding closures, `is` vs `==`, implicit None return, bare except, generator exhaustion, shallow copy, integer division)
- Wrote byte-identical copies to both source tree (`get-shit-done/references/`) and runtime tree (`.claude/get-shit-done/references/`) using cp — diff -q exits 0
- Added eager-load line inside `<required_reading>` in both trees of verify-phase.md, using each tree's own path form (tilde token in source, absolute path in runtime)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author common-bug-patterns.md (port + Python-Specific Bugs) in both trees** - `70c0d6e` (feat)
2. **Task 2: Eager-load common-bug-patterns.md in verify-phase.md (both trees)** - `db683cf` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `get-shit-done/references/common-bug-patterns.md` - New reference doc: 11 bug-pattern categories + Python-Specific Bugs, under 150 lines
- `.claude/get-shit-done/references/common-bug-patterns.md` - Runtime copy (byte-identical; gitignored)
- `get-shit-done/workflows/verify-phase.md` - Added `@~/.claude/get-shit-done/references/common-bug-patterns.md` inside `<required_reading>`
- `.claude/get-shit-done/workflows/verify-phase.md` - Added absolute-path equivalent inside `<required_reading>` (gitignored)

## Decisions Made

- Used `cp` after `Write` to ensure byte-identity between trees (avoids any subtle whitespace divergence from writing twice)
- Python-Specific Bugs section placed immediately before `</patterns>` closing tag, after all 11 language-agnostic categories, matching the plan's "INSERT one new section immediately before the closing `</patterns>` tag" instruction
- Kept integer division entry in Python section as historical context (useful for mixed-version codebases)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GUIDE-01 (bug-pattern half) satisfied: common-bug-patterns.md exists in both trees and is eager-loaded by the verifier
- GUIDE-02 (Python-bugs half) satisfied: `## Python-Specific Bugs` section present
- Plan 02 (universal-anti-patterns.md + planner wiring) can proceed independently

---
*Phase: 03-execution-detail-enrichment*
*Completed: 2026-06-04*

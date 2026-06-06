---
phase: 06-skill-self-sufficiency-audit-and-port-superpo
plan: 01
subsystem: testing
tags: [tdd, iron-law, gsd-executor, gsd-planner, execute-plan]

# Dependency graph
requires: []
provides:
  - Iron Law enforcement in tdd.md (mandatory watch-it-fail, rationalization table, red flags, agent-change exemption)
  - Hardened TDD execution blocks in gsd-executor and execute-plan (STOP/watch-it-fail, Iron Law reference)
  - Agent/prompt/workflow/reference exemption in gsd-planner TDD Detection (all 3 copies)
affects: [07-worktree, any phase using tdd=true tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Iron Law pattern: no production code without failing test; STOP-before-continuing enforced in executor RED step"
    - "Agent-change exemption: prompt/reference/workflow-only edits marked tdd=false explicitly"
    - "Source-runtime mirror: reference files cp'd byte-identical; agent/workflow files edited with path-token substitution"

key-files:
  modified:
    - get-shit-done/references/tdd.md
    - .claude/get-shit-done/references/tdd.md
    - agents/gsd-executor.md
    - .claude/agents/gsd-executor.md
    - get-shit-done/workflows/execute-plan.md
    - .claude/get-shit-done/workflows/execute-plan.md
    - agents/gsd-planner.md
    - .claude/agents/gsd-planner.md
    - .claude/gsd-local-patches/agents/gsd-planner.md

key-decisions:
  - "Watch-it-fail enforcement inserted inline into RED step text rather than as a separate sub-step to keep the flow compact"
  - "exempt from tdd text written as plain text (not backtick-wrapped) in execution_flow line so grep -qi 'exempt from tdd' matches correctly"
  - "gsd-local-patches third copy received only the narrow exemption-clause edit; its 2-line divergence from source was preserved"

patterns-established:
  - "Three-copy rule for gsd-planner.md: source + runtime + gsd-local-patches all receive the same narrow edits"
  - "Path-token rule: reference files use cp for runtime twin; agent/workflow files use identical text edits with ~/ -> absolute substitution"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-06-06
---

# Phase 6 Plan 01: TDD Execution-Time Discipline (Gap 1) Summary

**Iron Law, mandatory watch-it-fail, rationalization table, red flags, and agent-change exemption ported from superpowers into tdd.md, gsd-executor, execute-plan, and gsd-planner (all 3 copies)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-06T18:15:00Z
- **Completed:** 2026-06-06T18:32:42Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Extended `tdd.md` with the Iron Law (NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST), mandatory watch-it-fail, 11-row rationalization table, 13 red flags with Delete-code conclusion, and agent/prompt/workflow/reference exemption clause
- Hardened gsd-executor `<tdd_execution>` RED step with STOP/watch-it-fail enforcement and Iron Law reference; added rationalization counter; extended `execute_tasks` line with exemption note
- Hardened `execute-plan.md` `<tdd_plan_execution>` RED step with STOP/watch-it-fail enforcement
- Added TDD Detection exemption clause to all three copies of gsd-planner.md (source, runtime twin, and gsd-local-patches diverged copy)

## Task Commits

1. **Task 1: Extend tdd.md with Iron Law, watch-it-fail, rationalization table, red flags, agent-change exemption** - `5fae88b` (feat)
2. **Task 2: Harden watch-it-fail enforcement in gsd-executor and execute-plan TDD blocks** - `e21deb3` (feat)
3. **Task 3: Add agent-change exemption clause to gsd-planner TDD Detection (all three copies)** - `c96fb7f` (feat)

## Files Created/Modified

- `get-shit-done/references/tdd.md` — Appended `<execution_discipline>` section with Iron Law, watch-it-fail, rationalization table, red flags, agent-change exemption
- `.claude/get-shit-done/references/tdd.md` — Byte-identical runtime twin (cp'd from source)
- `agents/gsd-executor.md` — Hardened `<tdd_execution>` RED step + rationalization counter + `execute_tasks` exemption note
- `.claude/agents/gsd-executor.md` — Runtime twin (identical edits with absolute path tokens)
- `get-shit-done/workflows/execute-plan.md` — Hardened `<tdd_plan_execution>` RED step with STOP/watch-it-fail
- `.claude/get-shit-done/workflows/execute-plan.md` — Runtime twin (identical edit with absolute path tokens)
- `agents/gsd-planner.md` — Added exemption clause after TDD Detection paragraph (source)
- `.claude/agents/gsd-planner.md` — Runtime twin (identical text, no path tokens in this clause)
- `.claude/gsd-local-patches/agents/gsd-planner.md` — Third copy, narrow exemption-clause edit only

## Decisions Made

- Watch-it-fail enforcement inserted inline in RED step text (compact) rather than as a separate sub-step
- `exempt from tdd` written as plain text in execution_flow description so grep acceptance criteria match without backtick wrapping
- gsd-local-patches third copy received only the Gap 1 exemption-clause; its existing 2-line divergence from source was deliberately preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed "exempt from tdd" grep mismatch**
- **Found during:** Task 2 verification
- **Issue:** Initial text wrote `exempt from \`tdd="true"\`` which grep `-qi "exempt from tdd"` does not match because the backtick precedes "tdd"
- **Fix:** Changed to `exempt from tdd="true" tagging` (no backtick wrapping) so the acceptance criteria grep passes
- **Files modified:** agents/gsd-executor.md, .claude/agents/gsd-executor.md
- **Verification:** `grep -qi "exempt from tdd" agents/gsd-executor.md` now returns PASS
- **Committed in:** e21deb3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor text adjustment to satisfy acceptance criteria grep pattern. Semantics unchanged.

## Issues Encountered

None beyond the grep mismatch (documented above as a deviation).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap 1 (TDD execution-time discipline) fully ported and verified
- All 12 acceptance criteria pass (ALL GAP-1 PASS)
- Ready for Phase 6 Plans 02-03 (receiving-code-review, artifact-authoring, git-worktree)

---
*Phase: 06-skill-self-sufficiency-audit-and-port-superpo*
*Completed: 2026-06-06*

## Self-Check: PASSED

Files verified:
- get-shit-done/references/tdd.md: FOUND
- .claude/get-shit-done/references/tdd.md: FOUND (byte-identical)
- agents/gsd-executor.md: FOUND
- .claude/agents/gsd-executor.md: FOUND
- get-shit-done/workflows/execute-plan.md: FOUND
- .claude/get-shit-done/workflows/execute-plan.md: FOUND
- agents/gsd-planner.md: FOUND
- .claude/agents/gsd-planner.md: FOUND
- .claude/gsd-local-patches/agents/gsd-planner.md: FOUND

Commits verified: 5fae88b, e21deb3, c96fb7f

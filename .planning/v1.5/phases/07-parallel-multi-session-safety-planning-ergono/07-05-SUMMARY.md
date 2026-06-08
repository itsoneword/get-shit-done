---
phase: 07-parallel-multi-session-safety-planning-ergono
plan: 05
subsystem: tooling
tags: [parallel-safety, gate, depends_on, axis-b, axis-a, file-overlap, todo-edges, gsd-tools, tdd]

requires:
  - phase: 07-02
    provides: todo depends_on/related_to frontmatter schema (gate reads todo edges)
  - phase: 07-04
    provides: worktree.cjs + gsd-tools cases added before this plan runs

provides:
  - get-shit-done/bin/lib/parallel-gate.cjs — cmdParallelSafe(cwd, unitA, unitB, raw)
  - gsd-tools parallel-safe <A> <B> — JSON {safe, axis_b_coupled, axis_a_overlap, overlap_files, decision, reason}
  - SC2 complete: deterministic gate deciding refuse/warn/greenlight from depends_on + file-scope
  - SC3 read-half: gate reads todo depends_on edges referencing phase:N as axis-B coupling

affects: [07-06, execute-phase, discuss-phase, plan-phase]

tech-stack:
  added: []
  patterns:
    - "Shell out to gsd-tools subcommands for data reads (cmd fns call process.exit; in-process would corrupt output)"
    - "Todo file-existence check before phase-number classification (date-prefixed slugs start with digit)"
    - "related_to is context-only; only depends_on triggers axis-B coupling"

key-files:
  created:
    - get-shit-done/bin/lib/parallel-gate.cjs
    - .claude/get-shit-done/bin/lib/parallel-gate.cjs
    - tests/parallel-gate.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - .claude/get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "Shell out for roadmap analyze + phase-plan-index (process.exit in output() makes in-process calls corrupt stdout)"
  - "Resolve todo file existence FIRST then fall back to phase-number form (date-prefixed slugs start with digit and would falsely match phase pattern)"
  - "related_to on todos is context-only — does NOT trigger axis-B refuse (documented in code)"
  - "Gate lives in its own lib file; roadmap.cjs untouched"

patterns-established:
  - "parallel-gate: refuse on depends_on edge (unrecoverable); warn on file overlap (reviewable at merge); greenlight when disjoint"

requirements-completed: [SC2, SC3]

duration: 51min
completed: 2026-06-08
---

# Phase 07 Plan 05: Parallel Gate Summary

**Deterministic `gsd-tools parallel-safe <A> <B>` gate using depends_on (axis-B refuse) + files_modified intersection (axis-A warn), reading both phase roadmap edges and todo frontmatter edges (SC2 + SC3 read-half)**

## Performance

- **Duration:** ~51 min
- **Started:** 2026-06-08T10:15:52Z
- **Completed:** 2026-06-08T11:07:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4 (parallel-gate.cjs × 2, gsd-tools.cjs × 2) + 1 new test file

## Accomplishments

- New `get-shit-done/bin/lib/parallel-gate.cjs` implementing `cmdParallelSafe` — axis-B (depends_on) refuses, axis-A (file overlap) warns, disjoint greenlights
- `gsd-tools parallel-safe <A> <B>` CLI case wired; help block updated
- 7 TDD tests covering: axis-B refuse, reverse edge refuse, axis-A warn, greenlight, same-unit N/A, todo depends_on edge (SC3), required field presence
- Smoke test against real ROADMAP: `parallel-safe 6 7` returns refuse (Phase 7 depends_on text contains "Phase 6")
- Full test suite: 942 tests, 0 failures
- Source↔runtime mirror: both copies identical (diff -q passes)
- roadmap.cjs: untouched

## Task Commits

1. **Task 1 RED: add failing tests for parallel-gate** - `43ebe7f` (test)
2. **Task 1 GREEN: implement parallel-gate.cjs + wire command** - `f7bf5a9` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/parallel-gate.cjs` — new lib: cmdParallelSafe, axis-A/B logic, todo edge reading
- `.claude/get-shit-done/bin/lib/parallel-gate.cjs` — mirror (cp from source)
- `get-shit-done/bin/gsd-tools.cjs` — require + case 'parallel-safe' + help block entry
- `.claude/get-shit-done/bin/gsd-tools.cjs` — mirror (cp from source)
- `tests/parallel-gate.test.cjs` — 7 TDD tests for SC2 + SC3

## Decisions Made

- **Shell out for data reads:** `cmdRoadmapAnalyze` and `cmdPhasePlanIndex` call `output()` which calls `process.exit(0)`. Calling them in-process from within the gate's `output()` call would corrupt stdout with two JSON blobs and then terminate. Shell out via `execFileSync` and parse captured stdout — cleanest isolation and matches the "if reusing CLI JSON is cleaner, document it" guidance in the plan.

- **Todo resolution order:** Check for todo file existence (`todos/pending/<slug>.md`, `todos/completed/<slug>.md`) BEFORE treating the string as a phase number. This is critical because real todo slugs are date-prefixed (e.g. `260508-u0b-task`) and start with a digit — a phase-number-first check would falsely classify them as phases.

- **related_to is context-only:** A todo's `related_to` field documents related context but does NOT trigger axis-B coupling. Only `depends_on` triggers refuse. Documented in code comments.

## Deviations from Plan

None — plan executed exactly as written.

The smoke test `parallel-safe 6 7` returns `refuse` against the real ROADMAP because Phase 7's `**Depends on**` text contains the string "Phase 6" (the string match is substring-based). This matches the plan's verification expectation.

## Issues Encountered

- The advisor's pre-implementation check flagged that `output()` in core.cjs calls `process.exit(0)`, meaning `cmdRoadmapAnalyze` can't be called in-process within `cmdParallelSafe`. The shelling-out approach resolved this cleanly.
- Advisor also flagged the todo resolution order pitfall: date-prefixed slugs match `^B?\d` as phase numbers. Fixed by checking file existence first.

## Next Phase Readiness

- `parallel-safe` gate is fully functional and tested
- Plan 07-06 wires it into execute-phase/discuss-phase/plan-phase workflows
- `checkSourceRuntimeSymmetry` (from 07-04) is available for post-merge reuse in 07-06

---
*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Completed: 2026-06-08*

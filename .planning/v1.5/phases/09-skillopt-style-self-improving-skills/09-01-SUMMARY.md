---
phase: 09-skillopt-style-self-improving-skills
plan: 01
subsystem: tooling
tags: [lesson-ledger, jsonl, gsd-tools, attribution, auto-miner, tdd]

# Dependency graph
requires:
  - phase: 04-agent-observability-telemetry
    provides: trace.cjs readTrace/filterTrace used by pickAttribution
provides:
  - JSONL lessons ledger at .planning/lessons/lessons.jsonl
  - lib/lesson.cjs with full CRUD + attribution + scoped scan
  - gsd-tools lesson subcommand (append/list/update/bump-recurrence/attribute/scan)
  - attributeFile() pure function mapping agent_type -> source prose file
  - cmdScan() ledger-recurrence nominator (writes nothing)
affects:
  - 09-02 (teach command, auto-miner) — depends on lesson ledger CRUD and attribution

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONL store pattern (mirrors agent-trace.jsonl convention)
    - nextId() monotonic LSN-NNN allocator reading max existing suffix
    - Static AGENT_FILE_MAP with runtime path guards (.claude/ and gsd-local-patches/)
    - Scoped auto-miner: ledger-recurrence only in v1; BLOCKER/telemetry deferred

key-files:
  created:
    - get-shit-done/bin/lib/lesson.cjs
    - tests/lesson.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "All implementation in source (get-shit-done/ + tests/); nothing in .claude/ runtime committed"
  - "attributeFile() is a pure function with two runtime guards: .startsWith('.claude/') and .includes('gsd-local-patches/')"
  - "cmdScan is ledger-recurrence-ONLY in v1; BLOCKER/telemetry scanning deferred per scope guard (see ASSUMPTIONS below)"
  - "global raw flag already spliced from args before switch — lesson dispatch uses global raw, not re-parsed"
  - "pickAttribution lazy-requires trace.cjs to avoid circular deps"

patterns-established:
  - "lesson.cjs mirrors trace.cjs shape: readX/filterX/formatTable/cmd* handlers + module.exports"
  - "Static table pattern for agent->file attribution: O(1) lookup, unit-testable, no file I/O"

requirements-completed: [TEACH-01, TEACH-03, TEACH-04]

# Metrics
duration: 15min
completed: 2026-06-08
---

# Phase 9 Plan 01: Lessons Ledger Data Layer Summary

**JSONL lesson store at `.planning/lessons/lessons.jsonl` with full CRUD CLI, static agent-type-to-source-file attribution function, and ledger-recurrence-only auto-miner nominator**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-08T15:40:39Z
- **Completed:** 2026-06-08T15:56:02Z
- **Tasks:** 3 (TDD: RED + GREEN CRUD + GREEN attribution/scan)
- **Files modified:** 3

## Accomplishments

- `lib/lesson.cjs` created with full CRUD: `readLessons`, `filterLessons`, `nextId`, `cmdAppend`, `cmdList`, `cmdUpdate`, `cmdBumpRecurrence`
- Attribution layer: `AGENT_FILE_MAP` static table (8 entries) + `attributeFile()` pure function with `.claude/` and `gsd-local-patches/` path guards + `pickAttribution()` (reads telemetry only when no `--agent` flag)
- `cmdScan()` ledger-recurrence nominator: filters `recurrence >= threshold` AND `disposition != 'applied'`, prints nomination lines, writes nothing; threshold read from `config.json teach.recurrence_threshold` (default 3)
- 6 test groups (18 assertions) covering all subcommands — full suite 959 tests, 0 failures

## Task Commits

1. **Task 1: RED — failing tests** - `f96f4bf` (test)
2. **Task 2+3: GREEN — lesson.cjs + dispatch** - `0ca941f` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/lesson.cjs` — JSONL lessons ledger CRUD + attribution + scan (new)
- `get-shit-done/bin/gsd-tools.cjs` — added `require('./lib/lesson.cjs')` and `case 'lesson'` dispatch
- `tests/lesson.test.cjs` — 6 test groups for all subcommands (new)

## Decisions Made

- `raw` flag reuse: global `raw` is spliced from args before the switch in gsd-tools.cjs; lesson dispatch uses the global `raw`, not a re-parsed flag (discovered during GREEN; caused list tests to fail with table output instead of JSON)
- `pickAttribution` lazy-requires `trace.cjs` to avoid potential circular deps at module load time
- Attribution path: `cmdAttribute` never writes to lessons.jsonl; only the `/teach` command (Plan 02) writes ratified records
- Task 3 GREEN was delivered in the same commit as Task 2 because attribute/scan were already complete in the initial lesson.cjs write; no separate Task 3 commit needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] global `raw` flag used instead of re-parsing `--raw` in lesson dispatch**
- **Found during:** Task 2 (lesson list GREEN tests failing)
- **Issue:** gsd-tools.cjs splices `--raw` from `args` before the switch; lesson case re-read `args.includes('--raw')` which always returned false
- **Fix:** Changed `rawLesson` reads to use the global `raw` variable already in scope
- **Files modified:** get-shit-done/bin/gsd-tools.cjs
- **Verification:** lesson list tests flipped GREEN
- **Committed in:** 0ca941f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Essential for correctness; no scope creep.

## ASSUMPTIONS (Scope Guard)

**Scoped auto-miner — ledger-recurrence ONLY in v1:**
`cmdScan` nominates records with `recurrence >= threshold` from the lessons ledger only. The RESEARCH doc (Pattern 6) describes two additional auto-miner signals: VERIFICATION.md BLOCKER events and telemetry confidence-dip patterns. These are **deferred** per the plan's scope guard. The `/teach` command in Plan 02 is the primary capture mechanism; the auto-miner is a suggestion layer only.

**Runtime propagation note:** The new `lesson` subcommand is available immediately in the SOURCE `get-shit-done/bin/gsd-tools.cjs`. It will appear in the `.claude/` runtime CLI after running `npm run dev` (install.js path-replacement propagation). No manual copy step needed.

## Issues Encountered

None beyond the Rule 1 bug documented above.

## Next Phase Readiness

- Plan 02 (`/gsd2:teach` command) can immediately use `gsd-tools lesson append/update/attribute` for ledger writes
- `lesson scan` is ready for use: `gsd-tools lesson scan` in repo root exits 0 (empty ledger: "No nominations")
- All 959 automated tests green; no regressions

---
*Phase: 09-skillopt-style-self-improving-skills*
*Completed: 2026-06-08*

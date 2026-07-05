---
phase: 17-graph-algorithms-integrity-check
plan: 01
subsystem: infra
tags: [graph-algorithms, tarjan, kahn, cli, integrity-check]

# Dependency graph
requires:
  - phase: 16-planning-graph-model-cli
    provides: buildGraph(cwd) normalized {nodes,edges} model, cmdGraphAnalyze/cmdGraphExport, graph dispatch scaffold
provides:
  - topoSort/detectCycles/blastRadius pure algorithms + computeGraphIntegrity single entry point
  - gsd-tools graph validate (two-tier structural/advisory, --strict promotion)
  - gsd-tools graph blast-radius <node> (--depth, --raw)
affects: [17-02-graph-integrity-health-check, 18-consumer-repoint, 19-authoritative-promotion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tarjan SCC for precise cycle-participant detection (not Kahn's-residual over-reporting)"
    - "Two-tier validate: structural findings fatal, advisory findings warn-only, --strict promotes advisory to fatal"
    - "bespoke process.exit(<code>) CLI pattern for dual-audience (human text / --raw JSON) commands, matching migration.cjs/profile-pipeline.cjs precedent"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/graph.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/graph.test.cjs

key-decisions:
  - "Excluded files_modified-sourced depends_on edges from topoSort/detectCycles traversal (Rule 1 fix, not in original plan interfaces) — buildGraph's own docstring calls this source undirected; treating it as directed created a real false-positive 2-cycle on the live repo (plan:16-01/16-02)"
  - "detectCycles uses recursive Tarjan (per plan ASSUMPTIONS #2) — fine at current ~64-node scale"
  - "--depth degrades gracefully to unbounded on malformed input rather than erroring (per plan ASSUMPTIONS #3)"

patterns-established:
  - "STRUCTURAL_EDGE_TYPES/ADVISORY_EDGE_TYPES constants drive both dangling-ref tiering and validate's fatal/advisory split — single source of truth for the severity model"
  - "computeGraphIntegrity(graph) is the one shared detection entry point both cmdGraphValidate and Phase 17-02's /gsd2:health integration must call — no duplicated detection logic"

requirements-completed: [GRAPH-04, GRAPH-05]

# Metrics
duration: 15min
completed: 2026-07-05
---

# Phase 17 Plan 01: Graph Algorithms + Integrity Check Summary

**Code-verified topological sort, precise Tarjan-based cycle detection, a two-tier `gsd-tools graph validate` (structural=fatal/advisory=warn, `--strict` promotion), and a leveled `gsd-tools graph blast-radius <node>` — replacing LLM-eyeball cycle checking with an algorithm that immediately caught a real false "acyclic" assumption in the live repo.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-05T20:14:00Z
- **Completed:** 2026-07-05T20:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `topoSort`/`detectCycles`/`findDanglingEdges`/`findAffectsContradictions`/`computeGraphIntegrity`/`blastRadius` added to `graph.cjs`, all pure functions over `{nodes,edges}`
- `gsd-tools graph validate` and `gsd-tools graph blast-radius <node>` wired into the existing `graph` dispatch, both with text and `--raw` JSON output
- Live-repo baseline now passes plain `validate` cleanly (`Structural: 0`, `Result: PASS`), with 5 advisory `affects`-vs-`files_modified` contradiction findings surfaced (not fatal) — exactly the "clean numbers, reviewable advisory count" trust-gate shape 17-CONTEXT.md specifies

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED tests for topoSort/detectCycles/blastRadius/dangling/contradictions + validate/blast-radius CLI** - `903aea5` (test)
2. **Task 2: Implement graph algorithms + validate/blast-radius CLI (GREEN)** - `abf900d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `get-shit-done/bin/lib/graph.cjs` - added `STRUCTURAL_EDGE_TYPES`/`ADVISORY_EDGE_TYPES` consts, `topoSort`, `detectCycles`, `findDanglingEdges`, `findAffectsContradictions`, `computeGraphIntegrity`, `blastRadius`, `cmdGraphValidate`, `cmdGraphBlastRadius`; extended `module.exports`
- `get-shit-done/bin/gsd-tools.cjs` - extended the existing `case 'graph':` dispatch with `validate` (`--strict`) and `blast-radius` (`--depth`) branches
- `tests/graph.test.cjs` - 19 new tests across 7 new `describe` blocks (topoSort, detectCycles, findDanglingEdges, findAffectsContradictions, computeGraphIntegrity, blastRadius, CLI)

## Decisions Made
- Excluded `files_modified`-sourced `depends_on` edges from cycle/topo traversal (see Deviations below) — narrowly scoped to the two new functions, does not touch `buildGraph` or blur the structural/advisory severity tiers used elsewhere (dangling-ref tiering is unaffected since files_modified edges can never dangle).
- Everything else followed the plan's locked `<interfaces>` block verbatim (Kahn's for `topoSort`, recursive Tarjan for `detectCycles`, forward BFS for `blastRadius`, bespoke `process.exit` CLI pattern for `validate`/`blast-radius`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] False-positive dependency cycle from conflating undirected file-overlap edges with directed ordering edges**
- **Found during:** Task 2, live-repo verification (`gsd-tools graph validate --cwd .`)
- **Issue:** The plan's own `<established>` baseline (17-CONTEXT.md line 30) asserted the live repo's `depends_on` edges "appear acyclic" — an LLM-eyeball claim made before `detectCycles` existed. Once implemented verbatim per the plan's locked interfaces (which scope cycle detection to *all* `depends_on`-typed edges regardless of source), `detectCycles`/`gsd-tools graph validate` immediately found a real 2-cycle: `plan:16-02` has a genuine `plan_depends_on` edge to `plan:16-01` (16-02 really does depend on 16-01), but `buildGraph`'s `files_modified`-overlap edge for the same pair is drawn in the *opposite* direction (`plan:16-01 -> plan:16-02`) purely because `buildGraph` picks direction by arbitrary lexicographic id order to avoid a mirrored duplicate edge — `buildGraph`'s own docstring explicitly calls this source "undirected." Feeding an admittedly-undirected co-occurrence edge into a directed cycle detector as if it were a real ordering constraint is exactly the kind of "confident wrong answer from bad edges" this phase exists to prevent — this cycle was a modeling artifact, not a genuine unresolvable dependency.
- **Fix:** Added a `NON_ORDERING_DEPENDS_ON_SOURCES = ['files_modified']` exclusion list, applied inside `topoSort`'s and `detectCycles`' edge filters only (dangling-ref tiering via `findDanglingEdges` is untouched and unaffected, since files_modified edges are generated from existing plan pairs and can never dangle). Did not modify `buildGraph` (locked, Phase 16).
- **Files modified:** `get-shit-done/bin/lib/graph.cjs`
- **Verification:** `node get-shit-done/bin/gsd-tools.cjs graph validate --cwd .` now reports `Structural: 0` / `Result: PASS` / exit 0 (previously `Structural: 1`, `E-GRAPH-CYCLE: plan:16-01 -> plan:16-02`, exit 1); all 48 `tests/graph.test.cjs` tests still pass (none of the RED-phase fixtures relied on files_modified edges for cycle-detection behavior, so no test needed to change); full `npm test` shows zero new regressions (the 5 pre-existing failures are unrelated sandbox-permission `ENOENT /home/cleversol/.gsd` errors in `config`/`write-profile`/`generate-dev-preferences` tests, confirmed present on a stashed pre-change baseline too).
- **Committed in:** `abf900d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness — without this fix, `gsd-tools graph validate` would report a permanent false-positive structural failure on the live repo whenever a plan's declared `depends_on` direction runs opposite its `files_modified`-overlap edge's arbitrary lexicographic direction, which is exactly the scenario Phase 17 exists to catch and avoid perpetuating. No scope creep — the exclusion is scoped to two functions and does not touch `buildGraph`, `findDanglingEdges`, or any locked severity-tier boundary.

## Issues Encountered
- The plan's own acceptance criteria assumed a "clean" live-repo baseline based on a pre-implementation eyeball check (17-CONTEXT.md line 30). Implementing `detectCycles` verbatim per the locked interfaces exposed that assumption as false — resolved via the Rule 1 fix above rather than relaxing the acceptance criterion, since the fix targets a genuine modeling flaw (undirected edge treated as directed) rather than the correct algorithm behavior.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `computeGraphIntegrity(graph)` is exported and ready for Plan 17-02's `/gsd2:health` integration (GRAPH-06) — no detection logic needs to be duplicated there.
- Live-repo trust-gate machine check (a) is now clean: `Structural: 0` on plain `validate`. The human-recorded-decision half of the trust gate (b) — reviewing the 5 advisory `affects`-vs-`files_modified` contradictions and recording a proceed/withhold verdict — is explicitly out of scope for this plan (17-CONTEXT.md's Trust-gate definition) and remains for whoever runs the Phase 19 gate check.
- No blockers for Plan 17-02.

---
*Phase: 17-graph-algorithms-integrity-check*
*Completed: 2026-07-05*

## Self-Check: PASSED

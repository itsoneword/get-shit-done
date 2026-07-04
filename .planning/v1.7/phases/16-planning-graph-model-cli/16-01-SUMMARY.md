---
phase: 16-planning-graph-model-cli
plan: 01
subsystem: infra
tags: [graph, roadmap, planning-model, tdd]

# Dependency graph
requires: []
provides:
  - "roadmap.cjs depends_on_parsed array (additive, GRAPH-01) plus exported pure helpers parsePhaseSections/parseDependsOnPhaseRefs"
  - "graph.cjs buildGraph(cwd) — phase/plan nodes + depends_on edges from ROADMAP prose, PLAN depends_on frontmatter, and files_modified overlap (GRAPH-02 Part A)"
affects: [16-02-planning-graph-model-cli, 17-graph-algorithms-integrity, 18-consumer-repoint, 19-authoritative-promotion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure-parser reuse: graph.cjs requires roadmap.cjs's exported parsePhaseSections/parseDependsOnPhaseRefs instead of duplicating ROADMAP regexes (LOCKED reuse rule)"
    - "Node/edge dedup via Map(id)/Set(from|to|type|source) composite key with deterministic ascending sort for byte-identical repeat output"

key-files:
  created:
    - get-shit-done/bin/lib/graph.cjs
    - tests/graph.test.cjs
  modified:
    - get-shit-done/bin/lib/roadmap.cjs
    - tests/roadmap.test.cjs

key-decisions:
  - "wave frontmatter is descriptive-only in Phase 16 — no wave-derived graph edge or node property (per plan's ASSUMPTIONS section, LOCKED-consistent discretion)"

patterns-established:
  - "Pattern: pure module (no network/process.exit) exporting node/edge builders, unit-tested directly via require() rather than shelling out through gsd-tools CLI dispatch (CLI wiring deferred to a later plan)"

requirements-completed: [GRAPH-01, GRAPH-02]

# Metrics
duration: 15min
completed: 2026-07-04
---

# Phase 16 Plan 01: Planning Graph Model Foundation Summary

**roadmap.cjs additively exposes parsed phase depends_on node-ids and two reusable pure helpers; new graph.cjs builds phase/plan nodes and depends_on edges from three of the seven planning-graph edge sources, with zero behavior change to any existing roadmap.cjs caller.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-04T16:25:00Z (approx.)
- **Completed:** 2026-07-04T16:36:48Z
- **Tasks:** 2 (TDD RED then GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `roadmap.cjs` now exports `parsePhaseSections(content)` and `parseDependsOnPhaseRefs(rawDependsOn)` as standalone pure functions (pure refactor of the pre-existing inline phase-heading/`**Depends on**:` scan), and `roadmap analyze` additionally emits `depends_on_parsed: string[]` per phase (e.g. `["phase:11","phase:12"]`) alongside the unchanged raw `depends_on` string.
- New `get-shit-done/bin/lib/graph.cjs` (pure, no network/process.exit) exports `buildGraph(cwd)`, `refToNodeId(str)`, and `resolvePlanDepRef(item, currentPhaseNum)`. `buildGraph` produces `phase:<N>` and `plan:<N>-<PP>` nodes plus `depends_on` edges from: ROADMAP `**Depends on**:` prose (via roadmap.cjs's shared helpers — zero duplicated regex), PLAN frontmatter `depends_on` (both cross-phase `"NN-NN"` and bare same-phase `"NN"` forms), and `files_modified` array overlap between plans (one deduped, lexicographically-ordered edge per pair).
- Deterministic output: nodes sorted ascending by `id`, edges sorted by `(from, to, type, source)`, verified byte-identical (`JSON.stringify`) across repeated `buildGraph` calls on the same fixture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED tests for roadmap.cjs depends_on_parsed/exports and graph.cjs buildGraph (Part A)** - `7996f57` (test)
2. **Task 2: Implement roadmap.cjs depends_on_parsed/exports and graph.cjs buildGraph Part A (GREEN)** - `7bb38d7` (feat)

**Plan metadata:** (this commit) - `docs(16-01): complete plan`

_Note: TDD task 1 is RED (failing tests), task 2 is GREEN (implementation) — no separate refactor commit needed._

## Files Created/Modified
- `get-shit-done/bin/lib/graph.cjs` - New pure module: `buildGraph`/`refToNodeId`/`resolvePlanDepRef`
- `get-shit-done/bin/lib/roadmap.cjs` - Extracted `parsePhaseSections`/`parseDependsOnPhaseRefs`, added `depends_on_parsed` field, exported both helpers
- `tests/graph.test.cjs` - New: 16 tests covering `refToNodeId`, `resolvePlanDepRef`, and `buildGraph` node/edge/dedup/determinism behavior
- `tests/roadmap.test.cjs` - Added 6 tests covering `depends_on_parsed` (multi-phase, "Nothing", absent, decimal) and the `parsePhaseSections`/`parseDependsOnPhaseRefs` export contract

## Decisions Made
- `wave` frontmatter stays descriptive-only in this phase — no wave-derived edge or node property (matches the plan's ASSUMPTIONS section; a future phase can add wave-implied ordering edges if needed).
- No scope creep: did not add CLI dispatch (`cmdGraphAnalyze`/`cmdGraphExport`), SUMMARY `requires`/`provides`/`affects` edges, `key_links` wires edges, requirement `satisfies` edges, or todo edges — all correctly deferred to Plan 16-02 per the plan's stated split.

## Deviations from Plan

None - plan executed exactly as written. One process correction (not a plan deviation): the Task 1 commit initially swept in two unrelated files from a concurrent parallel session's staged index (`.planning/STATE.md`, a quick-task SUMMARY.md) because `git commit -m` without a pathspec commits the entire index, not just the files passed to `git add`. Caught immediately via `git show --stat HEAD`, corrected with `git reset --soft HEAD~1` + `git restore --staged` on the foreign files + re-commit scoped with an explicit `-- <files>` pathspec. All subsequent commits in this plan used explicit pathspecs. No planning-graph code was affected; no unrelated work was lost or discarded (the other session's staged changes were simply unstaged back to their prior state, not modified).

## Issues Encountered
None beyond the git index correction described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 16-02 can proceed: it completes the model (SUMMARY `requires`/`provides`/`affects` edges, PLAN `key_links` wires edges, requirement traceability `satisfies` edges, todo edges) and wires `gsd-tools graph analyze|export` CLI dispatch, reusing this plan's `buildGraph`, node/edge dedup+sort conventions, and `refToNodeId`/`resolvePlanDepRef` helpers.
- `npm test` full suite: 1148/1153 pass. The 5 failing tests (`config.test.cjs` "detects Brave Search from file-based key" + defaults-merge tests, `profile-output.test.cjs` write-profile/generate-dev-preferences tests) are pre-existing, unrelated to this plan (`ENOENT: /home/cleversol/.gsd` — a sandboxed-filesystem environment issue in unrelated config/profile modules, confirmed present before this plan's changes and out of scope per the deviation rules' scope boundary).

---
*Phase: 16-planning-graph-model-cli*
*Completed: 2026-07-04*

## Self-Check: PASSED

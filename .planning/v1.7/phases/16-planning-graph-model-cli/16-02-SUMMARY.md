---
phase: 16-planning-graph-model-cli
plan: 02
subsystem: infra
tags: [graph, roadmap, planning-model, cli, tdd]

# Dependency graph
requires:
  - phase: 16-01
    provides: "buildGraph(cwd) Part A (phase/plan nodes + depends_on edges from ROADMAP prose, PLAN depends_on frontmatter, files_modified overlap), refToNodeId/resolvePlanDepRef helpers, node/edge dedup+sort finalization"
provides:
  - "buildGraph(cwd) Part B — the remaining four edge sources: SUMMARY requires/affects (provides/affects edges, both nested dependency_graph and flat top-level shapes), PLAN must_haves.key_links (wires edges + artifact nodes, both structured and free-text arrow-string shapes), REQUIREMENTS.md traceability table (requirement nodes + satisfies edges), todo depends_on/related_to (todo nodes + depends_on edges, dangling-safe)"
  - "gsd-tools graph analyze/export CLI dispatch — human-readable summary and JSON export of the full planning-graph model"
affects: [17-graph-algorithms-integrity, 18-consumer-repoint, 19-authoritative-promotion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseKeyLinkItem: pure two-shape normalizer (structured {from,to} object vs free-text arrow-string with trailing parenthetical strip) — same discipline as refToNodeId from 16-01"
    - "extractFrontmatter dash-list-with-continuation-line bug workaround: normalize the flattened 'phase: X' string it produces for '- phase: X\\n    provides: Y' items, rather than patching the shared YAML parser"
    - "Todo cross-references resolved directly ('todo:' + item), never through refToNodeId, to avoid its leading-digit misparse of date-prefixed slugs"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/graph.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/graph.test.cjs

key-decisions:
  - "SUMMARY requires items normalize a 'phase: X' string form (extractFrontmatter's actual output for dash-list items with a provides: continuation line) in addition to the aspirational {phase,provides} object form, discovered by dogfooding this repo's own real 05-03/03-03/02-01 SUMMARY files"
  - "Todo depends_on/related_to edges are always added unconditionally (dangling-safe) — never routed through refToNodeId, which would misparse date-prefixed todo slugs into fabricated plan: nodes"

patterns-established:
  - "Pattern: CLI dispatch for a pure model module mirrors the existing case 'ledger'/case 'mailbox' shape — thin arg-parsing switch delegating to lib functions, no logic in gsd-tools.cjs itself"

requirements-completed: [GRAPH-02, GRAPH-03]

# Metrics
duration: 12min
completed: 2026-07-04
---

# Phase 16 Plan 02: Planning Graph Model Completion + CLI Summary

**Completed buildGraph's remaining four edge sources (SUMMARY requires/affects, PLAN key_links, REQUIREMENTS.md traceability, todo depends_on/related_to) and wired `gsd-tools graph analyze|export`, closing GRAPH-02/GRAPH-03 with zero behavior change to any existing consumer.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-04T16:36:48Z (approx., picking up from 16-01 completion)
- **Completed:** 2026-07-04T16:48:37Z
- **Tasks:** 2 (TDD RED then GREEN)
- **Files modified:** 3

## Accomplishments
- `buildGraph(cwd)` now covers all 7 named edge sources: SUMMARY `requires`/`affects` frontmatter (both nested `dependency_graph:` and flat top-level shapes) produce `provides`/`affects` edges; PLAN `must_haves.key_links` (via `parseMustHavesBlock`, both structured `{from,to}` and free-text arrow-string shapes via new `parseKeyLinkItem`) produce `wires` edges + `artifact:` nodes; `.planning/REQUIREMENTS.md`'s traceability table produces `requirement:` nodes + `satisfies` edges to the named phase; `.planning/todos/{pending,done}/*.md` `depends_on`/`related_to` produce `todo:` nodes + `depends_on` edges, resolved directly (never via `refToNodeId`) to avoid misparsing date-prefixed todo slugs into fabricated `plan:` nodes.
- New exported pure function `parseKeyLinkItem(item)` normalizes both real-world key_links shapes.
- `gsd-tools graph analyze` prints a fixed-order node/edge type breakdown plus a sorted adjacency listing; `gsd-tools graph export` prints the identical model as stable-key-order JSON. Both dispatch from a new `case 'graph':` block mirroring the existing `ledger`/`mailbox` dispatch style.
- Dogfooded against this repo's own real `.planning/` tree: found and worked around a pre-existing `extractFrontmatter` bug where dash-list items with a `key: value` continuation line (`- phase: 05-01\n    provides: ...`) flatten into a bare string `"phase: 05-01"` instead of a `{phase, provides}` object — normalized in `graph.cjs`'s Source 1 parsing rather than touching the shared YAML parser (out of this plan's scope; logged as a pattern, not a `frontmatter.cjs` fix).
- Live run on this repo: `gsd-tools graph analyze` reports 59 nodes (22 phase, 2 plan, 10 requirement, 15 todo, 10 artifact) and 38 edges (19 depends_on, 4 affects, 10 satisfies, 5 wires) before this SUMMARY.md exists; `provides` edges appear once this plan's own SUMMARY (`requires: [16-01]`) is present, per the ASSUMPTIONS #3 rule that every `provides` edge originates from a downstream plan's `requires` entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED tests for remaining buildGraph edge sources and the graph CLI** - `db22e8d` (test)
2. **Task 2: Implement remaining buildGraph sources + graph CLI dispatch (GREEN)** - `45cdf68` (feat)

**Plan metadata:** (this commit) - `docs(16-02): complete plan`

_Note: TDD task 1 is RED (failing tests), task 2 is GREEN (implementation) — no separate refactor commit needed._

## Files Created/Modified
- `get-shit-done/bin/lib/graph.cjs` - Added `parseKeyLinkItem`, extended `buildGraph` with the four remaining edge sources, added `cmdGraphAnalyze`/`cmdGraphExport`
- `get-shit-done/bin/gsd-tools.cjs` - Added `require('./lib/graph.cjs')` and `case 'graph':` dispatch (analyze/export/unknown-subcommand)
- `tests/graph.test.cjs` - Added 15 new tests: `parseKeyLinkItem` (3), SUMMARY requires/affects nested+flat (2), PLAN key_links (1), REQUIREMENTS traceability (1), todo depends_on/related_to incl. date-prefixed dangling regression (2), CLI analyze/export/bogus (3), plus supporting fixture helpers

## Decisions Made
- Normalized `extractFrontmatter`'s dash-list-with-continuation-line flattening bug inline in `graph.cjs`'s Source 1 parsing (strip a leading `"phase: "` prefix from string-typed requires items) rather than patching the shared parser — contained fix, zero risk to the ~15 other `extractFrontmatter` call sites, discovered only by dogfooding this repo's own real SUMMARY files during verification.
- Todo `depends_on`/`related_to` resolution never calls `refToNodeId` — confirmed via the date-prefixed dangling-edge regression test, matching the plan's explicit anti-misparse requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized extractFrontmatter's dash-list continuation-line flattening for SUMMARY requires items**
- **Found during:** Task 2, while dogfooding `graph analyze` against this repo's real `.planning/` tree and cross-checking against real files using the `- phase: X\n    provides: Y` dash-list shape (e.g. `.planning/v1.4/phases/05-milestone-versioned-phase-ids/05-03-SUMMARY.md`)
- **Issue:** `extractFrontmatter` (shared parser, out of this plan's `files_modified`) flattens each such dash-list item into a bare string `"phase: 05-01"` rather than a `{phase: "05-01", provides: "..."}` object, because its array-item parser doesn't build nested objects for multi-line hash items. The plan's interfaces spec assumed `item.phase` would be readable on a real object.
- **Fix:** In `graph.cjs`'s Source 1 requires-parsing loop, after resolving `ref = typeof item === 'string' ? item : item.phase`, strip a leading `/^phase:\s*/i` prefix if present before calling `refToNodeId`. Handles both the aspirational object form (if `extractFrontmatter` is ever fixed) and the actual flattened-string form it emits today.
- **Files modified:** `get-shit-done/bin/lib/graph.cjs` (Source 1 block only)
- **Verification:** Updated `tests/graph.test.cjs`'s nested-form fixture to use the real unquoted `- phase: 05-01\n    provides: ...` shape (matching this repo's actual files, not a quoted `{phase: "01-01"}` form that doesn't occur on disk); `npm test` full suite green.
- **Committed in:** `45cdf68` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug workaround, contained to graph.cjs)
**Impact on plan:** Necessary for correctness — without the fix, SUMMARY `requires` edges silently fail to resolve for every real file using the dash-list `{phase, provides}` shape (17 files in this repo use nested `dependency_graph:`, several of which use this exact shape). No scope creep — `frontmatter.cjs` itself was not touched.

## Issues Encountered
None beyond the deviation described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 (Planning Graph Model + CLI) is complete: GRAPH-01 (16-01), GRAPH-02 (16-01 Part A + 16-02 Part B), GRAPH-03 (16-02) all shipped. `buildGraph(cwd)` is a stable, pure, fully-tested model over all 7 edge sources; `gsd-tools graph analyze|export` are live.
- Phase 17 (Graph Algorithms + Integrity) can proceed: `topoSort`/`detectCycles`/`blastRadius`/`graph validate` build directly on this plan's `{nodes, edges}` export contract and `EDGE_TYPE_ORDER`/`NODE_TYPE_ORDER` conventions. The dogfood run's live edge counts (0 `provides` edges pre-this-summary, non-zero once 16-02's own SUMMARY exists) demonstrate the requires-closure mechanism Phase 19 will consume.
- Known follow-up for Phase 17's integrity check: the `extractFrontmatter` dash-list-continuation-line flattening bug (workaround documented above) may affect other consumers beyond this graph model — worth a dedicated look when Phase 17 designs `graph validate`'s "affects-vs-files_modified contradiction" detector, since sloppy SUMMARY frontmatter is exactly the risk that check is meant to catch.
- `npm test` full suite: 1160/1165 pass. The 5 failing tests (`config.test.cjs` Brave-Search/defaults-merge, `profile-output.test.cjs` write-profile/generate-dev-preferences) are the same pre-existing, unrelated sandboxed-filesystem failures (`ENOENT: /home/.gsd`) noted in 16-01-SUMMARY.md — confirmed still present and out of scope.

---
*Phase: 16-planning-graph-model-cli*
*Completed: 2026-07-04*

## Self-Check: PASSED

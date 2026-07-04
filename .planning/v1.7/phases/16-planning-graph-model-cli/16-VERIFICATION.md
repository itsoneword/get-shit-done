---
phase: 16-planning-graph-model-cli
verified: 2026-07-04T18:05:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5 (1 partial)
  gaps_closed:
    - "buildGraph additionally includes provides edges derived from SUMMARY frontmatter requires — extractFrontmatter's block-selection bug (LAST '---...---' match instead of file-anchored first block) fixed in plan 16-03; live graph now shows 2 provides edges (plan:16-01 -> plan:16-02, plan:16-02 -> plan:16-03), matching the expected count called out in the re-verification brief"
  gaps_remaining: []
  regressions: []
---

# Phase 16: Planning Graph Model + CLI Verification Report

**Phase Goal:** A single normalized `{nodes, edges}` graph model exists over every fragmented edge encoding GSD already declares (phase depends_on, plan depends_on/wave, files_modified overlap, SUMMARY requires/provides/affects, PLAN key_links, requirement→phase, todo edges), inspectable by a human via CLI — read-only, zero behavior change to any existing consumer.
**Verified:** 2026-07-04T18:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 16-03)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `roadmap analyze` emits unchanged raw `depends_on` plus additive `depends_on_parsed` array | VERIFIED | Unchanged from initial verification; `phase:14 --depends_on--> phase:11/12` etc. present in live `graph analyze` output |
| 2 | `graph.cjs` requires/reuses `roadmap.cjs`'s exported parsers, no duplicated regex | VERIFIED | Unchanged from initial verification |
| 3 | `buildGraph` produces phase/plan/requirement/todo/artifact nodes and depends_on/provides/affects/satisfies/wires edges from real repo data | VERIFIED | Live `graph analyze`/`graph export` on this repo's own `.planning/` tree: node types `[artifact, phase, plan, requirement, todo]` (all 5); edge types `[affects, depends_on, provides, satisfies, wires]` (all 5) — `provides` now shows 2 live edges: `plan:16-01 --provides--> plan:16-02 [summary_requires]` and `plan:16-02 --provides--> plan:16-03 [summary_requires]`, exactly matching the counts specified in the re-verification brief |
| 4 | `gsd-tools graph analyze` / `graph export` are live, exit 0, JSON parses | VERIFIED | `graph analyze` prints readable Nodes/Edges breakdown + adjacency listing (64 nodes, 48 edges), exit 0; `graph export` piped through `JSON.parse` succeeds, all 5 node types and all 5 edge types present in parsed output |
| 5 | Zero behavior change to existing consumers | VERIFIED | `git diff --stat` across the last 10 commits touching `parallel-gate.cjs`, `phase.cjs`, `overnight.md`, `gsd-plan-checker.md` shows no changes from those commits; full `npm test`: 1163 pass / 5 fail (3 top-level suites: `config-ensure-section command`, `write-profile command`, `generate-dev-preferences command`) — identical to the pre-existing baseline documented in both 16-01/16-02 SUMMARYs and the prior VERIFICATION.md, no graph-related regressions |

**Score:** 5/5 truths fully verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/lib/roadmap.cjs` | additive `depends_on_parsed` + exported `parsePhaseSections`/`parseDependsOnPhaseRefs` | VERIFIED | Unchanged from initial verification |
| `get-shit-done/bin/lib/frontmatter.cjs` | `extractFrontmatter` anchored to file-start frontmatter block | VERIFIED | Block-selection rewritten as anchored `for(;;)` loop (plan 16-03); source ↔ runtime (`.claude/get-shit-done/bin/lib/frontmatter.cjs`) confirmed byte-identical via `diff` |
| `get-shit-done/bin/lib/graph.cjs` | pure `buildGraph`/`refToNodeId`/`resolvePlanDepRef`/`parseKeyLinkItem`/`cmdGraphAnalyze`/`cmdGraphExport` | VERIFIED | All 5 edge types and all 5 node types now produced from real repo data; source ↔ runtime byte-identical |
| `get-shit-done/bin/gsd-tools.cjs` | `case 'graph':` dispatch to analyze/export | VERIFIED | Unchanged from initial verification |
| `tests/roadmap.test.cjs` / `tests/graph.test.cjs` / `tests/frontmatter.test.cjs` | extended/new test coverage | VERIFIED | `node --test tests/frontmatter.test.cjs tests/graph.test.cjs`: 72/72 pass (includes 3 new regression tests for the real-SUMMARY-shape block-selection bug) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `roadmap.cjs depends_on_parsed` | `graph.cjs` phase depends_on edge builder | direct `require` call | VERIFIED | Unchanged |
| PLAN frontmatter `depends_on` | `resolvePlanDepRef` | direct call | VERIFIED | Unchanged |
| `gsd-tools.cjs 'graph'` dispatch | `graph.cjs cmdGraphAnalyze`/`cmdGraphExport` | `case 'graph'` block | VERIFIED | Unchanged |
| REQUIREMENTS.md traceability row | `requirement:` node + `satisfies` edge | regex parse | VERIFIED | Unchanged; live 10 `satisfies` edges |
| PLAN `key_links` arrow-string | `parseKeyLinkItem` → `wires` edge | split on `->`/`→` | VERIFIED | Unchanged; live 7 `wires` edges |
| todo `depends_on`/`related_to` | `'todo:' + slug` direct resolution | direct string concat | VERIFIED | Unchanged |
| SUMMARY `requires`/`affects` | `provides`/`affects` edges | `extractFrontmatter` + `refToNodeId` | **VERIFIED (FIXED)** | Previously broken on real data — `extractFrontmatter`'s block-selection bug fixed in plan 16-03; live output now shows 2 `provides` edges (`plan:16-01 -> plan:16-02`, `plan:16-02 -> plan:16-03`) and 8 `affects` edges, matching the phase's own dogfood narrative for the first time |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| GRAPH-01 | 16-01 | phase depends_on parsed into structured array | SATISFIED | Unchanged from initial verification |
| GRAPH-02 | 16-01 + 16-02 + 16-03 | single `{nodes,edges}` model over all 7 edge sources | SATISFIED | All 7 sources now produce edges reliably on real data, including SUMMARY `requires` → `provides` edges (previously the one gap, closed by 16-03's `extractFrontmatter` fix) |
| GRAPH-03 | 16-02 | `graph analyze`/`graph export` CLI | SATISFIED | Unchanged from initial verification |

REQUIREMENTS.md marks all three `[x]` and "Complete" — this is now accurate; no overstatement remains. No orphaned requirement IDs found (GRAPH-01/02/03 fully accounted for in this phase; GRAPH-04 onward correctly deferred to Phases 17-19 per traceability table).

### Anti-Patterns Found

None remaining. The one anti-pattern flagged in the prior verification (`frontmatter.cjs`'s LAST-match block-selection regex) was fixed at its root in plan 16-03, with regression tests added covering the real SUMMARY.md shape (frontmatter + Deviations `---` divider + closing footer `---`) that originally triggered the bug.

### Human Verification Required

None — all checks above are independently reproducible via `node --test`, `npm test`, and live `gsd-tools graph analyze/export` runs against this repo's real `.planning/` tree.

### Gaps Summary

No gaps remain. Plan 16-03 root-caused and fixed the `extractFrontmatter` block-selection bug in the shared `frontmatter.cjs` module (not a local `graph.cjs` workaround), which was the correct fix given ~15 other call sites shared the same silent-data-loss exposure. Live re-verification confirms: `provides` edge type now present (2 edges, matching the exact expected pairs from plan dependency chain 16-01→16-02→16-03); all 5 declared edge types and all 5 declared node types present in the live model; `graph export`/`graph analyze` both function correctly; zero consumer behavior change confirmed via git diff on `parallel-gate.cjs`/`phase.cjs`/`overnight.md`/`gsd-plan-checker.md`; full test suite holds at the same pre-existing baseline (5 unrelated sandboxed-FS failures, unchanged) plus 3 new passing regression tests. Phase 16 goal is fully achieved.

---

_Verified: 2026-07-04T18:05:00Z_
_Verifier: Claude (gsd-verifier)_

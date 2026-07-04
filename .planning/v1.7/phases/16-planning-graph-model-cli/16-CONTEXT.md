# Phase 16: Planning Graph Model + CLI - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Source:** Authored from approved design (todo `2026-07-04-add-graph-cjs-planning-graph-layer-normalizing-existing-edges.md` + v1.7 roadmap Discussion focus + codebase-mapping findings). Design was ratified by the user's "full build" milestone approval — decisions below are LOCKED unless marked Claude's Discretion.

<domain>
## Phase Boundary

**Detected domain:** Generic (internal CLI/library tooling — no UI, no agentic system)

Phase 16 delivers a **read-only** normalized planning-graph model and its inspection CLI. It adds a reader; it changes no existing consumer's behavior. Concretely:

1. `roadmap.cjs` parses phase `depends_on` from prose into a structured array (GRAPH-01).
2. A new `get-shit-done/bin/lib/graph.cjs` builds one `{nodes, edges}` model over all seven existing edge encodings (GRAPH-02).
3. `gsd-tools graph analyze` (human-readable) and `gsd-tools graph export` (JSON) surface the model (GRAPH-03).

Algorithms (topoSort/detectCycles/blastRadius), the `/gsd2:health` integrity check, consumer repointing, and authoritative promotion are OUT of this phase — they are Phases 17/18/19. This phase must leave the system byte-for-byte behaviorally identical for every current caller.
</domain>

<decisions>
## Implementation Decisions

### Node model (LOCKED)
- Node shape: `{ id, type, ... }`. Node `type` ∈ `phase | plan | requirement | todo | artifact`.
- Node id conventions (stable, greppable): `phase:16`, `plan:16-01`, `requirement:GRAPH-01`, `todo:<slug>`, `artifact:<repo-relative-path>`.
- Every edge endpoint must resolve to a node id; unresolved endpoints are retained as edges to a missing node (surfaced later by Phase 17's `validate` as "dangling"), NOT silently dropped — Phase 16 records them, Phase 17 flags them.

### Edge model (LOCKED)
- Edge shape: `{ from, to, type, source }` where `source` names the encoding it came from (for debuggability).
- Edge `type` ∈ `depends_on | provides | affects | satisfies | wires`.
- The seven existing encodings map to edges as follows (this mapping is the core of GRAPH-02):

| Source encoding | Reader | Edge produced |
|---|---|---|
| Phase `**Depends on**:` prose (ROADMAP) | `roadmap.cjs` (parsed list, GRAPH-01) | `phase→phase` `depends_on` |
| Plan `depends_on` + `wave:N` frontmatter | `frontmatter.cjs` | `plan→plan` `depends_on` |
| Plan `files_modified` overlap | `frontmatter.cjs` | `plan↔plan` `depends_on` (undirected file-overlap; mark `source: files_modified`) |
| SUMMARY `requires`/`provides`/`affects` | SUMMARY frontmatter parser | `provides` / `affects` edges between phase/plan nodes |
| PLAN `must_haves.key_links {from,to}` | `parseMustHavesBlock` | `artifact→artifact` `wires` |
| REQUIREMENTS traceability table | `roadmap.cjs`/requirements parser | `requirement→phase` `satisfies` |
| Todo `depends_on`/`related_to` | todo frontmatter | `todo→phase`/`todo→todo` `depends_on` |

### GRAPH-01 — phase depends_on normalization (LOCKED)
- Location: `roadmap.cjs` (the existing phase-section parser near the current `dependsMatch` regex, ~line 125).
- Change: expose a parsed **array** of phase refs (e.g. `["Phase 3", "Phase 6"]` → normalized to node-id form `["phase:3","phase:6"]`) instead of only the raw string.
- Back-compat: preserve the existing raw-string field if any current caller reads it; ADD the parsed array as a new field. Do not break `roadmap analyze`/`get-phase` JSON consumers — additive only.
- Parse rule: reuse the existing `/Phase\s+(\d+(\.\d+)?)/g`-style extraction (already used by `overnight.md`), handling decimal (`72.1`) and the "Nothing"/"first phase" cases → empty array.

### graph.cjs placement & reuse (LOCKED)
- File: `get-shit-done/bin/lib/graph.cjs` (CommonJS `.cjs`, kebab-case — matches convention).
- REUSE existing readers; do NOT re-implement parsing: `roadmap.cjs` (phases + depends_on + requirement traceability), `frontmatter.cjs` (`extractFrontmatter`, `parseMustHavesBlock`) for PLAN/SUMMARY frontmatter, and the milestone-partition-aware `phasesDir(cwd)` helper from `core.cjs` to locate phase dirs.
- Pure module: no network, no side effects; `buildGraph(cwd)` returns the `{nodes, edges}` object. Testable in isolation following the `lesson.cjs`/`ledger.cjs` module+test pattern.

### CLI surface (LOCKED)
- `gsd-tools graph analyze` → human-readable text summary (node counts by type, edge counts by type, and a readable adjacency listing). Exact text layout is Claude's Discretion.
- `gsd-tools graph export` → the identical model as machine-readable JSON on stdout (stable key order; suitable for `| jq`).
- Dispatch wired in `gsd-tools.cjs` alongside existing subcommands (`ledger`, `mailbox`, `run`, `verify`, …).

### Scope guard (LOCKED)
- No `topoSort`, `detectCycles`, `blastRadius`, `validate`, `/gsd2:health` change, or any consumer repoint in this phase. If the planner is tempted to add them, it must defer to Phase 17.
- Zero behavior change: existing `roadmap.cjs` callers, `parallel-gate.cjs`, `phase.cjs`, `overnight.md`, `gsd-plan-checker.md` must be untouched functionally.

### Claude's Discretion
- Exact internal data structures (Map vs plain object for node index), the human-readable `analyze` text format, JSON key ordering in `export`, and how edges are de-duplicated when two encodings imply the same edge.
- Whether `buildGraph` takes an options object (e.g. `{ milestone }`) — planner decides based on `phasesDir` semantics.
- Test fixture strategy (synthetic `.planning/` tree vs reading this repo's own tree).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design + rationale (read first)
- `.planning/todos/pending/2026-07-04-add-graph-cjs-planning-graph-layer-normalizing-existing-edges.md` — full design: the 7-edge table, 4-step sequencing, consumer plug-in points, edge-quality risk, advisory→authoritative rollout

### Existing readers to reuse (do not re-implement)
- `get-shit-done/bin/lib/roadmap.cjs` (~line 125) — phase `**Depends on**:` parse (the `dependsMatch` regex); `cmdRoadmapAnalyze`/`cmdRoadmapGetPhase`; requirements traceability parsing
- `get-shit-done/bin/lib/frontmatter.cjs` — `extractFrontmatter` (stack-based YAML), `parseMustHavesBlock` (dynamic-indent `key_links`/`truths`/`artifacts`), `FRONTMATTER_SCHEMAS` (plan/summary)
- `get-shit-done/bin/lib/core.cjs` — `phasesDir(cwd)` / `planningPaths()` (partition-aware phase-dir resolution; legacy `.planning/phases/` fallback)
- `get-shit-done/bin/lib/commands.cjs` (~line 157) — existing `history-digest` already aggregates SUMMARY `provides`/`affects` (the closest prior art for reading those edges)

### Downstream consumers this phase must NOT disturb (context only)
- `get-shit-done/bin/lib/parallel-gate.cjs` (~line 139, `hasPhaseDecisionCoupling`) — repointed in Phase 18, not now
- `get-shit-done/bin/lib/phase.cjs` (~line 305, wave bucketing) — Phase 19, not now
- `get-shit-done/workflows/overnight.md` (~line 143, BLOCKED/SKIPPED regex traversal) — Phase 18, not now

### Convention references
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md` — CommonJS `.cjs`, `cmd`-prefixed handlers, flat `bin/lib/` + `tests/` layout, `node:test`
</canonical_refs>

<specifics>
## Specific Ideas

- Model the graph so the parked idea's "lvl 1/2/3" maps cleanly to query depth later (Phase 17's `blastRadius` depth param) — i.e. keep edges directional and typed so a BFS by `type` at bounded depth is trivial.
- `export` JSON is the contract Phase 17+ and any external tooling consume — treat its shape as an interface, keep it stable and documented.
- Follow the TDD discipline already in the repo (`tdd.md`, `ledger.cjs`/`park.cjs` test suites): unit-test `buildGraph` and the edge-mapping per source, watch tests fail first.
</specifics>

<deferred>
## Deferred Ideas

- topoSort / detectCycles / blastRadius / `graph validate` → Phase 17
- `/gsd2:health` graph-integrity check → Phase 17
- parallel-gate + overnight repoint → Phase 18
- computed waves + requires-closure context selection → Phase 19
- Code/module (import-level) dependency graph → v2 (CODEGRAPH, out of scope)
</deferred>

---

*Phase: 16-planning-graph-model-cli*
*Context gathered: 2026-07-04 — authored from approved design (no interactive discuss-phase; decisions were pre-ratified by full-build milestone approval)*

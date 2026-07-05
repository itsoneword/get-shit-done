# Requirements: GSD v1.7 Planning-Graph Layer

**Defined:** 2026-07-04
**Core Value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

> Internal-tooling milestone — the "user" of these capabilities is the GSD framework and the developer running it, so requirements are phrased as observable tool/behavior contracts rather than end-user stories.

## v1 Requirements

Requirements for the v1.7 milestone. Each maps to a roadmap phase.

### Planning Graph (GRAPH)

Advisory foundation (read-only, zero behavior change):

- [x] **GRAPH-01**: Phase `depends_on` is parsed from ROADMAP prose into a structured list (array of phase refs) exposed by the roadmap parser — consumers stop re-parsing the raw string
- [x] **GRAPH-02**: A single `graph.cjs` module builds one normalized `{nodes, edges}` model from all existing edge sources (phase `depends_on`, plan `depends_on`/`wave`, `files_modified` overlap, SUMMARY `requires`/`provides`/`affects`, PLAN `key_links`, requirement→phase traceability, todo `depends_on`/`related_to`)
- [x] **GRAPH-03**: `gsd-tools graph analyze` prints the normalized node/edge model and `gsd-tools graph export` emits it as machine-readable JSON
- [x] **GRAPH-04**: `graph.cjs` computes a topological order and detects cycles in code; `gsd-tools graph validate` reports cycles, dangling edge references, and wave/dependency contradictions, exiting non-zero on failure
- [x] **GRAPH-05**: `gsd-tools graph blast-radius <node>` returns the transitive `affects`/`provides` closure at a requested depth — level 1 (direct), level 2 (one-hop), level 3 (full closure)
- [ ] **GRAPH-06**: `/gsd2:health` runs a graph-integrity check that flags dangling edge references, cycles, and `affects`-vs-`files_modified` contradictions — without altering any execution behavior

Consumer repoint (delete duplicated traversal, still non-authoritative):

- [ ] **GRAPH-07**: The `parallel-gate.cjs` axis-B coupling decision is computed from the graph model instead of the hand-rolled `hasPhaseDecisionCoupling` string check, producing identical-or-better verdicts on existing phases
- [ ] **GRAPH-08**: The `overnight.md` BLOCKED/SKIPPED phase traversal reads the graph's topological order instead of ad-hoc regex extraction

Authoritative promotion (graph overrides planner/executor output):

- [ ] **GRAPH-09**: Plan wave numbers are computed (or cross-checked and corrected) from the graph rather than trusted from the planner-assigned integer; a wave that contradicts its dependencies is flagged or repaired
- [ ] **GRAPH-10**: plan-phase context selection assembles upstream context from the graph's `requires` transitive closure

## v2 Requirements

Deferred beyond this milestone.

### Code-Dependency Graph (CODEGRAPH)

- **CODEGRAPH-01**: A file/function-level import-dependency map of the target codebase (the "Bob-style" upfront system map) — deferred; overlaps gsd-fixer's live grep blast-radius and carries a poor effort:payoff ratio for a solo framework

## Out of Scope

| Feature | Reason |
|---------|--------|
| Code-level module/import graph | Deferred to v2 (CODEGRAPH); the planning-graph (work-item) layer is the high-leverage 80%-scaffolded win |
| New authoring burden (new frontmatter fields users must fill) | The graph reads existing edge encodings only — normalization, not new metadata |
| Visual graph rendering / UI | CLI + JSON export suffice; Mermaid already covered by `/gsd2:document` |
| Replacing SUMMARY `requires`/`provides`/`affects` schema | The graph consumes the existing schema; edge-quality is addressed via the integrity check, not a schema rewrite |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRAPH-01 | Phase 16 | Complete |
| GRAPH-02 | Phase 16 | Complete |
| GRAPH-03 | Phase 16 | Complete |
| GRAPH-04 | Phase 17 | Complete |
| GRAPH-05 | Phase 17 | Complete |
| GRAPH-06 | Phase 17 | Pending |
| GRAPH-07 | Phase 18 | Pending |
| GRAPH-08 | Phase 18 | Pending |
| GRAPH-09 | Phase 19 | Pending |
| GRAPH-10 | Phase 19 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10/10 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after v1.7 roadmap creation (Phases 16-19 mapped, 100% coverage)*

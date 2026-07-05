# Phase 17: Graph Algorithms + Integrity Check - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

**Detected domain:** Generic (internal CLI/library tooling — no UI, no agentic system)
**Evidence:** internal `gsd-tools` CLI subcommands + pure `graph.cjs` library module; no `src/components`, no `agents/` involvement; phase-goal keywords (topoSort, validate, integrity)
**Confirmed by user:** proceeded as Generic (no override)

Phase 17 adds **algorithms and an integrity check** on top of Phase 16's read-only graph model. It stays **advisory** — it computes and reports, it changes no consumer's execution behavior. Concretely, it delivers GRAPH-04/05/06:

1. `topoSort` / `detectCycles` in code, plus `gsd-tools graph validate` — reports cycles, dangling edge references, and wave/dependency contradictions; exits non-zero on **structural** failure (GRAPH-04).
2. `gsd-tools graph blast-radius <node>` — transitive `affects`/`provides` closure at bounded depth, levels 1/2/3 (GRAPH-05).
3. A `/gsd2:health` graph-integrity check that flags dangling refs, cycles, and `affects`-vs-`files_modified` contradictions — without altering any execution behavior (GRAPH-06).

**This phase is the trust gate.** Per PROJECT.md's "advisory before authoritative" rollout, the graph earns trust here via integrity-check numbers on the live repo before Phase 18 repoints consumers and Phase 19 goes authoritative. Consumer repointing (parallel-gate, overnight), computed wave numbers, and `requires`-closure context selection are OUT of scope — Phases 18/19.
</domain>

<established>
## Established Patterns (from codebase)

- **`buildGraph(cwd)` → `{nodes, edges}`** (`graph.cjs`, Phase 16) — the single normalized model. Phase 17 algorithms consume it; they do NOT re-parse any source encoding.
- **Node ids** are stable/greppable: `phase:17`, `plan:16-01`, `requirement:GRAPH-04`, `todo:<slug>`, `artifact:<path-or-prose>`. Edge shape `{from,to,type,source}`; edge `type` ∈ `depends_on | provides | affects | satisfies | wires`.
- **`gsd-tools graph <sub>` dispatch** already exists (`analyze`, `export`); `validate` and `blast-radius` are added alongside — same dispatch pattern in `gsd-tools.cjs`.
- **`cmdValidateHealth(cwd, options, raw)`** (`verify.cjs`) uses `addIssue(severity, code, message, fix, repairable)` per finding, numbered "Check N". The graph-integrity check is added as the next numbered check, reusing `addIssue`.
- **TDD discipline** — `ledger.cjs`/`park.cjs`/`graph.cjs` all ship with a `tests/<mod>.test.cjs` suite written RED-first. Phase 17 follows suit.
- **Live-repo baseline** (`graph analyze`, 2026-07-05): 64 nodes / 48 edges; `depends_on` structural edges appear acyclic; the `artifact`/`wires` layer (from PLAN `key_links`) is **prose, not file paths** — the known-sloppy advisory data this check is built to measure.
</established>

<decisions>
## Implementation Decisions

### Validate severity model — two-tier + `--strict` [STRONG, specialist-backed]
`gsd-tools graph validate` classifies problems into two tiers:
- **Structural (fatal — exit non-zero):** dependency cycles; dangling `depends_on` / `satisfies` edge references (endpoint resolves to no real node).
- **Advisory (warn — exit zero):** `affects`-vs-`files_modified` contradictions; unresolved `artifact` / `key_link` / `wires` endpoints (prose, not a real file).
- `--strict` promotes ALL problems to fatal (for CI / pre-promotion gating). Near-zero implementation cost.
- `confidence: HIGH` · `source: PROJECT.md "advisory before authoritative" rollout + live graph analyze evidence` · <!-- resolved inline by resolution loop -->
- **Why:** the integrity check exists to *quantify* sloppy advisory data, not reject it. Exiting non-zero on advisory noise would make the trust gate un-passable on the exact data it measures — contradicting the locked milestone rollout.

### Trust-gate definition (what "clean numbers" means for Phase 19) [STRONG, specialist-backed]
Phase 19 promotion is unblocked when `validate` on the live repo reports:
- **Zero cycles** (hard) and **zero dangling structural refs** (`depends_on`/`satisfies`) (hard).
- **`affects`-contradiction count is surfaced as a reviewable number**, NOT required to be zero — advisory edges stay advisory; a human eyeballs the count.
- `confidence: HIGH` · `source: STATE.md Phase-19 gate note + advisory-quality risk in PROJECT.md` · <!-- resolved inline by resolution loop -->
- **Why:** "zero everything" would import out-of-scope SUMMARY/key_link data-cleanup into the gate; "acyclic only" earns too little trust for an override-the-planner decision.

### `/gsd2:health` integration mirrors the severity split [STRONG, specialist-backed]
- Add the graph-integrity check as the next numbered check in `cmdValidateHealth`, reusing `addIssue`.
- Structural problems → `severity: 'error'` (contributes to unhealthy status); advisory problems → `severity: 'info'` (reported, does not fail health).
- No execution-behavior change (GRAPH-06 constraint) — the check is read-only diagnostic; not `--repair`-able (advisory data is authored, not auto-fixable). Suggested codes: `E-GRAPH-*` (structural), `I-GRAPH-*` (advisory).

### topoSort / detectCycles [STRONG, specialist-backed — Claude's Discretion on internals]
- Kahn's algorithm over `depends_on` edges for `topoSort`; `detectCycles` reports the **actual cycle members** (the residual set when Kahn's stalls), not merely "a cycle exists".
- Scope of the sort/cycle check: `depends_on` edges (phase→phase and plan→plan). `satisfies` dangling is a validate concern, not a cycle concern.
- `confidence: HIGH` · `source: standard graph-algorithm practice` · <!-- resolved inline by resolution loop -->

### blast-radius query semantics [WEAK, specialist-backed — override if planner finds better]
- Forward BFS over `affects` + `provides` edges (matches GRAPH-05 wording "transitive affects/provides closure").
- Depth: level 1 = direct, level 2 = one-hop, level 3 = full closure; default = full closure, `--depth N` bounds it.
- Unknown / unresolvable `<node>` argument → clear error + exit non-zero.
- Output groups affected nodes by level; JSON form available for machine use (mirror `graph export` conventions).

### affects-vs-files_modified contradiction — definition [WEAK — direction is planner discretion]
- A contradiction = a mismatch between the author-declared `affects` set and the coupling independently implied by `files_modified` overlap. Report **both** directions (declared-but-unsupported, and file-overlap-but-undeclared). Exact threshold/algorithm → researcher/planner discretion; keep it advisory-tier only.

### Claude's Discretion
- Internal data structures for the algorithms; exact `validate` / `blast-radius` text layout; JSON key ordering; the precise contradiction-detection threshold; health check code numbering.
</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** `gsd-tools graph validate` and `gsd-tools graph blast-radius <node>` exist and run on the live repo; `/gsd2:health` includes a graph-integrity check. The graph can now be *interrogated* (order, cycles, blast radius) and *audited* (integrity), still without changing any execution behavior.
- **Success signal:** on the live repo, `validate` exits zero (no structural problems) while printing a reviewable count of advisory `affects`-contradictions; `--strict` surfaces the full advisory list; `blast-radius phase:17` returns a sensible transitive set. These are the "clean numbers" that later gate Phase 19.
- **Flow:** author runs `graph validate` → sees structural=clean, advisory=N → reviews the N → gains (or withholds) trust → that judgment is what unblocks Phase 18/19.
</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design + rollout rationale (read first)
- `.planning/todos/pending/2026-07-04-add-graph-cjs-planning-graph-layer-normalizing-existing-edges.md` — full design: 7-edge model, advisory→authoritative rollout, edge-quality risk this phase mitigates
- `.planning/v1.7/phases/16-planning-graph-model-cli/16-CONTEXT.md` — Phase 16 LOCKED node/edge model, id conventions, the "dangling = retained not dropped" rule Phase 17's `validate` now surfaces

### Requirements
- `.planning/REQUIREMENTS.md` — GRAPH-04 (topoSort/detectCycles/`graph validate`), GRAPH-05 (`blast-radius` lvl 1/2/3), GRAPH-06 (`/gsd2:health` integrity check)

### Code to reuse / extend (do not re-implement)
- `get-shit-done/bin/lib/graph.cjs` — `buildGraph(cwd)`, node/edge shape, `NODE_TYPE_ORDER`/`EDGE_TYPE_ORDER`, existing `cmdGraphAnalyze`/`cmdGraphExport`; add `topoSort`/`detectCycles`/`blastRadius`/`cmdGraphValidate`/`cmdGraphBlastRadius` here
- `get-shit-done/bin/lib/verify.cjs` (~line 918 `cmdValidateHealth`, `addIssue` helper) — add the graph-integrity check as the next numbered check
- `get-shit-done/bin/gsd-tools.cjs` (`graph` dispatch case) — wire `validate` + `blast-radius` subcommands
- `get-shit-done/workflows/health.md` — `validate health` output formatting (structural=error / advisory=info surfacing)

### Convention references
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md` — CommonJS `.cjs`, `cmd`-prefixed handlers, flat `bin/lib/` + `tests/`, `node:test`, TDD RED-first
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildGraph(cwd)` — the sole input to every Phase 17 algorithm; no source re-parsing.
- `addIssue(severity, code, message, fix, repairable)` in `cmdValidateHealth` — the exact hook for the health integration; `severity: 'error'|'warning'|'info'` already drives health status.
- `graph export` JSON — the stable contract; `validate`/`blast-radius` should stay consistent with its node-id + edge-type vocabulary.

### Established Patterns
- Two-tier severity (error vs info) is already how `cmdValidateHealth` distinguishes fatal from advisory — the graph check slots into the same model with no new machinery.
- Dispatch-per-subcommand in `gsd-tools.cjs`; text-vs-`--raw`/JSON dual output on every `cmd*` handler.

### Integration Points
- `graph.cjs` new functions → `gsd-tools.cjs` `graph` dispatch (`validate`, `blast-radius`).
- `graph.cjs` (or a thin validate helper) → `verify.cjs` `cmdValidateHealth` for the `/gsd2:health` check (GRAPH-06).
- The live-repo `validate` numbers → the human trust judgment that gates Phases 18/19 (STATE.md Blockers note).
</code_context>

<specifics>
## Specific Ideas

- The severity split is the whole point: **structural = breakage = fatal; advisory = authored sloppiness = reported, never fatal (except under `--strict`).** Do not blur these tiers — blurring them breaks the trust-gate design.
- `detectCycles` must name the offending nodes, not just assert a cycle — a bare boolean is useless for the human doing the trust review.
- Keep `blast-radius` edge-type-parameterizable internally so Phase 18/19 consumers can reuse the traversal.
- User plans to run `/gsd2:discuss-loop` on this CONTEXT.md before planning — the locked severity/gate decisions above are the artifact under adversarial review.

</specifics>

<deferred>
## Deferred Ideas

- Consumer repoint (parallel-gate axis-B from graph; overnight topo-order traversal) → Phase 18 (GRAPH-07/08)
- Computed/cross-checked wave numbers; `requires`-closure context selection in plan-phase → Phase 19 (GRAPH-09/10)
- Auto-repair of advisory edge data (cleaning up prose `key_links` / stale `affects`) → not in scope; advisory data is authored, reviewed by human, never auto-fixed
- Code/module (import-level) dependency graph → v2 (CODEGRAPH)

</deferred>

---

*Phase: 17-graph-algorithms-integrity-check*
*Context gathered: 2026-07-05*

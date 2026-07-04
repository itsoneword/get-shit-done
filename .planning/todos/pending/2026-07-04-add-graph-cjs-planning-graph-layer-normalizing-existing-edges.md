---
created: 2026-07-04T14:31:05.437Z
title: Add graph.cjs planning-graph layer normalizing existing edges
area: tooling
files:
  - get-shit-done/bin/lib/graph.cjs (new)
  - get-shit-done/bin/lib/roadmap.cjs:125
  - get-shit-done/bin/lib/parallel-gate.cjs:139
  - get-shit-done/bin/lib/phase.cjs:305
  - get-shit-done/workflows/overnight.md:143
  - agents/gsd-plan-checker.md:60
  - get-shit-done/templates/summary.md
depends_on: []
related_to:
  - 2026-07-03-executor-planner-persona-deep-dive-handoff-contracts
---

## Problem

Surfaced 2026-07-04 during the IBM Project Bob comparison. Bob builds an upfront
system dependency map that execution consults; the question was what GSD could adopt.
The finding: **GSD does not need a new graph — it already declares one, fragmented
across 7 edge kinds in 4 incompatible encodings that no shared code reads.** This is
also parked enhancement idea #1 (graph-based links lvl 1/2/3 between bugs and
features, cf. gsd-core `graphify`).

Two distinct graphs exist conceptually — this todo is the **(A) work-item / planning
graph** (phases, plans, requirements, todos, bugs/features), NOT the (B) code/module
dependency graph. (A) is ~80% scaffolded and serves the supervision-harness theme.
(B) is the Bob-shaped moonshot — duplicates gsd-fixer's grep blast-radius, low payoff
for a solo framework; explicitly out of scope here.

Existing edges (all real, all unread by any shared parser):

| Edge | Declared in | Form today |
|---|---|---|
| phase → phase | ROADMAP `**Depends on**:` | raw prose string, re-parsed per consumer (`roadmap.cjs:125`) |
| plan → plan | PLAN `depends_on` + `wave:N` | frozen integer the planner LLM guessed (`phase.cjs:305`) |
| plan ↔ plan (file overlap) | PLAN `files_modified` | set intersection |
| phase ↔ phase (rich) | SUMMARY `requires`/`provides`/`affects` | typed edges — the real spine |
| artifact wiring | PLAN `key_links {from,to,via,pattern}` | typed + regex |
| requirement → phase | REQUIREMENTS traceability table | 1:1 row |
| todo → phase/todo | todo `depends_on`/`related_to` | list |

Three gaps this creates:
- **Closure never computed.** `templates/summary.md` promises "transitive closure for
  context selection" (requires/provides/affects) — nothing in `bin/lib/` computes it.
- **Waves guessed, not derived.** Planner assigns `wave:N`; runtime just buckets by it
  (`phase.cjs:305`). No code verifies the wave respects the dependencies.
- **Cycle detection is an LLM instruction, not code** (`gsd-plan-checker.md:60` asks an
  agent to eyeball it). No code enforces a DAG.

Key risk: `requires/provides/affects` are author-supplied by the executor agent and are
often sloppy or empty (`requires: []` common). A graph on bad edges gives *confident
wrong answers* — worse than none. Needs a graph-integrity check (see solution).

## Solution

New module `get-shit-done/bin/lib/graph.cjs` — one reader, one model, real algorithms.
Reuses `roadmap.cjs` / `frontmatter.cjs` / the SUMMARY parser so it adds zero authoring
burden.

- **Model:** `{ nodes:[{id,type}], edges:[{from,to,type}] }`; node type ∈
  `phase|plan|requirement|todo|artifact`, edge type ∈
  `depends_on|provides|affects|satisfies|wires`.
- **Computes the three missing things:** `topoSort`, code-based `detectCycles`,
  `blastRadius(node)` = transitive `affects` closure. Parked idea's "lvl 1/2/3" = query
  depth (direct / one-hop / full closure).
- **CLI:** `gsd-tools graph analyze|validate|blast-radius <node>|export`.

Plugs into existing consumers (no new command surface):
- `parallel-gate.cjs` → replace hand-rolled `hasPhaseDecisionCoupling` with a graph edge query.
- `overnight.md` → replace regex BLOCKED/SKIPPED traversal with graph topo order.
- `gsd-plan-checker.md` → back its cycle "check" with real `graph validate`.
- `phase.cjs` → compute / cross-check waves vs the frozen integer.
- `plan-phase` context selection → finally deliver the `requires`-closure summary.md promises.
- `gsd-fixer` → optional `blast-radius` to link a buggy file back to the feature/phase
  that `provides` it = the bugs↔features link from the parked idea. Only place (A) and
  the original Bob interest meet.

Graph-integrity check in `/gsd2:health`: flag phases whose `affects` contradicts actual
`files_modified` overlap, dangling references, cycles. Not optional — it's what makes the
graph trustworthy enough to promote from advisory to authoritative.

**Sequencing:**
1. Normalize phase `depends_on` string → parsed list at `roadmap.cjs` (small, unblocks all).
2. `graph.cjs` read + model + validate, wired into health. **Ship read-only first** —
   zero behavior change, pure safety net.
3. Repoint `parallel-gate` + `overnight` to the graph (delete duplicated traversal).
4. Computed waves + closure-based context selection (behavior-changing — do last).

**Decision to settle at plan time:** advisory (read-only overlay/validator, steps 1-3)
vs authoritative (drives waves + context selection, step 4). Recommendation: advisory-
first, promote to authoritative once health-check integrity numbers are clean — same
rollout pattern as the symmetry-check (transform-aware fix landed before it gained
--repair authority). Candidate v1.7 milestone slice.

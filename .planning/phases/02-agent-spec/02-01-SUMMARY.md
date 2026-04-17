---
phase: 02-agent-spec
plan: 01
subsystem: planning-templates
tags: [agent-spec, agentic-patterns, template, observability, topology]

requires:
  - phase: 01-domain-router
    provides: domain classification stub that routes agentic phases to AGENT-SPEC workflow
provides:
  - AGENT-SPEC.md template with 10 design dimensions, test contracts, and checker sign-off
  - AGENTIC-PATTERNS.md topology reference catalog with 6 patterns and selection guidance
affects: [02-02-agent-workflow, 02-03-plan-phase-integration, future agentic phases]

tech-stack:
  added: []
  patterns:
    - 10-dimension agent design contract with grouped handling modes (design decisions / cross-cutting / lightweight)
    - Test contracts in TEST-SPEC scenario/observable/pass-criteria format scoped to agent boundaries
    - Topology pattern catalog with explicit upgrade/downgrade signals to challenge over-engineering

key-files:
  created:
    - get-shit-done/templates/AGENT-SPEC.md
    - get-shit-done/references/AGENTIC-PATTERNS.md
  modified: []

key-decisions:
  - Test contract format mirrors TEST-SPEC.md exactly (Action / Observables / Pass criteria) for SPEC-04 structural reuse
  - Observability section uses three required subsections (Tracing, Boundary Logging, Failure Diagnosis) so checker can validate concretely instead of accepting "TBD"
  - Each topology pattern except Chain has both upgrade and downgrade signals so the researcher can challenge complexity in either direction
  - Pattern Selection Checklist orders questions simplest-first to bias toward simpler patterns

patterns-established:
  - "Spec template with grouped section comments (Design Decisions / Cross-Cutting / Lightweight) -- new spec templates can use the same handling-mode grouping"
  - "Reference docs cite primary sources at the top (Anthropic, Andrew Ng) so the researcher can defend recommendations"
  - "Each pattern entry has a fixed shape (Description, Diagram, Example, Tradeoffs, Failure modes, Observability, Upgrade/Downgrade) for parallel comparison"

requirements-completed: [SPEC-01, SPEC-04, SPEC-05]

duration: 5 min
completed: 2026-04-17
---

# Phase 2 Plan 01: Agent Spec Foundation Summary

**AGENT-SPEC.md template with 10 design dimensions plus AGENTIC-PATTERNS.md topology reference -- the content layer the gsd-agent-researcher will fill and cite.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T11:10:37Z
- **Completed:** 2026-04-17T11:15:18Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- AGENT-SPEC.md template captures all 10 design dimensions grouped by researcher handling mode, plus Test Contracts in TEST-SPEC format and a 10-row Checker Sign-Off table
- AGENTIC-PATTERNS.md catalogs 6 topologies (Chain, Routing, Parallel, Orchestrator-Workers, Evaluator-Optimizer, Autonomous) with parallel structure for side-by-side comparison
- Pattern Selection Checklist gives the researcher a 6-question decision flow biased toward simpler patterns
- Observability is structurally enforced via three required subsections (Tracing, Boundary Logging, Failure Diagnosis) -- "TBD" or "standard logging" cannot pass the template structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AGENT-SPEC.md template** -- `1d67da2` (feat)
2. **Task 2: Create AGENTIC-PATTERNS.md topology reference** -- `a522505` (feat)

## Files Created/Modified

- `get-shit-done/templates/AGENT-SPEC.md` -- New spec template: 12 H2 sections (10 design dimensions + Test Contracts + Checker Sign-Off), YAML frontmatter with topology_pattern and agent_count, group comments separating handling modes, 9 Rationale subsections, links to AGENTIC-PATTERNS.md from Orchestration Pattern section
- `get-shit-done/references/AGENTIC-PATTERNS.md` -- New reference catalog: summary table, 6 detailed pattern sections (each with description, ASCII diagram, real-world example using GSD's own workflows where possible, tradeoffs, failure modes, observability requirements, upgrade and downgrade signals), Combining Patterns section, Pattern Selection Checklist

## Decisions Made

- **Test contract format chosen for structural compatibility, not translation:** Used the exact Action / Observables / Pass criteria shape from TEST-SPEC.md. SPEC-04 alignment is now structural -- agent test contracts can be consumed by /gsd2:verify-work without reformatting.
- **Observability split into three required subsections:** Tracing, Boundary Logging, Failure Diagnosis. This forces concrete answers per agent boundary instead of one-line "we'll log things" placeholders. Aligns with CONTEXT.md decision that observability is a first-class spec concern.
- **Real-world examples in AGENTIC-PATTERNS use GSD's own workflows:** Chain example cites discuss/plan/execute pipeline, Routing cites the domain router, Parallel cites the wave-based executor. The researcher can point users at concrete artifacts in their own codebase, not abstract examples.
- **Each pattern except Chain has a Downgrade signal:** Captures when the pattern is overkill. Researcher uses these to challenge over-engineering, mirroring the consultant character defined in CONTEXT.md.

## Deviations from Plan

None -- plan executed exactly as written. All verification commands passed on first run with the expected counts (12 H2 in AGENT-SPEC, 9 Rationale, 9 H2 in AGENTIC-PATTERNS, 6 Failure / 6 Observability / 5 Downgrade signals).

## Issues Encountered

One transient bash sandbox issue caused `grep` to return "No such file or directory" for AGENTIC-PATTERNS.md right after creation, even though `ls` confirmed the file existed. Switched to a quoted-variable path pattern (`FILE="..."; grep "$FILE"`) which resolved it. No code or content impact.

## User Setup Required

None -- pure markdown content additions, no external service configuration.

## Next Phase Readiness

- Plan 02-02 (agent-spec workflow + researcher/checker agents) can now proceed: the template and reference doc this plan delivered are the inputs the researcher fills and the checker validates.
- Plan 02-03 (init.cjs and plan-phase integration) is independent and can run in parallel.
- No blockers.

## Self-Check: PASSED

- [x] FOUND: get-shit-done/templates/AGENT-SPEC.md (12 H2 sections, frontmatter present)
- [x] FOUND: get-shit-done/references/AGENTIC-PATTERNS.md (9 H2 sections, 6 patterns + Summary + Combining + Checklist)
- [x] FOUND commit: 1d67da2 (Task 1)
- [x] FOUND commit: a522505 (Task 2)

---
*Phase: 02-agent-spec*
*Completed: 2026-04-17*

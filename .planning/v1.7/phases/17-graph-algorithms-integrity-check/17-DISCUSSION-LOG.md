# Phase 17: Graph Algorithms + Integrity Check - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-07-05
**Phase:** 17-graph-algorithms-integrity-check
**Decisions captured:** 6 (3 strong-specialist-backed, 3 weak/discretion)

---

## Conversation Summary

### Validate severity model (the crux)
**User's perspective:** Presented with three options for how `graph validate` should treat structural vs advisory problems for exit codes. User declined to pick — noted "I would probably research, maybe worth to raise to consilium of agents" and, on the gate question, "not sure what it may affect from user perspective." Read as: these are technical policy, not user taste — user is uncomfortable deciding as preference.
**Decision:** Two-tier + `--strict`. Structural (cycles, dangling depends_on/satisfies) = fatal; advisory (affects-vs-files_modified, unresolved key_link/artifact prose) = warn/exit-zero; `--strict` promotes all to fatal.
**Signal:** [STRONG, specialist-backed] — resolved autonomously at HIGH confidence from PROJECT.md's locked "advisory before authoritative" rollout + live `graph analyze` evidence that the advisory layer is prose-noisy today. Not a preference axis; forced by upstream constraints.

### Trust-gate definition ("clean numbers" for Phase 19)
**User's perspective:** Same — declined to pick, flagged uncertainty about user-facing impact, suggested more discussion.
**Decision:** Zero cycles + zero dangling structural refs (hard); affects-contradiction count surfaced as a reviewable number, not required to be zero.
**Signal:** [STRONG, specialist-backed] — HIGH confidence from STATE.md Phase-19 gate note + the advisory-quality risk PROJECT.md names. "Zero everything" imports out-of-scope cleanup; "acyclic only" earns too little trust.

### Health integration, topoSort/detectCycles, blast-radius, contradiction definition
**Decision:** Health check mirrors severity split (error=structural, info=advisory), reuses `addIssue`, read-only. Kahn's for topoSort; detectCycles names offending nodes. blast-radius = forward BFS over affects+provides, lvl 1/2/3, default full closure. Contradiction = affects↔files_modified mismatch, both directions, advisory-tier.
**Signal:** [STRONG/WEAK, specialist-backed] — standard practice + GRAPH-05/06 wording; internals are Claude's Discretion.

## Established (Not Discussed)
- Phase 16's `buildGraph` model, node-id conventions, edge shape — LOCKED upstream, consumed as-is.
- `cmdValidateHealth` `addIssue` two-tier severity — reused, not reinvented.
- TDD RED-first discipline; `gsd-tools graph` dispatch pattern.

## Deferred Ideas
- Consumer repoint → Phase 18; computed waves + requires-closure → Phase 19; advisory auto-repair → out of scope; CODEGRAPH → v2.

## Process Note
Both crux questions were surfaced to the user as choices; the user reframed them as technical/research questions rather than taste. Per the operating principle (reserve human input for judgment only a human can supply), both were resolved autonomously with HIGH-confidence evidence and an override offer. User elected to run `/gsd2:discuss-loop` on the resulting CONTEXT.md as an adversarial check before planning — the consilium runs against the concrete locked artifact rather than an abstract debate.

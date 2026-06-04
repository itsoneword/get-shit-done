# Phase 3: Execution-Detail Enrichment - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-04
**Phase:** 03-execution-detail-enrichment
**Decisions captured:** 6 (4 strong, 2 weak, 0 discretion)
**Context:** Discussed in parallel with Phase 2 execution (user requested planning Phase 3 ahead while Phase 2 proceeds).

---

## Conversation Summary

### Reference doc loading strategy
**User's perspective:** Picked "Hybrid (Recommended)" from a presented choice. Aligns with their context-bloat north-star — don't force docs into every run.
**Decision:** Verifier eager-loads bug-pattern doc; planner pulls anti-pattern doc on-demand.
**Signal:** [STRONG] — explicit selection from concrete options.

### Context-utilization classifier (CTX-02) — REJECTED
**User's perspective (paraphrased + quoted):** *"There is no need to inform me about this problem … There is only need to fix it. And it is what I already addressed previously."* The keep-context-tiny goal is met structurally (keep only latest state, archive prior decisions to previous versions) — already partly done via partitioning/distillation. A 1M window makes it "not a big deal," but he prefers lean context on principle.
**Decision:** Drop the human-facing classifier from Phase 3.
**Signal:** [STRONG] — emphatic, reasoned, references prior work.

### Degradation tiers / read-depth doc (CTX-01) — REJECTED
**User's perspective:** Did not address directly; resolved technically. `context_window` is a static config field, not a live signal — so read-depth tiers keyed to live % have no consumer once CTX-02 is gone. Confirmed in the reshape question (user "agreed with 1").
**Decision:** Drop CTX-01 too; reshape the whole CTX cluster → doctor phase.
**Signal:** [STRONG] — technical consequence + user confirmation.

### The "doctor" idea (new phase)
**User's perspective (quoted):** *"the idea for the health command could be useful if we have the agents assisting with the healing, like the doctor command … which could find, by [reading] the documentation, if there were some decisions which were documented and then overwritten. So maybe we can do the health as part of the doctor and the doctor is the command [that] fix[es] this. So think about it."*
**Decision:** Park as its own phase (semantic extension of existing `/gsd2:health` + `validate health --repair`). Not folded into Phase 3 (scope guardrail).
**Signal:** [STRONG] — concrete mechanism described; "think about it" = park, don't drop.

### Python content scope (GUIDE-02)
**User's perspective:** Accepted the framed scope (idioms, anti-patterns, typing conventions).
**Signal:** [WEAK] — no elaboration.

### Doc placement & filenames (GUIDE-01)
**User's perspective:** Not discussed — resolved from established `references/` convention + port source.
**Signal:** [WEAK, source/established-backed].

## Established (Not Discussed)
- `references/` is the doc home (AGENTIC-PATTERNS.md / verification-patterns.md / tdd.md precedent).
- `@path` (eager) vs "Read path" (on-demand) loading idioms — reused, not reinvented.
- `gsd-health` = `gsd-tools validate health [--repair]`.

## Deferred Ideas
- **Doctor phase** — agent-assisted semantic health/heal: detect documented-then-overwritten decisions, archive superseded ones. Inherits reshaped CTX-01/CTX-02. See cross-phase-notes.md.

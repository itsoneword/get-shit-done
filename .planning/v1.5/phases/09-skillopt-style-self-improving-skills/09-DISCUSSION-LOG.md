# Phase 9: SkillOpt-Style Self-Improving Skills - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-08
**Phase:** 09-skillopt-style-self-improving-skills
**Decisions captured:** 6 (5 strong, 0 weak, 1 discretion)

---

## Conversation Summary

### Opening framing → user reframe
**Claude's open:** Led with the scope-split decision (substrate-only vs substrate+loop vs feasibility spike), surfacing the two blocking tensions — cheap-vs-faithful scorer + small-N data — as the discriminating facts.
**User's perspective:** Rejected the framing as posed. Questioned "why gameable" for LLM-judge given GSD has good references + an advisor layer. Stated the actual goal: a *self-evolving skill model during project development* — concrete example: feature ships, user tests, finds a missing backend endpoint, fixes it, but *also* wants the skill that wrote it to learn "don't miss endpoints." Asked whether SkillOpt's logic even fits GSD's scope vs. something more organic.
**Decision:** Reshape Phase 9 from SkillOpt offline batch-optimizer to **online feedback-driven skill evolution**.
**Signal:** [STRONG] — user-driven reframe with reasoning + a concrete motivating example; explicitly chose "reframe to feedback-driven."

**Key analytical exchange:** Claude conceded the gameability objection mostly evaporates in the online model (no autonomous score-maximizer; signal is a real failure, not a proxy; human ratifies). Named what's given up: the rigorous quantitative held-out gate, replaced by human ratify + advisor-critic + delegated consolidation. Named the new hard problem: attribution + accretion control.

### Capture surface
**User's perspective:** Chose **Both — manual `/teach` primary, auto-miner suggests only**.
**Decision:** Manual command is the trusted path that lands lessons; auto-miner nominates recurring patterns ("seen 3×") but never edits.
**Signal:** [STRONG] — explicit selection.

### Gate autonomy
**User's perspective:** Chose **Always propose, human ratifies** every edit.
**Decision:** No edit touches `get-shit-done/` source unreviewed; the human gate is the primary bloat guard.
**Signal:** [STRONG] — explicit selection; editing the framework's own brain warrants the round-trip.

### Attribution
**User's perspective:** Chose **Loop proposes target from telemetry + artifact, user confirms**.
**Decision:** Loop infers the culprit agent from Phase 4 telemetry + produced artifact, proposes the edit target, user confirms or redirects.
**Signal:** [STRONG] — explicit selection.

### Accretion / consolidation
**User's perspective:** Chose **Delegate to the doctor**.
**Decision:** This phase = capture → gate → apply + lessons ledger. Consolidation (dedup/merge/prune) is the future semantic `/gsd2:doctor`'s job.
**Signal:** [STRONG] — explicit selection.

### Reflection/edit engine
**Decision:** Advisor-style critic drafts + sanity-checks the bounded diff before the user sees it; exact agent/model deferred to research.
**Signal:** [DISCRETION] — user gestured at "advisor or higher thinking layer"; mechanics left open.

## Established (Not Discussed)
- Phase 4 telemetry as attribution substrate.
- Source→runtime split (commit `get-shit-done/` only).
- `.planning/cross-phase-notes.md` append-only ledger as structural precedent for `.planning/lessons/`.

## Deferred Ideas
- SkillOpt quantitative optimizer (offline benchmark + scorer) — dropped; revisit only if a real eval substrate appears.
- Lesson/skill-edit consolidation → future `/gsd2:doctor`.
- Auto-apply / tiered-autonomy gate — rejected for v1.

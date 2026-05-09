# Phase 1: Domain Router - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the conversation and reasoning.

**Date:** 2026-04-15
**Phase:** 01-domain-router
**Discussion style:** Conversation-first
**Decisions captured:** 10 (7 strong, 3 weak, 0 discretion)

---

## Conversation Summary

### Simplicity and scope
**User's perspective:** Opened with "we should not overcomplicate and break what is already working." The real value is in Phase 2 (AGENT-SPEC) where domain-specific agents do specialized planning. The router is just the classification layer that enables that.
**Decision:** Keep router minimal and reliable — it's infrastructure, not the feature.
**Signal:** [STRONG] — Opening statement, most emphatic point in the entire discussion.

### Classification behavior
**User's perspective:** Router should be "smart" — assess what's being built based on specific patterns, deployments, and approaches. Different domains need different questions (agentic needs agent communication details, UI needs design contracts, generic is fine as-is).
**Decision:** Router analyzes phase description + codebase context, presents evidence-based classification.
**Signal:** [STRONG] — User gave detailed reasoning about what "smart assessment" means.

### Confirmation vs automatic routing
**User's perspective:** When asked about aggressive (auto-route) vs conservative (ask first), user said "better to ask than do blindly."
**Decision:** Router always presents classification with evidence and asks user to confirm before routing.
**Signal:** [STRONG] — Direct, unambiguous preference.

### Where the router lives
**User's perspective:** Agreed that discuss-phase is the right place (specialized questions need to happen during discussion). Also agreed that plan-phase should keep a lightweight "missing spec?" guard for when users skip discussion.
**Decision:** Primary router in discuss-phase, lightweight file-existence check in plan-phase.
**Signal:** [STRONG] — User confirmed after examining the reasoning: "feels right, true."

### Why the UI-SPEC gate was in plan-phase
**User's perspective:** User proactively asked "what could be the reason to put it in planning phase?" — wanted to understand before moving it. Accepted the reasoning that it's a safety net for skipped discussions.
**Decision:** Plan-phase keeps a guard, but it stops being the classifier.
**Signal:** [STRONG] — User initiated this line of thinking, showing it mattered to them.

### Multi-domain phases
**User's perspective:** Rare because phase separation usually handles it. But it can happen (e.g., simple agent + simple view). When it does, just run both questionnaires sequentially. User noted that LLM responses aren't hardcoded — users can shortcut by giving brief answers or referencing existing specs.
**Decision:** No special multi-domain machinery. Sequential questionnaires, user can shortcut.
**Signal:** [WEAK] — User acknowledged rarity and said "just follow the general pattern."

### End state confirmation
**User's perspective:** Confirmed the summary: classification works, UI-SPEC routing preserved via new path, agentic classification ready for Phase 2 to consume, plan-phase gate simplified.
**Decision:** Phase 1 delivers working classification + UI routing. Agentic routing is a stub until Phase 2.
**Signal:** [STRONG] — "yep" to a detailed end-state summary.

## Established (Not Discussed)
- UI-SPEC workflow structure (researcher + checker agents) — accepted as-is
- Config system pattern (`workflow.*` keys) — accepted as-is
- init.cjs compound command pattern — accepted as-is
- gsd-tools.cjs as the CLI layer — accepted as-is

## Deferred Ideas
None — discussion stayed within phase scope.

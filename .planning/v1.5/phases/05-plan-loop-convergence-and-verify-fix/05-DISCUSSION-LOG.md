# Phase 5: Plan-Loop Convergence and Verify Fix - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-05
**Phase:** 05-plan-loop-convergence-and-verify-fix
**Decisions captured:** 8 (7 strong, 0 weak, 0 discretion, 1 strong-conditional-resolved)

---

## Conversation Summary

Well-scoped two-requirement phase (CONV-01 + FIX-01). Codebase scout resolved most ambiguity up front: the checker already emits a parseable `**Issues:** {X} blocker(s), {Y} warning(s)` line, and the `parseMustHavesBlock` bug is a clean off-by-2-space hardcode. Discussion focused on the four gray areas named in ROADMAP, all presented as concrete choice points.

### Stall threshold
**User's perspective:** Picked "2 cycles" (recommended) over aggressive 1-cycle and do-nothing "only at max."
**Decision:** Stall = BLOCKER+WARNING count non-decreasing for 2 consecutive comparison cycles.
**Signal:** STRONG — deliberate pick of the middle option with stated trade-off awareness.
**Follow-up surfaced:** With max_iterations=3 there are only 2 comparison cycles, so the stall is confirmable exactly at the iteration-3 boundary — CONV-01 makes the existing escalation convergence-aware rather than adding an earlier exit. Reasoned through explicitly with the user.

### Escalation UX
**User's perspective:** Picked "soft prompt, reuse existing options" (recommended).
**Decision:** Branch the iteration-3 message — `## STALL DETECTED` (with trajectory) if never decreased, else existing "max reached" message; both reuse Force proceed / Retry / Abandon.
**Signal:** STRONG — recommended pick, consistent with existing UX.

### Stall persistence
**User's perspective:** Conditional — "if only active within a single workflow, inline is fine, because it almost never being continued in another context. but if it can be used btw workflows then file definitely."
**Decision:** Inline only. Condition resolved from code: the revision loop runs entirely within one plan-phase invocation; no cross-session resume path exists → inline.
**Signal:** STRONG (user-conditional-resolved) — the rule is the user's; the branch selection is derived from codebase fact, surfaced back to the user.

### parseMustHavesBlock fix scope
**User's perspective:** Picked "generalize to N-space" (recommended).
**Decision:** Detect base indent dynamically, parse relative; works for 2- and 4-space; add regression test on a real 2-space plan fixture.
**Signal:** STRONG — recommended pick; aligns with "kill the bug class" intent.

## Established (Not Discussed)
- Revision loop structure (`plan-phase.md` §12, iteration_count, max 3, three escalation options) — reused, not redesigned.
- Checker `## ISSUES FOUND` return contract — left unchanged; count is scraped from existing `**Issues:**` line.
- `parseVerifyCommands` (Phase 4) — left untouched; separate correct code path.
- max_iterations stays at 3 — not raised.

## Deferred Ideas
- Cross-workflow stall persistence via CHECKPOINT file — only if planning becomes resumable mid-loop across sessions.
- Earlier stall exit (1-cycle threshold or raised max_iterations) — rejected as false-stall-prone / scope creep.

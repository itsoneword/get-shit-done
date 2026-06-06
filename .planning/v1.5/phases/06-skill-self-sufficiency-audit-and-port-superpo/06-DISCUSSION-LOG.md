# Phase 6: Skill Self-Sufficiency — Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-06
**Phase:** 06-skill-self-sufficiency-audit-and-port-superpo
**Decisions captured:** 6 (4 strong, 0 weak, 2 discretion)

---

## Conversation Summary

### Pre-discussion scouting (resolved without asking the user)
- Read all 4 candidate-gap superpowers skills + the 14-skill inventory.
- Verified `gsd-debugger` already implements scientific-method debugging (hypothesis→test→root-cause-first, persistent session) → systematic-debugging marked **covered**, removed from gap list before presenting. Saved a user round-trip.
- Surfaced the worktree contradiction (ROADMAP gap #4 vs Phase-1 SEC-DEFER-01 "user doesn't rely on worktree isolation") as the highest-leverage question.

### Worktrees
**User's perspective:** A separate session created Phase 7 (parallelization) which depends on worktree isolation — "let's keep it and let's do it." Then deferred the Phase-6/7 boundary to Claude ("both options fine").
**Decision:** Port the worktree *technique* as a reference in Phase 6; Phase 7 owns the execute-phase add→wave→merge orchestration. No gsd-tools helper now (would guess Phase 7's API).
**Signal:** [STRONG] on keeping worktrees in scope; [DISCRETION] on the boundary (Claude chose technique-only).

### Execution-time TDD
**User's perspective:** Default-ON "but only where it is needed." Skip trivial implementations and agent/prompt-only changes ("not always possible to make correct tests for that… although if possible it would always be good"). Don't make it a blanket hard requirement.
**Decision:** Planner default-tags logic tasks `tdd=true`, exempts agent/prompt/workflow edits + trivial impl; executor enforces Iron Law (watch-it-fail, rationalization counters) when `tdd=true`. Edit `tdd.md` + executor + planner heuristic.
**Signal:** [STRONG] — detailed, nuanced reasoning with the GSD-specific agent-change exemption.

### receiving-code-review
**User's perspective:** (not separately probed — settled by the form-factor philosophy + standing no-sycophancy preference)
**Decision:** Port as a reference loaded at review-consumption points (gsd2:review output, ship, external PR comments): verify-before-implement, no performative agreement, push back with reasoning, YAGNI, clarify-all-unclear-first.
**Signal:** [STRONG] — reinforces the user's standing neutral-tone/no-sycophancy preference.

### writing-skills
**User's perspective:** Unsure of the gap; asked Claude to elaborate, then to decide what fits the general concept. Gave the governing principle: every action gets its dedicated number of tools/skills/agents; be optimal in separating tasks; add artifacts only when needed; whether needed is "for the orchestrator, for Opus, to decide."
**Decision:** Port as a GSD artifact-authoring + when-to-add-judgment reference — codifies (a) when a capability deserves a dedicated artifact vs inline, and (b) how to author it so the model loads/obeys it (description=when-not-what, one good example, close loopholes).
**Signal:** [DISCRETION → Claude's recommendation] — chosen because it's the only framing that makes the user's own meta-principle loadable by the deciding model.

### Form-factor principle
**User's perspective:** Explained the loop/skill bias — skills encode the right way to answer a recurring question about an output; loops apply the skill back to the model; trades slight token/time cost for significant quality. Targets the failure mode "model has a question which it simply answers without proper research" mid-execution.
**Decision:** References + workflow/agent edits; no new commands.
**Signal:** [STRONG] — extended reasoned philosophy, consistent with PROJECT.md anti-proliferation bias.

## Established (Not Discussed)
- Source↔runtime mirror rule for all ported references (from Phases 3/4).
- gsd-debugger covers systematic-debugging (scouted, not debated).
- ~10 of 14 skills already covered by existing GSD commands.

## Deferred Ideas
- Worktree orchestration + parallel-safety gate → Phase 7.
- Hard-removal of superpowers plugin → post-phase follow-up.
- Full blanket default-ON TDD → rejected.

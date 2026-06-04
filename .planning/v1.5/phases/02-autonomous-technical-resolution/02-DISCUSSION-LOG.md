# Phase 2: Autonomous Technical Resolution - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-04
**Phase:** 02-autonomous-technical-resolution (reshaped from "General Research Agent")
**Decisions captured:** 11 (8 strong, 2 weak, 1 discretion)

---

## Conversation Summary

### Overlap check (user-initiated)
**User's perspective:** Before discussing the four gray areas, pushed back: "is there a reason for this agent at all or [does an] existing one overlap its functions already." Skeptical of redundancy.
**Decision:** Honest verdict given — ~80% of "research a technical question inline" already exists (micro-research mode, `gsd-phase-researcher` full mode, and the `deep-research` skill which even does adversarial verification). Only genuinely-uncovered niches: plan-phase inline path (verified absent), standalone invocation, a mid-depth tier.
**Signal:** [STRONG] — user forced the question first; drove the whole reshape.

### The vision (user monologue)
**User's perspective:** The higher goal is enhancing Claude Code's agentic capability. The bottleneck is *the human*, not the model — every Claude→human round-trip stalls a fast system on a slow human, and no human can hold 10×10×10 nested plan detail. GSD's job: feed just-enough context, ask the human only for judgment they uniquely own (taste/preference/intent), resolve everything model-answerable autonomously. Explicit design bias: "more loops and skills... rather than create many many agents for every case." Cited a week lost wiring 5–10 agents for simple CV text as the anti-pattern.
**Decision:** Adopted as a PROJECT-LEVEL north-star (PROJECT.md Core Value operating principle + cross-phase-notes), re-scoring all phases. Reshaped Phase 2 around it.
**Signal:** [STRONG] — extended, emphatic, reasoned; user authorized roadmap reshaping ("I don't really mind to reshape the plan").

### The decision fork (agent vs loop)
**User's perspective:** Open to reshaping; floated a "critique agent" (research → critique → re-research) but unsure ("not so clear"). Wanted to reason from use cases.
**Decision:** Collapsed to one fork — the user's "loops not agents" principle contradicts RSCH-01 ("a distinct researcher agent exists"). User chose **"Rewrite RSCH around a loop."** Phase 2 becomes an autonomous technical-resolution loop: research → self-critique → confidence verdict, wired into discuss + plan, reusing `deep-research`, closing plan-phase's missing inline path, eliminating the `question_triage` LOW-confidence human fallback where evidence allows.
**Signal:** [STRONG] — explicit selection after the contradiction was named.

### Routing
**Decision:** Skip `/gsd2:agent-spec-phase`; plan directly. Single loop, no multi-agent topology.
**Signal:** [STRONG] — user selected "Skip AGENT-SPEC → plan directly."

### Critique idea, scoped
**Decision:** The critique instinct is adopted as the *self-critique half* of the loop (confidence-raising for autonomous resolution), NOT a standalone reviewer agent, and not rebuilt where `deep-research` already adversarially verifies.
**Signal:** [STRONG] derived from the loops-over-agents bias.

### Self-critique mechanism
**Decision:** Mirror Phase 4's bounded-iteration verifier-loop shape rather than invent a new convergence pattern.
**Signal:** [WEAK] — sensible reuse; planner may adjust.

### Signal-strength honoring
**Decision:** Loop reads CONTEXT.md, skips `[STRONG]` decisions, records resolved decisions with confidence + source.
**Signal:** [DISCRETION] — mechanism largely determined by existing infra.

## Established (Not Discussed)
- Micro-research mode shape, `question_triage` classification, `deep-research` skill, Phase 4 verifier-loop primitives, signal-strength tag infra — all presented as the substrate the loop composes from, not relitigated.

## Deferred Ideas
- UI not being tested — future milestone/backlog (named live pain, no v1.5 home).
- Context bloat at scale (graph/RAG) — already Phase 6/7 candidates; context half partially lands in Phase 3 (CTX).
- Standalone general-researcher agent / core's AI-SPEC tier — explicitly rejected by the reshape.
- "Add user sync checkpoints to plan-phase subagent chains" todo — adjacent but distinct (checkpoint cadence, not technical resolution); not folded.

## Artifacts changed by this reshape
- `.planning/REQUIREMENTS.md` — RSCH-01..03 rewritten (agent → loop); section retitled "Autonomous Technical Resolution."
- `.planning/ROADMAP.md` — Phase 2 title/narrative/goal/discussion-focus/success-criteria/progress-row updated.
- `.planning/PROJECT.md` — Core Value gains the minimize-human-round-trip operating principle; target-feature bullet + Active req + 2 Key Decisions updated.
- `.planning/cross-phase-notes.md` — north-star appended (re-scores all phases; Phase 3 + future-milestone notes).

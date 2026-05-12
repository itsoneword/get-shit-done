# Phase 2: AGENT-SPEC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the conversation and reasoning.

**Date:** 2026-04-17
**Phase:** 02-agent-spec
**Discussion style:** Conversation-first
**Decisions captured:** 10 (7 strong, 3 weak, 0 discretion)

---

## Conversation Summary

### AGENT-SPEC as separate file vs folded into CONTEXT.md
**User's perspective:** Voted for separation without hesitation. Same reasoning as UI-SPEC — clean pattern, file-existence checks work.
**Decision:** Separate AGENT-SPEC.md file in phase directory
**Signal:** STRONG — immediate, clear preference with no hedging

### Researcher character and depth
**User's perspective:** Strongly favored deeper questioning with educational component. "Agentic pipelines are pretty new, and not so much known things about it so far, so if agent does small research and gives context/explanation of the potential options — this would be ideal scenario." Wants the researcher to actively challenge overcomplicated choices, not just present options.
**Decision:** Researcher acts as technical consultant — educates on tradeoffs, pushes back on overkill, explains consequences
**Signal:** STRONG — user gave specific example (LangGraph for simple pipeline = overcomplicated), extended explanation of why education matters

### 10 design dimensions and their grouping
**User's perspective:** Initially agreed with 7-dimension proposal that left memory, reflection, and reasoning as "planner-derived." Pushed back: "why not add rest 3 somewhere? seems to be that reflection is quite important in evaluation, and memory is essential with building complex systems." Accepted final 10-dimension grouping with 3 tiers (design decisions, cross-cutting concerns, lightweight capture).
**Decision:** All 10 dimensions in the spec, grouped by researcher handling depth
**Signal:** STRONG — user actively shaped the grouping by pushing back on the initial proposal

### Observability as first-class concern
**User's perspective:** This was the emotional center of the discussion. Described real pain: building agentic systems, tests pass, but production fails and you can't tell which agent broke or why. "During troubleshooting you understand that this could be avoided if we think about the approach in the beginning." Referenced LangGraph's state/nodes as an example of architecture that enables traceability.
**Decision:** Observability forced into spec at design time, not bolted on later. Spec captures what gets logged at each agent boundary.
**Signal:** STRONG — longest response, most specific examples, clear frustration with current state

### Spec captures WHY, not just WHAT
**User's perspective:** Interleaved with observability discussion. "Ideal situation is when we have better description of what should be done and why. And then when we build it, we have clear understanding if something goes wrong, at what step and why."
**Decision:** Each design decision includes rationale. Spec is a debuggability contract.
**Signal:** STRONG — repeated across multiple responses, core to the user's vision

### Template structure details
**User's perspective:** "I technically have no particular requirement... it would make sense to research topic a bit." Explicitly deferred to research.
**Decision:** Template field design is research territory
**Signal:** WEAK — user explicitly said they can't answer this, wants research to guide it

### Test contracts format
**User's perspective:** Did not elaborate on test contract format. Accepted proposed direction (input/output contracts + behavioral assertions) without pushback but without enthusiasm.
**Decision:** Input/output contracts per agent + behavioral assertions, compatible with TEST-SPEC.md
**Signal:** WEAK — no strong opinion expressed, derived from discussion

### Agentic design dimensions research
**User's perspective:** Asked for help researching recognized competency areas for agentic system building. "There are general reqs/skills needed during agentic system building (observability, evaluation, security)... could you please help to research this topic a bit?" Remembered seeing a framework in a video.
**Decision:** Micro-research conducted. Synthesized from Anthropic's Building Effective Agents, Andrew Ng's 4 patterns, and production literature into 10 dimensions.
**Signal:** STRONG — user specifically requested this research, reviewed and shaped the output

---

## Established (Not Discussed)
- UI-SPEC orchestration pattern (researcher → checker → revision loop) — presented as the pattern to follow, user implicitly accepted
- Domain router from Phase 1 — presented as integration point, no questions raised
- init.cjs and model-profiles.cjs registration patterns — technical details, user not asked
- Config system keys — follows existing pattern, no discussion needed

## Deferred Ideas
None — discussion stayed within phase scope

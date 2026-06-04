# Resolution Loop — Autonomous Technical Resolution

## Purpose

When a TECHNICAL or HYBRID question arises in a GSD workflow, the resolution loop resolves it autonomously (research → self-critique → confidence verdict) instead of bouncing it to the human. The human is reached ONLY when confidence stays LOW after the loop exhausts its bounded iterations, or the question is genuine preference/taste. By running the loop internally, the orchestrator answers most technical questions without a round-trip — the bottleneck in AI-assisted development is the human in the loop, not the model.

## Where the loop runs (tool-boundary constraint)

The loop's research steps require the `Task`/`Agent` tool and therefore MUST run at the **orchestrator** level (`discuss-phase.md`, `plan-phase.md`). The gsd-planner has no Task tool (its grants are: Read, Write, Bash, Glob, Grep, WebFetch, context7 — no `Task`, no `Agent`, no `Skill`). A loop placed inside gsd-planner silently degrades to inline Context7/WebFetch guessing; the research primitives cannot execute there. Therefore: the loop's research steps run at orchestrator level (in discuss-phase.md or plan-phase.md), and gsd-planner's role is only to SURFACE unknowns via `<open_question>` tags — never to SPAWN research.

Concisely: orchestrator level = loop runs here. gsd-planner has no Task = loop cannot run there.

## Research primitives

- **Light path:** `gsd-phase-researcher` `micro_research_mode` (single-question inline, 15–30s, returns Recommendation/Reasoning/Confidence/Source/Caveat).
- **Heavy path:** orchestrator-spawned gsd-phase-researcher full mode (multi-source cross-verified). Use gsd-phase-researcher full mode as the portable heavy path. Do NOT call `Skill(deep-research)` from any subagent — it is a native harness skill reachable only from the top-level orchestrator and not guaranteed on every install; use gsd-phase-researcher full mode as the portable heavy path.

## Signal-strength pre-check (RSCH-03)

Before spawning the loop, scan CONTEXT.md `<decisions>`. If the question subject matches a decision tagged `[STRONG]`, `[STRONG, user-override]`, or `[STRONG, specialist-backed]` → apply it directly (HIGH confidence, source "CONTEXT.md locked decision"), do NOT spawn the loop — skip the loop entirely.

This pre-check prevents re-opening already-resolved technical questions and honors signal-strength honoring. If the question matches a STRONG decision, skip the loop and apply the decision as fact.

## The loop (bounded iteration)

Document this structure verbatim:

```
resolution_loop(question, constraints, budget_remaining):
  max_iterations = 2   # ceiling; may be 3. Bounded — mirrors Phase 4 max-3 ceiling.
  iteration = 0
  while iteration < max_iterations and budget_remaining > 0:
    result = micro_research(question, constraints, critique_hint[iteration])
    if result.confidence in [HIGH, MEDIUM]:
      return verdict(result, iterations_used=iteration+1, escalate=false)
    iteration += 1; budget_remaining -= 1
    critique_hint[iteration] = derive_critique(result)  # broaden query / alternate source type
  return verdict(result, confidence=LOW, iterations_used=max_iterations, escalate=true)
```

**Critique strategies:**
- Iteration 2 broadens: drop project-specific constraints, answer general domain.
- Iteration 3 (if allowed): cross-check via a different source type than the first pass (e.g., official docs if first pass was training data; WebSearch if first pass was Context7).

**Budget guard:** Check `budget_remaining > 0` before each iteration. If budget = 0 at loop entry, skip directly to ask-user (immediate LOW escalation with `escalate: true`).

## Verdict shape

```json
{
  "confidence": "HIGH | MEDIUM | LOW",
  "recommendation": "string",
  "reasoning": "string",
  "source": "string",
  "iterations_used": "number",
  "escalate": "boolean"
}
```

The `iterations_used` field records how many loop iterations ran. The `escalate` flag signals whether the question must surface to the human.

## Confidence → action (the behavior change)

- **HIGH** → decide autonomously, present as FYI ("I resolved X: [recommendation]. Source: [source]"). No question asked.
- **MEDIUM** → MEDIUM auto-decides: the orchestrator decides autonomously WITH an override caveat ("Going with X [reasoning]. You can override."). MEDIUM MUST NOT fall through to ask-user — that defeats the round-trip-reduction goal. Most real technical questions land MEDIUM, not HIGH; treating MEDIUM as LOW would eliminate the value of the loop.
- **LOW after exhaustion** → surface to human (`escalate: true`): "I looked into [topic] — conflicting signals. [best-effort finding]. Your call?"

The core behavior change: MEDIUM is autonomous (with caveat). The prior micro_research flow presented even HIGH findings back to the user. MEDIUM must auto-decide — the human can always override.

## Write-back (RSCH-03)

When the loop resolves a question (HIGH or MEDIUM), record the decision in the phase CONTEXT.md `<decisions>` section so it is not re-asked downstream:

- HIGH → tag `[STRONG, specialist-backed]`
- MEDIUM → tag `[WEAK, specialist-backed]`
- Append inline `confidence:` and `source:` and a marker comment `<!-- resolved inline by resolution loop -->`.

Example:
```
- Use Zod for input validation. confidence: HIGH, source: gsd-phase-researcher micro_research [STRONG, specialist-backed] <!-- resolved inline by resolution loop -->
```

**Downstream protection:** Once recorded, downstream agents (gsd-planner, gsd-verifier) that read CONTEXT.md will see the decision and not re-ask. The `[STRONG, specialist-backed]` and `[WEAK, specialist-backed]` tags signal whether a downstream agent may re-open the question.

## Budget

The loop's re-research iterations count against the existing discuss-phase `0-5 micro-research calls per session` budget. If budget is 0 at loop entry, skip to ask-user (immediate LOW escalation). The orchestrator tracks remaining budget across the session and passes it into the loop on invocation.

# Phase 4: Verification harness and context efficiency - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-05-05
**Phase:** 04-verification-harness-and-context-efficiency
**Decisions captured:** 14 (12 strong, 1 weak, 1 claude-discretion)

---

## Conversation Summary

### Origin
**User's perspective:** GSD has many agents and workflows but lacks a real harness — the human is in the loop on too many "did this work?" checks. The pain isn't security gates, it's verification toil. Tests passing doesn't mean the feature works; user clicks button, nothing happens, repeats 1-3 times before phase actually lands.
**Decision:** Build self-healing verifier loop on top of execute-phase + fix progress.md token waste in same phase
**Signal:** [STRONG] — extended architectural conversation, user drove framing

### Plan Structure
**User's perspective:** Wanted both tracks in one phase; suggested 1 plan for context fix, 1-2 for the loop, "wrap all into a single phase"
**Decision:** 3-4 plans total (4-1 context fix, 4-2 dependency graph, 4-3 loop primitives, 4-4 possibly executor integration)
**Signal:** [STRONG] — direct user instruction on plan count

### Agent Reuse vs New
**User's perspective:** "1 - B seems to be good. the only thing, I think we will also need to slightly rewrite the agents \ workflows for the agents (not just use what we have). so, for this task we need to understand who uses what and where (like build a graph)"
**Decision:** Reuse existing trio (verifier/debugger/fixer) with adaptation. Add a discovery plan (4-2) to build dependency graph BEFORE writing the harness — informs what to rewrite vs what to leave alone.
**Signal:** [STRONG] — user explicitly insisted on the discovery step

### Verification Trigger Granularity
**User's perspective:** "it really depends, I would say its not plan\phase, but per testable part. so ideally, we get the plans running, until the time test\verification makes sense (could be 1 plan, or more), then run the loops. Now at this point we ask human."
**Decision:** Per-task `verify_after: true` marker in PLAN.md. Loop fires when executor finishes a marked task. Fallback: end-of-plan if no markers.
**Signal:** [STRONG] — user clearly rejected per-plan/per-phase model

### Verification Spec Format
**User's perspective:** "idk, see pros and cons in all. so you decide please, what is better here."
**Decision:** Extend `must_haves:` in PLAN frontmatter with `verify:` block. Schema: cmd, expect, type (unit|integration|e2e|ui).
**Signal:** [STRONG, claude-discretion] — user delegated decision; rationale: verifier already reads must_haves, "what must be true → how I check it" belong together

### Default Behavior
**User's perspective:** "I think A is fine. easier to spot testing."
**Decision:** Default ON. Opt-out via plan flag.
**Signal:** [STRONG] — clear preference with reasoning

### UI Verification (Playwright/Puppeteer)
**User's perspective:** "what Playwright/Puppeteer mean? verification from real page rendering? is it possible without writing custom fetcher? can we use may be claude code extention in browser or so? because if its possible to do it would be just insane..."
**Decision:** Defer UI verification to v2. Schema accommodates `type: ui` so Playwright MCP integration is later config change, not architecture change.
**Signal:** [STRONG] — explicit deferral with documented v2 plan after MCP capability explained

### Ceiling-Reached Handoff Format
**User's perspective:** "agree" (to proposal of single chronological markdown report)
**Decision:** Single structured markdown report with chronological narrative of all 3 attempts.
**Signal:** [STRONG] — confirmation after concrete proposal

### Loop Architecture (verifier → investigator → fixer)
**User's perspective:** Engaged with the design directly during architectural discussion; agreed with three-agent separation, fresh contexts at each step, ceiling=3
**Decision:** Three agents in fresh contexts, max 3 iterations
**Signal:** [STRONG] — multiple turns of architectural discussion

### Testable-Part Marker Mechanism
**User's perspective:** "agree" (to `verify_after: true` proposal)
**Decision:** `verify_after: true` on individual PLAN.md tasks
**Signal:** [STRONG] — confirmation after concrete proposal

### MCP Server Curiosity (followup)
**User's perspective:** "for mcp server - interesting. we will need to learn how it works and will may have as a result a possibility to rule browser from claude code? sounds cool!"
**Decision:** Captured as deferred (v2 — Playwright MCP). Cross-phase note created so future MCP/browser-related phases inherit this context.
**Signal:** [STRONG] — strong forward-looking interest, not a v1 decision

### Context Efficiency Fix Scope
**User's perspective:** Extended discussion of telemetry from another session showing ~14k waste from double phase dumps, ~3k from double @-include, ~2-3k from slug bloat
**Decision:** All three issues in scope for Plan 4-1 (mechanical fixes)
**Signal:** [STRONG] — user provided concrete telemetry, accepted three-part scope

### TDD-Default-At-Executor (deferred)
**User's perspective:** Acknowledged TDD support already exists in gsd-executor; agreed making it default-instead-of-opt-in is a separate concern from verification harness
**Decision:** Deferred — note documented in deferred ideas, not in scope for Phase 4
**Signal:** [STRONG] — explicit out-of-scope decision

### Workflow-as-tool Restructuring (deferred)
**User's perspective:** "may be we can enhance this on tool usage ?" — raised as exploratory; agreed not the same as file count reduction
**Decision:** Deferred — separate concern, own scoping conversation later. Plan 4-1 fixes worst offender (progress.md) without restructuring all workflows.
**Signal:** [WEAK] — exploratory thought, not pursued

---

## Established (Not Discussed)

These are codebase realities the user didn't need to confirm:

- Agent invocation pattern (Task tool with `<files_to_read>` block)
- Frontmatter-driven config in PLAN.md
- gsd-tools.cjs as state oracle / CLI mediator
- Workflow markdown loaded via @-include in execution_context
- Phase directory naming conventions (NN-slug)
- Existing checkpoint protocol for human handoffs

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- v2: Playwright MCP for UI verification
- Workflow-as-tool restructuring (separate concern)
- Test-spec → executable verification linkage at test-phase level
- TDD default at executor level
- Architectural-question gate in loop ("3 strikes → question architecture")

---

## Notes for Plan-Phase

The phase has two clearly independent tracks. Plan 4-1 (context efficiency) can ship at any time and doesn't depend on 4-2/3/4. Suggest plan-phase produces them in this order but note in the plan dependency graph that 4-1 has no upstream dependency from this phase.

Plan 4-2 (dependency graph) is unusual — it's pure discovery, no implementation. Output is a structured map that becomes input to 4-3. Plan-phase should treat this as an artifact-producing plan, not a code-producing plan. Verification of 4-2 = the map exists and covers the targeted agents/workflows.

Plan 4-3 (loop primitives) is the core implementation. Likely the largest plan in this phase. Consider whether 4-4 (executor integration) folds in or stays separate based on size.

# Phase 4: Agent Observability & Telemetry - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-04
**Phase:** 04-agent-observability-telemetry
**Decisions captured:** 8 (4 strong [roadmap-locked], 4 weak; 4 open technical questions flagged)

---

## Conversation Summary

### Pre-discussion technical verification
Before opening, verified the two code-checkable risks the advisor flagged against the actual codebase:
- **Confidence scraping (OBS-02 linchpin):** CONFIRMED feasible. `resolution-loop.md` + `gsd-phase-researcher` micro_research emit `Confidence` in the Task **return text** (prose form) / verdict JSON (`confidence` field). A LOW→re-research is two distinct `gsd-phase-researcher` Task spawns, each with its own confidence line.
- **Two-event schema (OBS-01):** CONFIRMED problematic. `PostToolUse`-on-`Task` fires once at return → spawn+return share a timestamp, and hung/crashed spawns never log. A `PreToolUse(Task)` hook may be needed. Left as Open Technical Question #1; schema marked "proposed, pending feasibility."

### Domain classification
**Decision:** Generic (instrumentation tooling), not Agentic. **Signal:** structural — it's a logging hook + `gsd-tools` reader, no agent topology to design, so no AGENT-SPEC. Keyword brush to Agentic overridden on structural grounds.

### Log location
**User's perspective:** accepted recommendation. **Decision:** dedicated `.planning/telemetry/agent-trace.jsonl`. **Signal:** WEAK — clean accept of recommended option.

### Reader tooling scope
**User's perspective:** accepted recommendation. **Decision:** minimal raw `gsd-tools trace` (tail + filter) now; pretty/correlation view deferred. **Signal:** WEAK.

### Retention / rotation
**User's perspective:** accepted recommendation. **Decision:** append-only, no rotation. **Signal:** WEAK.

### Default posture
**User's perspective:** accepted recommendation. **Decision:** default-on (`config.hooks.agent_trace` defaults true), config-gated like Phase 1 hooks. **Signal:** WEAK — aligned with roadmap's dogfooding-payoff rationale.

## Established (Not Discussed)
- Hook build/registration pipeline (`build-hooks.js`, `install.js`, `settings.json` `PostToolUse` array), config-gating idiom, `gsd2-*` naming, context-monitor robustness idioms — all carried from Phase 1, presented as established, not questioned.
- Roadmap-locked mechanism (hook / `matcher: Task` / code-not-prompts / best-effort / `gsd-*` filter) — confirmed carried forward, not re-opened.

## Deferred Ideas
- Full pretty-printer / timeline / correlation-grouping reader view.
- Per-session log files; size-capped rotation.
- Consuming telemetry for stall-detection → Phase 5.

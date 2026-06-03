# GSD (Get Shit Done)

## What This Is

A framework that shifts AI-assisted development from "write code, fix bugs" to "plan deeply, execute cleanly." GSD orchestrates Claude Code (and other AI CLIs) through structured workflows: discuss, plan, execute, verify. It manages planning artifacts, phase tracking, parallel agent execution, and state persistence across sessions.

## Core Value

Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

## Current Milestone: v1.5 Capability Port

**Goal:** Close the fork's execution-detail gap by selectively porting proven, low-dependency capabilities from `gsd-core` — security guard hooks, a general research agent, and execution-detail enrichment — each discussed and verified, not copied wholesale. Preserve the fork's discussion-first differentiators (conversation-first discuss, signal-strength tagging, cross-phase pollination).

**Guiding principle:** Adopt by *understanding*, not by *copying*. Every candidate goes through discuss → plan → execute → verify. Input analysis: `reference/COMPARISON.md`.

**Target features:**
- Security guard hooks (4 standalone injection/path guards), namespaced + config-gated
- General technical/domain research agent, distinct from the agent-spec researcher
- Execution-detail enrichment: anti-pattern/bug-pattern references (+Python), context-budget tiers + utilization classifier, plan-loop stall detection
- Fix the `parseMustHavesBlock` 2-space-indent regex bug (v1.4 carry-over)

## Current State

**v1.4 Domain-Aware Planning — shipped 2026-05-13**

Domain router, AGENT-SPEC, documentation agent, verification harness, and milestone-partitioned layout all shipped. Planning directory migrated to `.planning/v1.4/phases/`. v1.5 Capability Port now in planning.

## Last Completed Milestone: v1.4 Domain-Aware Planning

**Goal:** Make GSD planning domain-aware — automatically detect what kind of system is being built and load specialized planning tools for that domain.

**Shipped:**
- Domain router in discuss-phase (classify, don't ask)
- AGENT-SPEC template and questionnaire for agentic systems
- On-demand documentation agent for system map generation
- Verification harness + context efficiency (~13k tokens saved per /gsd2:progress)
- Milestone-partitioned layout + migration command

## Requirements

### Validated

- GSD core workflow (discuss, plan, execute, verify) — shipped v1.0+
- Multi-runtime support (Claude Code, Copilot, Gemini, Codex) — shipped v1.1+
- UI-SPEC workflow for frontend phases — shipped v1.2+
- Parallel wave-based execution with gsd-executor agents — shipped v1.0+
- Model profile system with inheritance — shipped v1.3+
- Test-phase verification contract workflow — shipped v1.3.5
- Domain router in discuss-phase — shipped v1.4.1
- AGENT-SPEC template for agentic systems — shipped v1.4.1
- Documentation agent (/gsd2:document) — shipped v1.4.1
- /gsd2:progress context savings (~13k tokens/invocation) — shipped Phase 04
- Verifier-loop primitives (gsd-verifier/gsd-fixer loop mode, gsd-debugger investigator role, must_haves.verify schema, gsd-tools verify commands) — shipped Phase 04
- verify_after task attribute and verify_loop sub-flow spliced into execute-phase — shipped Phase 04 (manual end-to-end dogfood deferred — see 04-HUMAN-UAT.md)

### Active

_(milestone v1.5 Capability Port — see `.planning/REQUIREMENTS.md` for full REQ-IDs)_

- Security guard hooks ported, namespaced (`gsd2:`), and config-gated (SEC)
- General technical/domain research agent wired into discuss/plan (RSCH)
- Anti-pattern/bug-pattern reference docs incl. Python (GUIDE)
- Context-budget degradation tiers + utilization classifier (CTX)
- Stall-detection in the plan revision loop (CONV)
- `parseMustHavesBlock` 2-space-indent fix (FIX)

### Out of Scope

- DATA-SPEC for database/performance — future domain, same pattern will apply
- Framework-specific integrations (LangGraph, Pydantic AI) — spec is framework-agnostic by design
- Changes to executor agent — existing execution machinery is sufficient
- Inline documentation by executor agents — replaced by on-demand doc agent

## Context

- GSD already has one domain-specific workflow: UI-SPEC for frontend phases. The domain router generalizes this pattern.
- The UI-SPEC currently triggers via a question ("would you like to create a UI spec?") which fires even for non-UI work. The domain router should replace this with automatic classification.
- Agentic systems are the primary use case driving this milestone — the user builds agent pipelines and needs planning support for: communication contracts, security boundaries, observability, and test-driven development.
- Documentation should be generated from existing artifacts (specs, planning docs, git history), not maintained inline by agents.

## Constraints

- **Architecture**: New domain support must follow the UI-SPEC pattern — one spec template, one questionnaire, minimal new commands
- **Scalability**: Domain router must work without adding per-domain yes/no gates
- **Testing**: AGENT-SPEC should produce test contracts at planning time (TDD for agentic work)
- **Compatibility**: Must not break existing UI-SPEC workflow — router subsumes it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Classify, don't ask | Yes/no gates don't scale as domains grow; model should infer from phase description | Implemented Phase 1 |
| Observability in spec, not implementation | Logging/tracing in agentic systems is a design decision, not an afterthought | -- Pending |
| Framework-agnostic spec with pattern references | Show topology patterns (chain, graph, orchestrator) without prescribing tools | -- Pending |
| On-demand docs, not inline | One agent reads all artifacts and produces system map; avoids fragmented inline docs | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd2:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd2:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-03 — milestone v1.5 Capability Port started*

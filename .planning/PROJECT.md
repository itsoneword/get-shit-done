# GSD (Get Shit Done)

## What This Is

A framework that shifts AI-assisted development from "write code, fix bugs" to "plan deeply, execute cleanly." GSD orchestrates Claude Code (and other AI CLIs) through structured workflows: discuss, plan, execute, verify. It manages planning artifacts, phase tracking, parallel agent execution, and state persistence across sessions.

## Core Value

Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Operating principle — minimize the human round-trip.** The bottleneck in AI-assisted development is no longer the model; it is the human in the loop. Every time Claude Code stops to ask a question or hand back output, a fast system waits on a slow human — and most of those questions the model could have answered itself. GSD's job is twofold: keep the human oriented with *just-enough* context (no human holds 10 objectives × 10 plans × 10 details), and reserve human input for judgment only a human can supply — taste, preference, intent ("do you want it to work this way?"), never "which technical approach." Everything the model can resolve — technical choices, research, documentation — it should resolve autonomously. Bias toward **loops and skills that raise model autonomy over proliferating special-case agents.**

## Current Milestone: v1.5 Capability Port

**Goal:** Close the fork's execution-detail gap by selectively porting proven, low-dependency capabilities from `gsd-core` — security guard hooks, an autonomous technical-resolution loop, and execution-detail enrichment — each discussed and verified, not copied wholesale. Preserve the fork's discussion-first differentiators (conversation-first discuss, signal-strength tagging, cross-phase pollination).

**Guiding principle:** Adopt by *understanding*, not by *copying*. Every candidate goes through discuss → plan → execute → verify. Input analysis: `reference/COMPARISON.md`.

**Target features:**
- Security guard hooks (4 standalone injection/path guards), namespaced + config-gated
- Autonomous technical-resolution loop (research → self-critique → decide) wired into discuss/plan — reduces human round-trips; loops over new agents (reshaped from "general research agent" 2026-06-04)
- Execution-detail enrichment: anti-pattern/bug-pattern references (+Python), context-budget tiers + utilization classifier, plan-loop stall detection
- Fix the `parseMustHavesBlock` 2-space-indent regex bug (v1.4 carry-over)

## Current State

**v1.4 Domain-Aware Planning — shipped 2026-05-13**

Domain router, AGENT-SPEC, documentation agent, verification harness, and milestone-partitioned layout all shipped. Planning directory migrated to `.planning/v1.4/phases/`. v1.5 Capability Port in progress — Phases 1 (Security Hooks), 2 (Autonomous Technical Resolution), 3 (Execution-Detail Enrichment), 4 (Agent Observability Telemetry), and 5 (Plan-Loop Convergence and Verify Fix) complete. Phase 4 added a `PostToolUse`/`PostToolUseFailure` (`matcher: Task|Agent`) telemetry hook that records every `gsd-*` subagent spawn — timestamp, agent type, scraped confidence verdict — to a gitignored `.planning/telemetry/agent-trace.jsonl`, plus a `gsd-tools trace` reader, all in code/config with zero prompt-file changes. Phase 5 made the plan-phase revision loop convergence-aware (a non-decreasing BLOCKER+WARNING trajectory across all 3 iterations now emits a `## STALL DETECTED` block and escalates rather than silently completing) and fixed the v1.4-carryover `parseMustHavesBlock` indent bug (dynamic child-indent detection so `verify artifacts`/`verify key-links` parse real 2-space plans). Phase 6 (Skill Self-Sufficiency) audited all 14 superpowers skills (`06-AUDIT.md`) and ported the 4 genuine gaps as native references/edits: execution-time TDD discipline (Iron Law + watch-it-fail + agent-edit exemption in `tdd.md`/`gsd-executor`/`gsd-planner`), `receiving-code-review.md` (wired into `review.md`/`ship.md`), `artifact-authoring.md`, and `git-worktree.md` (technique only — Phase 7 wires the orchestration). All automated checks + 912 unit tests pass; **the end-to-end behavioral proof (SC3) is deferred to a real prod plan→execute run — see `cross-phase-notes.md` Phase 6 "PENDING MANUAL VERIFICATION" and `06-HUMAN-UAT.md`; clear it with `/gsd2:verify-work 6`.** Phase 7 (Parallel Multi-Session Safety) wired the worktree orchestration + the axis-A/axis-B parallel-safety gate. Phase 8 (Validated Example Corpus) shipped a pattern-indexed corpus of validated, human-maintained code excerpts under `get-shit-done/references/validated-examples/` — 6 seed entries (3 Python: requests/pydantic/CPython, 3 Node-TS: undici/zod/fastify-env-schema), each a short attributed excerpt + commentary, indexed by a slim `INDEX.md` the planner reads on-demand via `agents/gsd-planner.md`'s `<code_quality_reference>` pointer. Each entry's `counters:` front matter maps to exact `common-bug-patterns.md` section headers, structuring the corpus as the Phase 9 eval/reference substrate. Next: Phase 9 (SkillOpt-Style Self-Improving Skills) — consumes the Phase 8 corpus.

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
- Agent observability telemetry (`PostToolUse`/`PostToolUseFailure` hook → JSONL spawn log with scraped confidence + `gsd-tools trace` reader, zero prompt changes) — shipped v1.5 Phase 4 (OBS-01, OBS-02)
- Convergence-aware plan revision loop — stall detection (non-decreasing BLOCKER+WARNING trajectory over 3 cycles emits STALL DETECTED + escalates) — shipped v1.5 Phase 5 (CONV-01)
- `parseMustHavesBlock` N-space indent fix — `verify artifacts`/`verify key-links` now parse real 2-space plans instead of returning "no blocks found" — shipped v1.5 Phase 5 (FIX-01)

### Active

_(milestone v1.5 Capability Port — see `.planning/REQUIREMENTS.md` for full REQ-IDs)_

- Security guard hooks ported, namespaced (`gsd2:`), and config-gated (SEC)
- Autonomous technical-resolution loop wired into discuss/plan — reduces human round-trips (RSCH)
- Anti-pattern/bug-pattern reference docs incl. Python (GUIDE)
- Context-budget degradation tiers + utilization classifier (CTX)

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
| Loops over agent proliferation | Bottleneck is human-loop time, not model capability; many special-case agents add wiring cost without raising autonomy (the week lost wiring 5–10 agents for simple CV text is the anti-pattern) | Reshaped Phase 2 (RSCH) from "general research agent" → "autonomous technical-resolution loop" — 2026-06-04 |
| Minimize the human round-trip | Reserve human input for taste/preference/intent; resolve everything model-answerable autonomously | Adopted as Core Value operating principle — 2026-06-04 |

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
*Last updated: 2026-06-08 — Phase 8 (Validated Example Corpus) complete: pattern-indexed corpus of 6 validated real-world code excerpts (Python + Node/TS) under `get-shit-done/references/validated-examples/`, wired into the planner on-demand and structured (via `counters:` → `common-bug-patterns.md` headers) as the Phase 9 eval substrate; all automated checks + 942 unit tests pass*

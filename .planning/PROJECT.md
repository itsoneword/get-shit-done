# GSD (Get Shit Done)

## What This Is

A framework that shifts AI-assisted development from "write code, fix bugs" to "plan deeply, execute cleanly." GSD orchestrates Claude Code (and other AI CLIs) through structured workflows: discuss, plan, execute, verify. It manages planning artifacts, phase tracking, parallel agent execution, and state persistence across sessions.

## Core Value

Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Operating principle — minimize the human round-trip.** The bottleneck in AI-assisted development is no longer the model; it is the human in the loop. Every time Claude Code stops to ask a question or hand back output, a fast system waits on a slow human — and most of those questions the model could have answered itself. GSD's job is twofold: keep the human oriented with *just-enough* context (no human holds 10 objectives × 10 plans × 10 details), and reserve human input for judgment only a human can supply — taste, preference, intent ("do you want it to work this way?"), never "which technical approach." Everything the model can resolve — technical choices, research, documentation — it should resolve autonomously. Bias toward **loops and skills that raise model autonomy over proliferating special-case agents.**

## Current Milestone: v1.6 Autonomous Supervision Harness

**Goal:** Delegate the human's job of monitoring 5–10 parallel GSD sessions to an agentic supervision loop with a predictable, auditable escalation mechanism — the human reviews one inbox of logged decisions and parked questions instead of babysitting tabs.

**Guiding principle:** The harness *proposes, never disposes*. Every autonomous decision is logged and verifiable after the fact; only decisions matching written escalation criteria leak to the human. Trust ladder: validate on a single phase (read the ledger, score escalation precision) before widening to overnight multi-phase runs.

**Target features:**
- Decision ledger — `DECISIONS.jsonl` per run: every autonomous choice with alternatives, evidence, and `escalated` flag; wired into `discuss-phase --auto` first
- Escalation contract — evaluator verdict schema (proceed / proceed-and-log / park-and-ask) with written criteria: irreversibility, security, scope change, spec ambiguity
- Park-don't-block — escalated questions land in a run mailbox; the blocked branch parks while the runner continues other work; human answers via one inbox review command; run resumes
- Overnight runner — wraps `/gsd2:autonomous` with ledger + escalation + worktree-isolated execution per phase
- Artifact-anchored discussion loop — multi-lens (skeptic / user-advocate / architect) judging of concrete artifacts with a convergence brake, for project-level open questions
- Todo/backlog triage worker — verdicts (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer) emitted as proposals into the same mailbox

## Current State

**v1.6 Phase 10 (Decision Ledger + CLI Foundation) complete — 2026-06-11.** The shared persistence layer for the supervision harness shipped: `lib/ledger.cjs` (append-only `DECISIONS.jsonl`, write-time validation of decision/alternatives/evidence/confidence/escalated, GSD_RUN_ID run-context gate so interactive sessions never write), `lib/mailbox.cjs` (`MAILBOX.jsonl` append/list with q-NNN ids, same gate), and `gsd-tools run init` enforcing the `.planning/run/<run-id>/` layout (gitignored). CLI: `ledger append/list/filter --phase/--escalated`, `mailbox append/list --status`. 24 new unit tests; 983 total pass. Verification: 10/10 must-haves. Next: Phase 11 (escalation contract + discuss-phase wiring).

**v1.4 Domain-Aware Planning — shipped 2026-05-13**

Domain router, AGENT-SPEC, documentation agent, verification harness, and milestone-partitioned layout all shipped. Planning directory migrated to `.planning/v1.4/phases/`. v1.5 Capability Port in progress — Phases 1 (Security Hooks), 2 (Autonomous Technical Resolution), 3 (Execution-Detail Enrichment), 4 (Agent Observability Telemetry), and 5 (Plan-Loop Convergence and Verify Fix) complete. Phase 4 added a `PostToolUse`/`PostToolUseFailure` (`matcher: Task|Agent`) telemetry hook that records every `gsd-*` subagent spawn — timestamp, agent type, scraped confidence verdict — to a gitignored `.planning/telemetry/agent-trace.jsonl`, plus a `gsd-tools trace` reader, all in code/config with zero prompt-file changes. Phase 5 made the plan-phase revision loop convergence-aware (a non-decreasing BLOCKER+WARNING trajectory across all 3 iterations now emits a `## STALL DETECTED` block and escalates rather than silently completing) and fixed the v1.4-carryover `parseMustHavesBlock` indent bug (dynamic child-indent detection so `verify artifacts`/`verify key-links` parse real 2-space plans). Phase 6 (Skill Self-Sufficiency) audited all 14 superpowers skills (`06-AUDIT.md`) and ported the 4 genuine gaps as native references/edits: execution-time TDD discipline (Iron Law + watch-it-fail + agent-edit exemption in `tdd.md`/`gsd-executor`/`gsd-planner`), `receiving-code-review.md` (wired into `review.md`/`ship.md`), `artifact-authoring.md`, and `git-worktree.md` (technique only — Phase 7 wires the orchestration). All automated checks + 912 unit tests pass; **the end-to-end behavioral proof (SC3) is deferred to a real prod plan→execute run — see `cross-phase-notes.md` Phase 6 "PENDING MANUAL VERIFICATION" and `06-HUMAN-UAT.md`; clear it with `/gsd2:verify-work 6`.** Phase 7 (Parallel Multi-Session Safety) wired the worktree orchestration + the axis-A/axis-B parallel-safety gate. Phase 8 (Validated Example Corpus) shipped a pattern-indexed corpus of validated, human-maintained code excerpts under `get-shit-done/references/validated-examples/` — 6 seed entries (3 Python: requests/pydantic/CPython, 3 Node-TS: undici/zod/fastify-env-schema), each a short attributed excerpt + commentary, indexed by a slim `INDEX.md` the planner reads on-demand via `agents/gsd-planner.md`'s `<code_quality_reference>` pointer. Each entry's `counters:` front matter maps to exact `common-bug-patterns.md` section headers, structuring the corpus as the Phase 9 eval/reference substrate. Phase 9 (Self-Improving Skills, feedback-driven) shipped the online skill-evolution loop: a `.planning/lessons/` JSONL ledger + `gsd-tools lesson` CLI (append/list/update/bump-recurrence/attribute/scan — attribution a unit-tested pure function, scan nominate-only), plus a `/gsd2:teach` command + `workflows/teach.md` running observe→attribute→advisor-critic bounded edit (≤20 lines/one section)→[y/N] ratify→source-only commit + separate ledger commit→`npm run dev`. The apply commit is source-only (zero `.claude/`) so the `git revert` undo stays conflict-free; mechanical guarantees (no-auto-apply, source-only, reversibility) were dogfooded on the gsd repo itself this session, which surfaced and fixed a real two-commit-ordering bug. **v1.5 Capability Port complete — all 9 phases shipped.** SC2/SC3/TEACH-05 carry a `09-HUMAN-UAT.md` for independent interactive verification in a real project (`/gsd2:verify-work 9`).

## Last Completed Milestone: v1.5 Capability Port

**Goal:** Close the fork's execution-detail gap by selectively porting proven capabilities from `gsd-core` — adopted by understanding, not copied wholesale.

**Shipped (v1.5.0/v1.5.1, 9 phases, 27 plans):** security guard hooks, autonomous technical-resolution loop, anti-pattern/bug-pattern references, agent observability telemetry, plan-loop stall detection, skill self-sufficiency (superpowers gaps ported), parallel multi-session safety (worktrees + safety gate), validated example corpus, self-improving skills (`/gsd2:teach`).

**Note:** Archival via `/gsd2:complete-milestone` still pending; human UAT open for phases 02/06/09.

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
- Security guard hooks, gsd2-namespaced + config-gated — shipped v1.5 Phase 1 (SEC)
- Autonomous technical-resolution loop in discuss/plan — shipped v1.5 Phase 2 (RSCH)
- Anti-pattern/bug-pattern reference docs incl. Python — shipped v1.5 Phase 3 (GUIDE)
- Skill self-sufficiency, parallel multi-session safety (worktrees + axis-A/B gate), validated example corpus, self-improving skills (`/gsd2:teach`) — shipped v1.5 Phases 6–9

### Active

_(milestone v1.6 Autonomous Supervision Harness — see `.planning/REQUIREMENTS.md` for full REQ-IDs)_

- Decision ledger: every autonomous choice logged with alternatives, evidence, escalated flag (LEDGER)
- Escalation contract: evaluator verdict schema with written park-and-ask criteria (ESC)
- Park-don't-block question mailbox + single inbox review command (PARK)
- Overnight runner wrapping /gsd2:autonomous with worktree isolation (RUN)
- Artifact-anchored multi-lens discussion loop with convergence brake (LOOP)
- Todo/backlog triage worker emitting proposals, never disposing (TRIAGE)

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
- **Orchestration level (v1.6)**: GSD subagents lack Skill/Agent tool grants — the supervisor/runner must execute at orchestrator level (top-level session or headless run), never as a spawned subagent
- **Working tree (v1.6)**: Parallel sessions share one working tree — background *execution* requires worktree isolation per phase (v1.5 Phase 7 machinery); background *planning* writes only `.planning/` and is safe
- **Trust (v1.6)**: The harness proposes, never disposes — no silent discards; every autonomous decision must be auditable from the ledger alone, without replaying transcripts

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
*Last updated: 2026-06-11 — v1.6 Phase 10 complete: decision ledger + mailbox persistence layer (`lib/ledger.cjs`, `lib/mailbox.cjs`, `run init`, ledger/mailbox CLI subcommands; 983 tests pass). Milestone v1.6 Autonomous Supervision Harness started 2026-06-10 (decision ledger, escalation contract, park-don't-block mailbox, overnight runner, discussion loop, triage worker). Previous note (v1.5 Phase 9): `.planning/lessons/` JSONL ledger + `gsd-tools lesson` CLI + `/gsd2:teach` online skill-evolution loop (attribute → advisor-critic bounded edit → [y/N] ratify → source-only commit + separate ledger commit → npm run dev); dogfooded on the gsd repo (found+fixed a two-commit-ordering bug that broke git-revert undo); 959 unit tests pass. v1.5 Capability Port complete — all 9 phases shipped.*

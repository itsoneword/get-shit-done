# Roadmap: GSD v1.5 Capability Port

## Overview

v1.5 closes the fork's execution-detail gap by selectively porting four capability clusters from gsd-core. Phase 1 delivers standalone security guard hooks — the highest-confidence, lowest-effort addition. Phase 2 builds an autonomous technical-resolution loop (research → self-critique → decide) wired into discuss/plan, so technical unknowns resolve without bouncing back to the human. Phase 3 enriches execution with anti-pattern references and context-budget tooling. Phase 4 adds stall-detection to the plan revision loop and fixes the parseMustHavesBlock regression. Every port goes through the normal discuss → plan → execute → verify loop — adopted by understanding, not copied wholesale.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Security Hooks** - Port 3 standalone advisory guard hooks into hooks/ under gsd2-* naming, config-gated, no build dependency (worktree-path-guard descoped — see CONTEXT)
- [x] **Phase 2: Autonomous Technical Resolution** - Resolve technical/domain unknowns via a research→self-critique confidence loop wired into discuss/plan, so they stop bouncing to the human — loops over new agents (RESHAPED 2026-06-04) (completed 2026-06-04)
- [ ] **Phase 3: Execution-Detail Enrichment** - Anti-pattern/bug-pattern reference docs (incl. Python), hybrid-loaded into planner/verifier — context-budget tiers + utilization classifier reshaped out → doctor phase (RESHAPED 2026-06-04)
- [ ] **Phase 4: Plan-Loop Convergence and Verify Fix** - Stall-detection in the plan revision loop plus parseMustHavesBlock 2-space-indent fix

## Phase Details

### Phase 1: Security Hooks
**Goal**: Users running GSD on agentic pipelines have a defense-in-depth hook layer that guards against prompt injection and out-of-worktree edits — config-gated, namespace-clean, with no TypeScript or core-lib dependency
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04 (worktree-path-guard descoped to SEC-DEFER-01 per Phase 1 discussion)
**Discussion focus**: RESOLVED in 01-CONTEXT.md — 3 advisory hooks (prompt-guard + read-injection-scanner default-on, read-guard opt-in); blanket `gsd2-*` rename incl. existing 4 hooks; config gating via `.planning/config.json` `hooks.*` keys mirroring `hooks.workflow_guard`; worktree-path-guard + validate-commit deferred
**Success Criteria** (what must be TRUE):
  1. Running `npm run build:hooks` produces the 3 new `gsd2-*` guard hooks in hooks/dist/ alongside the renamed existing hooks — no build errors
  2. Running `gsd2 --claude --local` (or equivalent install) registers the new hooks in .claude/settings.json under `gsd2-*` filenames and removes stale `gsd-*` registrations
  3. Each new hook is independently enable/disable-able via a config.json key; the default posture (on vs opt-in) is documented per hook
  4. The hooks run from pure standalone JS — no import of a TypeScript-compiled lib or any new runtime dependency
**Plans**: 2 (01 rename to gsd2-*, 02 port 3 new advisory hooks + gating)

### Phase 2: Autonomous Technical Resolution
**Goal**: Technical and domain unknowns are resolved by the model autonomously — researched, self-critiqued to a confidence threshold, and decided — so they stop bouncing back to the human. The human is reserved for genuine preference/taste ("do you want it to work this way?"), never "which technical approach." Wired into the GSD decision points that currently defer to the human.
**Depends on**: Nothing (sequenced after Phase 1 by confidence; no technical dependency)
**Requirements**: RSCH-01, RSCH-02, RSCH-03
**Discussion focus**: RESOLVED in 02-CONTEXT.md — reshaped 2026-06-04 from "port a general research agent" to "autonomous technical-resolution loop" per the minimize-human-round-trips north-star. Key decisions: loops/skills over a new specialized agent; reuse `deep-research` (already does fan-out + adversarial-verify) rather than rebuild; close plan-phase's missing inline research path; tighten discuss-phase `question_triage` so LOW-confidence technical questions resolve via the loop instead of defaulting to the human.
**Success Criteria** (what must be TRUE):
  1. A reusable technical-resolution loop (research → self-critique → confidence verdict) exists, composed from existing capability — no new specialized agent. It raises LOW→HIGH confidence without human input where evidence allows.
  2. A technical/HYBRID question arising in plan-phase is resolved inline (a path that does not exist today); discuss-phase's LOW-confidence fallback no longer defaults to asking the human when evidence can resolve it. A technical question reaches the human only when confidence stays LOW after the loop exhausts, or it is genuine preference.
  3. The loop honors signal strength — skips `[STRONG]`/`[STRONG, user-override]` decisions — and records resolved technical decisions with confidence + source so they aren't re-asked downstream.
**Plans**: 3 (01 loop contract + Wave 0 test, 02 discuss-phase LOW-branch wiring, 03 plan-phase orchestrator loop + gsd-planner surfacing)

### Phase 3: Execution-Detail Enrichment
**Goal**: Planners and verifiers have codified reference docs for what good and bad code looks like (incl. Python), so plans and verifications draw on a shared "good/bad code" standard rather than improvising
**Depends on**: Nothing (sequenced after Phase 2; no technical dependency)
**Requirements**: GUIDE-01, GUIDE-02
**Reshaped-out requirements**: CTX-01, CTX-02 → doctor phase (see Discussion focus + REQUIREMENTS.md)
**Discussion focus**: RESOLVED in 03-CONTEXT.md — reshaped 2026-06-04. Docs land in `references/` (established convention). Loading is **hybrid**: verifier eager-loads (`@`) the bug-pattern doc (bad code matters most at verify time); planner references the anti-pattern doc on-demand ("Read when relevant", like `tdd.md`) to keep context lean. Python content covers idioms, anti-patterns, typing conventions. The entire context-budget cluster (CTX-01 tiers, CTX-02 classifier) was reshaped OUT: the user rejected a human-facing context warning ("only need to fix it"); the keep-context-tiny goal is met structurally (partitioning/distillation), and the forward-looking piece — an agent-assisted **doctor** that detects documented-then-overwritten decisions and archives superseded ones — becomes its own phase (see `.planning/cross-phase-notes.md`).
**Success Criteria** (what must be TRUE):
  1. Anti-pattern and bug-pattern reference docs exist in references/ and are loaded per the hybrid scheme — bug-pattern doc eager-loaded by the verifier, anti-pattern doc referenced on-demand by the planner
  2. The reference docs include Python-specific content (at minimum: Python anti-patterns, common bug patterns, and typing/idiom conventions) alongside the language-agnostic material
**Plans**: 2 (01 common-bug-patterns.md + verifier eager-load; 02 universal-anti-patterns.md [folds planner-antipatterns] + planner on-demand pointer) — both Wave 1, parallel (no shared files)

### Phase 4: Agent Observability & Telemetry
**Goal**: GSD emits a structured, code-level telemetry log of agent activity — every subagent spawn (who/when/spawning-context) and its returned confidence verdict — so loop and feature behavior is verifiable by inspecting a record rather than eyeballing a transcript. Addresses the structural problem that each new prose-based feature gets harder to dogfood-test.
**Depends on**: Nothing technically; sequenced BEFORE Phase 5 so convergence/stall-detection can consume the telemetry signal.
**Requirements**: OBS-01, OBS-02
**Discussion focus** (captured 2026-06-04 — not yet planned): Mechanism = Claude Code **hooks**, reusing the Phase 1 hook infrastructure (`scripts/build-hooks.js`, `hooks/` + `hooks/dist/`, `.claude/settings.json` already wires `PostToolUse`). A new `PostToolUse` hook scoped `"matcher": "Task"` (e.g. `hooks/gsd2-agent-trace.js`, modeled on the existing `gsd2-context-monitor.js`) fires on every subagent spawn and appends JSONL — `{ts, event:"agent.spawn", type, desc, ctx}` and `{ts, event:"agent.return", type, confidence}`. **Observability lives in code/config, NOT in prompts** (explicit user requirement): the confidence value is scraped by the hook from the agent's *return text* (the Phase 2 resolution loop already emits `Confidence: HIGH/MEDIUM/LOW`), so no workflow/agent prose changes are needed. Open scoping for discuss-phase: log location (extend the v1.4 `.planning/debug/` convention vs a dedicated `.planning/telemetry/*.jsonl`), an optional `gsd-tools trace` reader/pretty-printer, retention/rotation. Design caveat: hooks fire in Claude Code (interactive + headless-if-configured) but not in Copilot/Gemini runtimes — telemetry must be best-effort and never block a run. Immediate payoff: makes Phase 2's autonomous-resolution dogfood items (and every future phase's behavior) grep-checkable instead of transcript-watched.
**Success Criteria** (what must be TRUE):
  1. A code-level hook records every `gsd-*` subagent spawn to a structured log (timestamp, agent type, spawning context) with zero changes to workflow/agent prompt files
  2. The log captures the confidence verdict of resolution/verifier agent returns, so a confidence-driven re-research (LOW → second spawn) is visible as distinct, timestamped, correlated entries
  3. Telemetry is best-effort and non-blocking — a hook failure never interrupts the agent run, and it degrades cleanly in runtimes without hook support
**Plans**: TBD

### Phase 5: Plan-Loop Convergence and Verify Fix
**Goal**: The plan revision loop detects when it has stalled (BLOCKER+WARNING counts stop decreasing) and escalates rather than silently cycling; and verify artifacts / verify key-links work correctly on all current plans (2-space-indent fix)
**Depends on**: Nothing (sequenced after Phase 3; FIX-01 is a self-contained bug fix; CONV-01 touches plan-phase revision loop only)
**Requirements**: CONV-01, FIX-01
**Discussion focus**: Stall-detection threshold (how many cycles of non-decreasing issue counts before escalation); escalation UX (hard stop vs soft prompt vs checkpoint); whether stall state is written to a file (like ceiling-reached CHECKPOINT) or inline; parseMustHavesBlock fix scope (2-space indent only, or generalize to N-space)
**Success Criteria** (what must be TRUE):
  1. When the plan revision loop runs max_iterations without the BLOCKER+WARNING count decreasing, it emits a STALL DETECTED block and escalates to the user rather than silently completing
  2. Running `gsd-tools verify artifacts <plan-path>` on a plan with 2-space-indented must_haves block returns the correct artifact list (not "no blocks found")
  3. Running `gsd-tools verify key-links <plan-path>` on a plan with 2-space-indented must_haves block returns the correct key-links (not "no blocks found")
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hooks | 0/2 | Planned | - |
| 2. Autonomous Technical Resolution | 3/3 | Complete   | 2026-06-04 |
| 3. Execution-Detail Enrichment | 0/2 | Planned | - |
| 4. Agent Observability & Telemetry | 0/TBD | Not started | - |
| 5. Plan-Loop Convergence and Verify Fix | 0/TBD | Not started | - |

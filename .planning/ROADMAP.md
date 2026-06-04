# Roadmap: GSD v1.5 Capability Port

## Overview

v1.5 closes the fork's execution-detail gap by selectively porting four capability clusters from gsd-core. Phase 1 delivers standalone security guard hooks — the highest-confidence, lowest-effort addition. Phase 2 builds an autonomous technical-resolution loop (research → self-critique → decide) wired into discuss/plan, so technical unknowns resolve without bouncing back to the human. Phase 3 enriches execution with anti-pattern references and context-budget tooling. Phase 4 adds stall-detection to the plan revision loop and fixes the parseMustHavesBlock regression. Every port goes through the normal discuss → plan → execute → verify loop — adopted by understanding, not copied wholesale.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Security Hooks** - Port 3 standalone advisory guard hooks into hooks/ under gsd2-* naming, config-gated, no build dependency (worktree-path-guard descoped — see CONTEXT)
- [ ] **Phase 2: Autonomous Technical Resolution** - Resolve technical/domain unknowns via a research→self-critique confidence loop wired into discuss/plan, so they stop bouncing to the human — loops over new agents (RESHAPED 2026-06-04)
- [ ] **Phase 3: Execution-Detail Enrichment** - Anti-pattern/bug-pattern references (incl. Python), context-budget tiers, and gsd-health utilization classifier
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
**Goal**: Planners and verifiers have codified reference docs for what good and bad code looks like (incl. Python), plus formal context-window degradation tiers and a gsd-health utilization classifier that surfaces context pressure before it causes silent quality degradation
**Depends on**: Nothing (sequenced after Phase 2; no technical dependency)
**Requirements**: GUIDE-01, GUIDE-02, CTX-01, CTX-02
**Discussion focus**: Reference doc placement (references/ vs agents/ vs inline in planner prompt); whether anti-pattern/bug-pattern docs are read automatically or on-demand; Python content scope (idioms, anti-patterns, typing conventions); context-budget tier thresholds (healthy/warning/critical percentages); gsd-health integration point (new subcommand or extension of existing --context flag)
**Success Criteria** (what must be TRUE):
  1. Anti-pattern and bug-pattern reference docs exist in references/ and are explicitly loaded by the planner and/or verifier during their respective phases
  2. The reference docs include Python-specific content (at minimum: Python anti-patterns and common bug patterns) alongside the language-agnostic material
  3. Context-window degradation tiers (healthy / warning / critical) are codified in a reference doc with read-depth rules keyed to context_window percentage
  4. Running gsd-health (or gsd-health --context) classifies current context utilization as healthy / warning / critical and displays the result
**Plans**: TBD

### Phase 4: Plan-Loop Convergence and Verify Fix
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

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hooks | 0/2 | Planned | - |
| 2. Autonomous Technical Resolution | 0/3 | Planned | - |
| 3. Execution-Detail Enrichment | 0/TBD | Not started | - |
| 4. Plan-Loop Convergence and Verify Fix | 0/TBD | Not started | - |

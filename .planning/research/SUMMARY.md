# Project Research Summary

**Project:** GSD v1.6 Autonomous Supervision Harness
**Domain:** Agentic dev workflow supervision — decision ledger, escalation contract, async mailbox, overnight runner, multi-lens discussion, backlog triage
**Researched:** 2026-06-10
**Confidence:** HIGH

## Executive Summary

GSD v1.6 adds a supervision harness to an existing HITL agentic framework. The pattern being built — write an explicit escalation policy, log every autonomous decision with alternatives and evidence, park questions non-blockingly, and continue other branches — does not exist in a comparable form in Devin, OpenHands, LangGraph, or AutoGen. All four systems escalate by blocking; none have a written, human-readable escalation policy as a first-class artifact. GSD's differentiator is that the harness is auditable from the ledger alone, without replaying transcripts. This is the load-bearing requirement that drives every architecture decision.

The recommended approach is zero new npm dependencies. All primitives are already present: `claude -p --output-format json` for headless invocations, `appendFileSync` + JSONL for ledgers (three already in production), `child_process.spawnSync` for evaluator calls, and system cron for overnight scheduling. The six new components (decision ledger, escalation evaluator, park-don't-block mailbox, overnight runner, multi-lens discussion loop, backlog triage worker) each map to an existing pattern in `gsd-tools.cjs`. No component requires a new dependency or a new agent type; all supervision logic runs at orchestrator level.

The primary risks are calibration-related, not implementation-related. Escalation criteria written as prose drift across LLM runs; without a discrete criterion schema with explicit thresholds, the human inbox fills with trivia while critical decisions pass silently. Discussion loops without content-delta convergence tests produce averaged documents that look resolved but aren't. These two failures erode trust in the harness faster than any technical bug. The mitigation is: build the ledger first, run it interactively on one phase, read every verdict, calibrate before wiring the overnight runner.

---

## Key Findings

### Recommended Stack

GSD is and stays dependency-free Node.js CJS. The entire supervision harness builds on three existing patterns: (1) `appendFileSync` JSONL ledgers (`lesson.cjs`, `trace.cjs`, `agent-trace.js` as templates); (2) `claude -p --output-format json` for headless verdicts (`spawnSync` from within `gsd-tools.cjs`); (3) detached `spawn` + `unref()` for fire-and-forget overnight runs (same pattern as `gsd2-check-update.js`). System cron handles scheduling — no node-cron daemon needed.

**Core technologies:**
- `node:fs` `appendFileSync` / `readFileSync`: append-only JSONL for `DECISIONS.jsonl`, `MAILBOX.jsonl` — exact pattern from `lesson.cjs`
- `claude -p --output-format json` via `spawnSync`: headless evaluator verdicts; fields `result`, `is_error`, `total_cost_usd` confirmed in v2.1.172
- `claude -p --permission-mode bypassPermissions`: unattended overnight runner; confirmed flag in installed binary
- System `crontab` at `/usr/bin/crontab`: overnight scheduling; active cron already on this machine
- `Stop` hook + `PostToolUse (Task|Agent)` matcher: run finalization and per-decision capture; both confirmed in binary string table
- `claude agents --json`: active session enumeration for mutex detection before spawning a new overnight run

### Expected Features

**Must have (table stakes — core trust ladder):**
- Decision ledger with `alternatives_considered`, `evidence`, `confidence` fields enforced at write time — without these fields, the ledger is unauditable
- Written escalation contract as a readable artifact (four criteria: irreversibility, security boundary, scope change, spec ambiguity)
- Park-don't-block mailbox with per-phase resume context snapshot — the key behavioral differentiator from every comparable system

**Should have (full overnight value):**
- Overnight runner wrapping `/gsd2:autonomous` with ledger + escalation + worktree isolation
- Artifact-anchored multi-lens discussion loop (Skeptic / User-Advocate / Architect judging a concrete CONTEXT.md section, not abstract positions)
- Six-verdict backlog triage worker (propose-only, never disposes directly)

**Defer (v2+):**
- Escalation precision scoring command (requires meaningful ledger data first)
- Cross-session ledger aggregation
- Real-time Slack/email notifications (external service dependency; `tail -f` on MAILBOX suffices)

### Architecture Approach

All six components are orchestrator-level or CLI-level. Nothing runs as a spawned subagent — the hard constraint from v1.5 Phase 2 is that subagents lack `Skill` and `Agent` tool grants. The evaluator is an inline prose reasoning block. The discussion loop personas are inline role switches. The overnight runner is a workflow file loaded at top-level. New persistence lives at `.planning/run/{run-id}/` (isolated per run to prevent parallel-run corruption).

**Major components:**
1. `lib/ledger.cjs` + `lib/mailbox.cjs` — new gsd-tools lib modules, mirrors `lesson.cjs`; foundation everything else calls
2. Escalation evaluator — inline step added to `discuss-phase.md` `question_triage`; guarded by `harness.run_id` config check so interactive sessions are unaffected
3. `workflows/overnight.md` — orchestrator workflow wrapping `Skill(autonomous)` with run init/teardown
4. `workflows/discuss-loop.md` — artifact-anchored multi-lens review; convergence brake fires on content delta, not iteration count
5. `workflows/triage.md` — reads pending todos, writes verdict proposals to mailbox; Write access scoped to mailbox only
6. Resume logic in `autonomous.md` — parked-phase restart after human answers mailbox question; built last

### Critical Pitfalls

1. **Escalation miscalibration (over- and under-escalate simultaneously)** — write criteria as a discrete verb list, not prose; calibrate against 10-decision golden set before first overnight run; three-tier verdict schema forces a lane
2. **Discussion loop convergence on averaged non-decisions** — convergence brake must test content delta (same downstream constraints?), not sentence similarity; when max rounds hit without convergence, escalate top-2 divergent positions to mailbox, not a synthesized average
3. **Overnight token burn on stuck loops** — identical-ledger-hash across two consecutive phase snapshots is a stuck signal; per-phase token ceiling at runner level; preserve existing `handle_blocker` 1-retry limit in `autonomous.md`
4. **Parked branch resume corruption** — resume path must re-read `cross-phase-notes.md`, `STATE.md`, `ROADMAP.md` before replaying parked questions; park artifact captures context snapshot for staleness detection
5. **Headless permission and auth failures** — startup health check before first phase work; `run.log` records runner operational status even on failure; auth errors must fail loudly, not retry silently

---

## Implications for Roadmap

The dependency chain LEDGER → ESC → PARK → RUN, with LOOP and TRIAGE independent after ESC, is confirmed by both FEATURES.md and ARCHITECTURE.md. PITFALLS.md adds a structural sequencing requirement: interactive single-phase validation + human ledger review before multi-phase overnight runs. This trust-ladder checkpoint is the single highest-leverage action in the roadmap.

### Phase 1: Decision Ledger + CLI Foundation
**Rationale:** Every other component calls `ledger append` and `mailbox park`. This phase has zero external unknowns — it is a direct copy of `lesson.cjs` patterns. Placing the writer at CLI level (not as a spawned subagent) addresses PITFALLS.md Pitfall 5 structurally.
**Delivers:** `lib/ledger.cjs`, `lib/mailbox.cjs`, `gsd-tools ledger` and `mailbox` subcommands, `.planning/run/{run-id}/` directory layout, schema enforcement at write time
**Addresses:** Decision logging (table stakes), audit trail foundation
**Avoids:** Pitfall 5 (tool-grant confusion), Pitfall 6 (unverifiable decisions)
**Research flag:** Standard patterns — no research-phase needed

### Phase 2: Escalation Contract + discuss-phase Wiring
**Rationale:** The evaluator must exist and be calibrated before PARK or RUN can make meaningful decisions. Guarded by `harness.run_id` so interactive behavior is unchanged. The golden-set calibration step and human ledger review are the acceptance criteria.
**Delivers:** Written escalation contract (four criteria, discrete schema), inline evaluator in `question_triage`, interactive single-phase ledger population, golden-set calibration
**Trust ladder checkpoint:** Human reads full ledger after one interactive phase run and scores escalation precision. This gates Phase 3.
**Avoids:** Pitfall 1 (miscalibration)
**Research flag:** Standard patterns — no research-phase needed

### Phase 3: Park-Don't-Block Mailbox + Branch Parking
**Rationale:** PARK is the behavioral differentiator — every comparable system blocks. It is also the most complex of Phases 1-3 because it requires per-phase state machine, resume context snapshot, and runner-level stuck detection.
**Delivers:** `MAILBOX.jsonl` write/read, `parked/phase-{N}.json` context snapshot, runner-level stuck detection (identical-ledger-hash), `gsd-tools mailbox review` interactive command
**Avoids:** Pitfall 3 (token burn — stuck detection), Pitfall 4 (resume corruption — context snapshot with staleness diff)
**Research flag:** Implementation correctness concern, not unknown territory — no research-phase needed, but resume path needs explicit test against a simulated stale-context case

### Phase 4: Overnight Runner
**Rationale:** With LEDGER + ESC + PARK calibrated, the overnight runner is mostly wiring. The complex pieces already work. PITFALLS.md Pitfall 8 requires a Wave-0 investigation before scheduling is built.
**Delivers:** `workflows/overnight.md`, `/gsd2:overnight` command, `gsd-overnight.sh` + crontab entry, `run.log` health log, startup health check, `RUN-META.json`, worktree merge-conflict routing to mailbox
**Avoids:** Pitfall 8 (auth failures), Pitfall 7 (worktree merge conflicts)
**Research flag:** Wave-0 required — empirically test headless session lifespan and `--permission-mode bypassPermissions` behavior before building scheduling logic; undocumented behavior surface

### Phase 5: Multi-Lens Discussion Loop
**Rationale:** Independent of PARK and RUN; can be validated against a single existing CONTEXT.md. Shares escalation contract for convergence-failure escalation. The convergence brake is the load-bearing acceptance criterion.
**Delivers:** `workflows/discuss-loop.md`, `/gsd2:discuss-loop` command, three-lens artifact judgment, content-delta convergence brake (3-round max, early exit), escalation of unresolved positions to mailbox
**Avoids:** Pitfall 2 (deliberation drift — content-delta convergence, hard cap, divergent positions not averaged)
**Research flag:** Well-scoped — no research-phase needed

### Phase 6: Resume Logic + Backlog Triage Worker
**Rationale:** Resume logic depends on Phases 1-4 all being stable — it is the most complex component. Triage is the most independent and lowest urgency. Both are delivered last to build on stable foundations.
**Delivers:** Resume path in `autonomous.md` (re-read current planning context, replay blocked step), `workflows/triage.md`, `/gsd2:triage` command, six-verdict triage, batch mailbox proposals
**Avoids:** Pitfall 4 (resume corruption — re-reads current state before replay), Pitfall 9 (triage disposing — Write access to mailbox only)
**Research flag:** Triage is standard patterns; resume path needs explicit staleness test

### Phase Ordering Rationale

- CLI foundation before workflows: every workflow calls `gsd-tools`; having the CLI unit-testable before workflow integration cuts the debugging surface area significantly
- Evaluator before runner: wiring an uncalibrated evaluator into overnight runs amplifies noise across all phases simultaneously; the trust-ladder checkpoint after Phase 2 is the structural gate
- LOOP and TRIAGE are independent after ESC: both share the mailbox as output but have no other coupling; building them after the core harness is validated reduces risk
- Resume logic last: requires all other pieces to be stable; it is the highest-complexity component and the one most sensitive to planning-state drift

### Research Flags

**Needs Wave-0 investigation:**
- Phase 4 (Overnight Runner): headless session lifespan and `--permission-mode bypassPermissions` behavior are undocumented; must be empirically tested before scheduling logic is built

**Standard patterns (skip research-phase):**
- Phase 1 (Decision Ledger + CLI): direct copy of `lesson.cjs`
- Phase 2 (Escalation Contract): criteria already written; calibration is a human activity
- Phase 3 (Park-Don't-Block): established GSD JSONL patterns; complexity is implementation correctness
- Phase 5 (Discussion Loop): multi-role inline prompt with convergence brake; well-scoped
- Phase 6 (Resume + Triage): build on stable primitives; triage is structured prompt + mailbox write

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against live `claude` v2.1.172, `gsd-tools.cjs` source, `package.json`; zero new npm dependencies; all primitives confirmed present |
| Features | HIGH | Primary sources: PROJECT.md and REQUIREMENTS.md; comparable-systems analysis HIGH for LangGraph/AutoGen/OpenHands, MEDIUM for Devin |
| Architecture | HIGH | Direct inspection of all existing source files; integration points confirmed against `discuss-phase.md`, `autonomous.md`, `lesson.cjs`, `gsd-tools.cjs` |
| Pitfalls | HIGH | Drawn from direct codebase reading (CONCERNS.md, cross-phase-notes), first-party GSD architectural decisions from v1.5 Phases 2/5/7/9 |

**Overall confidence:** HIGH

### Gaps to Address

- **Headless session lifespan:** How long does a `claude -p --permission-mode bypassPermissions` session run before token expiry? Not documented; must be empirically tested as Wave-0 in Phase 4. If sessions expire mid-run, Phase 4 must design a resume-on-auth-failure path.
- **`harness.run_id` coordination mechanism:** ARCHITECTURE.md assumes `config-set harness.run_id` as the signal between `overnight.md` and `discuss-phase.md`. The exact mechanism (new config key vs dedicated `RUN-META.json` field) must be chosen in Phase 1 before any workflow wiring is built.
- **Parallel worktree writes to `agent-trace.jsonl`:** Multiple overnight worktrees writing to the same telemetry file risk JSONL interleaving. Fix is per-run trace files merged at run end; this scoping decision in Phase 4 affects `gsd2-agent-trace.js`.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — v1.6 requirements, constraints, trust ladder principle
- `get-shit-done/bin/gsd-tools.cjs` — CLI dispatch pattern, existing lib module structure
- `get-shit-done/bin/lib/lesson.cjs` — JSONL ledger template
- `get-shit-done/workflows/discuss-phase.md` + `autonomous.md` — integration anchor points
- Live `claude --help` + `claude -p --output-format json` — confirmed flags and result fields in v2.1.172
- `strings` over installed claude binary v2.1.172 — confirmed hook event names
- CONCERNS.md + GSD cross-phase-notes (Phases 2, 5, 7, 9) — documented failure modes from v1.5

### Secondary (MEDIUM confidence)
- LangGraph HITL documentation (`interrupt()`, `MemorySaver`) — escalation blocking patterns
- AutoGen GroupChat API (`human_input_mode`, `HumanProxyAgent`) — multi-agent deliberation
- OpenHands `AgentController` state machine — headless termination behavior

### Tertiary (MEDIUM-LOW confidence)
- Devin session behavior — training data through Aug 2025
- SWE-bench evaluation harness pattern — applicable by analogy

---
*Research completed: 2026-06-10*
*Ready for roadmap: yes*

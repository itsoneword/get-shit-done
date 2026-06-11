# Requirements: GSD v1.6 Autonomous Supervision Harness

**Defined:** 2026-06-10
**Core Value:** Every line of code written by an AI agent should trace back to a requirement that was discussed, planned, and verified — not improvised.

**Input analysis:** `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS), conversation 2026-06-10.

**Guiding principle:** The harness *proposes, never disposes*. Every autonomous decision auditable from the ledger alone. Trust ladder: single-phase interactive validation gates overnight multi-phase runs.

_(v1.5 requirements: all SEC/RSCH/GUIDE/CONV/FIX/SKILL/PAR/CORPUS/TEACH shipped — see `.planning/v1.5/` and git history. CTX-01/02 remain reshaped → future doctor phase.)_

## v1.6 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Decision Ledger (LEDGER)

- [x] **LEDGER-01**: Every autonomous decision in a harness run is appended to a per-run `DECISIONS.jsonl` — decision, alternatives considered, evidence, confidence, escalated flag — with schema enforced at write time
- [x] **LEDGER-02**: User can read and filter a run's ledger via gsd-tools CLI (by phase, verdict, escalated)
- [x] **LEDGER-03**: Ledger behavior is gated by harness run context (e.g. `harness.run_id`) — interactive sessions have zero behavior change

### Escalation Contract (ESC)

- [x] **ESC-01**: A written escalation contract artifact defines discrete criteria (irreversibility, security boundary, scope change, spec ambiguity) mapped to a three-tier verdict schema: proceed / proceed-and-log / park-and-ask
- [x] **ESC-02**: `discuss-phase --auto` under a harness run evaluates each decision against the contract and records the verdict in the ledger
- [x] **ESC-03**: Escalation precision is calibrated against a golden set of ≥10 decisions before any overnight run is permitted (trust-ladder gate)

### Park-Don't-Block (PARK)

- [ ] **PARK-01**: A park-and-ask verdict appends question + context snapshot to a per-run `MAILBOX.jsonl`; the parked branch stops while the run continues other work
- [ ] **PARK-02**: User can review and answer all parked questions in one inbox command
- [ ] **PARK-03**: Answering resumes the parked branch with a staleness check — current planning state (STATE.md, ROADMAP.md, cross-phase-notes.md) is re-read before replay
- [ ] **PARK-04**: Stuck detection — an identical ledger hash across consecutive snapshots flags the run

### Overnight Runner (RUN)

- [ ] **RUN-01**: `/gsd2:overnight` runs remaining phases unattended (wrapping `/gsd2:autonomous`) with ledger + escalation + mailbox active
- [ ] **RUN-02**: Per-phase execution is worktree-isolated; merge conflicts route to the mailbox, never silently swallowed (`cmdWorktreeMerge` exits 0 on conflict — runner must check `clean:false`)
- [ ] **RUN-03**: Startup health check + `run.log`; auth/permission failures fail loudly, no silent retry
- [ ] **RUN-04**: Morning report summarizes decisions made, questions parked, phases completed

### Discussion Loop (LOOP)

- [ ] **LOOP-01**: `/gsd2:discuss-loop` runs multi-lens judgment (skeptic / user-advocate / architect) anchored to a concrete artifact, not abstract positions
- [ ] **LOOP-02**: A convergence brake tests content delta with a hard round cap; non-convergence escalates the top divergent positions to the mailbox — never a synthesized average

### Triage Worker (TRIAGE)

- [ ] **TRIAGE-01**: `/gsd2:triage` analyzes pending todos/backlog against codebase + roadmap and emits six-verdict proposals (already-done / obsolete / fold-into-phase / new-phase / needs-input / defer) into the mailbox, each with evidence
- [ ] **TRIAGE-02**: Triage writes only to the mailbox; routing (promote, fold, mark done, delete) executes only on human acceptance in the inbox

## Future Requirements

Deferred — tracked but not in this roadmap.

### Harness v2

- **HARN-V2-01**: Escalation precision scoring command (needs accumulated ledger data first)
- **HARN-V2-02**: Cross-session/run ledger aggregation
- **HARN-V2-03**: Real-time external notifications (Slack/email) — `tail -f` MAILBOX + inbox command suffice for v1.6

## Out of Scope

| Feature | Reason |
|---------|--------|
| Supervisor as a spawned subagent | Subagents lack Skill/Agent tool grants — supervision logic runs at orchestrator/CLI level only (v1.5 Phase 2 lesson) |
| Autonomous disposal of todos/backlog | Propose-never-dispose is load-bearing for trust; silent discards destroy the harness's value |
| New npm runtime dependencies | All primitives exist (JSONL via fs, headless `claude -p`, system cron); GSD stays dependency-free |
| Persistent daemon process (node-cron etc.) | System cron + fire-and-forget headless runs cover scheduling without a resident process |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEDGER-01 | Phase 10 | Complete |
| LEDGER-02 | Phase 10 | Complete |
| LEDGER-03 | Phase 10 | Complete |
| ESC-01 | Phase 11 | Complete |
| ESC-02 | Phase 11 | Complete |
| ESC-03 | Phase 11 | Complete |
| PARK-01 | Phase 12 | Pending |
| PARK-02 | Phase 12 | Pending |
| PARK-03 | Phase 12 | Pending |
| PARK-04 | Phase 12 | Pending |
| RUN-01 | Phase 13 | Pending |
| RUN-02 | Phase 13 | Pending |
| RUN-03 | Phase 13 | Pending |
| RUN-04 | Phase 13 | Pending |
| LOOP-01 | Phase 14 | Pending |
| LOOP-02 | Phase 14 | Pending |
| TRIAGE-01 | Phase 15 | Pending |
| TRIAGE-02 | Phase 15 | Pending |

**Coverage:**
- v1.6 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-10 — traceability filled after roadmap creation (18 requirements, Phases 10-15)*
